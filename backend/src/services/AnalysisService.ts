import type { Document } from "mongodb";

import { ApiError } from "../middleware/errors.js";
import type { AnalysisRepository } from "../repositories/AnalysisRepository.js";
import { buildSessionSummary } from "./SummaryService.js";
import type {
  ActivityResultDto,
  BehaviorEventDto,
  BehaviorSampleDto,
  CreateSessionDto,
  FinishSessionDto
} from "../validation/schemas.js";

export class AnalysisService {
  constructor(private readonly repository: AnalysisRepository) {}

  async createSession(payload: CreateSessionDto): Promise<Document> {
    return this.repository.createSession(payload);
  }

  async addBehaviorSamples(
    sessionId: string,
    samples: BehaviorSampleDto[]
  ): Promise<number> {
    await this.assertSessionExists(sessionId);
    this.assertMatchingSessionIds(
      sessionId,
      samples.map((sample) => sample.sessionId)
    );

    return this.repository.saveBehaviorSamples(samples);
  }

  async addBehaviorEvents(
    sessionId: string,
    events: BehaviorEventDto[]
  ): Promise<number> {
    await this.assertSessionExists(sessionId);
    this.assertMatchingSessionIds(
      sessionId,
      events.map((event) => event.sessionId)
    );

    return this.repository.saveBehaviorEvents(events);
  }

  async addActivityResult(
    sessionId: string,
    payload: ActivityResultDto
  ): Promise<void> {
    await this.assertSessionExists(sessionId);
    await this.repository.saveActivityResult(sessionId, payload);
  }

  async finishSession(
    sessionId: string,
    payload: FinishSessionDto
  ): Promise<Document> {
    await this.assertSessionExists(sessionId);
    const [samples, events] = await Promise.all([
      this.repository.getSamplesForSummary(sessionId),
      this.repository.getEventsForSummary(sessionId)
    ]);
    const summary = buildSessionSummary(sessionId, samples, events);

    await this.repository.saveSummary(sessionId, summary);
    await this.repository.finishSession(sessionId, payload);

    return summary;
  }

  async getSession(sessionId: string): Promise<Document> {
    const session = await this.repository.getSession(sessionId);

    if (!session) {
      throw new ApiError(404, "Sesion no encontrada");
    }

    return session;
  }

  private async assertSessionExists(sessionId: string): Promise<void> {
    if (!(await this.repository.sessionExists(sessionId))) {
      throw new ApiError(404, "Sesion no encontrada");
    }
  }

  private assertMatchingSessionIds(
    expectedSessionId: string,
    receivedSessionIds: string[]
  ): void {
    if (receivedSessionIds.some((sessionId) => sessionId !== expectedSessionId)) {
      throw new ApiError(400, "El sessionId del lote no coincide con la URL");
    }
  }
}
