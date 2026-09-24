import { FaceLandmarker } from "@mediapipe/tasks-vision";
import type {
  FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

import { VISION_CONFIG } from "../config/AnalysisConfig";
import { BlinkFeatureExtractor } from "../features/BlinkFeatureExtractor";
import { headOrientationFromMatrix } from "../features/VisionGeometry";
import type { EyeMetrics, BlinkEvent } from "../types/AnalysisTypes";
import type { HeadOrientation } from "../types/AnalysisTypes";

type VisionFileset = Parameters<typeof FaceLandmarker.createFromOptions>[0];

export interface FaceAnalysisFrame {
  eyes?: EyeMetrics | null;
  blinkEvents?: BlinkEvent[];
  orientation: HeadOrientation | null;
  landmarks: Array<{
    x: number;
    y: number;
    z: number;
    visibility: number;
  }> | null;
}

export class FaceAnalysisService {
  private landmarker: FaceLandmarker | null = null;
  private lastTimestampMs = -Infinity;
  private readonly blink = new BlinkFeatureExtractor();
  private smoothed: HeadOrientation | null = null;
  private lastVideoTime = -1;

  async initialize(fileset: VisionFileset, modelUrl: string): Promise<void> {
    this.close();

    try {
      this.landmarker = await this.createLandmarker(fileset, modelUrl, "GPU");
    } catch (gpuError) {
      console.warn("Face Landmarker no pudo usar GPU; se utilizara CPU.", gpuError);
      this.landmarker = await this.createLandmarker(fileset, modelUrl, "CPU");
    }
  }

  analyze(
    video: HTMLVideoElement,
    timestampMs: number,
    _includeDebugLandmarks = false
  ): FaceAnalysisFrame {
    if (
      !this.landmarker ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return this.unavailable();
    }

    const monotonicTimestamp = Math.max(timestampMs, this.lastTimestampMs + 0.001);

    this.lastTimestampMs = monotonicTimestamp;
    if (video.currentTime === this.lastVideoTime) return this.unavailable();
    this.lastVideoTime = video.currentTime;
    try {
      const result = this.landmarker.detectForVideo(video, monotonicTimestamp);
      const raw = result.faceLandmarks[0];
      if (!raw?.length || raw.some(p => ![p.x, p.y, p.z].every(Number.isFinite))) return this.unavailable();
      const orientation = this.readTransformation(result);
      if (orientation) {
        for (const axis of ["yaw", "pitch", "roll"] as const) {
          const previous = this.smoothed?.[axis];
          if (previous !== undefined) {
            const delta = ((orientation[axis] - previous + 540) % 360) - 180;
            orientation[axis] = previous + (Math.abs(delta) < VISION_CONFIG.orientationDeadbandDegrees
              ? 0 : VISION_CONFIG.orientationSmoothing * delta);
          }
        }
      }
      this.smoothed = orientation;
      const categories = result.faceBlendshapes[0]?.categories ?? [];
      const score = (name: string) => categories.find(c => c.categoryName === name)?.score ?? null;
      // Require eye contours inside the image; blendshape scores are not confidence.
      const eyesVisible = orientation !== null &&
        Math.abs(orientation.yaw) <= VISION_CONFIG.blinkMaxAbsYaw &&
        Math.abs(orientation.pitch) <= VISION_CONFIG.blinkMaxAbsPitch &&
        [33, 133, 159, 145, 263, 362, 386, 374].every(i => {
        const p = raw[i]; return p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
      });
      const blink = this.blink.extract(eyesVisible ? score("eyeBlinkLeft") : null,
        eyesVisible ? score("eyeBlinkRight") : null, timestampMs);
      return { orientation, landmarks: raw.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: 1 })),
        eyes: blink.eyes, blinkEvents: blink.events };
    } catch (error) {
      console.warn("No se pudo analizar el rostro.", error);
      return this.unavailable();
    }
  }

  resetTracking(resetMetrics = true): void {
    if (resetMetrics) this.blink.reset();
    else this.blink.markUnavailable();
    this.smoothed = null;
    this.lastVideoTime = -1;
  }

  private unavailable(): FaceAnalysisFrame {
    this.blink.markUnavailable();
    this.smoothed = null;
    return { orientation: null, landmarks: null, eyes: null, blinkEvents: [] };
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastTimestampMs = -Infinity;
    this.resetTracking();
  }

  private createLandmarker(
    fileset: VisionFileset,
    modelUrl: string,
    delegate: "GPU" | "CPU"
  ): Promise<FaceLandmarker> {
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate
      },
      runningMode: "VIDEO",
      numFaces: 1,
      minFaceDetectionConfidence: VISION_CONFIG.faceConfidence,
      minFacePresenceConfidence: VISION_CONFIG.faceConfidence,
      minTrackingConfidence: VISION_CONFIG.faceConfidence,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true
    });
  }

  private readTransformation(result: FaceLandmarkerResult): HeadOrientation | null {
    const matrix = result.facialTransformationMatrixes[0];
    return matrix ? headOrientationFromMatrix(matrix.data) : null;
  }
}
