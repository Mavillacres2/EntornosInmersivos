import { createPrivacyFooter } from '../../specialist/PrivacyFooter';
import { ANALYSIS_CONFIG } from "../config/AnalysisConfig";
import type { HandDetection, HeadOrientation } from "../types/AnalysisTypes";
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
  private framingChecked = false;
  private fullCameraActive = false;
  private busy = false;
  private canSelectUpper = false;
  private canSelectFull = false;
  private selectedUpper: string | null = null;
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
            <p class="setupEyebrow">NeuroExplora · Preparación de la sesión</p>
            <h1 id="setupTitle">Prepare la sesión en cuatro pasos</h1>
            <p class="setupIntro">Complete esta preparación con el niño. Después podrá elegir y explorar sus aventuras.</p>
          </div>
          <span class="backendBadge" id="analysisBackendStatus" role="status" aria-live="polite">Comprobando conexión…</span>
        </header>
        <ol class="setupSteps" aria-label="Progreso de configuración">
          <li data-step="1" aria-current="step"><span>1</span> Identificar sesión</li>
          <li data-step="2"><span>2</span> Ajustar cámaras</li>
          <li data-step="3"><span>3</span> Comprobar encuadre</li><li data-step="4"><span>4</span> Calibrar posición</li>
        </ol>

        <div class="setupParticipant">
          <label for="participantCode">Código del participante</label>
          <div class="setupInlineControl">
            <input id="participantCode" autocomplete="off" maxlength="40" placeholder="Ej. P001" aria-describedby="participantHint" />
            <button id="createAnalysisSession" type="button">1. Crear sesión</button>
          </div>
          <p class="setupHint" id="participantHint">Utiliza el código asignado al participante, sin nombres ni apellidos.</p>
        </div>

        <div class="setupToolbar">
          <button id="requestCameraPermission" type="button" disabled>2. Conectar cámara</button>
          <button id="testAnalysisCameras" type="button" class="secondaryButton" disabled>3. Comprobar encuadre</button>
          <button id="calibrateAnalysis" type="button" class="secondaryButton" disabled>4. Calibrar posición</button>
        </div>

        <div class="setupHelp"><details><summary>¿Qué hace cada paso?</summary><p><strong>Conectar cámara:</strong> autoriza el video y permite elegir el dispositivo. CAM2 es opcional.</p><p><strong>Comprobar encuadre:</strong> toma varias detecciones para verificar que el rostro y los hombros sean visibles. Si pide un ajuste, cambie distancia o iluminación y repita.</p><p><strong>Calibrar posición:</strong> con el niño mirando al centro, calcula una orientación frontal de referencia para medir giros relativos. No evalúa la atención ni diagnostica.</p><p>Mantenga esta pestaña visible. Si cambia CAM1 o la posición de la cámara, compruebe y calibre otra vez.</p></details></div><div class="cameraSetupGrid">
          <article class="cameraSetupPanel">
            <div class="cameraPanelHeading">
              <div>
                <span>CAM 1</span>
                <h2>Rostro y tren superior</h2>
              </div>
              <strong id="upperCameraStatus" data-tone="neutral">Sin configurar</strong>
            </div>
            <label for="upperCameraSelect">Camara de rostro y tren superior (laptop)</label>
            <select id="upperCameraSelect" disabled></select>
            <div class="cameraPreview" id="upperCameraPreview">
              <span>Conecta las cámaras para ver el encuadre</span>
            </div>
            <p class="cameraGuidance"><strong>Frente al participante</strong>Encuadra la cabeza, los hombros y los brazos. Mantén el rostro iluminado.</p>
          </article>

          <article class="cameraSetupPanel">
            <div class="cameraPanelHeading">
              <div>
                <span>CAM 2</span>
                <h2>Cuerpo y manos <small>Opcional</small></h2>
              </div>
              <strong id="fullCameraStatus" data-tone="neutral">Sin configurar</strong>
            </div>
            <label for="fullCameraSelect">Camara externa</label>
            <select id="fullCameraSelect" disabled></select>
            <div class="cameraPreview" id="fullCameraPreview">
              <span>Sin segunda cámara, puede continuar con CAM1</span>
            </div>
            <p class="cameraGuidance"><strong>Vista amplia del cuerpo</strong>Coloca la cámara a distancia para incluir manos, piernas y pies.</p>
          </article>
        </div>

        <div class="calibrationStrip">
          <div>
            <strong>Tu siguiente paso</strong>
            <span id="analysisSetupMessage" role="status">Crea una sesión para habilitar la conexión de cámaras.</span>
          </div>
          <progress id="calibrationProgress" max="100" value="0" aria-label="Progreso de calibración"></progress>
        </div>

        <footer class="setupFooter">
          <p><strong>Privacidad durante toda la sesión</strong><br />El video se procesa en este equipo y no se guarda.</p>
          <button id="continueToScenarios" type="button" disabled>Todo listo: pasar al niño →</button>
        </footer>
      </section>
    `;
    document.body.appendChild(root);
    this.root = root;
    const detection = document.createElement("p");
    detection.id = "visionDetectionStatus";
    detection.setAttribute("role", "status");
    root.querySelector(".cameraSetupGrid")?.after(detection);
    root.querySelector(".setupShell")?.append(createPrivacyFooter());
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
    const status = this.root?.querySelector("#visionDetectionStatus");
    if (status) {
      const labels: [string, boolean][] = [
        ["Rostro", Boolean(landmarks.upperFace?.length)],
        ["Ojos", landmarks.eyesDetected === true],
        ["Hombros y brazos (CAM1)", [11,12,13,14,15,16].every(i => (landmarks.upperPose?.[i]?.visibility ?? 0) >= ANALYSIS_CONFIG.mediaPipe.minimumVisibility)],
        ["Pose", landmarks.fullBodyDiagnostics.poseDetected && landmarks.fullBodyDiagnostics.visibleJointCount > 0],
        ["Mano izquierda", Boolean(landmarks.hands?.some(h => h.side === "left"))],
        ["Mano derecha", Boolean(landmarks.hands?.some(h => h.side === "right"))]
      ];
      status.textContent = labels.map(([label, ok]) => `${label}: ${ok ? "detectado" : "sin detección"}`).join(" · ")
        + (landmarks.handError ? ` · ${landmarks.handError}` : "");
    }
    drawPreviewLandmarks(
      this.upperLandmarkCanvas,
      this.upperVideo,
      landmarks.upperPose,
      landmarks.upperFace, null, [], landmarks.headOrientation ?? null, this.debug, true
    );
    drawPreviewLandmarks(
      this.fullLandmarkCanvas,
      this.fullVideo,
      landmarks.fullBodyPose,
      null,
      this.debug ? landmarks.fullBodyDiagnostics : null, landmarks.hands ?? [], null, this.debug
    );
  }

  setSessionCreated(participantCode: string): void {
    this.sessionCreated = true;
    this.updateSteps(2);

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
    const changed = this.selectedUpper !== status.upperBody.selectedDeviceId;
    if (changed || (this.upperCameraActive && !status.upperBody.streamActive)) this.invalidateCalibration();
    this.selectedUpper = status.upperBody.selectedDeviceId;
    this.upperCameraActive = status.upperBody.streamActive;
    this.fullCameraActive = status.fullBody.streamActive;
    if (this.sessionCreated) this.updateSteps(this.calibrated ? 5 : this.framingChecked ? 4 : this.upperCameraActive ? 3 : 2);
    this.populateSelect(this.upperSelect, status.devices, status.upperBody.selectedDeviceId, false);
    this.populateSelect(this.fullSelect, status.devices, status.fullBody.selectedDeviceId, true);

    if (this.upperSelect) {
      this.canSelectUpper = status.permissionGranted && status.devices.length > 0;
      this.upperSelect.disabled = this.busy || !this.canSelectUpper;
    }
    if (this.fullSelect) {
      this.canSelectFull = status.permissionGranted && status.devices.length >= 2;
      this.fullSelect.disabled = this.busy || !this.canSelectFull;
    }

    this.renderSlotStatus(this.upperStatus, status.upperBody.state, status.upperBody.error);
    this.renderSlotStatus(this.fullStatus, status.fullBody.state, status.fullBody.error);

    if (this.testButton) {
      this.testButton.disabled = this.busy || !status.upperBody.streamActive;
    }
    if (this.calibrateButton) {
      this.calibrateButton.disabled = this.busy || !status.upperBody.streamActive || !this.framingChecked;
    }
  }

  showQualityReport(report: CameraQualityReport): void {
    this.framingChecked = report.upperBody.adequate;
    this.calibrated = false;
    if (this.continueButton) this.continueButton.disabled = true;
    this.updateSteps(this.framingChecked ? 4 : 3);
    this.renderQuality(this.upperStatus, report.upperBody.adequate, report.upperBody.message);
    if (this.fullCameraActive) this.renderQuality(this.fullStatus, report.fullBody.adequate, report.fullBody.message);
    else if (this.fullStatus) { this.fullStatus.textContent = 'No utilizada · opcional'; this.fullStatus.dataset.tone = 'neutral'; }
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
    this.updateSteps(5);
    this.setMessage("Preparación completada. Ahora el niño puede elegir su aventura.");

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

    this.backendStatus.textContent = connected ? "Guardado disponible · conexión verificada" : "Sin conexión · no cierre esta página";
    this.backendStatus.dataset.tone = connected ? "success" : "warning";
    this.backendStatus.title = "Comprobación automática cada 5 segundos; también al volver a esta ventana.";
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    if (this.upperSelect) this.upperSelect.disabled = busy || !this.canSelectUpper;
    if (this.fullSelect) this.fullSelect.disabled = busy || !this.canSelectFull;
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

  private invalidateCalibration(): void {
    this.calibrated = false;
    this.framingChecked = false;
    if (this.continueButton) this.continueButton.disabled = true;
    if (this.calibrateButton) this.calibrateButton.textContent = '4. Calibrar posición';
    if (this.calibrationProgress) this.calibrationProgress.value = 0;
  }

  private updateSteps(current: number): void {
    this.root?.querySelectorAll<HTMLElement>("[data-step]").forEach(step => {
      const number = Number(step.dataset.step);
      step.dataset.complete = String(number < current);
      if (number === current) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
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
      void this.runAction(async () => {
        await this.handlers.requestCameras();
        if (this.upperCameraActive) this.setMessage('Cámara conectada. Acomode rostro y hombros y pulse «3. Comprobar encuadre».');
      });
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
      this.calibrated = false;
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

    if (button === this.calibrateButton) return !this.upperCameraActive || !this.framingChecked;
    if (button === this.testButton) {
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
  diagnostics: FullBodyPreviewDiagnostics | null = null,
  hands: HandDetection[] = [],
  head: HeadOrientation | null = null,
  debug = false,
  upperBodyOnly = false
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

  const detectionVisible = hasVisibleLandmarks(pose, face) || hands.length > 0;

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
        mirrorX: true,
        upperBodyOnly
      },
      pixelRatio, hands, head, debug
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
