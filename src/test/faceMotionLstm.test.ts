import { describe, expect, it } from "vitest";
import { FaceMotionLstm } from "@/lib/faceMotionLstm";

const degToRad = (degrees: number) => (degrees * Math.PI) / 180;

const stepPose = (
  detector: FaceMotionLstm,
  pose: { yaw: number; pitch: number; roll: number },
  delta: Partial<{ yaw: number; pitch: number; roll: number }>,
  frames: number,
  startTime = 0
) => {
  let time = startTime;
  let snapshot = detector.step(pose, time);

  for (let index = 0; index < frames; index += 1) {
    pose.yaw += degToRad(delta.yaw ?? 0);
    pose.pitch += degToRad(delta.pitch ?? 0);
    pose.roll += degToRad(delta.roll ?? 0);
    time += 33;
    snapshot = detector.step(pose, time);
  }

  return { pose, time, snapshot };
};

describe("FaceMotionLstm", () => {
  it("warms up into a steady state when the face is still", () => {
    const detector = new FaceMotionLstm();
    const pose = { yaw: 0, pitch: 0, roll: 0 };

    const { snapshot } = stepPose(detector, pose, {}, 10);

    expect(snapshot.ready).toBe(true);
    expect(snapshot.label).toBe("steady");
    expect(snapshot.stable).toBe(true);
    expect(snapshot.confidence).toBeGreaterThan(0.4);
  });

  it("detects horizontal turning motion from a yaw sequence", () => {
    const detector = new FaceMotionLstm();
    const pose = { yaw: 0, pitch: 0, roll: 0 };

    const { snapshot } = stepPose(detector, pose, { yaw: -4 }, 10);

    expect(snapshot.ready).toBe(true);
    expect(snapshot.label).toBe("turn-left");
    expect(snapshot.stable).toBe(false);
    expect(snapshot.energy).toBeGreaterThan(0.1);
  });

  it("returns to steady after movement settles", () => {
    const detector = new FaceMotionLstm();
    const pose = { yaw: 0, pitch: 0, roll: 0 };

    const moving = stepPose(detector, pose, { pitch: 4 }, 8);
    const settled = stepPose(detector, moving.pose, {}, 14, moving.time);

    expect(moving.snapshot.label).toBe("look-down");
    expect(settled.snapshot.label).toBe("steady");
    expect(settled.snapshot.stable).toBe(true);
    expect(settled.snapshot.stableDurationMs).toBeGreaterThan(0);
  });
});
