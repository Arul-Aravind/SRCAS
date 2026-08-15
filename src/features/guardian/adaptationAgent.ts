import { ADAPTIVE_CONFIG, HARD_SAFETY_CONFIG } from "./guardianConfig";
import type { AdaptationProposal, GuardianIncident, PerceptionReport } from "./guardianTypes";

export function runAdaptationAgent(
  perception: PerceptionReport,
  incident: GuardianIncident | null,
  poseStability: number,
): AdaptationProposal {
  const type = incident?.type ?? "NONE";
  const hardFailure = type === "CAMERA_UNAVAILABLE"
    || type === "NO_FACE"
    || type === "SEVERE_LOW_LIGHT"
    || type === "PROTECTIVE_HOLD";
  const partial = type.startsWith("PARTIAL_");
  const caution = partial || type === "LOW_LIGHT" || type === "LOW_CONFIDENCE";
  const lowLightAssist = perception.lighting === "POOR" || perception.lighting === "SEVERE";
  const safetyVerified = perception.cameraAvailable
    && perception.faceVisible
    && !perception.partialDirection
    && perception.faceCompleteness >= HARD_SAFETY_CONFIG.recoveryFaceCompleteness
    && perception.trackingQuality >= HARD_SAFETY_CONFIG.recoveryTrackingQuality
    && perception.lighting !== "SEVERE"
    && poseStability >= HARD_SAFETY_CONFIG.recoveryPoseStability;

  return {
    protectiveHold: hardFailure,
    dwellSuppressed: hardFailure || partial,
    pointerMode: hardFailure ? "FROZEN" : caution ? "CONSERVATIVE" : "NORMAL",
    lowLightAssist,
    smoothingDelta: lowLightAssist
      ? ADAPTIVE_CONFIG.maximumSmoothingDelta
      : caution ? ADAPTIVE_CONFIG.maximumSmoothingDelta * 0.6 : 0,
    stabilityDelta: lowLightAssist
      ? ADAPTIVE_CONFIG.maximumStabilityDelta
      : caution ? ADAPTIVE_CONFIG.maximumStabilityDelta * 0.5 : 0,
    safetyVerified,
    reason: hardFailure
      ? "Safety policy requires a protective hold."
      : caution
        ? "Conservative tracking is active while the signal stabilizes."
        : "No adaptation is required.",
  };
}
