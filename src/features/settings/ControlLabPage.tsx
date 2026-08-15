import { ArrowDown, Camera, CheckCircle2, Crosshair, Eye, Gauge, Move3D, Orbit, ScanFace, SlidersHorizontal, TimerReset } from "lucide-react";
import { useLumina } from "@/app/LuminaProvider";

const pipeline = [
  { title: "Camera", copy: "Browser video frames", icon: Camera },
  { title: "Face landmarks", copy: "MediaPipe feature map", icon: ScanFace },
  { title: "Head pose", copy: "Yaw · pitch · roll", icon: Move3D },
  { title: "Calibration", copy: "Neutral and range", icon: Crosshair },
  { title: "Dead zone", copy: "Neutral noise suppression", icon: Orbit },
  { title: "Response curve", copy: "Precision to travel", icon: SlidersHorizontal },
  { title: "Adaptive smoothing", copy: "Velocity-aware filtering", icon: Gauge },
  { title: "Pointer mapping", copy: "Hybrid calibrated control", icon: Move3D },
  { title: "Target attraction", copy: "Subtle center bias", icon: Eye },
  { title: "Stability", copy: "Motion qualification", icon: CheckCircle2 },
  { title: "Dwell evidence", copy: "Qualified accumulation", icon: TimerReset },
  { title: "Activation", copy: "Eligible exactly once", icon: CheckCircle2 },
];

export default function ControlLabPage() {
  const { telemetry, dwell, mode, preferences, calibration } = useLumina();
  return (
    <div className="control-lab">
      <header className="module-heading">
        <div><p className="workspace-kicker">TECHNICAL DEMONSTRATION</p><h1>Control Lab</h1><p>Watch movement become a qualified action, stage by stage.</p></div>
        <div className="control-lab__live"><span /> LIVE PIPELINE</div>
      </header>
      <div className="control-lab__layout">
        <section className="pipeline-stack" aria-label="LuminaXR control pipeline">
          {pipeline.map(({ title, copy, icon: Icon }, index) => (
            <div key={title} className={index >= 9 && telemetry.stability < preferences.stabilityRequirement ? "is-waiting" : index >= 10 && !dwell.targetId ? "is-waiting" : index === pipeline.length - 1 && dwell.state !== "activated" ? "is-waiting" : "is-active"}>
              <span className="pipeline-stack__index">{String(index + 1).padStart(2, "0")}</span>
              <Icon aria-hidden="true" />
              <span><strong>{title}</strong><small>{copy}</small></span>
              <i />
              {index < pipeline.length - 1 && <ArrowDown className="pipeline-stack__arrow" aria-hidden="true" />}
            </div>
          ))}
        </section>
        <aside className="lab-telemetry">
          <header><span>SIGNAL TELEMETRY</span><strong>{mode === "demo" ? "DEMO SESSION" : "CAMERA SESSION"}</strong></header>
          <div className="pose-visualizer">
            <div style={{ transform: `rotateY(${telemetry.yaw}deg) rotateX(${-telemetry.pitch}deg) rotateZ(${telemetry.roll}deg)` }}><span /><i /><i /></div>
            <dl><div><dt>YAW</dt><dd>{telemetry.yaw.toFixed(1)}°</dd></div><div><dt>PITCH</dt><dd>{telemetry.pitch.toFixed(1)}°</dd></div><div><dt>ROLL</dt><dd>{telemetry.roll.toFixed(1)}°</dd></div></dl>
          </div>
          <div className="lab-signal-grid">
            <Metric label="Raw X / Y" value={`${Math.round(telemetry.raw.x)} / ${Math.round(telemetry.raw.y)}`} />
            <Metric label="Filtered X / Y" value={`${Math.round(telemetry.filtered.x)} / ${Math.round(telemetry.filtered.y)}`} />
            <Metric label="Head velocity" value={`${Math.round(telemetry.velocity)} px/s`} />
            <Metric label="Tracking signal" value={`${Math.round(telemetry.confidence * 100)}%`} />
            <Metric label="Stability score" value={`${telemetry.stability}%`} accent={telemetry.stability >= preferences.stabilityRequirement} />
            <Metric label="Intent qualification" value={`${Math.round(telemetry.qualification * 100)}%`} accent={telemetry.qualification >= 0.7} />
            <Metric label="FPS" value={`${telemetry.fps}`} />
            <Metric label="Camera resolution" value={telemetry.cameraResolution ? `${telemetry.cameraResolution.width} × ${telemetry.cameraResolution.height}` : mode === "demo" ? "Simulated" : "Waiting"} />
            <Metric label="Active target" value={dwell.targetLabel ?? "None"} />
            <Metric label="Target score" value={dwell.targetId ? dwell.targetScore.toFixed(2) : "0.00"} />
            <Metric label="Interaction state" value={dwell.state.replace("-", " ")} accent={dwell.stable} />
            <Metric label="Dwell evidence" value={`${Math.round(dwell.evidenceMs)} ms · ${Math.round(dwell.progress * 100)}%`} accent={dwell.stable} />
          </div>
          <div className="lab-profile">
            <span>ACTIVE CONTROL PROFILE</span>
            <dl><div><dt>Preset</dt><dd>{preferences.preset}</dd></div><div><dt>Smoothing</dt><dd>{preferences.smoothing}%</dd></div><div><dt>Dead zone</dt><dd>{preferences.deadZone}%</dd></div><div><dt>Range</dt><dd>L {calibration.leftRange.toFixed(1)}° · R {calibration.rightRange.toFixed(1)}° · U {calibration.upRange.toFixed(1)}° · D {calibration.downRange.toFixed(1)}°</dd></div></dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={accent ? "is-accent" : ""}><span>{label}</span><strong>{value}</strong></div>;
}
