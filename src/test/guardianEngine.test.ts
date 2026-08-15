import { describe, expect, it } from "vitest";
import { GuardianEngine, resolveCandidates } from "@/features/guardian/guardianEngine";
import { runPerceptionAgent } from "@/features/guardian/perceptionAgent";
import type { GuardianPerceptionInput, GuardianScenario } from "@/features/guardian/guardianTypes";

function input(scenario: GuardianScenario = "HEALTHY"): GuardianPerceptionInput {
  return {
    mode: "demo",
    status: "demo",
    modelStatus: "tracking",
    faceVisible: true,
    faceBounds: null,
    faceCompleteness: 1,
    trackingQuality: 0.97,
    luminance: 0.56,
    contrast: 0.34,
    darkPixelRatio: 0.12,
    highlightRatio: 0.04,
    cameraAvailable: true,
    scenario,
  };
}

function qualify(engine: GuardianEngine, scenario: GuardianScenario, start = 1000) {
  engine.step({ now: start, perception: input(scenario), poseStability: 0.9, paused: false });
  return engine.step({ now: start + 700, perception: input(scenario), poseStability: 0.9, paused: false });
}

describe("Guardian deterministic agents", () => {
  it("qualifies face loss and engages a protective hold", () => {
    const snapshot = qualify(new GuardianEngine(), "NO_FACE");
    expect(snapshot.incident?.type).toBe("NO_FACE");
    expect(snapshot.phase).toBe("PROTECTIVE_HOLD");
    expect(snapshot.adaptation.dwellSuppressed).toBe(true);
    expect(snapshot.adaptation.pointerMode).toBe("FROZEN");
  });

  it("immediately protects against a live camera failure", () => {
    const engine = new GuardianEngine();
    const cameraFailure = { ...input(), mode: "camera" as const, cameraAvailable: false, faceVisible: false };
    const snapshot = engine.step({ now: 1000, perception: cameraFailure, poseStability: 0.9, paused: false });
    expect(snapshot.incident?.type).toBe("CAMERA_UNAVAILABLE");
    expect(snapshot.adaptation.protectiveHold).toBe(true);
  });

  it.each([
    ["PARTIAL_LEFT", "RIGHT"],
    ["PARTIAL_RIGHT", "LEFT"],
    ["PARTIAL_TOP", "DOWN"],
    ["PARTIAL_BOTTOM", "UP"],
  ] as const)("turns %s into directional guidance", (scenario, direction) => {
    const snapshot = qualify(new GuardianEngine(), scenario);
    expect(snapshot.direction).toBe(direction);
    expect(snapshot.adaptation.pointerMode).toBe("CONSERVATIVE");
    expect(snapshot.adaptation.dwellSuppressed).toBe(true);
  });

  it("coalesces low confidence under severe low light", () => {
    const report = runPerceptionAgent(input("SEVERE_LOW_LIGHT"), 1000);
    const candidates = resolveCandidates(report);
    expect(candidates[0].type).toBe("SEVERE_LOW_LIGHT");
    expect(candidates.map((item) => item.type)).toContain("LOW_CONFIDENCE");
  });

  it("uses bounded adaptive changes for ordinary low light", () => {
    const snapshot = qualify(new GuardianEngine(), "LOW_LIGHT");
    expect(snapshot.incident?.type).toBe("LOW_LIGHT");
    expect(snapshot.adaptation.protectiveHold).toBe(false);
    expect(snapshot.adaptation.dwellSuppressed).toBe(false);
    expect(snapshot.adaptation.pointerMode).toBe("CONSERVATIVE");
    expect(snapshot.adaptation.smoothingDelta).toBeLessThanOrEqual(0.1);
    expect(snapshot.adaptation.stabilityDelta).toBeLessThanOrEqual(0.08);
  });

  it("keeps Safe Pause separate from incident ownership", () => {
    const engine = new GuardianEngine();
    const active = qualify(engine, "NO_FACE");
    const paused = engine.step({ now: 1800, perception: input("NO_FACE"), poseStability: 0.9, paused: true });
    expect(paused.phase).toBe("SAFE_PAUSED");
    expect(paused.incident?.id).toBe(active.incident?.id);
  });

  it("requires a sustained Perception and Safety recovery handshake", () => {
    const engine = new GuardianEngine();
    qualify(engine, "NO_FACE");
    const recovering = engine.step({ now: 1800, perception: input("HEALTHY"), poseStability: 0.9, paused: false });
    expect(recovering.phase).toBe("RECOVERING");
    const premature = engine.step({ now: 2600, perception: input("HEALTHY"), poseStability: 0.9, paused: false });
    expect(premature.incident).not.toBeNull();
    const restored = engine.step({ now: 3200, perception: input("HEALTHY"), poseStability: 0.9, paused: false });
    expect(restored.incident).toBeNull();
    expect(restored.phase).toBe("SUCCESS");
  });

  it("does not flap on a short low-confidence pulse", () => {
    const engine = new GuardianEngine();
    engine.step({ now: 1000, perception: input("LOW_CONFIDENCE"), poseStability: 0.9, paused: false });
    const cleared = engine.step({ now: 1300, perception: input("HEALTHY"), poseStability: 0.9, paused: false });
    expect(cleared.incident).toBeNull();
    expect(cleared.phase).toBe("MONITORING");
  });
});
