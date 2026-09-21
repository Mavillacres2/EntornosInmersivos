import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Scene, TransformNode } from "@babylonjs/core";

import { DistractorManager } from "../distractors/DistractorManager";
import { MetricsManager } from "../metrics/MetricsManager";
import type { ActivityTelemetrySink } from "../analysis/synchronization/ActivityContextAdapter";
import {
  ActivityState,
  generateStimulusType,
  generateTrialSequence,
  getStimulusColor
} from "./GoNoGoTypes";
import type {
  GoNoGoBlockConfig,
  GoNoGoSessionConfig,
  StimulusType
} from "./GoNoGoTypes";

interface GoNoGoActivityOptions {
  scene: Scene;
  stimulusAnchor: TransformNode;
  metricsManager: MetricsManager;
  distractorManager: DistractorManager;
  config: GoNoGoSessionConfig;
  telemetry?: ActivityTelemetrySink;
}

type TrialCompletionReason = "response" | "timeout";

interface BoardPanelContent {
  title: string;
  lines: string[];
  countdown: string | null;
  buttonLabel: string | null;
  buttonAction: (() => void) | null;
}

export class GoNoGoActivity {
  private readonly scene: Scene;
  private readonly stimulusAnchor: TransformNode;
  private readonly metricsManager: MetricsManager;
  private readonly distractorManager: DistractorManager;
  private readonly config: GoNoGoSessionConfig;
  private readonly telemetry: ActivityTelemetrySink | null;
  private readonly handleKeyDownBound: (event: KeyboardEvent) => void;

  private state: ActivityState = ActivityState.Instructions;
  private practiceSequence: StimulusType[] = [];
  private currentPracticeTrialNumber = 0;
  private currentBlockIndex = 0;
  private currentBlock: GoNoGoBlockConfig | null = null;
  private currentBlockStartedAt = 0;
  private currentBlockTrialNumber = 0;
  private globalTrialNumber = 0;
  private currentStimulusType: StimulusType | null = null;
  private currentStimulusStartedAt = 0;
  private stimulus: Mesh | null = null;
  private boardPanel: Mesh | null = null;
  private boardPanelTexture: DynamicTexture | null = null;
  private boardPanelMaterial: StandardMaterial | null = null;
  private boardButton: Mesh | null = null;
  private boardButtonTexture: DynamicTexture | null = null;
  private boardButtonMaterial: StandardMaterial | null = null;
  private stimulusTimeoutId: number | null = null;
  private interTrialTimeoutId: number | null = null;
  private countdownTimeoutId: number | null = null;
  private restTimeoutId: number | null = null;
  private blockTimerId: number | null = null;
  private trialFinished = true;
  private responseEnabled = false;
  private inputHandlersRegistered = false;
  private blockDurationReached = false;

  constructor(options: GoNoGoActivityOptions) {
    this.scene = options.scene;
    this.stimulusAnchor = options.stimulusAnchor;
    this.metricsManager = options.metricsManager;
    this.distractorManager = options.distractorManager;
    this.config = options.config;
    this.telemetry = options.telemetry ?? null;
    this.handleKeyDownBound = (event) => this.handleKeyDown(event);
  }

  showInstructions(): void {
    this.cleanupTimers();
    this.disposeStimulus();
    this.distractorManager.disableAll();
    this.resetRuntimeState();
    this.state = ActivityState.Instructions;
    this.telemetry?.onStateChange(this.state);
    this.registerInputHandlers();

    this.renderPanel(`
      <h1>Actividad de atencion</h1>

      <p>
        Primero haremos una practica corta.
      </p>

      <p>
        Si aparece el circulo <strong class="go-text">VERDE</strong>,
        presiona la barra espaciadora.
      </p>

      <p>
        Si aparece el circulo <strong class="no-go-text">ROJO</strong>,
        no respondas.
      </p>

      <button id="startPractice" type="button">
        ESPACIO para practicar
      </button>
    `);
  }

  dispose(): void {
    this.cleanupTimers();
    this.unregisterInputHandlers();
    this.distractorManager.dispose();
    this.disposeStimulus();
    this.disposeBoardUi();
    document.getElementById("information")?.remove();
  }

  private startPractice(): void {
    this.cleanupTimers();
    this.disposeStimulus();
    this.distractorManager.disableAll();
    this.distractorManager.prepareAudio();
    this.resetRuntimeState();

    this.state = ActivityState.Practice;
    this.telemetry?.onStateChange(this.state);
    this.practiceSequence = generateTrialSequence(
      this.config.practiceTrials,
      this.config.goProbability
    );

    this.registerInputHandlers();
    this.renderPanel(`
      <h1>Practica</h1>
      <p>Mira la pizarra y responde segun el color.</p>
    `);

    this.interTrialTimeoutId = window.setTimeout(() => {
      this.interTrialTimeoutId = null;
      this.beginNextPracticeTrial();
    }, this.config.interStimulusIntervalMs);
  }

  private beginNextPracticeTrial(): void {
    if (this.state !== ActivityState.Practice) {
      return;
    }

    if (this.currentPracticeTrialNumber >= this.practiceSequence.length) {
      this.finishPractice();
      return;
    }

    const stimulusType = this.practiceSequence[this.currentPracticeTrialNumber];
    this.currentPracticeTrialNumber += 1;
    this.currentStimulusType = stimulusType;
    this.currentStimulusStartedAt = performance.now();
    this.trialFinished = false;
    this.responseEnabled = true;

    this.createStimulus(stimulusType);
    this.renderPanel(`
      <h1>Practica</h1>
      <p>Ensayo ${this.currentPracticeTrialNumber} de ${this.config.practiceTrials}</p>
    `);

    this.stimulusTimeoutId = window.setTimeout(() => {
      this.stimulusTimeoutId = null;
      this.finishPracticeTrial("timeout");
    }, this.config.stimulusDurationMs);
  }

  private finishPracticeTrial(reason: TrialCompletionReason): void {
    if (
      this.state !== ActivityState.Practice ||
      this.trialFinished ||
      !this.currentStimulusType
    ) {
      return;
    }

    const stimulusType = this.currentStimulusType;

    this.trialFinished = true;
    this.responseEnabled = false;
    this.clearStimulusTimeout();
    this.disposeStimulus();
    this.currentStimulusType = null;

    this.renderPanel(`
      <h1>Practica</h1>
      <p>${this.getPracticeFeedback(stimulusType, reason)}</p>
    `);

    this.interTrialTimeoutId = window.setTimeout(() => {
      this.interTrialTimeoutId = null;
      this.beginNextPracticeTrial();
    }, this.config.interStimulusIntervalMs);
  }

  private finishPractice(): void {
    if (this.state !== ActivityState.Practice) {
      return;
    }

    this.responseEnabled = false;
    this.trialFinished = true;
    this.clearStimulusTimeout();
    this.disposeStimulus();
    this.state = ActivityState.Countdown;
    this.telemetry?.onStateChange(this.state);

    this.renderPanel(`
      <h1>Practica finalizada</h1>
      <p>Ahora comenzara la evaluacion.</p>
    `);

    this.countdownTimeoutId = window.setTimeout(() => {
      this.countdownTimeoutId = null;
      this.runEvaluationCountdown(this.config.countdownSeconds);
    }, this.config.interStimulusIntervalMs);
  }

  private runEvaluationCountdown(secondsRemaining: number): void {
    if (this.state !== ActivityState.Countdown) {
      return;
    }

    if (secondsRemaining <= 0) {
      this.metricsManager.startSession(this.config.blocks);
      this.globalTrialNumber = 0;
      this.startBlock(0);
      return;
    }

    this.renderPanel(`
      <h1>Evaluacion</h1>
      <p>Comenzamos en:</p>
      <p class="countdown">${secondsRemaining}</p>
    `);

    this.countdownTimeoutId = window.setTimeout(() => {
      this.countdownTimeoutId = null;
      this.runEvaluationCountdown(secondsRemaining - 1);
    }, 1000);
  }

  private startBlock(blockIndex: number): void {
    const block = this.config.blocks[blockIndex];

    if (!block) {
      this.finishSession();
      return;
    }

    this.cleanupTimers();
    this.disposeStimulus();

    this.state = ActivityState.RunningBlock;
    this.telemetry?.onStateChange(this.state);
    this.currentBlockIndex = blockIndex;
    this.currentBlock = block;
    this.currentBlockStartedAt = performance.now();
    this.currentBlockTrialNumber = 0;
    this.currentStimulusType = null;
    this.trialFinished = true;
    this.responseEnabled = false;
    this.blockDurationReached = false;
    this.telemetry?.onBlockStart({
      blockNumber: block.blockNumber,
      condition: block.condition
    });

    this.distractorManager.setCondition(block.condition, block.blockNumber);
    this.renderRunningBlockPanel(block);

    this.blockTimerId = window.setTimeout(() => {
      this.blockTimerId = null;
      this.blockDurationReached = true;

      if (this.trialFinished) {
        this.endCurrentBlock();
      }
    }, block.durationMs);

    this.beginOfficialTrial();
  }

  private beginOfficialTrial(): void {
    if (this.state !== ActivityState.RunningBlock || !this.currentBlock) {
      return;
    }

    if (this.shouldEndCurrentBlock()) {
      this.endCurrentBlock();
      return;
    }

    const stimulusType = generateStimulusType(this.config.goProbability);
    const stimulusColor = getStimulusColor(stimulusType);
    const stimulusStartedAt = performance.now();

    this.currentBlockTrialNumber += 1;
    this.globalTrialNumber += 1;
    this.currentStimulusType = stimulusType;
    this.currentStimulusStartedAt = stimulusStartedAt;
    this.trialFinished = false;
    this.responseEnabled = true;

    this.metricsManager.startTrial({
      trialNumber: this.currentBlockTrialNumber,
      globalTrialNumber: this.globalTrialNumber,
      blockNumber: this.currentBlock.blockNumber,
      condition: this.currentBlock.condition,
      stimulusType,
      stimulusColor,
      expectedResponse: stimulusType === "go",
      stimulusStartedAt,
      elapsedSessionTimeMs:
        this.metricsManager.getElapsedSessionTime(stimulusStartedAt)
    });
    this.telemetry?.onTrialStart({
      trialNumber: this.currentBlockTrialNumber,
      globalTrialNumber: this.globalTrialNumber,
      stimulusId: stimulusType,
      stimulusType
    });

    this.createStimulus(stimulusType);
    this.renderRunningBlockPanel(this.currentBlock);

    this.stimulusTimeoutId = window.setTimeout(() => {
      this.stimulusTimeoutId = null;
      this.finishOfficialTrial("timeout");
    }, this.config.stimulusDurationMs);
  }

  private finishOfficialTrial(reason: TrialCompletionReason): void {
    if (
      this.state !== ActivityState.RunningBlock ||
      this.trialFinished ||
      !this.currentStimulusType
    ) {
      return;
    }

    const stimulusType = this.currentStimulusType;

    this.trialFinished = true;
    this.responseEnabled = false;
    this.clearStimulusTimeout();

    if (reason === "timeout" && stimulusType === "go") {
      this.metricsManager.registerOmission();
    }

    if (reason === "timeout" && stimulusType === "no-go") {
      this.metricsManager.registerCorrectInhibition();
    }

    this.metricsManager.endTrial(performance.now());
    this.telemetry?.onTrialEnd();
    this.disposeStimulus();
    this.currentStimulusType = null;

    if (this.shouldEndCurrentBlock()) {
      this.endCurrentBlock();
      return;
    }

    this.interTrialTimeoutId = window.setTimeout(() => {
      this.interTrialTimeoutId = null;
      this.beginOfficialTrial();
    }, this.config.interStimulusIntervalMs);
  }

  private endCurrentBlock(): void {
    if (this.state !== ActivityState.RunningBlock || !this.currentBlock) {
      return;
    }

    const completedBlock = this.currentBlock;
    const nextBlockIndex = this.currentBlockIndex + 1;

    this.responseEnabled = false;
    this.trialFinished = true;
    this.clearStimulusTimeout();
    this.clearInterTrialTimeout();
    this.clearBlockTimer();
    this.disposeStimulus();
    this.currentStimulusType = null;
    this.currentBlock = null;
    this.currentBlockStartedAt = 0;
    this.currentBlockTrialNumber = 0;
    this.blockDurationReached = false;
    this.distractorManager.disableAll();

    if (nextBlockIndex >= this.config.blocks.length) {
      this.finishSession();
      return;
    }

    this.startRest(completedBlock, nextBlockIndex);
  }

  private startRest(
    completedBlock: GoNoGoBlockConfig,
    nextBlockIndex: number
  ): void {
    const nextBlock = this.config.blocks[nextBlockIndex];

    if (!nextBlock) {
      this.finishSession();
      return;
    }

    const restStartedAt = performance.now();
    this.state = ActivityState.Resting;
    this.telemetry?.onStateChange(this.state);
    this.responseEnabled = false;
    this.trialFinished = true;
    this.disposeStimulus();

    const updateRestPanel = (): void => {
      if (this.state !== ActivityState.Resting) {
        return;
      }

      const elapsedRestMs = performance.now() - restStartedAt;
      const remainingMs = Math.max(0, this.config.restDurationMs - elapsedRestMs);

      if (remainingMs <= 0) {
        this.restTimeoutId = null;
        this.startBlock(nextBlockIndex);
        return;
      }

      this.renderPanel(`
        <h1>Descanso breve</h1>

        <p>Bloque ${completedBlock.blockNumber} finalizado.</p>

        <p>Siguiente: ${nextBlock.label}</p>

        <p>Comenzamos en:</p>

        <p class="countdown">${Math.ceil(remainingMs / 1000)}</p>
      `);

      this.restTimeoutId = window.setTimeout(() => {
        this.restTimeoutId = null;
        updateRestPanel();
      }, Math.min(1000, remainingMs));
    };

    updateRestPanel();
  }

  private finishSession(): void {
    if (this.state === ActivityState.Finished) {
      return;
    }

    this.state = ActivityState.Finished;
    this.telemetry?.onStateChange(this.state);
    this.responseEnabled = false;
    this.trialFinished = true;
    this.cleanupTimers();
    this.distractorManager.disableAll();
    this.disposeStimulus();

    const results = this.metricsManager.endSession();
    this.telemetry?.onActivityResult(
      results as unknown as Record<string, unknown>
    );
    console.log("Resultados completos Go/No-Go por bloques:", results);

    this.renderPanel(`
      <h1>Sesion finalizada</h1>

      <p>
        La evaluacion termino correctamente.
      </p>

      <p>
        Los resultados detallados se imprimieron en la consola del navegador.
      </p>

      <button id="restartActivity" type="button">
        ESPACIO para repetir
      </button>
    `);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Space" || event.repeat) {
      return;
    }

    event.preventDefault();

    if (
      this.state === ActivityState.Instructions ||
      this.state === ActivityState.Finished
    ) {
      this.startPractice();
      return;
    }

    this.registerStudentResponse("keyboard");
  }

  private registerStudentResponse(inputType: "keyboard"): void {
    if (this.state === ActivityState.Practice) {
      this.registerPracticeResponse(inputType);
      return;
    }

    if (this.state === ActivityState.RunningBlock) {
      this.registerOfficialResponse(inputType);
    }
  }

  private registerPracticeResponse(inputType: "keyboard"): void {
    if (
      !this.responseEnabled ||
      this.trialFinished ||
      !this.currentStimulusType
    ) {
      return;
    }

    this.distractorManager.playResponseCue(inputType);
    this.finishPracticeTrial("response");
  }

  private registerOfficialResponse(inputType: "keyboard"): void {
    if (
      !this.responseEnabled ||
      this.trialFinished ||
      !this.currentStimulusType
    ) {
      return;
    }

    const reactionTimeMs = performance.now() - this.currentStimulusStartedAt;

    this.distractorManager.playResponseCue(inputType);
    this.metricsManager.registerResponse(reactionTimeMs);
    this.finishOfficialTrial("response");
  }

  private shouldEndCurrentBlock(): boolean {
    if (!this.currentBlock) {
      return false;
    }

    const elapsedBlockMs = performance.now() - this.currentBlockStartedAt;

    return this.blockDurationReached || elapsedBlockMs >= this.currentBlock.durationMs;
  }

  private getPracticeFeedback(
    stimulusType: StimulusType,
    reason: TrialCompletionReason
  ): string {
    if (stimulusType === "go" && reason === "response") {
      return "Correcto. Cuando ves verde, debes responder.";
    }

    if (stimulusType === "go" && reason === "timeout") {
      return "Recuerda responder cuando el circulo sea verde.";
    }

    if (stimulusType === "no-go" && reason === "response") {
      return "Recuerda no responder cuando el circulo sea rojo.";
    }

    return "Correcto. Cuando ves rojo, debes esperar.";
  }

  private renderRunningBlockPanel(block: GoNoGoBlockConfig): void {
    this.renderPanel(`
      <h1>Bloque ${block.blockNumber}</h1>
      <p>${block.label}</p>
      <p>Manten tu atencion en la pizarra.</p>
    `);
  }

  private createStimulus(stimulusType: StimulusType): void {
    this.disposeStimulus();

    const stimulus = MeshBuilder.CreateSphere(
      "goNoGoStimulus",
      {
        diameter: 0.82,
        segments: 32
      },
      this.scene
    );

    stimulus.parent = this.stimulusAnchor;
    stimulus.position = Vector3.Zero();
    stimulus.isPickable = false;

    const material = new StandardMaterial(
      `goNoGoStimulusMaterial-${performance.now()}`,
      this.scene
    );

    if (stimulusType === "go") {
      material.diffuseColor = new Color3(0.05, 0.78, 0.28);
      material.emissiveColor = new Color3(0.02, 0.18, 0.07);
    } else {
      material.diffuseColor = new Color3(0.88, 0.12, 0.1);
      material.emissiveColor = new Color3(0.18, 0.02, 0.02);
    }

    stimulus.material = material;
    this.stimulus = stimulus;
    this.distractorManager.playStimulusCue(stimulusType);
  }

  private disposeStimulus(): void {
    if (!this.stimulus) {
      return;
    }

    this.stimulus.material?.dispose();
    this.stimulus.dispose();
    this.stimulus = null;
  }

  private registerInputHandlers(): void {
    if (this.inputHandlersRegistered) {
      return;
    }

    window.addEventListener("keydown", this.handleKeyDownBound);
    this.inputHandlersRegistered = true;
  }

  private unregisterInputHandlers(): void {
    if (!this.inputHandlersRegistered) {
      return;
    }

    window.removeEventListener("keydown", this.handleKeyDownBound);
    this.inputHandlersRegistered = false;
  }

  private resetRuntimeState(): void {
    this.practiceSequence = [];
    this.currentPracticeTrialNumber = 0;
    this.currentBlockIndex = 0;
    this.currentBlock = null;
    this.currentBlockStartedAt = 0;
    this.currentBlockTrialNumber = 0;
    this.globalTrialNumber = 0;
    this.currentStimulusType = null;
    this.currentStimulusStartedAt = 0;
    this.trialFinished = true;
    this.responseEnabled = false;
    this.blockDurationReached = false;
  }

  private cleanupTimers(): void {
    this.clearStimulusTimeout();
    this.clearInterTrialTimeout();
    this.clearCountdownTimeout();
    this.clearRestTimeout();
    this.clearBlockTimer();
  }

  private clearStimulusTimeout(): void {
    if (this.stimulusTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.stimulusTimeoutId);
    this.stimulusTimeoutId = null;
  }

  private clearInterTrialTimeout(): void {
    if (this.interTrialTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.interTrialTimeoutId);
    this.interTrialTimeoutId = null;
  }

  private clearCountdownTimeout(): void {
    if (this.countdownTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.countdownTimeoutId);
    this.countdownTimeoutId = null;
  }

  private clearRestTimeout(): void {
    if (this.restTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.restTimeoutId);
    this.restTimeoutId = null;
  }

  private clearBlockTimer(): void {
    if (this.blockTimerId === null) {
      return;
    }

    window.clearTimeout(this.blockTimerId);
    this.blockTimerId = null;
  }

  private renderPanel(content: string): void {
    document.getElementById("information")?.remove();

    const panelContent = this.parsePanelContent(content);

    this.renderBoardPanel(panelContent);
  }

  private parsePanelContent(content: string): BoardPanelContent {
    const title = this.extractFirstMatch(content, /<h1>([\s\S]*?)<\/h1>/);
    const paragraphMatches = content.matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/g);
    const lines: string[] = [];
    let countdown: string | null = null;

    for (const paragraphMatch of paragraphMatches) {
      const attributes = paragraphMatch[1];
      const text = this.cleanHtmlText(paragraphMatch[2]);

      if (!text) {
        continue;
      }

      if (attributes.includes("countdown")) {
        countdown = text;
        continue;
      }

      lines.push(text);
    }

    const buttonMatch = content.match(/<button[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/);
    const buttonId = buttonMatch?.[1] ?? null;
    const buttonLabel = buttonMatch ? this.cleanHtmlText(buttonMatch[2]) : null;
    const buttonAction =
      buttonId === "startPractice" || buttonId === "restartActivity"
        ? () => this.startPractice()
        : null;

    return {
      title: title || "Actividad",
      lines,
      countdown,
      buttonLabel,
      buttonAction
    };
  }

  private extractFirstMatch(content: string, pattern: RegExp): string {
    const match = content.match(pattern);

    return match ? this.cleanHtmlText(match[1]) : "";
  }

  private cleanHtmlText(value: string): string {
    const temporaryElement = document.createElement("div");
    temporaryElement.innerHTML = value.replace(/\s+/g, " ").trim();

    return temporaryElement.textContent?.trim() ?? "";
  }

  private renderBoardPanel(content: BoardPanelContent): void {
    const texture = this.ensureBoardPanel();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0b3b29";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(255, 255, 255, 0.14)";
    context.lineWidth = 10;
    context.strokeRect(28, 28, width - 56, height - 56);

    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f5fff7";
    context.font = "700 106px Arial";
    context.fillText(content.title, width / 2, 116);

    context.font = "400 64px Arial";

    const wrappedLines = content.lines.flatMap((line) =>
      this.wrapText(context, line, width - 240)
    );
    const lineHeight = 84;
    const firstLineY = content.countdown ? 248 : 258;

    wrappedLines.slice(0, content.countdown ? 3 : 5).forEach((line, index) => {
      context.fillText(line, width / 2, firstLineY + index * lineHeight);
    });

    if (content.countdown) {
      context.font = "800 232px Arial";
      context.fillStyle = "#f4d35e";
      context.fillText(content.countdown, width / 2, height - 212);
    }

    texture.update();

    if (content.buttonLabel && content.buttonAction) {
      this.showBoardButton(content.buttonLabel);
      return;
    }

    this.hideBoardButton();
  }

  private ensureBoardPanel(): DynamicTexture {
    if (this.boardPanelTexture) {
      this.boardPanel?.setEnabled(true);
      return this.boardPanelTexture;
    }

    const texture = new DynamicTexture(
      "activityBoardPanelTexture",
      {
        width: 2560,
        height: 1024
      },
      this.scene,
      false
    );

    const material = new StandardMaterial(
      "activityBoardPanelMaterial",
      this.scene
    );

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.88, 0.96, 0.9);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;

    const panel = MeshBuilder.CreatePlane(
      "activityBoardPanel",
      {
        width: 8.62,
        height: 3.46
      },
      this.scene
    );

    panel.position = new Vector3(0, 2.48, 5.34);
    panel.material = material;
    panel.isPickable = false;

    this.boardPanel = panel;
    this.boardPanelTexture = texture;
    this.boardPanelMaterial = material;

    return texture;
  }

  private showBoardButton(label: string): void {
    const buttonTexture = this.ensureBoardButton();
    const context =
      buttonTexture.getContext() as unknown as CanvasRenderingContext2D;
    const width = buttonTexture.getSize().width;
    const height = buttonTexture.getSize().height;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#f6f0d8";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#f4d35e";
    context.lineWidth = 12;
    context.strokeRect(10, 10, width - 20, height - 20);
    context.fillStyle = "#15392c";
    context.font = "700 76px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, width / 2, height / 2);
    buttonTexture.update();

    if (!this.boardButton) {
      return;
    }

    this.boardButton.setEnabled(true);
  }

  private ensureBoardButton(): DynamicTexture {
    if (this.boardButtonTexture) {
      return this.boardButtonTexture;
    }

    const texture = new DynamicTexture(
      "activityBoardButtonTexture",
      {
        width: 928,
        height: 192
      },
      this.scene,
      false
    );

    const material = new StandardMaterial(
      "activityBoardButtonMaterial",
      this.scene
    );

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.95, 0.92, 0.74);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;

    const button = MeshBuilder.CreatePlane(
      "activityBoardButton",
      {
        width: 3.45,
        height: 0.6
      },
      this.scene
    );

    button.position = new Vector3(0, 0.95, 5.18);
    button.material = material;
    button.isPickable = false;

    this.boardButton = button;
    this.boardButtonTexture = texture;
    this.boardButtonMaterial = material;

    return texture;
  }

  private hideBoardButton(): void {
    if (!this.boardButton) {
      return;
    }

    this.boardButton.actionManager?.dispose();
    this.boardButton.actionManager = null;
    this.boardButton.setEnabled(false);
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
      const width = context.measureText(testLine).width;

      if (width <= maxWidth) {
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

  private disposeBoardUi(): void {
    this.boardButton?.actionManager?.dispose();
    this.boardButtonMaterial?.dispose();
    this.boardButtonTexture?.dispose();
    this.boardButton?.dispose();
    this.boardPanelMaterial?.dispose();
    this.boardPanelTexture?.dispose();
    this.boardPanel?.dispose();

    this.boardButton = null;
    this.boardButtonTexture = null;
    this.boardButtonMaterial = null;
    this.boardPanel = null;
    this.boardPanelTexture = null;
    this.boardPanelMaterial = null;
  }
}
