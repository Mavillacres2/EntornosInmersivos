import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../app.js";
import type { AppConfig } from "../config/env.js";
import type { MongoDatabase } from "../database/MongoDatabase.js";
import type { AnalysisService } from "../services/AnalysisService.js";

const config: AppConfig = {
  port: 0,
  mongodbUri: "mongodb://unused",
  mongodbDbName: "test",
  corsOrigins: ["http://localhost:5173", "http://localhost:5174"],
  maxBatchSize: 10,
  mongodbConnectTimeoutMs: 50,
  production: false
};

test("health reports connected database", async (context) => {
  const { baseUrl } = await startTestApp(context, true);
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.equal((await response.json() as { status: string }).status, "ok");
});

test("health degrades without crashing when MongoDB is unavailable", async (context) => {
  const { baseUrl } = await startTestApp(context, false);
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 503);
  assert.equal((await response.json() as { status: string }).status, "degraded");
});

test("API rejects camera frames before calling session service", async (context) => {
  let createSessionCalls = 0;
  const { baseUrl } = await startTestApp(context, true, () => {
    createSessionCalls += 1;
  });
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "00000000-0000-4000-8000-000000000001",
      participantCode: "P001",
      startedAt: new Date(0).toISOString(),
      cameraConfiguration: {
        upperBodyCameraConfigured: true,
        fullBodyCameraConfigured: true
      },
      frameData: [1, 2, 3]
    })
  });

  assert.equal(response.status, 400);
  assert.equal(createSessionCalls, 0);
});

test("API classifies malformed JSON as a client error", async (context) => {
  const { baseUrl } = await startTestApp(context, true);
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not-json"
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "JSON invalido" });
});

test("CORS allows the Vite fallback port 5174", async (context) => {
  const { baseUrl } = await startTestApp(context, true);
  const response = await fetch(`${baseUrl}/api/sessions`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:5174",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type"
    }
  });

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "http://localhost:5174"
  );
});

async function startTestApp(
  context: test.TestContext,
  databaseAvailable: boolean,
  onCreateSession: () => void = () => undefined
): Promise<{ baseUrl: string }> {
  const database = {
    ping: async () => databaseAvailable
  } as unknown as MongoDatabase;
  const service = {
    createSession: async (payload: unknown) => {
      onCreateSession();
      return payload;
    }
  } as unknown as AnalysisService;
  const app = createApp(config, database, service);
  const server = app.listen(0);

  await new Promise<void>((resolve) => server.once("listening", resolve));
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );
  const address = server.address() as AddressInfo;

  return { baseUrl: `http://127.0.0.1:${address.port}` };
}
