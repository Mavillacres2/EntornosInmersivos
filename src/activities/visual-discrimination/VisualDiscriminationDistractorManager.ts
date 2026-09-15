import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Observer, Scene, TransformNode } from "@babylonjs/core";

import type { AudioManager } from "../../audio/AudioManager";
import type {
  BlockType,
  DistractorTrialEvent,
  ScheduledTrial
} from "./VisualDiscriminationTypes";

export interface MuseumDistractorAnchors {
  leftExhibitAnchor: TransformNode;
  rightExhibitAnchor: TransformNode;
  backVisitorAnchor: TransformNode;
  robotPathAnchor: TransformNode;
}

interface VisualDiscriminationDistractorOptions {
  anchors: MuseumDistractorAnchors;
  audioManager?: AudioManager;
}

interface ActiveVisual {
  id: string;
  mesh: Mesh;
  material: StandardMaterial;
  startedAt: number;
  durationMs: number;
  startPosition: Vector3;
  endPosition: Vector3;
}

export class VisualDiscriminationDistractorManager {
  private readonly scene: Scene;
  private readonly anchors: MuseumDistractorAnchors;
  private readonly audioManager: AudioManager | null;
  private readonly activeVisuals: ActiveVisual[] = [];
  private visualObserver: Observer<Scene> | null = null;
  private onsetTimeoutId: number | null = null;
  private activeEvent: DistractorTrialEvent | null = null;

  constructor(scene: Scene, options: VisualDiscriminationDistractorOptions) {
    this.scene = scene;
    this.anchors = options.anchors;
    this.audioManager = options.audioManager ?? null;
  }

  prepareAudio(): void {
    this.audioManager?.unlock();
  }

  playResponseCue(): void {
    this.audioManager?.playResponseCue("pointer");
  }

  scheduleForTrial(
    trial: ScheduledTrial,
    stimulusOnsetMs: number
  ): DistractorTrialEvent {
    this.cancelTrialDistractor();

    if (
      trial.blockType === "none" ||
      !trial.shouldTriggerDistractor ||
      trial.plannedDistractorOnsetMs === null
    ) {
      this.activeEvent = {
        distractorActive: false,
        distractorType: "none",
        distractorId: null,
        plannedOnsetOffsetMs: null,
        actualOnsetOffsetMs: null,
        durationMs: null
      };
      return this.activeEvent;
    }

    this.activeEvent = {
      distractorActive: true,
      distractorType: trial.blockType,
      distractorId: null,
      plannedOnsetOffsetMs: trial.plannedDistractorOnsetMs,
      actualOnsetOffsetMs: null,
      durationMs: null
    };
    this.onsetTimeoutId = window.setTimeout(() => {
      this.onsetTimeoutId = null;
      if (trial.blockType !== "none") {
        this.triggerDistractor(trial.blockType, stimulusOnsetMs);
      }
    }, trial.plannedDistractorOnsetMs);

    return this.activeEvent;
  }

  getActiveEvent(): DistractorTrialEvent {
    return this.activeEvent
      ? { ...this.activeEvent }
      : {
          distractorActive: false,
          distractorType: "none",
          distractorId: null,
          plannedOnsetOffsetMs: null,
          actualOnsetOffsetMs: null,
          durationMs: null
        };
  }

  cancelTrialDistractor(): void {
    this.clearOnsetTimeout();
    this.clearVisuals();
    this.activeEvent = null;
  }

  disableAll(): void {
    this.cancelTrialDistractor();
  }

  dispose(): void {
    this.disableAll();

    if (this.visualObserver) {
      this.scene.onBeforeRenderObservable.remove(this.visualObserver);
      this.visualObserver = null;
    }
  }

  private triggerDistractor(blockType: Exclude<BlockType, "none">, stimulusOnsetMs: number): void {
    if (!this.activeEvent) {
      return;
    }

    const actualOnset = performance.now() - stimulusOnsetMs;

    if (blockType === "visual") {
      this.triggerVisual("sideScreenGlow", actualOnset, 900);
      return;
    }

    if (blockType === "auditory") {
      this.triggerAuditory("distantConversation", actualOnset, 850);
      return;
    }

    this.triggerCombined("softRobotPass", actualOnset, 1200);
  }

  private triggerVisual(
    id: string,
    actualOnsetOffsetMs: number,
    durationMs: number
  ): void {
    const anchor = this.anchors.leftExhibitAnchor;

    this.spawnMovingCue(
      id,
      anchor.position.add(new Vector3(-0.9, 0.15, 0)),
      anchor.position.add(new Vector3(0.9, 0.15, 0)),
      new Color3(0.28, 0.66, 0.72),
      durationMs,
      0.24
    );
    this.updateActiveEvent(id, actualOnsetOffsetMs, durationMs);
  }

  private triggerAuditory(
    id: string,
    actualOnsetOffsetMs: number,
    durationMs: number
  ): void {
    this.audioManager?.playSpatialSound({
      id,
      position: this.anchors.backVisitorAnchor.position,
      durationMs,
      volume: 0.55
    });
    this.updateActiveEvent(id, actualOnsetOffsetMs, durationMs);
  }

  private triggerCombined(
    id: string,
    actualOnsetOffsetMs: number,
    durationMs: number
  ): void {
    const start = this.anchors.robotPathAnchor.position.add(new Vector3(-1.2, 0, 0));
    const end = this.anchors.robotPathAnchor.position.add(new Vector3(1.2, 0, 0));

    this.spawnMovingCue(
      id,
      start,
      end,
      new Color3(0.62, 0.68, 0.58),
      durationMs,
      0.3
    );
    this.audioManager?.playSpatialSound({
      id: "robotMotor",
      position: this.anchors.robotPathAnchor.position,
      durationMs,
      volume: 0.5
    });
    this.updateActiveEvent(id, actualOnsetOffsetMs, durationMs);
  }

  private spawnMovingCue(
    id: string,
    startPosition: Vector3,
    endPosition: Vector3,
    color: Color3,
    durationMs: number,
    scale: number
  ): void {
    const material = new StandardMaterial(`${id}MuseumDistractorMaterial`, this.scene);
    const mesh = MeshBuilder.CreateSphere(
      `${id}MuseumDistractor`,
      {
        diameter: 1,
        segments: 16
      },
      this.scene
    );

    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.25);
    material.specularColor = new Color3(0.05, 0.06, 0.06);
    material.alpha = 0.88;
    mesh.position.copyFrom(startPosition);
    mesh.scaling.setAll(scale);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.metadata = {
      dynamic: true,
      role: "visual-discrimination-distractor"
    };
    this.activeVisuals.push({
      id,
      mesh,
      material,
      startedAt: performance.now(),
      durationMs,
      startPosition,
      endPosition
    });
    this.ensureVisualObserver();
  }

  private ensureVisualObserver(): void {
    if (this.visualObserver) {
      return;
    }

    this.visualObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.updateVisuals();
    });
  }

  private updateVisuals(): void {
    const now = performance.now();

    for (let index = this.activeVisuals.length - 1; index >= 0; index -= 1) {
      const visual = this.activeVisuals[index];
      const progress = Math.min(1, (now - visual.startedAt) / visual.durationMs);

      if (progress >= 1) {
        visual.material.dispose();
        visual.mesh.dispose();
        this.activeVisuals.splice(index, 1);
        continue;
      }

      const fade = Math.sin(progress * Math.PI);

      visual.material.alpha = 0.18 + fade * 0.7;
      visual.mesh.position.copyFrom(
        Vector3.Lerp(visual.startPosition, visual.endPosition, this.easeInOut(progress))
      );
      visual.mesh.rotation.y += this.scene.getEngine().getDeltaTime() * 0.001;
    }
  }

  private updateActiveEvent(
    distractorId: string,
    actualOnsetOffsetMs: number,
    durationMs: number
  ): void {
    if (!this.activeEvent) {
      return;
    }

    this.activeEvent.distractorId = distractorId;
    this.activeEvent.actualOnsetOffsetMs = actualOnsetOffsetMs;
    this.activeEvent.durationMs = durationMs;
  }

  private clearOnsetTimeout(): void {
    if (this.onsetTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.onsetTimeoutId);
    this.onsetTimeoutId = null;
  }

  private clearVisuals(): void {
    this.activeVisuals.forEach((visual) => {
      visual.material.dispose();
      visual.mesh.dispose();
    });
    this.activeVisuals.length = 0;
  }

  private easeInOut(progress: number): number {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }
}
