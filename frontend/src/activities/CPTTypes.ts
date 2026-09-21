export type CPTBlockCondition =
  | "baseline"
  | "visual"
  | "auditory"
  | "combined";

export const CPTActivityState = {
  Instructions: "instructions",
  Practice: "practice",
  Countdown: "countdown",
  RunningBlock: "running-block",
  Resting: "resting",
  Finished: "finished"
} as const;

export type CPTActivityState =
  (typeof CPTActivityState)[keyof typeof CPTActivityState];

export const CPT_DEBUG = false;

export interface CPTBlockConfig {
  blockNumber: number;
  condition: CPTBlockCondition;
  label: string;
  durationMs: number;
}

export interface CPTSessionConfig {
  targetLetter: string;
  targetProbability: number;
  nonTargetLetters: string[];
  practiceTrials: number;
  countdownSeconds: number;
  restDurationMs: number;
  stimulusDurationMs: number;
  interStimulusIntervalMs: number;
  blocks: CPTBlockConfig[];
}

export interface CPTStartTrialData {
  trialNumber: number;
  globalTrialNumber: number;
  blockNumber: number;
  condition: CPTBlockCondition;
  stimulus: string;
  isTarget: boolean;
  stimulusStartedAt: number;
  elapsedSessionTimeMs: number;
}

export interface CPTTrialResult {
  trialNumber: number;
  globalTrialNumber: number;
  blockNumber: number;
  condition: CPTBlockCondition;
  stimulus: string;
  isTarget: boolean;
  responded: boolean;
  hit: boolean;
  omission: boolean;
  commissionError: boolean;
  correctRejection: boolean;
  reactionTimeMs: number | null;
  stimulusStartedAt: number;
  stimulusEndedAt: number;
  elapsedSessionTimeMs: number;
}

export interface CPTBlockResult {
  blockNumber: number;
  condition: CPTBlockCondition;
  label: string;
  durationMs: number;
  totalTrials: number;
  targetTrials: number;
  nonTargetTrials: number;
  hits: number;
  omissions: number;
  commissionErrors: number;
  correctRejections: number;
  averageReactionTimeMs: number;
  reactionTimeStdDevMs: number;
  accuracyPercentage: number;
  trials: CPTTrialResult[];
}

export interface CPTSessionResult {
  startedAt: string;
  finishedAt: string;
  totalDurationMs: number;
  totalTrials: number;
  targets: number;
  nonTargets: number;
  hits: number;
  omissions: number;
  commissionErrors: number;
  correctRejections: number;
  averageReactionTimeMs: number;
  reactionTimeStdDevMs: number;
  accuracyPercentage: number;
  blocks: CPTBlockResult[];
  trials: CPTTrialResult[];
}

export const DEFAULT_CPT_SESSION_CONFIG: CPTSessionConfig = {
  targetLetter: "X",
  targetProbability: 0.25,
  nonTargetLetters: [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "H",
    "K",
    "M",
    "N",
    "P",
    "R",
    "S",
    "T"
  ],
  practiceTrials: 8,
  countdownSeconds: 3,
  restDurationMs: 12_000,
  stimulusDurationMs: 700,
  interStimulusIntervalMs: 800,
  blocks: [
    {
      blockNumber: 1,
      condition: "baseline",
      label: "Linea base",
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

export function isCPTTarget(stimulus: string, config: CPTSessionConfig): boolean {
  return stimulus.toUpperCase() === config.targetLetter.toUpperCase();
}

export function generateCPTStimulus(
  config: CPTSessionConfig,
  randomSource: () => number = Math.random
): string {
  const probability = clampProbability(config.targetProbability);

  if (randomSource() < probability) {
    return config.targetLetter;
  }

  const letters = config.nonTargetLetters.filter(
    (letter) => !isCPTTarget(letter, config)
  );
  const index = Math.floor(randomSource() * letters.length);

  return letters[Math.min(index, letters.length - 1)] ?? "A";
}

export function generateCPTTrialSequence(
  totalTrials: number,
  config: CPTSessionConfig,
  randomSource: () => number = Math.random
): string[] {
  return Array.from({ length: totalTrials }, () =>
    generateCPTStimulus(config, randomSource)
  );
}

function clampProbability(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}
