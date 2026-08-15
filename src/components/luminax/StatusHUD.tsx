import { Camera, Gauge, MousePointer2, Pause, Play, ScanFace, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "./AssistiveTarget";

const statusCopy = {
  idle: "Idle",
  "initializing-model": "Loading vision model",
  requesting: "Requesting camera",
  "starting-camera": "Starting camera",
  searching: "Searching for face",
  active: "Access active",
  "low-confidence": "Tracking quality reduced",
  reacquiring: "Reacquiring control",
  paused: "Paused",
  "face-lost": "Face lost",
  "camera-off": "Camera off",
  "permission-denied": "Permission not granted",
  "no-camera": "No camera detected",
  demo: "Access active",
  error: "Camera unavailable",
};

export function StatusHUD() {
  const { status, mode, paused, togglePaused, telemetry, preferences, enableCamera, enableDemo, guardian } = useLumina();
  const cameraBusy = status === "requesting" || status === "starting-camera" || status === "initializing-model";
  const guardianStatus = preferences.guardianEnabled && guardian.phase === "PROTECTIVE_HOLD"
    ? "Guardian protective hold"
    : preferences.guardianEnabled && guardian.phase === "RECOVERING"
      ? "Guardian verifying safety"
      : statusCopy[status];

  return (
    <aside className="status-hud" aria-label="LuminaXR system status">
      <div className="status-hud__signal">
        <span className={`status-dot status-dot--${status}`} />
        <div>
          <span className="status-hud__eyebrow">{mode === "demo" ? "DEMO MODE" : status === "active" ? "TRACKING" : "CAMERA"}</span>
          <strong>{guardianStatus}</strong>
        </div>
      </div>
      <div className="status-hud__metric status-hud__intent">
        <ScanFace aria-hidden="true" />
        <span>Intent</span>
        <strong>{Math.round(telemetry.qualification * 100)}%</strong>
      </div>
      <div className="status-hud__metric status-hud__metric--desktop">
        <Gauge aria-hidden="true" />
        <span>Dwell</span>
        <strong>{(preferences.dwellMs / 1000).toFixed(1)}s</strong>
      </div>
      <div className="status-hud__metric status-hud__metric--desktop">
        <Camera aria-hidden="true" />
        <span>Camera</span>
        <strong>{mode === "camera" ? status === "active" ? "Local" : statusCopy[status] : "Simulated"}</strong>
      </div>
      <AssistiveTarget
        targetId="system-input-mode"
        label={mode === "demo" ? "Enable head tracking" : "Use simulation mode"}
        title={mode === "demo" ? "Enable head tracking" : "Use simulation mode"}
        onClick={() => mode === "demo" ? void enableCamera() : enableDemo()}
        className="status-hud__mode"
        tone={mode === "demo" ? "cyan" : "mint"}
        dwellMs={1100}
        priority={8}
        attractionStrength={0.82}
        disabled={cameraBusy}
      >
        {mode === "demo" ? <Camera aria-hidden="true" /> : <MousePointer2 aria-hidden="true" />}
        <span>{cameraBusy ? "Starting" : mode === "demo" ? "Head" : "Demo"}</span>
      </AssistiveTarget>
      <AssistiveTarget
        targetId="system-pause"
        label={paused ? "Resume LuminaXR" : "Pause LuminaXR"}
        onClick={togglePaused}
        className="status-hud__pause"
        tone={paused ? "mint" : "neutral"}
        dwellMs={900}
        priority={10}
        attractionStrength={0.88}
        allowWhenPaused
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        <span>{paused ? "Resume" : "Pause"}</span>
      </AssistiveTarget>
      <Link className="status-hud__settings" to="/settings" aria-label="Open settings">
        <Settings2 aria-hidden="true" />
      </Link>
    </aside>
  );
}
