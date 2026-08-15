import { clamp, percentile } from "@/lib/controlPipeline";

export type StabilitySample = {
  timestamp: number;
  velocity: number;
  velocityX: number;
  velocityY: number;
  trackingQuality: number;
};

export type StabilitySnapshot = {
  score: number;
  stable: boolean;
  stableDurationMs: number;
  averageVelocity: number;
  velocityVariation: number;
  directionChanges: number;
  sampleCount: number;
};

const EMPTY_STABILITY: StabilitySnapshot = {
  score: 0,
  stable: false,
  stableDurationMs: 0,
  averageVelocity: 0,
  velocityVariation: 0,
  directionChanges: 0,
  sampleCount: 0,
};

export class StabilityEstimator {
  private samples: StabilitySample[] = [];
  private stable = false;
  private qualifyingSince: number | null = null;
  private stableSince: number | null = null;

  constructor(
    private readonly windowMs = 360,
    private readonly enterThreshold = 0.78,
    private readonly exitThreshold = 0.61,
    private readonly enterHoldMs = 130,
  ) {}

  reset() {
    this.samples = [];
    this.stable = false;
    this.qualifyingSince = null;
    this.stableSince = null;
  }

  step(sample: StabilitySample): StabilitySnapshot {
    if (!Number.isFinite(sample.timestamp) || sample.trackingQuality <= 0) {
      this.reset();
      return EMPTY_STABILITY;
    }

    this.samples.push(sample);
    const cutoff = sample.timestamp - this.windowMs;
    while (this.samples.length && this.samples[0].timestamp < cutoff) this.samples.shift();

    const velocities = this.samples.map((entry) => Math.max(0, entry.velocity));
    const averageVelocity = velocities.reduce((sum, value) => sum + value, 0) / Math.max(1, velocities.length);
    const velocityVariation = Math.sqrt(
      velocities.reduce((sum, value) => sum + Math.pow(value - averageVelocity, 2), 0) / Math.max(1, velocities.length),
    );
    const highVelocity = percentile(velocities, 0.8);

    let directionChanges = 0;
    for (let index = 2; index < this.samples.length; index += 1) {
      const previous = this.samples[index - 1];
      const current = this.samples[index];
      if (Math.sign(previous.velocityX) !== Math.sign(current.velocityX) && Math.abs(previous.velocityX) + Math.abs(current.velocityX) > 80) directionChanges += 1;
      if (Math.sign(previous.velocityY) !== Math.sign(current.velocityY) && Math.abs(previous.velocityY) + Math.abs(current.velocityY) > 80) directionChanges += 1;
    }

    const velocityQuality = 1 - clamp(highVelocity / 520, 0, 1);
    const variationQuality = 1 - clamp(velocityVariation / 260, 0, 1);
    const directionQuality = 1 - clamp(directionChanges / Math.max(3, this.samples.length * 0.32), 0, 1);
    const historyQuality = clamp(this.samples.length / 6, 0.35, 1);
    const score = clamp(
      sample.trackingQuality * (velocityQuality * 0.58 + variationQuality * 0.27 + directionQuality * 0.15) * historyQuality,
      0,
      1,
    );

    if (this.stable) {
      if (score < this.exitThreshold) {
        this.stable = false;
        this.qualifyingSince = null;
        this.stableSince = null;
      }
    } else if (score >= this.enterThreshold) {
      this.qualifyingSince ??= sample.timestamp;
      if (sample.timestamp - this.qualifyingSince >= this.enterHoldMs) {
        this.stable = true;
        this.stableSince = sample.timestamp;
      }
    } else {
      this.qualifyingSince = null;
    }

    return {
      score,
      stable: this.stable,
      stableDurationMs: this.stable && this.stableSince != null ? sample.timestamp - this.stableSince : 0,
      averageVelocity,
      velocityVariation,
      directionChanges,
      sampleCount: this.samples.length,
    };
  }
}
