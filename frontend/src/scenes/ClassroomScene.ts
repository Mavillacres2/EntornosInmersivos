import { getExplorationSoundEnabled, saveExplorationSoundEnabled } from "../ui/ExplorationPreferences";
import { VirtualGuideManager } from '../guides/VirtualGuideManager';
import { ExplorationVisuals } from '../environment/ExplorationVisuals';
import { getExplorationQuality, saveExplorationQuality } from '../ui/ExplorationQuality';
import { createExplorationAccents } from "../environment/ExplorationAccents";
import { ExplorationHud } from "../ui/ExplorationHud";
import { configureSceneAntialiasing } from "./SceneVisuals";
import {
  Color3,
  Color4,
  DirectionalLight,
  HemisphericLight,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type { Engine, Material, Mesh } from "@babylonjs/core";

import { GoNoGoActivity } from "../activities/GoNoGoActivity";
import { DEFAULT_GO_NO_GO_SESSION_CONFIG } from "../activities/GoNoGoTypes";
import type { ActivityTelemetrySink } from "../analysis/synchronization/ActivityContextAdapter";
import { AmbientBehaviorManager } from "../ambient/AmbientBehaviorManager";
import { AudioManager } from "../audio/AudioManager";
import { CameraManager } from "../camera/CameraManager";
import { CharacterManager } from "../characters/CharacterManager";
import { DistractorManager } from "../distractors/DistractorManager";
import { ClassroomBuilder } from "../environment/ClassroomBuilder";
import { MetricsManager } from "../metrics/MetricsManager";

export class ClassroomScene {
  private readonly engine: Engine;
  private readonly canvas: HTMLCanvasElement;
  private readonly onReturnToMenu: () => void;
  private readonly telemetry: ActivityTelemetrySink | null;

  private scene: Scene | null = null;
  private stimulusAnchor: TransformNode | null = null;
  private activity: GoNoGoActivity | null = null;
  private audioManager: AudioManager | null = null;
  private characterManager: CharacterManager | null = null;
  private ambientBehaviorManager: AmbientBehaviorManager | null = null;
  private charactersReadyPromise: Promise<void> | null = null;
  private cameraManager: CameraManager | null = null;
  private explorationHud: ExplorationHud | null = null;
  private guide: VirtualGuideManager | null = null;
  private explorationVisuals: ExplorationVisuals | null = null;
  private unsubscribePointerLock: (() => void) | null = null;
  private evaluationHiddenMeshes: Mesh[] = [];
  private evaluationStarted = false;
  private explorationAudioEnabled = getExplorationSoundEnabled();
  private readonly handleExplorationPointerDownBound = (): void => {
    this.startExplorationAudio();
  };
  private readonly handleExplorationKeyDownBound = (event: KeyboardEvent): void => {
    this.handleExplorationKeyDown(event);
  };

  constructor(
    engine: Engine,
    canvas: HTMLCanvasElement,
    onReturnToMenu: () => void = () => {},
    telemetry?: ActivityTelemetrySink
  ) {
    this.engine = engine;
    this.canvas = canvas;
    this.onReturnToMenu = onReturnToMenu;
    this.telemetry = telemetry ?? null;
  }

  create(): Scene {
    const scene = new Scene(this.engine);
    scene.clearColor = new Color4(0.92, 0.91, 0.84, 1);

    const classroomBuilder = new ClassroomBuilder(scene);
    const classroomLayout = classroomBuilder.build();
    classroomLayout.evaluationHiddenMeshes.push(...createExplorationAccents(scene, "classroom"));
    this.evaluationHiddenMeshes = classroomLayout.evaluationHiddenMeshes;

    const shadowLight = this.configureLighting(scene);
    const shadowGenerator = this.configureShadows(
      shadowLight,
      classroomLayout.shadowCasters
    );
    this.configureImageProcessing(scene);
    this.explorationVisuals = new ExplorationVisuals(scene, 'classroom', getExplorationQuality());
    this.optimizeStaticClassroom(scene);

    this.stimulusAnchor = this.createStimulusAnchor(
      scene,
      classroomLayout.stimulusAnchorPosition
    );
    this.audioManager = new AudioManager();
    this.audioManager.setEnabled(this.explorationAudioEnabled);
    void this.audioManager.initialize(scene);
    this.characterManager = new CharacterManager(scene, { shadowGenerator });
    this.ambientBehaviorManager = new AmbientBehaviorManager(this.characterManager);
    this.charactersReadyPromise = this.characterManager
      .initialize()
      .then(() => {
        if (!this.evaluationStarted) {
          this.ambientBehaviorManager?.start();
        }
      })
      .catch((error: unknown) => {
        console.warn("No se pudieron precargar todos los personajes.", error);
      });

    this.cameraManager = new CameraManager({
      onPointerLockError: () => this.explorationHud?.showLookUnavailable(),
      scene,
      canvas: this.canvas,
      explorationPosition: classroomLayout.explorationEyePosition,
      explorationTarget: classroomLayout.explorationLookAt,
      evaluationPosition: classroomLayout.studentEyePosition,
      evaluationTarget: classroomLayout.studentLookAt,
      collisionMeshes: classroomLayout.collisionMeshes,
      bounds: classroomLayout.cameraBounds
    });
    this.cameraManager.enterExplorationMode();
    configureSceneAntialiasing(scene);

    this.showExplorationPanel();

    this.scene = scene;
    this.guide = new VirtualGuideManager(scene, {
      theme: 'classroom', quality: getExplorationQuality(),
      beforeOpen: () => { this.cameraManager?.disablePointerLock(); this.audioManager?.stopAmbientAudio(); },
      onClose: () => {}, onMenu: this.onReturnToMenu,
      onComplete: () => { this.startExplorationAudio(); void this.beginEvaluationFlow(); }
    });
    return scene;
  }

  dispose(): void {
    this.guide?.dispose(); this.guide = null;
    this.explorationVisuals?.dispose(); this.explorationVisuals = null;
    this.removeExplorationPanel();
    this.activity?.dispose();
    this.ambientBehaviorManager?.dispose();
    this.audioManager?.dispose();
    this.characterManager?.dispose();
    this.cameraManager?.dispose();
    this.scene?.dispose();

    this.activity = null;
    this.audioManager = null;
    this.characterManager = null;
    this.ambientBehaviorManager = null;
    this.cameraManager = null;
    this.charactersReadyPromise = null;
    this.scene = null;
    this.stimulusAnchor = null;
    this.evaluationHiddenMeshes = [];
  }

  private configureLighting(scene: Scene): DirectionalLight {
    const ambientLight = new HemisphericLight(
      "classroomAmbientLight",
      new Vector3(0, 1, 0),
      scene
    );

    ambientLight.intensity = 0.55;
    ambientLight.diffuse = new Color3(0.88, 0.94, 1);
    ambientLight.groundColor = new Color3(0.36, 0.34, 0.3);

    const windowLight = new DirectionalLight(
      "windowLight",
      new Vector3(0.68, -0.92, 0.28),
      scene
    );

    windowLight.position = new Vector3(-7.5, 5.2, -3.2);
    windowLight.intensity = 0.78;
    windowLight.diffuse = new Color3(1, 0.95, 0.86);

    return windowLight;
  }

  private configureShadows(
    light: DirectionalLight,
    shadowCasters: Mesh[]
  ): ShadowGenerator {
    const shadowGenerator = new ShadowGenerator(1024, light);

    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.useKernelBlur = true;
    shadowGenerator.blurScale = 2;
    shadowGenerator.blurKernel = 16;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.02;
    shadowGenerator.setDarkness(0.36);

    shadowCasters.forEach((mesh) => {
      shadowGenerator.addShadowCaster(mesh);
    });

    const shadowMap = shadowGenerator.getShadowMap();

    if (shadowMap) {
      shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYTWOFRAMES;
    }

    return shadowGenerator;
  }

  private configureImageProcessing(scene: Scene): void {
    scene.imageProcessingConfiguration.exposure = 1.02;
    scene.imageProcessingConfiguration.contrast = 1.08;
  }

  private optimizeStaticClassroom(scene: Scene): void {
    const materials = new Set<Material>();

    scene.skipPointerMovePicking = true;

    scene.meshes.forEach((mesh) => {
      if (mesh.material) {
        materials.add(mesh.material);
      }

      mesh.freezeWorldMatrix();
    });

    materials.forEach((material) => {
      material.freeze();
    });
  }

  private createStimulusAnchor(scene: Scene, position: Vector3): TransformNode {
    const stimulusAnchor = new TransformNode("stimulusAnchor", scene);
    stimulusAnchor.position = position;
    stimulusAnchor.metadata = {
      role: "activity-stimulus-anchor",
      description: "Reference point for attention activity stimuli"
    };

    return stimulusAnchor;
  }

  private showExplorationPanel(): void {
    this.removeExplorationPanel();
    this.explorationHud = new ExplorationHud({
      theme: "classroom",
      onExplore: () => {
        this.startExplorationAudio();
        this.cameraManager?.enablePointerLock();
      },
      onRelease: () => this.cameraManager?.disablePointerLock(),
      onStart: () => {
        this.guide?.open();
      },
      onSound: () => this.toggleExplorationAudio(),
      onMenu: this.onReturnToMenu,
      onQuality: quality => {
        saveExplorationQuality(quality); this.guide?.setQuality(quality);
        if (this.scene && !this.evaluationStarted) {
          this.explorationVisuals?.dispose();
          this.explorationVisuals = new ExplorationVisuals(this.scene, 'classroom', quality);
        }
      }
    });
    this.unsubscribePointerLock = this.cameraManager?.onPointerLockChange((locked) => {
      this.updatePointerLockUi(locked);
    }) ?? null;
    this.canvas.addEventListener("pointerdown", this.handleExplorationPointerDownBound);
    document.addEventListener("keydown", this.handleExplorationKeyDownBound);
    this.updateAudioToggleUi();
  }

  private async beginEvaluationFlow(): Promise<void> {
    const scene = this.scene;
    const stimulusAnchor = this.stimulusAnchor;
    const cameraManager = this.cameraManager;

    if (
      this.evaluationStarted ||
      !scene ||
      !stimulusAnchor ||
      !cameraManager
    ) {
      return;
    }

    this.evaluationStarted = true;
    this.guide?.dispose(); this.guide = null;
    this.explorationVisuals?.dispose(); this.explorationVisuals = null;
    this.setExplorationPanelBusy();
    cameraManager.disablePointerLock();
    this.ambientBehaviorManager?.stop();
    this.hideEvaluationObstructions();

    await this.charactersReadyPromise;
    if (this.scene !== scene || scene.isDisposed) return;
    this.characterManager?.setMode("evaluation");
    await cameraManager.enterEvaluationMode();
    if (this.scene !== scene || scene.isDisposed) return;

    this.removeExplorationPanel();
    this.startGoNoGoInstructions(scene, stimulusAnchor);
  }

  private setExplorationPanelBusy(): void {
    this.explorationHud?.setBusy();
  }

  private startGoNoGoInstructions(
    scene: Scene,
    stimulusAnchor: TransformNode
  ): void {
    const metricsManager = new MetricsManager();
    const distractorManager = new DistractorManager(scene, {
      audioManager: this.audioManager ?? undefined,
      characterManager: this.characterManager ?? undefined,
      onDistractorEvent: (event) => {
        console.log("Evento distractor:", event);
        this.telemetry?.onDistractor({
          distractorId: event.distractorId,
          distractorType: event.type,
          startedAt: event.startedAt,
          endedAt: event.endedAt
        });
      }
    });

    this.activity = new GoNoGoActivity({
      scene,
      stimulusAnchor,
      metricsManager,
      distractorManager,
      config: DEFAULT_GO_NO_GO_SESSION_CONFIG,
      telemetry: this.telemetry ?? undefined
    });

    this.activity.showInstructions();
  }

  private hideEvaluationObstructions(): void {
    this.evaluationHiddenMeshes.forEach((mesh) => {
      mesh.checkCollisions = false;
      mesh.setEnabled(false);
    });
  }

  private removeExplorationPanel(): void {
    this.unsubscribePointerLock?.();
    this.unsubscribePointerLock = null;
    this.canvas.removeEventListener(
      "pointerdown",
      this.handleExplorationPointerDownBound
    );
    document.removeEventListener("keydown", this.handleExplorationKeyDownBound);
    this.explorationHud?.dispose();
    this.explorationHud = null;
  }

  private handleExplorationKeyDown(event: KeyboardEvent): void {
    this.startExplorationAudio();

    if (
      this.evaluationStarted ||
      event.code !== "KeyQ" ||
      !this.cameraManager?.isPointerLocked()
    ) {
      return;
    }

    event.preventDefault();
    this.cameraManager.disablePointerLock();
  }

  private updatePointerLockUi(locked: boolean): void {
    this.explorationHud?.setPointerLocked(locked);
  }

  private startExplorationAudio(): void {
    if (this.guide?.isOpen) return;
    if (!this.explorationAudioEnabled) {
      return;
    }

    this.audioManager?.setEnabled(true);
    this.audioManager?.startAmbientAudio();
    this.updateAudioToggleUi();
  }

  private toggleExplorationAudio(): void {
    this.explorationAudioEnabled = !this.explorationAudioEnabled;
    saveExplorationSoundEnabled(this.explorationAudioEnabled);
    this.audioManager?.setEnabled(this.explorationAudioEnabled);

    if (this.explorationAudioEnabled) {
      this.audioManager?.startAmbientAudio();
    }

    this.updateAudioToggleUi();
  }

  private updateAudioToggleUi(): void {
    this.explorationHud?.setSoundEnabled(this.explorationAudioEnabled);
  }
}
