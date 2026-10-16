import { DefaultRenderingPipeline } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/** Apply to both cameras so exploration and evaluation have the same edge quality. */
export function configureSceneAntialiasing(scene: Scene): void {
  const pipeline = new DefaultRenderingPipeline("scenarioVisuals", false, scene, scene.cameras);
  pipeline.imageProcessingEnabled = false;
  pipeline.fxaaEnabled = true;
  // One lightweight pass keeps headroom for camera-based attention analysis.
  pipeline.samples = 1;
  scene.onDisposeObservable.addOnce(() => pipeline.dispose());
}
