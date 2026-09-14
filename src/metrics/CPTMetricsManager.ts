import type {
  CPTBlockConfig,
  CPTBlockResult,
  CPTSessionResult,
  CPTStartTrialData,
  CPTTrialResult
} from "../activities/CPTTypes";

interface CPTTrialAggregate {
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
}

export class CPTMetricsManager {
  private sessionStartedAtMs: number | null = null;
  private sessionFinishedAtMs: number | null = null;
  private sessionStartedAtIso: string | null = null;
  private sessionFinishedAtIso: string | null = null;
  private currentTrial: CPTTrialResult | null = null;
  private readonly blockConfigs: CPTBlockConfig[] = [];
  private readonly trials: CPTTrialResult[] = [];

  startSession(
    blocks: CPTBlockConfig[],
    startedAtMs: number = performance.now(),
    startedAtDate: Date = new Date()
  ): void {
    this.sessionStartedAtMs = startedAtMs;
    this.sessionFinishedAtMs = null;
    this.sessionStartedAtIso = startedAtDate.toISOString();
    this.sessionFinishedAtIso = null;
    this.currentTrial = null;
    this.trials.length = 0;
    this.blockConfigs.length = 0;
    this.blockConfigs.push(...blocks);
  }

  startTrial(trialData: CPTStartTrialData): void {
    this.currentTrial = {
      trialNumber: trialData.trialNumber,
      globalTrialNumber: trialData.globalTrialNumber,
      blockNumber: trialData.blockNumber,
      condition: trialData.condition,
      stimulus: trialData.stimulus,
      isTarget: trialData.isTarget,
      responded: false,
      hit: false,
      omission: false,
      commissionError: false,
      correctRejection: false,
      reactionTimeMs: null,
      stimulusStartedAt: trialData.stimulusStartedAt,
      stimulusEndedAt: trialData.stimulusStartedAt,
      elapsedSessionTimeMs: trialData.elapsedSessionTimeMs
    };
  }

  registerResponse(reactionTimeMs: number): void {
    if (!this.currentTrial) {
      return;
    }

    this.currentTrial.responded = true;

    if (this.currentTrial.isTarget) {
      this.currentTrial.hit = true;
      this.currentTrial.reactionTimeMs = Math.max(0, reactionTimeMs);
      return;
    }

    this.currentTrial.commissionError = true;
    this.currentTrial.reactionTimeMs = null;
  }

  registerNoResponse(): void {
    if (!this.currentTrial) {
      return;
    }

    this.currentTrial.responded = false;
    this.currentTrial.reactionTimeMs = null;

    if (this.currentTrial.isTarget) {
      this.currentTrial.omission = true;
      return;
    }

    this.currentTrial.correctRejection = true;
  }

  endTrial(stimulusEndedAt: number = performance.now()): CPTTrialResult | null {
    if (!this.currentTrial) {
      return null;
    }

    const completedTrial = {
      ...this.currentTrial,
      stimulusEndedAt
    };

    this.trials.push(completedTrial);
    this.currentTrial = null;

    return completedTrial;
  }

  endSession(
    finishedAtMs: number = performance.now(),
    finishedAtDate: Date = new Date()
  ): CPTSessionResult {
    this.sessionFinishedAtMs = finishedAtMs;
    this.sessionFinishedAtIso = finishedAtDate.toISOString();

    return this.buildSessionResult(finishedAtMs);
  }

  getElapsedSessionTime(now: number = performance.now()): number {
    if (this.sessionStartedAtMs === null) {
      return 0;
    }

    return Math.max(0, now - this.sessionStartedAtMs);
  }

  getSessionResults(): CPTSessionResult | null {
    if (this.sessionStartedAtMs === null) {
      return null;
    }

    return this.buildSessionResult(this.sessionFinishedAtMs ?? performance.now());
  }

  private buildSessionResult(finishedAtMs: number): CPTSessionResult {
    const startedAtMs = this.sessionStartedAtMs ?? finishedAtMs;
    const aggregate = this.calculateAggregate(this.trials);
    const blocks = this.blockConfigs.map((blockConfig) =>
      this.buildBlockResult(blockConfig)
    );

    return {
      startedAt: this.sessionStartedAtIso ?? new Date().toISOString(),
      finishedAt: this.sessionFinishedAtIso ?? new Date().toISOString(),
      totalDurationMs: Math.max(0, finishedAtMs - startedAtMs),
      totalTrials: aggregate.totalTrials,
      targets: aggregate.targetTrials,
      nonTargets: aggregate.nonTargetTrials,
      hits: aggregate.hits,
      omissions: aggregate.omissions,
      commissionErrors: aggregate.commissionErrors,
      correctRejections: aggregate.correctRejections,
      averageReactionTimeMs: aggregate.averageReactionTimeMs,
      reactionTimeStdDevMs: aggregate.reactionTimeStdDevMs,
      accuracyPercentage: aggregate.accuracyPercentage,
      blocks,
      trials: this.copyTrials(this.trials)
    };
  }

  private buildBlockResult(blockConfig: CPTBlockConfig): CPTBlockResult {
    const blockTrials = this.trials.filter(
      (trial) => trial.blockNumber === blockConfig.blockNumber
    );
    const aggregate = this.calculateAggregate(blockTrials);

    return {
      blockNumber: blockConfig.blockNumber,
      condition: blockConfig.condition,
      label: blockConfig.label,
      durationMs: blockConfig.durationMs,
      totalTrials: aggregate.totalTrials,
      targetTrials: aggregate.targetTrials,
      nonTargetTrials: aggregate.nonTargetTrials,
      hits: aggregate.hits,
      omissions: aggregate.omissions,
      commissionErrors: aggregate.commissionErrors,
      correctRejections: aggregate.correctRejections,
      averageReactionTimeMs: aggregate.averageReactionTimeMs,
      reactionTimeStdDevMs: aggregate.reactionTimeStdDevMs,
      accuracyPercentage: aggregate.accuracyPercentage,
      trials: this.copyTrials(blockTrials)
    };
  }

  private calculateAggregate(trials: CPTTrialResult[]): CPTTrialAggregate {
    const totalTrials = trials.length;
    const targetTrials = trials.filter((trial) => trial.isTarget).length;
    const nonTargetTrials = totalTrials - targetTrials;
    const hits = trials.filter((trial) => trial.hit).length;
    const omissions = trials.filter((trial) => trial.omission).length;
    const commissionErrors = trials.filter(
      (trial) => trial.commissionError
    ).length;
    const correctRejections = trials.filter(
      (trial) => trial.correctRejection
    ).length;
    const reactionTimes = trials
      .filter((trial) => trial.hit)
      .map((trial) => trial.reactionTimeMs)
      .filter((reactionTime): reactionTime is number => reactionTime !== null);
    const averageReactionTimeMs = this.calculateAverage(reactionTimes);
    const reactionTimeStdDevMs = this.calculateStandardDeviation(
      reactionTimes,
      averageReactionTimeMs
    );
    const accuracyPercentage =
      totalTrials > 0
        ? ((hits + correctRejections) / totalTrials) * 100
        : 0;

    return {
      totalTrials,
      targetTrials,
      nonTargetTrials,
      hits,
      omissions,
      commissionErrors,
      correctRejections,
      averageReactionTimeMs,
      reactionTimeStdDevMs,
      accuracyPercentage
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const total = values.reduce((sum, value) => sum + value, 0);

    return total / values.length;
  }

  private calculateStandardDeviation(values: number[], average: number): number {
    if (values.length === 0) {
      return 0;
    }

    const variance =
      values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      values.length;

    return Math.sqrt(variance);
  }

  private copyTrials(trials: CPTTrialResult[]): CPTTrialResult[] {
    return trials.map((trial) => ({ ...trial }));
  }
}
