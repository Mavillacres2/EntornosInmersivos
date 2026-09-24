import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import { PerfCounter } from "@babylonjs/core/Misc/perfCounter";
import type { Engine, Scene } from "@babylonjs/core";

export interface AnalysisProbeSnapshot {
  analysis: {
    renderFps: number | null;
    upperAnalysisFps: number;
    fullBodyAnalysisFps: number;
  };
  cameras: Record<string, unknown>;
  inference: Record<string, unknown>;
}

export class PerformanceProbe {
  private readonly output = document.createElement("script");
  private readonly intervalId: number;
  private readonly engine: Engine;
  private readonly getAnalysisSnapshot: () => AnalysisProbeSnapshot;
  private instrumentation: SceneInstrumentation | null = null;
  private scene: Scene | null = null;

  constructor(
    engine: Engine,
    getAnalysisSnapshot: () => AnalysisProbeSnapshot
  ) {
    PerfCounter.Enabled = true;
    this.engine = engine;
    this.getAnalysisSnapshot = getAnalysisSnapshot;
    this.output.id = "performanceProbe";
    this.output.type = "application/json";
    document.body.appendChild(this.output);
    this.intervalId = window.setInterval(() => this.capture(), 1000);
    this.capture();
  }

  setScene(scene: Scene | null): void {
    this.instrumentation?.dispose();
    this.instrumentation = null;
    this.scene = scene;

    if (!scene) {
      this.capture();
      return;
    }

    const instrumentation = new SceneInstrumentation(scene);
    instrumentation.captureActiveMeshesEvaluationTime = true;
    instrumentation.captureAnimationsTime = true;
    instrumentation.captureFrameTime = true;
    instrumentation.captureRenderTargetsRenderTime = true;
    instrumentation.captureRenderTime = true;
    this.instrumentation = instrumentation;
  }

  dispose(): void {
    window.clearInterval(this.intervalId);
    this.instrumentation?.dispose();
    this.output.remove();
  }

  private capture(): void {
    const scene = this.scene;
    const instrumentation = this.instrumentation;
    const memory = (
      performance as Performance & {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }
    ).memory;

    this.output.textContent = JSON.stringify({
      capturedAt: new Date().toISOString(),
      engine: {
        fps: round(this.engine.getFps()),
        deltaTimeMs: round(this.engine.getDeltaTime()),
        hardwareScalingLevel: this.engine.getHardwareScalingLevel(),
        renderWidth: this.engine.getRenderWidth(),
        renderHeight: this.engine.getRenderHeight()
      },
      scene: scene
        ? {
            meshes: scene.meshes.length,
            activeMeshes: scene.getActiveMeshes().length,
            materials: scene.materials.length,
            textures: scene.textures.length,
            lights: scene.lights.length,
            skeletons: scene.skeletons.length,
            animationGroups: scene.animationGroups.length,
            activeAnimations: scene.animatables.length,
            vertices: scene.getTotalVertices(),
            activeIndices: scene.getActiveIndices(),
            drawCalls: round(
              (
                this.engine as Engine & {
                  _drawCalls: { current: number };
                }
              )._drawCalls.current
            ),
            frameTimeMs: round(instrumentation?.frameTimeCounter.lastSecAverage ?? 0),
            renderTimeMs: round(instrumentation?.renderTimeCounter.lastSecAverage ?? 0),
            activeMeshesEvaluationMs: round(
              instrumentation?.activeMeshesEvaluationTimeCounter.lastSecAverage ?? 0
            ),
            animationsTimeMs: round(
              instrumentation?.animationsTimeCounter.lastSecAverage ?? 0
            ),
            renderTargetsTimeMs: round(
              instrumentation?.renderTargetsRenderTimeCounter.lastSecAverage ?? 0
            )
          }
        : null,
      memory: memory
        ? {
            usedJsHeapMb: round(memory.usedJSHeapSize / 1024 / 1024),
            totalJsHeapMb: round(memory.totalJSHeapSize / 1024 / 1024)
          }
        : null,
      ...this.getAnalysisSnapshot()
    });
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
