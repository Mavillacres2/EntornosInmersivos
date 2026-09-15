import {
  Color4,
  RenderTargetTexture,
  Scene,
  ShadowGenerator
} from "@babylonjs/core";
import type { DirectionalLight, Engine, Material, Mesh } from "@babylonjs/core";

import { CPTActivity } from "../activities/CPTActivity";
import { DEFAULT_CPT_SESSION_CONFIG } from "../activities/CPTTypes";
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
    volume: 0.56
  }
];

export class SpaceStationScene {
  private readonly engine: Engine;
  private readonly canvas: HTMLCanvasElement;

  private scene: Scene | null = null;
  private activity: CPTActivity | null = null;
  private audioManager: AudioManager | null = null;
  private cameraManager: CameraManager | null = null;
  private spaceCharacterManager: SpaceCharacterManager | null = null;
  private spaceAmbientManager: SpaceAmbientManager | null = null;
  private explorationPanel: HTMLElement | null = null;
  private startActivityButton: HTMLButtonElement | null = null;
  private activatePointerLockButton: HTMLButtonElement | null = null;
  private releasePointerLockButton: HTMLButtonElement | null = null;
  private audioToggleButton: HTMLButtonElement | null = null;
  private pointerLockStatus: HTMLParagraphElement | null = null;
  private unsubscribePointerLock: (() => void) | null = null;
  private stationAudioEnabled = true;
  private evaluationStarted = false;
  private readonly handleExplorationPointerDownBound = (): void => {
    this.startStationAudio();
  };
  private readonly handleExplorationKeyDownBound = (event: KeyboardEvent): void => {
    this.handleExplorationKeyDown(event);
  };

  constructor(engine: Engine, canvas: HTMLCanvasElement) {
    this.engine = engine;
    this.canvas = canvas;
  }

  create(): Scene {
    const scene = new Scene(this.engine);

    scene.clearColor = new Color4(0.78, 0.84, 0.84, 1);

    const stationBuilder = new SpaceStationBuilder(scene);
    const stationLayout = stationBuilder.build();
    const shadowGenerator = this.configureShadows(
      stationLayout.shadowLight,
      stationLayout.shadowCasters
    );

    this.configureImageProcessing(scene);
    this.optimizeStaticStation(scene);
    this.spaceAmbientManager = new SpaceAmbientManager(
      scene,
      stationLayout.ambientElements
    );
    this.spaceAmbientManager.start();
    this.audioManager = new AudioManager();
    void this.audioManager.initialize(scene);
    this.spaceCharacterManager = new SpaceCharacterManager(scene);
    void this.spaceCharacterManager.initialize().catch((error: unknown) => {
      console.warn("No se pudieron inicializar personajes espaciales.", error);
    });
    this.cameraManager = new CameraManager({
      scene,
      canvas: this.canvas,
      explorationPosition: stationLayout.explorationEyePosition,
      explorationTarget: stationLayout.explorationLookAt,
      evaluationPosition: stationLayout.evaluationEyePosition,
      evaluationTarget: stationLayout.evaluationLookAt,
      collisionMeshes: stationLayout.collisionMeshes,
      bounds: stationLayout.cameraBounds
    });
    this.cameraManager.enterExplorationMode();
    this.showExplorationPanel();
    this.scene = scene;

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
        }
      });

      this.activity = new CPTActivity({
        scene,
        cptScreenMesh: stationLayout.cptScreenMesh,
        metricsManager,
        distractorManager,
        config: DEFAULT_CPT_SESSION_CONFIG
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
    this.scene = null;
  }

  private startCPTActivity: () => void = () => {};

  private configureShadows(
    light: DirectionalLight,
    shadowCasters: Mesh[]
  ): ShadowGenerator {
    const shadowGenerator = new ShadowGenerator(512, light);

    shadowGenerator.useExponentialShadowMap = true;
    shadowGenerator.blurKernel = 8;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.02;
    shadowGenerator.setDarkness(0.28);

    shadowCasters.forEach((mesh) => {
      shadowGenerator.addShadowCaster(mesh);
    });

    const shadowMap = shadowGenerator.getShadowMap();

    if (shadowMap) {
      shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
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

    const panel = document.createElement("section");
    panel.id = "explorationPanel";
    panel.setAttribute("aria-live", "polite");

    const title = document.createElement("h1");
    title.textContent = "Explora la estacion";

    const movement = document.createElement("p");
    movement.textContent = "W/A/S/D para caminar. Activa vista juego para mirar con el mouse.";

    const pointerLockStatus = document.createElement("p");
    pointerLockStatus.className = "pointerLockStatus";

    const pointerLockActions = document.createElement("div");
    pointerLockActions.className = "explorationActions";

    const activatePointerLockButton = document.createElement("button");
    activatePointerLockButton.type = "button";
    activatePointerLockButton.className = "secondaryButton";
    activatePointerLockButton.textContent = "Activar vista juego";
    activatePointerLockButton.addEventListener("click", () => {
      this.startStationAudio();
      this.cameraManager?.enablePointerLock();
    });

    const releasePointerLockButton = document.createElement("button");
    releasePointerLockButton.type = "button";
    releasePointerLockButton.className = "secondaryButton";
    releasePointerLockButton.textContent = "Liberar mouse";
    releasePointerLockButton.addEventListener("click", () => {
      this.cameraManager?.disablePointerLock();
    });

    pointerLockActions.append(activatePointerLockButton, releasePointerLockButton);

    const prompt = document.createElement("p");
    prompt.textContent = "Cuando estes listo, comienza el CPT.";

    const audioToggleButton = document.createElement("button");
    audioToggleButton.type = "button";
    audioToggleButton.className = "secondaryButton";
    audioToggleButton.addEventListener("click", () => {
      this.toggleStationAudio();
    });

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Comenzar actividad";
    button.addEventListener("click", () => {
      this.startStationAudio();
      void this.beginEvaluationFlow();
    });

    panel.append(
      title,
      movement,
      pointerLockStatus,
      pointerLockActions,
      prompt,
      audioToggleButton,
      button
    );
    document.body.appendChild(panel);

    this.explorationPanel = panel;
    this.startActivityButton = button;
    this.activatePointerLockButton = activatePointerLockButton;
    this.releasePointerLockButton = releasePointerLockButton;
    this.audioToggleButton = audioToggleButton;
    this.pointerLockStatus = pointerLockStatus;
    this.unsubscribePointerLock = this.cameraManager?.onPointerLockChange((locked) => {
      this.updatePointerLockUi(locked);
    }) ?? null;
    this.canvas.addEventListener("pointerdown", this.handleExplorationPointerDownBound);
    document.addEventListener("keydown", this.handleExplorationKeyDownBound);
    this.updatePointerLockUi(this.cameraManager?.isPointerLocked() ?? false);
    this.updateAudioToggleUi();
  }

  private async beginEvaluationFlow(): Promise<void> {
    const cameraManager = this.cameraManager;

    if (this.evaluationStarted || !cameraManager) {
      return;
    }

    this.evaluationStarted = true;
    this.setExplorationPanelBusy();
    cameraManager.disablePointerLock();
    this.spaceAmbientManager?.setMode("evaluation");
    this.spaceAmbientManager?.setCondition("baseline");
    await cameraManager.enterEvaluationMode();
    this.removeExplorationPanel();
    this.startCPTActivity();
  }

  private setExplorationPanelBusy(): void {
    if (!this.startActivityButton) {
      return;
    }

    this.startActivityButton.disabled = true;
    this.startActivityButton.textContent = "Preparando CPT...";

    if (this.activatePointerLockButton) {
      this.activatePointerLockButton.disabled = true;
    }

    if (this.releasePointerLockButton) {
      this.releasePointerLockButton.disabled = true;
    }

    if (this.audioToggleButton) {
      this.audioToggleButton.disabled = true;
    }
  }

  private removeExplorationPanel(): void {
    this.unsubscribePointerLock?.();
    this.unsubscribePointerLock = null;
    this.canvas.removeEventListener(
      "pointerdown",
      this.handleExplorationPointerDownBound
    );
    document.removeEventListener("keydown", this.handleExplorationKeyDownBound);
    this.explorationPanel?.remove();
    this.explorationPanel = null;
    this.startActivityButton = null;
    this.activatePointerLockButton = null;
    this.releasePointerLockButton = null;
    this.audioToggleButton = null;
    this.pointerLockStatus = null;
  }

  private handleExplorationKeyDown(event: KeyboardEvent): void {
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
    if (this.pointerLockStatus) {
      this.pointerLockStatus.textContent = locked
        ? "Vista juego activa. Mueve el mouse para observar. Esc o Q libera el mouse."
        : "Mouse libre. Haz clic en la estacion o usa el boton para activar vista juego.";
    }

    if (this.activatePointerLockButton) {
      this.activatePointerLockButton.disabled = locked || this.evaluationStarted;
      this.activatePointerLockButton.textContent = locked
        ? "Vista juego activa"
        : "Activar vista juego";
    }

    if (this.releasePointerLockButton) {
      this.releasePointerLockButton.disabled = !locked || this.evaluationStarted;
      this.releasePointerLockButton.textContent = locked ? "Liberar mouse (Q)" : "Mouse libre";
    }
  }

  private startStationAudio(): void {
    if (!this.stationAudioEnabled) {
      return;
    }

    this.audioManager?.setEnabled(true);
    this.audioManager?.startAmbientAudio(SPACE_AMBIENT_LAYERS);
    this.updateAudioToggleUi();
  }

  private toggleStationAudio(): void {
    this.stationAudioEnabled = !this.stationAudioEnabled;
    this.audioManager?.setEnabled(this.stationAudioEnabled);

    if (this.stationAudioEnabled) {
      this.audioManager?.startAmbientAudio(SPACE_AMBIENT_LAYERS);
    }

    this.updateAudioToggleUi();
  }

  private updateAudioToggleUi(): void {
    if (!this.audioToggleButton) {
      return;
    }

    this.audioToggleButton.textContent = this.stationAudioEnabled
      ? "Audio: ON"
      : "Audio: OFF";
  }
}
