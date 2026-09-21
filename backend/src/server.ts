import { createServer } from "node:http";

import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { MongoDatabase } from "./database/MongoDatabase.js";
import { AnalysisRepository } from "./repositories/AnalysisRepository.js";
import { AnalysisService } from "./services/AnalysisService.js";

const config = loadConfig();
const database = new MongoDatabase(config);
const repository = new AnalysisRepository(database);
const service = new AnalysisService(repository);
const app = createApp(config, database, service);
const server = createServer(app);

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `No se pudo iniciar el backend: el puerto ${config.port} ya esta en uso. ` +
        "Deten la otra instancia con Ctrl+C o configura otro PORT en backend/.env."
    );
    process.exit(1);
  }

  console.error("No se pudo iniciar el backend.", error);
  process.exit(1);
});

repository.initializeIndexes().catch((error: unknown) => {
  console.warn(
    "MongoDB no esta disponible al iniciar. El API seguira activo y reintentara en cada solicitud.",
    error instanceof Error ? error.message : error
  );
});

server.listen(config.port, () => {
  console.log(`Analysis API escuchando en http://localhost:${config.port}`);
});

const shutdown = (): void => {
  server.close(() => {
    void database.close().finally(() => process.exit(0));
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
