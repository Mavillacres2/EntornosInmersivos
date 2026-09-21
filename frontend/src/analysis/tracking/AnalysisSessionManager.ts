import type { AnalysisApiClient } from "../api/AnalysisApiClient";
import type { AnalysisSystemState } from "../types/AnalysisTypes";

export interface EvaluationSessionInfo {
  sessionId: string;
  participantCode: string;
  startedAt: string;
  startedAtPerformance: number;
  remoteCreated: boolean;
}

export class AnalysisSessionManager {
  private state: AnalysisSystemState = "idle";
  private session: EvaluationSessionInfo | null = null;
  private upperBodyCameraConfigured = false;
  private fullBodyCameraConfigured = false;
  private retryTimeoutId: number | null = null;
  private retryAttempt = 0;
  private syncPromise: Promise<void> | null = null;
  private syncRequestVersion = 0;
  private readonly apiClient: AnalysisApiClient;

  constructor(apiClient: AnalysisApiClient) {
    this.apiClient = apiClient;
  }

  async createSession(participantCode: string): Promise<EvaluationSessionInfo> {
    this.clearRetry();
    const session: EvaluationSessionInfo = {
      sessionId: crypto.randomUUID(),
      participantCode: participantCode.trim().toUpperCase(),
      startedAt: new Date().toISOString(),
      startedAtPerformance: performance.now(),
      remoteCreated: false
    };

    this.session = session;
    this.state = "requesting-permission";
    await this.syncSession().catch(() => undefined);
    return { ...session };
  }

  async updateCameraConfiguration(
    upperBodyConfigured: boolean,
    fullBodyConfigured: boolean
  ): Promise<void> {
    this.upperBodyCameraConfigured = upperBodyConfigured;
    this.fullBodyCameraConfigured = fullBodyConfigured;
    await this.syncSession().catch(() => undefined);
  }

  setState(state: AnalysisSystemState): void {
    if (!this.session && state === "analyzing") {
      throw new Error("No se puede analizar sin una sesion valida.");
    }

    this.state = state;
  }

  getState(): AnalysisSystemState {
    return this.state;
  }

  getSession(): EvaluationSessionInfo | null {
    return this.session ? { ...this.session } : null;
  }

  hasRemoteSession(): boolean {
    return this.session?.remoteCreated ?? false;
  }

  async ensureRemoteSession(): Promise<boolean> {
    if (!this.session) {
      return false;
    }

    if (this.session.remoteCreated) {
      return true;
    }

    try {
      await this.syncSession();
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    this.clearRetry();
    this.session = null;
    this.state = "finished";
  }

  private async syncSession(): Promise<void> {
    this.syncRequestVersion += 1;

    if (this.syncPromise) {
      return this.syncPromise;
    }

    this.syncPromise = this.runSyncQueue();

    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  private async runSyncQueue(): Promise<void> {
    let processedVersion: number;

    do {
      processedVersion = this.syncRequestVersion;
      await this.performSync();
    } while (processedVersion !== this.syncRequestVersion);
  }

  private async performSync(): Promise<void> {
    const session = this.session;

    if (!session) {
      throw new Error("No existe una sesion para sincronizar.");
    }

    try {
      await this.apiClient.createSession({
        sessionId: session.sessionId,
        participantCode: session.participantCode,
        startedAt: session.startedAt,
        cameraConfiguration: {
          upperBodyCameraConfigured: this.upperBodyCameraConfigured,
          fullBodyCameraConfigured: this.fullBodyCameraConfigured
        }
      });
      session.remoteCreated = true;
      this.retryAttempt = 0;
      this.clearRetry();
    } catch (error) {
      session.remoteCreated = false;
      this.scheduleRetry();
      throw error;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimeoutId !== null || !this.session) {
      return;
    }

    const delayMs = Math.min(30_000, 1000 * 2 ** this.retryAttempt);

    this.retryAttempt += 1;
    this.retryTimeoutId = window.setTimeout(() => {
      this.retryTimeoutId = null;
      void this.syncSession().catch(() => undefined);
    }, delayMs);
  }

  private clearRetry(): void {
    if (this.retryTimeoutId !== null) {
      window.clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }
}
