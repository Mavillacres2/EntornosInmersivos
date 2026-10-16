import type { Document } from "mongodb";

import { ApiError } from "../middleware/errors.js";
import type { AnalysisRepository } from "../repositories/AnalysisRepository.js";
import type { SessionListQuery } from "../repositories/AnalysisRepository.js";
import { buildSessionSummary } from "./SummaryService.js";
import type {
  ActivityResultDto,
  BehaviorEventDto,
  BehaviorSampleDto,
  CreateSessionDto,
  FinishSessionDto
} from "../validation/schemas.js";

export class AnalysisService {
  private readonly closing = new Map<string,Promise<Document>>();
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
    const existing=this.closing.get(sessionId);if(existing)return existing;
    const operation=this.performFinishSession(sessionId,payload);this.closing.set(sessionId,operation);
    try{return await operation;}finally{this.closing.delete(sessionId);}
  }

  private async performFinishSession(sessionId:string,payload:FinishSessionDto):Promise<Document>{
    await this.assertSessionExists(sessionId);
    const session=await this.repository.getSession(sessionId);
    const results=(session?.activityResults ?? []) as ActivityResultDto[];
    const required=[['classroom','go-no-go'],['space-station','cpt'],['interactive-museum','visual-discrimination']];
    const complete=required.every(([scenario,activity])=>results.some(result=>result.scenarioId===scenario&&result.activityId===activity));
    if(!complete)throw new ApiError(409,'Faltan resultados guardados de las tres actividades.');
    if(session?.status==='finished'&&session.summary)return session.summary as Document;
    const [samples, events] = await Promise.all([
      this.repository.getSamplesForSummary(sessionId),
      this.repository.getEventsForSummary(sessionId)
    ]);
    const interrupted=new Set(events.filter(event=>event.type==='ACTIVITY_INTERRUPTED'&&event.attemptId).map(event=>event.attemptId));
    if(results.some(result=>result.attemptId&&interrupted.has(result.attemptId)))throw new ApiError(409,'Un resultado pertenece a un intento interrumpido. Revise los registros.');
    const summary = buildSessionSummary(sessionId, samples, events);

    await this.repository.saveSummary(sessionId, summary);
    await this.repository.finishSession(sessionId, {...payload,scenariosCompleted:required.map(([scenario])=>scenario!)});

    return summary;
  }

  async getSession(sessionId: string): Promise<Document> {
    const session = await this.repository.getSession(sessionId);

    if (!session) {
      throw new ApiError(404, "Sesion no encontrada");
    }

    return session;
  }

  async listSessions(query: SessionListQuery): Promise<Document> {
    const { items, total } = await this.repository.listSessions(query);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize)
      }
    };
  }

  async getSessionTimeline(sessionId: string, maxPoints: number): Promise<Document> {
    await this.assertSessionExists(sessionId);
    return this.repository.getSessionTimeline(sessionId, maxPoints);
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
