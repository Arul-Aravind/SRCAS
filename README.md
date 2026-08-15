# LuminaXR Access

## Overview

LuminaXR Access is a browser-based assistive interaction platform for people who cannot reliably use a mouse, touch screen, or physical switch. A standard webcam becomes a hands-free input device: deliberate head movement guides a stabilized pointer, sustained intent builds dwell evidence, and qualified targets activate without a click.

The submission includes guided camera setup, evidence-based calibration, a shared access hub, six practical access modules, system preferences, privacy explanations, presenter telemetry, and a Control Lab for inspecting the interaction pipeline.

## Problem

Conventional interfaces assume precise, repeated hand movement. Basic head-pointer demos often replace the mouse but preserve its hardest requirements: steady aiming, tiny targets, accidental hover activation, and unsafe behavior when tracking disappears. LuminaXR addresses the complete interaction problem, including noisy motion, variable movement range, target ambiguity, fatigue, interruption, and safe recovery.

## Core Innovation

LuminaXR does not treat dwell as a timer. It continuously evaluates four independent conditions: tracking quality, movement stability, target intent, and action availability. Their product becomes an intent qualification score. Dwell evidence grows only while that score is strong, decays when intent becomes uncertain, resets on hard safety failures, and activates exactly once.

This produces a full interaction chain:

```text
Camera -> Pose -> Calibration -> Signal conditioning -> Pointer mapping
       -> Target acquisition -> Stability -> Dwell evidence
       -> Confirmation when required -> Action
```

## Architecture

LuminaXR is a React 18 and TypeScript single-page application built with Vite. `LuminaProvider` owns the shared interaction runtime: camera lifecycle, calibration, preferences, pointer telemetry, target registry, target acquisition, stability estimation, dwell evidence, speech, session metrics, persistence, pause, and confirmation. Feature routes consume the runtime through a typed context API.

```text
Browser camera or Demo input
  -> head-pose tracker
  -> calibrated pointer pipeline
  -> registered target field
  -> recurrent stability estimator
  -> dwell-evidence state machine
  -> semantic DOM activation

React Router
  -> LuminaShell
  -> Status HUD + Lumina cursor + confirmation dialog
  -> Hub + access modules + Settings + Control Lab
```

## Head Tracking

Camera mode uses the proven head-control path from the De-Disabled reference: MediaPipe Tasks Vision Face Landmarker `0.10.3`, a pinned face-landmarker model, and yaw/pitch/roll extraction from the facial transformation matrix. A continuity estimator exposes tracking quality, frames per second, last-seen time, and source resolution. The high-frequency sample is held in a ref while semantic UI telemetry is throttled, avoiding a full React render on every camera frame.

The tracker is isolated from the downstream interaction engine. Model failure can be recovered through Demo Mode without crashing the access modules.

## Calibration

Calibration records real samples; it never invents movement values. Neutral capture collects a timed sample window, rejects low-quality or unstable samples, removes outliers using median absolute deviation, and stores a robust center pose. Four separate captures measure left, right, up, and down capacity using robust directional percentiles. The asymmetric ranges are preserved so a person with unequal movement can reach both sides of the interface comfortably.

Calibration stores only derived numbers and sample metadata in local storage. It does not store images or video.

## Pointer Control

The pointer pipeline follows the reference implementation's direct percentage-space behavior. It subtracts neutral pose, normalizes against the independently measured left/right/up/down ranges, removes neutral jitter, applies a nonlinear response curve, and maps yaw and pitch to an absolute viewport position. Adaptive smoothing releases during long travel and increases near a target. This makes a repeatable head pose correspond to a repeatable screen position instead of requiring continuous velocity steering.

The mathematical pipeline lives in pure functions so calibration, mapping, attraction, and hysteresis behavior can be tested independently of React and the camera.

## Stability-Qualified Dwell

The stability estimator uses a rolling movement window, velocity, variation, direction changes, and tracking quality. Separate enter and exit thresholds provide hysteresis, and a hold interval prevents one unusually still frame from declaring stability.

The dwell engine exposes explicit states: `idle`, `candidate`, `acquired`, `stabilizing`, `dwelling`, `interrupted`, `ready`, `confirming`, `activated`, and `cancelled`. Evidence accumulates in proportion to qualification, decays during soft interruption, and resets when tracking or target validity is lost. Activation is one-shot until the target is released.

## Target Acquisition

Every `AssistiveTarget` registers its geometry and metadata once with the runtime. Rectangles refresh at a controlled rate instead of querying the entire DOM every frame. Candidates are scored from cursor distance, containment, target priority, and attraction strength. Acquisition delay, minimum hold time, and switch margin stop rapid target hopping. Attraction reduces the precision required to settle on large actionable controls.

## Safety Behavior

- Camera permission is requested only after an explicit user action.
- Permission denial, missing hardware, model errors, low confidence, and face loss have distinct states.
- Pointer motion and dwell freeze immediately when tracking is invalid.
- Reacquisition includes a short settling delay before activation is re-enabled.
- Pause blocks ordinary targets while leaving the large Resume target dwell-selectable.
- Consequential civic actions enter a separate confirmation state.
- `Escape` cancels dwell or confirmation, and keyboard access remains available.
- Each route begins unarmed so an untouched pointer cannot activate a control.

## Demo Mode

Demo Mode makes the complete system testable without camera permission. Mouse movement or `Alt` + arrow keys provides the input signal, while target scoring, attraction, stability qualification, evidence accumulation, decay, pause, confirmation, and activation use the same engine as camera mode. Telemetry identifies Demo Mode as simulated input; it is never presented as camera measurement.

## Presenter Mode

Presenter Mode opens a compact live panel showing the current input source, tracking status, interaction state, target, stability, qualification, target score, dwell evidence, and session outcomes. The Control Lab expands this view with pipeline gates, raw and calibrated pose, camera resolution, asymmetric calibration, preferences, and session metrics. Values shown there come from the active runtime; simulated values are labelled as Demo input.

## Access Modules

- **Read:** distraction-free reading, text scaling, line spacing, contrast, paragraph navigation, and speech.
- **Media:** large playback, seek, volume, caption, and fullscreen controls.
- **Communicate:** categorized phrase board, custom phrases, and speech synthesis.
- **My Day:** accessible routine timeline with completion, skip, and reminder actions.
- **Wellbeing:** feeling check-in and clear support actions.
- **Civic Access:** a fictional guided service flow demonstrating deliberate confirmation.

## Installation

Requirements: Node.js 18 or newer and npm.

```sh
npm install
```

## Development

```sh
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

Vite prints the active local URL. Camera access works on `localhost` or another secure context.

## Demo Administration

The `/admin` route provides the administrator entry used in the demonstration. A valid sign-in opens a staged welcome screen before forwarding to the Access Hub. Authentication is intentionally client-side for this prototype and must be replaced with server-side identity management before production use.

## Keyboard Controls

- `Space`: pause or resume LuminaXR
- `H`: open the Access Hub
- `C`: open setup and calibration
- `D`: toggle Presenter Mode
- `P`: open the Control Lab
- `Escape`: cancel dwell or close confirmation
- `Alt` + arrow keys: move the Demo pointer
- `Tab`, `Shift+Tab`, `Enter`: standard keyboard navigation and activation

## Project Structure

```text
src/
  app/                 shared LuminaXR runtime and lifecycle
  components/luminax/  cursor, HUD, shell, targets, camera preview, dialogs
  features/landing/    public product narrative
  features/setup/      permission and robust calibration journey
  features/hub/        access-module launcher and session summary
  features/modules/    reader, media, communication, routines, wellbeing, civic
  features/settings/   preferences, privacy, Presenter Mode, and Control Lab
  hooks/                isolated MediaPipe head tracking
  lib/                  pointer, target, stability, dwell, and motion engines
  test/                 deterministic unit tests for the interaction pipeline
```

## Accessibility

Primary workflows remain operable by keyboard and pointer. The interface uses stable large targets, strong focus treatment, reduced-motion support, optional progress visualizations, high-contrast status feedback, captions, readable presets, local speech output, focus trapping for confirmation, and consistent escape routes. User preferences persist locally.

## Privacy

Camera frames are processed locally in the browser. LuminaXR has no camera upload endpoint and stores no face image, recording, or biometric template. Local storage contains only preferences, derived calibration values, routine state, and saved phrases. MediaPipe runtime and model assets are currently fetched from their hosted distribution on first load. The civic module is a fictional demonstration and does not submit data to a government service.

## Testing

Vitest covers dead-zone behavior, nonlinear response, smoothing, attraction, robust neutral estimation, outlier rejection, asymmetric ranges, reference-style absolute head mapping, target hysteresis, rolling stability hysteresis, tracking-loss reset, pass-through safety, evidence decay, confirmation, and exactly-once activation. TypeScript compilation, ESLint, and the production build are part of the release check.

## Known Browser Limits

- Camera permission and device labels depend on browser security and user consent.
- MediaPipe runtime and model assets require network access on first load in the current build.
- Head-pose quality varies with lighting, occlusion, camera placement, and device performance.
- Speech synthesis voices and fullscreen behavior vary by browser and operating system.
- This prototype controls LuminaXR targets inside its own page; it cannot control browser chrome or unrelated sites.

## Future Browser Extension Architecture

A browser extension can reuse the pure interaction engine while injecting a target adapter into permitted pages. A background service worker would manage consent and per-site policy, a content script would expose semantic target geometry and safe activation, and an isolated local tracking surface would publish only derived pointer intent. Cross-origin frames, protected pages, sensitive actions, and browser UI would remain explicitly gated.

## Future Work

- Self-host and cache MediaPipe assets for offline-first deployment.
- Validate thresholds and target geometry through structured studies with motor-access users.
- Add switch, eye-gaze, and voice input adapters behind the same intent engine.
- Support encrypted preference export, multi-profile calibration, and caregiver-assisted setup.
- Package the target registry and interaction engine as an embeddable accessibility SDK.
- Explore optional on-device personalization while preserving the no-frame-storage boundary.
