import type { CameraManager } from "../cameras/CameraManager";
import type { PhysicalCameraRole } from "../cameras/CameraTypes";
import type { AnalysisConfig } from "../config/AnalysisConfig";
import {
  FullBodyFeatureExtractor,
  unavailableFullBodyFeatures
} from "../features/FullBodyFeatureExtractor";
import {
  HeadFeatureExtractor,
  unavailableHeadFeatures
} from "../features/HeadFeatureExtractor";
import {
  MovementFeatureExtractor,
  unavailableMovementFeatures
} from "../features/MovementFeatureExtractor";
import { OrientationFeatureExtractor } from "../features/OrientationFeatureExtractor";
import {
  TrunkFeatureExtractor,
  unavailableTrunkFeatures
} from "../features/TrunkFeatureExtractor";
import type { MediaPipeManager } from "../mediapipe/MediaPipeManager";
import { POSE_LANDMARK } from "../mediapipe/PoseAnalysisService";
import type { DataSyncManager } from "../synchronization/DataSyncManager";
import type {
  ActivityContextAdapter
} from "../synchronization/ActivityContextAdapter";
import type {
  AnalysisPerformanceSnapshot,
  AnalysisSystemState,
  CameraPositionQuality,
  FullBodyAnalysisFrame,
  HeadCalibration,
  LandmarkPoint
} from "../types/AnalysisTypes";
import type {
  FullBodyBehaviorFeatures,
  HeadBehaviorFeatures,
  MovementBehaviorFeatures,
  TrunkBehaviorFeatures
} from "../types/BehaviorTypes";

export interface CameraQualityReport {
  upperBody: CameraPositionQuality;
  fullBody: CameraPositionQuality;
}

export interface AnalysisDebugLandmarks {
  upperPose: LandmarkPoint[] | null;
  upperFace: LandmarkPoint[] | null;
  fullBodyPose: LandmarkPoint[] | null;
  fullBodyDiagnostics: FullBodyPreviewDiagnostics;
}

export type JointVisibilityState = "visible" | "partial" | "not-visible";
export type FullBodyPreviewQuality = "GOOD" | "PARTIAL" | "POOR";

export interface FullBodyPreviewDiagnostics {
  deviceLabel: string | null;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  streamActive: boolean;
  videoTrackReadyState: MediaStreamTrackState | "unavailable";
  analysisLoopRunning: boolean;
  detectCallsPerSecond: number;
  poseDetected: boolean;
  landmarkCount: number;
  visibleJointCount: number;
  averageVisibility: number | null;
  lastDetectionTimestamp: number | null;
  error: string | null;
  quality: FullBodyPreviewQuality;
  shouldersVisible: JointVisibilityState;
  hipsVisible: JointVisibilityState;
  kneesVisible: JointVisibilityState;
  anklesVisible: JointVisibilityState;
  feetVisible: JointVisibilityState;
}

export type AnalysisPreviewListener = (
  landmarks: AnalysisDebugLandmarks
) => void;

export class BehaviorTrackingManager {
  private readonly orientationExtractor: OrientationFeatureExtractor;
  private readonly headExtractor: HeadFeatureExtractor;
  private readonly trunkExtractor: TrunkFeatureExtractor;
  private readonly fullBodyExtractor: FullBodyFeatureExtractor;
  private readonly movementExtractor: MovementFeatureExtractor;
  private state: AnalysisSystemState = "idle";
  private animationFrameId: number | null = null;
  private previewAnimationFrameId: number | null = null;
  private previewGeneration = 0;
  private previewActive = false;
  private previewListener: AnalysisPreviewListener | null = null;
  private previewPreferredRole: PhysicalCameraRole = "upper-body";
  private analysisPreferredRole: PhysicalCameraRole = "upper-body";
  private lastPreviewUpperAt = 0;
  private lastPreviewFullBodyAt = 0;
  private lastPreviewErrorAt = 0;
  private lastUpperAnalysisAt = 0;
  private lastFullBodyAnalysisAt = 0;
  private lastStorageSampleAt = 0;
  private latestHead: HeadBehaviorFeatures = unavailableHeadFeatures();
  private latestTrunk: TrunkBehaviorFeatures = unavailableTrunkFeatures();
  private latestFullBody: FullBodyBehaviorFeatures = unavailableFullBodyFeatures();
  private latestMovement: MovementBehaviorFeatures = unavailableMovementFeatures();
  private latestUpperPoseDebug: LandmarkPoint[] | null = null;
  private latestUpperFaceDebug: LandmarkPoint[] | null = null;
  private latestFullBodyPoseDebug: LandmarkPoint[] | null = null;
  private latestFullBodyDiagnostics: FullBodyPreviewDiagnostics =
    unavailableFullBodyDiagnostics();
  private fullBodyDetectCallsInWindow = 0;
  private fullBodyDiagnosticsWindowStartedAt = 0;
  private fullBodyDetectCallsPerSecond = 0;
  private upperFrameCount = 0;
  private fullBodyFrameCount = 0;
  private fpsWindowStartedAt = performance.now();
  private upperAnalysisFps = 0;
  private fullBodyAnalysisFps = 0;
  private lastAnalysisErrorAt = 0;
  private readonly respondedDistractors = new Set<string>();
  private renderFpsProvider: (() => number | null) | null = null;
  private readonly config: AnalysisConfig;
  private readonly cameraManager: CameraManager;
  private readonly mediaPipeManager: MediaPipeManager;
  private readonly dataSyncManager: DataSyncManager;
  private readonly activityContext: ActivityContextAdapter;

  constructor(
    config: AnalysisConfig,
    cameraManager: CameraManager,
    mediaPipeManager: MediaPipeManager,
    dataSyncManager: DataSyncManager,
    activityContext: ActivityContextAdapter
  ) {
    this.config = config;
    this.cameraManager = cameraManager;
    this.mediaPipeManager = mediaPipeManager;
    this.dataSyncManager = dataSyncManager;
    this.activityContext = activityContext;
    this.orientationExtractor = new OrientationFeatureExtractor(
      config.experimentalThresholds.orientationDeviationDegrees
    );
    this.headExtractor = new HeadFeatureExtractor(
      config.experimentalThresholds.headTurnDegrees
    );
    this.trunkExtractor = new TrunkFeatureExtractor(
      config.mediaPipe.minimumVisibility,
      config.experimentalThresholds.postureChangeNormalized
    );
    this.fullBodyExtractor = new FullBodyFeatureExtractor(
      config.mediaPipe.minimumVisibility,
      config.experimentalThresholds.largeMovementNormalized
    );
    this.movementExtractor = new MovementFeatureExtractor(
      config.experimentalThresholds.largeMovementNormalized
    );
  }

  setRenderFpsProvider(provider: () => number | null): void {
    this.renderFpsProvider = provider;
  }

  async startCameraPreview(listener: AnalysisPreviewListener): Promise<void> {
    const generation = this.previewGeneration + 1;

    this.previewGeneration = generation;
    this.previewActive = false;
    this.cancelPreviewAnimationFrame();
    this.previewListener = listener;
    await this.mediaPipeManager.initialize();

    if (generation !== this.previewGeneration || !this.previewListener) {
      return;
    }

    this.previewActive = true;
    this.previewPreferredRole = "upper-body";
    this.lastPreviewUpperAt = 0;
    this.lastPreviewFullBodyAt = 0;
    this.resetFullBodyDiagnosticsWindow();
    this.schedulePreviewFrame();
  }

  stopCameraPreview(): void {
    this.previewGeneration += 1;
    this.previewActive = false;
    this.cancelPreviewAnimationFrame();
    this.previewListener = null;
    this.latestUpperPoseDebug = null;
    this.latestUpperFaceDebug = null;
    this.latestFullBodyPoseDebug = null;
    this.latestFullBodyDiagnostics = unavailableFullBodyDiagnostics();
  }

  async checkCameraPosition(sampleCount = 8): Promise<CameraQualityReport> {
    const resumePreview = this.suspendCameraPreview();

    try {
      await this.mediaPipeManager.initialize();
      const upperVideo = this.cameraManager.getVideoElement("upper-body");
      const fullBodyVideo = this.cameraManager.getVideoElement("full-body");
      let upperAdequateFrames = 0;
      let fullBodyAdequateFrames = 0;
      let upperAvailableFrames = 0;
      let fullBodyAvailableFrames = 0;

      for (let index = 0; index < sampleCount; index += 1) {
        if (isVideoReadyForAnalysis(upperVideo)) {
          const upper = this.mediaPipeManager.analyzeUpperBody(
            upperVideo,
            performance.now()
          );

          this.latestUpperPoseDebug = upper.poseLandmarks;
          this.latestUpperFaceDebug = upper.faceLandmarks;
          upperAvailableFrames += 1;
          if (
            upper.faceDetected &&
            upper.poseLandmarks &&
            upper.quality !== "unavailable"
          ) {
            upperAdequateFrames += 1;
          }
        }

        if (isVideoReadyForAnalysis(fullBodyVideo)) {
          const timestamp = performance.now();
          const fullBody = this.mediaPipeManager.analyzeFullBody(
            fullBodyVideo,
            timestamp
          );

          this.latestFullBodyPoseDebug = fullBody.poseLandmarks;
          this.recordFullBodyDiagnostics(fullBody, fullBodyVideo, timestamp);
          fullBodyAvailableFrames += 1;
          if (fullBody.requiredLandmarksVisible) {
            fullBodyAdequateFrames += 1;
          }
        }

        await nextAnimationFrame();
      }

      const upperRatio =
        upperAvailableFrames > 0
          ? upperAdequateFrames / upperAvailableFrames
          : 0;
      const fullRatio =
        fullBodyAvailableFrames > 0
          ? fullBodyAdequateFrames / fullBodyAvailableFrames
          : 0;

      return {
        upperBody: {
          adequate: upperRatio >= 0.6,
          message:
            upperRatio >= 0.6
              ? "Posicion adecuada para cabeza y tronco."
              : "Ajusta tu posicion frente a la camara superior.",
          quality: qualityFromRatio(upperRatio, upperAvailableFrames > 0)
        },
        fullBody: {
          adequate: fullRatio >= 0.6,
          message:
            fullRatio >= 0.6
              ? "Posicion adecuada para cuerpo completo."
              : "Ajusta la camara para visualizar mejor hombros, rodillas y pies.",
          quality: qualityFromRatio(fullRatio, fullBodyAvailableFrames > 0)
        }
      };
    } finally {
      resumePreview();
    }
  }

  async calibrateHead(
    onProgress?: (progress: number) => void
  ): Promise<HeadCalibration> {
    const resumePreview = this.suspendCameraPreview();

    this.state = "calibrating";
    try {
      await this.mediaPipeManager.initialize();
      const video = this.cameraManager.getVideoElement("upper-body");

      if (!isVideoReadyForAnalysis(video)) {
        throw new Error("La camara superior todavia no esta lista.");
      }

      const startedAt = performance.now();
      const yawValues: number[] = [];
      const pitchValues: number[] = [];
      const rollValues: number[] = [];
      const intervalMs =
        1000 / Math.max(1, this.config.mediaPipe.upperAnalysisFps);
      let lastSampleAt = 0;

      while (performance.now() - startedAt < this.config.calibrationDurationMs) {
        const now = performance.now();

        if (now - lastSampleAt >= intervalMs) {
          const frame = this.mediaPipeManager.analyzeUpperBody(video, now);

          lastSampleAt = now;
          if (frame.headOrientation) {
            yawValues.push(frame.headOrientation.yaw);
            pitchValues.push(frame.headOrientation.pitch);
            rollValues.push(frame.headOrientation.roll);
          }
        }

        onProgress?.(
          Math.min(
            1,
            (performance.now() - startedAt) /
              this.config.calibrationDurationMs
          )
        );
        await nextAnimationFrame();
      }

      if (yawValues.length < 5) {
        this.state = "error";
        throw new Error(
          "No se detecto el rostro con estabilidad suficiente para calibrar."
        );
      }

      const calibration: HeadCalibration = {
        baselineYaw: median(yawValues),
        baselinePitch: median(pitchValues),
        baselineRoll: median(rollValues),
        sampleCount: yawValues.length,
        calibratedAt: new Date().toISOString()
      };

      this.orientationExtractor.setCalibration(calibration);
      this.headExtractor.reset();
      this.state = "ready";
      onProgress?.(1);
      return calibration;
    } finally {
      resumePreview();
    }
  }

  start(): void {
    if (this.state === "analyzing") {
      return;
    }

    this.stopCameraPreview();
    this.mediaPipeManager.resetUpperBodyAnalysis();
    this.state = "analyzing";
    this.dataSyncManager.start();
    this.lastUpperAnalysisAt = 0;
    this.lastFullBodyAnalysisAt = 0;
    this.analysisPreferredRole = "upper-body";
    this.lastStorageSampleAt = 0;
    this.fpsWindowStartedAt = performance.now();
    this.resetFullBodyDiagnosticsWindow();
    this.scheduleNextFrame();
  }

  pause(): void {
    if (this.state !== "analyzing") {
      return;
    }

    this.state = "paused";
    this.cancelAnimationFrame();
  }

  stop(): void {
    this.state = "stopping";
    this.cancelAnimationFrame();
    this.state = "finished";
  }

  getState(): AnalysisSystemState {
    return this.state;
  }

  getPerformance(): AnalysisPerformanceSnapshot {
    return {
      upperAnalysisFps: this.upperAnalysisFps,
      fullBodyAnalysisFps: this.fullBodyAnalysisFps,
      renderFps: this.renderFpsProvider?.() ?? null
    };
  }

  getDebugLandmarks(): AnalysisDebugLandmarks {
    return {
      upperPose: this.latestUpperPoseDebug,
      upperFace: this.latestUpperFaceDebug,
      fullBodyPose: this.latestFullBodyPoseDebug,
      fullBodyDiagnostics: this.latestFullBodyDiagnostics
    };
  }

  dispose(): void {
    this.stopCameraPreview();
    this.stop();
    this.orientationExtractor.reset();
    this.headExtractor.reset();
    this.trunkExtractor.reset();
    this.fullBodyExtractor.reset();
    this.movementExtractor.reset();
    this.latestUpperPoseDebug = null;
    this.latestUpperFaceDebug = null;
    this.latestFullBodyPoseDebug = null;
    this.latestFullBodyDiagnostics = unavailableFullBodyDiagnostics();
    this.respondedDistractors.clear();
  }

  private scheduleNextFrame(): void {
    this.animationFrameId = window.requestAnimationFrame((timestamp) => {
      this.animationFrameId = null;
      this.processFrame(timestamp);

      if (this.state === "analyzing") {
        this.scheduleNextFrame();
      }
    });
  }

  private schedulePreviewFrame(): void {
    if (!this.previewActive) {
      return;
    }

    this.previewAnimationFrameId = window.requestAnimationFrame((timestamp) => {
      this.previewAnimationFrameId = null;
      this.processPreviewFrame(timestamp);

      if (this.previewActive) {
        this.schedulePreviewFrame();
      }
    });
  }

  private processPreviewFrame(timestampMs: number): void {
    try {
      const upperInterval =
        1000 / Math.max(1, this.config.mediaPipe.upperAnalysisFps);
      const fullBodyInterval =
        1000 / Math.max(1, this.config.mediaPipe.fullBodyAnalysisFps);
      const upperDue =
        timestampMs - this.lastPreviewUpperAt >= upperInterval;
      const fullBodyDue =
        timestampMs - this.lastPreviewFullBodyAt >= fullBodyInterval;
      const selectedRole = selectAnalysisRole(
        upperDue,
        fullBodyDue,
        this.previewPreferredRole
      );

      if (selectedRole === "upper-body") {
        const video = this.cameraManager.getVideoElement("upper-body");

        this.lastPreviewUpperAt = timestampMs;
        this.previewPreferredRole = "full-body";
        if (video.srcObject) {
          const frame = this.mediaPipeManager.analyzeUpperBodyStaggered(
            video,
            timestampMs,
            true
          );

          this.latestUpperPoseDebug = frame.poseLandmarks;
          this.latestUpperFaceDebug = frame.faceLandmarks;
        } else {
          this.latestUpperPoseDebug = null;
          this.latestUpperFaceDebug = null;
        }
      } else if (selectedRole === "full-body") {
        const video = this.cameraManager.getVideoElement("full-body");

        this.lastPreviewFullBodyAt = timestampMs;
        this.previewPreferredRole = "upper-body";
        if (video.srcObject) {
          const frame = this.mediaPipeManager.analyzeFullBody(video, timestampMs);

          this.latestFullBodyPoseDebug = frame.poseLandmarks;
          this.recordFullBodyDiagnostics(frame, video, timestampMs);
        } else {
          this.latestFullBodyPoseDebug = null;
          this.latestFullBodyDiagnostics = this.buildFullBodyDiagnostics(
            null,
            video
          );
        }
      }

      if (selectedRole) {
        this.previewListener?.(this.getDebugLandmarks());
      }
    } catch (error) {
      if (timestampMs - this.lastPreviewErrorAt >= 5000) {
        this.lastPreviewErrorAt = timestampMs;
        console.warn("No se pudo actualizar la deteccion de camaras.", error);
      }
    }
  }

  private processFrame(timestampMs: number): void {
    try {
      const renderFps = this.renderFpsProvider?.() ?? null;
      const performanceFactor = analysisPerformanceFactor(renderFps);
      const upperInterval =
        1000 / Math.max(1, this.config.mediaPipe.upperAnalysisFps * performanceFactor);
      const fullBodyInterval =
        1000 /
        Math.max(1, this.config.mediaPipe.fullBodyAnalysisFps * performanceFactor);
      const upperDue = timestampMs - this.lastUpperAnalysisAt >= upperInterval;
      const fullBodyDue =
        timestampMs - this.lastFullBodyAnalysisAt >= fullBodyInterval;
      const selectedRole = selectAnalysisRole(
        upperDue,
        fullBodyDue,
        this.analysisPreferredRole
      );

      if (selectedRole === "upper-body") {
        this.analysisPreferredRole = "full-body";
        this.processUpperBody(timestampMs);
      } else if (selectedRole === "full-body") {
        this.analysisPreferredRole = "upper-body";
        this.processFullBody(timestampMs);
      }

      const storageInterval = 1000 / Math.max(1, this.config.storageSampleFps);

      if (timestampMs - this.lastStorageSampleAt >= storageInterval) {
        this.lastStorageSampleAt = timestampMs;
        this.updateMovement(timestampMs);
        this.dataSyncManager.recordFeatures({
          head: this.latestHead,
          trunk: this.latestTrunk,
          fullBody: this.latestFullBody,
          motorActivity: this.latestMovement,
          performance: this.getPerformance()
        });
      }

      this.updateAnalysisFps(timestampMs);
    } catch (error) {
      if (timestampMs - this.lastAnalysisErrorAt >= 5000) {
        this.lastAnalysisErrorAt = timestampMs;
        this.dataSyncManager.recordBehaviorEvent("ANALYSIS_ERROR", {
          message: error instanceof Error ? error.message : "Error de analisis"
        });
      }
    }
  }

  private processUpperBody(timestampMs: number): void {
    const video = this.cameraManager.getVideoElement("upper-body");

    this.lastUpperAnalysisAt = timestampMs;
    if (!video.srcObject) {
      this.handleOrientationUnavailable(timestampMs);
      this.headExtractor.markUnavailable();
      this.trunkExtractor.markUnavailable();
      this.latestHead = unavailableHeadFeatures();
      this.latestTrunk = unavailableTrunkFeatures();
      this.latestUpperPoseDebug = null;
      this.latestUpperFaceDebug = null;
      return;
    }

    const frame = this.mediaPipeManager.analyzeUpperBodyStaggered(
      video,
      timestampMs
    );
    if (this.config.debug) {
      this.latestUpperPoseDebug = frame.poseLandmarks;
      this.latestUpperFaceDebug = frame.faceLandmarks;
    }
    this.upperFrameCount += 1;

    if (frame.faceUpdated) {
      const orientation = frame.headOrientation
        ? this.orientationExtractor.extract(frame.headOrientation, timestampMs)
        : null;

      if (!frame.headOrientation) {
        this.handleOrientationUnavailable(timestampMs);
      }
      const head = this.headExtractor.extract(
        frame.headOrientation,
        orientation,
        timestampMs,
        frame.quality
      );

      this.latestHead = head.features;

      if (head.headTurnDetected) {
        this.dataSyncManager.recordBehaviorEvent("HEAD_TURN");
      }

      if (orientation?.offTaskStarted) {
        this.dataSyncManager.recordBehaviorEvent("OFF_TASK_ORIENTATION_START");
        const context = this.activityContext.getContext(timestampMs);

        if (
          context.distractorActive &&
          context.distractorStartedAtElapsedMs !== null &&
          context.distractorId !== null
        ) {
          const responseKey = `${context.scenarioId ?? "none"}:${context.distractorId}:${context.distractorStartedAtElapsedMs}`;

          if (!this.respondedDistractors.has(responseKey)) {
            this.respondedDistractors.add(responseKey);
            this.dataSyncManager.recordBehaviorEvent(
              "DISTRACTOR_ORIENTATION_RESPONSE",
              {
                distractorId: context.distractorId,
                distractorType: context.distractorType,
                latencyMs:
                  context.elapsedSessionTimeMs -
                  context.distractorStartedAtElapsedMs
              }
            );
          }
        }
      }

      if (orientation?.offTaskEnded) {
        this.dataSyncManager.recordBehaviorEvent("OFF_TASK_ORIENTATION_END", {
          durationMs: orientation.completedEpisodeDurationMs
        });
        this.dataSyncManager.recordBehaviorEvent("RETURN_TO_TASK", {
          latencyMs: orientation.completedEpisodeDurationMs
        });
      }
    }

    if (frame.poseUpdated) {
      const trunk = this.trunkExtractor.extract(
        frame.poseLandmarks,
        timestampMs,
        frame.quality
      );

      this.latestTrunk = trunk.features;
      if (trunk.postureChangeDetected) {
        this.dataSyncManager.recordBehaviorEvent("POSTURE_CHANGE");
      }
    }
  }

  private processFullBody(timestampMs: number): void {
    const video = this.cameraManager.getVideoElement("full-body");

    this.lastFullBodyAnalysisAt = timestampMs;
    if (!video.srcObject) {
      this.fullBodyExtractor.markUnavailable();
      this.latestFullBody = unavailableFullBodyFeatures();
      this.latestFullBodyPoseDebug = null;
      this.latestFullBodyDiagnostics = this.buildFullBodyDiagnostics(null, video);
      return;
    }

    const frame = this.mediaPipeManager.analyzeFullBody(video, timestampMs);
    this.recordFullBodyDiagnostics(frame, video, timestampMs);
    if (this.config.debug) {
      this.latestFullBodyPoseDebug = frame.poseLandmarks;
    }
    const fullBody = this.fullBodyExtractor.extract(
      frame.poseLandmarks,
      frame.quality
    );

    this.latestFullBody = fullBody.features;
    this.fullBodyFrameCount += 1;

    if (fullBody.largeMovementDetected) {
      this.dataSyncManager.recordBehaviorEvent("LARGE_BODY_MOVEMENT");
    }
  }

  private handleOrientationUnavailable(timestampMs: number): void {
    const completedEpisodeDurationMs =
      this.orientationExtractor.markUnavailable(timestampMs);

    if (completedEpisodeDurationMs === null) {
      return;
    }

    this.dataSyncManager.recordBehaviorEvent("OFF_TASK_ORIENTATION_END", {
      durationMs: completedEpisodeDurationMs,
      message: "Episodio cerrado al perderse la deteccion facial."
    });
  }

  private updateMovement(timestampMs: number): void {
    const movement = this.movementExtractor.extract(
      this.latestTrunk,
      this.latestFullBody,
      timestampMs
    );

    this.latestMovement = movement.features;
  }

  private recordFullBodyDiagnostics(
    frame: FullBodyAnalysisFrame,
    video: HTMLVideoElement,
    timestampMs: number
  ): void {
    if (frame.diagnostics.detectionAttempted) {
      this.fullBodyDetectCallsInWindow += 1;
    }

    if (this.fullBodyDiagnosticsWindowStartedAt <= 0) {
      this.fullBodyDiagnosticsWindowStartedAt = timestampMs;
    }

    const elapsed = timestampMs - this.fullBodyDiagnosticsWindowStartedAt;
    const completedWindow = elapsed >= 1000;

    if (completedWindow) {
      this.fullBodyDetectCallsPerSecond =
        (this.fullBodyDetectCallsInWindow * 1000) / elapsed;
      this.fullBodyDetectCallsInWindow = 0;
      this.fullBodyDiagnosticsWindowStartedAt = timestampMs;
    }

    this.latestFullBodyDiagnostics = this.buildFullBodyDiagnostics(frame, video);

    if (this.config.debug && completedWindow) {
      const diagnostics = this.latestFullBodyDiagnostics;

      console.info("[CAM2]", {
        device: diagnostics.deviceLabel,
        resolution: `${diagnostics.videoWidth}x${diagnostics.videoHeight}`,
        readyState: diagnostics.readyState,
        stream: diagnostics.streamActive ? "active" : "inactive",
        videoTrackReadyState: diagnostics.videoTrackReadyState,
        analysisLoopRunning: diagnostics.analysisLoopRunning,
        detectCallsPerSecond: roundDebugValue(
          diagnostics.detectCallsPerSecond
        ),
        poseDetected: diagnostics.poseDetected,
        landmarkCount: diagnostics.landmarkCount,
        averageVisibility: roundDebugValue(diagnostics.averageVisibility),
        lastDetectionTimestamp: diagnostics.lastDetectionTimestamp,
        shouldersVisible: diagnostics.shouldersVisible,
        hipsVisible: diagnostics.hipsVisible,
        kneesVisible: diagnostics.kneesVisible,
        anklesVisible: diagnostics.anklesVisible,
        feetVisible: diagnostics.feetVisible,
        quality: diagnostics.quality,
        error: diagnostics.error
      });
    }
  }

  private buildFullBodyDiagnostics(
    frame: FullBodyAnalysisFrame | null,
    video: HTMLVideoElement
  ): FullBodyPreviewDiagnostics {
    const status = this.cameraManager.getStatus();
    const selectedDeviceId = status.fullBody.selectedDeviceId;
    const deviceLabel =
      status.devices.find((device) => device.deviceId === selectedDeviceId)
        ?.label ?? null;
    const stream = video.srcObject as MediaStream | null;
    const videoTrack = stream?.getVideoTracks()[0];
    const landmarks = frame?.poseLandmarks ?? null;
    const shouldersVisible = jointVisibilityState(
      landmarks,
      [POSE_LANDMARK.leftShoulder, POSE_LANDMARK.rightShoulder],
      this.config.mediaPipe.minimumVisibility
    );
    const hipsVisible = jointVisibilityState(
      landmarks,
      [POSE_LANDMARK.leftHip, POSE_LANDMARK.rightHip],
      this.config.mediaPipe.minimumVisibility
    );
    const kneesVisible = jointVisibilityState(
      landmarks,
      [POSE_LANDMARK.leftKnee, POSE_LANDMARK.rightKnee],
      this.config.mediaPipe.minimumVisibility
    );
    const anklesVisible = jointVisibilityState(
      landmarks,
      [POSE_LANDMARK.leftAnkle, POSE_LANDMARK.rightAnkle],
      this.config.mediaPipe.minimumVisibility
    );
    const feetVisible = jointVisibilityState(
      landmarks,
      [POSE_LANDMARK.leftFootIndex, POSE_LANDMARK.rightFootIndex],
      this.config.mediaPipe.minimumVisibility
    );
    const visibleJointCount =
      landmarks?.filter(
        (landmark) =>
          Number.isFinite(landmark.visibility) &&
          landmark.visibility >= this.config.mediaPipe.minimumVisibility
      ).length ?? 0;

    return {
      deviceLabel,
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      streamActive: stream?.active ?? false,
      videoTrackReadyState: videoTrack?.readyState ?? "unavailable",
      analysisLoopRunning:
        this.previewActive || this.state === "analyzing",
      detectCallsPerSecond: this.fullBodyDetectCallsPerSecond,
      poseDetected: frame?.diagnostics.poseDetected ?? false,
      landmarkCount: frame?.diagnostics.landmarkCount ?? 0,
      visibleJointCount,
      averageVisibility: frame?.diagnostics.averageVisibility ?? null,
      lastDetectionTimestamp:
        frame?.diagnostics.detectionTimestampMs ?? null,
      error: frame?.diagnostics.error ?? null,
      quality: fullBodyPreviewQuality(
        frame?.diagnostics.poseDetected ?? false,
        visibleJointCount,
        shouldersVisible,
        kneesVisible,
        anklesVisible,
        feetVisible
      ),
      shouldersVisible,
      hipsVisible,
      kneesVisible,
      anklesVisible,
      feetVisible
    };
  }

  private resetFullBodyDiagnosticsWindow(): void {
    this.fullBodyDetectCallsInWindow = 0;
    this.fullBodyDiagnosticsWindowStartedAt = 0;
    this.fullBodyDetectCallsPerSecond = 0;
  }

  private updateAnalysisFps(timestampMs: number): void {
    const elapsed = timestampMs - this.fpsWindowStartedAt;

    if (elapsed < 1000) {
      return;
    }

    this.upperAnalysisFps = (this.upperFrameCount * 1000) / elapsed;
    this.fullBodyAnalysisFps = (this.fullBodyFrameCount * 1000) / elapsed;
    this.upperFrameCount = 0;
    this.fullBodyFrameCount = 0;
    this.fpsWindowStartedAt = timestampMs;
  }

  private cancelAnimationFrame(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private cancelPreviewAnimationFrame(): void {
    if (this.previewAnimationFrameId !== null) {
      window.cancelAnimationFrame(this.previewAnimationFrameId);
      this.previewAnimationFrameId = null;
    }
  }

  private suspendCameraPreview(): () => void {
    const shouldResume = this.previewActive && this.previewListener !== null;
    const generation = this.previewGeneration;

    if (shouldResume) {
      this.previewActive = false;
      this.cancelPreviewAnimationFrame();
    }

    return () => {
      if (
        !shouldResume ||
        generation !== this.previewGeneration ||
        !this.previewListener ||
        this.state === "analyzing"
      ) {
        return;
      }

      this.previewActive = true;
      this.previewPreferredRole = "upper-body";
      this.lastPreviewUpperAt = 0;
      this.lastPreviewFullBodyAt = 0;
      this.resetFullBodyDiagnosticsWindow();
      this.schedulePreviewFrame();
    };
  }
}

export function selectAnalysisRole(
  upperDue: boolean,
  fullBodyDue: boolean,
  preferredRole: PhysicalCameraRole
): PhysicalCameraRole | null {
  if (upperDue && fullBodyDue) {
    return preferredRole;
  }

  if (upperDue) {
    return "upper-body";
  }

  return fullBodyDue ? "full-body" : null;
}

export function analysisPerformanceFactor(renderFps: number | null): number {
  if (renderFps === null || renderFps >= 50) {
    return 1;
  }

  if (renderFps >= 40) {
    return 0.75;
  }

  if (renderFps >= 28) {
    return 0.5;
  }

  return 0.33;
}

function unavailableFullBodyDiagnostics(): FullBodyPreviewDiagnostics {
  return {
    deviceLabel: null,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    streamActive: false,
    videoTrackReadyState: "unavailable",
    analysisLoopRunning: false,
    detectCallsPerSecond: 0,
    poseDetected: false,
    landmarkCount: 0,
    visibleJointCount: 0,
    averageVisibility: null,
    lastDetectionTimestamp: null,
    error: null,
    quality: "POOR",
    shouldersVisible: "not-visible",
    hipsVisible: "not-visible",
    kneesVisible: "not-visible",
    anklesVisible: "not-visible",
    feetVisible: "not-visible"
  };
}

function jointVisibilityState(
  landmarks: LandmarkPoint[] | null,
  indices: readonly number[],
  minimumVisibility: number
): JointVisibilityState {
  if (!landmarks) {
    return "not-visible";
  }

  const visibleCount = indices.filter((index) => {
    const landmark = landmarks[index];

    return Boolean(
      landmark &&
        Number.isFinite(landmark.visibility) &&
        landmark.visibility >= minimumVisibility
    );
  }).length;

  if (visibleCount === indices.length) {
    return "visible";
  }

  return visibleCount > 0 ? "partial" : "not-visible";
}

function fullBodyPreviewQuality(
  poseDetected: boolean,
  visibleJointCount: number,
  shoulders: JointVisibilityState,
  knees: JointVisibilityState,
  ankles: JointVisibilityState,
  feet: JointVisibilityState
): FullBodyPreviewQuality {
  if (
    poseDetected &&
    shoulders === "visible" &&
    knees === "visible" &&
    ankles === "visible" &&
    feet === "visible"
  ) {
    return "GOOD";
  }

  return poseDetected && visibleJointCount >= 6 ? "PARTIAL" : "POOR";
}

function roundDebugValue(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function isVideoReadyForAnalysis(video: HTMLVideoElement): boolean {
  return Boolean(
    video.srcObject &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
  );
}

function qualityFromRatio(
  ratio: number,
  cameraAvailable: boolean
): CameraPositionQuality["quality"] {
  if (!cameraAvailable) {
    return "unavailable";
  }

  if (ratio >= 0.85) {
    return "good";
  }

  return ratio >= 0.6 ? "fair" : "low";
}

function median(values: number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted[middle];

  if (value === undefined) {
    return 0;
  }

  if (sorted.length % 2 === 0) {
    return ((sorted[middle - 1] ?? value) + value) / 2;
  }

  return value;
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
