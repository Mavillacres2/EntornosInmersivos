import { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

import type {
  FeatureQuality,
  LandmarkPoint,
  PoseDetectionDiagnostics
} from "../types/AnalysisTypes";

export interface PoseAnalysisResult {
  landmarks: LandmarkPoint[] | null;
  quality: FeatureQuality;
  requiredLandmarksVisible: boolean;
  diagnostics: PoseDetectionDiagnostics;
}

export const POSE_LANDMARK = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32
} as const;

type VisionFileset = Parameters<typeof PoseLandmarker.createFromOptions>[0];

export class PoseAnalysisService {
  private landmarker: PoseLandmarker | null = null;
  private lastTimestampMs = -Infinity;
  private readonly minimumVisibility: number;
  private readonly requiredIndices: number[];

  constructor(minimumVisibility: number, requiredIndices: number[]) {
    this.minimumVisibility = minimumVisibility;
    this.requiredIndices = requiredIndices;
  }

  async initialize(fileset: VisionFileset, modelUrl: string): Promise<void> {
    this.close();

    try {
      this.landmarker = await this.createLandmarker(fileset, modelUrl, "GPU");
    } catch (gpuError) {
      console.warn("Pose Landmarker no pudo usar GPU; se utilizara CPU.", gpuError);
      this.landmarker = await this.createLandmarker(fileset, modelUrl, "CPU");
    }
  }

  analyze(video: HTMLVideoElement, timestampMs: number): PoseAnalysisResult {
    if (!this.landmarker) {
      return unavailablePose("Pose Landmarker no inicializado.");
    }

    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth <= 0 ||
      video.videoHeight <= 0
    ) {
      return unavailablePose();
    }

    const monotonicTimestamp = Math.max(timestampMs, this.lastTimestampMs + 0.001);

    this.lastTimestampMs = monotonicTimestamp;

    try {
      const result = this.landmarker.detectForVideo(video, monotonicTimestamp);
      const landmarks = result.landmarks[0];

      if (!landmarks) {
        return unavailablePose(null, true, monotonicTimestamp);
      }

      const visibleCount = this.requiredIndices.filter((index) =>
        this.isVisible(landmarks[index])
      ).length;
      const ratio = visibleCount / this.requiredIndices.length;
      const mappedLandmarks = landmarks.map((landmark) => ({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
        visibility: finiteVisibility(landmark.visibility)
      }));

      return {
        landmarks: mappedLandmarks,
        quality: ratio >= 0.85 ? "good" : ratio >= 0.6 ? "fair" : "low",
        requiredLandmarksVisible: ratio >= 0.6,
        diagnostics: {
          detectionAttempted: true,
          poseDetected: true,
          landmarkCount: mappedLandmarks.length,
          averageVisibility: averageVisibility(mappedLandmarks),
          detectionTimestampMs: monotonicTimestamp,
          error: null
        }
      };
    } catch (error) {
      return unavailablePose(
        error instanceof Error ? error.message : "Fallo detectForVideo.",
        true,
        monotonicTimestamp
      );
    }
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
  ): Promise<PoseLandmarker> {
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: modelUrl,
        delegate
      },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false
    });
  }

  private isVisible(landmark: NormalizedLandmark | undefined): boolean {
    return Boolean(
      landmark && finiteVisibility(landmark.visibility) >= this.minimumVisibility
    );
  }
}

function finiteVisibility(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function unavailablePose(
  error: string | null = null,
  detectionAttempted = false,
  detectionTimestampMs: number | null = null
): PoseAnalysisResult {
  return {
    landmarks: null,
    quality: "unavailable",
    requiredLandmarksVisible: false,
    diagnostics: {
      detectionAttempted,
      poseDetected: false,
      landmarkCount: 0,
      averageVisibility: null,
      detectionTimestampMs,
      error
    }
  };
}

function averageVisibility(landmarks: LandmarkPoint[]): number | null {
  if (landmarks.length === 0) {
    return null;
  }

  return (
    landmarks.reduce((total, landmark) => total + landmark.visibility, 0) /
    landmarks.length
  );
}
