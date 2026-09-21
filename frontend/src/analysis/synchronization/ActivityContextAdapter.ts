import type { ActivityContext } from "../types/BehaviorTypes";

export interface ActivityBlockTelemetry {
  blockNumber: number;
  condition: string;
}

export interface ActivityTrialTelemetry {
  trialNumber: number;
  globalTrialNumber: number;
  stimulusId: string | null;
  stimulusType: string | null;
}

export interface ActivityDistractorTelemetry {
  distractorId: string;
  distractorType: string;
  startedAt: number;
  endedAt: number;
}

export interface ActivityTelemetrySink {
  onStateChange(state: string): void;
  onBlockStart(block: ActivityBlockTelemetry): void;
  onTrialStart(trial: ActivityTrialTelemetry): void;
  onTrialEnd(): void;
  onDistractor(event: ActivityDistractorTelemetry): void;
  onActivityResult(result: Record<string, unknown>): void;
}

export type ActivityAdapterEvent =
  | {
      type: "distractor";
      context: ActivityContext;
      event: ActivityDistractorTelemetry;
      startedAtElapsedMs: number;
      endedAtElapsedMs: number;
    }
  | {
      type: "activity-result";
      scenarioId: string;
      activityId: string;
      result: Record<string, unknown>;
    };

export type ActivityAdapterListener = (event: ActivityAdapterEvent) => void;

export class ActivityContextAdapter {
  private sessionId = "";
  private sessionStartedAtPerformance = 0;
  private scenarioId: string | null = null;
  private activityId: string | null = null;
  private activityState: string | null = null;
  private blockNumber: number | null = null;
  private condition: string | null = null;
  private trialNumber: number | null = null;
  private globalTrialNumber: number | null = null;
  private stimulusId: string | null = null;
  private stimulusType: string | null = null;
  private activeDistractor: {
    id: string;
    type: string;
    startedAtElapsedMs: number;
    endedAtElapsedMs: number;
  } | null = null;
  private readonly listeners = new Set<ActivityAdapterListener>();

  startSession(sessionId: string, startedAtPerformance: number): void {
    this.sessionId = sessionId;
    this.sessionStartedAtPerformance = startedAtPerformance;
    this.clearActivity();
  }

  setScenario(scenarioId: string, activityId: string): void {
    this.scenarioId = scenarioId;
    this.activityId = activityId;
    this.activityState = "exploring";
    this.blockNumber = null;
    this.condition = null;
    this.trialNumber = null;
    this.globalTrialNumber = null;
    this.stimulusId = null;
    this.stimulusType = null;
    this.activeDistractor = null;
  }

  clearActivity(): void {
    this.scenarioId = null;
    this.activityId = null;
    this.activityState = null;
    this.blockNumber = null;
    this.condition = null;
    this.trialNumber = null;
    this.globalTrialNumber = null;
    this.stimulusId = null;
    this.stimulusType = null;
    this.activeDistractor = null;
  }

  createTelemetrySink(
    scenarioId: string,
    activityId: string
  ): ActivityTelemetrySink {
    return {
      onStateChange: (state) => {
        if (this.matchesActiveActivity(scenarioId, activityId)) {
          this.activityState = state;
        }
      },
      onBlockStart: (block) => {
        if (!this.matchesActiveActivity(scenarioId, activityId)) {
          return;
        }

        this.blockNumber = block.blockNumber;
        this.condition = block.condition;
        this.trialNumber = null;
        this.globalTrialNumber = null;
        this.stimulusId = null;
        this.stimulusType = null;
      },
      onTrialStart: (trial) => {
        if (!this.matchesActiveActivity(scenarioId, activityId)) {
          return;
        }

        this.trialNumber = trial.trialNumber;
        this.globalTrialNumber = trial.globalTrialNumber;
        this.stimulusId = trial.stimulusId;
        this.stimulusType = trial.stimulusType;
      },
      onTrialEnd: () => {
        if (!this.matchesActiveActivity(scenarioId, activityId)) {
          return;
        }

        this.trialNumber = null;
        this.globalTrialNumber = null;
        this.stimulusId = null;
        this.stimulusType = null;
      },
      onDistractor: (event) => {
        if (!this.matchesActiveActivity(scenarioId, activityId)) {
          return;
        }

        const startedAtElapsedMs = this.toElapsed(event.startedAt);
        const endedAtElapsedMs = this.toElapsed(event.endedAt);

        this.activeDistractor = {
          id: event.distractorId,
          type: event.distractorType,
          startedAtElapsedMs,
          endedAtElapsedMs
        };
        this.emit({
          type: "distractor",
          context: this.getContext(event.startedAt),
          event: { ...event },
          startedAtElapsedMs,
          endedAtElapsedMs
        });
      },
      onActivityResult: (result) => {
        if (!this.matchesActiveActivity(scenarioId, activityId)) {
          return;
        }

        this.activityState = "finished";
        this.emit({
          type: "activity-result",
          scenarioId,
          activityId,
          result
        });
      }
    };
  }

  getContext(now = performance.now()): ActivityContext {
    const elapsedSessionTimeMs = this.toElapsed(now);
    const distractorActive = Boolean(
      this.activeDistractor &&
        elapsedSessionTimeMs >= this.activeDistractor.startedAtElapsedMs &&
        elapsedSessionTimeMs <= this.activeDistractor.endedAtElapsedMs
    );

    return {
      sessionId: this.sessionId,
      scenarioId: this.scenarioId,
      activityId: this.activityId,
      activityState: this.activityState,
      blockNumber: this.blockNumber,
      condition: this.condition,
      trialNumber: this.trialNumber,
      globalTrialNumber: this.globalTrialNumber,
      stimulusId: this.stimulusId,
      stimulusType: this.stimulusType,
      distractorActive,
      distractorId: distractorActive ? this.activeDistractor?.id ?? null : null,
      distractorType: distractorActive
        ? this.activeDistractor?.type ?? null
        : null,
      distractorStartedAtElapsedMs: distractorActive
        ? this.activeDistractor?.startedAtElapsedMs ?? null
        : null,
      distractorEndedAtElapsedMs: distractorActive
        ? this.activeDistractor?.endedAtElapsedMs ?? null
        : null,
      elapsedSessionTimeMs
    };
  }

  onEvent(listener: ActivityAdapterListener): () => void {
    this.listeners.add(listener);

    return () => this.listeners.delete(listener);
  }

  private matchesActiveActivity(scenarioId: string, activityId: string): boolean {
    return this.scenarioId === scenarioId && this.activityId === activityId;
  }

  private toElapsed(timestamp: number): number {
    return Math.max(0, timestamp - this.sessionStartedAtPerformance);
  }

  private emit(event: ActivityAdapterEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
