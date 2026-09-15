import type {
  BlockType,
  TechnicalTelemetry,
  VisualDiscriminationConditionMetrics,
  VisualDiscriminationSessionResult,
  VisualDiscriminationTrialLog
} from "./VisualDiscriminationTypes";

const CONDITIONS: BlockType[] = ["none", "visual", "auditory", "combined"];

export class VisualDiscriminationMetricsManager {
  private sessionStartedAtMs = 0;
  private sessionStartedAtIso = "";
  private sessionId = "";

  startSession(sessionId: string, startedAtMs = performance.now()): void {
    this.sessionId = sessionId;
    this.sessionStartedAtMs = startedAtMs;
    this.sessionStartedAtIso = new Date().toISOString();
  }

  buildSessionResult(
    trials: VisualDiscriminationTrialLog[],
    technicalTelemetry: TechnicalTelemetry,
    finishedAtMs = performance.now()
  ): VisualDiscriminationSessionResult {
    const finishedAt = new Date().toISOString();
    const global = this.calculateMetrics("none", trials, true);
    const byCondition = CONDITIONS.map((condition) =>
      this.calculateMetrics(condition, trials.filter((trial) => trial.blockType === condition))
    );
    const baseline = byCondition.find((metrics) => metrics.condition === "none") ??
      this.emptyMetrics("none");

    return {
      sessionId: this.sessionId,
      startedAt: this.sessionStartedAtIso,
      finishedAt,
      totalDurationMs: Math.max(0, finishedAtMs - this.sessionStartedAtMs),
      global,
      byCondition,
      distractorEffects: byCondition
        .filter((metrics) => metrics.condition !== "none")
        .map((metrics) => ({
          condition: metrics.condition,
          deltaAccuracy: metrics.accuracy - baseline.accuracy,
          deltaMeanRt: metrics.meanRtMs - baseline.meanRtMs,
          deltaRtSd: metrics.sdRtMs - baseline.sdRtMs
        })),
      experimentalDiscriminationIndex:
        global.totalTrials > 0
          ? ((global.hits - global.errors) / global.totalTrials) * 100
          : 0,
      technicalTelemetry,
      trials: trials.map((trial) => ({ ...trial }))
    };
  }

  calculateMetricsForTrials(
    trials: VisualDiscriminationTrialLog[]
  ): VisualDiscriminationConditionMetrics {
    return this.calculateMetrics("none", trials, true);
  }

  private calculateMetrics(
    condition: BlockType,
    trials: VisualDiscriminationTrialLog[],
    forceGlobalCondition = false
  ): VisualDiscriminationConditionMetrics {
    if (trials.length === 0) {
      return this.emptyMetrics(condition);
    }

    const hits = trials.filter((trial) => trial.isCorrect).length;
    const omissions = trials.filter((trial) => trial.isOmission).length;
    const errors = trials.filter(
      (trial) => !trial.isCorrect && !trial.isOmission
    ).length;
    const correctRts = trials
      .filter((trial) => trial.isCorrect && trial.rtMs !== null)
      .map((trial) => trial.rtMs)
      .filter((value): value is number => value !== null);
    const meanRtMs = this.mean(correctRts);
    const sdRtMs = this.standardDeviation(correctRts, meanRtMs);

    return {
      condition: forceGlobalCondition ? "none" : condition,
      totalTrials: trials.length,
      hits,
      errors,
      omissions,
      accuracy: (hits / trials.length) * 100,
      responseAccuracy: hits + errors > 0 ? (hits / (hits + errors)) * 100 : 0,
      netScore: hits - errors,
      meanRtMs,
      medianRtMs: this.median(correctRts),
      sdRtMs,
      rtCv: meanRtMs > 0 ? sdRtMs / meanRtMs : null
    };
  }

  private emptyMetrics(condition: BlockType): VisualDiscriminationConditionMetrics {
    return {
      condition,
      totalTrials: 0,
      hits: 0,
      errors: 0,
      omissions: 0,
      accuracy: 0,
      responseAccuracy: 0,
      netScore: 0,
      meanRtMs: 0,
      medianRtMs: 0,
      sdRtMs: 0,
      rtCv: null
    };
  }

  private mean(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  private median(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }

  private standardDeviation(values: number[], mean: number): number {
    if (values.length === 0) {
      return 0;
    }

    const variance =
      values.reduce((total, value) => total + (value - mean) ** 2, 0) /
      values.length;

    return Math.sqrt(variance);
  }
}
