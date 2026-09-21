import type { FeatureQuality } from "./AnalysisTypes";

export interface HeadBehaviorFeatures {
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
  movementMagnitude: number | null;
  movementVelocity: number | null;
  movementVariability: number | null;
  headTurnCount: number;
  orientationDeviation: number | null;
  offTaskEpisodeCount: number;
  totalOffTaskTimeMs: number;
  meanOffTaskDurationMs: number | null;
  maxOffTaskDurationMs: number | null;
  returnToTaskLatencyMs: number | null;
  onTaskOrientation: boolean | null;
  available: boolean;
  quality: FeatureQuality;
}

export interface TrunkBehaviorFeatures {
  leanX: number | null;
  leanY: number | null;
  movementMagnitude: number | null;
  movementVelocity: number | null;
  movementVariability: number | null;
  postureChangeCount: number;
  lateralMovement: number | null;
  forwardBackwardMovement: number | null;
  upperBodyStability: number | null;
  available: boolean;
  quality: FeatureQuality;
}

export interface FullBodyBehaviorFeatures {
  upperBodyMovement: number | null;
  leftArmMovement: number | null;
  rightArmMovement: number | null;
  pelvisMovement: number | null;
  leftLegMovement: number | null;
  rightLegMovement: number | null;
  leftKneeMovement: number | null;
  rightKneeMovement: number | null;
  leftFootMovement: number | null;
  rightFootMovement: number | null;
  lowerBodyMovement: number | null;
  globalMotorActivity: number | null;
  movementVariability: number | null;
  largeMovementEpisodeCount: number;
  available: boolean;
  quality: FeatureQuality;
}

export interface MovementBehaviorFeatures {
  magnitude: number | null;
  velocity: number | null;
  frequency: number | null;
  variability: number | null;
  episodeCount: number;
  taskRelevantMovement: number | null;
  taskIrrelevantMovement: number | null;
  available: boolean;
}

export interface ActivityContext {
  sessionId: string;
  scenarioId: string | null;
  activityId: string | null;
  activityState: string | null;
  blockNumber: number | null;
  condition: string | null;
  trialNumber: number | null;
  globalTrialNumber: number | null;
  stimulusId: string | null;
  stimulusType: string | null;
  distractorActive: boolean;
  distractorId: string | null;
  distractorType: string | null;
  distractorStartedAtElapsedMs: number | null;
  distractorEndedAtElapsedMs: number | null;
  elapsedSessionTimeMs: number;
}

export interface BehaviorSample {
  sampleId: string;
  sessionId: string;
  elapsedMs: number;
  capturedAt: string;
  scenarioId: string | null;
  activityId: string | null;
  activityState: string | null;
  blockNumber: number | null;
  condition: string | null;
  trialNumber: number | null;
  globalTrialNumber: number | null;
  stimulus: {
    id: string | null;
    type: string | null;
  };
  distractor: {
    active: boolean;
    id: string | null;
    type: string | null;
    startedAtElapsedMs: number | null;
    endedAtElapsedMs: number | null;
  };
  upperCamera: {
    head: HeadBehaviorFeatures;
    trunk: TrunkBehaviorFeatures;
    available: boolean;
    quality: FeatureQuality;
  };
  fullBodyCamera: FullBodyBehaviorFeatures;
  motorActivity: MovementBehaviorFeatures;
  analysisPerformance: {
    upperAnalysisFps: number;
    fullBodyAnalysisFps: number;
    renderFps: number | null;
  };
}

export type BehaviorEventType =
  | "OFF_TASK_ORIENTATION_START"
  | "OFF_TASK_ORIENTATION_END"
  | "HEAD_TURN"
  | "POSTURE_CHANGE"
  | "LARGE_BODY_MOVEMENT"
  | "DISTRACTOR_STARTED"
  | "DISTRACTOR_ENDED"
  | "DISTRACTOR_ORIENTATION_RESPONSE"
  | "RETURN_TO_TASK"
  | "CAMERA_DISCONNECTED"
  | "CAMERA_RECONNECTED"
  | "ANALYSIS_ERROR"
  | "BUFFER_OVERFLOW";

export interface BehaviorEvent {
  eventId: string;
  sessionId: string;
  elapsedMs: number;
  occurredAt: string;
  type: BehaviorEventType;
  scenarioId: string | null;
  activityId: string | null;
  blockNumber: number | null;
  condition: string | null;
  trialNumber: number | null;
  details?: {
    distractorId?: string | null;
    distractorType?: string | null;
    durationMs?: number | null;
    latencyMs?: number | null;
    cameraRole?: "upper-body" | "full-body";
    message?: string;
  };
}

export interface ActivityResultEnvelope {
  resultId: string;
  scenarioId: string;
  activityId: string;
  completedAt: string;
  result: Record<string, unknown>;
}
