import { getExplorationSoundEnabled, saveExplorationSoundEnabled } from "../ui/ExplorationPreferences";
import { VirtualGuideManager } from '../guides/VirtualGuideManager';
import { ExplorationVisuals } from '../environment/ExplorationVisuals';
import { getExplorationQuality, saveExplorationQuality } from '../ui/ExplorationQuality';
import { createExplorationAccents } from "../environment/ExplorationAccents";
import { ExplorationHud } from "../ui/ExplorationHud";
import { configureSceneAntialiasing } from "./SceneVisuals";
import {
  Color4,
  Ray,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  Vector3
} from "@babylonjs/core";
import type { AbstractMesh, DirectionalLight, Engine, Material, Mesh } from "@babylonjs/core";

import { VisualDiscriminationController } from "../activities/visual-discrimination/VisualDiscriminationController";
import { DEFAULT_VISUAL_DISCRIMINATION_CONFIG } from "../activities/visual-discrimination/VisualDiscriminationConfig";
import { VisualDiscriminationDistractorManager } from "../activities/visual-discrimination/VisualDiscriminationDistractorManager";
import type { ActivityTelemetrySink } from "../analysis/synchronization/ActivityContextAdapter";
import { AudioManager } from "../audio/AudioManager";
import { CameraManager } from "../camera/CameraManager";
import { MuseumCharacterManager } from "../characters/MuseumCharacterManager";
import { MuseumBuilder } from "../environment/MuseumBuilder";

export class VisualDiscriminationScene {
  private readonly engine: Engine;
  private readonly canvas: HTMLCanvasElement;
  private readonly onReturnToMenu: () => void;
  private readonly telemetry: ActivityTelemetrySink | null;

  private scene: Scene | null = null;
  private audioManager: AudioManager | null = null;
  private cameraManager: CameraManager | null = null;
  private museumCharacterManager: MuseumCharacterManager | null = null;
  private controller: VisualDiscriminationController | null = null;
  private explorationHud: ExplorationHud | null = null;
  private guide: VirtualGuideManager | null = null;
  private explorationVisuals: ExplorationVisuals | null = null;
  private evaluationHiddenMeshes: Mesh[] = [];
  private activityPanelMesh: Mesh | null = null;
  private evaluationEyePosition: Vector3 | null = null;
  private evaluationLookAt: Vector3 | null = null;
  private charactersReadyPromise: Promise<void> | null = null;
  private unsubscribePointerLock: (() => void) | null = null;
  private museumAudioEnabled = getExplorationSoundEnabled();
  private evaluationStarted = false;
  private readonly handleExplorationPointerDownBound = (): void => {
    this.startMuseumAudio();
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

    scene.clearColor = new Color4(0.78, 0.8, 0.76, 1);

    const museumBuilder = new MuseumBuilder(scene);
    const museumLayout = museumBuilder.build();
    museumLayout.evaluationHiddenMeshes.push(...createExplorationAccents(scene, "museum"));
    const shadowGenerator = this.configureShadows(
      museumLayout.shadowLight,
      museumLayout.shadowCasters
    );

    this.configureImageProcessing(scene);
    this.explorationVisuals = new ExplorationVisuals(scene, 'museum', getExplorationQuality());
    this.optimizeStaticMuseum(scene);
    this.audioManager = new AudioManager();
    this.audioManager.setEnabled(this.museumAudioEnabled);
    void this.audioManager.initialize(scene);
    this.museumCharacterManager = new MuseumCharacterManager(scene);
    this.charactersReadyPromise = this.museumCharacterManager.initialize().catch((error: unknown) => {
      console.warn("No se pudieron cargar todos los visitantes del museo.", error);
    });
    this.cameraManager = new CameraManager({
      onPointerLockError: () => this.explorationHud?.showLookUnavailable(),
      scene,
      canvas: this.canvas,
      explorationPosition: museumLayout.explorationEyePosition,
      explorationTarget: museumLayout.explorationLookAt,
      evaluationPosition: museumLayout.evaluationEyePosition,
      evaluationTarget: museumLayout.evaluationLookAt,
      collisionMeshes: museumLayout.collisionMeshes,
      bounds: museumLayout.cameraBounds,
      evaluationFov: 0.62,
      evaluationYawLimit: Math.PI / 10,
      evaluationPitchLimit: 0.24
    });
    this.evaluationHiddenMeshes = museumLayout.evaluationHiddenMeshes;
    this.activityPanelMesh = museumLayout.activityPanelMesh;
    this.evaluationEyePosition = museumLayout.evaluationEyePosition.clone();
    this.evaluationLookAt = museumLayout.evaluationLookAt.clone();
    this.cameraManager.enterExplorationMode();
    configureSceneAntialiasing(scene);
    this.showExplorationPanel();
    this.scene = scene;
    this.guide = new VirtualGuideManager(scene, {
      theme: 'museum', quality: getExplorationQuality(),
      beforeOpen: () => { this.cameraManager?.disablePointerLock(); this.audioManager?.stopAmbientAudio(); },
      onClose: () => {}, onMenu: this.onReturnToMenu,
      onComplete: () => { this.startMuseumAudio(); void this.beginEvaluationFlow(); }
    });

    this.startVisualDiscriminationActivity = () => {
      const distractorManager = new VisualDiscriminationDistractorManager(scene, {
        anchors: museumLayout.distractorAnchors,
        audioManager: this.audioManager ?? undefined,
        onDistractorEvent: (event) => {
          this.telemetry?.onDistractor({
            distractorId: event.distractorId,
            distractorType: event.type,
            startedAt: event.startedAt,
            endedAt: event.endedAt
          });
        }
      });

      this.controller = new VisualDiscriminationController({
        scene,
        activityPanelMesh: museumLayout.activityPanelMesh,
        config: DEFAULT_VISUAL_DISCRIMINATION_CONFIG,
        distractorManager,
        onReturnToMenu: this.onReturnToMenu,
        telemetry: this.telemetry ?? undefined
      });
      this.controller.showInstructions();
    };

    if (shadowGenerator.getShadowMap()) {
      museumLayout.shadowReceivers.forEach((mesh) => {
        mesh.receiveShadows = true;
      });
    }

    return scene;
  }

  dispose(): void {
    this.guide?.dispose(); this.guide = null;
    this.explorationVisuals?.dispose(); this.explorationVisuals = null;
    this.removeExplorationPanel();
    this.controller?.dispose();
    this.museumCharacterManager?.dispose();
    this.audioManager?.dispose();
    this.cameraManager?.dispose();
    this.scene?.dispose();

    this.controller = null;
    this.museumCharacterManager = null;
    this.audioManager = null;
    this.cameraManager = null;
    this.evaluationHiddenMeshes = [];
    this.activityPanelMesh = null;
    this.evaluationEyePosition = null;
    this.evaluationLookAt = null;
    this.charactersReadyPromise = null;
    this.scene = null;
  }

  private startVisualDiscriminationActivity: () => void = () => {};

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
    shadowGenerator.setDarkness(0.26);

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
    scene.imageProcessingConfiguration.exposure = 1.05;
    scene.imageProcessingConfiguration.contrast = 1.04;
  }

  private optimizeStaticMuseum(scene: Scene): void {
    const materials = new Set<Material>();

    scene.skipPointerMovePicking = false;
    scene.meshes.forEach((mesh) => {
      if (mesh.material && !mesh.metadata?.dynamic) {
        materials.add(mesh.material);
      }

      if (!mesh.metadata?.dynamic) {
        mesh.freezeWorldMatrix();
      }
    });
    materials.forEach((material) => {
      material.freeze();
    });
  }

  private showExplorationPanel(): void {
    this.removeExplorationPanel();
    this.explorationHud = new ExplorationHud({
      theme: "museum",
      onExplore: () => {
        this.startMuseumAudio();
        this.cameraManager?.enablePointerLock();
      },
      onRelease: () => this.cameraManager?.disablePointerLock(),
      onStart: () => {
        this.guide?.open();
      },
      onSound: () => this.toggleMuseumAudio(),
      onMenu: this.onReturnToMenu,
      onQuality: quality => {
        saveExplorationQuality(quality); this.guide?.setQuality(quality);
        if (this.scene && !this.evaluationStarted) {
          this.explorationVisuals?.dispose();
          this.explorationVisuals = new ExplorationVisuals(this.scene, 'museum', quality);
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
    const cameraManager = this.cameraManager;
    const scene = this.scene;

    if (this.evaluationStarted || !cameraManager || !scene) {
      return;
    }

    this.evaluationStarted = true;
    this.guide?.dispose(); this.guide = null;
    this.explorationVisuals?.dispose(); this.explorationVisuals = null;
    this.setExplorationPanelBusy();
    cameraManager.disablePointerLock();
    this.hideEvaluationObstructions();
    await this.charactersReadyPromise;
    if (this.scene !== scene || scene.isDisposed) return;
    this.museumCharacterManager?.setMode("evaluation");
    await cameraManager.enterEvaluationMode();
    if (this.scene !== scene || scene.isDisposed) return;
    this.validateEvaluationSightline();
    this.removeExplorationPanel();
    this.startVisualDiscriminationActivity();
  }

  private hideEvaluationObstructions(): void {
    this.evaluationHiddenMeshes.forEach((mesh) => {
      mesh.checkCollisions = false;
      mesh.setEnabled(false);
    });
  }

  private validateEvaluationSightline(): void {
    const scene = this.scene;
    const activityPanelMesh = this.activityPanelMesh;
    const evaluationEyePosition = this.evaluationEyePosition;
    const evaluationLookAt = this.evaluationLookAt;

    if (!scene || !activityPanelMesh || !evaluationEyePosition || !evaluationLookAt) {
      return;
    }

    const direction = evaluationLookAt.subtract(evaluationEyePosition);
    const distance = direction.length();

    if (distance <= 0.01) {
      return;
    }

    const ray = new Ray(
      evaluationEyePosition,
      direction.normalize(),
      Math.max(0.1, distance - 0.08)
    );
    const blockers = scene.meshes.filter((mesh) => {
      if (!this.shouldCheckEvaluationSightline(mesh, activityPanelMesh)) {
        return false;
      }

      const bounds = mesh.getBoundingInfo().boundingBox;

      return ray.intersectsBoxMinMax(bounds.minimumWorld, bounds.maximumWorld);
    });

    if (blockers.length > 0) {
      console.warn(
        "[VisualDiscriminationScene] Obstrucciones detectadas frente al panel:",
        blockers.map((mesh) => mesh.name)
      );
      return;
    }

    console.info("[VisualDiscriminationScene] Panel visible: linea visual despejada.");
  }

  private shouldCheckEvaluationSightline(mesh: AbstractMesh, activityPanelMesh: Mesh): boolean {
    if (
      mesh === activityPanelMesh ||
      !mesh.isEnabled() ||
      !mesh.isVisible ||
      mesh.name.startsWith("visualDiscrimination") ||
      mesh.name.startsWith("activityZoneHeader") ||
      mesh.name.startsWith("museumFloor") ||
      mesh.name.startsWith("museumCeiling")
    ) {
      return false;
    }

    return !mesh.metadata?.ignoreSightline;
  }

  private setExplorationPanelBusy(): void {
    this.explorationHud?.setBusy();
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
    this.startMuseumAudio();

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

  private startMuseumAudio(): void {
    if (this.guide?.isOpen) return;
    if (!this.museumAudioEnabled) {
      return;
    }

    this.audioManager?.setEnabled(true);
    this.audioManager?.startAmbientAudio();
    this.updateAudioToggleUi();
  }

  private toggleMuseumAudio(): void {
    this.museumAudioEnabled = !this.museumAudioEnabled;
    saveExplorationSoundEnabled(this.museumAudioEnabled);
    this.audioManager?.setEnabled(this.museumAudioEnabled);

    if (this.museumAudioEnabled) {
      this.audioManager?.startAmbientAudio();
    }

    this.updateAudioToggleUi();
  }

  private updateAudioToggleUi(): void {
    this.explorationHud?.setSoundEnabled(this.museumAudioEnabled);
  }
}
