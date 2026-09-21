import { describe, expect, it, vi } from "vitest";

import type { AnalysisConfig } from "../config/AnalysisConfig";
import { MediaPipeManager } from "../mediapipe/MediaPipeManager";

describe("MediaPipeManager performance scheduling", () => {
  it("alterna Face y Pose de CAM1 sin ejecutarlos juntos", () => {
    const manager = new MediaPipeManager(TEST_CONFIG);
    const analyzeFace = vi.fn(() => ({
      orientation: { yaw: 0, pitch: 0, roll: 0 },
      landmarks: null
    }));
    const analyzePose = vi.fn(() => ({
      landmarks: createLandmarks(),
      quality: "good" as const,
      requiredLandmarksVisible: true,
      diagnostics: {
        detectionAttempted: true,
        poseDetected: true,
        landmarkCount: 33,
        averageVisibility: 0.9,
        detectionTimestampMs: 1,
        error: null
      }
    }));
    const internals = manager as unknown as {
      faceService: { analyze: typeof analyzeFace };
      upperPoseService: { analyze: typeof analyzePose };
    };

    internals.faceService = { analyze: analyzeFace };
    internals.upperPoseService = { analyze: analyzePose };

    const video = {
      srcObject: {} as MediaStream
    } as HTMLVideoElement;
    const first = manager.analyzeUpperBodyStaggered(video, 1);
    const second = manager.analyzeUpperBodyStaggered(video, 2);
    const third = manager.analyzeUpperBodyStaggered(video, 3);

    expect([first.faceUpdated, first.poseUpdated]).toEqual([true, false]);
    expect([second.faceUpdated, second.poseUpdated]).toEqual([false, true]);
    expect([third.faceUpdated, third.poseUpdated]).toEqual([true, false]);
    expect(analyzeFace).toHaveBeenCalledTimes(2);
    expect(analyzePose).toHaveBeenCalledTimes(1);
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
    fullBodyAnalysisFps: 6,
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

function createLandmarks() {
  return Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.9
  }));
}
