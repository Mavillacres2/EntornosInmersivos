import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../app.js";
import type { AppConfig } from "../config/env.js";
import type { MongoDatabase } from "../database/MongoDatabase.js";
import type { AnalysisService } from "../services/AnalysisService.js";
import { passwordHash } from '../middleware/SpecialistAuth.js';
const testPassword='test-only-password-123';
const testHash=await passwordHash(testPassword);

const config: AppConfig = {
  port: 0,
  mongodbUri: "mongodb://unused",
  mongodbDbName: "test",
  corsOrigins: ["http://localhost:5173", "http://localhost:5174"],
  maxBatchSize: 10,
  mongodbConnectTimeoutMs: 50,
  production: false
  ,specialistPasswordHash:testHash
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

test("session listing validates filters and returns pagination", async (context) => {
  let receivedPage = 0;
  const { baseUrl } = await startTestApp(context, true, () => undefined, {
    listSessions: async (query: { page: number }) => {
      receivedPage = query.page;
      return { items: [], pagination: { page: query.page, pageSize: 10, total: 0, totalPages: 0 } };
    }
  });
  const response = await fetch(`${baseUrl}/api/sessions?page=2&pageSize=10&status=finished`,{headers:{Cookie:await login(baseUrl)}});

  assert.equal(response.status, 200);
  assert.equal(receivedPage, 2);
  assert.equal((await response.json() as { pagination: { page: number } }).pagination.page, 2);
});

test("session timeline rejects invalid identifiers", async (context) => {
  const { baseUrl } = await startTestApp(context, true);
  const response = await fetch(`${baseUrl}/api/sessions/not-a-uuid/timeline`,{headers:{Cookie:await login(baseUrl)}});

  assert.equal(response.status, 400);
});

async function startTestApp(
  context: test.TestContext,
  databaseAvailable: boolean,
  onCreateSession: () => void = () => undefined,
  serviceOverrides: Partial<AnalysisService> = {},configOverrides:Partial<AppConfig>={}
): Promise<{ baseUrl: string }> {
  const database = {
    ping: async () => databaseAvailable
  } as unknown as MongoDatabase;
  const service = {
    createSession: async (payload: unknown) => {
      onCreateSession();
      return payload;
    },
    ...serviceOverrides
  } as unknown as AnalysisService;
  const app = createApp({...config,...configOverrides}, database, service);
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

async function login(baseUrl:string):Promise<string>{const response=await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:testPassword})});assert.equal(response.status,200);return response.headers.get('set-cookie')!.split(';')[0]!;}

test('specialist reads require backend authentication and locking revokes access',async context=>{
  const {baseUrl}=await startTestApp(context,true,()=>{}, {listSessions:async()=>({items:[]})});
  assert.equal((await fetch(`${baseUrl}/api/sessions`)).status,401);
  const cookie=await login(baseUrl);
  assert.equal((await fetch(`${baseUrl}/api/sessions`,{headers:{Cookie:cookie}})).status,200);
  await fetch(`${baseUrl}/api/auth/lock`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});
  assert.equal((await fetch(`${baseUrl}/api/sessions`,{headers:{Cookie:cookie}})).status,401);
});

test('wrong passwords do not grant access and repeated attempts are limited',async context=>{
  const {baseUrl}=await startTestApp(context,true);
  for(let i=0;i<5;i++)assert.equal((await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})})).status,401);
  assert.equal((await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:testPassword})})).status,429);
});

test('unconfigured specialist access fails closed without preventing child uploads',async context=>{
  const {baseUrl}=await startTestApp(context,true,()=>{}, {},{specialistPasswordHash:undefined});
  assert.equal((await fetch(`${baseUrl}/api/sessions`)).status,401);
  assert.equal((await fetch(`${baseUrl}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:testPassword})})).status,503);
  assert.equal((await fetch(`${baseUrl}/api/auth/lock`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,200);
});

test('child completion response never exposes specialist indicators',async context=>{
  const {baseUrl}=await startTestApp(context,true,()=>{}, {finishSession:async()=>({offTaskOrientationPercentage:42})});
  const response=await fetch(`${baseUrl}/api/sessions/00000000-0000-4000-8000-000000000001/finish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({finishedAt:new Date().toISOString(),scenariosCompleted:[]})});
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{sessionFinished:true});
});
