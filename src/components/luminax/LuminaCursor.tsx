import { useLumina } from "@/app/LuminaProvider";

export function LuminaCursor() {
  const { cursor, dwell, guardian, paused, preferences, status } = useLumina();
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const unavailable = status === "camera-off" || status === "permission-denied" || status === "no-camera" || status === "error";
  const guardianHold = preferences.guardianEnabled && (guardian.adaptation.protectiveHold || guardian.phase === "RECOVERING");

  const stateLabel = {
    idle: "",
    candidate: "TARGET",
    acquired: "ACQUIRED",
    stabilizing: "STABILIZE",
    dwelling: "STABLE",
    interrupted: "INTERRUPTED",
    ready: "READY",
    confirming: "CONFIRM",
    activated: "SELECTED",
    cancelled: "CANCELLED",
  }[dwell.state];

  const statusLabel = status === "permission-denied"
    ? "CAMERA BLOCKED"
    : status === "no-camera"
      ? "NO CAMERA"
      : status === "camera-off"
        ? "CAMERA OFF"
        : status === "error"
          ? "TRACKING ERROR"
          : "";

  return (
    <div
      className={`lumina-cursor state-${dwell.state} ${dwell.targetId ? "is-acquired" : ""} ${dwell.stable ? "is-stable" : ""} ${paused ? "is-paused" : ""} ${dwell.activated ? "is-activated" : ""} ${status === "face-lost" || status === "low-confidence" || status === "reacquiring" || guardianHold ? "is-uncertain" : ""} ${unavailable ? "is-unavailable" : ""}`}
      style={{
        transform: `translate3d(var(--lumina-cursor-x, ${cursor.x}px), var(--lumina-cursor-y, ${cursor.y}px), 0) translate(-50%, -50%) scale(${preferences.cursorSize / 44})`,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 44 44">
        <circle className="lumina-cursor__track" cx="22" cy="22" r={radius} />
        <circle
          className="lumina-cursor__progress"
          cx="22"
          cy="22"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - (preferences.progressVisualization ? dwell.progress : 0))}
        />
      </svg>
      <span className="lumina-cursor__dot" />
      {(stateLabel || statusLabel || status === "face-lost" || status === "reacquiring" || guardianHold) && (
        <span className="lumina-cursor__state">
          {guardianHold ? guardian.phase === "RECOVERING" ? "VERIFYING" : "GUARDIAN HOLD" : status === "face-lost" ? "FACE LOST" : status === "reacquiring" ? "REACQUIRING" : statusLabel || stateLabel}
        </span>
      )}
    </div>
  );
}
