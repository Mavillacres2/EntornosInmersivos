import type { Collection, Document } from "mongodb";

import type { MongoDatabase } from "../database/MongoDatabase.js";
import type {
  ActivityResultDto,
  BehaviorEventDto,
  BehaviorSampleDto,
  CreateSessionDto,
  FinishSessionDto
} from "../validation/schemas.js";
import {
  behaviorEventSchema,
  behaviorSampleSchema
} from "../validation/schemas.js";

interface AnalysisCollections {
  participants: Collection<Document>;
  sessions: Collection<Document>;
  samples: Collection<Document>;
  events: Collection<Document>;
  activityResults: Collection<Document>;
  summaries: Collection<Document>;
}

export interface SessionListQuery {
  participantCode?: string;
  status?: "active" | "finished";
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

export class AnalysisRepository {
  private indexesInitialized = false;
  private indexInitialization: Promise<void> | null = null;

  constructor(private readonly database: MongoDatabase) {}

  async initializeIndexes(): Promise<void> {
    await this.getCollections();
  }

  async createSession(payload: CreateSessionDto): Promise<Document> {
    const collections = await this.getCollections();

    await collections.participants.updateOne(
      { participantCode: payload.participantCode },
      {
        $setOnInsert: {
          participantCode: payload.participantCode,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    await collections.sessions.updateOne(
      { sessionId: payload.sessionId },
      {
        $setOnInsert: {
          sessionId: payload.sessionId,
          participantCode: payload.participantCode,
          startedAt: new Date(payload.startedAt),
          finishedAt: null,
          status: "active",
          scenariosCompleted: [],
          createdAt: new Date()
        },
        $set: {
          cameraConfiguration: payload.cameraConfiguration,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    const session = await collections.sessions.findOne({
      sessionId: payload.sessionId
    });

    if (!session) {
      throw new Error("No se pudo crear la sesion");
    }

    return session;
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    const { sessions } = await this.getCollections();

    return (await sessions.countDocuments({ sessionId }, { limit: 1 })) > 0;
  }

  async saveBehaviorSamples(samples: BehaviorSampleDto[]): Promise<number> {
    const { samples: collection } = await this.getCollections();
    const operations = samples.map((sample) => ({
      updateOne: {
        filter: { sessionId: sample.sessionId, sampleId: sample.sampleId },
        update: {
          $setOnInsert: {
            ...sample,
            receivedAt: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });

    return result.upsertedCount;
  }

  async saveBehaviorEvents(events: BehaviorEventDto[]): Promise<number> {
    const { events: collection } = await this.getCollections();
    const operations = events.map((event) => ({
      updateOne: {
        filter: { sessionId: event.sessionId, eventId: event.eventId },
        update: {
          $setOnInsert: {
            ...event,
            receivedAt: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });

    return result.upsertedCount;
  }

  async saveActivityResult(
    sessionId: string,
    payload: ActivityResultDto
  ): Promise<void> {
    const { activityResults } = await this.getCollections();

    await activityResults.updateOne(
      {
        sessionId,
        scenarioId: payload.scenarioId,
        activityId: payload.activityId
      },
      {
        $set: {
          ...payload,
          sessionId,
          completedAt: new Date(payload.completedAt),
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  async finishSession(
    sessionId: string,
    payload: FinishSessionDto
  ): Promise<void> {
    const { sessions } = await this.getCollections();

    await sessions.updateOne(
      { sessionId },
      {
        $set: {
          status: "finished",
          finishedAt: new Date(payload.finishedAt),
          scenariosCompleted: payload.scenariosCompleted,
          updatedAt: new Date()
        }
      }
    );
  }

  async getSession(sessionId: string): Promise<Document | null> {
    const { sessions, activityResults, summaries } = await this.getCollections();
    const session = await sessions.findOne(
      { sessionId },
      { projection: { _id: 0 } }
    );

    if (!session) {
      return null;
    }

    const [results, summary] = await Promise.all([
      activityResults
        .find({ sessionId }, { projection: { _id: 0 } })
        .toArray(),
      summaries.findOne({ sessionId }, { projection: { _id: 0 } })
    ]);

    return {
      ...session,
      activityResults: results,
      summary
    };
  }

  async listSessions(query: SessionListQuery): Promise<{
    items: Document[];
    total: number;
  }> {
    const { sessions, summaries } = await this.getCollections();
    const filter: Document = {};

    if (query.participantCode) {
      filter.participantCode = { $regex: escapeRegex(query.participantCode), $options: "i" };
    }
    if (query.status) filter.status = query.status;
    if (query.dateFrom || query.dateTo) {
      filter.startedAt = {};
      if (query.dateFrom) filter.startedAt.$gte = query.dateFrom;
      if (query.dateTo) filter.startedAt.$lte = query.dateTo;
    }

    const [documents, total] = await Promise.all([
      sessions
        .find(filter, { projection: { _id: 0 } })
        .sort({ startedAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .toArray(),
      sessions.countDocuments(filter)
    ]);
    const sessionIds = documents.map((document) => document.sessionId as string);
    const sessionSummaries = sessionIds.length
      ? await summaries
          .find({ sessionId: { $in: sessionIds } }, {
            projection: { _id: 0, sessionId: 1, sampleCount: 1 }
          })
          .toArray()
      : [];
    const sampleCounts = new Map(
      sessionSummaries.map((summary) => [summary.sessionId, summary.sampleCount])
    );

    return {
      items: documents.map((document) => ({
        ...document,
        sampleCount: sampleCounts.get(document.sessionId) ?? null
      })),
      total
    };
  }

  async getSessionTimeline(sessionId: string, maxPoints: number): Promise<{
    samples: Document[];
    events: Document[];
  }> {
    const { samples, events } = await this.getCollections();
    const totalSamples = await samples.countDocuments({ sessionId });
    const stride = Math.max(1, Math.ceil(totalSamples / maxPoints));
    const pipeline: Document[] = [
      { $match: { sessionId } },
      { $sort: { elapsedMs: 1 } },
      { $project: {
        _id: 0,
        elapsedMs: 1,
        capturedAt: 1,
        scenarioId: 1,
        activityId: 1,
        blockNumber: 1,
        condition: 1,
        "upperCamera.head.movementMagnitude": 1,
        "upperCamera.head.orientationDeviation": 1,
        "upperCamera.head.onTaskOrientation": 1,
        "upperCamera.trunk.movementMagnitude": 1,
        "fullBodyCamera.globalMotorActivity": 1
      } }
    ];

    if (stride > 1) {
      pipeline.push(
        { $group: {
          _id: { $floor: { $divide: ["$elapsedMs", stride * 200] } },
          sample: { $first: "$$ROOT" }
        } },
        { $replaceRoot: { newRoot: "$sample" } },
        { $sort: { elapsedMs: 1 } },
        { $limit: maxPoints }
      );
    }

    const [timelineSamples, timelineEvents] = await Promise.all([
      samples.aggregate(pipeline).toArray(),
      events
        .find({ sessionId }, { projection: { _id: 0, sessionId: 0, receivedAt: 0 } })
        .sort({ elapsedMs: 1 })
        .toArray()
    ]);

    return { samples: timelineSamples, events: timelineEvents };
  }

  async getSamplesForSummary(sessionId: string): Promise<BehaviorSampleDto[]> {
    const { samples } = await this.getCollections();
    const documents = await samples
      .find({ sessionId }, { projection: { _id: 0, receivedAt: 0 } })
      .sort({ elapsedMs: 1 })
      .toArray();

    return behaviorSampleSchema.array().parse(documents);
  }

  async getEventsForSummary(sessionId: string): Promise<BehaviorEventDto[]> {
    const { events } = await this.getCollections();
    const documents = await events
      .find({ sessionId }, { projection: { _id: 0, receivedAt: 0 } })
      .sort({ elapsedMs: 1 })
      .toArray();

    return behaviorEventSchema.array().parse(documents);
  }

  async saveSummary(sessionId: string, summary: Document): Promise<void> {
    const { summaries } = await this.getCollections();

    await summaries.updateOne(
      { sessionId },
      {
        $set: {
          ...summary,
          sessionId,
          generatedAt: new Date()
        }
      },
      { upsert: true }
    );
  }

  private async getCollections(): Promise<AnalysisCollections> {
    const database = await this.database.connect();
    const collections: AnalysisCollections = {
      participants: database.collection("participants"),
      sessions: database.collection("evaluation_sessions"),
      samples: database.collection("behavior_samples"),
      events: database.collection("behavior_events"),
      activityResults: database.collection("activity_results"),
      summaries: database.collection("session_summaries")
    };

    await this.ensureIndexes(collections);
    return collections;
  }

  private async ensureIndexes(collections: AnalysisCollections): Promise<void> {
    if (this.indexesInitialized) {
      return;
    }

    this.indexInitialization ??= this.createIndexes(collections);

    try {
      await this.indexInitialization;
      this.indexesInitialized = true;
    } finally {
      this.indexInitialization = null;
    }
  }

  private async createIndexes(collections: AnalysisCollections): Promise<void> {
    await Promise.all([
      collections.participants.createIndex(
        { participantCode: 1 },
        { unique: true, name: "participantCode_unique" }
      ),
      collections.sessions.createIndex(
        { sessionId: 1 },
        { unique: true, name: "sessionId_unique" }
      ),
      collections.sessions.createIndex(
        { participantCode: 1, startedAt: -1 },
        { name: "participant_sessions" }
      ),
      collections.samples.createIndex(
        { sessionId: 1, sampleId: 1 },
        { unique: true, name: "session_sample_unique" }
      ),
      collections.samples.createIndex(
        { sessionId: 1, elapsedMs: 1 },
        { name: "session_elapsed" }
      ),
      collections.samples.createIndex(
        { sessionId: 1, scenarioId: 1 },
        { name: "session_scenario" }
      ),
      collections.samples.createIndex(
        { sessionId: 1, condition: 1 },
        { name: "session_condition" }
      ),
      collections.events.createIndex(
        { sessionId: 1, eventId: 1 },
        { unique: true, name: "session_event_unique" }
      ),
      collections.events.createIndex(
        { sessionId: 1, elapsedMs: 1 },
        { name: "event_session_elapsed" }
      ),
      collections.activityResults.createIndex(
        { sessionId: 1, scenarioId: 1, activityId: 1 },
        { unique: true, name: "session_scenario_activity_unique" }
      ),
      collections.summaries.createIndex(
        { sessionId: 1 },
        { unique: true, name: "summary_session_unique" }
      )
    ]);
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
