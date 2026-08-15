import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  CircleCheck,
  LockKeyhole,
  MousePointer2,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLumina } from "@/app/LuminaProvider";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";
import { BrandMark } from "@/components/luminax/BrandMark";
import { ReturnToHubTarget } from "@/components/luminax/ReturnToHubTarget";
import { clamp, robustDirectionalRange, robustPoseCenter } from "@/lib/controlPipeline";
import type { NeutralPose } from "@/types/luminax";

type SetupStage = "welcome" | "permission" | "face" | "neutral" | "range" | "dwell" | "complete";
type Direction = "LEFT" | "RIGHT" | "UP" | "DOWN";

const stages: SetupStage[] = ["welcome", "permission", "face", "neutral", "range", "dwell", "complete"];
const directions: Direction[] = ["LEFT", "RIGHT", "UP", "DOWN"];
const rangeAxis: Record<Direction, { axis: "yaw" | "pitch"; sign: -1 | 1 }> = {
  LEFT: { axis: "yaw", sign: -1 },
  RIGHT: { axis: "yaw", sign: 1 },
  UP: { axis: "pitch", sign: -1 },
  DOWN: { axis: "pitch", sign: 1 },
};

export default function SetupPage() {
  const navigate = useNavigate();
  const {
    mode,
    status,
    cameraActive,
    cameraError,
    enableCamera,
    enableDemo,
    recenterDemoInput,
    telemetry,
    videoRef,
    preferences,
    saveCalibration,
    calibration,
    getTrackingSample,
    session,
  } = useLumina();
  const [stage, setStage] = useState<SetupStage>("welcome");
  const [samplingProgress, setSamplingProgress] = useState(0);
  const [neutralAttempt, setNeutralAttempt] = useState(0);
  const [neutralError, setNeutralError] = useState<string | null>(null);
  const [neutralPose, setNeutralPose] = useState<NeutralPose>(calibration.neutralPose);
  const [neutralStability, setNeutralStability] = useState(calibration.neutralStability);
  const [neutralSampleCount, setNeutralSampleCount] = useState(calibration.neutralSampleCount);
  const [directionIndex, setDirectionIndex] = useState(0);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [capturingDirection, setCapturingDirection] = useState<Direction | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [ranges, setRanges] = useState({
    left: calibration.completed ? calibration.leftRange : 0,
    right: calibration.completed ? calibration.rightRange : 0,
    up: calibration.completed ? calibration.upRange : 0,
    down: calibration.completed ? calibration.downRange : 0,
  });
  const [dwellSuccess, setDwellSuccess] = useState<string[]>([]);
  const [dwellBaseline, setDwellBaseline] = useState({ interruptions: 0, selections: 0, startedAt: 0 });
  const neutralSamplesRef = useRef<Array<ReturnType<typeof getTrackingSample>>>([]);

  const stageIndex = stages.indexOf(stage);
  const next = (nextStage: SetupStage) => {
    setStage(nextStage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (stage !== "neutral") return;
    if (mode === "demo") recenterDemoInput();
    setSamplingProgress(0);
    setNeutralError(null);
    neutralSamplesRef.current = [];
    const started = performance.now();
    const durationMs = 2800;
    let frame = 0;
    const tick = (now: number) => {
      const sample = getTrackingSample();
      if (sample.trackingQuality >= 0.52 && sample.stability >= 35) neutralSamplesRef.current.push(sample);
      const progress = Math.min(1, (now - started) / durationMs);
      setSamplingProgress(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const samples = neutralSamplesRef.current;
      if (samples.length < 12) {
        setNeutralError(mode === "camera" ? "A steady face signal was not available long enough. Adjust your position and try again." : "Keep the demo pointer still for a moment, then try again.");
        return;
      }
      setNeutralPose(robustPoseCenter(samples.map((sampleValue) => sampleValue.pose)));
      setNeutralStability(Math.round(samples.reduce((sum, sampleValue) => sum + sampleValue.stability, 0) / samples.length));
      setNeutralSampleCount(samples.length);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getTrackingSample, mode, neutralAttempt, recenterDemoInput, stage]);

  useEffect(() => {
    if (stage === "dwell" && dwellBaseline.startedAt === 0) {
      setDwellBaseline({ interruptions: session.interruptions, selections: session.selections, startedAt: performance.now() });
    }
  }, [dwellBaseline.startedAt, session.interruptions, session.selections, stage]);

  const chooseDemo = () => {
    enableDemo();
    next("face");
  };

  const requestCamera = async () => {
    const granted = await enableCamera();
    if (granted) next("face");
  };

  const captureDirection = (direction: Direction) => {
    if (capturingDirection) return;
    setRangeError(null);
    setCapturingDirection(direction);
    setCaptureProgress(0);
    const started = performance.now();
    const durationMs = 1900;
    const samples: number[] = [];
    const { axis, sign } = rangeAxis[direction];
    let frame = 0;
    const tick = (now: number) => {
      const sample = getTrackingSample();
      if (sample.trackingQuality >= 0.48) samples.push(sample.pose[axis]);
      const progress = Math.min(1, (now - started) / durationMs);
      setCaptureProgress(progress);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const measured = robustDirectionalRange(samples, neutralPose[axis], sign, 0.86);
      setCapturingDirection(null);
      if (measured < 1.5) {
        setRangeError(`A clear ${direction.toLowerCase()} movement was not detected. Move only as far as feels comfortable and try again.`);
        return;
      }
      const value = Math.round(clamp(measured, 1.5, 38) * 10) / 10;
      const key = direction.toLowerCase() as keyof typeof ranges;
      setRanges((current) => ({ ...current, [key]: value }));
      setDirectionIndex((index) => Math.min(directions.length, index + 1));
    };
    frame = requestAnimationFrame(tick);
  };

  const completeCalibration = () => {
    saveCalibration({
      source: mode === "camera" ? "camera" : "demo",
      neutralPose,
      leftRange: ranges.left,
      rightRange: ranges.right,
      upRange: ranges.up,
      downRange: ranges.down,
      neutralStability,
      neutralSampleCount,
      recommendedSmoothing: preferences.smoothing,
      recommendedDwellMs: preferences.dwellMs,
    });
    next("complete");
  };

  const faceReady = mode === "demo" || status === "active";
  const dwellInterruptions = Math.max(0, session.interruptions - dwellBaseline.interruptions);
  const dwellDuration = dwellBaseline.startedAt ? Math.round((performance.now() - dwellBaseline.startedAt) / 1000) : 0;
  const rangeLabel = (value: number) => value ? `${value.toFixed(1)}°` : "--";

  return (
    <div className="setup-page">
      <header className="setup-header">
        <BrandMark />
        <div className="setup-progress" aria-label={`Setup step ${stageIndex + 1} of ${stages.length}`}>
          <span style={{ width: `${((stageIndex + 1) / stages.length) * 100}%` }} />
        </div>
        <ReturnToHubTarget />
      </header>

      <main className="setup-stage" key={stage}>
        {stage === "welcome" && (
          <section className="setup-welcome">
            <div className="setup-orbit" aria-hidden="true"><span /><span /><MousePointer2 /></div>
            <p className="setup-kicker">PERSONAL ACCESS SETUP</p>
            <h1>{calibration.completed ? "Welcome back." : "LuminaXR adapts to your movement."}</h1>
            <p>{calibration.completed ? "Your saved calibration is ready. You can enter LuminaXR now or tune it again." : "A short guided setup maps your comfortable head movement to a calm, intentional pointer."}</p>
            <div className="setup-summary-row">
              <span><ScanFace aria-hidden="true" /> Comfortable movement</span>
              <span><ShieldCheck aria-hidden="true" /> Stable-only actions</span>
              <span><LockKeyhole aria-hidden="true" /> Local-first processing</span>
            </div>
            <div className="setup-actions">
              {calibration.completed && <button className="secondary-command" type="button" onClick={() => navigate("/hub")}>Use saved calibration</button>}
              <button className="primary-command" type="button" onClick={() => next("permission")}>{calibration.completed ? "Recalibrate" : "Begin setup"}<ArrowRight aria-hidden="true" /></button>
            </div>
          </section>
        )}

        {stage === "permission" && (
          <section className="permission-stage">
            <div className="permission-stage__visual"><Camera aria-hidden="true" /><span className="camera-pulse" /></div>
            <p className="setup-kicker">CAMERA PERMISSION</p>
            <h1>LuminaXR needs camera access to understand your head movement.</h1>
            <p>The browser controls this permission. Initial approval may require a mouse, keyboard, touch, caregiver assistance, or browser accessibility controls.</p>
            <div className="permission-facts">
              <span><LockKeyhole aria-hidden="true" /><strong>Local</strong> Browser processing</span>
              <span><CameraOff aria-hidden="true" /><strong>No upload</strong> Camera frames</span>
              <span><ShieldCheck aria-hidden="true" /><strong>Your control</strong> Stop anytime</span>
            </div>
            {cameraError && <div className="setup-error" role="alert"><CameraOff aria-hidden="true" /><span><strong>{cameraError}</strong>Try again or continue with the same interaction engine in Demo Mode.</span></div>}
            <div className="setup-actions">
              <button className="secondary-command" type="button" onClick={chooseDemo}>Continue in Demo Mode</button>
              <button className="primary-command" type="button" onClick={requestCamera}><Camera aria-hidden="true" />{cameraError ? "Try Camera Again" : "Enable Camera"}</button>
            </div>
          </section>
        )}

        {stage === "face" && (
          <section className="face-stage">
            <div className="setup-camera-frame">
              {cameraActive ? (
                <video
                  ref={(node) => {
                    if (node && videoRef.current?.srcObject) {
                      node.srcObject = videoRef.current.srcObject;
                      void node.play();
                    }
                  }}
                  muted
                  playsInline
                  className={preferences.mirrorVideo ? "is-mirrored" : ""}
                />
              ) : (
                <div className="demo-face"><span /><span /><span /><strong>DEMO SIGNAL</strong></div>
              )}
              <div className="face-box"><i /><i /><i /><i /><span>FACE REGION</span></div>
              <div className="camera-frame__status"><span />{mode === "camera" ? status.replace(/-/g, " ").toUpperCase() : "DEMO MODE"}</div>
            </div>
            <div className="face-stage__copy">
              <p className="setup-kicker">FACE DETECTION</p>
              <h1>{mode === "camera" ? faceReady ? "Your movement signal is ready." : "Preparing your movement signal." : "Demo signal is ready."}</h1>
              <p>{mode === "camera" ? status === "face-lost" ? "Move into camera view. Control remains frozen until tracking is safely reacquired." : "Stay at a comfortable distance. You do not need to hold perfectly still." : "Mouse movement or Alt + Arrow keys drive the pointer through the same intent and dwell system."}</p>
              <dl className="tracking-readout">
                <div><dt>Input</dt><dd>{mode === "camera" ? "CAMERA" : "SIMULATED"}</dd></div>
                <div><dt>Tracking</dt><dd>{mode === "camera" ? status.replace(/-/g, " ").toUpperCase() : "READY"}</dd></div>
                <div><dt>Tracking signal</dt><dd>{Math.round(telemetry.confidence * 100)}%</dd></div>
                <div><dt>Resolution</dt><dd>{telemetry.cameraResolution ? `${telemetry.cameraResolution.width} × ${telemetry.cameraResolution.height}` : mode === "camera" ? "INITIALIZING" : "DEMO"}</dd></div>
              </dl>
              <button className="primary-command" type="button" disabled={!faceReady} onClick={() => next("neutral")}>Find neutral position <ArrowRight aria-hidden="true" /></button>
              {mode === "camera" && !faceReady && <button className="secondary-command" type="button" onClick={chooseDemo}>Use Demo Mode instead</button>}
            </div>
          </section>
        )}

        {stage === "neutral" && (
          <section className="neutral-stage">
            <p className="setup-kicker">NEUTRAL POSITION</p>
            <h1>Look where your head feels comfortable.</h1>
            <p>There is no perfect center. LuminaXR learns yours from a stable sample window.</p>
            <div className={`neutral-reticle ${samplingProgress >= 1 && !neutralError ? "is-complete" : ""}`}>
              <span className="neutral-reticle__x" /><span className="neutral-reticle__y" /><i />
              <div style={{ "--progress": samplingProgress } as React.CSSProperties} />
            </div>
            <div className="sampling-status">
              {samplingProgress < 1 ? <><span>Learning your comfortable neutral position</span><strong>{Math.round(samplingProgress * 100)}%</strong></> : neutralError ? <><CameraOff aria-hidden="true" /><span>{neutralError}</span><strong>NOT SAVED</strong></> : <><CircleCheck aria-hidden="true" /><span>Neutral position learned from {neutralSampleCount} samples</span><strong>{neutralStability}% stable</strong></>}
            </div>
            {neutralError ? (
              <button className="primary-command" type="button" onClick={() => setNeutralAttempt((attempt) => attempt + 1)}><RefreshCw aria-hidden="true" /> Try neutral sample again</button>
            ) : (
              <button className="primary-command" type="button" disabled={samplingProgress < 1} onClick={() => next("range")}>Map comfortable range <ArrowRight aria-hidden="true" /></button>
            )}
          </section>
        )}

        {stage === "range" && (
          <section className="range-stage">
            <div className="range-stage__copy">
              <p className="setup-kicker">COMFORTABLE MOVEMENT RANGE</p>
              <h1>Move comfortably toward the highlighted direction.</h1>
              <p>Stop wherever feels natural. Each direction is measured independently using a robust sample percentile.</p>
              <div className="direction-sequence">
                {directions.map((direction, index) => <span key={direction} className={index < directionIndex ? "is-complete" : index === directionIndex ? "is-active" : ""}>{index < directionIndex ? <Check /> : direction}</span>)}
              </div>
              {rangeError && <div className="setup-error" role="alert"><CameraOff aria-hidden="true" /><span><strong>Movement not captured</strong>{rangeError}</span></div>}
              {directionIndex < directions.length ? (
                <button className="primary-command" type="button" disabled={Boolean(capturingDirection)} onClick={() => captureDirection(directions[directionIndex])}>
                  {capturingDirection ? `Capturing ${capturingDirection.toLowerCase()} · ${Math.round(captureProgress * 100)}%` : `Capture ${directions[directionIndex].toLowerCase()}`}
                  {capturingDirection ? <span className="capture-spinner" /> : <ArrowRight aria-hidden="true" />}
                </button>
              ) : (
                <button className="primary-command" type="button" onClick={() => next("dwell")}>Test dwell selection <ArrowRight aria-hidden="true" /></button>
              )}
            </div>
            <CalibrationCamera
              direction={directions[directionIndex] ?? null}
              capturingDirection={capturingDirection}
              captureProgress={captureProgress}
            />
            <div className="range-map" aria-label="Personalized movement envelope">
              <span className="range-map__up">↑ {rangeLabel(ranges.up)}</span>
              <span className="range-map__left">← {rangeLabel(ranges.left)}</span>
              <span className="range-map__right">{rangeLabel(ranges.right)} →</span>
              <span className="range-map__down">↓ {rangeLabel(ranges.down)}</span>
              <div className="range-map__envelope" style={{ transform: `scale(${0.72 + Math.min(1, (ranges.left + ranges.right) / 42) * 0.26}, ${0.72 + Math.min(1, (ranges.up + ranges.down) / 32) * 0.26})` }} />
              <i
                className="range-map__live"
                style={{
                  left: `${50 + clamp((telemetry.yaw - neutralPose.yaw) / Math.max(18, ranges.left, ranges.right), -1, 1) * 38}%`,
                  top: `${50 + clamp((telemetry.pitch - neutralPose.pitch) / Math.max(14, ranges.up, ranges.down), -1, 1) * 38}%`,
                }}
              />
              <div className="range-map__axis range-map__axis--x" /><div className="range-map__axis range-map__axis--y" />
              <strong>{mode === "camera" ? "MEASURED MOVEMENT ENVELOPE" : "DEMO MOVEMENT ENVELOPE"}</strong>
            </div>
          </section>
        )}

        {stage === "dwell" && (
          <section className="dwell-test-stage">
            <p className="setup-kicker">RECURRENT STABILITY-QUALIFIED DWELL</p>
            <h1>Try selecting each target.</h1>
            <p>Enter, acquire, then become comfortably steady. Evidence advances with qualified intent, decays through small interruptions, and resets when the target is lost.</p>
            <div className="dwell-test-grid">
              {["North", "East", "South", "West"].map((target, index) => (
                <AssistiveTarget
                  key={target}
                  targetId={`calibration-target-${target.toLowerCase()}`}
                  label={`Calibration target ${target}`}
                  tone={(["cyan", "mint", "violet", "amber"] as const)[index]}
                  onClick={() => setDwellSuccess((current) => current.includes(target) ? current : [...current, target])}
                  className={dwellSuccess.includes(target) ? "is-complete" : ""}
                  dwellMs={900}
                >
                  {dwellSuccess.includes(target) ? <CircleCheck aria-hidden="true" /> : <span>{index + 1}</span>}
                  <strong>{target}</strong>
                  <small>{dwellSuccess.includes(target) ? "Selected" : "Acquire and hold"}</small>
                </AssistiveTarget>
              ))}
            </div>
            <div className="dwell-test-result"><span>{dwellSuccess.length}/4 selected · {dwellInterruptions} interrupted</span><strong>{dwellSuccess.length >= 3 ? `Interaction tuned in this ${dwellDuration}s test.` : "Stable intent advances the evidence ring."}</strong></div>
            <button className="primary-command" type="button" disabled={dwellSuccess.length < 3} onClick={completeCalibration}>Complete calibration <Sparkles aria-hidden="true" /></button>
          </section>
        )}

        {stage === "complete" && (
          <section className="calibration-complete">
            <div className="complete-orbit"><CircleCheck aria-hidden="true" /><span /><span /></div>
            <p className="setup-kicker">CALIBRATION COMPLETE · {calibration.source === "camera" ? "CAMERA MEASURED" : "DEMO ESTIMATE"}</p>
            <h1>Your comfortable movement is now mapped to the screen.</h1>
            <p>LuminaXR is ready for you.</p>
            <div className="calibration-metrics">
              <div><span>Horizontal range</span><strong>{calibration.leftRange.toFixed(1)}° / {calibration.rightRange.toFixed(1)}°</strong><small>Left / right</small></div>
              <div><span>Vertical range</span><strong>{calibration.upRange.toFixed(1)}° / {calibration.downRange.toFixed(1)}°</strong><small>Up / down</small></div>
              <div><span>Neutral stability</span><strong>{calibration.neutralStability}%</strong><small>{calibration.neutralSampleCount} samples</small></div>
              <div><span>Recommended dwell</span><strong>{(calibration.recommendedDwellMs / 1000).toFixed(1)}s</strong><small>Adjustable</small></div>
            </div>
            <button className="primary-command primary-command--large" type="button" onClick={() => navigate("/hub")}>Enter LuminaXR <ArrowRight aria-hidden="true" /></button>
          </section>
        )}
      </main>
    </div>
  );
}

function CalibrationCamera({
  direction,
  capturingDirection,
  captureProgress,
}: {
  direction: Direction | null;
  capturingDirection: Direction | null;
  captureProgress: number;
}) {
  const { cameraActive, mode, preferences, status, telemetry, videoRef } = useLumina();
  const previewRef = useRef<HTMLVideoElement>(null);
  const activeDirection = capturingDirection ?? direction;

  useEffect(() => {
    const preview = previewRef.current;
    const stream = videoRef.current?.srcObject;
    if (!preview || !stream || !cameraActive) return;
    preview.srcObject = stream;
    void preview.play();
    return () => { preview.srcObject = null; };
  }, [cameraActive, videoRef]);

  return (
    <div className={`setup-camera-frame range-camera-frame ${capturingDirection ? "is-capturing" : ""}`} aria-label="Live calibration camera preview">
      {cameraActive && mode === "camera" ? (
        <video ref={previewRef} muted playsInline className={preferences.mirrorVideo ? "is-mirrored" : ""} />
      ) : (
        <div className="demo-face"><span /><span /><span /><strong>DEMO SIGNAL</strong></div>
      )}
      <div className="range-camera-guide" aria-hidden="true">
        <span className={activeDirection === "UP" ? "is-active" : ""}>UP</span>
        <span className={activeDirection === "LEFT" ? "is-active" : ""}>LEFT</span>
        <i />
        <span className={activeDirection === "RIGHT" ? "is-active" : ""}>RIGHT</span>
        <span className={activeDirection === "DOWN" ? "is-active" : ""}>DOWN</span>
      </div>
      <div className="camera-frame__status"><span />{mode === "camera" ? status.replace(/-/g, " ").toUpperCase() : "DEMO MODE"}<strong>{Math.round(telemetry.confidence * 100)}%</strong></div>
      {capturingDirection && <div className="range-camera-progress"><span style={{ width: `${captureProgress * 100}%` }} /></div>}
    </div>
  );
}
