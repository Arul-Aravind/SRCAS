import { clamp } from "@/lib/controlPipeline";
import { ADAPTIVE_CONFIG } from "./guardianConfig";
import type {
  FaceBounds,
  GuardianDirection,
  GuardianPerceptionInput,
  GuardianScenario,
  LightingQuality,
  PerceptionReport,
} from "./guardianTypes";

const SIMULATED_BOUNDS: FaceBounds = {
  left: 0.32,
  right: 0.68,
  top: 0.18,
  bottom: 0.82,
  width: 0.36,
  height: 0.64,
  centerX: 0.5,
  centerY: 0.5,
};

function simulatedInput(input: GuardianPerceptionInput, scenario: GuardianScenario): GuardianPerceptionInput {
  const base = {
    ...input,
    faceVisible: true,
    faceBounds: SIMULATED_BOUNDS,
    faceCompleteness: 0.98,
    trackingQuality: 0.96,
    luminance: 0.56,
    contrast: 0.34,
    darkPixelRatio: 0.12,
    highlightRatio: 0.04,
    cameraAvailable: true,
  };

  switch (scenario) {
    case "NO_FACE":
      return { ...base, faceVisible: false, faceBounds: null, faceCompleteness: 0, trackingQuality: 0 };
    case "PARTIAL_LEFT":
      return { ...base, faceBounds: { ...SIMULATED_BOUNDS, left: 0.004, right: 0.42, centerX: 0.212, width: 0.416 }, faceCompleteness: 0.7 };
    case "PARTIAL_RIGHT":
      return { ...base, faceBounds: { ...SIMULATED_BOUNDS, left: 0.58, right: 0.996, centerX: 0.788, width: 0.416 }, faceCompleteness: 0.7 };
    case "PARTIAL_TOP":
      return { ...base, faceBounds: { ...SIMULATED_BOUNDS, top: 0.004, bottom: 0.66, centerY: 0.332, height: 0.656 }, faceCompleteness: 0.7 };
    case "PARTIAL_BOTTOM":
      return { ...base, faceBounds: { ...SIMULATED_BOUNDS, top: 0.34, bottom: 0.996, centerY: 0.668, height: 0.656 }, faceCompleteness: 0.7 };
    case "LOW_LIGHT":
      return { ...base, luminance: 0.22, contrast: 0.18, darkPixelRatio: 0.66, trackingQuality: 0.73 };
    case "SEVERE_LOW_LIGHT":
      return { ...base, luminance: 0.08, contrast: 0.08, darkPixelRatio: 0.88, trackingQuality: 0.34 };
    case "LOW_CONFIDENCE":
      return { ...base, trackingQuality: 0.39 };
    case "PROTECTIVE_HOLD":
      return { ...base, trackingQuality: 0.2 };
    case "RECOVERING":
    case "HEALTHY":
      return base;
  }
}

function classifyLighting(luminance: number, contrast: number, darkPixelRatio: number): LightingQuality {
  if (
    luminance <= ADAPTIVE_CONFIG.severeLuminance
    || darkPixelRatio >= ADAPTIVE_CONFIG.severeDarkPixelRatio
  ) return "SEVERE";
  if (
    luminance <= ADAPTIVE_CONFIG.poorLuminance
    || darkPixelRatio >= ADAPTIVE_CONFIG.poorDarkPixelRatio
    || contrast <= ADAPTIVE_CONFIG.minimumContrast
  ) return "POOR";
  return "GOOD";
}

function findPartialDirection(bounds: FaceBounds | null, completeness: number): GuardianDirection | null {
  if (!bounds || completeness >= ADAPTIVE_CONFIG.partialCompleteness) return null;
  const margins = [
    { edge: bounds.left, direction: "RIGHT" as const },
    { edge: 1 - bounds.right, direction: "LEFT" as const },
    { edge: bounds.top, direction: "DOWN" as const },
    { edge: 1 - bounds.bottom, direction: "UP" as const },
  ];
  margins.sort((a, b) => a.edge - b.edge);
  if (margins[0].edge <= ADAPTIVE_CONFIG.partialEdgeMargin) return margins[0].direction;

  const xOffset = bounds.centerX - 0.5;
  const yOffset = bounds.centerY - 0.5;
  if (Math.abs(xOffset) >= Math.abs(yOffset)) return xOffset < 0 ? "RIGHT" : "LEFT";
  return yOffset < 0 ? "DOWN" : "UP";
}

export function runPerceptionAgent(raw: GuardianPerceptionInput, now: number): PerceptionReport {
  const input = raw.mode === "demo" ? simulatedInput(raw, raw.scenario) : raw;
  const faceBounds = input.faceBounds;
  const partialDirection = input.faceVisible
    ? findPartialDirection(faceBounds, input.faceCompleteness)
    : null;
  const xOffset = faceBounds ? Math.abs(faceBounds.centerX - 0.5) : 1;
  const yOffset = faceBounds ? Math.abs(faceBounds.centerY - 0.5) : 1;

  return {
    timestamp: now,
    source: input.mode === "demo" ? "DEMO" : "CAMERA",
    scenario: input.scenario,
    cameraAvailable: input.mode === "demo" || input.cameraAvailable,
    faceVisible: input.faceVisible,
    faceBounds,
    faceCompleteness: clamp(input.faceCompleteness, 0, 1),
    faceCentered: input.faceVisible
      && !partialDirection
      && xOffset <= ADAPTIVE_CONFIG.centeredTolerance
      && yOffset <= ADAPTIVE_CONFIG.centeredTolerance,
    partialDirection,
    trackingQuality: clamp(input.trackingQuality, 0, 1),
    luminance: clamp(input.luminance, 0, 1),
    contrast: clamp(input.contrast, 0, 1),
    darkPixelRatio: clamp(input.darkPixelRatio, 0, 1),
    highlightRatio: clamp(input.highlightRatio, 0, 1),
    lighting: classifyLighting(input.luminance, input.contrast, input.darkPixelRatio),
  };
}

