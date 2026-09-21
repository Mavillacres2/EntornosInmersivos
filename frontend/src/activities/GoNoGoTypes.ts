export type StimulusType = "go" | "no-go";
export type StimulusColor = "green" | "red";

export type BlockCondition =
  | "baseline"
  | "visual"
  | "auditory"
  | "combined";

export const ActivityState = {
  Instructions: "instructions",
  Practice: "practice",
  Countdown: "countdown",
  RunningBlock: "running-block",
  Resting: "resting",
  Finished: "finished"
} as const;

export type ActivityState = (typeof ActivityState)[keyof typeof ActivityState];

export interface GoNoGoBlockConfig {
  blockNumber: number;
  condition: BlockCondition;
  label: string;
  durationMs: number;
}

export interface GoNoGoSessionConfig {
  practiceTrials: number;
  countdownSeconds: number;
  restDurationMs: number;
  stimulusDurationMs: number;
  interStimulusIntervalMs: number;
  goProbability: number;
  blocks: GoNoGoBlockConfig[];
}

export interface StartTrialData {
  trialNumber: number;
  globalTrialNumber: number;
  blockNumber: number;
  condition: BlockCondition;
  stimulusType: StimulusType;
  stimulusColor: StimulusColor;
  expectedResponse: boolean;
  stimulusStartedAt: number;
  elapsedSessionTimeMs: number;
}

export interface TrialResult {
  trialNumber: number;
  globalTrialNumber: number;
  blockNumber: number;
  condition: BlockCondition;
  stimulusType: StimulusType;
  stimulusColor: StimulusColor;
  expectedResponse: boolean;
  responded: boolean;
  correct: boolean;
  omission: boolean;
  commissionError: boolean;
  correctInhibition: boolean;
  reactionTimeMs: number | null;
  stimulusStartedAt: number;
  stimulusEndedAt: number;
  elapsedSessionTimeMs: number;
}

export interface BlockResult {
  blockNumber: number;
  condition: BlockCondition;
  label: string;
  durationMs: number;
  totalTrials: number;
  goTrials: number;
  noGoTrials: number;
  correctGoResponses: number;
  correctNoGoInhibitions: number;
  omissions: number;
  commissionErrors: number;
  averageReactionTimeMs: number;
  reactionTimeStdDevMs: number;
  accuracyPercentage: number;
  trials: TrialResult[];
}

export interface SessionResult {
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  totalTrials: number;
  totalGoTrials: number;
  totalNoGoTrials: number;
  correctGoResponses: number;
  correctNoGoInhibitions: number;
  totalCorrectResponses: number;
  omissions: number;
  commissionErrors: number;
  averageReactionTimeMs: number;
  reactionTimeStdDevMs: number;
  accuracyPercentage: number;
  blocks: BlockResult[];
  trials: TrialResult[];
}

export const DEFAULT_GO_NO_GO_SESSION_CONFIG: GoNoGoSessionConfig = {
  practiceTrials: 8,
  countdownSeconds: 3,
  restDurationMs: 12_000,
  stimulusDurationMs: 1_200,
  interStimulusIntervalMs: 800,
  goProbability: 0.7,
  blocks: [
    {
      blockNumber: 1,
      condition: "baseline",
      label: "Sin distractores",
      durationMs: 60_000
    },
    {
      blockNumber: 2,
      condition: "visual",
      label: "Distractores visuales",
      durationMs: 60_000
    },
    {
      blockNumber: 3,
      condition: "auditory",
      label: "Distractores auditivos",
      durationMs: 60_000
    },
    {
      blockNumber: 4,
      condition: "combined",
      label: "Distractores combinados",
      durationMs: 60_000
    }
  ]
};

export function getStimulusColor(stimulusType: StimulusType): StimulusColor {
  return stimulusType === "go" ? "green" : "red";
}

export function generateStimulusType(
  goProbability: number,
  randomSource: () => number = Math.random
): StimulusType {
  const normalizedGoProbability = Math.min(Math.max(goProbability, 0), 1);

  return randomSource() < normalizedGoProbability ? "go" : "no-go";
}

export function generateTrialSequence(
  totalTrials: number,
  goProbability: number,
  randomSource: () => number = Math.random
): StimulusType[] {
  return Array.from({ length: totalTrials }, () =>
    generateStimulusType(goProbability, randomSource)
  );
}
