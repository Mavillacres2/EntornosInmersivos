import type {
  BlockResult,
  GoNoGoBlockConfig,
  SessionResult,
  StartTrialData,
  TrialResult
} from "../activities/GoNoGoTypes";

interface TrialAggregate {
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
}

export class MetricsManager {
  private sessionStartedAtMs: number | null = null;
  private sessionFinishedAtMs: number | null = null;
  private sessionStartedAtIso: string | null = null;
  private sessionFinishedAtIso: string | null = null;
  private currentTrial: TrialResult | null = null;
  private readonly blockConfigs: GoNoGoBlockConfig[] = [];
  private readonly trials: TrialResult[] = [];

  startSession(
    blocks: GoNoGoBlockConfig[],
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

  startTrial(trialData: StartTrialData): void {
    this.currentTrial = {
      trialNumber: trialData.trialNumber,
      globalTrialNumber: trialData.globalTrialNumber,
      blockNumber: trialData.blockNumber,
      condition: trialData.condition,
      stimulusType: trialData.stimulusType,
      stimulusColor: trialData.stimulusColor,
      expectedResponse: trialData.expectedResponse,
      responded: false,
      correct: false,
      omission: false,
      commissionError: false,
      correctInhibition: false,
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
    this.currentTrial.reactionTimeMs = Math.max(0, reactionTimeMs);

    if (this.currentTrial.expectedResponse) {
      this.currentTrial.correct = true;
      this.currentTrial.correctInhibition = false;
      return;
    }

    this.currentTrial.correct = false;
    this.currentTrial.correctInhibition = false;
    this.currentTrial.commissionError = true;
  }

  registerOmission(): void {
    if (!this.currentTrial) {
      return;
    }

    this.currentTrial.responded = false;
    this.currentTrial.correct = false;
    this.currentTrial.omission = true;
    this.currentTrial.commissionError = false;
    this.currentTrial.correctInhibition = false;
    this.currentTrial.reactionTimeMs = null;
  }

  registerCorrectInhibition(): void {
    if (!this.currentTrial) {
      return;
    }

    this.currentTrial.responded = false;
    this.currentTrial.correct = true;
    this.currentTrial.omission = false;
    this.currentTrial.commissionError = false;
    this.currentTrial.correctInhibition = true;
    this.currentTrial.reactionTimeMs = null;
  }

  endTrial(stimulusEndedAt: number = performance.now()): TrialResult | null {
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
  ): SessionResult {
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

  getSessionResults(): SessionResult | null {
    if (this.sessionStartedAtMs === null) {
      return null;
    }

    return this.buildSessionResult(this.sessionFinishedAtMs ?? performance.now());
  }

  private buildSessionResult(finishedAtMs: number): SessionResult {
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
      totalGoTrials: aggregate.goTrials,
      totalNoGoTrials: aggregate.noGoTrials,
      correctGoResponses: aggregate.correctGoResponses,
      correctNoGoInhibitions: aggregate.correctNoGoInhibitions,
      totalCorrectResponses:
        aggregate.correctGoResponses + aggregate.correctNoGoInhibitions,
      omissions: aggregate.omissions,
      commissionErrors: aggregate.commissionErrors,
      averageReactionTimeMs: aggregate.averageReactionTimeMs,
      reactionTimeStdDevMs: aggregate.reactionTimeStdDevMs,
      accuracyPercentage: aggregate.accuracyPercentage,
      blocks,
      trials: this.copyTrials(this.trials)
    };
  }

  private buildBlockResult(blockConfig: GoNoGoBlockConfig): BlockResult {
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
      goTrials: aggregate.goTrials,
      noGoTrials: aggregate.noGoTrials,
      correctGoResponses: aggregate.correctGoResponses,
      correctNoGoInhibitions: aggregate.correctNoGoInhibitions,
      omissions: aggregate.omissions,
      commissionErrors: aggregate.commissionErrors,
      averageReactionTimeMs: aggregate.averageReactionTimeMs,
      reactionTimeStdDevMs: aggregate.reactionTimeStdDevMs,
      accuracyPercentage: aggregate.accuracyPercentage,
      trials: this.copyTrials(blockTrials)
    };
  }

  private calculateAggregate(trials: TrialResult[]): TrialAggregate {
    const totalTrials = trials.length;
    const goTrials = trials.filter((trial) => trial.stimulusType === "go").length;
    const noGoTrials = totalTrials - goTrials;
    const correctGoResponses = trials.filter(
      (trial) => trial.stimulusType === "go" && trial.correct
    ).length;
    const correctNoGoInhibitions = trials.filter(
      (trial) => trial.correctInhibition
    ).length;
    const omissions = trials.filter((trial) => trial.omission).length;
    const commissionErrors = trials.filter(
      (trial) => trial.commissionError
    ).length;
    const reactionTimes = trials
      .map((trial) => trial.reactionTimeMs)
      .filter((reactionTime): reactionTime is number => reactionTime !== null);
    const averageReactionTimeMs = this.calculateAverage(reactionTimes);
    const reactionTimeStdDevMs = this.calculateStandardDeviation(
      reactionTimes,
      averageReactionTimeMs
    );
    const correctResponses = correctGoResponses + correctNoGoInhibitions;
    const accuracyPercentage =
      totalTrials > 0 ? (correctResponses / totalTrials) * 100 : 0;

    return {
      totalTrials,
      goTrials,
      noGoTrials,
      correctGoResponses,
      correctNoGoInhibitions,
      omissions,
      commissionErrors,
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

  private copyTrials(trials: TrialResult[]): TrialResult[] {
    return trials.map((trial) => ({ ...trial }));
  }
}
