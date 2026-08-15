import { ADAPTIVE_CONFIG, HARD_SAFETY_CONFIG, INCIDENT_PRIORITY } from "./guardianConfig";
import { runAdaptationAgent } from "./adaptationAgent";
import { runPerceptionAgent } from "./perceptionAgent";
import type {
  GuardianDirection,
  GuardianEvent,
  GuardianIncident,
  GuardianIssue,
  GuardianPerceptionInput,
  GuardianPhase,
  GuardianSeverity,
  GuardianSnapshot,
  PerceptionReport,
} from "./guardianTypes";

type Candidate = { type: GuardianIssue; severity: GuardianSeverity; direction: GuardianDirection | null };

const EMPTY_PERCEPTION: PerceptionReport = {
  timestamp: 0,
  source: "DEMO",
  scenario: "HEALTHY",
  cameraAvailable: true,
  faceVisible: true,
  faceBounds: null,
  faceCompleteness: 1,
  faceCentered: true,
  partialDirection: null,
  trackingQuality: 0.97,
  luminance: 0.56,
  contrast: 0.34,
  darkPixelRatio: 0.12,
  highlightRatio: 0.04,
  lighting: "GOOD",
};

const SAFE_ADAPTATION = runAdaptationAgent(EMPTY_PERCEPTION, null, 1);

export const INITIAL_GUARDIAN_SNAPSHOT: GuardianSnapshot = {
  phase: "MONITORING",
  incident: null,
  perception: EMPTY_PERCEPTION,
  adaptation: SAFE_ADAPTATION,
  headline: "Guardian ready",
  guidance: "Monitoring camera framing, light, and interaction safety.",
  direction: null,
  recoveryProgress: 0,
  speakToken: null,
  events: [],
};

function issueFromDirection(direction: GuardianDirection): GuardianIssue {
  if (direction === "RIGHT") return "PARTIAL_LEFT";
  if (direction === "LEFT") return "PARTIAL_RIGHT";
  if (direction === "DOWN") return "PARTIAL_TOP";
  return "PARTIAL_BOTTOM";
}

export function resolveCandidates(perception: PerceptionReport): Candidate[] {
  const candidates: Candidate[] = [];
  if (!perception.cameraAvailable) candidates.push({ type: "CAMERA_UNAVAILABLE", severity: "CRITICAL", direction: null });
  if (perception.scenario === "PROTECTIVE_HOLD") candidates.push({ type: "PROTECTIVE_HOLD", severity: "CRITICAL", direction: "STILL" });
  if (perception.cameraAvailable && !perception.faceVisible) candidates.push({ type: "NO_FACE", severity: "CRITICAL", direction: "CENTER" });
  if (perception.lighting === "SEVERE") candidates.push({ type: "SEVERE_LOW_LIGHT", severity: "CRITICAL", direction: null });
  if (perception.faceVisible && perception.partialDirection) {
    candidates.push({ type: issueFromDirection(perception.partialDirection), severity: "CAUTION", direction: perception.partialDirection });
  }
  if (perception.lighting === "POOR") candidates.push({ type: "LOW_LIGHT", severity: "CAUTION", direction: null });
  if (perception.faceVisible && perception.trackingQuality < ADAPTIVE_CONFIG.lowConfidence) {
    candidates.push({ type: "LOW_CONFIDENCE", severity: "CAUTION", direction: "STILL" });
  }
  return candidates.sort((a, b) => INCIDENT_PRIORITY[b.type] - INCIDENT_PRIORITY[a.type]);
}

function qualificationMs(candidate: Candidate): number {
  if (candidate.type === "CAMERA_UNAVAILABLE" || candidate.type === "PROTECTIVE_HOLD") {
    return HARD_SAFETY_CONFIG.cameraUnavailableQualificationMs;
  }
  if (candidate.type === "NO_FACE") return HARD_SAFETY_CONFIG.faceLostQualificationMs;
  if (candidate.type === "SEVERE_LOW_LIGHT") return HARD_SAFETY_CONFIG.criticalLightQualificationMs;
  return ADAPTIVE_CONFIG.cautionQualificationMs;
}

function guidanceFor(type: GuardianIssue, phase: GuardianPhase, direction: GuardianDirection | null) {
  if (phase === "SAFE_PAUSED") return { headline: "Safe Pause is on", guidance: "Interaction is paused. Guardian monitoring continues." };
  if (phase === "RECOVERING") return { headline: "Checking the signal", guidance: "Hold comfortably still while all safety checks clear." };
  if (phase === "SUCCESS") return { headline: "You are ready", guidance: "Tracking and dwell activation are safely restored." };
  switch (type) {
    case "CAMERA_UNAVAILABLE": return { headline: "Camera signal unavailable", guidance: "Reconnect or enable the camera to continue safely." };
    case "NO_FACE": return { headline: "Come back into view", guidance: "Center your face in the camera. Selection is safely on hold." };
    case "PARTIAL_LEFT":
    case "PARTIAL_RIGHT":
    case "PARTIAL_TOP":
    case "PARTIAL_BOTTOM": return { headline: `Move ${direction?.toLowerCase() ?? "toward center"}`, guidance: "A small, comfortable movement will bring your full face into frame." };
    case "SEVERE_LOW_LIGHT": return { headline: "More light is needed", guidance: "Face a light source or brighten the room. Selection is safely on hold." };
    case "LOW_LIGHT": return { headline: "Lighting assist is active", guidance: "A little more light will improve accuracy. Tracking has been softened." };
    case "LOW_CONFIDENCE": return { headline: "Hold comfortably still", guidance: "Guardian is waiting for a steady signal before selection resumes." };
    case "PROTECTIVE_HOLD": return { headline: "Protective hold", guidance: "Selection is blocked while Guardian verifies a safe signal." };
    default: return { headline: "Guardian ready", guidance: "Monitoring camera framing, light, and interaction safety." };
  }
}

export class GuardianEngine {
  private snapshot = INITIAL_GUARDIAN_SNAPSHOT;
  private candidateType: GuardianIssue = "NONE";
  private candidateSince = 0;
  private recoveringSince = 0;
  private successUntil = 0;
  private sequence = 0;

  reset() {
    this.snapshot = INITIAL_GUARDIAN_SNAPSHOT;
    this.candidateType = "NONE";
    this.candidateSince = 0;
    this.recoveringSince = 0;
    this.successUntil = 0;
  }

  step(input: {
    now: number;
    perception: GuardianPerceptionInput;
    poseStability: number;
    paused: boolean;
  }): GuardianSnapshot {
    const perception = runPerceptionAgent(input.perception, input.now);
    const candidates = resolveCandidates(perception);
    const primary = candidates[0] ?? null;
    const previousIncident = this.snapshot.incident;
    let incident = previousIncident;
    let phase = this.snapshot.phase;
    let recoveryProgress = 0;
    let speakToken: string | null = null;
    const newEvents: GuardianEvent[] = [];

    if (input.paused) {
      phase = "SAFE_PAUSED";
      this.recoveringSince = 0;
    } else if (primary) {
      this.recoveringSince = 0;
      this.successUntil = 0;
      const higherPriority = incident && INCIDENT_PRIORITY[primary.type] > INCIDENT_PRIORITY[incident.type];
      if (this.candidateType !== primary.type) {
        this.candidateType = primary.type;
        this.candidateSince = input.now;
      }
      const qualified = input.now - this.candidateSince >= qualificationMs(primary);
      if (qualified || higherPriority) {
        if (!incident || incident.type !== primary.type) {
          incident = {
            id: `guardian-${Math.round(input.now)}-${this.sequence++}`,
            type: primary.type,
            secondary: candidates.slice(1).map((candidate) => candidate.type),
            severity: primary.severity,
            startedAt: this.candidateSince,
            qualifiedAt: input.now,
            direction: primary.direction,
          };
          speakToken = `incident:${incident.id}`;
          newEvents.push(this.event(input.now, "PERCEPTION", "Signal change reported", `${primary.type} exceeded its qualification threshold.`));
          newEvents.push(this.event(input.now, "MASTER", "Root cause qualified", `${incident.type} selected from ${candidates.length} signal${candidates.length === 1 ? "" : "s"}.`));
        } else {
          incident = { ...incident, secondary: candidates.slice(1).map((candidate) => candidate.type), direction: primary.direction };
        }
        phase = primary.severity === "CRITICAL" ? "PROTECTIVE_HOLD" : "GUIDING";
      } else if (!incident) {
        phase = "QUALIFYING";
      }
    } else {
      this.candidateType = "NONE";
      this.candidateSince = 0;
      const provisional = runAdaptationAgent(perception, incident, input.poseStability);
      if (incident) {
        if (provisional.safetyVerified) {
          if (!this.recoveringSince) {
            this.recoveringSince = input.now;
            newEvents.push(this.event(input.now, "PERCEPTION", "Healthy signal reported", "Face, framing, confidence, and light are inside recovery bounds."));
            newEvents.push(this.event(input.now, "MASTER", "Recovery handshake opened", "Perception is healthy; Safety is verifying sustained stability."));
          }
          recoveryProgress = Math.min(1, (input.now - this.recoveringSince) / HARD_SAFETY_CONFIG.recoveryQualificationMs);
          phase = "RECOVERING";
          if (recoveryProgress >= 1 && input.now - incident.qualifiedAt >= HARD_SAFETY_CONFIG.protectiveMinimumMs) {
            newEvents.push(this.event(input.now, "SAFETY", "Safety restored", "Perception and pose stability remained qualified for the full recovery interval."));
            incident = null;
            phase = "SUCCESS";
            this.successUntil = input.now + ADAPTIVE_CONFIG.healthySuccessMs;
            this.recoveringSince = 0;
            speakToken = `success:${Math.round(input.now)}`;
          }
        } else {
          this.recoveringSince = 0;
          phase = incident.severity === "CRITICAL" ? "PROTECTIVE_HOLD" : "GUIDING";
        }
      } else {
        phase = input.now < this.successUntil ? "SUCCESS" : "MONITORING";
      }
    }

    const adaptation = runAdaptationAgent(perception, incident, input.poseStability);
    if (newEvents.length && adaptation.protectiveHold && !this.snapshot.adaptation.protectiveHold) {
      newEvents.push(this.event(input.now, "SAFETY", "Protective hold engaged", adaptation.reason));
    }
    const message = guidanceFor(incident?.type ?? "NONE", phase, incident?.direction ?? null);
    const events = [...newEvents, ...this.snapshot.events].slice(0, 12);
    this.snapshot = {
      phase,
      incident,
      perception,
      adaptation,
      headline: message.headline,
      guidance: message.guidance,
      direction: incident?.direction ?? null,
      recoveryProgress,
      speakToken,
      events,
    };
    return this.snapshot;
  }

  private event(timestamp: number, agent: GuardianEvent["agent"], title: string, detail: string): GuardianEvent {
    return { id: `event-${this.sequence++}-${Math.round(timestamp)}`, timestamp, agent, title, detail };
  }
}
