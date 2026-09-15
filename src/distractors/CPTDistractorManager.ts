import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Observer, Scene, TransformNode } from "@babylonjs/core";

import type { CPTBlockCondition } from "../activities/CPTTypes";
import type { SpaceVisualEffectsController } from "../ambient/SpaceAmbientManager";
import { AUDIO_ASSETS } from "../audio/AudioConfig";
import type { SpaceAudioDistractorId } from "../audio/AudioConfig";
import type { AudioManager } from "../audio/AudioManager";
import type { SpaceStationDistractorAnchors } from "../environment/SpaceStationBuilder";

type CPTDistractorType = "visual" | "auditory" | "combined";

interface ActiveVisualCue {
  id: string;
  mesh: Mesh;
  material: StandardMaterial;
  startPosition: Vector3;
  endPosition: Vector3;
  startedAt: number;
  durationMs: number;
  startScale: number;
  pulseOnly: boolean;
}

export interface CPTDistractorEvent {
  distractorId: string;
  type: CPTDistractorType;
  startedAt: number;
  endedAt: number;
  blockNumber: number | null;
  condition: CPTBlockCondition;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface CPTDistractorManagerOptions {
  anchors: SpaceStationDistractorAnchors;
  audioManager?: AudioManager;
  visualEffects?: SpaceVisualEffectsController;
  onDistractorEvent?: (event: CPTDistractorEvent) => void;
}

export class CPTDistractorManager {
  private readonly scene: Scene;
  private readonly anchors: SpaceStationDistractorAnchors;
  private readonly audioManager: AudioManager | null;
  private readonly visualEffects: SpaceVisualEffectsController | null;
  private readonly onDistractorEvent: ((event: CPTDistractorEvent) => void) | null;
  private readonly visualSequence = [
    "satellitePass",
    "leftPanelFlash",
    "asteroidPass",
    "rightPanelFlash",
    "doorLight"
  ];
  private readonly auditorySequence: SpaceAudioDistractorId[] = [
    "beep",
    "radio",
    "mechanical",
    "door",
    "footsteps"
  ];
  private readonly combinedSequence = [
    "panelBeep",
    "satelliteRadio",
    "doorMotion"
  ];
  private readonly visualIntervalsMs = [3_800, 5_200, 4_600, 5_800];
  private readonly auditoryIntervalsMs = [3_200, 4_400, 3_700, 5_000];
  private readonly combinedIntervalsMs = [4_000, 5_200, 4_700];
  private readonly activeVisuals: ActiveVisualCue[] = [];

  private activeCondition: CPTBlockCondition = "baseline";
  private currentBlockNumber: number | null = null;
  private visualObserver: Observer<Scene> | null = null;
  private visualTimeoutId: number | null = null;
  private auditoryTimeoutId: number | null = null;
  private combinedTimeoutId: number | null = null;
  private visualIndex = 0;
  private auditoryIndex = 0;
  private combinedIndex = 0;
  private visualEnabled = false;
  private auditoryEnabled = false;
  private combinedEnabled = false;

  constructor(scene: Scene, options: CPTDistractorManagerOptions) {
    this.scene = scene;
    this.anchors = options.anchors;
    this.audioManager = options.audioManager ?? null;
    this.visualEffects = options.visualEffects ?? null;
    this.onDistractorEvent = options.onDistractorEvent ?? null;
  }

  prepareAudio(): void {
    this.audioManager?.unlock();
  }

  playResponseCue(): void {
    this.audioManager?.playResponseCue("keyboard");
  }

  setCondition(condition: CPTBlockCondition, blockNumber: number | null): void {
    this.disableAll();

    this.activeCondition = condition;
    this.currentBlockNumber = blockNumber;
    this.visualEffects?.setCondition(condition);

    switch (condition) {
      case "baseline":
        break;

      case "visual":
        this.startVisualDistractors();
        break;

      case "auditory":
        this.startAuditoryDistractors();
        break;

      case "combined":
        this.startCombinedDistractors();
        break;
    }
  }

  disableAll(): void {
    this.stopVisualDistractors();
    this.stopAuditoryDistractors();
    this.stopCombinedDistractors();
    this.activeCondition = "baseline";
    this.currentBlockNumber = null;
    this.visualEffects?.setCondition("baseline");
  }

  dispose(): void {
    this.disableAll();
    this.activeVisuals.forEach((visualCue) => {
      visualCue.material.dispose();
      visualCue.mesh.dispose();
    });
    this.activeVisuals.length = 0;
  }

  private startVisualDistractors(): void {
    this.visualEnabled = true;
    this.visualIndex = 0;
    this.ensureVisualObserver();
    this.scheduleNextVisualCue(900);
  }

  private stopVisualDistractors(): void {
    this.visualEnabled = false;
    this.clearVisualTimeout();

    if (this.visualObserver) {
      this.scene.onBeforeRenderObservable.remove(this.visualObserver);
      this.visualObserver = null;
    }

    this.activeVisuals.forEach((visualCue) => {
      visualCue.material.dispose();
      visualCue.mesh.dispose();
    });
    this.activeVisuals.length = 0;
  }

  private startAuditoryDistractors(): void {
    this.auditoryEnabled = true;
    this.auditoryIndex = 0;
    this.prepareAudio();
    this.scheduleNextAuditoryCue(1_100);
  }

  private stopAuditoryDistractors(): void {
    this.auditoryEnabled = false;
    this.clearAuditoryTimeout();
  }

  private startCombinedDistractors(): void {
    this.combinedEnabled = true;
    this.combinedIndex = 0;
    this.prepareAudio();
    this.ensureVisualObserver();
    this.scheduleNextCombinedCue(1_200);
  }

  private stopCombinedDistractors(): void {
    this.combinedEnabled = false;
    this.clearCombinedTimeout();
  }

  private scheduleNextVisualCue(delayMs: number): void {
    if (!this.visualEnabled) {
      return;
    }

    this.clearVisualTimeout();
    this.visualTimeoutId = window.setTimeout(() => {
      this.visualTimeoutId = null;

      if (!this.visualEnabled) {
        return;
      }

      const id = this.visualSequence[this.visualIndex % this.visualSequence.length];
      this.visualIndex += 1;
      this.triggerVisualCue(id);
      this.scheduleNextVisualCue(
        this.visualIntervalsMs[this.visualIndex % this.visualIntervalsMs.length]
      );
    }, delayMs);
  }

  private scheduleNextAuditoryCue(delayMs: number): void {
    if (!this.auditoryEnabled) {
      return;
    }

    this.clearAuditoryTimeout();
    this.auditoryTimeoutId = window.setTimeout(() => {
      this.auditoryTimeoutId = null;

      if (!this.auditoryEnabled) {
        return;
      }

      const id =
        this.auditorySequence[this.auditoryIndex % this.auditorySequence.length];

      this.auditoryIndex += 1;
      this.triggerAuditoryCue(id);
      this.scheduleNextAuditoryCue(
        this.auditoryIntervalsMs[
          this.auditoryIndex % this.auditoryIntervalsMs.length
        ]
      );
    }, delayMs);
  }

  private scheduleNextCombinedCue(delayMs: number): void {
    if (!this.combinedEnabled) {
      return;
    }

    this.clearCombinedTimeout();
    this.combinedTimeoutId = window.setTimeout(() => {
      this.combinedTimeoutId = null;

      if (!this.combinedEnabled) {
        return;
      }

      const id =
        this.combinedSequence[this.combinedIndex % this.combinedSequence.length];

      this.combinedIndex += 1;
      this.triggerCombinedCue(id);
      this.scheduleNextCombinedCue(
        this.combinedIntervalsMs[
          this.combinedIndex % this.combinedIntervalsMs.length
        ]
      );
    }, delayMs);
  }

  private triggerVisualCue(id: string): void {
    switch (id) {
      case "satellitePass":
        if (this.visualEffects) {
          const startedAt = performance.now();
          const durationMs = this.visualEffects.playSatellitePass(6_600);

          this.emitEvent(
            id,
            "visual",
            startedAt,
            startedAt + durationMs,
            this.anchors.windowDistractorAnchor.position
          );
          return;
        }

        this.spawnMovingCue(
          id,
          this.anchors.windowDistractorAnchor,
          new Vector3(0, 0.45, -1.9),
          new Vector3(0, -0.2, 2.1),
          new Color3(0.92, 0.84, 0.52),
          2_100,
          0.22
        );
        return;

      case "robotPass":
        if (this.visualEffects) {
          const startedAt = performance.now();
          const durationMs = this.visualEffects.moveRobot(1_650);

          this.emitEvent(
            id,
            "visual",
            startedAt,
            startedAt + durationMs,
            this.anchors.corridorDistractorAnchor.position
          );
          return;
        }

        this.spawnMovingCue(
          id,
          this.anchors.corridorDistractorAnchor,
          new Vector3(0, 0, -1.15),
          new Vector3(0, 0, 1.35),
          new Color3(0.35, 0.76, 0.82),
          1_900,
          0.28
        );
        return;

      case "asteroidPass":
        if (this.visualEffects) {
          const startedAt = performance.now();
          const durationMs = this.visualEffects.playAsteroidPass(5_600);

          this.emitEvent(
            id,
            "visual",
            startedAt,
            startedAt + durationMs,
            this.anchors.windowDistractorAnchor.position
          );
          return;
        }

        this.spawnMovingCue(
          id,
          this.anchors.windowDistractorAnchor,
          new Vector3(0, -0.55, 2.3),
          new Vector3(0, 0.42, -2.3),
          new Color3(0.68, 0.62, 0.52),
          2_200,
          0.22
        );
        return;

      case "leftPanelFlash":
        if (this.visualEffects) {
          const startedAt = performance.now();
          const durationMs = this.visualEffects.blinkSidePanel("left", 950);

          this.emitEvent(
            id,
            "visual",
            startedAt,
            startedAt + durationMs,
            this.anchors.leftPanelDistractorAnchor.position
          );
          return;
        }

        this.spawnPulseCue(
          id,
          this.anchors.leftPanelDistractorAnchor,
          new Color3(0.3, 0.82, 0.74),
          950,
          0.42
        );
        return;

      case "rightPanelFlash":
        if (this.visualEffects) {
          const startedAt = performance.now();
          const durationMs = this.visualEffects.blinkSidePanel("right", 950);

          this.emitEvent(
            id,
            "visual",
            startedAt,
            startedAt + durationMs,
            this.anchors.rightPanelDistractorAnchor.position
          );
          return;
        }

        this.spawnPulseCue(
          id,
          this.anchors.rightPanelDistractorAnchor,
          new Color3(0.34, 0.72, 0.95),
          950,
          0.42
        );
        return;

      case "doorLight":
      default:
        if (this.visualEffects) {
          const startedAt = performance.now();
          const durationMs = this.visualEffects.openDoor(1_100);

          this.emitEvent(
            id,
            "visual",
            startedAt,
            startedAt + durationMs,
            this.anchors.doorDistractorAnchor.position
          );
          return;
        }

        this.spawnPulseCue(
          id,
          this.anchors.doorDistractorAnchor,
          new Color3(0.72, 0.86, 0.42),
          1_050,
          0.34
        );
    }
  }

  private triggerAuditoryCue(id: SpaceAudioDistractorId): void {
    const anchor = this.getAudioAnchor(id);
    const position = anchor.position.clone();
    const startedAt = performance.now();
    const durationMs = this.getAuditoryDurationMs(id);

    this.audioManager?.playSpatialSound({
      id,
      assetPath: AUDIO_ASSETS.space.distractors[id],
      position,
      durationMs,
      volume: 0.72
    });
    this.emitEvent(id, "auditory", startedAt, startedAt + durationMs, position);
  }

  private triggerCombinedCue(id: string): void {
    switch (id) {
      case "panelBeep":
        if (this.visualEffects) {
          this.visualEffects.blinkSidePanel("right", 950);
        } else {
          this.spawnPulseCue(
            id,
            this.anchors.rightPanelDistractorAnchor,
            new Color3(0.34, 0.72, 0.95),
            950,
            0.42
          );
        }

        this.playCombinedAudio("beep", this.anchors.rightPanelDistractorAnchor, id, 420);
        return;

      case "satelliteRadio":
        if (this.visualEffects) {
          this.visualEffects.playSatellitePass(6_600);
        } else {
          this.spawnMovingCue(
            id,
            this.anchors.windowDistractorAnchor,
            new Vector3(0, 0.45, -1.9),
            new Vector3(0, -0.2, 2.1),
            new Color3(0.92, 0.84, 0.52),
            2_100,
            0.22
          );
        }

        this.playCombinedAudio("radio", this.anchors.windowDistractorAnchor, id, 900);
        return;

      case "robotMotor":
        if (this.visualEffects) {
          this.visualEffects.moveRobot(1_850);
        } else {
          this.spawnMovingCue(
            id,
            this.anchors.corridorDistractorAnchor,
            new Vector3(0, 0, 1.05),
            new Vector3(0, 0, -1.15),
            new Color3(0.35, 0.76, 0.82),
            1_850,
            0.28
          );
        }

        this.playCombinedAudio("robotMotor", this.anchors.corridorDistractorAnchor, id, 850);
        return;

      case "doorMotion":
      default:
        if (this.visualEffects) {
          this.visualEffects.openDoor(1_100);
        } else {
          this.spawnPulseCue(
            id,
            this.anchors.doorDistractorAnchor,
            new Color3(0.72, 0.86, 0.42),
            1_000,
            0.36
          );
        }

        this.playCombinedAudio("door", this.anchors.doorDistractorAnchor, id, 520);
    }
  }

  private playCombinedAudio(
    audioId: SpaceAudioDistractorId,
    anchor: TransformNode,
    eventId: string,
    durationMs: number
  ): void {
    const startedAt = performance.now();
    const position = anchor.position.clone();

    this.audioManager?.playSpatialSound({
      id: audioId,
      assetPath: AUDIO_ASSETS.space.distractors[audioId],
      position,
      durationMs,
      volume: 0.68
    });
    this.emitEvent(eventId, "combined", startedAt, startedAt + durationMs, position);
  }

  private spawnMovingCue(
    id: string,
    anchor: TransformNode,
    startOffset: Vector3,
    endOffset: Vector3,
    color: Color3,
    durationMs: number,
    scale: number
  ): void {
    const material = this.createCueMaterial(`${id}Material`, color);
    const mesh = MeshBuilder.CreateSphere(
      `${id}Cue`,
      {
        diameter: 1,
        segments: 18
      },
      this.scene
    );
    const startPosition = anchor.position.add(startOffset);
    const endPosition = anchor.position.add(endOffset);
    const startedAt = performance.now();

    mesh.position.copyFrom(startPosition);
    mesh.scaling.setAll(scale);
    mesh.material = material;
    mesh.isPickable = false;

    this.activeVisuals.push({
      id,
      mesh,
      material,
      startPosition,
      endPosition,
      startedAt,
      durationMs,
      startScale: scale,
      pulseOnly: false
    });
    this.emitEvent(id, "visual", startedAt, startedAt + durationMs, startPosition);
  }

  private spawnPulseCue(
    id: string,
    anchor: TransformNode,
    color: Color3,
    durationMs: number,
    scale: number
  ): void {
    const material = this.createCueMaterial(`${id}Material`, color);
    const mesh = MeshBuilder.CreateBox(
      `${id}Cue`,
      {
        width: 0.82,
        height: 0.46,
        depth: 0.045
      },
      this.scene
    );
    const position = anchor.position.clone();
    const startedAt = performance.now();

    mesh.position.copyFrom(position);
    mesh.scaling.setAll(scale);
    mesh.material = material;
    mesh.isPickable = false;

    this.activeVisuals.push({
      id,
      mesh,
      material,
      startPosition: position,
      endPosition: position,
      startedAt,
      durationMs,
      startScale: scale,
      pulseOnly: true
    });
    this.emitEvent(id, "visual", startedAt, startedAt + durationMs, position);
  }

  private ensureVisualObserver(): void {
    if (this.visualObserver) {
      return;
    }

    this.visualObserver = this.scene.onBeforeRenderObservable.add(() => {
      this.updateVisualCues();
    });
  }

  private updateVisualCues(): void {
    const now = performance.now();

    for (let index = this.activeVisuals.length - 1; index >= 0; index -= 1) {
      const cue = this.activeVisuals[index];
      const progress = Math.min(1, (now - cue.startedAt) / cue.durationMs);

      if (progress >= 1) {
        cue.material.dispose();
        cue.mesh.dispose();
        this.activeVisuals.splice(index, 1);
        continue;
      }

      const fade = Math.sin(progress * Math.PI);
      const scale = cue.startScale * (1 + fade * 0.24);

      cue.material.alpha = Math.max(0.08, fade * 0.82);
      cue.mesh.scaling.setAll(scale);

      if (!cue.pulseOnly) {
        cue.mesh.position.copyFrom(
          Vector3.Lerp(cue.startPosition, cue.endPosition, this.easeInOut(progress))
        );
      }

      cue.mesh.rotation.y += this.scene.getEngine().getDeltaTime() * 0.0012;
    }
  }

  private getAudioAnchor(id: SpaceAudioDistractorId): TransformNode {
    switch (id) {
      case "beep":
        return this.anchors.leftPanelDistractorAnchor;

      case "door":
        return this.anchors.doorDistractorAnchor;

      case "footsteps":
      case "mechanical":
      case "robotMotor":
        return this.anchors.corridorDistractorAnchor;

      case "radio":
      case "alarm":
        return this.anchors.rightPanelDistractorAnchor;
    }
  }

  private getAuditoryDurationMs(id: SpaceAudioDistractorId): number {
    switch (id) {
      case "beep":
        return 260;

      case "door":
        return 520;

      case "footsteps":
        return 900;

      case "radio":
        return 650;

      case "mechanical":
        return 520;

      case "alarm":
        return 340;

      case "robotMotor":
        return 850;
    }
  }

  private createCueMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.55);
    material.specularColor = new Color3(0.04, 0.05, 0.06);
    material.alpha = 0;

    return material;
  }

  private emitEvent(
    distractorId: string,
    type: CPTDistractorType,
    startedAt: number,
    endedAt: number,
    position: Vector3
  ): void {
    this.onDistractorEvent?.({
      distractorId,
      type,
      startedAt,
      endedAt,
      blockNumber: this.currentBlockNumber,
      condition: this.activeCondition,
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      }
    });
  }

  private clearVisualTimeout(): void {
    if (this.visualTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.visualTimeoutId);
    this.visualTimeoutId = null;
  }

  private clearAuditoryTimeout(): void {
    if (this.auditoryTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.auditoryTimeoutId);
    this.auditoryTimeoutId = null;
  }

  private clearCombinedTimeout(): void {
    if (this.combinedTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.combinedTimeoutId);
    this.combinedTimeoutId = null;
  }

  private easeInOut(progress: number): number {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }
}
