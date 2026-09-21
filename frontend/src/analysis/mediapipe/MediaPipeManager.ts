import { FilesetResolver } from "@mediapipe/tasks-vision";

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

const UPPER_BODY_INDICES = [
  POSE_LANDMARK.nose,
  POSE_LANDMARK.leftShoulder,
  POSE_LANDMARK.rightShoulder
];

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
  private readonly upperPoseService: PoseAnalysisService;
  private readonly fullBodyPoseService: PoseAnalysisService;
  private initializationPromise: Promise<void> | null = null;
  private initialized = false;
  private upperVideoSource: MediaProvider | null = null;
  private nextUpperAnalysis: "face" | "pose" = "face";
  private cachedUpperFace: FaceAnalysisFrame = unavailableFaceFrame();
  private cachedUpperPose: PoseAnalysisResult = unavailablePoseFrame();
  private readonly config: AnalysisConfig;

  constructor(config: AnalysisConfig) {
    this.config = config;
    this.upperPoseService = new PoseAnalysisService(
      config.mediaPipe.minimumVisibility,
      UPPER_BODY_INDICES
    );
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

    this.initializationPromise = this.initializeModels();

    try {
      await this.initializationPromise;
      this.initialized = true;
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
    this.cachedUpperFace = this.faceService.analyze(
      video,
      timestampMs,
      includeFaceLandmarks
    );
    this.cachedUpperPose = this.upperPoseService.analyze(video, timestampMs);
    this.nextUpperAnalysis = "face";

    return this.buildUpperBodyFrame(timestampMs, true, true);
  }

  analyzeUpperBodyStaggered(
    video: HTMLVideoElement,
    timestampMs: number,
    includeFaceLandmarks = this.config.debug
  ): UpperBodyAnalysisFrame {
    this.ensureUpperVideoSource(video);
    let faceUpdated = false;
    let poseUpdated = false;

    if (this.nextUpperAnalysis === "face") {
      this.cachedUpperFace = this.faceService.analyze(
        video,
        timestampMs,
        includeFaceLandmarks
      );
      this.nextUpperAnalysis = "pose";
      faceUpdated = true;
    } else {
      this.cachedUpperPose = this.upperPoseService.analyze(video, timestampMs);
      this.nextUpperAnalysis = "face";
      poseUpdated = true;
    }

    return this.buildUpperBodyFrame(timestampMs, faceUpdated, poseUpdated);
  }

  resetUpperBodyAnalysis(): void {
    this.upperVideoSource = null;
    this.nextUpperAnalysis = "face";
    this.cachedUpperFace = unavailableFaceFrame();
    this.cachedUpperPose = unavailablePoseFrame();
  }

  private buildUpperBodyFrame(
    timestampMs: number,
    faceUpdated: boolean,
    poseUpdated: boolean
  ): UpperBodyAnalysisFrame {
    const face = this.cachedUpperFace;
    const pose = this.cachedUpperPose;

    return {
      timestampMs,
      headOrientation: face.orientation,
      faceLandmarks: face.landmarks,
      faceDetected: face.orientation !== null,
      faceUpdated,
      poseLandmarks: pose.landmarks,
      poseUpdated,
      quality:
        face.orientation && pose.requiredLandmarksVisible
          ? pose.quality
          : face.orientation || pose.requiredLandmarksVisible
            ? "low"
            : "unavailable"
    };
  }

  analyzeFullBody(
    video: HTMLVideoElement,
    timestampMs: number
  ): FullBodyAnalysisFrame {
    const pose = this.fullBodyPoseService.analyze(video, timestampMs);

    return {
      timestampMs,
      poseLandmarks: pose.landmarks,
      quality: pose.quality,
      requiredLandmarksVisible: pose.requiredLandmarksVisible,
      diagnostics: pose.diagnostics
    };
  }

  dispose(): void {
    this.faceService.close();
    this.upperPoseService.close();
    this.fullBodyPoseService.close();
    this.resetUpperBodyAnalysis();
    this.initialized = false;
    this.initializationPromise = null;
  }

  private ensureUpperVideoSource(video: HTMLVideoElement): void {
    if (this.upperVideoSource === video.srcObject) {
      return;
    }

    this.resetUpperBodyAnalysis();
    this.upperVideoSource = video.srcObject;
  }

  private async initializeModels(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(
      this.config.mediaPipe.wasmBaseUrl
    );

    await Promise.all([
      this.faceService.initialize(fileset, this.config.mediaPipe.faceModelUrl),
      this.upperPoseService.initialize(
        fileset,
        this.config.mediaPipe.upperPoseModelUrl
      ),
      this.fullBodyPoseService.initialize(
        fileset,
        this.config.mediaPipe.fullBodyPoseModelUrl
      )
    ]);
  }
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
