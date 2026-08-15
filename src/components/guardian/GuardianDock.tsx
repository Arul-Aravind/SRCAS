import { useLumina } from "@/app/LuminaProvider";

export function GuardianDock() {
  const { guardian, preferences } = useLumina();
  if (!preferences.guardianEnabled || guardian.phase === "MONITORING" || guardian.phase === "QUALIFYING") return null;

  const tone = guardian.incident?.severity === "CRITICAL"
    ? "critical"
    : guardian.phase === "SUCCESS"
      ? "success"
      : guardian.phase === "RECOVERING"
        ? "recovery"
        : guardian.phase === "SAFE_PAUSED"
          ? "paused"
          : "caution";
  const reducedMotion = preferences.reducedMotion || preferences.guardianReducedMotion;

  return (
    <>
      <div className={`guardian-edge-light is-${tone} ${reducedMotion ? "is-reduced" : ""}`} aria-hidden="true">
        <span className="guardian-edge-light__top" />
        <span className="guardian-edge-light__right" />
        <span className="guardian-edge-light__bottom" />
        <span className="guardian-edge-light__left" />
      </div>
      <aside className={`guardian-edge-notification is-${tone}`} aria-label="Guardian guidance" aria-live="polite" aria-atomic="true">
        <span>GUARDIAN · {guardian.phase.replaceAll("_", " ")}</span>
        <strong>{guardian.headline}</strong>
        <p>{guardian.guidance}</p>
        {guardian.phase === "RECOVERING" && (
          <div className="guardian-recovery" aria-label={`Recovery ${Math.round(guardian.recoveryProgress * 100)} percent`}>
            <i style={{ width: `${guardian.recoveryProgress * 100}%` }} />
          </div>
        )}
      </aside>
    </>
  );
}

