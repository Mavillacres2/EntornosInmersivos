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
  private explorationPanel: HTMLElement | null = null;
  private startActivityButton: HTMLButtonElement | null = null;
  private activatePointerLockButton: HTMLButtonElement | null = null;
  private releasePointerLockButton: HTMLButtonElement | null = null;
  private audioToggleButton: HTMLButtonElement | null = null;
  private pointerLockStatus: HTMLParagraphElement | null = null;
  private evaluationHiddenMeshes: Mesh[] = [];
  private activityPanelMesh: Mesh | null = null;
  private evaluationEyePosition: Vector3 | null = null;
  private evaluationLookAt: Vector3 | null = null;
  private charactersReadyPromise: Promise<void> | null = null;
  private unsubscribePointerLock: (() => void) | null = null;
  private museumAudioEnabled = true;
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
    const shadowGenerator = this.configureShadows(
      museumLayout.shadowLight,
      museumLayout.shadowCasters
    );

    this.configureImageProcessing(scene);
    this.optimizeStaticMuseum(scene);
    this.audioManager = new AudioManager();
    void this.audioManager.initialize(scene);
    this.museumCharacterManager = new MuseumCharacterManager(scene);
    this.charactersReadyPromise = this.museumCharacterManager.initialize().catch((error: unknown) => {
      console.warn("No se pudieron cargar todos los visitantes del museo.", error);
    });
    this.cameraManager = new CameraManager({
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
    this.showExplorationPanel();
    this.scene = scene;

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
    const shadowGenerator = new ShadowGenerator(512, light);

    shadowGenerator.useExponentialShadowMap = true;
    shadowGenerator.blurKernel = 8;
    shadowGenerator.bias = 0.0005;
    shadowGenerator.normalBias = 0.02;
    shadowGenerator.setDarkness(0.26);

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

    const panel = document.createElement("section");
    panel.id = "explorationPanel";
    panel.setAttribute("aria-live", "polite");

    const title = document.createElement("h1");
    title.textContent = "Explora el museo";

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
      this.startMuseumAudio();
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
      this.toggleMuseumAudio();
    });

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Comenzar actividad";
    button.addEventListener("click", () => {
      this.startMuseumAudio();
      void this.beginEvaluationFlow();
    });

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "secondaryButton";
    menuButton.textContent = "Volver al menu";
    menuButton.addEventListener("click", () => {
      this.onReturnToMenu();
    });

    panel.append(
      title,
      movement,
      pointerLockStatus,
      pointerLockActions,
      prompt,
      audioToggleButton,
      button,
      menuButton
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
    this.hideEvaluationObstructions();
    await this.charactersReadyPromise;
    this.museumCharacterManager?.setMode("evaluation");
    await cameraManager.enterEvaluationMode();
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
    if (this.pointerLockStatus) {
      this.pointerLockStatus.textContent = locked
        ? "Vista juego activa. Mueve el mouse para observar. Esc o Q libera el mouse."
        : "Mouse libre. Haz clic en el museo o usa el boton para activar vista juego.";
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

  private startMuseumAudio(): void {
    if (!this.museumAudioEnabled) {
      return;
    }

    this.audioManager?.setEnabled(true);
    this.audioManager?.startAmbientAudio();
    this.updateAudioToggleUi();
  }

  private toggleMuseumAudio(): void {
    this.museumAudioEnabled = !this.museumAudioEnabled;
    this.audioManager?.setEnabled(this.museumAudioEnabled);

    if (this.museumAudioEnabled) {
      this.audioManager?.startAmbientAudio();
    }

    this.updateAudioToggleUi();
  }

  private updateAudioToggleUi(): void {
    if (!this.audioToggleButton) {
      return;
    }

    this.audioToggleButton.textContent = this.museumAudioEnabled
      ? "Audio: ON"
      : "Audio: OFF";
  }
}
