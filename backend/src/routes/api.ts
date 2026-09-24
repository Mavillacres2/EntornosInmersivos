import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import type { AppConfig } from "../config/env.js";
import type { MongoDatabase } from "../database/MongoDatabase.js";
import { ApiError } from "../middleware/errors.js";
import type { AnalysisService } from "../services/AnalysisService.js";
import {
  activityResultSchema,
  createBehaviorBatchSchema,
  createEventBatchSchema,
  createSessionSchema,
  finishSessionSchema
} from "../validation/schemas.js";

type AsyncRoute = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<void>;

const sessionIdSchema = z.uuid();
const sessionListQuerySchema = z.object({
  participantCode: z.string().trim().max(40).optional(),
  status: z.enum(["active", "finished"]).optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10)
});
const timelineQuerySchema = z.object({
  maxPoints: z.coerce.number().int().min(50).max(2000).default(600)
});

export function createApiRouter(
  config: AppConfig,
  database: MongoDatabase,
  service: AnalysisService
): Router {
  const router = Router();
  const behaviorBatchSchema = createBehaviorBatchSchema(config.maxBatchSize);
  const eventBatchSchema = createEventBatchSchema(config.maxBatchSize);

  router.get(
    "/health",
    asyncRoute(async (_request, response) => {
      const databaseAvailable = await database.ping();

      response.status(databaseAvailable ? 200 : 503).json({
        status: databaseAvailable ? "ok" : "degraded",
        database: databaseAvailable ? "connected" : "unavailable",
        timestamp: new Date().toISOString()
      });
    })
  );

  router.post(
    "/sessions",
    asyncRoute(async (request, response) => {
      const payload = createSessionSchema.parse(request.body);
      const session = await service.createSession(payload);

      response.status(201).json({ session });
    })
  );

  router.get(
    "/sessions",
    asyncRoute(async (request, response) => {
      const query = sessionListQuerySchema.parse(request.query);
      const result = await service.listSessions({
        ...query,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined
      });
      response.json(result);
    })
  );

  router.get(
    "/sessions/:sessionId/timeline",
    asyncRoute(async (request, response) => {
      const sessionId = parseSessionId(request.params.sessionId);
      const { maxPoints } = timelineQuerySchema.parse(request.query);
      response.json(await service.getSessionTimeline(sessionId, maxPoints));
    })
  );

  router.post(
    "/sessions/:sessionId/behavior/batch",
    asyncRoute(async (request, response) => {
      const sessionId = parseSessionId(request.params.sessionId);
      const payload = behaviorBatchSchema.parse(request.body);
      const inserted = await service.addBehaviorSamples(sessionId, payload.samples);

      response.status(202).json({ accepted: payload.samples.length, inserted });
    })
  );

  router.post(
    "/sessions/:sessionId/events/batch",
    asyncRoute(async (request, response) => {
      const sessionId = parseSessionId(request.params.sessionId);
      const payload = eventBatchSchema.parse(request.body);
      const inserted = await service.addBehaviorEvents(sessionId, payload.events);

      response.status(202).json({ accepted: payload.events.length, inserted });
    })
  );

  router.post(
    "/sessions/:sessionId/activity-results",
    asyncRoute(async (request, response) => {
      const sessionId = parseSessionId(request.params.sessionId);
      const payload = activityResultSchema.parse(request.body);

      await service.addActivityResult(sessionId, payload);
      response.status(202).json({ accepted: true });
    })
  );

  router.post(
    "/sessions/:sessionId/finish",
    asyncRoute(async (request, response) => {
      const sessionId = parseSessionId(request.params.sessionId);
      const payload = finishSessionSchema.parse(request.body);
      const summary = await service.finishSession(sessionId, payload);

      response.json({ summary });
    })
  );

  router.get(
    "/sessions/:sessionId",
    asyncRoute(async (request, response) => {
      const sessionId = parseSessionId(request.params.sessionId);
      const session = await service.getSession(sessionId);

      response.json({ session });
    })
  );

  return router;
}

function parseSessionId(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    throw new ApiError(400, "sessionId invalido");
  }

  const result = sessionIdSchema.safeParse(value);

  if (!result.success) {
    throw new ApiError(400, "sessionId invalido");
  }

  return result.data;
}

function asyncRoute(handler: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction): void => {
    void handler(request, response, next).catch(next);
  };
}
