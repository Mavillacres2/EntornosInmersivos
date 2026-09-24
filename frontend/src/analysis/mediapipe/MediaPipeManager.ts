import { FilesetResolver } from "@mediapipe/tasks-vision";

import { ANALYSIS_CONFIG, VISION_CONFIG } from "../config/AnalysisConfig";
import { HandAnalysisService } from "./HandAnalysisService";
import type { HandDetection } from "../types/AnalysisTypes";
import type { AnalysisConfig } from "../config/AnalysisConfig";
import type {
  FullBodyAnalysisFrame,
  UpperBodyAnalysisFrame
} from "../types/AnalysisTypes";
import {
  FaceAnalysisService,
  type FaceAnalysisFrame
} from "./FaceAnalysisService";
import {
  POSE_LANDMARK,
  PoseAnalysisService,
  type PoseAnalysisResult
} from "./PoseAnalysisService";

const FULL_BODY_INDICES = [
  POSE_LANDMARK.leftShoulder,
  POSE_LANDMARK.rightShoulder,
  POSE_LANDMARK.leftKnee,
  POSE_LANDMARK.rightKnee,
  POSE_LANDMARK.leftAnkle,
  POSE_LANDMARK.rightAnkle,
  POSE_LANDMARK.leftFootIndex,
  POSE_LANDMARK.rightFootIndex
];

export class MediaPipeManager {
  private readonly faceService = new FaceAnalysisService();
  private readonly handService = new HandAnalysisService();
  private readonly upperPoseService: PoseAnalysisService;
  private cachedUpperPose: PoseAnalysisResult = unavailablePoseFrame();
  private nextUpperAnalysis: "face" | "pose" = "face";
  private faceTimestamp: number | null = null;
  private lastUpperVideoTime = -1;
  private nextBodyAnalysis: "pose" | "hands" = "pose";
  private cachedBodyPose: PoseAnalysisResult = unavailablePoseFrame();
  private cachedHands: HandDetection[] = [];
  private handsTimestamp: number | null = null;
  private bodyVideoSource: MediaProvider | null = null;
  private lastBodyVideoTime = -1;
  private readonly fullBodyPoseService: PoseAnalysisService;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private generation = 0;
  private upperVideoSource: MediaProvider | null = null;
  private cachedUpperFace: FaceAnalysisFrame = unavailableFaceFrame();
  private readonly config: AnalysisConfig;
  private readonly timings = {
    face: new TimingAccumulator(),
    upperPose: new TimingAccumulator(),
    hands: new TimingAccumulator(),
    fullBodyPose: new TimingAccumulator()
  };

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.upperPoseService = new PoseAnalysisService(config.mediaPipe.minimumVisibility,
      [POSE_LANDMARK.leftShoulder, POSE_LANDMARK.rightShoulder]);
    this.fullBodyPoseService = new PoseAnalysisService(
      config.mediaPipe.minimumVisibility,
      FULL_BODY_INDICES
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    const generation = this.generation;
    this.initializationPromise = this.initializeModels();

    try {
      await this.initializationPromise;
      if (generation !== this.generation) throw new Error("Inicializaci?n de visi?n cancelada.");
      this.initialized = true;
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  analyzeUpperBody(
    video: HTMLVideoElement,
    timestampMs: number,
    includeFaceLandmarks = this.config.debug
  ): UpperBodyAnalysisFrame {
    this.ensureUpperVideoSource(video);
    this.cachedUpperFace = this.measure("face", () =>
      this.faceService.analyze(video, timestampMs, includeFaceLandmarks));
    this.faceTimestamp = timestampMs;
    this.cachedUpperPose = this.measure("upperPose", () => this.upperPoseService.analyze(video, timestampMs));
    return this.buildUpperBodyFrame(timestampMs, true, true);
  }

  // One model per scheduler turn; CAM2 retains its own independent schedule.
  analyzeUpperBodyStaggered(video: HTMLVideoElement, timestampMs: number,
    includeFaceLandmarks = this.config.debug): UpperBodyAnalysisFrame {
    this.ensureUpperVideoSource(video);
    let faceUpdated = false, poseUpdated = false;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      this.resetUpperBodyAnalysis(false);
      return this.buildUpperBodyFrame(timestampMs, true, true);
    }
    if (video.currentTime !== this.lastUpperVideoTime) {
      this.lastUpperVideoTime = video.currentTime;
      if (this.nextUpperAnalysis === "face") {
        this.cachedUpperFace = this.measure("face", () => this.faceService.analyze(video, timestampMs, includeFaceLandmarks));
        this.faceTimestamp = timestampMs;
        this.nextUpperAnalysis = "pose";
        faceUpdated = true;
      } else {
        this.cachedUpperPose = this.measure("upperPose", () => this.upperPoseService.analyze(video, timestampMs));
        this.nextUpperAnalysis = "face";
        poseUpdated = true;
      }
    }
    if (this.faceTimestamp !== null && timestampMs - this.faceTimestamp > VISION_CONFIG.detectionTimeoutMs) {
      this.cachedUpperFace = unavailableFaceFrame();
      this.faceTimestamp = null;
      this.faceService.resetTracking(false);
      faceUpdated = true;
    }
    const poseTime = this.cachedUpperPose.diagnostics.detectionTimestampMs;
    if (poseTime !== null && timestampMs - poseTime > VISION_CONFIG.detectionTimeoutMs) {
      this.cachedUpperPose = unavailablePoseFrame();
      poseUpdated = true;
    }
    return this.buildUpperBodyFrame(timestampMs, faceUpdated, poseUpdated);
  }

  resetUpperBodyAnalysis(resetMetrics = true): void {
    this.upperVideoSource = null;
    this.cachedUpperFace = unavailableFaceFrame();
    this.cachedUpperPose = unavailablePoseFrame();
    this.nextUpperAnalysis = "face";
    this.faceTimestamp = null;
    this.lastUpperVideoTime = -1;
    this.faceService.resetTracking(resetMetrics);
  }

  private buildUpperBodyFrame(timestampMs: number, faceUpdated: boolean, poseUpdated: boolean): UpperBodyAnalysisFrame {
    const face = this.cachedUpperFace;
    return { timestampMs, headOrientation: face.orientation, faceLandmarks: face.landmarks,
      faceDetected: face.landmarks !== null, faceUpdated, poseLandmarks: this.cachedUpperPose.landmarks,
      poseUpdated, quality: face.landmarks ? "good" : this.cachedUpperPose.quality,
      poseQuality: this.cachedUpperPose.quality,
      eyes: face.eyes ?? null, blinkEvents: faceUpdated ? face.blinkEvents ?? [] : [] };
  }

  resetBodyAnalysis(): void {
    this.bodyVideoSource = null;
    this.lastBodyVideoTime = -1;
    this.nextBodyAnalysis = "pose";
    this.cachedBodyPose = unavailablePoseFrame();
    this.cachedHands = [];
    this.handsTimestamp = null;
  }

  analyzeFullBody(video: HTMLVideoElement, timestampMs: number): FullBodyAnalysisFrame {
    if (video.srcObject !== this.bodyVideoSource) {
      this.resetBodyAnalysis();
      this.bodyVideoSource = video.srcObject;
    }
    let poseUpdated = false, handsUpdated = false;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      this.resetBodyAnalysis();
      poseUpdated = handsUpdated = true;
    } else if (video.currentTime !== this.lastBodyVideoTime) {
      this.lastBodyVideoTime = video.currentTime;
      if (this.nextBodyAnalysis === "pose") {
        this.cachedBodyPose = this.measure("fullBodyPose", () => this.fullBodyPoseService.analyze(video, timestampMs));
        this.nextBodyAnalysis = "hands";
        poseUpdated = true;
      } else {
        this.cachedHands = this.measure("hands", () => this.handService.analyze(video, timestampMs));
        this.handsTimestamp = timestampMs;
        this.nextBodyAnalysis = "pose";
        handsUpdated = true;
      }
    }
    const poseTime = this.cachedBodyPose.diagnostics.detectionTimestampMs;
    if (poseTime !== null && timestampMs - poseTime > VISION_CONFIG.detectionTimeoutMs) {
      this.cachedBodyPose = unavailablePoseFrame();
      poseUpdated = true;
    }
    if (this.handsTimestamp !== null && timestampMs - this.handsTimestamp > VISION_CONFIG.detectionTimeoutMs) {
      this.cachedHands = [];
      this.handsTimestamp = null;
      handsUpdated = true;
    }
    const pose = this.cachedBodyPose;
    return { timestampMs, poseLandmarks: pose.landmarks, quality: pose.quality,
      requiredLandmarksVisible: pose.requiredLandmarksVisible,
      diagnostics: { ...pose.diagnostics, detectionAttempted: poseUpdated && pose.diagnostics.detectionAttempted },
      poseUpdated, handsUpdated, hands: this.cachedHands, handsTimestampMs: this.handsTimestamp,
      handError: this.handService.error };
  }

  dispose(): void {
    this.generation += 1;
    this.faceService.close();
    this.upperPoseService.close();
    this.handService.close();
    this.resetBodyAnalysis();
    this.fullBodyPoseService.close();
    this.resetUpperBodyAnalysis();
    this.initialized = false;
  }

  getPerformanceDiagnostics(): Record<string, unknown> {
    return {
      face: this.timings.face.snapshot(),
      upperPose: this.timings.upperPose.snapshot(),
      hands: this.timings.hands.snapshot(),
      fullBodyPose: this.timings.fullBodyPose.snapshot()
    };
  }

  private measure<T>(
    key: keyof MediaPipeManager["timings"],
    operation: () => T
  ): T {
    const startedAt = performance.now();

    try {
      return operation();
    } finally {
      this.timings[key].record(performance.now() - startedAt);
    }
  }

  private ensureUpperVideoSource(video: HTMLVideoElement): void {
    if (this.upperVideoSource === video.srcObject) {
      return;
    }

    this.resetUpperBodyAnalysis(false);
    this.upperVideoSource = video.srcObject;
  }

  private async initializeModels(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(
      this.config.mediaPipe.wasmBaseUrl
    );

    const results = await Promise.allSettled([
      this.faceService.initialize(fileset, this.config.mediaPipe.faceModelUrl),
      this.upperPoseService.initialize(fileset, this.config.mediaPipe.upperPoseModelUrl),
      this.handService.initialize(fileset, this.config.mediaPipe.handModelUrl ?? ANALYSIS_CONFIG.mediaPipe.handModelUrl!),
      this.fullBodyPoseService.initialize(
        fileset,
        this.config.mediaPipe.fullBodyPoseModelUrl
      )
    ]);
    const failure = results.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
  }
}

class TimingAccumulator {
  private count = 0;
  private totalMs = 0;
  private maxMs = 0;
  private windowCount = 0;
  private windowStartedAt = performance.now();

  record(durationMs: number): void {
    this.count += 1;
    this.windowCount += 1;
    this.totalMs += durationMs;
    this.maxMs = Math.max(this.maxMs, durationMs);
  }

  snapshot(): Record<string, number> {
    const now = performance.now();
    const elapsedMs = Math.max(1, now - this.windowStartedAt);
    const snapshot = {
      calls: this.count,
      averageMs: roundTiming(this.count > 0 ? this.totalMs / this.count : 0),
      maxMs: roundTiming(this.maxMs),
      callsPerSecond: roundTiming((this.windowCount * 1000) / elapsedMs)
    };

    if (elapsedMs >= 1000) {
      this.windowCount = 0;
      this.windowStartedAt = now;
    }

    return snapshot;
  }
}

function roundTiming(value: number): number {
  return Math.round(value * 100) / 100;
}

function unavailableFaceFrame(): FaceAnalysisFrame {
  return {
    orientation: null,
    landmarks: null
  };
}

function unavailablePoseFrame(): PoseAnalysisResult {
  return {
    landmarks: null,
    quality: "unavailable",
    requiredLandmarksVisible: false,
    diagnostics: {
      detectionAttempted: false,
      poseDetected: false,
      landmarkCount: 0,
      averageVisibility: null,
      detectionTimestampMs: null,
      error: null
    }
  };
}
