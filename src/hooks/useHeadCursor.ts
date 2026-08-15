import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaceMotionLstm,
  IDLE_FACE_MOTION,
  type FaceMotionSnapshot,
  type PoseAngles,
} from "@/lib/faceMotionLstm";
import { poseFromTransformationMatrix } from "@/lib/headPose";

export type HeadTrackingModelStatus =
  | "idle"
  | "initializing"
  | "searching"
  | "tracking"
  | "face-lost"
  | "error";

export type HeadTrackingSnapshot = {
  isTracking: boolean;
  pose: PoseAngles | null;
  fps: number;
  motion: FaceMotionSnapshot;
  trackingQuality: number;
  lastSeenAt: number;
  modelStatus: HeadTrackingModelStatus;
  cameraResolution: { width: number; height: number } | null;
  faceBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  } | null;
  faceCompleteness: number;
  luminance: number;
  contrast: number;
  darkPixelRatio: number;
  highlightRatio: number;
  error: string | null;
};

type FaceLandmark = { x: number; y: number; z?: number };

type DetectResult = {
  facialTransformationMatrixes?: Array<{ data: ArrayLike<number> }>;
  faceLandmarks?: FaceLandmark[][];
};

type FaceLandmarkerInstance = {
  detectForVideo: (video: HTMLVideoElement, nowMs: number) => DetectResult;
  close?: () => void;
};

type TasksVisionModule = {
  FaceLandmarker: {
    createFromOptions: (fileset: unknown, options: unknown) => Promise<FaceLandmarkerInstance>;
  };
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
};

const INITIAL_SNAPSHOT: HeadTrackingSnapshot = {
  isTracking: false,
  pose: null,
  fps: 0,
  motion: IDLE_FACE_MOTION,
  trackingQuality: 0,
  lastSeenAt: 0,
  modelStatus: "idle",
  cameraResolution: null,
  faceBounds: null,
  faceCompleteness: 0,
  luminance: 0.5,
  contrast: 0.3,
  darkPixelRatio: 0,
  highlightRatio: 0,
  error: null,
};

type LightingMetrics = Pick<HeadTrackingSnapshot, "luminance" | "contrast" | "darkPixelRatio" | "highlightRatio">;

function measureFaceBounds(points: FaceLandmark[]) {
  const finite = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!finite.length) return { bounds: null, completeness: 0 };
  const xs = finite.map((point) => point.x);
  const ys = finite.map((point) => point.y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const inFrameRatio = finite.filter((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1).length / finite.length;
  const nearestEdge = Math.min(left, 1 - right, top, 1 - bottom);
  const edgeFactor = nearestEdge <= 0.01 ? 0.68 : nearestEdge <= 0.025 ? 0.78 : 1;
  return {
    bounds: {
      left,
      right,
      top,
      bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2,
    },
    completeness: Math.max(0, Math.min(1, inFrameRatio * edgeFactor)),
  };
}

function measureLighting(video: HTMLVideoElement, canvas: HTMLCanvasElement): LightingMetrics | null {
  const width = 64;
  const height = 36;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(video, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    let sum = 0;
    let squared = 0;
    let dark = 0;
    let highlight = 0;
    const count = width * height;
    for (let index = 0; index < pixels.length; index += 4) {
      const value = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
      sum += value;
      squared += value * value;
      if (value < 45) dark += 1;
      if (value > 235) highlight += 1;
    }
    const mean = sum / count;
    const variance = Math.max(0, squared / count - mean * mean);
    return {
      luminance: mean / 255,
      contrast: Math.min(1, Math.sqrt(variance) / 128),
      darkPixelRatio: dark / count,
      highlightRatio: highlight / count,
    };
  } catch {
    return null;
  }
}

export function useHeadCursor(videoRef: React.RefObject<HTMLVideoElement>, isActive: boolean) {
  const [state, setState] = useState<HeadTrackingSnapshot>(INITIAL_SNAPSHOT);
  const snapshotRef = useRef<HeadTrackingSnapshot>(INITIAL_SNAPSHOT);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const runningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastPublishedRef = useRef(0);
  const detectionWindowRef = useRef<boolean[]>([]);
  const fpsRef = useRef({ t: performance.now(), frames: 0, fps: 0 });
  const motionRef = useRef(new FaceMotionLstm());
  const lightingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastLightingSampleRef = useRef(0);
  const lightingRef = useRef<LightingMetrics>({ luminance: 0.5, contrast: 0.3, darkPixelRatio: 0, highlightRatio: 0 });

  const publish = useCallback((next: HeadTrackingSnapshot, force = false) => {
    snapshotRef.current = next;
    const now = performance.now();
    if (force || now - lastPublishedRef.current >= 110) {
      lastPublishedRef.current = now;
      setState(next);
    }
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastVideoTimeRef.current = -1;
    detectionWindowRef.current = [];
    fpsRef.current = { t: performance.now(), frames: 0, fps: 0 };
    motionRef.current.reset();
    lastLightingSampleRef.current = 0;
    try {
      landmarkerRef.current?.close?.();
    } catch {
      // MediaPipe teardown can race with an animation frame.
    }
    landmarkerRef.current = null;
    publish({ ...INITIAL_SNAPSHOT }, true);
  }, [publish]);

  const start = useCallback(async () => {
    if (!videoRef.current || runningRef.current) return;
    runningRef.current = true;
    motionRef.current.reset();
    fpsRef.current = { t: performance.now(), frames: 0, fps: 0 };
    publish({ ...INITIAL_SNAPSHOT, modelStatus: "initializing" }, true);

    const visionUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
    const vision = await import(/* @vite-ignore */ visionUrl);
    if (!runningRef.current) return;

    const resolvedVision =
      (vision as { default?: TasksVisionModule }).default ?? (vision as unknown as TasksVisionModule);
    const fileset = await resolvedVision.FilesetResolver.forVisionTasks(`${visionUrl}/wasm`);
    if (!runningRef.current) return;

    landmarkerRef.current = await resolvedVision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      runningMode: "VIDEO",
      numFaces: 1,
    });
    publish({ ...snapshotRef.current, modelStatus: "searching", error: null }, true);

    const loop = () => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
        lastVideoTimeRef.current = video.currentTime;
        const now = performance.now();
        const result = landmarker.detectForVideo(video, now);
        const matrixData = result.facialTransformationMatrixes?.[0]?.data;
        const landmarks = result.faceLandmarks?.[0] ?? [];
        const detected = Boolean(matrixData?.length === 16);
        const measuredFace = detected ? measureFaceBounds(landmarks) : { bounds: null, completeness: 0 };
        const detectionWindow = detectionWindowRef.current;
        detectionWindow.push(detected);
        if (detectionWindow.length > 24) detectionWindow.shift();
        const trackingQuality = detectionWindow.filter(Boolean).length / Math.max(1, detectionWindow.length);
        const resolution = video.videoWidth && video.videoHeight
          ? { width: video.videoWidth, height: video.videoHeight }
          : snapshotRef.current.cameraResolution;

        if (now - lastLightingSampleRef.current >= 280) {
          lastLightingSampleRef.current = now;
          lightingCanvasRef.current ??= document.createElement("canvas");
          const measured = measureLighting(video, lightingCanvasRef.current);
          if (measured) {
            const previous = lightingRef.current;
            const alpha = 0.22;
            lightingRef.current = {
              luminance: previous.luminance + (measured.luminance - previous.luminance) * alpha,
              contrast: previous.contrast + (measured.contrast - previous.contrast) * alpha,
              darkPixelRatio: previous.darkPixelRatio + (measured.darkPixelRatio - previous.darkPixelRatio) * alpha,
              highlightRatio: previous.highlightRatio + (measured.highlightRatio - previous.highlightRatio) * alpha,
            };
          }
        }

        fpsRef.current.frames += 1;
        const elapsed = now - fpsRef.current.t;
        if (elapsed > 500) {
          fpsRef.current.fps = Math.round((fpsRef.current.frames * 1000) / elapsed);
          fpsRef.current.frames = 0;
          fpsRef.current.t = now;
        }

        if (detected && matrixData) {
          const pose = poseFromTransformationMatrix(matrixData);
          const motion = motionRef.current.step(pose, now);
          publish({
            isTracking: true,
            pose,
            fps: fpsRef.current.fps,
            motion,
            trackingQuality,
            lastSeenAt: now,
            modelStatus: "tracking",
            cameraResolution: resolution,
            faceBounds: measuredFace.bounds,
            faceCompleteness: measuredFace.completeness,
            ...lightingRef.current,
            error: null,
          });
        } else {
          const previous = snapshotRef.current;
          const faceLost = previous.lastSeenAt > 0 && now - previous.lastSeenAt > 220;
          if (faceLost) motionRef.current.reset();
          publish({
            ...previous,
            isTracking: faceLost ? false : previous.isTracking,
            trackingQuality,
            fps: fpsRef.current.fps,
            modelStatus: faceLost ? "face-lost" : "searching",
            cameraResolution: resolution,
            faceBounds: faceLost ? null : previous.faceBounds,
            faceCompleteness: faceLost ? 0 : previous.faceCompleteness,
            ...lightingRef.current,
          }, faceLost && previous.isTracking);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [publish, videoRef]);

  useEffect(() => {
    if (isActive) {
      start().catch((error: unknown) => {
        stop();
        const message = error instanceof Error ? error.message : "Head tracking could not initialize.";
        publish({ ...INITIAL_SNAPSHOT, modelStatus: "error", error: message }, true);
      });
    } else {
      stop();
    }
    return () => stop();
  }, [isActive, publish, start, stop]);

  return { ...state, getSnapshot, stop };
}
