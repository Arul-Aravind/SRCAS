import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeadCursor } from "@/hooks/useHeadCursor";
import {
  applyAdaptiveSmoothing,
  applyBoundaryConstraints,
  applyTargetAttraction,
  clamp,
  EMPTY_ACQUISITION,
  mapAbsoluteHeadControl,
  resolveTargetAcquisition,
  scoreTargetCandidate,
  type AcquisitionMemory,
  type RectLike,
  type ScoredTarget,
} from "@/lib/controlPipeline";
import { DwellEvidenceEngine } from "@/lib/dwellEngine";
import { toDegrees } from "@/lib/headPose";
import { StabilityEstimator } from "@/lib/stabilityEngine";
import { GuardianEngine, INITIAL_GUARDIAN_SNAPSHOT } from "@/features/guardian/guardianEngine";
import type { GuardianScenario, GuardianSnapshot } from "@/features/guardian/guardianTypes";
import type {
  AccessPreset,
  CalibrationProfile,
  CameraDevice,
  ConfirmationRequest,
  DwellSnapshot,
  DwellTargetMetadata,
  LuminaPreferences,
  NeutralPose,
  Point,
  PoseTelemetry,
  SessionMetrics,
  TrackingMode,
  TrackingStatus,
} from "@/types/luminax";

const PREFERENCES_KEY = "luminax.preferences.v5";
const CALIBRATION_KEY = "luminax.calibration.v3";

export const DEFAULT_PREFERENCES: LuminaPreferences = {
  preset: "balanced",
  sensitivity: 65,
  horizontalSensitivity: 65,
  verticalSensitivity: 62,
  invertHorizontal: true,
  invertVertical: false,
  deadZone: 5,
  smoothing: 78,
  attraction: 58,
  dwellMs: 1400,
  dwellDecay: "decay",
  stabilityRequirement: 74,
  progressVisualization: true,
  confirmConsequential: true,
  mirrorVideo: true,
  cameraDeviceId: "",
  diagnostics: false,
  cameraPreview: true,
  soundFeedback: true,
  speechFeedback: false,
  speechRate: 0.95,
  speechVolume: 0.9,
  speechVoiceURI: "",
  spokenConfirmations: true,
  interfaceScale: 100,
  highContrast: false,
  reducedMotion: false,
  cursorSize: 44,
  presenterMode: false,
  guardianEnabled: true,
  guardianVoice: false,
  guardianReducedMotion: false,
  guardianVolume: 0.75,
  guardianShowAgentActivity: true,
};

const DEFAULT_GUARDIAN_PREFERENCES: Pick<LuminaPreferences,
  "guardianEnabled" | "guardianVoice" | "guardianReducedMotion" | "guardianVolume" | "guardianShowAgentActivity"
> = {
  guardianEnabled: true,
  guardianVoice: false,
  guardianReducedMotion: false,
  guardianVolume: 0.75,
  guardianShowAgentActivity: true,
};

export const PRESETS: Record<AccessPreset, Partial<LuminaPreferences>> = {
  balanced: { sensitivity: 65, smoothing: 78, dwellMs: 1400, deadZone: 5, attraction: 58, stabilityRequirement: 74 },
  precision: { sensitivity: 52, smoothing: 90, dwellMs: 1700, deadZone: 7, attraction: 70, stabilityRequirement: 78 },
  responsive: { sensitivity: 82, smoothing: 58, dwellMs: 1000, deadZone: 3, attraction: 45, stabilityRequirement: 68 },
  tremor: { sensitivity: 56, smoothing: 93, dwellMs: 1900, deadZone: 9, attraction: 72, stabilityRequirement: 82 },
  "low-range": { sensitivity: 92, smoothing: 84, dwellMs: 1500, deadZone: 3, attraction: 64, stabilityRequirement: 76 },
};

const DEFAULT_CALIBRATION: CalibrationProfile = {
  completed: false,
  source: "default",
  neutralPose: { yaw: 0, pitch: 0, roll: 0 },
  leftRange: 24,
  rightRange: 24,
  upRange: 18,
  downRange: 18,
  horizontalRange: 48,
  verticalRange: 36,
  neutralStability: 0,
  neutralSampleCount: 0,
  recommendedSmoothing: 78,
  recommendedDwellMs: 1400,
};

const INITIAL_DWELL: DwellSnapshot = {
  targetId: null,
  targetLabel: null,
  state: "idle",
  progress: 0,
  evidenceMs: 0,
  qualification: 0,
  targetScore: 0,
  stable: false,
  interrupted: false,
  activated: false,
};

const INITIAL_SESSION: SessionMetrics = {
  startedAt: Date.now(),
  selections: 0,
  interruptions: 0,
  falseActivations: 0,
  totalAcquisitionMs: 0,
  averageAcquisitionMs: 0,
  trackingStartedAt: null,
  trackingUptimeMs: 0,
};

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? ({ ...fallback, ...JSON.parse(value) } as T) : fallback;
  } catch {
    return fallback;
  }
};

const readCalibration = () => {
  const stored = readStored<CalibrationProfile>(CALIBRATION_KEY, DEFAULT_CALIBRATION);
  const horizontalHalf = Math.max(4, (stored.horizontalRange || DEFAULT_CALIBRATION.horizontalRange) / 2);
  const verticalHalf = Math.max(4, (stored.verticalRange || DEFAULT_CALIBRATION.verticalRange) / 2);
  return {
    ...DEFAULT_CALIBRATION,
    ...stored,
    neutralPose: { ...DEFAULT_CALIBRATION.neutralPose, ...(stored.neutralPose ?? {}) },
    leftRange: stored.leftRange || horizontalHalf,
    rightRange: stored.rightRange || horizontalHalf,
    upRange: stored.upRange || verticalHalf,
    downRange: stored.downRange || verticalHalf,
  };
};

const getDemoRestPoint = (): Point => ({
  x: typeof window === "undefined" ? 640 : window.innerWidth * 0.56,
  y: typeof window === "undefined" ? 180 : Math.max(96, Math.min(window.innerHeight - 24, window.innerHeight * 0.24)),
});

type TargetEntry = {
  element: HTMLElement;
  metadata: DwellTargetMetadata;
  rect: RectLike;
};

type TrackingSample = {
  pose: NeutralPose;
  trackingQuality: number;
  stability: number;
  source: "camera" | "simulated";
  timestamp: number;
};

type LuminaContextValue = {
  preferences: LuminaPreferences;
  updatePreferences: (patch: Partial<LuminaPreferences>) => void;
  applyPreset: (preset: AccessPreset) => void;
  resetPreferences: () => void;
  resetGuardianPreferences: () => void;
  calibration: CalibrationProfile;
  saveCalibration: (profile: Partial<CalibrationProfile>) => void;
  resetCalibration: () => void;
  mode: TrackingMode;
  status: TrackingStatus;
  cameraActive: boolean;
  cameraError: string | null;
  cameraDevices: CameraDevice[];
  enableCamera: () => Promise<boolean>;
  restartCamera: () => Promise<boolean>;
  refreshCameraDevices: () => Promise<void>;
  enableDemo: () => void;
  recenterDemoInput: () => void;
  stopCamera: () => void;
  paused: boolean;
  togglePaused: () => void;
  cursor: Point;
  telemetry: PoseTelemetry;
  dwell: DwellSnapshot;
  session: SessionMetrics;
  confirmation: ConfirmationRequest | null;
  requestConfirmation: (request: ConfirmationRequest) => void;
  cancelConfirmation: () => void;
  confirmAction: () => void;
  cancelDwell: () => void;
  speak: (text: string, force?: boolean) => void;
  registerTarget: (element: HTMLElement, metadata: DwellTargetMetadata) => () => void;
  getTrackingSample: () => TrackingSample;
  videoRef: React.RefObject<HTMLVideoElement>;
  guardian: GuardianSnapshot;
  guardianScenario: GuardianScenario;
  setGuardianScenario: (scenario: GuardianScenario) => void;
};

const LuminaContext = createContext<LuminaContextValue | null>(null);

export function LuminaProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const targetRegistryRef = useRef(new Map<string, TargetEntry>());
  const acquisitionRef = useRef<AcquisitionMemory>({ ...EMPTY_ACQUISITION });
  const stabilityEstimatorRef = useRef(new StabilityEstimator());
  const dwellEngineRef = useRef(new DwellEvidenceEngine());
  const demoPointerRef = useRef<Point>(getDemoRestPoint());
  const liveCursorRef = useRef<Point>(demoPointerRef.current);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const lastFrameRef = useRef(performance.now());
  const lastGeometryRefreshRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const lastSessionUpdateRef = useRef(0);
  const demoArmedRef = useRef(true);
  const trackingVisibleRef = useRef(false);
  const everTrackedRef = useRef(false);
  const reacquireStartedRef = useRef(0);
  const reacquireUntilRef = useRef(0);
  const lastInteractionStateRef = useRef(INITIAL_DWELL.state);
  const trackingUptimeRef = useRef(0);
  const guardianEngineRef = useRef(new GuardianEngine());
  const guardianRef = useRef(INITIAL_GUARDIAN_SNAPSHOT);
  const guardianScenarioRef = useRef<GuardianScenario>("HEALTHY");
  const lastGuardianUiUpdateRef = useRef(0);
  const lastGuardianSpeechRef = useRef<string | null>(null);

  const [preferences, setPreferences] = useState<LuminaPreferences>(() => readStored(PREFERENCES_KEY, DEFAULT_PREFERENCES));
  const [calibration, setCalibration] = useState<CalibrationProfile>(readCalibration);
  const [mode, setMode] = useState<TrackingMode>("demo");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<CameraDevice[]>([]);
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState<Point>(demoPointerRef.current);
  const [status, setStatus] = useState<TrackingStatus>("demo");
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [dwell, setDwell] = useState<DwellSnapshot>(INITIAL_DWELL);
  const [telemetry, setTelemetry] = useState<PoseTelemetry>({
    yaw: 0,
    pitch: 0,
    roll: 0,
    raw: demoPointerRef.current,
    filtered: demoPointerRef.current,
    velocity: 0,
    confidence: 0.97,
    stability: 0,
    qualification: 0,
    targetScore: 0,
    fps: 60,
    cameraResolution: null,
    source: "simulated",
  });
  const [session, setSession] = useState<SessionMetrics>(INITIAL_SESSION);
  const [guardian, setGuardian] = useState<GuardianSnapshot>(INITIAL_GUARDIAN_SNAPSHOT);
  const [guardianScenario, setGuardianScenarioState] = useState<GuardianScenario>("HEALTHY");

  const preferencesRef = useRef(preferences);
  const calibrationRef = useRef(calibration);
  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const confirmationRef = useRef(confirmation);
  const telemetryRef = useRef(telemetry);
  const statusRef = useRef(status);

  const head = useHeadCursor(videoRef, cameraActive);
  const headRef = useRef(head);

  useEffect(() => { preferencesRef.current = preferences; }, [preferences]);
  useEffect(() => { calibrationRef.current = calibration; }, [calibration]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { confirmationRef.current = confirmation; }, [confirmation]);
  useEffect(() => { headRef.current = head; }, [head]);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // Session defaults remain available when storage is blocked.
    }
  }, [preferences]);

  useEffect(() => {
    document.documentElement.dataset.contrast = preferences.highContrast ? "high" : "standard";
    document.documentElement.dataset.reducedMotion = preferences.reducedMotion ? "true" : "false";
    document.documentElement.style.setProperty("--ui-scale", String(preferences.interfaceScale / 100));
  }, [preferences.highContrast, preferences.interfaceScale, preferences.reducedMotion]);

  const updateStatus = useCallback((next: TrackingStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  const updatePreferences = useCallback((patch: Partial<LuminaPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch }));
  }, []);

  const applyPreset = useCallback((preset: AccessPreset) => {
    setPreferences((current) => ({ ...current, ...PRESETS[preset], preset }));
  }, []);

  const resetPreferences = useCallback(() => setPreferences(DEFAULT_PREFERENCES), []);
  const resetGuardianPreferences = useCallback(() => {
    setPreferences((current) => ({ ...current, ...DEFAULT_GUARDIAN_PREFERENCES }));
  }, []);

  const setGuardianScenario = useCallback((scenario: GuardianScenario) => {
    guardianScenarioRef.current = scenario;
    setGuardianScenarioState(scenario);
  }, []);

  const saveCalibration = useCallback((patch: Partial<CalibrationProfile>) => {
    setCalibration((current) => {
      const next = {
        ...current,
        ...patch,
        neutralPose: { ...current.neutralPose, ...(patch.neutralPose ?? {}) },
        completed: true,
        completedAt: new Date().toISOString(),
      };
      next.horizontalRange = next.leftRange + next.rightRange;
      next.verticalRange = next.upRange + next.downRange;
      try {
        localStorage.setItem(CALIBRATION_KEY, JSON.stringify(next));
      } catch {
        // Calibration remains active for this session.
      }
      return next;
    });
  }, []);

  const resetCalibration = useCallback(() => {
    setCalibration(DEFAULT_CALIBRATION);
    try {
      localStorage.removeItem(CALIBRATION_KEY);
    } catch {
      // Ignore storage restrictions.
    }
  }, []);

  const refreshCameraDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameraDevices(devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` })));
    } catch {
      setCameraDevices([]);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    trackingVisibleRef.current = false;
    updateStatus("camera-off");
  }, [updateStatus]);

  const enableCamera = useCallback(async () => {
    setCameraError(null);
    updateStatus("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const unavailable = new Error("No camera was detected.");
        unavailable.name = "NotFoundError";
        throw unavailable;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      updateStatus("starting-camera");
      const selectedDevice = preferencesRef.current.cameraDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(selectedDevice ? { deviceId: { exact: selectedDevice } } : { facingMode: "user" }),
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("camera");
      setCameraActive(true);
      updateStatus("initializing-model");
      await refreshCameraDevices();
      return true;
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      const nextStatus: TrackingStatus = name === "NotAllowedError" || name === "SecurityError"
        ? "permission-denied"
        : name === "NotFoundError" || name === "OverconstrainedError"
          ? "no-camera"
          : "error";
      const message = nextStatus === "permission-denied"
        ? "Camera access was not granted."
        : nextStatus === "no-camera"
          ? "No camera was detected."
          : "The camera could not start. Demo Mode remains available.";
      setCameraError(message);
      setCameraActive(false);
      updateStatus(nextStatus);
      return false;
    }
  }, [refreshCameraDevices, updateStatus]);

  const restartCamera = useCallback(async () => {
    stopCamera();
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    return enableCamera();
  }, [enableCamera, stopCamera]);

  const enableDemo = useCallback(() => {
    stopCamera();
    const restPoint = getDemoRestPoint();
    demoPointerRef.current = restPoint;
    liveCursorRef.current = restPoint;
    demoArmedRef.current = true;
    document.documentElement.style.setProperty("--lumina-cursor-x", `${restPoint.x}px`);
    document.documentElement.style.setProperty("--lumina-cursor-y", `${restPoint.y}px`);
    setMode("demo");
    setCameraError(null);
    updateStatus(pausedRef.current ? "paused" : "demo");
  }, [stopCamera, updateStatus]);

  const recenterDemoInput = useCallback(() => {
    const center = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.5 };
    demoPointerRef.current = center;
    liveCursorRef.current = center;
    demoArmedRef.current = true;
    document.documentElement.style.setProperty("--lumina-cursor-x", `${center.x}px`);
    document.documentElement.style.setProperty("--lumina-cursor-y", `${center.y}px`);
  }, []);

  const togglePaused = useCallback(() => setPaused((current) => !current), []);

  const speak = useCallback((text: string, force = false) => {
    const current = preferencesRef.current;
    if (!force && !current.speechFeedback) return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = current.speechRate;
    utterance.volume = current.speechVolume;
    if (current.speechVoiceURI) {
      utterance.voice = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === current.speechVoiceURI) ?? null;
    }
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    if (!preferences.guardianVoice || !guardian.speakToken || guardian.speakToken === lastGuardianSpeechRef.current) return;
    if (!("speechSynthesis" in window)) return;
    lastGuardianSpeechRef.current = guardian.speakToken;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${guardian.headline}. ${guardian.guidance}`);
    utterance.rate = 0.92;
    utterance.volume = preferences.guardianVolume;
    window.speechSynthesis.speak(utterance);
  }, [guardian.guidance, guardian.headline, guardian.speakToken, preferences.guardianVoice, preferences.guardianVolume]);

  const cancelDwell = useCallback(() => {
    dwellEngineRef.current.cancel();
    acquisitionRef.current = { ...EMPTY_ACQUISITION };
    activeTargetRef.current?.removeAttribute("data-luminax-acquired");
    activeTargetRef.current = null;
    setDwell({ ...INITIAL_DWELL, state: "cancelled" });
  }, []);

  const requestConfirmation = useCallback((request: ConfirmationRequest) => {
    setConfirmation(request);
    cancelDwell();
  }, [cancelDwell]);

  const cancelConfirmation = useCallback(() => {
    setConfirmation(null);
    cancelDwell();
    if (preferencesRef.current.spokenConfirmations) speak("Selection cancelled");
  }, [cancelDwell, speak]);

  const confirmAction = useCallback(() => {
    const request = confirmationRef.current;
    setConfirmation(null);
    cancelDwell();
    request?.onConfirm();
    if (preferencesRef.current.spokenConfirmations) speak("Action confirmed");
  }, [cancelDwell, speak]);

  const registerTarget = useCallback((element: HTMLElement, metadata: DwellTargetMetadata) => {
    const rect = element.getBoundingClientRect();
    targetRegistryRef.current.set(metadata.id, { element, metadata, rect });
    return () => {
      const current = targetRegistryRef.current.get(metadata.id);
      if (current?.element === element) targetRegistryRef.current.delete(metadata.id);
    };
  }, []);

  const getTrackingSample = useCallback((): TrackingSample => {
    const current = telemetryRef.current;
    return {
      pose: { yaw: current.yaw, pitch: current.pitch, roll: current.roll },
      trackingQuality: current.confidence,
      stability: current.stability,
      source: current.source,
      timestamp: performance.now(),
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (modeRef.current !== "demo") return;
      const previous = demoPointerRef.current;
      demoPointerRef.current = { x: event.clientX, y: event.clientY };
      if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 2) demoArmedRef.current = true;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const key = event.key.toLowerCase();
      if (event.code === "Space") {
        event.preventDefault();
        togglePaused();
      } else if (key === "d") {
        updatePreferences({ diagnostics: !preferencesRef.current.diagnostics });
      } else if (key === "p") {
        updatePreferences({ presenterMode: !preferencesRef.current.presenterMode });
      } else if (key === "h") {
        navigate("/hub");
      } else if (key === "c") {
        navigate("/access");
      } else if (event.key === "Escape") {
        if (confirmationRef.current) cancelConfirmation();
        else cancelDwell();
      } else if (modeRef.current === "demo" && event.altKey && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 84 : 34;
        const current = demoPointerRef.current;
        demoPointerRef.current = applyBoundaryConstraints({
          x: current.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
          y: current.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
        }, window.innerWidth, window.innerHeight, 18);
        demoArmedRef.current = true;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelConfirmation, cancelDwell, navigate, togglePaused, updatePreferences]);

  useEffect(() => {
    if (head.modelStatus === "error" && head.error) {
      setCameraError("Head tracking could not initialize. Continue in Demo Mode or try the camera again.");
      updateStatus("error");
    }
  }, [head.error, head.modelStatus, updateStatus]);

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const delta = clamp(now - lastFrameRef.current, 8, 80);
      lastFrameRef.current = now;
      const currentPreferences = preferencesRef.current;
      const currentCalibration = calibrationRef.current;
      const currentMode = modeRef.current;
      const isPaused = pausedRef.current;
      const cursorPadding = Math.max(24, currentPreferences.cursorSize / 2 + 2);
      const headSnapshot = headRef.current.getSnapshot();
      let nextStatus: TrackingStatus = currentMode === "demo" ? "demo" : "searching";
      const trackingQuality = currentMode === "demo" ? 0.97 : headSnapshot.trackingQuality;
      let majorInvalidation = false;
      let interactionAvailable = currentMode === "demo" ? demoArmedRef.current : false;
      let rawControl = liveCursorRef.current;
      let poseDegrees: NeutralPose;

      if (currentMode === "demo") {
        rawControl = applyBoundaryConstraints(demoPointerRef.current, window.innerWidth, window.innerHeight, cursorPadding);
        poseDegrees = {
          yaw: (rawControl.x / window.innerWidth - 0.5) * 24,
          pitch: (rawControl.y / window.innerHeight - 0.5) * 16,
          roll: 0,
        };
        nextStatus = isPaused ? "paused" : "demo";
      } else {
        const pose = headSnapshot.pose;
        poseDegrees = pose
          ? { yaw: toDegrees(pose.yaw), pitch: toDegrees(pose.pitch), roll: toDegrees(pose.roll) }
          : telemetryRef.current;
        if (headSnapshot.modelStatus === "initializing") {
          nextStatus = "initializing-model";
          majorInvalidation = true;
        } else if (headSnapshot.modelStatus === "error") {
          nextStatus = "error";
          majorInvalidation = true;
        } else if (!headSnapshot.isTracking || !pose) {
          nextStatus = everTrackedRef.current ? "face-lost" : "searching";
          majorInvalidation = true;
          trackingVisibleRef.current = false;
        } else if (trackingQuality < 0.5) {
          nextStatus = "low-confidence";
          majorInvalidation = true;
          trackingVisibleRef.current = false;
        } else {
          if (!trackingVisibleRef.current) {
            trackingVisibleRef.current = true;
            everTrackedRef.current = true;
            reacquireStartedRef.current = now;
            reacquireUntilRef.current = now + 680;
            stabilityEstimatorRef.current.reset();
            dwellEngineRef.current.cancel();
          }

          const cameraCalibration = currentCalibration.source === "camera"
            ? currentCalibration
            : DEFAULT_CALIBRATION;
          const mapped = mapAbsoluteHeadControl({
            pose: poseDegrees,
            neutral: cameraCalibration.neutralPose,
            leftRange: cameraCalibration.leftRange,
            rightRange: cameraCalibration.rightRange,
            upRange: cameraCalibration.upRange,
            downRange: cameraCalibration.downRange,
            width: window.innerWidth,
            height: window.innerHeight,
            sensitivity: currentPreferences.sensitivity,
            horizontalSensitivity: currentPreferences.horizontalSensitivity,
            verticalSensitivity: currentPreferences.verticalSensitivity,
            deadZone: currentPreferences.deadZone / 100,
            invertX: currentPreferences.invertHorizontal,
            invertY: currentPreferences.invertVertical,
            padding: cursorPadding,
          });

          if (now < reacquireUntilRef.current) {
            const progress = clamp((now - reacquireStartedRef.current) / 680, 0, 1);
            rawControl = progress < 0.24
              ? liveCursorRef.current
              : {
                  x: liveCursorRef.current.x + (mapped.x - liveCursorRef.current.x) * Math.pow(progress, 2) * 0.22,
                  y: liveCursorRef.current.y + (mapped.y - liveCursorRef.current.y) * Math.pow(progress, 2) * 0.22,
                };
            nextStatus = "reacquiring";
            majorInvalidation = true;
          } else {
            rawControl = mapped;
            nextStatus = isPaused ? "paused" : "active";
            interactionAvailable = true;
          }
        }
      }

      const guardianSnapshot = guardianEngineRef.current.step({
        now,
        paused: isPaused,
        poseStability: telemetryRef.current.stability / 100,
        perception: {
          mode: currentMode,
          status: nextStatus,
          modelStatus: headSnapshot.modelStatus,
          faceVisible: currentMode === "demo" || headSnapshot.isTracking,
          faceBounds: headSnapshot.faceBounds,
          faceCompleteness: currentMode === "demo" ? 1 : headSnapshot.faceCompleteness,
          trackingQuality,
          luminance: headSnapshot.luminance,
          contrast: headSnapshot.contrast,
          darkPixelRatio: headSnapshot.darkPixelRatio,
          highlightRatio: headSnapshot.highlightRatio,
          cameraAvailable: currentMode === "demo" || Boolean(streamRef.current?.active),
          scenario: guardianScenarioRef.current,
        },
      });
      guardianRef.current = guardianSnapshot;
      const guardianActive = currentPreferences.guardianEnabled && !isPaused;
      const guardianAdaptation = guardianSnapshot.adaptation;
      if (guardianActive && guardianAdaptation.pointerMode === "FROZEN") {
        rawControl = liveCursorRef.current;
        interactionAvailable = false;
        majorInvalidation = true;
      } else if (guardianActive && guardianAdaptation.pointerMode === "CONSERVATIVE") {
        rawControl = {
          x: liveCursorRef.current.x + (rawControl.x - liveCursorRef.current.x) * 0.58,
          y: liveCursorRef.current.y + (rawControl.y - liveCursorRef.current.y) * 0.58,
        };
      }
      if (guardianActive && guardianAdaptation.dwellSuppressed) {
        interactionAvailable = false;
        majorInvalidation = true;
      }

      if (now - lastGeometryRefreshRef.current > 110) {
        lastGeometryRefreshRef.current = now;
        targetRegistryRef.current.forEach((entry, id) => {
          if (!entry.element.isConnected) targetRegistryRef.current.delete(id);
          else entry.rect = entry.element.getBoundingClientRect();
        });
      }

      const eligibleEntries = [...targetRegistryRef.current.values()].filter((entry) => {
        if (confirmationRef.current) return entry.metadata.id.startsWith("confirmation-");
        if (isPaused) return entry.metadata.allowWhenPaused;
        return !entry.metadata.disabled && !entry.element.hasAttribute("disabled");
      });
      const scoredTargets = eligibleEntries.map((entry) => scoreTargetCandidate(rawControl, {
        id: entry.metadata.id,
        rect: entry.rect,
        priority: entry.metadata.priority,
        attractionStrength: entry.metadata.attractionStrength,
        disabled: entry.metadata.disabled || entry.element.hasAttribute("disabled"),
      }));

      if (majorInvalidation) acquisitionRef.current = { ...EMPTY_ACQUISITION };
      const acquisition = resolveTargetAcquisition({ memory: acquisitionRef.current, candidates: scoredTargets, now });
      acquisitionRef.current = acquisition.memory;
      const targetEntry = acquisition.target ? targetRegistryRef.current.get(acquisition.target.id) ?? null : null;
      const attracted = applyBoundaryConstraints(applyTargetAttraction(
        rawControl,
        acquisition.target?.center ?? null,
        targetEntry ? currentPreferences.attraction / 100 * targetEntry.metadata.attractionStrength : 0,
      ), window.innerWidth, window.innerHeight, cursorPadding);
      const filtered = applyAdaptiveSmoothing(
        liveCursorRef.current,
        attracted,
        currentMode === "camera"
          ? clamp(currentPreferences.smoothing / 100 + (guardianActive ? guardianAdaptation.smoothingDelta : 0), 0.1, 0.98)
          : 0.22,
        Boolean(acquisition.target),
      );
      const previous = liveCursorRef.current;
      const velocityX = (filtered.x - previous.x) / (delta / 1000);
      const velocityY = (filtered.y - previous.y) / (delta / 1000);
      const velocity = Math.hypot(velocityX, velocityY);
      liveCursorRef.current = filtered;
      document.documentElement.style.setProperty("--lumina-cursor-x", `${filtered.x}px`);
      document.documentElement.style.setProperty("--lumina-cursor-y", `${filtered.y}px`);

      const stability = stabilityEstimatorRef.current.step({
        timestamp: now,
        velocity,
        velocityX,
        velocityY,
        trackingQuality: currentMode === "demo" ? 0.97 : majorInvalidation ? 0 : trackingQuality,
      });
      const requiredStability = clamp(
        currentPreferences.stabilityRequirement / 100 + (guardianActive ? guardianAdaptation.stabilityDelta : 0),
        0.4,
        0.96,
      );
      const targetScore = acquisition.target?.score ?? 0;
      const targetQuality = clamp((targetScore - 0.04) / 0.82, 0, 1);
      const allowWhilePaused = Boolean(targetEntry?.metadata.allowWhenPaused);
      const systemAvailability = interactionAvailable && (!isPaused || allowWhilePaused) ? 1 : 0;
      const dwellSnapshot = dwellEngineRef.current.step({
        now,
        targetId: targetEntry?.metadata.id ?? null,
        targetLabel: targetEntry?.metadata.label ?? null,
        acquiredAt: acquisition.memory.acquiredAt,
        durationMs: targetEntry?.metadata.durationMs ?? currentPreferences.dwellMs,
        trackingQuality,
        stabilityQuality: clamp(stability.score / Math.max(0.4, requiredStability), 0, 1),
        targetQuality,
        systemAvailability,
        stableSignal: stability.stable && stability.score >= requiredStability,
        decay: currentPreferences.dwellDecay,
        majorInvalidation: majorInvalidation || Boolean(targetEntry?.metadata.disabled),
        confirmationStage: Boolean(confirmationRef.current),
      });

      if (dwellSnapshot.state === "interrupted" && lastInteractionStateRef.current !== "interrupted") {
        setSession((current) => ({ ...current, interruptions: current.interruptions + 1 }));
      }
      lastInteractionStateRef.current = dwellSnapshot.state;

      if (
        dwellSnapshot.activated
        && (!guardianActive || (!guardianAdaptation.dwellSuppressed && !guardianAdaptation.protectiveHold))
        && targetEntry
        && targetEntry.element.isConnected
        && !targetEntry.element.hasAttribute("disabled")
      ) {
        const acquisitionMs = Math.max(0, now - acquisition.memory.acquiredAt);
        targetEntry.element.click();
        setSession((current) => {
          const selections = current.selections + 1;
          const totalAcquisitionMs = current.totalAcquisitionMs + acquisitionMs;
          return { ...current, selections, totalAcquisitionMs, averageAcquisitionMs: totalAcquisitionMs / selections };
        });
        speak(targetEntry.metadata.label ? `${targetEntry.metadata.label} selected` : "Selected");
      }

      activeTargetRef.current?.removeAttribute("data-luminax-acquired");
      activeTargetRef.current?.style.removeProperty("--luminax-dwell-progress");
      if (targetEntry) {
        targetEntry.element.setAttribute("data-luminax-acquired", dwellSnapshot.state);
        targetEntry.element.style.setProperty("--luminax-dwell-progress", String(dwellSnapshot.progress));
      }
      activeTargetRef.current = targetEntry?.element ?? null;

      if (currentMode === "camera" && nextStatus === "active") trackingUptimeRef.current += delta;
      updateStatus(nextStatus);

      if (now - lastUiUpdateRef.current > 90) {
        lastUiUpdateRef.current = now;
        const nextTelemetry: PoseTelemetry = {
          yaw: poseDegrees.yaw,
          pitch: poseDegrees.pitch,
          roll: poseDegrees.roll,
          raw: rawControl,
          filtered,
          velocity,
          confidence: trackingQuality,
          stability: Math.round(stability.score * 100),
          qualification: dwellSnapshot.qualification,
          targetScore,
          fps: currentMode === "camera" ? headSnapshot.fps : 60,
          cameraResolution: headSnapshot.cameraResolution,
          source: currentMode === "camera" ? "camera" : "simulated",
        };
        telemetryRef.current = nextTelemetry;
        setCursor(filtered);
        setTelemetry(nextTelemetry);
        setDwell({ ...dwellSnapshot, targetScore });
      }
      if (now - lastGuardianUiUpdateRef.current > 110) {
        lastGuardianUiUpdateRef.current = now;
        setGuardian(guardianSnapshot);
      }

      if (now - lastSessionUpdateRef.current > 1000) {
        lastSessionUpdateRef.current = now;
        setSession((current) => ({
          ...current,
          trackingStartedAt: current.trackingStartedAt ?? (everTrackedRef.current ? Date.now() : null),
          trackingUptimeMs: trackingUptimeRef.current,
        }));
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [speak, updateStatus]);

  useEffect(() => {
    cancelDwell();
    if (modeRef.current === "demo") {
      const restPoint = getDemoRestPoint();
      demoPointerRef.current = restPoint;
      liveCursorRef.current = restPoint;
      demoArmedRef.current = true;
      document.documentElement.style.setProperty("--lumina-cursor-x", `${restPoint.x}px`);
      document.documentElement.style.setProperty("--lumina-cursor-y", `${restPoint.y}px`);
    }
  }, [cancelDwell, location.pathname]);

  useEffect(() => {
    if (paused) updateStatus("paused");
    else if (mode === "demo") updateStatus("demo");
  }, [mode, paused, updateStatus]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const value = useMemo<LuminaContextValue>(() => ({
    preferences,
    updatePreferences,
    applyPreset,
    resetPreferences,
    resetGuardianPreferences,
    calibration,
    saveCalibration,
    resetCalibration,
    mode,
    status,
    cameraActive,
    cameraError,
    cameraDevices,
    enableCamera,
    restartCamera,
    refreshCameraDevices,
    enableDemo,
    recenterDemoInput,
    stopCamera,
    paused,
    togglePaused,
    cursor,
    telemetry,
    dwell,
    session,
    confirmation,
    requestConfirmation,
    cancelConfirmation,
    confirmAction,
    cancelDwell,
    speak,
    registerTarget,
    getTrackingSample,
    videoRef,
    guardian,
    guardianScenario,
    setGuardianScenario,
  }), [applyPreset, calibration, cameraActive, cameraDevices, cameraError, cancelConfirmation, cancelDwell, confirmAction, confirmation, cursor, dwell, enableCamera, enableDemo, getTrackingSample, guardian, guardianScenario, mode, paused, preferences, recenterDemoInput, refreshCameraDevices, registerTarget, requestConfirmation, resetCalibration, resetGuardianPreferences, resetPreferences, restartCamera, saveCalibration, session, setGuardianScenario, speak, status, stopCamera, telemetry, togglePaused, updatePreferences]);

  return (
    <LuminaContext.Provider value={value}>
      {children}
      <video ref={videoRef} className="pointer-events-none fixed h-px w-px opacity-0" muted playsInline aria-hidden="true" />
    </LuminaContext.Provider>
  );
}

export function useLumina() {
  const context = useContext(LuminaContext);
  if (!context) throw new Error("useLumina must be used inside LuminaProvider");
  return context;
}
