import { afterEach, describe, expect, it, vi } from "vitest";

import type { PhysicalCameraRole } from "../cameras/CameraTypes";
import type { AnalysisConfig } from "../config/AnalysisConfig";
import {
  analysisPerformanceFactor,
  BehaviorTrackingManager,
  selectAnalysisRole
} from "../tracking/BehaviorTrackingManager";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analysis camera scheduler", () => {
  it("respeta la unica camara cuyo intervalo esta vencido", () => {
    expect(selectAnalysisRole(true, false, "full-body")).toBe("upper-body");
    expect(selectAnalysisRole(false, true, "upper-body")).toBe("full-body");
    expect(selectAnalysisRole(false, false, "upper-body")).toBeNull();
  });

  it("alterna CAM1 y CAM2 cuando ambas permanecen vencidas", () => {
    let preferredRole: PhysicalCameraRole = "upper-body";
    const selectedRoles: PhysicalCameraRole[] = [];

    for (let index = 0; index < 6; index += 1) {
      const selectedRole = selectAnalysisRole(true, true, preferredRole);

      expect(selectedRole).not.toBeNull();
      selectedRoles.push(selectedRole as PhysicalCameraRole);
      preferredRole = selectedRole === "upper-body" ? "full-body" : "upper-body";
    }

    expect(selectedRoles).toEqual([
      "upper-body",
      "full-body",
      "upper-body",
      "full-body",
      "upper-body",
      "full-body"
    ]);
  });

  it("reduce gradualmente el analisis cuando cae el FPS de Babylon", () => {
    expect(analysisPerformanceFactor(null)).toBe(1);
    expect(analysisPerformanceFactor(60)).toBe(1);
    expect(analysisPerformanceFactor(45)).toBe(0.75);
    expect(analysisPerformanceFactor(32)).toBe(0.5);
    expect(analysisPerformanceFactor(20)).toBe(0.33);
  });

  it("suspende el preview durante la prueba y lo reanuda una sola vez", async () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const frameId = nextFrameId;

      nextFrameId += 1;
      callbacks.set(frameId, callback);
      return frameId;
    });
    const cancelAnimationFrame = vi.fn((frameId: number) => {
      callbacks.delete(frameId);
    });

    vi.stubGlobal("window", { requestAnimationFrame, cancelAnimationFrame });
    vi.stubGlobal("HTMLMediaElement", { HAVE_CURRENT_DATA: 2 });

    const stream = {
      active: true,
      getVideoTracks: () => [{ readyState: "live" }]
    } as unknown as MediaStream;
    const upperVideo = createReadyVideo(stream);
    const fullBodyVideo = createReadyVideo(stream);
    const cameraManager = {
      getVideoElement: (role: PhysicalCameraRole) =>
        role === "upper-body" ? upperVideo : fullBodyVideo,
      getStatus: () => ({
        permissionGranted: true,
        devices: [
          { deviceId: "cam1", groupId: "g1", label: "CAM1" },
          { deviceId: "cam2", groupId: "g2", label: "CAM2" }
        ],
        upperBody: {
          role: "upper-body",
          selectedDeviceId: "cam1",
          state: "streaming",
          error: null,
          streamActive: true
        },
        fullBody: {
          role: "full-body",
          selectedDeviceId: "cam2",
          state: "streaming",
          error: null,
          streamActive: true
        }
      })
    };
    const analyzeUpperBody = vi.fn(() => ({
      timestampMs: performance.now(),
      headOrientation: { yaw: 0, pitch: 0, roll: 0 },
      faceLandmarks: [],
      faceDetected: true,
      poseLandmarks: createLandmarks(),
      quality: "good" as const
    }));
    const analyzeFullBody = vi.fn(() => ({
      timestampMs: performance.now(),
      poseLandmarks: createLandmarks(),
      quality: "good" as const,
      requiredLandmarksVisible: true,
      diagnostics: {
        detectionAttempted: true,
        poseDetected: true,
        landmarkCount: 33,
        averageVisibility: 0.9,
        detectionTimestampMs: performance.now(),
        error: null
      }
    }));
    const mediaPipeManager = {
      initialize: vi.fn(async () => undefined),
      analyzeUpperBody,
      analyzeFullBody
    };
    const manager = new BehaviorTrackingManager(
      TEST_CONFIG,
      cameraManager as never,
      mediaPipeManager as never,
      {} as never,
      {} as never
    );

    await manager.startCameraPreview(() => undefined);
    expect(callbacks.size).toBe(1);

    const checkPromise = manager.checkCameraPosition(1);

    await Promise.resolve();
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(1);

    const [sampleFrameId, sampleCallback] = [...callbacks.entries()][0] ?? [];

    expect(sampleCallback).toBeTypeOf("function");
    if (sampleFrameId !== undefined && sampleCallback) {
      callbacks.delete(sampleFrameId);
      sampleCallback(performance.now());
    }

    await checkPromise;

    expect(analyzeUpperBody).toHaveBeenCalledTimes(1);
    expect(analyzeFullBody).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(1);
    manager.dispose();
  });
});

const TEST_CONFIG: AnalysisConfig = {
  apiBaseUrl: "http://localhost:3001/api",
  debug: false,
  camera: { idealWidth: 640, idealHeight: 480, idealFrameRate: 30 },
  mediaPipe: {
    wasmBaseUrl: "wasm",
    faceModelUrl: "face",
    upperPoseModelUrl: "upper",
    fullBodyPoseModelUrl: "full",
    upperAnalysisFps: 10,
    fullBodyAnalysisFps: 10,
    minimumVisibility: 0.55
  },
  calibrationDurationMs: 100,
  storageSampleFps: 5,
  batchIntervalMs: 1000,
  batchSize: 10,
  maxBufferedSamples: 100,
  maxBufferedEvents: 100,
  experimentalThresholds: {
    orientationDeviationDegrees: 18,
    headTurnDegrees: 25,
    postureChangeNormalized: 0.12,
    largeMovementNormalized: 0.18
  }
};

function createReadyVideo(stream: MediaStream): HTMLVideoElement {
  return {
    srcObject: stream,
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480
  } as HTMLVideoElement;
}

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9
  }));
}
