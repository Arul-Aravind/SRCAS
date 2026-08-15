import { useEffect, useState } from "react";
import {
  Accessibility,
  Bot,
  Camera,
  CircleGauge,
  Database,
  Eye,
  Gauge,
  MousePointer2,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Speech,
  Timer,
} from "lucide-react";
import { useLumina, PRESETS } from "@/app/LuminaProvider";
import { AssistiveTarget } from "@/components/luminax/AssistiveTarget";
import type { AccessPreset, LuminaPreferences } from "@/types/luminax";

const presetLabels: Record<AccessPreset, { title: string; copy: string }> = {
  balanced: { title: "Balanced", copy: "A calm starting point" },
  precision: { title: "Precision", copy: "More smoothing, slower travel" },
  responsive: { title: "Responsive", copy: "Faster movement response" },
  tremor: { title: "Tremor Support", copy: "Stronger stability qualification" },
  "low-range": { title: "Low Range", copy: "Higher gain for smaller movement" },
};

type Section = "presets" | "tracking" | "dwell" | "camera" | "guardian" | "feedback" | "interface" | "privacy";

const sections: Array<{ id: Section; label: string; icon: typeof Gauge }> = [
  { id: "presets", label: "Presets", icon: CircleGauge },
  { id: "tracking", label: "Tracking", icon: SlidersHorizontal },
  { id: "dwell", label: "Dwell", icon: Timer },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "guardian", label: "Guardian", icon: Bot },
  { id: "feedback", label: "Feedback", icon: Speech },
  { id: "interface", label: "Interface", icon: Accessibility },
  { id: "privacy", label: "Privacy & data", icon: ShieldCheck },
];

export default function SettingsPage() {
  const {
    preferences,
    updatePreferences,
    applyPreset,
    resetPreferences,
    resetGuardianPreferences,
    resetCalibration,
    calibration,
    mode,
    cameraActive,
    cameraError,
    cameraDevices,
    enableCamera,
    enableDemo,
    restartCamera,
    refreshCameraDevices,
    requestConfirmation,
  } = useLumina();
  const [section, setSection] = useState<Section>("presets");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const refresh = () => setVoices(window.speechSynthesis.getVoices());
    refresh();
    window.speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
  }, []);

  useEffect(() => {
    if (section === "camera") void refreshCameraDevices();
  }, [refreshCameraDevices, section]);

  return (
    <div className="settings-page">
      <header className="module-heading">
        <div><p className="workspace-kicker">PERSONALIZATION</p><h1>Settings</h1><p>Tune interaction in plain language. Changes are saved in this browser.</p></div>
        <div className="settings-save-state"><span /><strong>Saved locally</strong></div>
      </header>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={section === id ? "is-active" : ""} onClick={() => setSection(id)}>
              <Icon aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <section className="settings-panel" aria-live="polite">
          {section === "presets" && (
            <SettingsSection title="Interaction presets" copy="Starting points, not medical profiles.">
              <div className="preset-grid">
                {(Object.keys(PRESETS) as AccessPreset[]).map((preset) => (
                  <AssistiveTarget key={preset} targetId={`preset-${preset}`} label={`Use ${presetLabels[preset].title} preset`} tone={preferences.preset === preset ? "cyan" : "neutral"} className={preferences.preset === preset ? "is-selected" : ""} onClick={() => applyPreset(preset)} dwellMs={900}>
                    <span>{preferences.preset === preset ? "ACTIVE" : "PRESET"}</span><strong>{presetLabels[preset].title}</strong><p>{presetLabels[preset].copy}</p>
                  </AssistiveTarget>
                ))}
              </div>
            </SettingsSection>
          )}
          {section === "tracking" && (
            <SettingsSection title="Pointer movement" copy="Precision near targets, response during travel.">
              <RangeSetting label="Overall sensitivity" value={preferences.sensitivity} min={30} max={100} suffix="%" onChange={(sensitivity) => updatePreferences({ sensitivity, preset: "balanced" })} />
              <RangeSetting label="Horizontal sensitivity" value={preferences.horizontalSensitivity} min={30} max={100} suffix="%" onChange={(horizontalSensitivity) => updatePreferences({ horizontalSensitivity })} />
              <RangeSetting label="Vertical sensitivity" value={preferences.verticalSensitivity} min={30} max={100} suffix="%" onChange={(verticalSensitivity) => updatePreferences({ verticalSensitivity })} />
              <RangeSetting label="Neutral stability" value={preferences.deadZone} min={1} max={18} suffix="%" onChange={(deadZone) => updatePreferences({ deadZone })} visual="deadzone" />
              <RangeSetting label="Adaptive smoothing" value={preferences.smoothing} min={35} max={96} suffix="%" onChange={(smoothing) => updatePreferences({ smoothing })} />
              <RangeSetting label="Target attraction" value={preferences.attraction} min={0} max={100} suffix="%" onChange={(attraction) => updatePreferences({ attraction })} />
              <ToggleSetting label="Invert horizontal movement" checked={preferences.invertHorizontal} onChange={(invertHorizontal) => updatePreferences({ invertHorizontal })} />
              <ToggleSetting label="Invert vertical movement" checked={preferences.invertVertical} onChange={(invertVertical) => updatePreferences({ invertVertical })} />
            </SettingsSection>
          )}
          {section === "dwell" && (
            <SettingsSection title="Stable dwell" copy="Selection advances only while the intent signal remains qualified.">
              <RangeSetting label="Dwell duration" value={preferences.dwellMs} min={700} max={2600} step={100} suffix=" ms" onChange={(dwellMs) => updatePreferences({ dwellMs })} />
              <RangeSetting label="Stability requirement" value={preferences.stabilityRequirement} min={55} max={90} suffix="%" onChange={(stabilityRequirement) => updatePreferences({ stabilityRequirement })} />
              <SelectSetting label="When stability is interrupted" value={preferences.dwellDecay} options={[{ value: "pause", label: "Pause progress" }, { value: "decay", label: "Slowly decay" }, { value: "reset", label: "Reset progress" }]} onChange={(dwellDecay) => updatePreferences({ dwellDecay: dwellDecay as LuminaPreferences["dwellDecay"] })} />
              <ToggleSetting label="Show dwell progress" checked={preferences.progressVisualization} onChange={(progressVisualization) => updatePreferences({ progressVisualization })} />
              <ToggleSetting label="Confirm consequential actions" checked={preferences.confirmConsequential} onChange={(confirmConsequential) => updatePreferences({ confirmConsequential })} />
            </SettingsSection>
          )}
          {section === "camera" && (
            <SettingsSection title="Camera" copy="Camera imagery is not stored by LuminaXR.">
              <div className="settings-status-line"><Camera aria-hidden="true" /><span>Current input</span><strong>{mode === "camera" && cameraActive ? "Camera active" : "Demo mode"}</strong></div>
              {cameraError && <div className="setup-error" role="alert"><Camera aria-hidden="true" /><span><strong>Camera could not start</strong>{cameraError}</span></div>}
              <SelectSetting label="Camera device" value={preferences.cameraDeviceId} options={[{ value: "", label: "System default camera" }, ...cameraDevices.map((device) => ({ value: device.deviceId, label: device.label }))]} onChange={(cameraDeviceId) => updatePreferences({ cameraDeviceId })} />
              {mode === "demo" ? <AssistiveTarget targetId="camera-enable" label="Enable head tracking" tone="cyan" onClick={() => void enableCamera()} dwellMs={1200}><Camera aria-hidden="true" /> Enable head tracking</AssistiveTarget> : <AssistiveTarget targetId="camera-demo" label="Use simulation mode" tone="mint" onClick={enableDemo} dwellMs={1200}><MousePointer2 aria-hidden="true" /> Use simulation mode</AssistiveTarget>}
              {mode === "camera" && cameraActive && <AssistiveTarget targetId="camera-restart" label="Restart camera with selected device" tone="cyan" onClick={() => void restartCamera()} dwellMs={1200}><RefreshCw aria-hidden="true" /> Restart camera</AssistiveTarget>}
              <ToggleSetting label="Mirror camera preview" checked={preferences.mirrorVideo} onChange={(mirrorVideo) => updatePreferences({ mirrorVideo })} />
              <ToggleSetting label="Show camera preview" checked={preferences.cameraPreview} onChange={(cameraPreview) => updatePreferences({ cameraPreview })} />
              <ToggleSetting label="Show tracking diagnostics" checked={preferences.diagnostics} onChange={(diagnostics) => updatePreferences({ diagnostics })} />
            </SettingsSection>
          )}
          {section === "feedback" && (
            <SettingsSection title="Feedback" copy="Use sound and speech strategically, without constant interruption.">
              <ToggleSetting label="Sound feedback" checked={preferences.soundFeedback} onChange={(soundFeedback) => updatePreferences({ soundFeedback })} />
              <ToggleSetting label="Speech feedback" checked={preferences.speechFeedback} onChange={(speechFeedback) => updatePreferences({ speechFeedback })} />
              <SelectSetting label="Speech voice" value={preferences.speechVoiceURI} options={[{ value: "", label: "System default voice" }, ...voices.map((voice) => ({ value: voice.voiceURI, label: `${voice.name} (${voice.lang})` }))]} onChange={(speechVoiceURI) => updatePreferences({ speechVoiceURI })} />
              <RangeSetting label="Speech rate" value={Math.round(preferences.speechRate * 100)} min={60} max={140} suffix="%" onChange={(value) => updatePreferences({ speechRate: value / 100 })} />
              <RangeSetting label="Speech volume" value={Math.round(preferences.speechVolume * 100)} min={20} max={100} suffix="%" onChange={(value) => updatePreferences({ speechVolume: value / 100 })} />
              <ToggleSetting label="Speak confirmation results" checked={preferences.spokenConfirmations} onChange={(spokenConfirmations) => updatePreferences({ spokenConfirmations })} />
            </SettingsSection>
          )}
          {section === "guardian" && (
            <SettingsSection title="Guardian guide" copy="A local three-agent safety system for camera framing, lighting, and recovery.">
              <ToggleSetting label="Enable Guardian guide" checked={preferences.guardianEnabled} onChange={(guardianEnabled) => updatePreferences({ guardianEnabled })} />
              <ToggleSetting label="Speak qualified guidance" checked={preferences.guardianVoice} onChange={(guardianVoice) => updatePreferences({ guardianVoice })} />
              <RangeSetting label="Guardian voice volume" value={Math.round(preferences.guardianVolume * 100)} min={20} max={100} suffix="%" onChange={(value) => updatePreferences({ guardianVolume: value / 100 })} />
              <ToggleSetting label="Reduce edge-light motion" checked={preferences.guardianReducedMotion} onChange={(guardianReducedMotion) => updatePreferences({ guardianReducedMotion })} />
              <ToggleSetting label="Show technical agent activity" checked={preferences.guardianShowAgentActivity} onChange={(guardianShowAgentActivity) => updatePreferences({ guardianShowAgentActivity })} />
              <div className="settings-danger-zone">
                <AssistiveTarget targetId="reset-guardian" label="Reset Guardian preferences" tone="neutral" onClick={resetGuardianPreferences} dwellMs={1200}><RotateCcw aria-hidden="true" /> Reset guide preferences</AssistiveTarget>
              </div>
            </SettingsSection>
          )}
          {section === "interface" && (
            <SettingsSection title="Interface" copy="Keep targets large, legible and comfortable.">
              <RangeSetting label="Interface scale" value={preferences.interfaceScale} min={90} max={125} suffix="%" onChange={(interfaceScale) => updatePreferences({ interfaceScale })} />
              <RangeSetting label="LuminaXR cursor size" value={preferences.cursorSize} min={34} max={68} suffix=" px" onChange={(cursorSize) => updatePreferences({ cursorSize })} />
              <ToggleSetting label="High contrast" checked={preferences.highContrast} onChange={(highContrast) => updatePreferences({ highContrast })} />
              <ToggleSetting label="Reduced motion" checked={preferences.reducedMotion} onChange={(reducedMotion) => updatePreferences({ reducedMotion })} />
              <ToggleSetting label="Presenter mode" checked={preferences.presenterMode} onChange={(presenterMode) => updatePreferences({ presenterMode })} />
            </SettingsSection>
          )}
          {section === "privacy" && (
            <SettingsSection title="Privacy & local data" copy="Only interaction settings and calibration values are saved.">
              <div className="privacy-settings-grid">
                <div><Database aria-hidden="true" /><span>Preferences</span><strong>Stored locally</strong></div>
                <div><Eye aria-hidden="true" /><span>Camera images</span><strong>Not stored</strong></div>
                <div><Gauge aria-hidden="true" /><span>Calibration</span><strong>{calibration.completed ? "Saved" : "Not saved"}</strong></div>
              </div>
              <div className="settings-danger-zone">
                <AssistiveTarget targetId="reset-calibration" label="Reset calibration" tone="amber" requiresConfirmation onClick={() => requestConfirmation({ title: "Reset saved calibration?", description: "Your measured neutral position and comfortable ranges will be removed from this browser.", confirmLabel: "Reset calibration", onConfirm: resetCalibration })} dwellMs={1500}><RotateCcw aria-hidden="true" /> Reset calibration</AssistiveTarget>
                <AssistiveTarget targetId="reset-preferences" label="Reset preferences" tone="neutral" requiresConfirmation onClick={() => requestConfirmation({ title: "Reset interaction preferences?", description: "Pointer, dwell, feedback, and interface settings will return to their defaults.", confirmLabel: "Reset preferences", onConfirm: resetPreferences })} dwellMs={1500}><RotateCcw aria-hidden="true" /> Reset preferences</AssistiveTarget>
              </div>
            </SettingsSection>
          )}
        </section>
      </div>
    </div>
  );
}

function SettingsSection({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <div className="settings-section"><header><h2>{title}</h2><p>{copy}</p></header><div className="settings-section__body">{children}</div></div>;
}

function RangeSetting({ label, value, min, max, step = 1, suffix, onChange, visual }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void; visual?: "deadzone" }) {
  return (
    <label className="range-setting">
      <span><strong>{label}</strong><output>{value}{suffix}</output></span>
      <div><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />{visual === "deadzone" && <i style={{ width: `${value}%` }} />}</div>
    </label>
  );
}

function ToggleSetting({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="toggle-setting"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true"><span /></i></label>;
}

function SelectSetting({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <label className="select-setting"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
