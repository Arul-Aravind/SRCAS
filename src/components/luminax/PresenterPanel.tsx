import { useState } from "react";
import { Activity, Bot, BrainCircuit, ChevronRight, Play, ScanFace, ShieldCheck, X } from "lucide-react";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "./AssistiveTarget";
import type { GuardianScenario } from "@/features/guardian/guardianTypes";

const SCENARIOS: Array<{ value: GuardianScenario; label: string }> = [
  { value: "HEALTHY", label: "Healthy signal" },
  { value: "NO_FACE", label: "No face" },
  { value: "PARTIAL_LEFT", label: "Partial face: left edge" },
  { value: "PARTIAL_RIGHT", label: "Partial face: right edge" },
  { value: "PARTIAL_TOP", label: "Partial face: top edge" },
  { value: "PARTIAL_BOTTOM", label: "Partial face: bottom edge" },
  { value: "LOW_LIGHT", label: "Low light" },
  { value: "SEVERE_LOW_LIGHT", label: "Severe low light" },
  { value: "LOW_CONFIDENCE", label: "Low confidence" },
  { value: "PROTECTIVE_HOLD", label: "Protective hold" },
  { value: "RECOVERING", label: "Recovery" },
];

export function PresenterPanel() {
  const {
    preferences,
    updatePreferences,
    telemetry,
    dwell,
    mode,
    guardian,
    guardianScenario,
    setGuardianScenario,
  } = useLumina();
  const [selectedScenario, setSelectedScenario] = useState<GuardianScenario>(guardianScenario);
  if (!preferences.presenterMode && !preferences.diagnostics) return null;

  const faceState = !guardian.perception.faceVisible
    ? "NOT VISIBLE"
    : guardian.perception.partialDirection
      ? `PARTIAL · MOVE ${guardian.perception.partialDirection}`
      : "VISIBLE · CENTERED";
  const safetyState = guardian.adaptation.protectiveHold
    ? "HOLD · POINTER FROZEN"
    : guardian.adaptation.dwellSuppressed
      ? "DWELL SUPPRESSED"
      : "ACTIVATION AVAILABLE";

  return (
    <aside className="presenter-panel" aria-label="Guardian presenter mode">
      <header>
        <div>
          <span>GUARDIAN PRESENTER MODE</span>
          <strong><i /> {mode === "demo" ? "DEMO PIPELINE" : "LIVE CAMERA PIPELINE"}</strong>
        </div>
        <AssistiveTarget
          targetId="presenter-close"
          label="Close presenter mode"
          className="presenter-icon-button"
          onClick={() => updatePreferences({ presenterMode: false, diagnostics: false })}
          dwellMs={900}
        >
          <X aria-hidden="true" />
        </AssistiveTarget>
      </header>

      <div className="guardian-agent-graph" aria-label="Three agent decision graph">
        <AgentNode icon={ScanFace} agent="B" label="PERCEPTION" value={faceState} active={guardian.phase !== "MONITORING"} />
        <ChevronRight className="guardian-agent-arrow" aria-hidden="true" />
        <AgentNode icon={BrainCircuit} agent="A" label="MASTER" value={guardian.incident?.type.replaceAll("_", " ") ?? guardian.phase} active={Boolean(guardian.incident)} />
        <ChevronRight className="guardian-agent-arrow" aria-hidden="true" />
        <AgentNode icon={ShieldCheck} agent="C" label="SAFETY" value={safetyState} active={guardian.adaptation.dwellSuppressed} />
      </div>

      <div className="presenter-signal-row">
        <span>LIGHT <strong>{guardian.perception.lighting}</strong> · {Math.round(guardian.perception.luminance * 100)}%</span>
        <span>CONFIDENCE <strong>{Math.round(guardian.perception.trackingQuality * 100)}%</strong></span>
        <span>STABILITY <strong>{telemetry.stability}%</strong></span>
      </div>

      <div className="presenter-simulation">
        <label htmlFor="guardian-scenario"><Bot aria-hidden="true" /> DEMO SIMULATION</label>
        <div>
          <select
            id="guardian-scenario"
            value={selectedScenario}
            disabled={mode !== "demo"}
            onChange={(event) => setSelectedScenario(event.target.value as GuardianScenario)}
          >
            {SCENARIOS.map((scenario) => <option key={scenario.value} value={scenario.value}>{scenario.label}</option>)}
          </select>
          <AssistiveTarget
            targetId="guardian-run-simulation"
            label="Run Guardian simulation"
            className="presenter-run-button"
            onClick={() => setGuardianScenario(selectedScenario)}
            disabled={mode !== "demo"}
            dwellMs={900}
          >
            <Play aria-hidden="true" /> Run
          </AssistiveTarget>
        </div>
        <small>{mode === "demo" ? `ACTIVE · ${guardianScenario.replaceAll("_", " ")}` : "Switch to Demo Mode to run controlled scenarios."}</small>
      </div>

      {preferences.guardianShowAgentActivity && (
        <div className="presenter-trace">
          <div><Activity aria-hidden="true" /><span>LIVE EVENT TRACE</span></div>
          {guardian.events.length ? (
            <ol>
              {guardian.events.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <span>{event.agent}</span>
                  <div><strong>{event.title}</strong><small>{event.detail}</small></div>
                </li>
              ))}
            </ol>
          ) : <p>Waiting for a qualified transition.</p>}
        </div>
      )}

      <footer>
        <span>{Math.round(telemetry.fps)} FPS</span>
        <span>DWELL {Math.round(dwell.progress * 100)}%</span>
        <span>{guardian.phase.replaceAll("_", " ")}</span>
      </footer>
    </aside>
  );
}

function AgentNode({
  icon: Icon,
  agent,
  label,
  value,
  active,
}: {
  icon: typeof Activity;
  agent: string;
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={active ? "is-active" : ""}>
      <span>{agent}</span>
      <Icon aria-hidden="true" />
      <strong>{label}</strong>
      <small>{value}</small>
    </div>
  );
}

