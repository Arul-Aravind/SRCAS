import { describe, expect, it } from "vitest";
import { DwellEvidenceEngine } from "@/lib/dwellEngine";
import { StabilityEstimator } from "@/lib/stabilityEngine";

const dwellInput = (now: number, patch: Partial<Parameters<DwellEvidenceEngine["step"]>[0]> = {}) => ({
  now,
  targetId: "read",
  targetLabel: "Read",
  acquiredAt: 0,
  durationMs: 800,
  trackingQuality: 1,
  stabilityQuality: 1,
  targetQuality: 1,
  systemAvailability: 1,
  stableSignal: true,
  decay: "decay" as const,
  majorInvalidation: false,
  confirmationStage: false,
  ...patch,
});

describe("StabilityEstimator", () => {
  it("uses a rolling window and hysteresis before declaring stability", () => {
    const estimator = new StabilityEstimator();
    let snapshot = estimator.step({ timestamp: 0, velocity: 900, velocityX: 900, velocityY: 0, trackingQuality: 1 });
    for (let index = 1; index < 8; index += 1) {
      snapshot = estimator.step({ timestamp: index * 33, velocity: 900, velocityX: index % 2 ? -900 : 900, velocityY: 0, trackingQuality: 1 });
    }
    expect(snapshot.stable).toBe(false);

    for (let index = 8; index < 30; index += 1) {
      snapshot = estimator.step({ timestamp: index * 33, velocity: 3, velocityX: 2, velocityY: 1, trackingQuality: 1 });
    }
    expect(snapshot.score).toBeGreaterThan(0.78);
    expect(snapshot.stable).toBe(true);
  });

  it("drops stability immediately when tracking becomes unavailable", () => {
    const estimator = new StabilityEstimator();
    for (let index = 0; index < 16; index += 1) estimator.step({ timestamp: index * 33, velocity: 1, velocityX: 1, velocityY: 0, trackingQuality: 1 });
    const lost = estimator.step({ timestamp: 600, velocity: 0, velocityX: 0, velocityY: 0, trackingQuality: 0 });
    expect(lost.stable).toBe(false);
    expect(lost.score).toBe(0);
  });
});

describe("DwellEvidenceEngine", () => {
  it("does not activate during a brief pass through a target", () => {
    const engine = new DwellEvidenceEngine();
    for (let now = 0; now <= 240; now += 40) engine.step(dwellInput(now));
    const exited = engine.step(dwellInput(280, { targetId: null, targetLabel: null }));
    expect(exited.activated).toBe(false);
    expect(exited.progress).toBe(0);
  });

  it("accumulates qualified evidence and activates exactly once", () => {
    const engine = new DwellEvidenceEngine();
    let activations = 0;
    let last = engine.step(dwellInput(0));
    for (let now = 40; now <= 1600; now += 40) {
      last = engine.step(dwellInput(now));
      if (last.activated) activations += 1;
    }
    expect(activations).toBe(1);
    expect(last.state).toBe("activated");
  });

  it("decays through small instability and resets on major invalidation", () => {
    const engine = new DwellEvidenceEngine();
    let snapshot = engine.step(dwellInput(0));
    for (let now = 40; now <= 520; now += 40) snapshot = engine.step(dwellInput(now));
    const evidenceBefore = snapshot.evidenceMs;
    const interrupted = engine.step(dwellInput(580, { stableSignal: false, stabilityQuality: 0.35 }));
    expect(interrupted.evidenceMs).toBeLessThanOrEqual(evidenceBefore);
    const lost = engine.step(dwellInput(640, { majorInvalidation: true, trackingQuality: 0 }));
    expect(lost.state).toBe("cancelled");
    expect(lost.evidenceMs).toBe(0);
  });

  it("reports cancellation once, then remains visually idle while invalidation continues", () => {
    const engine = new DwellEvidenceEngine();
    engine.step(dwellInput(0));
    const cancelled = engine.step(dwellInput(80, { majorInvalidation: true, trackingQuality: 0 }));
    const safelyIdle = engine.step(dwellInput(120, { majorInvalidation: true, trackingQuality: 0 }));
    expect(cancelled.state).toBe("cancelled");
    expect(safelyIdle.state).toBe("idle");
    expect(safelyIdle.activated).toBe(false);
  });

  it("uses a visibly distinct confirmation state", () => {
    const engine = new DwellEvidenceEngine();
    let snapshot = engine.step(dwellInput(0, { confirmationStage: true }));
    for (let now = 40; now <= 320; now += 40) snapshot = engine.step(dwellInput(now, { confirmationStage: true }));
    expect(snapshot.state).toBe("confirming");
  });
});
