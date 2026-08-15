export type PoseAngles = {
  yaw: number;
  pitch: number;
  roll: number;
};

export const motionLabels = [
  "steady",
  "turn-left",
  "turn-right",
  "look-up",
  "look-down",
  "tilt-left",
  "tilt-right",
] as const;

export type MotionLabel = (typeof motionLabels)[number];

export type FaceMotionSnapshot = {
  label: MotionLabel;
  confidence: number;
  energy: number;
  stable: boolean;
  ready: boolean;
  stableDurationMs: number;
  movingDurationMs: number;
  probabilities: Record<MotionLabel, number>;
};

type Axis = "yaw" | "pitch" | "roll";
type AxisVector = Record<Axis, number>;

type DirectionUnit = {
  label: Exclude<MotionLabel, "steady">;
  axis: Axis;
  sign: -1 | 1;
};

const DIRECTION_UNITS: DirectionUnit[] = [
  { label: "turn-left", axis: "yaw", sign: -1 },
  { label: "turn-right", axis: "yaw", sign: 1 },
  { label: "look-up", axis: "pitch", sign: -1 },
  { label: "look-down", axis: "pitch", sign: 1 },
  { label: "tilt-left", axis: "roll", sign: -1 },
  { label: "tilt-right", axis: "roll", sign: 1 },
];

const NORMALIZATION_LIMITS: AxisVector = {
  yaw: 8,
  pitch: 7,
  roll: 8,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const lerp = (from: number, to: number, alpha: number) => from + (to - from) * alpha;
const radToDeg = (radians: number) => (radians * 180) / Math.PI;
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const createProbabilities = (steady = 0) =>
  motionLabels.reduce<Record<MotionLabel, number>>((acc, label) => {
    acc[label] = label === "steady" ? steady : 0;
    return acc;
  }, {} as Record<MotionLabel, number>);

const softmax = (scores: Record<MotionLabel, number>) => {
  const maxScore = Math.max(...motionLabels.map((label) => scores[label]));
  const exps = motionLabels.map((label) => Math.exp(scores[label] - maxScore));
  const total = exps.reduce((sum, value) => sum + value, 0) || 1;

  return motionLabels.reduce<Record<MotionLabel, number>>((acc, label, index) => {
    acc[label] = exps[index] / total;
    return acc;
  }, {} as Record<MotionLabel, number>);
};

export const faceMotionLabelText: Record<MotionLabel, string> = {
  steady: "Steady",
  "turn-left": "Turning left",
  "turn-right": "Turning right",
  "look-up": "Looking up",
  "look-down": "Looking down",
  "tilt-left": "Tilting left",
  "tilt-right": "Tilting right",
};

export const IDLE_FACE_MOTION: FaceMotionSnapshot = {
  label: "steady",
  confidence: 1,
  energy: 0,
  stable: false,
  ready: false,
  stableDurationMs: 0,
  movingDurationMs: 0,
  probabilities: createProbabilities(1),
};

export class FaceMotionLstm {
  private previousPose: PoseAngles | null = null;
  private previousTimestamp = 0;
  private filteredDelta: AxisVector = { yaw: 0, pitch: 0, roll: 0 };
  private cellState = new Array(DIRECTION_UNITS.length).fill(0);
  private hiddenState = new Array(DIRECTION_UNITS.length).fill(0);
  private frameCount = 0;
  private stableSince: number | null = null;
  private movingSince: number | null = null;

  reset() {
    this.previousPose = null;
    this.previousTimestamp = 0;
    this.filteredDelta = { yaw: 0, pitch: 0, roll: 0 };
    this.cellState.fill(0);
    this.hiddenState.fill(0);
    this.frameCount = 0;
    this.stableSince = null;
    this.movingSince = null;
  }

  step(pose: PoseAngles, timestampMs: number): FaceMotionSnapshot {
    const now = Number.isFinite(timestampMs) ? timestampMs : Date.now();

    if (!this.previousPose) {
      this.previousPose = { ...pose };
      this.previousTimestamp = now;
      this.frameCount = 1;
      return IDLE_FACE_MOTION;
    }

    const dtMs = clamp(now - this.previousTimestamp || 16.7, 12, 80);
    const alpha = clamp(dtMs / 95, 0.12, 0.36);

    const rawDelta: AxisVector = {
      yaw: radToDeg(pose.yaw - this.previousPose.yaw),
      pitch: radToDeg(pose.pitch - this.previousPose.pitch),
      roll: radToDeg(pose.roll - this.previousPose.roll),
    };

    this.previousPose = { ...pose };
    this.previousTimestamp = now;
    this.frameCount += 1;

    this.filteredDelta = {
      yaw: lerp(this.filteredDelta.yaw, rawDelta.yaw, alpha),
      pitch: lerp(this.filteredDelta.pitch, rawDelta.pitch, alpha),
      roll: lerp(this.filteredDelta.roll, rawDelta.roll, alpha),
    };

    const normalized: AxisVector = {
      yaw: clamp(this.filteredDelta.yaw / NORMALIZATION_LIMITS.yaw, -1, 1),
      pitch: clamp(this.filteredDelta.pitch / NORMALIZATION_LIMITS.pitch, -1, 1),
      roll: clamp(this.filteredDelta.roll / NORMALIZATION_LIMITS.roll, -1, 1),
    };

    const axisMagnitude: AxisVector = {
      yaw: Math.abs(normalized.yaw),
      pitch: Math.abs(normalized.pitch),
      roll: Math.abs(normalized.roll),
    };

    const crossAxisMagnitude: AxisVector = {
      yaw: axisMagnitude.pitch + axisMagnitude.roll,
      pitch: axisMagnitude.yaw + axisMagnitude.roll,
      roll: axisMagnitude.yaw + axisMagnitude.pitch,
    };

    const energy = clamp(
      Math.hypot(normalized.yaw, normalized.pitch, normalized.roll) / 1.25,
      0,
      1
    );

    DIRECTION_UNITS.forEach((unit, index) => {
      const signedComponent = normalized[unit.axis] * unit.sign;
      const aligned = Math.max(0, signedComponent);
      const opposing = Math.max(0, -signedComponent);
      const cross = crossAxisMagnitude[unit.axis];

      const forgetGate = sigmoid(-0.6 + 2.15 * energy + 0.8 * aligned + 0.25 * this.hiddenState[index]);
      const inputGate = sigmoid(-0.9 + 4.75 * aligned - 2.25 * opposing - 1.1 * cross);
      const candidate = Math.tanh(
        2.8 * aligned - 1.5 * opposing - 0.85 * cross + 0.15 * this.hiddenState[index]
      );
      const outputGate = sigmoid(0.2 + 1.8 * aligned - 0.75 * opposing - 0.6 * cross);

      const nextCell = forgetGate * this.cellState[index] + inputGate * candidate;
      const nextHidden = outputGate * Math.tanh(nextCell);

      if (energy < 0.08) {
        this.cellState[index] = nextCell * 0.76;
        this.hiddenState[index] = nextHidden * 0.72;
      } else {
        this.cellState[index] = nextCell;
        this.hiddenState[index] = nextHidden;
      }
    });

    const strongestMemory = Math.max(...this.hiddenState.map((value) => Math.abs(value)), 0);
    const scores = createProbabilities();
    scores.steady = 2.4 - energy * 5.5 - strongestMemory * 3.25;

    DIRECTION_UNITS.forEach((unit, index) => {
      const aligned = Math.max(0, normalized[unit.axis] * unit.sign);
      const cross = crossAxisMagnitude[unit.axis];
      scores[unit.label] = this.hiddenState[index] * 3.2 + aligned * 1.7 - cross * 0.75;
    });

    const probabilities = softmax(scores);
    const label = motionLabels.reduce<MotionLabel>((best, current) => {
      return probabilities[current] > probabilities[best] ? current : best;
    }, "steady");
    const confidence = probabilities[label];
    const ready = this.frameCount >= 4;
    const stable = ready && ((label === "steady" && confidence >= 0.42) || energy < 0.08);

    if (stable) {
      this.stableSince ??= now;
      this.movingSince = null;
    } else {
      this.movingSince ??= now;
      this.stableSince = null;
    }

    return {
      label: ready ? label : "steady",
      confidence: ready ? confidence : 1,
      energy,
      stable,
      ready,
      stableDurationMs: this.stableSince == null ? 0 : now - this.stableSince,
      movingDurationMs: this.movingSince == null ? 0 : now - this.movingSince,
      probabilities,
    };
  }
}
