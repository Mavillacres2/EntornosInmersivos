import { unavailableHeadFeatures } from "../features/HeadFeatureExtractor";
import { unavailableTrunkFeatures } from "../features/TrunkFeatureExtractor";
import { unavailableFullBodyFeatures } from "../features/FullBodyFeatureExtractor";
import { unavailableMovementFeatures } from "../features/MovementFeatureExtractor";
import type { VisionMetrics } from "../types/AnalysisTypes";
import type { BehaviorSample } from "../types/BehaviorTypes";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisApiClient } from "../api/AnalysisApiClient";
import { ANALYSIS_CONFIG } from "../config/AnalysisConfig";
import { ActivityContextAdapter } from "../synchronization/ActivityContextAdapter";
import { DataSyncManager } from "../synchronization/DataSyncManager";
import type { AnalysisSessionManager } from "../tracking/AnalysisSessionManager";
import type { BehaviorEvent } from "../types/BehaviorTypes";

describe("DataSyncManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("copia m?tricas, preserva contexto y convierte timestamps de inferencia a sesi?n", async () => {
    const sendBehaviorBatch = vi.fn(async (_id: string, _samples: BehaviorSample[]) => undefined);
    const adapter = new ActivityContextAdapter();
    adapter.startSession("session-1", 1000);
    adapter.setScenario("classroom", "go-no-go");
    const manager = new DataSyncManager(adapter,
      { sendBehaviorBatch, sendEventBatch: async () => undefined } as unknown as AnalysisApiClient,
      { ensureRemoteSession: async () => true, getSession: () => ({ sessionId: "session-1" }) } as unknown as AnalysisSessionManager,
      ANALYSIS_CONFIG);
    const vision: VisionMetrics = { face: { source: "face-camera", timestampMs: 1100, eyes: null }, body: null };
    manager.recordFeatures({ head: unavailableHeadFeatures(), trunk: unavailableTrunkFeatures(),
      fullBody: unavailableFullBodyFeatures(), motorActivity: unavailableMovementFeatures(),
      performance: { upperAnalysisFps: 8, fullBodyAnalysisFps: 4, renderFps: 60 }, vision });
    vision.face!.timestampMs = 9999;
    adapter.setScenario("space-station", "cpt");
    expect(await manager.flushFinal()).toBe(true);
    expect(sendBehaviorBatch.mock.calls[0]?.[1][0]).toMatchObject({
      scenarioId: "classroom", activityId: "go-no-go", trunkSource: "upper-camera",
      vision: { face: { timestampMs: 100 } }
    });
    manager.dispose();
  });

  it("conserva el contexto original al cerrar un distractor", async () => {
    const sendEventBatch = vi.fn(async (_sessionId: string, _events: BehaviorEvent[]) => undefined);
    const apiClient = {
      sendBehaviorBatch: vi.fn(async () => undefined),
      sendEventBatch,
      sendActivityResult: vi.fn(async () => undefined)
    } as unknown as AnalysisApiClient;
    const sessionManager = {
      ensureRemoteSession: vi.fn(async () => true),
      getSession: vi.fn(() => ({ sessionId: "session-1" }))
    } as unknown as AnalysisSessionManager;
    const adapter = new ActivityContextAdapter();
    const manager = new DataSyncManager(
      adapter,
      apiClient,
      sessionManager,
      ANALYSIS_CONFIG
    );

    adapter.startSession("session-1", performance.now());
    adapter.setScenario("classroom", "go-no-go");
    const telemetry = adapter.createTelemetrySink("classroom", "go-no-go");

    telemetry.onBlockStart({ blockNumber: 2, condition: "visual" });
    telemetry.onTrialStart({
      trialNumber: 4,
      globalTrialNumber: 19,
      stimulusId: "go",
      stimulusType: "go"
    });
    manager.start();
    const startedAt = performance.now();

    telemetry.onDistractor({
      distractorId: "visual-2-4",
      distractorType: "visual",
      startedAt,
      endedAt: startedAt + 100
    });
    adapter.setScenario("space-station", "cpt");
    await vi.advanceTimersByTimeAsync(100);

    expect(await manager.flushFinal()).toBe(true);
    const events = sendEventBatch.mock.calls[0]?.[1] ?? [];

    expect(events.map((event) => event.type)).toEqual([
      "DISTRACTOR_STARTED",
      "DISTRACTOR_ENDED"
    ]);
    expect(events[1]).toMatchObject({
      scenarioId: "classroom",
      activityId: "go-no-go",
      blockNumber: 2,
      trialNumber: 4
    });
    manager.dispose();
  });
});
