import { clamp } from "@/lib/controlPipeline";
import type { DwellDecay, InteractionState } from "@/types/luminax";

export type DwellEngineInput = {
  now: number;
  targetId: string | null;
  targetLabel: string | null;
  acquiredAt: number;
  durationMs: number;
  trackingQuality: number;
  stabilityQuality: number;
  targetQuality: number;
  systemAvailability: number;
  stableSignal: boolean;
  decay: DwellDecay;
  majorInvalidation: boolean;
  confirmationStage: boolean;
};

export type DwellEngineSnapshot = {
  targetId: string | null;
  targetLabel: string | null;
  state: InteractionState;
  progress: number;
  evidenceMs: number;
  qualification: number;
  stable: boolean;
  interrupted: boolean;
  activated: boolean;
};

const emptySnapshot = (state: InteractionState = "idle"): DwellEngineSnapshot => ({
  targetId: null,
  targetLabel: null,
  state,
  progress: 0,
  evidenceMs: 0,
  qualification: 0,
  stable: false,
  interrupted: false,
  activated: false,
});

export class DwellEvidenceEngine {
  private targetId: string | null = null;
  private targetLabel: string | null = null;
  private evidenceMs = 0;
  private lastTimestamp = 0;
  private stableLatched = false;
  private stableSince: number | null = null;
  private blockedTargetId: string | null = null;
  private blockedUntil = 0;
  private state: InteractionState = "idle";

  reset(state: InteractionState = "idle") {
    this.targetId = null;
    this.targetLabel = null;
    this.evidenceMs = 0;
    this.lastTimestamp = 0;
    this.stableLatched = false;
    this.stableSince = null;
    this.state = state;
    if (state !== "activated") {
      this.blockedTargetId = null;
      this.blockedUntil = 0;
    }
    return emptySnapshot(state);
  }

  cancel() {
    return this.reset("cancelled");
  }

  step(input: DwellEngineInput): DwellEngineSnapshot {
    const deltaMs = this.lastTimestamp ? clamp(input.now - this.lastTimestamp, 8, 80) : 16.7;
    this.lastTimestamp = input.now;

    if (input.majorInvalidation) {
      const cancelledActiveTarget = Boolean(this.targetId || this.evidenceMs > 0);
      return this.reset(cancelledActiveTarget ? "cancelled" : "idle");
    }

    if (!input.targetId) {
      const state = this.targetId || this.evidenceMs > 0 ? "cancelled" : "idle";
      return this.reset(state);
    }

    if (input.targetId !== this.targetId) {
      this.targetId = input.targetId;
      this.targetLabel = input.targetLabel;
      this.evidenceMs = 0;
      this.stableLatched = false;
      this.stableSince = null;
      this.state = "candidate";
    }

    if (this.blockedTargetId === input.targetId && input.now < this.blockedUntil) {
      return {
        targetId: this.targetId,
        targetLabel: this.targetLabel,
        state: "activated",
        progress: 1,
        evidenceMs: input.durationMs,
        qualification: 1,
        stable: true,
        interrupted: false,
        activated: false,
      };
    }
    if (this.blockedTargetId && input.now >= this.blockedUntil) {
      this.blockedTargetId = null;
      this.evidenceMs = 0;
    }

    const qualification = clamp(
      input.trackingQuality * input.stabilityQuality * input.targetQuality * input.systemAvailability,
      0,
      1,
    );
    const enterStable = 0.72;
    const exitStable = 0.54;

    if (this.stableLatched) {
      if (!input.stableSignal || qualification < exitStable) {
        this.stableLatched = false;
        this.stableSince = null;
      }
    } else if (input.stableSignal && qualification >= enterStable) {
      this.stableSince ??= input.now;
      if (input.now - this.stableSince >= 90) this.stableLatched = true;
    } else {
      this.stableSince = null;
    }

    const targetAge = Math.max(0, input.now - input.acquiredAt);
    let interrupted = false;

    if (targetAge < 80) {
      this.state = "candidate";
    } else if (targetAge < 170) {
      this.state = "acquired";
    } else if (!this.stableLatched) {
      this.state = this.evidenceMs > 0 ? "interrupted" : "stabilizing";
      interrupted = this.evidenceMs > 0;
      if (input.decay === "reset") this.evidenceMs = 0;
      else if (input.decay === "decay") this.evidenceMs = Math.max(0, this.evidenceMs - deltaMs * 0.78);
    } else {
      this.state = input.confirmationStage ? "confirming" : "dwelling";
      this.evidenceMs += deltaMs * qualification;
    }

    const duration = Math.max(300, input.durationMs);
    const progress = clamp(this.evidenceMs / duration, 0, 1);
    if (progress >= 0.985) {
      this.evidenceMs = duration;
      this.state = "activated";
      this.blockedTargetId = input.targetId;
      this.blockedUntil = input.now + 1050;
      return {
        targetId: this.targetId,
        targetLabel: this.targetLabel,
        state: "activated",
        progress: 1,
        evidenceMs: duration,
        qualification,
        stable: true,
        interrupted: false,
        activated: true,
      };
    }

    return {
      targetId: this.targetId,
      targetLabel: this.targetLabel,
      state: this.state,
      progress,
      evidenceMs: this.evidenceMs,
      qualification,
      stable: this.stableLatched,
      interrupted,
      activated: false,
    };
  }
}
