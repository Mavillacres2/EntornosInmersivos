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
  poseQuality?: FeatureQuality;
  eyes?: EyeMetrics | null;
  blinkEvents?: BlinkEvent[];
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
  hands?: HandDetection[];
  handsUpdated?: boolean;
  poseUpdated?: boolean;
  handsTimestampMs?: number | null;
  handError?: string | null;
  timestampMs: number;
  poseLandmarks: LandmarkPoint[] | null;
  quality: FeatureQuality;
  requiredLandmarksVisible: boolean;
  diagnostics: PoseDetectionDiagnostics;
}

export interface BlinkEvent {
  timestamp: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  eye: "left" | "right" | "both";
}

export interface EyeMetrics {
  timestampMs: number;
  leftOpen: number;
  rightOpen: number;
  leftBlink: boolean;
  rightBlink: boolean;
  blinkCount: number;
  leftBlinkCount: number;
  rightBlinkCount: number;
  blinksPerMinute: number | null;
  averageBlinkDuration: number | null;
  observedMs: number;
}

export interface HandDetection {
  side: "left" | "right";
  // Classification score for handedness, NOT per-landmark confidence.
  handednessConfidence: number;
  landmarks: LandmarkPoint[];
}

export interface HandMetrics {
  side: "left" | "right";
  handednessConfidence: number;
  position: { x: number; y: number };
  speed: number | null;
  travelDistance: number;
  openness: number | null;
}

export interface BodyAxis {
  headCenter: LandmarkPoint | null;
  neckCenter: LandmarkPoint | null;
  torsoCenter: LandmarkPoint | null;
  torsoLateralTiltDegrees: number | null;
}

// Only derived measurements leave the browser. Landmarks remain in memory.
export interface VisionMetrics {
  face: { source: "face-camera"; timestampMs: number; eyes: EyeMetrics | null } | null;
  body: { source: "body-camera"; timestampMs: number;
    poseTimestampMs: number | null; handsTimestampMs: number | null; hands: HandMetrics[];
    torsoLateralTiltDegrees: number | null } | null;
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
