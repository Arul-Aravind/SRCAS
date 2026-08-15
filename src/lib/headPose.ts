import type { PoseAngles } from "@/lib/faceMotionLstm";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * Converts MediaPipe's column-major 4x4 facial transformation matrix into
 * yaw (Y), pitch (X), and roll (Z) using the same ZYX convention as the
 * De-Disabled reference implementation.
 */
export function poseFromTransformationMatrix(matrix: ArrayLike<number>): PoseAngles {
  if (matrix.length !== 16) throw new Error("A MediaPipe facial transformation matrix must contain 16 values.");
  const r00 = matrix[0];
  const r01 = matrix[4];
  const r10 = matrix[1];
  const r11 = matrix[5];
  const r20 = matrix[2];
  const r21 = matrix[6];
  const r22 = matrix[10];
  const yaw = Math.asin(clamp(-r20, -1, 1));
  let roll = Math.atan2(r10, r00);
  let pitch = Math.atan2(r21, r22);

  if (Math.abs(Math.cos(yaw)) < 1e-6) {
    roll = Math.atan2(-r01, r11);
    pitch = 0;
  }

  const clean = (value: number) => Math.abs(value) < 1e-12 ? 0 : value;
  return { yaw: clean(yaw), pitch: clean(pitch), roll: clean(roll) };
}
