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

  private scene: Scene | null = null;
  private stimulusAnchor: TransformNode | null = null;
  private activity: GoNoGoActivity | null = null;
  private audioManager: AudioManager | null = null;
  private characterManager: CharacterManager | null = null;
  private ambientBehaviorManager: AmbientBehaviorManager | null = null;
  private charactersReadyPromise: Promise<void> | null = null;
  private cameraManager: CameraManager | null = null;
  private explorationPanel: HTMLElement | null = null;
  private startActivityButton: HTMLButtonElement | null = null;
  private activatePointerLockButton: HTMLButtonElement | null = null;
  private releasePointerLockButton: HTMLButtonElement | null = null;
  private audioToggleButton: HTMLButtonElement | null = null;
  private pointerLockStatus: HTMLParagraphElement | null = null;
  private unsubscribePointerLock: (() => void) | null = null;
  private evaluationHiddenMeshes: Mesh[] = [];
  private evaluationStarted = false;
  private explorationAudioEnabled = true;
  private readonly handleExplorationPointerDownBound = (): void => {
    this.startExplorationAudio();
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
    scene.clearColor = new Color4(0.92, 0.91, 0.84, 1);

    const classroomBuilder = new ClassroomBuilder(scene);
    const classroomLayout = classroomBuilder.build();
    this.evaluationHiddenMeshes = classroomLayout.evaluationHiddenMeshes;

    const shadowLight = this.configureLighting(scene);
    const shadowGenerator = this.configureShadows(
      shadowLight,
      classroomLayout.shadowCasters
    );
    this.configureImageProcessing(scene);
    this.optimizeStaticClassroom(scene);

    this.stimulusAnchor = this.createStimulusAnchor(
      scene,
      classroomLayout.stimulusAnchorPosition
    );
    this.audioManager = new AudioManager();
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

    this.showExplorationPanel();

    this.scene = scene;
    return scene;
  }

  dispose(): void {
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
    ambientLight.groundColor = new Color3(0.36, 0.34, 0.3);

    const windowLight = new DirectionalLight(
      "windowLight",
      new Vector3(0.68, -0.92, 0.28),
      scene
    );

    windowLight.position = new Vector3(-7.5, 5.2, -3.2);
    windowLight.intensity = 0.9;

    return windowLight;
  }

  private configureShadows(
    light: DirectionalLight,
    shadowCasters: Mesh[]
  ): ShadowGenerator {
    const shadowGenerator = new ShadowGenerator(512, light);

    shadowGenerator.useExponentialShadowMap = true;
    shadowGenerator.blurKernel = 8;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.02;
    shadowGenerator.setDarkness(0.36);

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

    const panel = document.createElement("section");
    panel.id = "explorationPanel";
    panel.setAttribute("aria-live", "polite");

    const title = document.createElement("h1");
    title.textContent = "Explora el aula";

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
      this.startExplorationAudio();
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
    prompt.textContent = "Cuando estes listo, comienza la actividad.";

    const audioToggleButton = document.createElement("button");
    audioToggleButton.type = "button";
    audioToggleButton.className = "secondaryButton";
    audioToggleButton.addEventListener("click", () => {
      this.toggleExplorationAudio();
    });

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Comenzar actividad";
    button.addEventListener("click", () => {
      this.startExplorationAudio();
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
    this.setExplorationPanelBusy();
    cameraManager.disablePointerLock();
    this.ambientBehaviorManager?.stop();
    this.hideEvaluationObstructions();

    await this.charactersReadyPromise;
    this.characterManager?.setMode("evaluation");
    await cameraManager.enterEvaluationMode();

    this.removeExplorationPanel();
    this.startGoNoGoInstructions(scene, stimulusAnchor);
  }

  private setExplorationPanelBusy(): void {
    if (!this.startActivityButton) {
      return;
    }

    this.startActivityButton.disabled = true;
    this.startActivityButton.textContent = "Preparando actividad...";
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
      }
    });

    this.activity = new GoNoGoActivity({
      scene,
      stimulusAnchor,
      metricsManager,
      distractorManager,
      config: DEFAULT_GO_NO_GO_SESSION_CONFIG
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
        : "Mouse libre. Haz clic en el aula o usa el boton para activar vista juego.";
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

  private startExplorationAudio(): void {
    if (!this.explorationAudioEnabled) {
      return;
    }

    this.audioManager?.setEnabled(true);
    this.audioManager?.startAmbientAudio();
    this.updateAudioToggleUi();
  }

  private toggleExplorationAudio(): void {
    this.explorationAudioEnabled = !this.explorationAudioEnabled;
    this.audioManager?.setEnabled(this.explorationAudioEnabled);

    if (this.explorationAudioEnabled) {
      this.audioManager?.startAmbientAudio();
    }

    this.updateAudioToggleUi();
  }

  private updateAudioToggleUi(): void {
    if (!this.audioToggleButton) {
      return;
    }

    this.audioToggleButton.textContent = this.explorationAudioEnabled
      ? "Audio: ON"
      : "Audio: OFF";
  }
}
