export type AnalysisSystemState =
  | "idle"
  | "requesting-permission"
  | "configuring-cameras"
  | "calibrating"
  | "ready"
  | "analyzing"
  | "paused"
  | "stopping"
  | "finished"
  | "error";

export type FeatureQuality = "good" | "fair" | "low" | "unavailable";

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseDetectionDiagnostics {
  detectionAttempted: boolean;
  poseDetected: boolean;
  landmarkCount: number;
  averageVisibility: number | null;
  detectionTimestampMs: number | null;
  error: string | null;
}

export interface HeadOrientation {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface UpperBodyAnalysisFrame {
  timestampMs: number;
  headOrientation: HeadOrientation | null;
  faceLandmarks: LandmarkPoint[] | null;
  faceDetected: boolean;
  faceUpdated: boolean;
  poseLandmarks: LandmarkPoint[] | null;
  poseUpdated: boolean;
  quality: FeatureQuality;
}

export interface FullBodyAnalysisFrame {
  timestampMs: number;
  poseLandmarks: LandmarkPoint[] | null;
  quality: FeatureQuality;
  requiredLandmarksVisible: boolean;
  diagnostics: PoseDetectionDiagnostics;
}

export interface HeadCalibration {
  baselineYaw: number;
  baselinePitch: number;
  baselineRoll: number;
  sampleCount: number;
  calibratedAt: string;
}

export interface CameraPositionQuality {
  adequate: boolean;
  message: string;
  quality: FeatureQuality;
}

export interface AnalysisPerformanceSnapshot {
  upperAnalysisFps: number;
  fullBodyAnalysisFps: number;
  renderFps: number | null;
}
