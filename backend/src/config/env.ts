import "dotenv/config";

export interface AppConfig {
  port: number;
  mongodbUri: string;
  mongodbDbName: string;
  corsOrigins: string[];
  maxBatchSize: number;
  mongodbConnectTimeoutMs: number;
  production: boolean;
}

function readPositiveInteger(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  return {
    port: readPositiveInteger("PORT", 3001),
    mongodbUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017",
    mongodbDbName: process.env.MONGODB_DB_NAME ?? "entornos_inmersivos",
    corsOrigins: (
      process.env.CORS_ORIGIN ??
      [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
      ].join(",")
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxBatchSize: Math.min(readPositiveInteger("MAX_BATCH_SIZE", 250), 500),
    mongodbConnectTimeoutMs: readPositiveInteger(
      "MONGODB_CONNECT_TIMEOUT_MS",
      3000
    ),
    production: process.env.NODE_ENV === "production"
  };
}
