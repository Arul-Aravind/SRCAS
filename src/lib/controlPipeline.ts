import type { NeutralPose, Point } from "@/types/luminax";

export const clamp = (value: number, min = -1, max = 1) =>
  Math.max(min, Math.min(max, value));

export function applyDeadZone(value: number, deadZone: number) {
  const zone = clamp(deadZone, 0, 0.8);
  const magnitude = Math.abs(value);
  if (magnitude <= zone) return 0;
  return Math.sign(value) * ((magnitude - zone) / (1 - zone));
}

export function applyResponseCurve(value: number, gamma = 1.55) {
  return Math.sign(value) * Math.pow(Math.abs(clamp(value)), gamma);
}

export function normalizePose(
  value: number,
  neutral: number,
  comfortableRange: number,
) {
  const range = Math.max(0.01, Math.abs(comfortableRange));
  return clamp((value - neutral) / range);
}

export function applyAdaptiveSmoothing(
  previous: Point,
  target: Point,
  smoothing: number,
  nearTarget = false,
) {
  const distance = Math.hypot(target.x - previous.x, target.y - previous.y);
  const base = clamp(smoothing + (nearTarget ? 0.08 : 0), 0.1, 0.98);
  const travelRelease = clamp(distance / 28, 0, 0.55);
  const alpha = clamp(1 - base + travelRelease, 0.04, 0.82);
  return {
    x: previous.x + (target.x - previous.x) * alpha,
    y: previous.y + (target.y - previous.y) * alpha,
  };
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentile(values: number[], quantile: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = clamp(quantile, 0, 1) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function rejectOutliers(values: number[], threshold = 3.5) {
  if (values.length < 5) return [...values];
  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);
  if (mad < 1e-5) return values.filter((value) => Math.abs(value - center) < 0.35);
  const scale = 1.4826 * mad;
  return values.filter((value) => Math.abs(value - center) / scale <= threshold);
}

export function robustPoseCenter(samples: NeutralPose[]): NeutralPose {
  if (!samples.length) return { yaw: 0, pitch: 0, roll: 0 };
  const axis = (key: keyof NeutralPose) => median(rejectOutliers(samples.map((sample) => sample[key])));
  return { yaw: axis("yaw"), pitch: axis("pitch"), roll: axis("roll") };
}

export function robustDirectionalRange(
  samples: number[],
  neutral: number,
  direction: -1 | 1,
  quantile = 0.85,
) {
  const directed = rejectOutliers(
    samples
      .map((sample) => (sample - neutral) * direction)
      .filter((offset) => Number.isFinite(offset) && offset > 0.2),
  );
  return directed.length ? percentile(directed, quantile) : 0;
}

export function normalizeAsymmetricPose(
  value: number,
  neutral: number,
  negativeRange: number,
  positiveRange: number,
) {
  const offset = value - neutral;
  const range = offset < 0 ? Math.max(1, Math.abs(negativeRange)) : Math.max(1, Math.abs(positiveRange));
  return clamp(offset / range);
}

export function mapAbsoluteHeadControl({
  pose,
  neutral,
  leftRange,
  rightRange,
  upRange,
  downRange,
  width,
  height,
  sensitivity,
  horizontalSensitivity,
  verticalSensitivity,
  deadZone,
  invertX,
  invertY,
  padding = 24,
}: {
  pose: NeutralPose;
  neutral: NeutralPose;
  leftRange: number;
  rightRange: number;
  upRange: number;
  downRange: number;
  width: number;
  height: number;
  sensitivity: number;
  horizontalSensitivity: number;
  verticalSensitivity: number;
  deadZone: number;
  invertX: boolean;
  invertY: boolean;
  padding?: number;
}) {
  const normalizedX = normalizeAsymmetricPose(pose.yaw, neutral.yaw, leftRange, rightRange);
  const normalizedY = normalizeAsymmetricPose(pose.pitch, neutral.pitch, upRange, downRange);
  const overallGain = sensitivity / 65;
  const horizontalGain = overallGain * (horizontalSensitivity / 65);
  const verticalGain = overallGain * (verticalSensitivity / 65);
  const horizontalCurve = clamp(1.35 / Math.max(0.45, horizontalGain), 0.78, 2.2);
  const verticalCurve = clamp(1.35 / Math.max(0.45, verticalGain), 0.78, 2.2);
  const curvedX = applyResponseCurve(applyDeadZone(normalizedX, deadZone), horizontalCurve);
  const curvedY = applyResponseCurve(applyDeadZone(normalizedY, deadZone), verticalCurve);

  return applyBoundaryConstraints({
    x: width * (0.5 + curvedX * 0.48 * (invertX ? -1 : 1)),
    y: height * (0.5 + curvedY * 0.48 * (invertY ? -1 : 1)),
  }, width, height, padding);
}

export function applyBoundaryConstraints(point: Point, width: number, height: number, padding = 12) {
  return {
    x: clamp(point.x, padding, Math.max(padding, width - padding)),
    y: clamp(point.y, padding, Math.max(padding, height - padding)),
  };
}

export type RectLike = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type TargetCandidate = {
  id: string;
  rect: RectLike;
  priority: number;
  attractionStrength: number;
  disabled: boolean;
};

export type ScoredTarget = TargetCandidate & {
  center: Point;
  distance: number;
  inside: boolean;
  score: number;
};

export function scoreTargetCandidate(point: Point, target: TargetCandidate, radius = 160): ScoredTarget {
  const center = {
    x: target.rect.left + target.rect.width / 2,
    y: target.rect.top + target.rect.height / 2,
  };
  const inside = point.x >= target.rect.left && point.x <= target.rect.right && point.y >= target.rect.top && point.y <= target.rect.bottom;
  const distance = Math.hypot(center.x - point.x, center.y - point.y);
  if (target.disabled) return { ...target, center, distance, inside, score: 0 };
  const priority = clamp(target.priority / 10, -0.08, 0.12);
  if (inside) {
    const halfDiagonal = Math.max(1, Math.hypot(target.rect.width, target.rect.height) / 2);
    const centerWeight = 1 - clamp(distance / halfDiagonal, 0, 1);
    return { ...target, center, distance, inside, score: 1 + centerWeight * 0.16 + priority };
  }
  if (distance >= radius) return { ...target, center, distance, inside, score: 0 };
  const proximity = Math.pow(1 - distance / radius, 2);
  const assistance = clamp(target.attractionStrength, 0, 1);
  return { ...target, center, distance, inside, score: proximity * (0.58 + assistance * 0.42) + priority };
}

export type AcquisitionMemory = {
  targetId: string | null;
  acquiredAt: number;
  pendingTargetId: string | null;
  pendingSince: number;
};

export const EMPTY_ACQUISITION: AcquisitionMemory = {
  targetId: null,
  acquiredAt: 0,
  pendingTargetId: null,
  pendingSince: 0,
};

export function resolveTargetAcquisition({
  memory,
  candidates,
  now,
  switchMargin = 0.14,
  acquisitionDelayMs = 90,
  minimumHoldMs = 180,
}: {
  memory: AcquisitionMemory;
  candidates: ScoredTarget[];
  now: number;
  switchMargin?: number;
  acquisitionDelayMs?: number;
  minimumHoldMs?: number;
}): { memory: AcquisitionMemory; target: ScoredTarget | null } {
  const ranked = candidates.filter((candidate) => candidate.score > 0.035).sort((a, b) => b.score - a.score);
  const best = ranked[0] ?? null;
  const current = memory.targetId ? ranked.find((candidate) => candidate.id === memory.targetId) ?? null : null;

  if (current) {
    if (!best || best.id === current.id || best.score <= current.score + switchMargin || now - memory.acquiredAt < minimumHoldMs) {
      return { memory: { ...memory, pendingTargetId: null, pendingSince: 0 }, target: current };
    }
    if (memory.pendingTargetId !== best.id) {
      return { memory: { ...memory, pendingTargetId: best.id, pendingSince: now }, target: current };
    }
    if (now - memory.pendingSince < acquisitionDelayMs) return { memory, target: current };
    const switched = { targetId: best.id, acquiredAt: now, pendingTargetId: null, pendingSince: 0 };
    return { memory: switched, target: best };
  }

  if (!best) return { memory: EMPTY_ACQUISITION, target: null };
  if (memory.pendingTargetId !== best.id) {
    return { memory: { ...EMPTY_ACQUISITION, pendingTargetId: best.id, pendingSince: now }, target: null };
  }
  if (now - memory.pendingSince < acquisitionDelayMs) return { memory, target: null };
  const acquired = { targetId: best.id, acquiredAt: now, pendingTargetId: null, pendingSince: 0 };
  return { memory: acquired, target: best };
}

export function applyTargetAttraction(
  point: Point,
  targetCenter: Point | null,
  strength: number,
  radius = 150,
) {
  if (!targetCenter || strength <= 0) return point;
  const distance = Math.hypot(targetCenter.x - point.x, targetCenter.y - point.y);
  if (distance >= radius) return point;
  const pull = Math.pow(1 - distance / radius, 2) * clamp(strength, 0, 1) * 0.68;
  return {
    x: point.x + (targetCenter.x - point.x) * pull,
    y: point.y + (targetCenter.y - point.y) * pull,
  };
}

export function stabilityScore(velocity: number, confidence: number) {
  const velocityScore = 1 - clamp(velocity / 950, 0, 1);
  return Math.round(clamp(velocityScore * 0.72 + confidence * 0.28, 0, 1) * 100);
}

export function updateDwellProgress({
  progress,
  deltaMs,
  dwellMs,
  qualified,
  decay,
}: {
  progress: number;
  deltaMs: number;
  dwellMs: number;
  qualified: boolean;
  decay: "pause" | "decay" | "reset";
}) {
  if (qualified) return clamp(progress + deltaMs / Math.max(300, dwellMs), 0, 1);
  if (decay === "pause") return progress;
  if (decay === "reset") return 0;
  return clamp(progress - deltaMs / Math.max(400, dwellMs * 0.65), 0, 1);
}
