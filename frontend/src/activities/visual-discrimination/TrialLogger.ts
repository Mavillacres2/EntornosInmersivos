import type {
  ExperimentStorage,
  VisualDiscriminationTrialLog
} from "./VisualDiscriminationTypes";

export class MemoryStorageAdapter implements ExperimentStorage {
  private readonly sessionIds: string[] = [];
  private readonly completedSessionIds: string[] = [];
  private readonly trials: VisualDiscriminationTrialLog[] = [];

  async saveSession(sessionId: string): Promise<void> {
    this.sessionIds.push(sessionId);
  }

  async saveTrial(trial: VisualDiscriminationTrialLog): Promise<void> {
    this.trials.push({ ...trial });
  }

  async completeSession(sessionId: string): Promise<void> {
    this.completedSessionIds.push(sessionId);
  }

  getTrials(): VisualDiscriminationTrialLog[] {
    return this.trials.map((trial) => ({ ...trial }));
  }
}

export class TrialLogger {
  private readonly storage: ExperimentStorage;
  private readonly trials: VisualDiscriminationTrialLog[] = [];

  constructor(storage: ExperimentStorage = new MemoryStorageAdapter()) {
    this.storage = storage;
  }

  async startSession(sessionId: string): Promise<void> {
    this.trials.length = 0;
    await this.storage.saveSession(sessionId);
  }

  async logTrial(trial: VisualDiscriminationTrialLog): Promise<void> {
    const copy = { ...trial };

    this.trials.push(copy);
    await this.storage.saveTrial(copy);
  }

  async completeSession(sessionId: string): Promise<void> {
    await this.storage.completeSession(sessionId);
  }

  getTrials(): VisualDiscriminationTrialLog[] {
    return this.trials.map((trial) => ({ ...trial }));
  }
}
