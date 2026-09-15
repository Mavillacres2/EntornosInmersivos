import type { VisualDiscriminationConfig } from "./VisualDiscriminationTypes";

export const DEFAULT_VISUAL_DISCRIMINATION_CONFIG: VisualDiscriminationConfig = {
  practiceTrials: 10,
  trialsPerBlock: 15,
  responseWindowMs: 4000,
  itiMinMs: 300,
  itiMaxMs: 500,
  blockTypes: ["none", "visual", "auditory", "combined"],
  blockOrderStrategy: "latinSquare",
  distractorProbability: 0.35,
  distractorOnsetMinMs: 200,
  distractorOnsetMaxMs: 1200,
  inputMode: "reticle-click",
  difficultyDistribution: {
    easy: 20,
    medium: 20,
    hard: 20
  },
  seed: 421395
} as const;
