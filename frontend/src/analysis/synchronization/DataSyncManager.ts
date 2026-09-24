import type { AnalysisApiClient } from "../api/AnalysisApiClient";
import { BehaviorDataBuffer } from "../buffer/BehaviorDataBuffer";
import type { AnalysisConfig } from "../config/AnalysisConfig";
import type { VisionMetrics } from "../types/AnalysisTypes";
import type { AnalysisPerformanceSnapshot } from "../types/AnalysisTypes";
import type {
  ActivityResultEnvelope,
  ActivityContext,
  BehaviorEvent,
  BehaviorEventType,
  BehaviorSample,
  FullBodyBehaviorFeatures,
  HeadBehaviorFeatures,
  MovementBehaviorFeatures,
  TrunkBehaviorFeatures
} from "../types/BehaviorTypes";
import type { AnalysisSessionManager } from "../tracking/AnalysisSessionManager";
import type {
  ActivityAdapterEvent,
  ActivityContextAdapter
} from "./ActivityContextAdapter";

interface SynchronizedFeatures {
  vision?: VisionMetrics;
  head: HeadBehaviorFeatures;
  trunk: TrunkBehaviorFeatures;
  fullBody: FullBodyBehaviorFeatures;
  motorActivity: MovementBehaviorFeatures;
  performance: AnalysisPerformanceSnapshot;
}

export class DataSyncManager {
  private readonly buffer: BehaviorDataBuffer;
  private readonly pendingActivityResults: ActivityResultEnvelope[] = [];
  private readonly completedScenarios = new Set<string>();
  private readonly distractorEndTimeouts = new Set<number>();
  private unsubscribeAdapter: (() => void) | null = null;
  private resultFlushIntervalId: number | null = null;
  private readonly adapter: ActivityContextAdapter;
  private readonly apiClient: AnalysisApiClient;
  private readonly sessionManager: AnalysisSessionManager;

  constructor(
    adapter: ActivityContextAdapter,
    apiClient: AnalysisApiClient,
    sessionManager: AnalysisSessionManager,
    config: AnalysisConfig
  ) {
    this.adapter = adapter;
    this.apiClient = apiClient;
    this.sessionManager = sessionManager;
    this.buffer = new BehaviorDataBuffer(
      {
        sendSamples: async (samples) => {
          if (!(await this.sessionManager.ensureRemoteSession())) {
            throw new Error("La sesion aun no existe en el backend.");
          }

          const sessionId = this.requireSessionId();
          await this.apiClient.sendBehaviorBatch(sessionId, samples);
        },
        sendEvents: async (events) => {
          if (!(await this.sessionManager.ensureRemoteSession())) {
            throw new Error("La sesion aun no existe en el backend.");
          }

          const sessionId = this.requireSessionId();
          await this.apiClient.sendEventBatch(sessionId, events);
        }
      },
      {
        batchSize: config.batchSize,
        flushIntervalMs: config.batchIntervalMs,
        maxSamples: config.maxBufferedSamples,
        maxEvents: config.maxBufferedEvents,
        onOverflow: (kind, dropped) => {
          console.warn(`Buffer de ${kind} lleno; se descartaron ${dropped} registros antiguos.`);
        }
      }
    );
  }

  start(): void {
    this.buffer.start();
    this.unsubscribeAdapter ??= this.adapter.onEvent((event) => {
      this.handleAdapterEvent(event);
    });
    this.resultFlushIntervalId ??= window.setInterval(() => {
      void this.flushActivityResults();
    }, 4000);
  }

  recordFeatures(features: SynchronizedFeatures): void {
    const context = this.adapter.getContext();

    if (!context.sessionId) {
      return;
    }

    const sample: BehaviorSample = {
      sampleId: crypto.randomUUID(),
      sessionId: context.sessionId,
      elapsedMs: context.elapsedSessionTimeMs,
      capturedAt: new Date().toISOString(),
      scenarioId: context.scenarioId,
      activityId: context.activityId,
      activityState: context.activityState,
      blockNumber: context.blockNumber,
      condition: context.condition,
      trialNumber: context.trialNumber,
      globalTrialNumber: context.globalTrialNumber,
      stimulus: {
        id: context.stimulusId,
        type: context.stimulusType
      },
      distractor: {
        active: context.distractorActive,
        id: context.distractorId,
        type: context.distractorType,
        startedAtElapsedMs: context.distractorStartedAtElapsedMs,
        endedAtElapsedMs: context.distractorEndedAtElapsedMs
      },
      upperCamera: {
        head: features.head,
        trunk: features.trunk,
        available: features.head.available || features.trunk.available,
        quality: features.head.available
          ? features.head.quality
          : features.trunk.quality
      },
      fullBodyCamera: features.fullBody,
      motorActivity: features.motorActivity,
      analysisPerformance: features.performance,
      ...(features.vision ? { vision: this.toSessionVision(features.vision), trunkSource: "upper-camera" as const } : {})
    };

    this.buffer.pushSample(sample);
  }

  private toSessionVision(vision: VisionMetrics): VisionMetrics {
    const elapsed = (timestamp: number) => this.adapter.getContext(timestamp).elapsedSessionTimeMs;
    return {
      face: vision.face ? { ...vision.face, timestampMs: elapsed(vision.face.timestampMs),
        eyes: vision.face.eyes ? { ...vision.face.eyes, timestampMs: elapsed(vision.face.eyes.timestampMs) } : null } : null,
      body: vision.body ? { ...vision.body, timestampMs: elapsed(vision.body.timestampMs),
        poseTimestampMs: vision.body.poseTimestampMs === null ? null : elapsed(vision.body.poseTimestampMs),
        handsTimestampMs: vision.body.handsTimestampMs === null ? null : elapsed(vision.body.handsTimestampMs),
        hands: vision.body.hands.map(hand => ({ ...hand, position: { ...hand.position } })) } : null
    };
  }

  recordBehaviorEvent(
    type: BehaviorEventType,
    details?: BehaviorEvent["details"],
    elapsedMs?: number,
    contextOverride?: ActivityContext
  ): void {
    const context = contextOverride ?? this.adapter.getContext();

    if (!context.sessionId) {
      return;
    }

    this.buffer.pushEvent({
      eventId: crypto.randomUUID(),
      sessionId: context.sessionId,
      elapsedMs: elapsedMs ?? context.elapsedSessionTimeMs,
      occurredAt: new Date().toISOString(),
      type,
      scenarioId: context.scenarioId,
      activityId: context.activityId,
      blockNumber: context.blockNumber,
      condition: context.condition,
      trialNumber: context.trialNumber,
      details
    });
  }

  getBufferSize(): { samples: number; events: number } {
    return this.buffer.getSize();
  }

  getCompletedScenarios(): string[] {
    return [...this.completedScenarios];
  }

  async flushFinal(): Promise<boolean> {
    const resultsFlushed = await this.flushActivityResults();
    const behaviorFlushed = await this.buffer.flushAll();

    return resultsFlushed && behaviorFlushed;
  }

  dispose(): void {
    this.buffer.stop();
    this.unsubscribeAdapter?.();
    this.unsubscribeAdapter = null;

    if (this.resultFlushIntervalId !== null) {
      window.clearInterval(this.resultFlushIntervalId);
      this.resultFlushIntervalId = null;
    }

    this.distractorEndTimeouts.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    this.distractorEndTimeouts.clear();
  }

  clearSentData(): void {
    this.buffer.clear();
    this.pendingActivityResults.length = 0;
  }

  private handleAdapterEvent(event: ActivityAdapterEvent): void {
    if (event.type === "activity-result") {
      this.completedScenarios.add(event.scenarioId);
      this.pendingActivityResults.push({
        resultId: crypto.randomUUID(),
        scenarioId: event.scenarioId,
        activityId: event.activityId,
        completedAt: new Date().toISOString(),
        result: sanitizeResult(event.result)
      });
      void this.flushActivityResults();
      return;
    }

    this.recordBehaviorEvent(
      "DISTRACTOR_STARTED",
      {
        distractorId: event.event.distractorId,
        distractorType: event.event.distractorType,
        durationMs: Math.max(0, event.endedAtElapsedMs - event.startedAtElapsedMs)
      },
      event.startedAtElapsedMs,
      event.context
    );
    const delayMs = Math.max(0, event.event.endedAt - performance.now());
    const timeoutId = window.setTimeout(() => {
      this.distractorEndTimeouts.delete(timeoutId);
      this.recordBehaviorEvent(
        "DISTRACTOR_ENDED",
        {
          distractorId: event.event.distractorId,
          distractorType: event.event.distractorType,
          durationMs: Math.max(0, event.endedAtElapsedMs - event.startedAtElapsedMs)
        },
        event.endedAtElapsedMs,
        event.context
      );
    }, delayMs);

    this.distractorEndTimeouts.add(timeoutId);
  }

  private async flushActivityResults(): Promise<boolean> {
    if (this.pendingActivityResults.length === 0) {
      return true;
    }

    if (!(await this.sessionManager.ensureRemoteSession())) {
      return false;
    }

    const sessionId = this.requireSessionId();

    while (this.pendingActivityResults.length > 0) {
      const result = this.pendingActivityResults[0];

      if (!result) {
        return true;
      }

      try {
        await this.apiClient.sendActivityResult(sessionId, result);
        this.pendingActivityResults.shift();
      } catch {
        return false;
      }
    }

    return true;
  }

  private requireSessionId(): string {
    const sessionId = this.sessionManager.getSession()?.sessionId;

    if (!sessionId) {
      throw new Error("No existe una sesion de evaluacion activa.");
    }

    return sessionId;
  }
}

function sanitizeResult(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(value) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((child) => sanitizeValue(child));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) =>
        child === undefined ? [] : [[key, sanitizeValue(child)]]
      )
    );
  }

  return null;
}
