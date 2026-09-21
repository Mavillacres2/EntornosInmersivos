import type { Engine } from "@babylonjs/core";

import { AnalysisApiClient } from "./api/AnalysisApiClient";
import { CameraManager } from "./cameras/CameraManager";
import type {
  PhysicalCameraRole,
  VideoDeviceOption
} from "./cameras/CameraTypes";
import { ANALYSIS_CONFIG } from "./config/AnalysisConfig";
import { MediaPipeManager } from "./mediapipe/MediaPipeManager";
import { ActivityContextAdapter } from "./synchronization/ActivityContextAdapter";
import type { ActivityTelemetrySink } from "./synchronization/ActivityContextAdapter";
import { DataSyncManager } from "./synchronization/DataSyncManager";
import { AnalysisSessionManager } from "./tracking/AnalysisSessionManager";
import { BehaviorTrackingManager } from "./tracking/BehaviorTrackingManager";
import { AnalysisDebugOverlay } from "./ui/AnalysisDebugOverlay";
import { EvaluationSetupView } from "./ui/EvaluationSetupView";

export interface EvaluationFinishResult {
  dataFlushed: boolean;
  sessionFinished: boolean;
}

export class AnalysisApplicationController {
  private readonly apiClient = new AnalysisApiClient(ANALYSIS_CONFIG.apiBaseUrl);
  private readonly cameraManager = new CameraManager();
  private readonly mediaPipeManager = new MediaPipeManager(ANALYSIS_CONFIG);
  private readonly activityContext = new ActivityContextAdapter();
  private readonly sessionManager = new AnalysisSessionManager(this.apiClient);
  private readonly dataSyncManager = new DataSyncManager(
    this.activityContext,
    this.apiClient,
    this.sessionManager,
    ANALYSIS_CONFIG
  );
  private readonly trackingManager = new BehaviorTrackingManager(
    ANALYSIS_CONFIG,
    this.cameraManager,
    this.mediaPipeManager,
    this.dataSyncManager,
    this.activityContext
  );
  private readonly setupView: EvaluationSetupView;
  private readonly debugOverlay: AnalysisDebugOverlay | null;
  private onReady: (() => void) | null = null;
  private unsubscribeCameraStatus: (() => void) | null = null;
  private unsubscribeCameraDisconnect: (() => void) | null = null;
  private unsubscribeCameraReconnect: (() => void) | null = null;
  private unsubscribeApiStatus: (() => void) | null = null;
  private unsubscribeActivityCompletion: (() => void) | null = null;
  private activityCompletedHandler: (() => void) | null = null;

  constructor(engine: Engine) {
    this.trackingManager.setRenderFpsProvider(() => engine.getFps());
    this.setupView = new EvaluationSetupView({
      createSession: (participantCode) => this.createSession(participantCode),
      requestCameras: () => this.requestCameras(),
      selectCamera: (role, deviceId) => this.selectCamera(role, deviceId),
      testCameras: () => this.testCameras(),
      calibrate: () => this.calibrate(),
      continue: () => this.continueToScenarios()
    }, ANALYSIS_CONFIG.debug);
    this.debugOverlay = ANALYSIS_CONFIG.debug
      ? new AnalysisDebugOverlay(
          () => this.getDebugSnapshot(),
          () => this.trackingManager.getDebugLandmarks()
        )
      : null;
  }

  initialize(onReady: () => void): void {
    this.onReady = onReady;
    this.cameraManager.initialize();
    this.setupView.show();
    this.debugOverlay?.show();
    this.unsubscribeCameraStatus = this.cameraManager.onStatusChange((status) => {
      this.setupView.updateCameraStatus(status);
    });
    this.unsubscribeCameraDisconnect = this.cameraManager.onDisconnect((role) => {
      this.dataSyncManager.recordBehaviorEvent("CAMERA_DISCONNECTED", {
        cameraRole: role,
        message: "La camara se desconecto durante la sesion."
      });
      void this.syncCameraConfiguration();
    });
    this.unsubscribeCameraReconnect = this.cameraManager.onReconnect((role) => {
      this.dataSyncManager.recordBehaviorEvent("CAMERA_RECONNECTED", {
        cameraRole: role,
        message: "La camara se recupero durante la sesion."
      });
      void this.syncCameraConfiguration();
    });
    this.unsubscribeApiStatus = this.apiClient.onConnectionChange((connected) => {
      this.setupView.setBackendConnected(connected);
    });
    this.unsubscribeActivityCompletion = this.activityContext.onEvent((event) => {
      if (event.type === "activity-result") {
        this.activityCompletedHandler?.();
      }
    });
  }

  onActivityCompleted(handler: () => void): void {
    this.activityCompletedHandler = handler;
  }

  setActiveScenario(scenarioId: string, activityId: string): ActivityTelemetrySink {
    this.activityContext.setScenario(scenarioId, activityId);
    return this.activityContext.createTelemetrySink(scenarioId, activityId);
  }

  clearActiveScenario(): void {
    this.activityContext.clearActivity();
  }

  async finishEvaluation(): Promise<EvaluationFinishResult> {
    this.sessionManager.setState("stopping");
    this.trackingManager.stop();
    const dataFlushed = await this.dataSyncManager.flushFinal();
    const session = this.sessionManager.getSession();
    let sessionFinished = false;

    if (
      dataFlushed &&
      session &&
      (await this.sessionManager.ensureRemoteSession())
    ) {
      sessionFinished = await this.apiClient
        .finishSession(session.sessionId, this.dataSyncManager.getCompletedScenarios())
        .then(() => true)
        .catch(() => false);
    }

    this.cameraManager.stopAll();
    this.mediaPipeManager.dispose();
    if (dataFlushed && sessionFinished) {
      this.dataSyncManager.clearSentData();
      this.dataSyncManager.dispose();
    }
    this.sessionManager.setState("finished");
    this.debugOverlay?.remove();

    return { dataFlushed, sessionFinished };
  }

  dispose(): void {
    this.trackingManager.dispose();
    this.dataSyncManager.dispose();
    this.mediaPipeManager.dispose();
    this.cameraManager.dispose();
    this.sessionManager.dispose();
    this.unsubscribeCameraStatus?.();
    this.unsubscribeCameraDisconnect?.();
    this.unsubscribeCameraReconnect?.();
    this.unsubscribeApiStatus?.();
    this.unsubscribeActivityCompletion?.();
    this.setupView.remove();
    this.debugOverlay?.remove();
  }

  getDebugSnapshot(): {
    state: string;
    buffer: { samples: number; events: number };
    backendConnected: boolean;
    context: ReturnType<ActivityContextAdapter["getContext"]>;
    performance: ReturnType<BehaviorTrackingManager["getPerformance"]>;
  } {
    return {
      state: this.sessionManager.getState(),
      buffer: this.dataSyncManager.getBufferSize(),
      backendConnected: this.apiClient.isConnected(),
      context: this.activityContext.getContext(),
      performance: this.trackingManager.getPerformance()
    };
  }

  private async createSession(participantCode: string): Promise<void> {
    const session = await this.sessionManager.createSession(participantCode);

    this.activityContext.startSession(
      session.sessionId,
      session.startedAtPerformance
    );
    this.sessionManager.setState("configuring-cameras");
    this.setupView.setSessionCreated(session.participantCode);
  }

  private async requestCameras(): Promise<void> {
    this.sessionManager.setState("requesting-permission");
    let devices: VideoDeviceOption[];

    try {
      devices = await this.cameraManager.requestPermission();
    } catch (error) {
      this.sessionManager.setState("error");
      throw error;
    }

    this.sessionManager.setState("configuring-cameras");

    if (devices.length === 0) {
      this.sessionManager.setState("error");
      throw new Error("No se detectaron camaras de video.");
    }

    this.setupView.attachVideo(
      "upper-body",
      this.cameraManager.getVideoElement("upper-body")
    );
    this.setupView.attachVideo(
      "full-body",
      this.cameraManager.getVideoElement("full-body")
    );
    await this.cameraManager.startUpperBodyCamera();

    if (this.cameraManager.getStatus().fullBody.selectedDeviceId) {
      await this.cameraManager.startFullBodyCamera().catch((error: unknown) => {
        console.warn("CAM2 no pudo iniciarse; se continuara con CAM1.", error);
      });
    }

    await this.syncCameraConfiguration();
    void this.trackingManager
      .startCameraPreview((landmarks) => {
        this.setupView.updateLandmarks(landmarks);
      })
      .catch((error: unknown) => {
        this.setupView.showError(
          error instanceof Error
            ? `No se pudo iniciar la deteccion: ${error.message}`
            : "No se pudo iniciar la deteccion de las camaras."
        );
      });
  }

  private async selectCamera(
    role: PhysicalCameraRole,
    deviceId: string | null
  ): Promise<void> {
    try {
      if (role === "upper-body") {
        this.cameraManager.setUpperBodyCamera(deviceId);
        if (deviceId) {
          await this.cameraManager.startUpperBodyCamera();
        }
      } else {
        this.cameraManager.setFullBodyCamera(deviceId);
        if (deviceId) {
          await this.cameraManager.startFullBodyCamera();
        }
      }

      await this.syncCameraConfiguration();
    } catch (error) {
      this.setupView.updateCameraStatus(this.cameraManager.getStatus());
      throw error;
    }
  }

  private async testCameras(): Promise<void> {
    const report = await this.trackingManager.checkCameraPosition();

    this.setupView.showQualityReport(report);
  }

  private async calibrate(): Promise<void> {
    this.sessionManager.setState("calibrating");

    try {
      await this.trackingManager.calibrateHead((progress) => {
        this.setupView.setCalibrationProgress(progress);
      });
      this.sessionManager.setState("ready");
      this.setupView.setCalibrated();
    } catch (error) {
      this.sessionManager.setState("error");
      throw error;
    }
  }

  private async continueToScenarios(): Promise<void> {
    this.sessionManager.setState("ready");
    this.trackingManager.stopCameraPreview();
    this.setupView.remove();
    this.trackingManager.start();
    this.sessionManager.setState("analyzing");
    this.onReady?.();
  }

  private async syncCameraConfiguration(): Promise<void> {
    const status = this.cameraManager.getStatus();

    await this.sessionManager.updateCameraConfiguration(
      status.upperBody.streamActive,
      status.fullBody.streamActive
    );
  }
}
