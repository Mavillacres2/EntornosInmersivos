import type { HandDetection, HeadOrientation } from "../types/AnalysisTypes";
import type { AnalysisDebugLandmarks } from "../tracking/BehaviorTrackingManager";
import type {
  AnalysisPerformanceSnapshot
} from "../types/AnalysisTypes";
import type { ActivityContext } from "../types/BehaviorTypes";
import {
  drawLandmarks,
  hasVisibleLandmarks
} from "./LandmarkOverlayRenderer";

export interface AnalysisDebugSnapshot {
  state: string;
  buffer: { samples: number; events: number };
  backendConnected: boolean;
  context: ActivityContext;
  performance: AnalysisPerformanceSnapshot;
}

export class AnalysisDebugOverlay {
  private readonly getSnapshot: () => AnalysisDebugSnapshot;
  private readonly getLandmarks: () => AnalysisDebugLandmarks;
  private root: HTMLElement | null = null;
  private upperCanvas: HTMLCanvasElement | null = null;
  private fullCanvas: HTMLCanvasElement | null = null;
  private statusText: HTMLElement | null = null;
  private refreshIntervalId: number | null = null;

  constructor(
    getSnapshot: () => AnalysisDebugSnapshot,
    getLandmarks: () => AnalysisDebugLandmarks
  ) {
    this.getSnapshot = getSnapshot;
    this.getLandmarks = getLandmarks;
  }

  show(): void {
    this.remove();
    const root = document.createElement("aside");

    root.id = "analysisDebugOverlay";
    root.setAttribute("aria-label", "Depuracion del analisis conductual");
    root.innerHTML = `
      <strong>ANALYSIS DEBUG</strong>
      <div class="analysisDebugCanvases">
        <figure>
          <canvas width="240" height="150" data-camera="upper"></canvas>
          <figcaption>CAM1 rostro / tren superior</figcaption>
        </figure>
        <figure>
          <canvas width="240" height="150" data-camera="full"></canvas>
          <figcaption>CAM2 cuerpo completo</figcaption>
        </figure>
      </div>
      <pre></pre>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.upperCanvas = root.querySelector('[data-camera="upper"]');
    this.fullCanvas = root.querySelector('[data-camera="full"]');
    this.statusText = root.querySelector("pre");
    this.refresh();
    this.refreshIntervalId = window.setInterval(() => this.refresh(), 250);
  }

  remove(): void {
    if (this.refreshIntervalId !== null) {
      window.clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }

    this.root?.remove();
    this.root = null;
    this.upperCanvas = null;
    this.fullCanvas = null;
    this.statusText = null;
  }

  private refresh(): void {
    const landmarks = this.getLandmarks();

    drawPose(this.upperCanvas, landmarks.upperPose, landmarks.upperFace, [], landmarks.headOrientation ?? null, true);
    drawPose(this.fullCanvas, landmarks.fullBodyPose, null, landmarks.hands ?? []);

    if (!this.statusText) {
      return;
    }

    const snapshot = this.getSnapshot();
    const context = snapshot.context;
    const performance = snapshot.performance;

    this.statusText.textContent = [
      `state: ${snapshot.state}`,
      `API: ${snapshot.backendConnected ? "connected" : "offline"}`,
      `render: ${formatFps(performance.renderFps)} fps`,
      `CAM1 analysis: ${formatFps(performance.upperAnalysisFps)} fps`,
      `CAM2 analysis: ${formatFps(performance.fullBodyAnalysisFps)} fps`,
      `buffer: ${snapshot.buffer.samples} samples / ${snapshot.buffer.events} events`,
      `scenario: ${context.scenarioId ?? "-"}`,
      `activity: ${context.activityId ?? "-"}`,
      `block: ${context.blockNumber ?? "-"} | trial: ${context.trialNumber ?? "-"}`,
      `distractor: ${context.distractorActive ? context.distractorType ?? "active" : "-"}`
    ].join("\n");
  }
}

function drawPose(
  canvas: HTMLCanvasElement | null,
  pose: AnalysisDebugLandmarks["upperPose"],
  face: AnalysisDebugLandmarks["upperFace"],
  hands: HandDetection[] = [],
  head: HeadOrientation | null = null,
  upperBodyOnly = false
): void {
  const context = canvas?.getContext("2d");

  if (!canvas || !context) {
    return;
  }

  context.fillStyle = "#07131d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (!hasVisibleLandmarks(pose, face) && !hands.length) {
    context.fillStyle = "#91a5b5";
    context.font = "12px system-ui";
    context.textAlign = "center";
    context.fillText("Sin deteccion", canvas.width / 2, canvas.height / 2);
    return;
  }

  drawLandmarks(context, pose, face, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    upperBodyOnly
  }, 1, hands, head, true);
}

function formatFps(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}
