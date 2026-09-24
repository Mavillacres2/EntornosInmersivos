export interface AnalysisConfig {
  apiBaseUrl: string;
  debug: boolean;
  camera: {
    idealWidth: number;
    idealHeight: number;
    idealFrameRate: number;
  };
  mediaPipe: {
    handModelUrl?: string;
    wasmBaseUrl: string;
    faceModelUrl: string;
    upperPoseModelUrl: string;
    fullBodyPoseModelUrl: string;
    upperAnalysisFps: number;
    fullBodyAnalysisFps: number;
    minimumVisibility: number;
  };
  calibrationDurationMs: number;
  storageSampleFps: number;
  batchIntervalMs: number;
  batchSize: number;
  maxBufferedSamples: number;
  maxBufferedEvents: number;
  experimentalThresholds: {
    orientationDeviationDegrees: number;
    headTurnDegrees: number;
    postureChangeNormalized: number;
    largeMovementNormalized: number;
  };
}

function readNumber(name: string, fallback: number): number {
  const value = Number(import.meta.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const ANALYSIS_CONFIG: AnalysisConfig = {
  apiBaseUrl: import.meta.env.VITE_ANALYSIS_API_URL ?? "http://localhost:3001/api",
  debug: (import.meta.env.VITE_ANALYSIS_DEBUG ?? "false") === "true",
  camera: {
    idealWidth: readNumber("VITE_CAMERA_IDEAL_WIDTH", 640),
    idealHeight: readNumber("VITE_CAMERA_IDEAL_HEIGHT", 480),
    idealFrameRate: readNumber("VITE_CAMERA_IDEAL_FPS", 24)
  },
  mediaPipe: {
    handModelUrl: import.meta.env.VITE_MEDIAPIPE_HAND_MODEL_URL ??
      "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    wasmBaseUrl:
      import.meta.env.VITE_MEDIAPIPE_WASM_URL ??
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
    faceModelUrl:
      import.meta.env.VITE_MEDIAPIPE_FACE_MODEL_URL ??
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    upperPoseModelUrl:
      import.meta.env.VITE_MEDIAPIPE_UPPER_POSE_MODEL_URL ??
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    fullBodyPoseModelUrl:
      import.meta.env.VITE_MEDIAPIPE_FULL_POSE_MODEL_URL ??
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    upperAnalysisFps: readNumber("VITE_UPPER_ANALYSIS_FPS", 8),
    fullBodyAnalysisFps: readNumber("VITE_FULL_BODY_ANALYSIS_FPS", 4),
    minimumVisibility: readNumber("VITE_LANDMARK_MIN_VISIBILITY", 0.55)
  },
  calibrationDurationMs: readNumber("VITE_CALIBRATION_DURATION_MS", 3000),
  storageSampleFps: readNumber("VITE_STORAGE_SAMPLE_FPS", 5),
  batchIntervalMs: readNumber("VITE_ANALYSIS_BATCH_INTERVAL_MS", 3000),
  batchSize: readNumber("VITE_ANALYSIS_BATCH_SIZE", 50),
  maxBufferedSamples: readNumber("VITE_MAX_BUFFERED_SAMPLES", 1500),
  maxBufferedEvents: readNumber("VITE_MAX_BUFFERED_EVENTS", 500),
  experimentalThresholds: {
    orientationDeviationDegrees: readNumber(
      "VITE_ORIENTATION_DEVIATION_DEGREES",
      18
    ),
    headTurnDegrees: readNumber("VITE_HEAD_TURN_DEGREES", 25),
    postureChangeNormalized: readNumber(
      "VITE_POSTURE_CHANGE_NORMALIZED",
      0.12
    ),
    largeMovementNormalized: readNumber(
      "VITE_LARGE_MOVEMENT_NORMALIZED",
      0.18
    )
  }
};

// Experimental measurement settings, not clinical cutoffs.
export const VISION_CONFIG = {
  faceConfidence: 0.55,
  poseConfidence: 0.55,
  handConfidence: 0.6,
  handednessConfidence: 0.7,
  blinkCloseThreshold: 0.55,
  blinkOpenThreshold: 0.3,
  blinkMinDurationMs: 60,
  blinkMaxDurationMs: 600,
  blinkMaxSampleGapMs: 180,
  blinkMaxAbsYaw: 40,
  blinkMaxAbsPitch: 35,
  detectionTimeoutMs: 750,
  orientationSmoothing: 0.6,
  orientationDeadbandDegrees: 0.35
} as const;
