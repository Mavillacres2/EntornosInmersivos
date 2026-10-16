import { Color3, HemisphericLight, Mesh, PBRMaterial, PointLight, Quaternion, SceneLoader, TransformNode, Vector3 } from '@babylonjs/core';
import type { AbstractMesh, AnimationGroup, AssetContainer, Light, MorphTarget, Scene } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { GuideQuality } from './GuideSceneConfiguration';
import type { WorldTheme } from '../ui/ScenarioPresentation';

export type GuideAssetLoader = (scene: Scene, theme: WorldTheme, quality: GuideQuality) => Promise<AssetContainer>;
const loadGuideAsset: GuideAssetLoader = (scene, theme, quality) => SceneLoader.LoadAssetContainerAsync(
  `${import.meta.env.BASE_URL}assets/models/guides-v2/`, `${theme}-${quality}.glb`, scene
);

/** Original authored GLB with articulated node rig, native clips and mouth morph. No skin/mocap claim. */
export class GuideCharacter {
  readonly root: TransformNode;
  torso: TransformNode;
  head: TransformNode;
  leftArm: TransformNode;
  rightArm: TransformNode;
  leftForearm: TransformNode;
  rightForearm: TransformNode;
  readonly eyes: TransformNode[] = [];
  readonly pupils: Mesh[] = [];
  readonly hips: TransformNode[] = [];
  readonly meshes: Mesh[] = [];
  readonly ready: Promise<void>;
  mouth: Mesh | null = null;
  mouthOpen: MorphTarget | null = null;
  readonly mouthShapes: MorphTarget[] = [];
  animationGroups: AnimationGroup[] = [];
  readonly theme: WorldTheme;
  private container: AssetContainer | null = null;
  private readonly excludedLights: Light[];
  private readonly lights: Light[];
  private disposed = false;

  constructor(scene: Scene, theme: WorldTheme, quality: GuideQuality, loader: GuideAssetLoader = loadGuideAsset) {
    this.theme = theme;
    this.root = new TransformNode('virtualGuide-root', scene);
    this.root.metadata = { role: 'pre-evaluation-guide', ignoreSightline: true };
    this.torso = new TransformNode('guide-loading-rig', scene); this.torso.parent = this.root;
    this.head = this.leftArm = this.rightArm = this.leftForearm = this.rightForearm = this.torso;
    this.root.setEnabled(false);
    this.excludedLights = scene.lights.slice();
    const fill = new HemisphericLight('guide-fill', new Vector3(0, 1, -1), scene);
    fill.intensity = .68; fill.groundColor = new Color3(.24, .29, .35);
    const key = new PointLight('guide-key', new Vector3(-1.4, 2.4, -1.5), scene);
    key.parent = this.root; key.intensity = 10; key.diffuse = new Color3(1, .92, .8);
    this.lights = [fill, key]; this.lights.forEach(light => light.setEnabled(false));
    this.ready = loader(scene, theme, quality).then(container => {
      if (this.disposed || scene.isDisposed) { container.dispose(); return; }
      this.container = container;
      container.animationGroups.forEach(group => group.stop());
      container.addAllToScene();
      container.rootNodes.forEach(node => {
        if (!(node instanceof TransformNode)) return;
        node.parent = this.root;
        node.rotationQuaternion = (node.rotationQuaternion ?? Quaternion.Identity()).multiply(Quaternion.RotationYawPitchRoll(Math.PI,0,0));
      });
      this.torso.dispose();
      const joint = (name: string) => {
        const result = container.transformNodes.find(node => node.name === name);
        if (!result) throw new Error(`Missing guide joint: ${name}`);
        return result;
      };
      this.torso = joint('torso'); this.head = joint('head');
      this.leftArm = joint('leftArm'); this.rightArm = joint('rightArm');
      this.leftForearm = joint('leftForearm'); this.rightForearm = joint('rightForearm');
      this.eyes.push(joint('eye--1'), joint('eye-1'));
      this.hips.push(joint('hip--1'), joint('hip-1'));
      for (const mesh of container.meshes) {
        if (!(mesh instanceof Mesh)) continue;
        mesh.isPickable = false; mesh.checkCollisions = false; mesh.renderingGroupId = 3;
        mesh.metadata = { ...mesh.metadata, role: 'pre-evaluation-guide', ignoreSightline: true };
        this.meshes.push(mesh);
        if (mesh.name === 'mouth') {
          this.mouth = mesh; this.mouthOpen = mesh.morphTargetManager?.getTarget(0) ?? null;
          if(mesh.morphTargetManager)for(let i=0;i<mesh.morphTargetManager.numTargets;i++)this.mouthShapes.push(mesh.morphTargetManager.getTarget(i));
        }
        if (/^pupil--?1$/.test(mesh.name)) this.pupils.push(mesh);
        if (mesh.material instanceof PBRMaterial) { mesh.material.maxSimultaneousLights = 2; mesh.material.environmentIntensity = .35; }
      }
      this.animationGroups = container.animationGroups;
      this.excludedLights.forEach(light => { if (!light.isDisposed()) light.excludedMeshes.push(...this.meshes); });
      this.lights.forEach(light => { light.includedOnlyMeshes = this.meshes; light.setEnabled(true); });
    }).catch(error => { this.dispose(); throw error; });
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    const ours = new Set<AbstractMesh>(this.meshes);
    this.excludedLights.forEach(light => { if (!light.isDisposed()) light.excludedMeshes = light.excludedMeshes.filter(mesh => !ours.has(mesh)); });
    this.lights.forEach(light => light.dispose());
    this.container?.dispose(); this.container = null;
    this.root.dispose(false);
  }
}
