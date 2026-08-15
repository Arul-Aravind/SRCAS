import { describe, expect, it } from "vitest";
import {
  applyAdaptiveSmoothing,
  applyDeadZone,
  applyResponseCurve,
  applyTargetAttraction,
  EMPTY_ACQUISITION,
  mapAbsoluteHeadControl,
  normalizeAsymmetricPose,
  resolveTargetAcquisition,
  robustDirectionalRange,
  robustPoseCenter,
  scoreTargetCandidate,
  updateDwellProgress,
} from "@/lib/controlPipeline";

describe("LuminaXR control pipeline", () => {
  it("suppresses movement inside the neutral dead zone", () => {
    expect(applyDeadZone(0.08, 0.12)).toBe(0);
    expect(applyDeadZone(-0.12, 0.12)).toBe(0);
    expect(applyDeadZone(0.56, 0.12)).toBeGreaterThan(0);
  });

  it("keeps small response-curve movements precise", () => {
    expect(applyResponseCurve(0.2)).toBeLessThan(0.2);
    expect(applyResponseCurve(-0.7)).toBeLessThan(0);
  });

  it("releases smoothing during long travel", () => {
    const short = applyAdaptiveSmoothing({ x: 0, y: 0 }, { x: 2, y: 0 }, 0.86);
    const long = applyAdaptiveSmoothing({ x: 0, y: 0 }, { x: 50, y: 0 }, 0.86);
    expect(long.x / 50).toBeGreaterThan(short.x / 2);
  });

  it("attracts nearby targets without teleporting", () => {
    const output = applyTargetAttraction({ x: 10, y: 10 }, { x: 50, y: 10 }, 0.7, 100);
    expect(output.x).toBeGreaterThan(10);
    expect(output.x).toBeLessThan(50);
  });

  it("advances only qualified dwell and respects decay policy", () => {
    const advanced = updateDwellProgress({
      progress: 0.2,
      deltaMs: 200,
      dwellMs: 1000,
      qualified: true,
      decay: "decay",
    });
    const interrupted = updateDwellProgress({
      progress: advanced,
      deltaMs: 200,
      dwellMs: 1000,
      qualified: false,
      decay: "decay",
    });
    expect(advanced).toBeGreaterThan(0.2);
    expect(interrupted).toBeLessThan(advanced);
  });

  it("learns a robust neutral pose without trusting spikes", () => {
    const center = robustPoseCenter([
      { yaw: 1, pitch: -2, roll: 0.2 },
      { yaw: 1.1, pitch: -1.9, roll: 0.1 },
      { yaw: 0.9, pitch: -2.1, roll: 0.3 },
      { yaw: 1.05, pitch: -2.05, roll: 0.2 },
      { yaw: 42, pitch: 31, roll: -28 },
    ]);
    expect(center.yaw).toBeCloseTo(1.025, 1);
    expect(center.pitch).toBeCloseTo(-2.025, 1);
  });

  it("preserves asymmetric comfortable ranges", () => {
    expect(normalizeAsymmetricPose(-8, 0, 8, 20)).toBe(-1);
    expect(normalizeAsymmetricPose(8, 0, 8, 20)).toBeCloseTo(0.4);
    expect(robustDirectionalRange([-2, -5, -7, -8, -9, -40], 0, -1)).toBeLessThan(12);
  });

  it("maps calibrated head pose directly into reference percentage space", () => {
    const neutral = { yaw: 0, pitch: 0, roll: 0 };
    const centered = mapAbsoluteHeadControl({ pose: neutral, neutral, leftRange: 24, rightRange: 24, upRange: 18, downRange: 18, width: 1000, height: 800, sensitivity: 65, horizontalSensitivity: 65, verticalSensitivity: 65, deadZone: 0.05, invertX: true, invertY: false });
    const turnedRight = mapAbsoluteHeadControl({ pose: { yaw: 24, pitch: 0, roll: 0 }, neutral, leftRange: 24, rightRange: 24, upRange: 18, downRange: 18, width: 1000, height: 800, sensitivity: 65, horizontalSensitivity: 65, verticalSensitivity: 65, deadZone: 0.05, invertX: true, invertY: false });
    expect(centered).toEqual({ x: 500, y: 400 });
    expect(turnedRight.x).toBeLessThan(100);
    expect(turnedRight.y).toBe(400);
  });

  it("lets the default camera profile reach the vertical screen edges", () => {
    const common = { neutral: { yaw: 0, pitch: 0, roll: 0 }, leftRange: 24, rightRange: 24, upRange: 18, downRange: 18, width: 1000, height: 800, sensitivity: 65, horizontalSensitivity: 65, verticalSensitivity: 62, deadZone: 0.05, invertX: false, invertY: false };
    const top = mapAbsoluteHeadControl({ ...common, pose: { yaw: 0, pitch: -18, roll: 0 } });
    const bottom = mapAbsoluteHeadControl({ ...common, pose: { yaw: 0, pitch: 18, roll: 0 } });
    expect(top.y).toBeLessThan(80);
    expect(bottom.y).toBeGreaterThan(720);
  });

  it("preserves edge reach at lower sensitivity", () => {
    const bottom = mapAbsoluteHeadControl({ pose: { yaw: 0, pitch: 18, roll: 0 }, neutral: { yaw: 0, pitch: 0, roll: 0 }, leftRange: 24, rightRange: 24, upRange: 18, downRange: 18, width: 1000, height: 800, sensitivity: 52, horizontalSensitivity: 65, verticalSensitivity: 62, deadZone: 0.05, invertX: false, invertY: false });
    expect(bottom.y).toBeGreaterThan(720);
  });

  it("uses the measured range for each head direction", () => {
    const common = { neutral: { yaw: 0, pitch: 0, roll: 0 }, upRange: 18, downRange: 18, width: 1000, height: 800, sensitivity: 65, horizontalSensitivity: 65, verticalSensitivity: 65, deadZone: 0, invertX: false, invertY: false };
    const lowRange = mapAbsoluteHeadControl({ ...common, pose: { yaw: 8, pitch: 0, roll: 0 }, leftRange: 8, rightRange: 8 });
    const highRange = mapAbsoluteHeadControl({ ...common, pose: { yaw: 8, pitch: 0, roll: 0 }, leftRange: 20, rightRange: 20 });
    expect(lowRange.x).toBeGreaterThan(highRange.x);
  });

  it("requires persistent superiority before switching nearby targets", () => {
    const rectA = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
    const rectB = { left: 110, top: 0, right: 210, bottom: 100, width: 100, height: 100 };
    const targetA = scoreTargetCandidate({ x: 80, y: 50 }, { id: "a", rect: rectA, priority: 0, attractionStrength: 0.7, disabled: false });
    const targetB = scoreTargetCandidate({ x: 80, y: 50 }, { id: "b", rect: rectB, priority: 0, attractionStrength: 0.7, disabled: false });
    const pending = resolveTargetAcquisition({ memory: EMPTY_ACQUISITION, candidates: [targetA, targetB], now: 0 });
    const acquired = resolveTargetAcquisition({ memory: pending.memory, candidates: [targetA, targetB], now: 100 });
    expect(acquired.target?.id).toBe("a");

    const slightlyBetterB = { ...targetB, score: targetA.score + 0.05 };
    const retained = resolveTargetAcquisition({ memory: acquired.memory, candidates: [targetA, slightlyBetterB], now: 400 });
    expect(retained.target?.id).toBe("a");
  });
});
