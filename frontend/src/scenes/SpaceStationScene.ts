import { getExplorationSoundEnabled, saveExplorationSoundEnabled } from "../ui/ExplorationPreferences";
import { VirtualGuideManager } from '../guides/VirtualGuideManager';
import { ExplorationVisuals } from '../environment/ExplorationVisuals';
import { getExplorationQuality, saveExplorationQuality } from '../ui/ExplorationQuality';
import { createExplorationAccents } from "../environment/ExplorationAccents";
import { ExplorationHud } from "../ui/ExplorationHud";
import { configureSceneAntialiasing } from "./SceneVisuals";
import {
  Color4,
  RenderTargetTexture,
  Scene,
  ShadowGenerator
} from "@babylonjs/core";
import type { DirectionalLight, Engine, Material, Mesh } from "@babylonjs/core";

import { CPTActivity } from "../activities/CPTActivity";
import { DEFAULT_CPT_SESSION_CONFIG } from "../activities/CPTTypes";
import type { ActivityTelemetrySink } from "../analysis/synchronization/ActivityContextAdapter";
import { SpaceAmbientManager } from "../ambient/SpaceAmbientManager";
import { AUDIO_ASSETS } from "../audio/AudioConfig";
import { AudioManager } from "../audio/AudioManager";
import type { AmbientSoundLayer } from "../audio/AudioManager";
import { CameraManager } from "../camera/CameraManager";
import { SpaceCharacterManager } from "../characters/SpaceCharacterManager";
import { CPTDistractorManager } from "../distractors/CPTDistractorManager";
import { SpaceStationBuilder } from "../environment/SpaceStationBuilder";
import { CPTMetricsManager } from "../metrics/CPTMetricsManager";

const SPACE_AMBIENT_LAYERS: AmbientSoundLayer[] = [
  {
    id: "stationHum",
    assetPath: AUDIO_ASSETS.space.ambient.stationHum,
    volume: 1
  }
];

export class SpaceStationScene {
  private readonly engine: Engine;
  private readonly canvas: HTMLCanvasElement;
  private readonly onReturnToMenu: () => void;
  private readonly telemetry: ActivityTelemetrySink | null;

  private scene: Scene | null = null;
  private activity: CPTActivity | null = null;
  private audioManager: AudioManager | null = null;
  private cameraManager: CameraManager | null = null;
  private spaceCharacterManager: SpaceCharacterManager | null = null;
  private spaceAmbientManager: SpaceAmbientManager | null = null;
  private explorationHud: ExplorationHud | null = null;
  private guide: VirtualGuideManager | null = null;
  private explorationVisuals: ExplorationVisuals | null = null;
  private evaluationHiddenMeshes: Mesh[] = [];
  private unsubscribePointerLock: (() => void) | null = null;
  private stationAudioEnabled = getExplorationSoundEnabled();
  private evaluationStarted = false;
  private readonly handleExplorationPointerDownBound = (): void => {
    this.startStationAudio();
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

    scene.clearColor = new Color4(0.78, 0.84, 0.84, 1);

    const stationBuilder = new SpaceStationBuilder(scene);
    const stationLayout = stationBuilder.build();
    stationLayout.evaluationHiddenMeshes.push(...createExplorationAccents(scene, "space"));
    const shadowGenerator = this.configureShadows(
      stationLayout.shadowLight,
      stationLayout.shadowCasters
    );

    this.configureImageProcessing(scene);
    this.explorationVisuals = new ExplorationVisuals(scene, 'space', getExplorationQuality());
    this.optimizeStaticStation(scene);
    this.spaceAmbientManager = new SpaceAmbientManager(
      scene,
      stationLayout.ambientElements
    );
    this.spaceAmbientManager.start();
    this.audioManager = new AudioManager();
    this.audioManager.setEnabled(this.stationAudioEnabled);
    void this.audioManager.initialize(scene);
    this.spaceCharacterManager = new SpaceCharacterManager(scene);
    void this.spaceCharacterManager.initialize().catch((error: unknown) => {
      console.warn("No se pudieron inicializar personajes espaciales.", error);
    });
    this.cameraManager = new CameraManager({
      onPointerLockError: () => this.explorationHud?.showLookUnavailable(),
      scene,
      canvas: this.canvas,
      explorationPosition: stationLayout.explorationEyePosition,
      explorationTarget: stationLayout.explorationLookAt,
      evaluationPosition: stationLayout.evaluationEyePosition,
      evaluationTarget: stationLayout.evaluationLookAt,
      collisionMeshes: stationLayout.collisionMeshes,
      bounds: stationLayout.cameraBounds,
      evaluationFov: 0.62,
      evaluationYawLimit: Math.PI / 12,
      evaluationPitchLimit: 0.24
    });
    this.evaluationHiddenMeshes = stationLayout.evaluationHiddenMeshes;
    this.cameraManager.enterExplorationMode();
    configureSceneAntialiasing(scene);
    this.showExplorationPanel();
    this.scene = scene;
    this.guide = new VirtualGuideManager(scene, {
      theme: 'space', quality: getExplorationQuality(),
      beforeOpen: () => { this.cameraManager?.disablePointerLock(); this.audioManager?.stopAmbientAudio(); },
      onClose: () => {}, onMenu: this.onReturnToMenu,
      onComplete: () => { this.startStationAudio(); void this.beginEvaluationFlow(); }
    });

    this.startCPTActivity = () => {
      this.spaceCharacterManager?.lookAtActivityParticipant(
        stationLayout.evaluationEyePosition
      );

      const metricsManager = new CPTMetricsManager();
      const distractorManager = new CPTDistractorManager(scene, {
        anchors: stationLayout.distractorAnchors,
        audioManager: this.audioManager ?? undefined,
        visualEffects: this.spaceAmbientManager ?? undefined,
        onDistractorEvent: (event) => {
          console.log("Evento distractor CPT:", event);
          this.telemetry?.onDistractor({
            distractorId: event.distractorId,
            distractorType: event.type,
            startedAt: event.startedAt,
            endedAt: event.endedAt
          });
        }
      });

      this.activity = new CPTActivity({
        scene,
        cptScreenMesh: stationLayout.cptScreenMesh,
        metricsManager,
        distractorManager,
        config: DEFAULT_CPT_SESSION_CONFIG,
        telemetry: this.telemetry ?? undefined
      });
      this.activity.showInstructions();
    };

    if (shadowGenerator.getShadowMap()) {
      stationLayout.shadowReceivers.forEach((mesh) => {
        mesh.receiveShadows = true;
      });
    }

    return scene;
  }

  dispose(): void {
    this.guide?.dispose(); this.guide = null;
    this.explorationVisuals?.dispose(); this.explorationVisuals = null;
    this.removeExplorationPanel();
    this.activity?.dispose();
    this.spaceAmbientManager?.dispose();
    this.spaceCharacterManager?.dispose();
    this.audioManager?.dispose();
    this.cameraManager?.dispose();
    this.scene?.dispose();

    this.activity = null;
    this.spaceAmbientManager = null;
    this.spaceCharacterManager = null;
    this.audioManager = null;
    this.cameraManager = null;
    this.evaluationHiddenMeshes = [];
    this.scene = null;
  }

  private startCPTActivity: () => void = () => {};

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
    shadowGenerator.setDarkness(0.28);

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
    scene.imageProcessingConfiguration.exposure = 1.08;
    scene.imageProcessingConfiguration.contrast = 1.02;
  }

  private optimizeStaticStation(scene: Scene): void {
    const materials = new Set<Material>();

    scene.skipPointerMovePicking = true;

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
      theme: "space",
      onExplore: () => {
        this.startStationAudio();
        this.cameraManager?.enablePointerLock();
      },
      onRelease: () => this.cameraManager?.disablePointerLock(),
      onStart: () => {
        this.guide?.open();
      },
      onSound: () => this.toggleStationAudio(),
      onMenu: this.onReturnToMenu,
      onQuality: quality => {
        saveExplorationQuality(quality); this.guide?.setQuality(quality);
        if (this.scene && !this.evaluationStarted) {
          this.explorationVisuals?.dispose();
          this.explorationVisuals = new ExplorationVisuals(this.scene, 'space', quality);
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
    this.spaceAmbientManager?.setMode("evaluation");
    this.spaceAmbientManager?.setCondition("baseline");
    this.hideEvaluationObstructions();
    await cameraManager.enterEvaluationMode();
    if (this.scene !== scene || scene.isDisposed) return;
    this.removeExplorationPanel();
    this.startCPTActivity();
  }

  private hideEvaluationObstructions(): void {
    this.evaluationHiddenMeshes.forEach((mesh) => {
      mesh.checkCollisions = false;
      mesh.setEnabled(false);
    });
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
    this.startStationAudio();

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

  private startStationAudio(): void {
    if (this.guide?.isOpen) return;
    if (!this.stationAudioEnabled) {
      return;
    }

    this.audioManager?.setEnabled(true);
    this.audioManager?.startAmbientAudio(SPACE_AMBIENT_LAYERS);
    this.updateAudioToggleUi();
  }

  private toggleStationAudio(): void {
    this.stationAudioEnabled = !this.stationAudioEnabled;
    saveExplorationSoundEnabled(this.stationAudioEnabled);
    this.audioManager?.setEnabled(this.stationAudioEnabled);

    if (this.stationAudioEnabled) {
      this.audioManager?.startAmbientAudio(SPACE_AMBIENT_LAYERS);
    }

    this.updateAudioToggleUi();
  }

  private updateAudioToggleUi(): void {
    this.explorationHud?.setSoundEnabled(this.stationAudioEnabled);
  }
}
