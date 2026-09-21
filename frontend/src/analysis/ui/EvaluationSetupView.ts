import type {
  PhysicalCameraManagerStatus,
  PhysicalCameraRole
} from "../cameras/CameraTypes";
import type {
  AnalysisDebugLandmarks,
  CameraQualityReport,
  FullBodyPreviewDiagnostics
} from "../tracking/BehaviorTrackingManager";
import {
  drawLandmarks,
  hasVisibleLandmarks
} from "./LandmarkOverlayRenderer";

export interface EvaluationSetupHandlers {
  createSession(participantCode: string): Promise<void>;
  requestCameras(): Promise<void>;
  selectCamera(role: PhysicalCameraRole, deviceId: string | null): Promise<void>;
  testCameras(): Promise<void>;
  calibrate(): Promise<void>;
  continue(): Promise<void>;
}

export class EvaluationSetupView {
  private root: HTMLElement | null = null;
  private participantInput: HTMLInputElement | null = null;
  private createSessionButton: HTMLButtonElement | null = null;
  private permissionButton: HTMLButtonElement | null = null;
  private upperSelect: HTMLSelectElement | null = null;
  private fullSelect: HTMLSelectElement | null = null;
  private testButton: HTMLButtonElement | null = null;
  private calibrateButton: HTMLButtonElement | null = null;
  private continueButton: HTMLButtonElement | null = null;
  private upperPreview: HTMLElement | null = null;
  private fullPreview: HTMLElement | null = null;
  private upperVideo: HTMLVideoElement | null = null;
  private fullVideo: HTMLVideoElement | null = null;
  private upperLandmarkCanvas: HTMLCanvasElement | null = null;
  private fullLandmarkCanvas: HTMLCanvasElement | null = null;
  private upperStatus: HTMLElement | null = null;
  private fullStatus: HTMLElement | null = null;
  private backendStatus: HTMLElement | null = null;
  private message: HTMLElement | null = null;
  private calibrationProgress: HTMLProgressElement | null = null;
  private sessionCreated = false;
  private calibrated = false;
  private upperCameraActive = false;
  private readonly handlers: EvaluationSetupHandlers;
  private readonly debug: boolean;

  constructor(handlers: EvaluationSetupHandlers, debug = false) {
    this.handlers = handlers;
    this.debug = debug;
  }

  show(): void {
    this.remove();
    const root = document.createElement("main");

    root.id = "evaluationSetup";
    root.innerHTML = `
      <section class="setupShell" aria-labelledby="setupTitle">
        <header class="setupHeader">
          <div>
            <p class="setupEyebrow">Sesion de evaluacion</p>
            <h1 id="setupTitle">Configuracion de camaras</h1>
          </div>
          <span class="backendBadge" id="analysisBackendStatus">API sin comprobar</span>
        </header>

        <div class="setupParticipant">
          <label for="participantCode">Codigo del participante</label>
          <div class="setupInlineControl">
            <input id="participantCode" autocomplete="off" maxlength="40" placeholder="P001" />
            <button id="createAnalysisSession" type="button">Crear sesion</button>
          </div>
        </div>

        <div class="setupToolbar">
          <button id="requestCameraPermission" type="button" disabled>Detectar camaras</button>
          <button id="testAnalysisCameras" type="button" class="secondaryButton" disabled>Probar camaras</button>
          <button id="calibrateAnalysis" type="button" class="secondaryButton" disabled>Calibrar</button>
        </div>

        <div class="cameraSetupGrid">
          <article class="cameraSetupPanel">
            <div class="cameraPanelHeading">
              <div>
                <span>CAM 1</span>
                <h2>Cabeza y tronco</h2>
              </div>
              <strong id="upperCameraStatus" data-tone="neutral">Sin configurar</strong>
            </div>
            <label for="upperCameraSelect">Camara superior</label>
            <select id="upperCameraSelect" disabled></select>
            <div class="cameraPreview" id="upperCameraPreview">
              <span>Vista previa no disponible</span>
            </div>
          </article>

          <article class="cameraSetupPanel">
            <div class="cameraPanelHeading">
              <div>
                <span>CAM 2</span>
                <h2>Cuerpo completo</h2>
              </div>
              <strong id="fullCameraStatus" data-tone="neutral">Sin configurar</strong>
            </div>
            <label for="fullCameraSelect">Camara externa</label>
            <select id="fullCameraSelect" disabled></select>
            <div class="cameraPreview" id="fullCameraPreview">
              <span>Vista previa no disponible</span>
            </div>
          </article>
        </div>

        <div class="calibrationStrip">
          <div>
            <strong>Calibracion frontal</strong>
            <span id="analysisSetupMessage">Crea una sesion para comenzar.</span>
          </div>
          <progress id="calibrationProgress" max="100" value="0"></progress>
        </div>

        <footer class="setupFooter">
          <p>Los videos se procesan localmente y no se guardan.</p>
          <button id="continueToScenarios" type="button" disabled>Continuar a escenarios</button>
        </footer>
      </section>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.captureElements();
    this.registerHandlers();
  }

  attachVideo(role: PhysicalCameraRole, video: HTMLVideoElement): void {
    const preview = role === "upper-body" ? this.upperPreview : this.fullPreview;

    if (!preview) {
      return;
    }

    const landmarkCanvas = document.createElement("canvas");

    landmarkCanvas.className = "cameraLandmarkOverlay";
    landmarkCanvas.setAttribute("aria-hidden", "true");
    preview.replaceChildren(video, landmarkCanvas);
    video.className = "cameraPreviewVideo";
    video.removeAttribute("aria-hidden");

    if (role === "upper-body") {
      this.upperVideo = video;
      this.upperLandmarkCanvas = landmarkCanvas;
    } else {
      this.fullVideo = video;
      this.fullLandmarkCanvas = landmarkCanvas;
    }
  }

  updateLandmarks(landmarks: AnalysisDebugLandmarks): void {
    drawPreviewLandmarks(
      this.upperLandmarkCanvas,
      this.upperVideo,
      landmarks.upperPose,
      landmarks.upperFace
    );
    drawPreviewLandmarks(
      this.fullLandmarkCanvas,
      this.fullVideo,
      landmarks.fullBodyPose,
      null,
      this.debug ? landmarks.fullBodyDiagnostics : null
    );
  }

  setSessionCreated(participantCode: string): void {
    this.sessionCreated = true;

    if (this.participantInput) {
      this.participantInput.value = participantCode;
      this.participantInput.disabled = true;
    }
    if (this.createSessionButton) {
      this.createSessionButton.disabled = true;
      this.createSessionButton.textContent = "Sesion creada";
    }
    if (this.permissionButton) {
      this.permissionButton.disabled = false;
    }
    this.setMessage("Solicita acceso para detectar las camaras conectadas.");
  }

  updateCameraStatus(status: PhysicalCameraManagerStatus): void {
    this.upperCameraActive = status.upperBody.streamActive;
    this.populateSelect(this.upperSelect, status.devices, status.upperBody.selectedDeviceId, false);
    this.populateSelect(this.fullSelect, status.devices, status.fullBody.selectedDeviceId, true);

    if (this.upperSelect) {
      this.upperSelect.disabled = !status.permissionGranted || status.devices.length === 0;
    }
    if (this.fullSelect) {
      this.fullSelect.disabled = !status.permissionGranted || status.devices.length < 2;
    }

    this.renderSlotStatus(this.upperStatus, status.upperBody.state, status.upperBody.error);
    this.renderSlotStatus(this.fullStatus, status.fullBody.state, status.fullBody.error);

    if (this.testButton) {
      this.testButton.disabled = !status.upperBody.streamActive;
    }
    if (this.calibrateButton) {
      this.calibrateButton.disabled = !status.upperBody.streamActive;
    }
  }

  showQualityReport(report: CameraQualityReport): void {
    this.renderQuality(this.upperStatus, report.upperBody.adequate, report.upperBody.message);
    this.renderQuality(this.fullStatus, report.fullBody.adequate, report.fullBody.message);
    this.setMessage(
      report.upperBody.adequate
        ? "Encuadre comprobado. Realiza la calibracion frontal."
        : report.upperBody.message
    );
  }

  setCalibrationProgress(progress: number): void {
    if (this.calibrationProgress) {
      this.calibrationProgress.value = Math.round(Math.min(1, progress) * 100);
    }
    this.setMessage(
      progress < 1 ? "Mira al centro de la pantalla." : "Calibracion completada."
    );
  }

  setCalibrated(): void {
    this.calibrated = true;

    if (this.calibrateButton) {
      this.calibrateButton.textContent = "Calibrado";
    }
    if (this.continueButton) {
      this.continueButton.disabled = false;
    }
  }

  setBackendConnected(connected: boolean): void {
    if (!this.backendStatus) {
      return;
    }

    this.backendStatus.textContent = connected ? "API conectada" : "API sin conexion";
    this.backendStatus.dataset.tone = connected ? "success" : "warning";
  }

  setBusy(busy: boolean): void {
    [
      this.createSessionButton,
      this.permissionButton,
      this.testButton,
      this.calibrateButton,
      this.continueButton
    ].forEach((button) => {
      if (button) {
        button.disabled = busy || this.getDefaultDisabledState(button);
      }
    });
  }

  showError(message: string): void {
    this.setMessage(message, true);
  }

  remove(): void {
    this.root?.remove();
    this.root = null;
    this.upperVideo = null;
    this.fullVideo = null;
    this.upperLandmarkCanvas = null;
    this.fullLandmarkCanvas = null;
  }

  private captureElements(): void {
    this.participantInput = this.root?.querySelector("#participantCode") ?? null;
    this.createSessionButton = this.root?.querySelector("#createAnalysisSession") ?? null;
    this.permissionButton = this.root?.querySelector("#requestCameraPermission") ?? null;
    this.upperSelect = this.root?.querySelector("#upperCameraSelect") ?? null;
    this.fullSelect = this.root?.querySelector("#fullCameraSelect") ?? null;
    this.testButton = this.root?.querySelector("#testAnalysisCameras") ?? null;
    this.calibrateButton = this.root?.querySelector("#calibrateAnalysis") ?? null;
    this.continueButton = this.root?.querySelector("#continueToScenarios") ?? null;
    this.upperPreview = this.root?.querySelector("#upperCameraPreview") ?? null;
    this.fullPreview = this.root?.querySelector("#fullCameraPreview") ?? null;
    this.upperStatus = this.root?.querySelector("#upperCameraStatus") ?? null;
    this.fullStatus = this.root?.querySelector("#fullCameraStatus") ?? null;
    this.backendStatus = this.root?.querySelector("#analysisBackendStatus") ?? null;
    this.message = this.root?.querySelector("#analysisSetupMessage") ?? null;
    this.calibrationProgress = this.root?.querySelector("#calibrationProgress") ?? null;
  }

  private registerHandlers(): void {
    this.createSessionButton?.addEventListener("click", () => {
      const participantCode = this.participantInput?.value.trim() ?? "";

      if (!/^[A-Za-z0-9_-]{2,40}$/.test(participantCode)) {
        this.showError("Ingresa un codigo pseudonimizado valido.");
        return;
      }

      void this.runAction(() => this.handlers.createSession(participantCode));
    });
    this.permissionButton?.addEventListener("click", () => {
      void this.runAction(() => this.handlers.requestCameras());
    });
    this.upperSelect?.addEventListener("change", () => {
      void this.runAction(() =>
        this.handlers.selectCamera("upper-body", this.upperSelect?.value || null)
      );
    });
    this.fullSelect?.addEventListener("change", () => {
      void this.runAction(() =>
        this.handlers.selectCamera("full-body", this.fullSelect?.value || null)
      );
    });
    this.testButton?.addEventListener("click", () => {
      void this.runAction(() => this.handlers.testCameras());
    });
    this.calibrateButton?.addEventListener("click", () => {
      void this.runAction(() => this.handlers.calibrate());
    });
    this.continueButton?.addEventListener("click", () => {
      void this.runAction(() => this.handlers.continue());
    });
  }

  private async runAction(action: () => Promise<void>): Promise<void> {
    this.setBusy(true);

    try {
      await action();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "No se pudo completar la accion.");
    } finally {
      this.setBusy(false);
    }
  }

  private populateSelect(
    select: HTMLSelectElement | null,
    devices: PhysicalCameraManagerStatus["devices"],
    selectedId: string | null,
    allowEmpty: boolean
  ): void {
    if (!select) {
      return;
    }

    const previousOptions = [...select.options].map((option) => option.value).join("|");
    const nextOptions = [allowEmpty ? "" : null, ...devices.map((device) => device.deviceId)]
      .filter((value): value is string => value !== null)
      .join("|");

    if (previousOptions !== nextOptions) {
      select.replaceChildren();
      if (allowEmpty) {
        const empty = document.createElement("option");

        empty.value = "";
        empty.textContent = "No disponible";
        select.appendChild(empty);
      }
      devices.forEach((device) => {
        const option = document.createElement("option");

        option.value = device.deviceId;
        option.textContent = device.label;
        select.appendChild(option);
      });
    }

    select.value = selectedId ?? "";
  }

  private renderSlotStatus(
    element: HTMLElement | null,
    state: string,
    error: string | null
  ): void {
    if (!element) {
      return;
    }

    const labels: Record<string, string> = {
      idle: "Sin configurar",
      selected: "Seleccionada",
      starting: "Conectando",
      streaming: "Activa",
      unavailable: "No disponible",
      error: "Error"
    };

    element.textContent = error ?? labels[state] ?? state;
    element.title = error ?? "";
    element.dataset.tone =
      state === "streaming" ? "success" : state === "error" ? "danger" : "neutral";
  }

  private renderQuality(
    element: HTMLElement | null,
    adequate: boolean,
    message: string
  ): void {
    if (!element) {
      return;
    }

    element.textContent = adequate ? "Posicion adecuada" : "Requiere ajuste";
    element.title = message;
    element.dataset.tone = adequate ? "success" : "warning";
  }

  private setMessage(message: string, error = false): void {
    if (!this.message) {
      return;
    }

    this.message.textContent = message;
    this.message.dataset.tone = error ? "danger" : "neutral";
  }

  private getDefaultDisabledState(button: HTMLButtonElement): boolean {
    if (button === this.createSessionButton) {
      return this.sessionCreated;
    }

    if (button === this.permissionButton) {
      return !this.sessionCreated;
    }

    if (button === this.continueButton) {
      return !this.calibrated;
    }

    if (button === this.testButton || button === this.calibrateButton) {
      return !this.upperCameraActive;
    }

    return false;
  }
}

function drawPreviewLandmarks(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  pose: AnalysisDebugLandmarks["upperPose"],
  face: AnalysisDebugLandmarks["upperFace"],
  diagnostics: FullBodyPreviewDiagnostics | null = null
): void {
  if (!canvas || !video) {
    return;
  }

  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (displayWidth <= 0 || displayHeight <= 0) {
    return;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
  const targetHeight = Math.max(1, Math.round(displayHeight * pixelRatio));

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  const detectionVisible = hasVisibleLandmarks(pose, face);

  if (!detectionVisible) {
    context.fillStyle = "rgba(7, 19, 29, 0.72)";
    context.font = `${12 * pixelRatio}px Arial, sans-serif`;
    context.textAlign = "center";
    context.fillText(
      "Buscando deteccion...",
      canvas.width / 2,
      canvas.height / 2
    );
  }

  const sourceWidth = video.videoWidth || 4;
  const sourceHeight = video.videoHeight || 3;
  const sourceAspect = sourceWidth / sourceHeight;
  const canvasAspect = canvas.width / canvas.height;
  let viewportWidth = canvas.width;
  let viewportHeight = canvas.height;
  let viewportX = 0;
  let viewportY = 0;

  if (canvasAspect > sourceAspect) {
    viewportWidth = canvas.height * sourceAspect;
    viewportX = (canvas.width - viewportWidth) / 2;
  } else {
    viewportHeight = canvas.width / sourceAspect;
    viewportY = (canvas.height - viewportHeight) / 2;
  }

  if (detectionVisible) {
    drawLandmarks(
      context,
      pose,
      face,
      {
        x: viewportX,
        y: viewportY,
        width: viewportWidth,
        height: viewportHeight,
        mirrorX: true
      },
      pixelRatio
    );
  }

  if (diagnostics) {
    drawFullBodyDiagnostics(context, diagnostics, pixelRatio);
  }
}

function drawFullBodyDiagnostics(
  context: CanvasRenderingContext2D,
  diagnostics: FullBodyPreviewDiagnostics,
  pixelRatio: number
): void {
  const lines = [
    `Pose: ${diagnostics.poseDetected ? "detected" : "not detected"}`,
    `FPS: ${diagnostics.detectCallsPerSecond.toFixed(1)}`,
    `Visible joints: ${diagnostics.visibleJointCount}/${diagnostics.landmarkCount || 33}`,
    `Quality: ${diagnostics.quality}`
  ];
  const fontSize = 11 * pixelRatio;
  const lineHeight = 15 * pixelRatio;
  const padding = 7 * pixelRatio;
  const width = 150 * pixelRatio;
  const height = padding * 2 + lineHeight * lines.length;

  context.save();
  context.fillStyle = "rgba(5, 15, 24, 0.82)";
  context.fillRect(padding, padding, width, height);
  context.font = `${fontSize}px Arial, sans-serif`;
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = diagnostics.poseDetected ? "#9ce7b4" : "#ffd08a";
  lines.forEach((line, index) => {
    context.fillText(
      line,
      padding * 2,
      padding * 2 + index * lineHeight
    );
  });
  context.restore();
}
