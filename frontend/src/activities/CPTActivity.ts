import {
  Color3,
  DynamicTexture,
  StandardMaterial
} from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";

import { CPTDistractorManager } from "../distractors/CPTDistractorManager";
import { CPTMetricsManager } from "../metrics/CPTMetricsManager";
import type { ActivityTelemetrySink } from "../analysis/synchronization/ActivityContextAdapter";
import {
  CPTActivityState,
  CPT_DEBUG,
  generateCPTStimulus,
  generateCPTTrialSequence,
  isCPTTarget
} from "./CPTTypes";
import type {
  CPTBlockConfig,
  CPTSessionConfig,
  CPTSessionResult
} from "./CPTTypes";

interface CPTActivityOptions {
  scene: Scene;
  cptScreenMesh: Mesh;
  metricsManager: CPTMetricsManager;
  distractorManager: CPTDistractorManager;
  config: CPTSessionConfig;
  telemetry?: ActivityTelemetrySink;
}

type TrialCompletionReason = "response" | "timeout";

export class CPTActivity {
  private readonly scene: Scene;
  private readonly cptScreenMesh: Mesh;
  private readonly metricsManager: CPTMetricsManager;
  private readonly distractorManager: CPTDistractorManager;
  private readonly config: CPTSessionConfig;
  private readonly telemetry: ActivityTelemetrySink | null;
  private readonly handleKeyDownBound: (event: KeyboardEvent) => void;

  private state: CPTActivityState = CPTActivityState.Instructions;
  private practiceSequence: string[] = [];
  private currentPracticeTrialNumber = 0;
  private currentBlockIndex = 0;
  private currentBlock: CPTBlockConfig | null = null;
  private currentBlockStartedAt = 0;
  private currentBlockTrialNumber = 0;
  private globalTrialNumber = 0;
  private currentStimulus: string | null = null;
  private currentStimulusStartedAt = 0;
  private screenTexture: DynamicTexture | null = null;
  private screenMaterial: StandardMaterial | null = null;
  private stimulusTimeoutId: number | null = null;
  private interTrialTimeoutId: number | null = null;
  private countdownTimeoutId: number | null = null;
  private restTimeoutId: number | null = null;
  private blockTimerId: number | null = null;
  private trialFinished = true;
  private responseEnabled = false;
  private inputHandlersRegistered = false;
  private blockDurationReached = false;

  constructor(options: CPTActivityOptions) {
    this.scene = options.scene;
    this.cptScreenMesh = options.cptScreenMesh;
    this.metricsManager = options.metricsManager;
    this.distractorManager = options.distractorManager;
    this.config = options.config;
    this.telemetry = options.telemetry ?? null;
    this.handleKeyDownBound = (event) => this.handleKeyDown(event);
  }

  showInstructions(): void {
    this.cleanupTimers();
    this.distractorManager.disableAll();
    this.resetRuntimeState();
    this.state = CPTActivityState.Instructions;
    this.telemetry?.onStateChange(this.state);
    this.registerInputHandlers();
    this.renderTextScreen("CPT", [
      "Primero haremos una practica corta.",
      `Presiona ESPACIO cuando aparezca la letra ${this.config.targetLetter}.`,
      "Con otras letras, espera sin responder.",
      "ESPACIO para practicar."
    ]);
  }

  dispose(): void {
    this.cleanupTimers();
    this.unregisterInputHandlers();
    this.distractorManager.dispose();
    this.disposeScreenUi();
  }

  private startPractice(): void {
    this.cleanupTimers();
    this.distractorManager.disableAll();
    this.distractorManager.prepareAudio();
    this.resetRuntimeState();
    this.state = CPTActivityState.Practice;
    this.telemetry?.onStateChange(this.state);
    this.practiceSequence = generateCPTTrialSequence(
      this.config.practiceTrials,
      this.config
    );

    this.registerInputHandlers();
    this.renderTextScreen("Practica", [
      `Responde solo cuando aparezca ${this.config.targetLetter}.`,
      "Preparate."
    ]);

    this.interTrialTimeoutId = window.setTimeout(() => {
      this.interTrialTimeoutId = null;
      this.beginNextPracticeTrial();
    }, this.config.interStimulusIntervalMs);
  }

  private beginNextPracticeTrial(): void {
    if (this.state !== CPTActivityState.Practice) {
      return;
    }

    if (this.currentPracticeTrialNumber >= this.practiceSequence.length) {
      this.finishPractice();
      return;
    }

    const stimulus = this.practiceSequence[this.currentPracticeTrialNumber];

    this.currentPracticeTrialNumber += 1;
    this.currentStimulus = stimulus;
    this.currentStimulusStartedAt = performance.now();
    this.trialFinished = false;
    this.responseEnabled = true;
    this.renderStimulusLetter(stimulus);
    this.debug("practice trial", {
      trial: this.currentPracticeTrialNumber,
      stimulus,
      isTarget: isCPTTarget(stimulus, this.config)
    });

    this.stimulusTimeoutId = window.setTimeout(() => {
      this.stimulusTimeoutId = null;
      this.finishPracticeTrial("timeout");
    }, this.config.stimulusDurationMs);
  }

  private finishPracticeTrial(reason: TrialCompletionReason): void {
    if (
      this.state !== CPTActivityState.Practice ||
      this.trialFinished ||
      !this.currentStimulus
    ) {
      return;
    }

    const stimulus = this.currentStimulus;

    this.trialFinished = true;
    this.responseEnabled = false;
    this.clearStimulusTimeout();
    this.currentStimulus = null;
    this.renderTextScreen("Practica", [
      this.getPracticeFeedback(stimulus, reason),
      `Ensayo ${this.currentPracticeTrialNumber} de ${this.config.practiceTrials}.`
    ]);

    this.interTrialTimeoutId = window.setTimeout(() => {
      this.interTrialTimeoutId = null;
      this.beginNextPracticeTrial();
    }, this.config.interStimulusIntervalMs);
  }

  private finishPractice(): void {
    if (this.state !== CPTActivityState.Practice) {
      return;
    }

    this.responseEnabled = false;
    this.trialFinished = true;
    this.clearStimulusTimeout();
    this.state = CPTActivityState.Countdown;
    this.telemetry?.onStateChange(this.state);
    this.renderTextScreen("Practica finalizada", [
      "Ahora comenzara la evaluacion.",
      "Durante los bloques solo veras letras."
    ]);

    this.countdownTimeoutId = window.setTimeout(() => {
      this.countdownTimeoutId = null;
      this.runEvaluationCountdown(this.config.countdownSeconds);
    }, this.config.interStimulusIntervalMs);
  }

  private runEvaluationCountdown(secondsRemaining: number): void {
    if (this.state !== CPTActivityState.Countdown) {
      return;
    }

    if (secondsRemaining <= 0) {
      this.metricsManager.startSession(this.config.blocks);
      this.globalTrialNumber = 0;
      this.startBlock(0);
      return;
    }

    this.renderCountdown(secondsRemaining);
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
    this.clearScreen();
    this.state = CPTActivityState.RunningBlock;
    this.telemetry?.onStateChange(this.state);
    this.currentBlockIndex = blockIndex;
    this.currentBlock = block;
    this.currentBlockStartedAt = performance.now();
    this.currentBlockTrialNumber = 0;
    this.currentStimulus = null;
    this.trialFinished = true;
    this.responseEnabled = false;
    this.blockDurationReached = false;
    this.telemetry?.onBlockStart({
      blockNumber: block.blockNumber,
      condition: block.condition
    });
    this.distractorManager.setCondition(block.condition, block.blockNumber);
    this.debug("start block", block);

    this.blockTimerId = window.setTimeout(() => {
      this.blockTimerId = null;
      this.blockDurationReached = true;

      if (this.trialFinished) {
        this.endCurrentBlock();
      }
    }, block.durationMs);

    this.interTrialTimeoutId = window.setTimeout(() => {
      this.interTrialTimeoutId = null;
      this.beginOfficialTrial();
    }, 500);
  }

  private beginOfficialTrial(): void {
    if (this.state !== CPTActivityState.RunningBlock || !this.currentBlock) {
      return;
    }

    if (this.shouldEndCurrentBlock()) {
      this.endCurrentBlock();
      return;
    }

    const stimulus = generateCPTStimulus(this.config);
    const isTarget = isCPTTarget(stimulus, this.config);
    const stimulusStartedAt = performance.now();

    this.currentBlockTrialNumber += 1;
    this.globalTrialNumber += 1;
    this.currentStimulus = stimulus;
    this.currentStimulusStartedAt = stimulusStartedAt;
    this.trialFinished = false;
    this.responseEnabled = true;
    this.metricsManager.startTrial({
      trialNumber: this.currentBlockTrialNumber,
      globalTrialNumber: this.globalTrialNumber,
      blockNumber: this.currentBlock.blockNumber,
      condition: this.currentBlock.condition,
      stimulus,
      isTarget,
      stimulusStartedAt,
      elapsedSessionTimeMs:
        this.metricsManager.getElapsedSessionTime(stimulusStartedAt)
    });
    this.telemetry?.onTrialStart({
      trialNumber: this.currentBlockTrialNumber,
      globalTrialNumber: this.globalTrialNumber,
      stimulusId: stimulus,
      stimulusType: isTarget ? "target" : "non-target"
    });
    this.renderStimulusLetter(stimulus);
    this.debug("official trial", {
      block: this.currentBlock.blockNumber,
      globalTrial: this.globalTrialNumber,
      stimulus,
      isTarget
    });

    this.stimulusTimeoutId = window.setTimeout(() => {
      this.stimulusTimeoutId = null;
      this.finishOfficialTrial("timeout");
    }, this.config.stimulusDurationMs);
  }

  private finishOfficialTrial(reason: TrialCompletionReason): void {
    if (
      this.state !== CPTActivityState.RunningBlock ||
      this.trialFinished ||
      !this.currentStimulus
    ) {
      return;
    }

    this.trialFinished = true;
    this.responseEnabled = false;
    this.clearStimulusTimeout();

    if (reason === "timeout") {
      this.metricsManager.registerNoResponse();
    }

    const completedTrial = this.metricsManager.endTrial(performance.now());
    this.telemetry?.onTrialEnd();

    this.debug("trial result", completedTrial);
    this.currentStimulus = null;
    this.clearScreen();

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
    if (this.state !== CPTActivityState.RunningBlock || !this.currentBlock) {
      return;
    }

    const completedBlock = this.currentBlock;
    const nextBlockIndex = this.currentBlockIndex + 1;

    this.responseEnabled = false;
    this.trialFinished = true;
    this.clearStimulusTimeout();
    this.clearInterTrialTimeout();
    this.clearBlockTimer();
    this.clearScreen();
    this.currentStimulus = null;
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

  private startRest(completedBlock: CPTBlockConfig, nextBlockIndex: number): void {
    const nextBlock = this.config.blocks[nextBlockIndex];

    if (!nextBlock) {
      this.finishSession();
      return;
    }

    const restStartedAt = performance.now();

    this.state = CPTActivityState.Resting;
    this.telemetry?.onStateChange(this.state);
    this.responseEnabled = false;
    this.trialFinished = true;
    this.clearScreen();

    const updateRestScreen = (): void => {
      if (this.state !== CPTActivityState.Resting) {
        return;
      }

      const elapsedRestMs = performance.now() - restStartedAt;
      const remainingMs = Math.max(0, this.config.restDurationMs - elapsedRestMs);

      if (remainingMs <= 0) {
        this.restTimeoutId = null;
        this.startBlock(nextBlockIndex);
        return;
      }

      this.renderTextScreen("Descanso breve", [
        `Bloque ${completedBlock.blockNumber} finalizado.`,
        `Siguiente: ${nextBlock.label}.`,
        `Comenzamos en ${Math.ceil(remainingMs / 1000)}.`
      ]);

      this.restTimeoutId = window.setTimeout(() => {
        this.restTimeoutId = null;
        updateRestScreen();
      }, Math.min(1000, remainingMs));
    };

    updateRestScreen();
  }

  private finishSession(): void {
    if (this.state === CPTActivityState.Finished) {
      return;
    }

    this.state = CPTActivityState.Finished;
    this.telemetry?.onStateChange(this.state);
    this.responseEnabled = false;
    this.trialFinished = true;
    this.cleanupTimers();
    this.distractorManager.disableAll();
    this.clearScreen();

    const results = this.metricsManager.endSession();
    this.telemetry?.onActivityResult(
      results as unknown as Record<string, unknown>
    );

    console.log("CPT SESSION RESULT", results);
    this.renderFinishedScreen(results);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code !== "Space" || event.repeat) {
      return;
    }

    event.preventDefault();

    if (
      this.state === CPTActivityState.Instructions ||
      this.state === CPTActivityState.Finished
    ) {
      this.startPractice();
      return;
    }

    if (
      this.state !== CPTActivityState.Practice &&
      this.state !== CPTActivityState.RunningBlock
    ) {
      return;
    }

    this.registerStudentResponse();
  }

  private registerStudentResponse(): void {
    if (
      !this.responseEnabled ||
      this.trialFinished ||
      !this.currentStimulus
    ) {
      return;
    }

    this.distractorManager.playResponseCue();

    if (this.state === CPTActivityState.Practice) {
      this.finishPracticeTrial("response");
      return;
    }

    if (this.state !== CPTActivityState.RunningBlock) {
      return;
    }

    const reactionTimeMs = performance.now() - this.currentStimulusStartedAt;

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
    stimulus: string,
    reason: TrialCompletionReason
  ): string {
    const isTarget = isCPTTarget(stimulus, this.config);

    if (isTarget && reason === "response") {
      return `Correcto. Responde cuando aparece ${this.config.targetLetter}.`;
    }

    if (isTarget && reason === "timeout") {
      return `Recuerda presionar ESPACIO cuando veas ${this.config.targetLetter}.`;
    }

    if (!isTarget && reason === "response") {
      return `Recuerda esperar cuando aparece ${stimulus}.`;
    }

    return "Correcto. Con otras letras debes esperar.";
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
    this.currentStimulus = null;
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

  private renderTextScreen(title: string, lines: string[]): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintScreenBackground(context, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#eaffff";
    context.font = "800 112px Arial";
    context.fillText(title, width / 2, 160);

    context.font = "500 58px Arial";
    context.fillStyle = "#dff7f3";

    const wrappedLines = lines.flatMap((line) =>
      this.wrapText(context, line, width - 260)
    );
    const lineHeight = 78;
    const firstLineY = 330;

    wrappedLines.slice(0, 6).forEach((line, index) => {
      context.fillText(line, width / 2, firstLineY + index * lineHeight);
    });

    texture.update();
  }

  private renderCountdown(secondsRemaining: number): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintScreenBackground(context, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#eaffff";
    context.font = "800 110px Arial";
    context.fillText("Comenzamos en", width / 2, 210);
    context.fillStyle = "#8df5e2";
    context.font = "900 330px Arial";
    context.fillText(String(secondsRemaining), width / 2, height / 2 + 120);
    texture.update();
  }

  private renderStimulusLetter(letter: string): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintScreenBackground(context, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#f7fffb";
    context.font = "900 540px Arial";
    context.fillText(letter, width / 2, height / 2 + 20);
    texture.update();
  }

  private renderFinishedScreen(results: CPTSessionResult): void {
    this.renderTextScreen("Actividad completada", [
      "La sesion termino correctamente.",
      "Los resultados se imprimieron en la consola.",
      `Ensayos registrados: ${results.totalTrials}.`,
      "ESPACIO para repetir."
    ]);
  }

  private clearScreen(): void {
    const texture = this.ensureScreenTexture();
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const width = texture.getSize().width;
    const height = texture.getSize().height;

    this.paintScreenBackground(context, width, height);
    texture.update();
  }

  private ensureScreenTexture(): DynamicTexture {
    if (this.screenTexture) {
      return this.screenTexture;
    }

    const texture = new DynamicTexture(
      "cptActivityScreenTexture",
      {
        width: 2048,
        height: 1024
      },
      this.scene,
      false
    );
    const material = new StandardMaterial(
      "cptActivityScreenMaterial",
      this.scene
    );

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.75, 0.95, 0.96);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    this.cptScreenMesh.material = material;
    this.cptScreenMesh.metadata = {
      ...(this.cptScreenMesh.metadata ?? {}),
      dynamic: true,
      role: "cpt-screen"
    };
    this.screenTexture = texture;
    this.screenMaterial = material;

    return texture;
  }

  private paintScreenBackground(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#061820";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(141, 245, 226, 0.36)";
    context.lineWidth = 16;
    context.strokeRect(46, 46, width - 92, height - 92);
    context.strokeStyle = "rgba(255, 255, 255, 0.08)";
    context.lineWidth = 4;
    context.strokeRect(96, 96, width - 192, height - 192);
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

  private disposeScreenUi(): void {
    this.screenMaterial?.dispose();
    this.screenTexture?.dispose();
    this.screenTexture = null;
    this.screenMaterial = null;
  }

  private debug(message: string, data: unknown): void {
    if (!CPT_DEBUG) {
      return;
    }

    console.log(`[CPT] ${message}`, data);
  }
}
