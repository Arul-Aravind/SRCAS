import type { GuardianIssue } from "./guardianTypes";

export const HARD_SAFETY_CONFIG = Object.freeze({
  faceLostQualificationMs: 260,
  cameraUnavailableQualificationMs: 0,
  criticalLightQualificationMs: 480,
  recoveryQualificationMs: 1250,
  protectiveMinimumMs: 650,
  recoveryTrackingQuality: 0.68,
  recoveryFaceCompleteness: 0.86,
  recoveryPoseStability: 0.7,
});

export const ADAPTIVE_CONFIG = Object.freeze({
  cautionQualificationMs: 520,
  healthySuccessMs: 1600,
  poorLuminance: 0.28,
  severeLuminance: 0.14,
  poorDarkPixelRatio: 0.58,
  severeDarkPixelRatio: 0.78,
  minimumContrast: 0.12,
  lowConfidence: 0.58,
  partialEdgeMargin: 0.025,
  partialCompleteness: 0.82,
  centeredTolerance: 0.16,
  maximumSmoothingDelta: 0.1,
  maximumStabilityDelta: 0.08,
});

export const INCIDENT_PRIORITY: Record<GuardianIssue, number> = {
  CAMERA_UNAVAILABLE: 100,
  PROTECTIVE_HOLD: 98,
  NO_FACE: 96,
  SEVERE_LOW_LIGHT: 94,
  PARTIAL_LEFT: 82,
  PARTIAL_RIGHT: 82,
  PARTIAL_TOP: 82,
  PARTIAL_BOTTOM: 82,
  LOW_LIGHT: 72,
  LOW_CONFIDENCE: 60,
  NONE: 0,
};

