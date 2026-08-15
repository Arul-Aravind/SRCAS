import type { TrackingMode, TrackingStatus } from "@/types/luminax";

export type GuardianAgent = "PERCEPTION" | "MASTER" | "SAFETY" | "GUIDE" | "SYSTEM";

export type GuardianScenario =
  | "HEALTHY"
  | "NO_FACE"
  | "PARTIAL_LEFT"
  | "PARTIAL_RIGHT"
  | "PARTIAL_TOP"
  | "PARTIAL_BOTTOM"
  | "LOW_LIGHT"
  | "SEVERE_LOW_LIGHT"
  | "LOW_CONFIDENCE"
  | "PROTECTIVE_HOLD"
  | "RECOVERING";

export type GuardianIssue =
  | "NONE"
  | "CAMERA_UNAVAILABLE"
  | "NO_FACE"
  | "PARTIAL_LEFT"
  | "PARTIAL_RIGHT"
  | "PARTIAL_TOP"
  | "PARTIAL_BOTTOM"
  | "SEVERE_LOW_LIGHT"
  | "LOW_LIGHT"
  | "LOW_CONFIDENCE"
  | "PROTECTIVE_HOLD";

export type GuardianPhase =
  | "MONITORING"
  | "QUALIFYING"
  | "GUIDING"
  | "PROTECTIVE_HOLD"
  | "RECOVERING"
  | "SUCCESS"
  | "SAFE_PAUSED";

export type GuardianSeverity = "INFO" | "CAUTION" | "CRITICAL";
export type GuardianDirection = "LEFT" | "RIGHT" | "UP" | "DOWN" | "CENTER" | "STILL";
export type LightingQuality = "GOOD" | "POOR" | "SEVERE";

export type FaceBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type GuardianPerceptionInput = {
  mode: TrackingMode;
  status: TrackingStatus;
  modelStatus: string;
  faceVisible: boolean;
  faceBounds: FaceBounds | null;
  faceCompleteness: number;
  trackingQuality: number;
  luminance: number;
  contrast: number;
  darkPixelRatio: number;
  highlightRatio: number;
  cameraAvailable: boolean;
  scenario: GuardianScenario;
};

export type PerceptionReport = {
  timestamp: number;
  source: "CAMERA" | "DEMO";
  scenario: GuardianScenario;
  cameraAvailable: boolean;
  faceVisible: boolean;
  faceBounds: FaceBounds | null;
  faceCompleteness: number;
  faceCentered: boolean;
  partialDirection: GuardianDirection | null;
  trackingQuality: number;
  luminance: number;
  contrast: number;
  darkPixelRatio: number;
  highlightRatio: number;
  lighting: LightingQuality;
};

export type GuardianIncident = {
  id: string;
  type: GuardianIssue;
  secondary: GuardianIssue[];
  severity: GuardianSeverity;
  startedAt: number;
  qualifiedAt: number;
  direction: GuardianDirection | null;
};

export type AdaptationProposal = {
  protectiveHold: boolean;
  dwellSuppressed: boolean;
  pointerMode: "NORMAL" | "CONSERVATIVE" | "FROZEN";
  lowLightAssist: boolean;
  smoothingDelta: number;
  stabilityDelta: number;
  safetyVerified: boolean;
  reason: string;
};

export type GuardianEvent = {
  id: string;
  timestamp: number;
  agent: GuardianAgent;
  title: string;
  detail: string;
};

export type GuardianSnapshot = {
  phase: GuardianPhase;
  incident: GuardianIncident | null;
  perception: PerceptionReport;
  adaptation: AdaptationProposal;
  headline: string;
  guidance: string;
  direction: GuardianDirection | null;
  recoveryProgress: number;
  speakToken: string | null;
  events: GuardianEvent[];
};

