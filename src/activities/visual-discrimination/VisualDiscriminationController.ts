import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Observer, PickingInfo, Scene } from "@babylonjs/core";

import { FaceStimulusGenerator } from "./FaceStimulusGenerator";
import { TrialLogger } from "./TrialLogger";
import { TrialScheduler } from "./TrialScheduler";
import type {
  FaceFeatures,
  FaceIndex,
  FaceSet,
  ScheduledBlock,
  ScheduledTrial,
  TechnicalTelemetry,
  VisualDiscriminationConfig,
  VisualDiscriminationSessionResult,
  VisualDiscriminationState,
  VisualDiscriminationTrialLog
} from "./VisualDiscriminationTypes";
import { VisualDiscriminationDistractorManager } from "./VisualDiscriminationDistractorManager";
import { VisualDiscriminationMetricsManager } from "./VisualDiscriminationMetricsManager";

interface VisualDiscriminationControllerOptions {
  scene: Scene;
  activityPanelMesh: Mesh;
  config: VisualDiscriminationConfig;
  distractorManager: VisualDiscriminationDistractorManager;
  onFinished?: (result: VisualDiscriminationSessionResult) => void;
  onReturnToMenu?: () => void;
}

type TrialCompletionReason = "response" | "timeout";

const FACE_X_POSITIONS = [520, 1024, 1528] as const;

export class VisualDiscriminationController {
  private readonly scene: Scene;
  private readonly activityPanelMesh: Mesh;
  private readonly config: VisualDiscriminationConfig;
  private readonly distractorManager: VisualDiscriminationDistractorManager;
  private readonly onFinished: ((result: VisualDiscriminationSessionResult) => void) | null;
  private readonly onReturnToMenu: (() => void) | null;
  private readonly scheduler = new TrialScheduler();
  private readonly generator = new FaceStimulusGenerator();
  private readonly metricsManager = new VisualDiscriminationMetricsManager();
  private readonly trialLogger = new TrialLogger();
  private readonly handleKeyDownBound = (event: KeyboardEvent): void => {
    this.handleKeyDown(event);
  };
  private readonly handlePointerDownBound = (): void => {
    this.handlePointerDown();
  };

  private state: VisualDiscriminationState = "instructions";
  private sessionId = "";
  private practiceTrials: ScheduledTrial[] = [];
  private officialBlocks: ScheduledBlock[] = [];
  private currentBlock: ScheduledBlock | null = null;
  private currentTrial: ScheduledTrial | null = null;
  private currentFaceSet: FaceSet | null = null;
  private currentPracticeIndex = 0;
  private currentBlockIndex = 0;
  private currentTrialIndex = 0;
  private stimulusOnsetMs = 0;
  private firstAimOnAnyFaceMs: number | null = null;
  private trialFinished = true;
  private responseEnabled = false;
  private screenTexture: DynamicTexture | null = null;
  private screenMaterial: StandardMaterial | null = null;
  private faceHitBoxes: Mesh[] = [];
  private reticle: HTMLElement | null = null;
  private responseTimeoutId: number | null = null;
  private itiTimeoutId: number | null = null;
  private countdownTimeoutId: number | null = null;
  private inputHandlersRegistered = false;
  private aimObserver: Observer<Scene> | null = null;
  private frameObserver: Observer<Scene> | null = null;
  private readonly frameTimes: number[] = [];

  constructor(options: VisualDiscriminationControllerOptions) {
    this.scene = options.scene;
    this.activityPanelMesh = options.activityPanelMesh;
    this.config = options.config;
    this.distractorManager = options.distractorManager;
    this.onFinished = options.onFinished ?? null;
    this.onReturnToMenu = options.onReturnToMenu ?? null;
  }

  showInstructions(): void {
    this.cleanupTimers();
    this.distractorManager.disableAll();
    this.resetRuntimeState();
    this.registerInputHandlers();
    this.ensureReticle();
    this.ensureFrameTelemetry();
    this.renderTextScreen("Actividad de Discriminacion Visual", [
      "Veras tres caras esquematicas.",
      "Dos seran iguales y una sera diferente.",
      "Apunta con la reticula a la cara diferente y haz clic.",
      "Primero haremos una practica con feedback.",
      "Presiona 1 para comenzar. M vuelve al menu."
    ]);
  }

  dispose(): void {
    this.cleanupTimers();
    this.unregisterInputHandlers();
    this.removeAimObserver();
    this.removeFrameTelemetry();
    this.distractorManager.dispose();
    this.disposeHitBoxes();
    this.disposeScreen();
    this.reticle?.remove();
    this.reticle = null;
  }

  private startPractice(): void {
    this.cleanupTimers();
    this.resetRuntimeState();
    this.distractorManager.prepareAudio();
    this.practiceTrials = this.scheduler.createPracticeTrials(this.config);
    this.state = "practice";
    this.renderTextScreen("Practica", [
      "Selecciona la cara diferente.",
      "Durante la practica veras si acertaste.",
      "Preparate."
    ]);
    this.itiTimeoutId = window.setTimeout(() => {
      this.itiTimeoutId = null;
      this.beginNextPracticeTrial();
    }, 650);
  }

  private beginNextPracticeTrial(): void {
    if (this.state !== "practice") {
      return;
    }

    if (this.currentPracticeIndex >= this.practiceTrials.length) {
      this.finishPractice();
      return;
    }

    const trial = this.practiceTrials[this.currentPracticeIndex];

    this.currentPracticeIndex += 1;
    this.presentTrial(trial);
  }

  private finishPracticeTrial(reason: TrialCompletionReason, selectedIndex: FaceIndex | null): void {
    if (
      this.state !== "practice" ||
      this.trialFinished ||
      !this.currentTrial ||
      !this.currentFaceSet
    ) {
      return;
    }

    const correct = reason === "response" && selectedIndex === this.currentFaceSet.correctIndex;

    this.completeCurrentTrial();
    this.state = "practice-feedback";
    this.renderTextScreen("Practica", [
      correct
        ? "Correcto."
        : "Observa nuevamente: dos caras son iguales y una es diferente.",
      `Ensayo ${this.currentPracticeIndex} de ${this.config.practiceTrials}.`
    ]);
    this.itiTimeoutId = window.setTimeout(() => {
      this.itiTimeoutId = null;
      this.state = "practice";
      this.beginNextPracticeTrial();
    }, 900);
  }

  private finishPractice(): void {
    this.state = "countdown";
    this.responseEnabled = false;
    this.trialFinished = true;
    this.renderTextScreen("Practica finalizada", [
      "Ahora comenzara la evaluacion.",
      "Durante la prueba no se mostrara feedback.",
      "Mantente atento al panel."
    ]);
    this.countdownTimeoutId = window.setTimeout(() => {
      this.countdownTimeoutId = null;
      this.runCountdown(3);
    }, 800);
  }

  private runCountdown(secondsRemaining: number): void {
    if (this.state !== "countdown") {
      return;
    }

    if (secondsRemaining <= 0) {
      void this.startEvaluation();
      return;
    }

    this.renderTextScreen("Evaluacion", [
      "Comenzamos en",
      String(secondsRemaining)
    ]);
    this.countdownTimeoutId = window.setTimeout(() => {
      this.countdownTimeoutId = null;
      this.runCountdown(secondsRemaining - 1);
    }, 1000);
  }

  private async startEvaluation(): Promise<void> {
    this.sessionId = `vd-session-${Date.now()}`;
    this.officialBlocks = this.scheduler.createOfficialBlocks(this.config);
    this.metricsManager.startSession(this.sessionId);
    await this.trialLogger.startSession(this.sessionId);
    this.currentBlockIndex = 0;
    this.startBlock(0);
  }

  private startBlock(blockIndex: number): void {
    const block = this.officialBlocks[blockIndex];

    if (!block) {
      void this.finishSession();
      return;
    }

    this.cleanupTimers();
    this.distractorManager.disableAll();
    this.currentBlock = block;
    this.currentBlockIndex = blockIndex;
    this.currentTrialIndex = 0;
    this.state = "running-block";
    this.renderTextScreen(`Bloque ${blockIndex + 1}`, [
      "Mira el panel y selecciona la cara diferente.",
      "No se mostrara feedback durante la evaluacion."
    ]);
    this.itiTimeoutId = window.setTimeout(() => {
      this.itiTimeoutId = null;
      this.beginNextOfficialTrial();
    }, 700);
  }

  private beginNextOfficialTrial(): void {
    if (this.state !== "running-block" || !this.currentBlock) {
      return;
    }

    if (this.currentTrialIndex >= this.currentBlock.trials.length) {
      this.endCurrentBlock();
      return;
    }

    const trial = this.currentBlock.trials[this.currentTrialIndex];

    this.currentTrialIndex += 1;
    this.presentTrial(trial);
  }

  private presentTrial(trial: ScheduledTrial): void {
    this.cleanupTimers();
    this.disposeHitBoxes();
    this.currentTrial = trial;
    this.currentFaceSet = this.generator.generateFaceSet(
      trial.generatorSeed,
      trial.correctIndex,
      trial.difficulty
    );
    this.trialFinished = false;
    this.responseEnabled = true;
    this.firstAimOnAnyFaceMs = null;
    this.renderFaceTrial(this.currentFaceSet);
    this.createHitBoxes();
    this.stimulusOnsetMs = performance.now();
    this.ensureAimObserver();

    if (this.state === "running-block") {
      this.distractorManager.scheduleForTrial(trial, this.stimulusOnsetMs);
    }

    this.responseTimeoutId = window.setTimeout(() => {
      this.responseTimeoutId = null;
      this.finishActiveTrial("timeout", null);
    }, this.config.responseWindowMs);
  }

  private finishActiveTrial(
    reason: TrialCompletionReason,
    selectedIndex: FaceIndex | null
  ): void {
    if (this.state === "practice") {
      this.finishPracticeTrial(reason, selectedIndex);
      return;
    }

    if (
      this.state !== "running-block" ||
      this.trialFinished ||
      !this.currentTrial ||
      !this.currentFaceSet
    ) {
      return;
    }

    const now = reason === "response" ? performance.now() : null;
    const isOmission = reason === "timeout";
    const isCorrect = selectedIndex === this.currentFaceSet.correctIndex && !isOmission;
    const distractorEvent = this.distractorManager.getActiveEvent();
    const log: VisualDiscriminationTrialLog = {
      trialId: this.currentTrial.trialId,
      blockId: this.currentTrial.blockId,
      blockIndex: this.currentTrial.blockIndex,
      blockType: this.currentTrial.blockType,
      faceSetId: this.currentFaceSet.id,
      generatorSeed: this.currentFaceSet.seed,
      difficulty: this.currentFaceSet.difficulty,
      changedFeatures: [...this.currentFaceSet.changedFeatures],
      correctIndex: this.currentFaceSet.correctIndex,
      selectedIndex,
      isCorrect,
      isOmission,
      stimulusOnsetMs: this.stimulusOnsetMs,
      responseTimestampMs: now,
      rtMs: now === null ? null : Math.max(0, now - this.stimulusOnsetMs),
      firstAimOnAnyFaceMs: this.firstAimOnAnyFaceMs,
      distractorActive: distractorEvent.distractorActive,
      distractorType: distractorEvent.distractorType,
      distractorId: distractorEvent.distractorId,
      distractorOnsetOffsetMs: distractorEvent.actualOnsetOffsetMs,
      distractorDurationMs: distractorEvent.durationMs,
      inputMode: this.config.inputMode,
      timestampIso: new Date().toISOString()
    };

    void this.trialLogger.logTrial(log);
    this.completeCurrentTrial();
    this.renderBlankTrial();

    this.itiTimeoutId = window.setTimeout(() => {
      this.itiTimeoutId = null;
      this.beginNextOfficialTrial();
    }, this.getJitteredIti());
  }

  private endCurrentBlock(): void {
    if (this.state !== "running-block" || !this.currentBlock) {
      return;
    }

    this.cleanupTimers();
    this.completeCurrentTrial();
    this.distractorManager.disableAll();

    const nextBlockIndex = this.currentBlockIndex + 1;

    this.currentBlock = null;
    if (nextBlockIndex >= this.officialBlocks.length) {
      void this.finishSession();
      return;
    }

    this.state = "resting";
    this.renderTextScreen("Muy bien", [
      "Puedes descansar unos segundos.",
      "Presiona 1 cuando estes listo para continuar."
    ]);
  }

  private async finishSession(): Promise<void> {
    if (this.state === "finished") {
      return;
    }

    this.cleanupTimers();
    this.completeCurrentTrial();
    this.distractorManager.disableAll();
    this.state = "finished";
    await this.trialLogger.completeSession(this.sessionId);
    const result = this.metricsManager.buildSessionResult(
      this.trialLogger.getTrials(),
      this.buildTelemetry()
    );

    console.log("VISUAL DISCRIMINATION SESSION RESULT", result);
    this.renderResults(result);
    this.onFinished?.(result);
  }

  private handlePointerDown(): void {
    if (this.config.inputMode !== "reticle-click") {
      return;
    }

    if (
      this.state === "instructions" ||
      this.state === "finished" ||
      this.state === "resting"
    ) {
      return;
    }

    const selectedIndex = this.pickFaceAtReticle();

    if (selectedIndex === null) {
      return;
    }

    this.registerResponse(selectedIndex);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.repeat) {
      return;
    }

    if (event.code === "KeyM") {
      event.preventDefault();
      this.onReturnToMenu?.();
      return;
    }

    if (event.code === "Digit1" && this.state === "instructions") {
      event.preventDefault();
      this.startPractice();
      return;
    }

    if (event.code === "Digit1" && this.state === "finished") {
      event.preventDefault();
      this.startPractice();
      return;
    }

    if (event.code === "Digit1" && this.state === "resting") {
      event.preventDefault();
      this.startBlock(this.currentBlockIndex + 1);
      return;
    }

    if (this.config.inputMode !== "keyboard-123") {
      return;
    }

    const selectedIndex = this.keyToFaceIndex(event.code);

    if (selectedIndex === null) {
      return;
    }

    event.preventDefault();
    this.registerResponse(selectedIndex);
  }

  private registerResponse(selectedIndex: FaceIndex): void {
    if (!this.responseEnabled || this.trialFinished || !this.currentFaceSet) {
      return;
    }

    this.distractorManager.playResponseCue();
    this.finishActiveTrial("response", selectedIndex);
  }

  private pickFaceAtReticle(): FaceIndex | null {
    const engine = this.scene.getEngine();
    const pick = this.scene.pick(
      engine.getRenderWidth() / 2,
      engine.getRenderHeight() / 2,
      (mesh) => this.faceHitBoxes.some((hitBox) => hitBox === mesh)
    );

    return this.indexFromPick(pick);
  }

  private indexFromPick(pick: PickingInfo | null): FaceIndex | null {
    const mesh = pick?.pickedMesh;

    if (!mesh || !this.faceHitBoxes.some((hitBox) => hitBox === mesh)) {
      return null;
    }

    if (typeof mesh.metadata?.faceIndex !== "number") {
      return null;
    }

    return mesh.metadata.faceIndex as FaceIndex;
  }

  private keyToFaceIndex(code: string): FaceIndex | null {
    if (code === "Digit1" || code === "Numpad1") {
      return 0;
    }

    if (code === "Digit2" || code === "Numpad2") {
      return 1;
    }

    if (code === "Digit3" || code === "Numpad3") {
      return 2;
    }

    return null;
  }

  private completeCurrentTrial(): void {
    this.trialFinished = true;
    this.responseEnabled = false;
    this.clearResponseTimeout();
    this.removeAimObserver();
    this.distractorManager.cancelTrialDistractor();
    this.disposeHitBoxes();
    this.currentTrial = null;
    this.currentFaceSet = null;
  }

  private renderTextScreen(title: string, lines: string[]): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintBackground(context, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f8fbf2";
    context.font = "800 88px Arial";
    context.fillText(title, width / 2, 140);
    context.fillStyle = "#e8f4ee";
    context.font = "500 48px Arial";

    const wrapped = lines.flatMap((line) => this.wrapText(context, line, width - 240));

    wrapped.slice(0, 7).forEach((line, index) => {
      const isCountdownNumber = lines.length === 2 && index === 1;

      context.font = isCountdownNumber ? "900 230px Arial" : "500 48px Arial";
      context.fillStyle = isCountdownNumber ? "#e6c864" : "#e8f4ee";
      context.fillText(line, width / 2, 290 + index * (isCountdownNumber ? 160 : 70));
    });
    texture.update();
  }

  private renderFaceTrial(faceSet: FaceSet): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintBackground(context, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f9fbf5";
    context.font = "800 74px Arial";
    context.fillText("ENCUENTRA LA CARA DIFERENTE", width / 2, 118);

    faceSet.faces.forEach((face, index) => {
      this.drawFace(context, face, FACE_X_POSITIONS[index], 520);
      context.fillStyle = "#dfe9e4";
      context.font = "700 34px Arial";
      context.fillText(`CARA ${index + 1}`, FACE_X_POSITIONS[index], 840);
    });
    texture.update();
  }

  private renderBlankTrial(): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintBackground(context, width, height);
    texture.update();
  }

  private renderResults(result: VisualDiscriminationSessionResult): void {
    const global = result.global;
    const lines = [
      `Aciertos: ${global.hits}   Errores: ${global.errors}   Omisiones: ${global.omissions}`,
      `Precision: ${global.accuracy.toFixed(1)}%   RT medio: ${global.meanRtMs.toFixed(0)} ms`,
      `RT mediano: ${global.medianRtMs.toFixed(0)} ms   Variabilidad: ${global.sdRtMs.toFixed(0)} ms`,
      `Indice Experimental de Discriminacion: ${result.experimentalDiscriminationIndex.toFixed(1)}`,
      "Resultados conductuales experimentales; no constituyen diagnostico clinico.",
      "Presiona 1 para repetir. M vuelve al menu."
    ];

    this.renderTextScreen("Actividad completada", lines);
  }

  private drawFace(
    context: CanvasRenderingContext2D,
    face: FaceFeatures,
    centerX: number,
    centerY: number
  ): void {
    context.save();
    context.translate(centerX, centerY);
    context.strokeStyle = "#1f292c";
    context.fillStyle = "#f1efe3";
    context.lineWidth = 10;
    context.beginPath();
    context.ellipse(0, 0, 140, 176, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    this.drawHair(context, face);
    this.drawEyes(context, face);
    this.drawEyebrows(context, face);
    this.drawMouth(context, face);
    context.restore();
  }

  private drawHair(context: CanvasRenderingContext2D, face: FaceFeatures): void {
    context.fillStyle = "#1f292c";

    if (face.hair.style === "cap") {
      context.beginPath();
      context.ellipse(0, -118, 118, face.hair.height * 250, 0, Math.PI, 0);
      context.fill();
      return;
    }

    if (face.hair.style === "side") {
      context.fillRect(-112, -132, 56, 120);
      context.fillRect(-56, -154, 140, 42);
      return;
    }

    for (let index = 0; index < 7; index += 1) {
      context.beginPath();
      context.arc(-90 + index * 30, -130, face.hair.height * 110, Math.PI, 0);
      context.fill();
    }
  }

  private drawEyes(context: CanvasRenderingContext2D, face: FaceFeatures): void {
    const spacing = face.eyes.spacing * 90;
    const radius = face.eyes.size * 260;

    [-spacing, spacing].forEach((xPosition) => {
      context.fillStyle = "#1f292c";
      context.beginPath();

      if (face.eyes.shape === "wide") {
        context.ellipse(xPosition, -38, radius * 1.32, radius * 0.7, 0, 0, Math.PI * 2);
      } else if (face.eyes.shape === "sleepy") {
        context.ellipse(xPosition, -34, radius * 1.15, radius * 0.45, 0, 0, Math.PI * 2);
      } else {
        context.arc(xPosition, -38, radius, 0, Math.PI * 2);
      }

      context.fill();
    });
  }

  private drawEyebrows(context: CanvasRenderingContext2D, face: FaceFeatures): void {
    const spacing = face.eyes.spacing * 90;
    const y = -face.eyebrows.height * 120;

    context.strokeStyle = "#1f292c";
    context.lineWidth = face.eyebrows.thickness * 300;
    [-spacing, spacing].forEach((xPosition, index) => {
      const direction = index === 0 ? -1 : 1;

      context.beginPath();
      context.moveTo(xPosition - 38, y + direction * face.eyebrows.tilt * 48);
      context.lineTo(xPosition + 38, y - direction * face.eyebrows.tilt * 48);
      context.stroke();
    });
  }

  private drawMouth(context: CanvasRenderingContext2D, face: FaceFeatures): void {
    const width = face.mouth.width * 210;
    const curve = face.mouth.curve === "smile" ? 60 : face.mouth.curve === "frown" ? -50 : 0;

    context.strokeStyle = "#1f292c";
    context.lineWidth = 10;
    context.beginPath();
    context.moveTo(-width / 2, 72);
    context.quadraticCurveTo(0, 72 + curve + face.mouth.openness * 90, width / 2, 72);
    context.stroke();
  }

  private ensureScreenTexture(): DynamicTexture {
    if (this.screenTexture) {
      return this.screenTexture;
    }

    const texture = new DynamicTexture(
      "visualDiscriminationPanelTexture",
      { width: 2048, height: 1024 },
      this.scene,
      false
    );
    const material = new StandardMaterial(
      "visualDiscriminationPanelMaterial",
      this.scene
    );

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.82, 0.92, 0.88);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    this.activityPanelMesh.material = material;
    this.screenTexture = texture;
    this.screenMaterial = material;

    return texture;
  }

  private paintBackground(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#102f31";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(230, 200, 100, 0.54)";
    context.lineWidth = 14;
    context.strokeRect(42, 42, width - 84, height - 84);
    context.strokeStyle = "rgba(255, 255, 255, 0.12)";
    context.lineWidth = 4;
    context.strokeRect(92, 92, width - 184, height - 184);
  }

  private createHitBoxes(): void {
    const xPositions = [-1.82, 0, 1.82];

    this.faceHitBoxes = xPositions.map((xPosition, index) => {
      const hitBox = MeshBuilder.CreatePlane(
        `visualDiscriminationFaceHitBox${index + 1}`,
        {
          width: 1.45,
          height: 1.65
        },
        this.scene
      );

      hitBox.position = new Vector3(xPosition, 2.36, 5.48);
      hitBox.isVisible = false;
      hitBox.isPickable = true;
      hitBox.metadata = {
        dynamic: true,
        faceIndex: index
      };

      return hitBox;
    });
  }

  private disposeHitBoxes(): void {
    this.faceHitBoxes.forEach((hitBox) => {
      hitBox.dispose();
    });
    this.faceHitBoxes = [];
  }

  private ensureAimObserver(): void {
    if (this.aimObserver) {
      return;
    }

    this.aimObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.responseEnabled || this.firstAimOnAnyFaceMs !== null) {
        return;
      }

      if (this.pickFaceAtReticle() !== null) {
        this.firstAimOnAnyFaceMs = performance.now() - this.stimulusOnsetMs;
      }
    });
  }

  private removeAimObserver(): void {
    if (!this.aimObserver) {
      return;
    }

    this.scene.onBeforeRenderObservable.remove(this.aimObserver);
    this.aimObserver = null;
  }

  private ensureFrameTelemetry(): void {
    if (this.frameObserver) {
      return;
    }

    this.frameObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.frameTimes.push(this.scene.getEngine().getDeltaTime());

      if (this.frameTimes.length > 600) {
        this.frameTimes.shift();
      }
    });
  }

  private removeFrameTelemetry(): void {
    if (!this.frameObserver) {
      return;
    }

    this.scene.onBeforeRenderObservable.remove(this.frameObserver);
    this.frameObserver = null;
  }

  private ensureReticle(): void {
    if (this.reticle) {
      return;
    }

    const reticle = document.createElement("div");

    reticle.id = "visualDiscriminationReticle";
    reticle.setAttribute("aria-hidden", "true");
    document.body.appendChild(reticle);
    this.reticle = reticle;
  }

  private registerInputHandlers(): void {
    if (this.inputHandlersRegistered) {
      return;
    }

    window.addEventListener("keydown", this.handleKeyDownBound);
    this.scene.getEngine().getRenderingCanvas()?.addEventListener(
      "pointerdown",
      this.handlePointerDownBound
    );
    this.inputHandlersRegistered = true;
  }

  private unregisterInputHandlers(): void {
    if (!this.inputHandlersRegistered) {
      return;
    }

    window.removeEventListener("keydown", this.handleKeyDownBound);
    this.scene.getEngine().getRenderingCanvas()?.removeEventListener(
      "pointerdown",
      this.handlePointerDownBound
    );
    this.inputHandlersRegistered = false;
  }

  private resetRuntimeState(): void {
    this.practiceTrials = [];
    this.officialBlocks = [];
    this.currentBlock = null;
    this.currentTrial = null;
    this.currentFaceSet = null;
    this.currentPracticeIndex = 0;
    this.currentBlockIndex = 0;
    this.currentTrialIndex = 0;
    this.stimulusOnsetMs = 0;
    this.firstAimOnAnyFaceMs = null;
    this.trialFinished = true;
    this.responseEnabled = false;
  }

  private cleanupTimers(): void {
    this.clearResponseTimeout();
    this.clearItiTimeout();
    this.clearCountdownTimeout();
  }

  private clearResponseTimeout(): void {
    if (this.responseTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.responseTimeoutId);
    this.responseTimeoutId = null;
  }

  private clearItiTimeout(): void {
    if (this.itiTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.itiTimeoutId);
    this.itiTimeoutId = null;
  }

  private clearCountdownTimeout(): void {
    if (this.countdownTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.countdownTimeoutId);
    this.countdownTimeoutId = null;
  }

  private getJitteredIti(): number {
    const fraction = Math.random();

    return Math.round(
      this.config.itiMinMs +
        fraction * (this.config.itiMaxMs - this.config.itiMinMs)
    );
  }

  private buildTelemetry(): TechnicalTelemetry {
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      inputMode: this.config.inputMode,
      meanFrameTimeMs: this.mean(this.frameTimes),
      medianFrameTimeMs: this.median(this.frameTimes)
    };
  }

  private mean(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  private median(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((first, second) => first - second);
    const middle = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  }

  private wrapText(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (context.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
        return;
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      currentLine = word;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private disposeScreen(): void {
    this.screenMaterial?.dispose();
    this.screenTexture?.dispose();
    this.screenMaterial = null;
    this.screenTexture = null;
  }
}
