import type { Point } from "@/types/luminax";

export type ReadingViewport = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function getReadingEdgeScrollVelocity(point: Point, viewport: ReadingViewport) {
  if (viewport.width <= 0 || viewport.height <= 0) return 0;

  const horizontalInset = Math.min(54, viewport.width * 0.06);
  const isOverBook = point.x >= viewport.left + horizontalInset
    && point.x <= viewport.right - horizontalInset
    && point.y >= viewport.top
    && point.y <= viewport.bottom;

  if (!isOverBook) return 0;

  const edgeZone = clamp(viewport.height * 0.16, 72, 124);
  const topThreshold = viewport.top + edgeZone;
  const bottomThreshold = viewport.bottom - edgeZone;

  if (point.y < topThreshold) {
    const intensity = clamp((topThreshold - point.y) / edgeZone, 0, 1);
    return -(36 * intensity + 484 * intensity * intensity);
  }

  if (point.y > bottomThreshold) {
    const intensity = clamp((point.y - bottomThreshold) / edgeZone, 0, 1);
    return 36 * intensity + 484 * intensity * intensity;
  }

  return 0;
}

export function getReadingHeadScrollVelocity({
  pitch,
  neutralPitch,
  upRange,
  downRange,
  invertVertical,
}: {
  pitch: number;
  neutralPitch: number;
  upRange: number;
  downRange: number;
  invertVertical: boolean;
}) {
  const directedPitch = (pitch - neutralPitch) * (invertVertical ? -1 : 1);
  const measuredRange = directedPitch < 0 ? upRange : downRange;
  const operationalRange = clamp(Math.abs(measuredRange), 3, 22);
  const normalizedIntent = clamp(Math.abs(directedPitch) / operationalRange, 0, 1);
  const activationThreshold = 0.5;

  if (normalizedIntent <= activationThreshold) return 0;

  const intensity = (normalizedIntent - activationThreshold) / (1 - activationThreshold);
  const speed = 42 * intensity + 438 * intensity * intensity;
  return Math.sign(directedPitch) * speed;
}
