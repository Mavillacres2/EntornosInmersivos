import cors from "cors";
import express from "express";
import helmet from "helmet";

import type { AppConfig } from "./config/env.js";
import type { MongoDatabase } from "./database/MongoDatabase.js";
import { ApiError, createErrorHandler } from "./middleware/errors.js";
import { createApiRouter } from "./routes/api.js";
import type { AnalysisService } from "./services/AnalysisService.js";
import { containsForbiddenMediaData } from "./validation/schemas.js";

export function createApp(
  config: AppConfig,
  database: MongoDatabase,
  service: AnalysisService
) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new ApiError(403, "Origen CORS no permitido"));
      },
      methods: ["GET", "POST"],
      maxAge: 600
    })
  );
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use((request, _response, next) => {
    if (containsForbiddenMediaData(request.body)) {
      next(
        new ApiError(
          400,
          "El API no acepta imagenes, video, frames, blobs ni datos multimedia"
        )
      );
      return;
    }

    next();
  });
  app.use("/api", createApiRouter(config, database, service));
  app.use((_request, _response, next) => {
    next(new ApiError(404, "Endpoint no encontrado"));
  });
  app.use(createErrorHandler(config.production));

  return app;
}
