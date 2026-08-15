import { describe, expect, it } from "vitest";
import { poseFromTransformationMatrix, toDegrees } from "@/lib/headPose";

const identity = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

describe("MediaPipe head pose extraction", () => {
  it("reads an identity transform as a neutral pose", () => {
    expect(poseFromTransformationMatrix(identity)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it("extracts yaw from a column-major Y-axis rotation", () => {
    const angle = Math.PI / 6;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const matrix = [
      cosine, 0, -sine, 0,
      0, 1, 0, 0,
      sine, 0, cosine, 0,
      0, 0, 0, 1,
    ];
    const pose = poseFromTransformationMatrix(matrix);
    expect(toDegrees(pose.yaw)).toBeCloseTo(30, 5);
    expect(pose.pitch).toBeCloseTo(0, 5);
    expect(pose.roll).toBeCloseTo(0, 5);
  });

  it("rejects malformed transformation matrices", () => {
    expect(() => poseFromTransformationMatrix([1, 0, 0])).toThrow(/16 values/);
  });
});
