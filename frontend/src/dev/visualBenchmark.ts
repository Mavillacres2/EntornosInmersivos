import { Camera, Color3, DirectionalLight, HemisphericLight, Scene, ShadowGenerator, UniversalCamera, Vector3 } from '@babylonjs/core';
import type { Engine } from '@babylonjs/core';
import { ClassroomBuilder } from '../environment/ClassroomBuilder';
import { SpaceStationBuilder } from '../environment/SpaceStationBuilder';
import { MuseumBuilder } from '../environment/MuseumBuilder';
import { ExplorationVisuals } from '../environment/ExplorationVisuals';
import { GuideCharacter } from '../guides/GuideCharacter';
import { CharacterAnimationController } from '../guides/CharacterAnimationController';
import { configureSceneAntialiasing } from '../scenes/SceneVisuals';
import type { WorldTheme } from '../ui/ScenarioPresentation';

/** Fixed-view component comparison. Excludes imported actors, MediaPipe, cameras and audio. */
export async function runVisualBenchmark(engine: Engine, theme: WorldTheme, show: (scene: Scene) => void, report: (message: string) => void, current: () => boolean): Promise<void> {
  const scene = new Scene(engine);
  const layout = theme === 'classroom' ? new ClassroomBuilder(scene).build() : theme === 'space' ? new SpaceStationBuilder(scene).build() : new MuseumBuilder(scene).build();
  let key: DirectionalLight;
  if ('shadowLight' in layout) key = layout.shadowLight;
  else {
    const hemi = new HemisphericLight('classroomAmbientLight', new Vector3(0, 1, 0), scene); hemi.intensity = .55; hemi.diffuse = new Color3(.88, .94, 1); hemi.groundColor = new Color3(.36, .34, .3);
    key = new DirectionalLight('windowLight', new Vector3(.68, -.92, .28), scene); key.position.set(-7.5, 5.2, -3.2); key.intensity = .78; key.diffuse = new Color3(1, .95, .86);
  }
  const shadow = new ShadowGenerator(1024, key); shadow.useBlurExponentialShadowMap = true; shadow.useKernelBlur = true; shadow.blurScale = 2; shadow.blurKernel = 16; shadow.setDarkness(theme === 'classroom' ? .36 : theme === 'space' ? .28 : .26);
  shadow.getShadowMap()!.refreshRate = 2; layout.shadowCasters.forEach(mesh => shadow.addShadowCaster(mesh));
  const camera = new UniversalCamera('benchmark-camera', layout.explorationEyePosition, scene); camera.setTarget(layout.explorationLookAt);
  camera.fov = 1.5; camera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED; scene.activeCamera = camera;
  scene.imageProcessingConfiguration.exposure = theme === 'classroom' ? 1.02 : theme === 'space' ? 1.08 : 1.05;
  scene.imageProcessingConfiguration.contrast = theme === 'classroom' ? 1.08 : theme === 'space' ? 1.02 : 1.04;
  scene.meshes.forEach(mesh => { if (!mesh.metadata?.dynamic) { mesh.freezeWorldMatrix(); mesh.material?.freeze(); } });
  configureSceneAntialiasing(scene); show(scene);
  let layer: ExplorationVisuals | null = null, character: GuideCharacter | null = null;
  let animationObserver: ReturnType<typeof scene.onBeforeRenderObservable.add> = null;
  const results: unknown[] = [];
  const sample = (name: string) => new Promise<void>((resolve, reject) => {
    let started = performance.now(), previous = started, frames: number[] = [], invalid = false;
    report(`${theme}: ${name}. Calentamiento 2 s + muestra 5 s. Mantén esta pestaña visible.`);
    const observer = engine.onEndFrameObservable.add(() => {
      const now = performance.now();
      if (!current() || scene.isDisposed) { engine.onEndFrameObservable.remove(observer); reject(new Error('Medición cancelada')); return; }
      if (document.hidden) invalid = true;
      if (now - started > 2000) frames.push(now - previous);
      previous = now;
      if (now - started < 7000) return;
      engine.onEndFrameObservable.remove(observer);
      frames = frames.filter(value => value > 0).sort((a, b) => a - b);
      results.push({ phase: name, invalidBackground: invalid, insufficientSamples: frames.length < 60, samples: frames.length, fps: Number((1000 * frames.length / frames.reduce((sum, value) => sum + value, 0)).toFixed(2)), medianFrameMs: Number(frames[Math.floor(frames.length / 2)]!.toFixed(2)), p95FrameMs: Number(frames[Math.floor(frames.length * .95)]!.toFixed(2)), meshes: scene.meshes.length, vertices: scene.getTotalVertices(), materials: scene.materials.length });
      resolve();
    });
  });
  try {
    await sample('original-surfaces');
    layer = new ExplorationVisuals(scene, theme, 'balanced');
    await sample('exploration-art-PBR-IBL-ACES');
    character = new GuideCharacter(scene, theme, 'balanced'); character.root.parent = camera; character.root.position.set(.9, -.85, 2.5); character.root.setEnabled(true);
    await character.ready;
    const animation = new CharacterAnimationController(character); animation.setState('EXPLAINING');
    animationObserver = scene.onBeforeRenderObservable.add(() => animation.update(engine.getDeltaTime() / 1000, .3));
    await sample('exploration-art-and-GLB-guide');
    report(JSON.stringify({ date: new Date().toISOString(), theme, scope: 'isolated static room; no GLB actors, MediaPipe, physical cameras or audio; samples <60 are inconclusive', size: [engine.getRenderWidth(), engine.getRenderHeight()], scaling: engine.getHardwareScalingLevel(), renderer: engine.getGlInfo(), results }, null, 2));
  } finally {
    if (animationObserver) scene.onBeforeRenderObservable.remove(animationObserver);
    character?.dispose(); layer?.dispose();
  }
}
