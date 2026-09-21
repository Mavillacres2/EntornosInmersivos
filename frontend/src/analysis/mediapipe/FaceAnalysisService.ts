import { FaceLandmarker } from "@mediapipe/tasks-vision";
import type {
  FaceLandmarkerResult,
  NormalizedLandmark
} from "@mediapipe/tasks-vision";

import type { HeadOrientation } from "../types/AnalysisTypes";

const RAD_TO_DEG = 180 / Math.PI;
const DEBUG_FACE_INDICES = [1, 33, 61, 263, 291] as const;
type VisionFileset = Parameters<typeof FaceLandmarker.createFromOptions>[0];

export interface FaceAnalysisFrame {
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
    includeDebugLandmarks = false
  ): FaceAnalysisFrame {
    if (
      !this.landmarker ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return { orientation: null, landmarks: null };
    }

    const monotonicTimestamp = Math.max(timestampMs, this.lastTimestampMs + 0.001);

    this.lastTimestampMs = monotonicTimestamp;
    const result = this.landmarker.detectForVideo(video, monotonicTimestamp);

    return {
      orientation:
        this.readTransformation(result) ?? this.estimateFromLandmarks(result),
      landmarks: includeDebugLandmarks
        ? this.readDebugLandmarks(result)
        : null
    };
  }

  close(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastTimestampMs = -Infinity;
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
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true
    });
  }

  private readTransformation(result: FaceLandmarkerResult): HeadOrientation | null {
    const matrix = result.facialTransformationMatrixes[0];

    if (!matrix || matrix.data.length < 11) {
      return null;
    }

    const values = matrix.data;
    const r00 = values[0] ?? 1;
    const r10 = values[1] ?? 0;
    const r20 = values[2] ?? 0;
    const r21 = values[6] ?? 0;
    const r22 = values[10] ?? 1;

    return {
      yaw: Math.atan2(r10, r00) * RAD_TO_DEG,
      pitch:
        Math.atan2(-r20, Math.sqrt(r00 * r00 + r10 * r10)) * RAD_TO_DEG,
      roll: Math.atan2(r21, r22) * RAD_TO_DEG
    };
  }

  private estimateFromLandmarks(
    result: FaceLandmarkerResult
  ): HeadOrientation | null {
    const landmarks = result.faceLandmarks[0];
    const leftEye = landmarks?.[33];
    const rightEye = landmarks?.[263];
    const nose = landmarks?.[1];

    if (!leftEye || !rightEye || !nose) {
      return null;
    }

    const eyeDistance = distance2d(leftEye, rightEye);

    if (eyeDistance < 0.001) {
      return null;
    }

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeMidY = (leftEye.y + rightEye.y) / 2;

    return {
      yaw: Math.atan2(nose.x - eyeMidX, eyeDistance) * RAD_TO_DEG,
      pitch: Math.atan2(nose.y - eyeMidY, eyeDistance) * RAD_TO_DEG,
      roll: Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * RAD_TO_DEG
    };
  }

  private readDebugLandmarks(
    result: FaceLandmarkerResult
  ): FaceAnalysisFrame["landmarks"] {
    const landmarks = result.faceLandmarks[0];

    if (!landmarks) {
      return null;
    }

    return DEBUG_FACE_INDICES.flatMap((index) => {
      const landmark = landmarks[index];

      return landmark
        ? [{ x: landmark.x, y: landmark.y, z: landmark.z, visibility: 1 }]
        : [];
    });
  }
}

function distance2d(
  first: NormalizedLandmark,
  second: NormalizedLandmark
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
