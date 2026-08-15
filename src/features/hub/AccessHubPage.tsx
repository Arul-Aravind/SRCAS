import {
  ArrowRight,
  BookOpen,
  Gauge,
  MessageSquareText,
  PlaySquare,
  Presentation,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";

const modules = [
  { id: "read", title: "Read", copy: "Books & documents", detail: "Focus, scroll and listen", icon: BookOpen, tone: "cyan" as const, path: "/read" },
  { id: "media", title: "Watch & listen", copy: "Accessible media", detail: "Large playback controls", icon: PlaySquare, tone: "mint" as const, path: "/media" },
  { id: "communicate", title: "Communicate", copy: "Quick phrases", detail: "Optional spoken output", icon: MessageSquareText, tone: "violet" as const, path: "/communicate" },
];

export default function AccessHubPage() {
  const navigate = useNavigate();
  const { mode, telemetry, dwell, preferences, updatePreferences, calibration, session } = useLumina();
  const minutes = Math.max(0, Math.floor((Date.now() - session.startedAt) / 60000));

  return (
    <div className="access-hub">
      <section className="hub-intro">
        <div>
          <p className="workspace-kicker"><span /> ACCESS ACTIVE · {mode === "demo" ? "DEMO MODE" : "CAMERA MODE"}</p>
          <h1>LuminaXR is ready for you.</h1>
          <p>Move toward an experience. Become comfortably steady. The ring completes only when your interaction signal is qualified.</p>
          {session.selections === 0 ? <div className="first-run-cue"><strong>First selection</strong> Keep your head comfortably steady after the target is acquired.</div> : session.selections === 1 ? <div className="first-run-cue is-success"><strong>That&apos;s it.</strong> LuminaXR selected only while your movement remained stable.</div> : null}
        </div>
        <div className="hub-intent">
          <div className="hub-intent__ring" style={{ "--intent": `${Math.round(telemetry.qualification * 100)}%` } as React.CSSProperties}>
            <Gauge aria-hidden="true" />
          </div>
          <span>INTERACTION SIGNAL</span>
          <strong>{Math.round(telemetry.qualification * 100)}%</strong>
          <small>{dwell.state.toUpperCase()}</small>
        </div>
      </section>

      <section className="hub-modules" aria-label="Access modules">
        {modules.map(({ id, title, copy, detail, icon: Icon, tone, path }, index) => (
          <AssistiveTarget
            key={id}
            targetId={`hub-${id}`}
            label={`Open ${title}`}
            tone={tone}
            className="hub-module"
            onClick={() => navigate(path)}
          >
            <span className="hub-module__number">0{index + 1}</span>
            <div className="hub-module__icon"><Icon aria-hidden="true" /></div>
            <div>
              <p>{copy}</p>
              <h2>{title}</h2>
              <span>{detail}</span>
            </div>
            <ArrowRight className="hub-module__arrow" aria-hidden="true" />
          </AssistiveTarget>
        ))}
      </section>

      <section className="hub-utility-band">
        <div className="hub-session">
          <span>THIS SESSION <small>{mode === "demo" ? "DEMO SESSION METRICS" : "CAMERA SESSION METRICS"}</small></span>
          <dl>
            <div><dt>Session</dt><dd>{String(minutes).padStart(2, "0")}:{String(Math.floor(((Date.now() - session.startedAt) / 1000) % 60)).padStart(2, "0")}</dd></div>
            <div><dt>Selections</dt><dd>{session.selections}</dd></div>
            <div><dt>Interrupted dwell</dt><dd>{session.interruptions}</dd></div>
            <div><dt>False activations</dt><dd>{session.falseActivations}</dd></div>
            <div><dt>Avg. acquisition</dt><dd>{session.averageAcquisitionMs ? `${Math.round(session.averageAcquisitionMs)} ms` : "--"}</dd></div>
          </dl>
        </div>
        <div className="hub-calibration">
          <ShieldCheck aria-hidden="true" />
          <div><span>CALIBRATION</span><strong>{calibration.completed ? "Personal profile active" : "Safe defaults active"}</strong><p>L {calibration.leftRange.toFixed(1)}° · R {calibration.rightRange.toFixed(1)}° · U {calibration.upRange.toFixed(1)}° · D {calibration.downRange.toFixed(1)}° · {(preferences.dwellMs / 1000).toFixed(1)}s dwell</p></div>
        </div>
        <AssistiveTarget
          targetId="presenter-mode"
          label={preferences.presenterMode ? "Hide presenter mode" : "Open presenter mode"}
          tone="neutral"
          className="hub-presenter"
          dwellMs={1000}
          onClick={() => updatePreferences({ presenterMode: !preferences.presenterMode })}
        >
          <Presentation aria-hidden="true" />
          <div><span>PRESENTER MODE</span><strong>{preferences.presenterMode ? "Hide live pipeline" : "Show live pipeline"}</strong></div>
          <Sparkles aria-hidden="true" />
        </AssistiveTarget>
      </section>
    </div>
  );
}
