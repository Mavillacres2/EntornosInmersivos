export type FaceIndex = 0 | 1 | 2;

export type VisualDiscriminationDifficulty = "easy" | "medium" | "hard";

export type BlockType = "none" | "visual" | "auditory" | "combined";

export type BlockOrderStrategy = "fixed" | "randomized" | "latinSquare";

export type InputMode = "reticle-click" | "keyboard-123";

export type VisualDiscriminationState =
  | "instructions"
  | "practice"
  | "practice-feedback"
  | "countdown"
  | "running-block"
  | "resting"
  | "finished";

export interface EyeConfig {
  shape: "round" | "wide" | "sleepy";
  spacing: number;
  size: number;
}

export interface EyebrowConfig {
  tilt: number;
  height: number;
  thickness: number;
}

export interface MouthConfig {
  curve: "smile" | "neutral" | "frown";
  width: number;
  openness: number;
}

export interface HairConfig {
  style: "short" | "cap" | "side";
  height: number;
}

export interface FaceFeatures {
  eyes: EyeConfig;
  eyebrows: EyebrowConfig;
  mouth: MouthConfig;
  hair: HairConfig;
}

export interface FaceSet {
  id: string;
  seed: number;
  faces: [FaceFeatures, FaceFeatures, FaceFeatures];
  correctIndex: FaceIndex;
  difficulty: VisualDiscriminationDifficulty;
  changedFeatures: string[];
}

export interface VisualDiscriminationConfig {
  practiceTrials: number;
  trialsPerBlock: number;
  responseWindowMs: number;
  itiMinMs: number;
  itiMaxMs: number;
  blockTypes: BlockType[];
  blockOrderStrategy: BlockOrderStrategy;
  distractorProbability: number;
  distractorOnsetMinMs: number;
  distractorOnsetMaxMs: number;
  inputMode: InputMode;
  difficultyDistribution: {
    easy: number;
    medium: number;
    hard: number;
  };
  seed: number;
  participantCode?: string;
}

export interface ScheduledTrial {
  trialId: number;
  blockId: string;
  blockIndex: number;
  blockType: BlockType;
  correctIndex: FaceIndex;
  difficulty: VisualDiscriminationDifficulty;
  generatorSeed: number;
  shouldTriggerDistractor: boolean;
  plannedDistractorOnsetMs: number | null;
}

export interface ScheduledBlock {
  blockId: string;
  blockIndex: number;
  blockType: BlockType;
  trials: ScheduledTrial[];
}

export interface DistractorTrialEvent {
  distractorActive: boolean;
  distractorType: BlockType;
  distractorId: string | null;
  plannedOnsetOffsetMs: number | null;
  actualOnsetOffsetMs: number | null;
  durationMs: number | null;
}

export interface VisualDiscriminationTrialLog {
  trialId: number;
  blockId: string;
  blockIndex: number;
  blockType: BlockType;
  faceSetId: string;
  generatorSeed: number;
  difficulty: VisualDiscriminationDifficulty;
  changedFeatures: string[];
  correctIndex: FaceIndex;
  selectedIndex: FaceIndex | null;
  isCorrect: boolean;
  isOmission: boolean;
  stimulusOnsetMs: number;
  responseTimestampMs: number | null;
  rtMs: number | null;
  firstAimOnAnyFaceMs: number | null;
  distractorActive: boolean;
  distractorType: BlockType;
  distractorId: string | null;
  distractorOnsetOffsetMs: number | null;
  distractorDurationMs: number | null;
  inputMode: InputMode;
  timestampIso: string;
}

export interface VisualDiscriminationConditionMetrics {
  condition: BlockType;
  totalTrials: number;
  hits: number;
  errors: number;
  omissions: number;
  accuracy: number;
  responseAccuracy: number;
  netScore: number;
  meanRtMs: number;
  medianRtMs: number;
  sdRtMs: number;
  rtCv: number | null;
}

export interface DistractorEffectMetric {
  condition: BlockType;
  deltaAccuracy: number;
  deltaMeanRt: number;
  deltaRtSd: number;
}

export interface TechnicalTelemetry {
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  inputMode: InputMode;
  meanFrameTimeMs: number;
  medianFrameTimeMs: number;
}

export interface VisualDiscriminationSessionResult {
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  global: VisualDiscriminationConditionMetrics;
  byCondition: VisualDiscriminationConditionMetrics[];
  distractorEffects: DistractorEffectMetric[];
  experimentalDiscriminationIndex: number;
  technicalTelemetry: TechnicalTelemetry;
  trials: VisualDiscriminationTrialLog[];
}

export interface ExperimentStorage {
  saveSession(sessionId: string): Promise<void>;
  saveTrial(trial: VisualDiscriminationTrialLog): Promise<void>;
  completeSession(sessionId: string): Promise<void>;
}
