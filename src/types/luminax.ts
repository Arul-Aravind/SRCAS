export type AccessPreset = "balanced" | "precision" | "responsive" | "tremor" | "low-range";

export type DwellDecay = "pause" | "decay" | "reset";

export type TrackingMode = "camera" | "demo";

export type TrackingStatus =
  | "idle"
  | "initializing-model"
  | "requesting"
  | "starting-camera"
  | "searching"
  | "active"
  | "low-confidence"
  | "reacquiring"
  | "paused"
  | "face-lost"
  | "camera-off"
  | "permission-denied"
  | "no-camera"
  | "demo"
  | "error";

export type InteractionState =
  | "idle"
  | "candidate"
  | "acquired"
  | "stabilizing"
  | "dwelling"
  | "interrupted"
  | "ready"
  | "confirming"
  | "activated"
  | "cancelled";

export type Point = { x: number; y: number };

export type PoseTelemetry = {
  yaw: number;
  pitch: number;
  roll: number;
  raw: Point;
  filtered: Point;
  velocity: number;
  confidence: number;
  stability: number;
  qualification: number;
  targetScore: number;
  fps: number;
  cameraResolution: { width: number; height: number } | null;
  source: "camera" | "simulated";
};

export type NeutralPose = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type CalibrationProfile = {
  completed: boolean;
  completedAt?: string;
  source: "camera" | "demo" | "default";
  neutralPose: NeutralPose;
  leftRange: number;
  rightRange: number;
  upRange: number;
  downRange: number;
  horizontalRange: number;
  verticalRange: number;
  neutralStability: number;
  neutralSampleCount: number;
  recommendedSmoothing: number;
  recommendedDwellMs: number;
};

export type LuminaPreferences = {
  preset: AccessPreset;
  sensitivity: number;
  horizontalSensitivity: number;
  verticalSensitivity: number;
  invertHorizontal: boolean;
  invertVertical: boolean;
  deadZone: number;
  smoothing: number;
  attraction: number;
  dwellMs: number;
  dwellDecay: DwellDecay;
  stabilityRequirement: number;
  progressVisualization: boolean;
  confirmConsequential: boolean;
  mirrorVideo: boolean;
  cameraDeviceId: string;
  diagnostics: boolean;
  cameraPreview: boolean;
  soundFeedback: boolean;
  speechFeedback: boolean;
  speechRate: number;
  speechVolume: number;
  speechVoiceURI: string;
  spokenConfirmations: boolean;
  interfaceScale: number;
  highContrast: boolean;
  reducedMotion: boolean;
  cursorSize: number;
  presenterMode: boolean;
  guardianEnabled: boolean;
  guardianVoice: boolean;
  guardianReducedMotion: boolean;
  guardianVolume: number;
  guardianShowAgentActivity: boolean;
};

export type DwellSnapshot = {
  targetId: string | null;
  targetLabel: string | null;
  state: InteractionState;
  progress: number;
  evidenceMs: number;
  qualification: number;
  targetScore: number;
  stable: boolean;
  interrupted: boolean;
  activated: boolean;
};

export type DwellTargetMetadata = {
  id: string;
  label: string;
  durationMs: number;
  requiresConfirmation: boolean;
  disabled: boolean;
  priority: number;
  attractionStrength: number;
  allowWhenPaused: boolean;
};

export type CameraDevice = {
  deviceId: string;
  label: string;
};

export type SessionMetrics = {
  startedAt: number;
  selections: number;
  interruptions: number;
  falseActivations: number;
  totalAcquisitionMs: number;
  averageAcquisitionMs: number;
  trackingStartedAt: number | null;
  trackingUptimeMs: number;
};

export type ConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
};
