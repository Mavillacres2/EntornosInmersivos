import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Observer, Scene } from "@babylonjs/core";

import type {
  BlockCondition,
  StimulusType
} from "../activities/GoNoGoTypes";
import type { AudioDistractorId } from "../audio/AudioConfig";
import type { AudioManager } from "../audio/AudioManager";
import type {
  CharacterEvent,
  CharacterManager
} from "../characters/CharacterManager";

interface VisualSpawnArea {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  z: number;
}

interface VisualDistractorSphere {
  mesh: Mesh;
  material: StandardMaterial;
  active: boolean;
  startPosition: Vector3;
  targetPosition: Vector3;
  startedAt: number;
  durationMs: number;
  pulseOffset: number;
}

type ResponseInputType = "keyboard" | "pointer";
export type VisualDistractorId =
  | "studentLookAround"
  | "studentRaiseHand"
  | "studentSmallGesture";
export type CombinedDistractorId = "gestureWithObjectSound";

export interface DistractorEvent {
  distractorId: string;
  type: "visual" | "auditory" | "combined";
  characterId?: string;
  animationGroupName?: string | null;
  startedAt: number;
  endedAt: number;
  condition: BlockCondition;
  blockNumber: number | null;
}

interface DistractorManagerOptions {
  audioManager?: AudioManager;
  characterManager?: CharacterManager;
  onDistractorEvent?: (event: DistractorEvent) => void;
}

export class DistractorManager {
  private readonly scene: Scene;
  private readonly audioManager: AudioManager | null;
  private readonly characterManager: CharacterManager | null;
  private readonly onDistractorEvent: ((event: DistractorEvent) => void) | null;
  private readonly auditoryIntervalsMs = [2_400, 3_800, 3_200, 4_400];
  private readonly visualActionIntervalsMs = [4_600, 5_800, 6_200];
  private readonly combinedIntervalsMs = [4_800, 6_400, 5_600];
  private readonly visualSpawnAreas: VisualSpawnArea[] = [
    { minX: -6.65, maxX: -3.9, minY: 1.75, maxY: 3.6, z: 5.18 },
    { minX: 3.9, maxX: 6.65, minY: 1.75, maxY: 3.6, z: 5.18 },
    { minX: -3.15, maxX: 3.15, minY: 3.58, maxY: 4.05, z: 5.14 },
    { minX: -5.4, maxX: 5.4, minY: 1.12, maxY: 1.45, z: 5.12 }
  ];
  private readonly visualColors = [
    new Color3(0.96, 0.77, 0.18),
    new Color3(0.28, 0.64, 0.92),
    new Color3(0.72, 0.5, 0.88),
    new Color3(0.95, 0.54, 0.24)
  ];
  private readonly auditoryDistractorSequence: AudioDistractorId[] = [
    "footsteps",
    "door",
    "pencilDrop",
    "distantConversation",
    "chairMovement"
  ];
  private readonly visualDistractorSequence: VisualDistractorId[] = [
    "studentLookAround",
    "studentSmallGesture",
    "studentRaiseHand"
  ];
  private readonly combinedDistractorSequence: CombinedDistractorId[] = [
    "gestureWithObjectSound"
  ];

  private activeCondition: BlockCondition = "baseline";
  private currentBlockNumber: number | null = null;
  private visualSpheres: VisualDistractorSphere[] = [];
  private visualObserver: Observer<Scene> | null = null;
  private visualSpawnTimeoutId: number | null = null;
  private visualActionTimeoutId: number | null = null;
  private combinedTimeoutId: number | null = null;
  private visualEnabled = false;
  private auditoryTimeoutId: number | null = null;
  private auditoryIntervalIndex = 0;
  private visualActionIntervalIndex = 0;
  private combinedIntervalIndex = 0;
  private auditoryEnabled = false;
  private combinedEnabled = false;

  constructor(scene: Scene, options: DistractorManagerOptions = {}) {
    this.scene = scene;
    this.audioManager = options.audioManager ?? null;
    this.characterManager = options.characterManager ?? null;
    this.onDistractorEvent = options.onDistractorEvent ?? null;
  }

  prepareAudio(): void {
    this.audioManager?.unlock();
  }

  playStimulusCue(stimulusType: StimulusType): void {
    this.audioManager?.playStimulusCue(stimulusType);
  }

  playResponseCue(inputType: ResponseInputType): void {
    this.audioManager?.playResponseCue(inputType);
  }

  setCondition(condition: BlockCondition, blockNumber: number | null = null): void {
    this.stopVisualDistractors();
    this.stopAuditoryDistractor();
    this.stopCombinedDistractors();

    this.activeCondition = condition;
    this.currentBlockNumber = blockNumber;
    this.audioManager?.setProtocolCondition(condition);
    this.characterManager?.setCondition(condition);

    switch (condition) {
      case "baseline":
        console.log("Distractor condition: baseline - only subtle ambient idle");
        break;

      case "visual":
        this.startVisualDistractors();
        this.startVisualCharacterDistractors();
        console.log("Distractor condition: visual - visual events enabled");
        break;

      case "auditory":
        this.startAuditoryDistractor();
        console.log("Distractor condition: auditory - spatial audio events enabled");
        break;

      case "combined":
        this.startVisualDistractors();
        this.startCombinedDistractors();
        console.log("Distractor condition: combined - synchronized events enabled");
        break;
    }
  }

  triggerAuditoryDistractor(id: AudioDistractorId): void {
    if (!this.canPlayAuditory()) {
      return;
    }

    const startedAt = performance.now();
    const endedAt = startedAt + this.getAuditoryDurationMs(id);

    this.audioManager?.playDistractor({
      id,
      position: this.getAuditoryPosition(id)
    });
    this.emitDistractorEvent({
      distractorId: id,
      type: "auditory",
      startedAt,
      endedAt
    });
  }

  triggerVisualDistractor(id: VisualDistractorId): void {
    if (!this.canPlayVisual()) {
      return;
    }

    const timeline = this.playVisualAction(id);

    if (!timeline) {
      this.spawnVisualSphere();
      return;
    }

    this.emitDistractorEvent({
      distractorId: id,
      type: "visual",
      characterId: timeline.characterId,
      animationGroupName: timeline.animationGroupName,
      startedAt: timeline.startedAt,
      endedAt: timeline.endedAt
    });
  }

  triggerCombinedDistractor(id: CombinedDistractorId): void {
    if (this.activeCondition !== "combined") {
      return;
    }

    const startedAt = performance.now();
    let endedAt = startedAt + 1800;
    let characterId: string | undefined;
    let animationGroupName: string | null = null;

    const visualEvent = this.characterManager?.playAction(
      "student02",
      "smallGesture"
    );

    endedAt = visualEvent?.endedAt ?? startedAt + 1400;
    characterId = visualEvent?.characterId ?? "student02";
    animationGroupName = visualEvent?.animationGroupName ?? null;
    this.audioManager?.playDistractor({
      id: "pencilDrop",
      position: new Vector3(-5.65, 0.85, 3.82)
    });

    this.emitDistractorEvent({
      distractorId: id,
      type: "combined",
      characterId,
      animationGroupName,
      startedAt,
      endedAt
    });
  }

  disableAll(): void {
    this.stopVisualDistractors();
    this.stopAuditoryDistractor();
    this.stopCombinedDistractors();
    this.activeCondition = "baseline";
    this.currentBlockNumber = null;
    this.audioManager?.setProtocolCondition("baseline");
    this.characterManager?.setCondition("baseline");
  }

  dispose(): void {
    this.disableAll();

    this.visualSpheres.forEach((visualSphere) => {
      visualSphere.material.dispose();
      visualSphere.mesh.dispose();
    });

    this.visualSpheres = [];
  }

  getActiveCondition(): BlockCondition {
    return this.activeCondition;
  }

  private startVisualDistractors(): void {
    this.ensureVisualSpherePool();
    this.visualEnabled = true;

    if (!this.visualObserver) {
      this.visualObserver = this.scene.onBeforeRenderObservable.add(() => {
        this.updateVisualDistractors();
      });
    }

    this.scheduleNextVisualSpawn(500);
  }

  private stopVisualDistractors(): void {
    this.visualEnabled = false;
    this.clearVisualSpawnTimeout();
    this.clearVisualActionTimeout();

    if (this.visualObserver) {
      this.scene.onBeforeRenderObservable.remove(this.visualObserver);
      this.visualObserver = null;
    }

    this.visualSpheres.forEach((visualSphere) => {
      this.deactivateVisualSphere(visualSphere);
    });
  }

  private ensureVisualSpherePool(): void {
    if (this.visualSpheres.length > 0) {
      return;
    }

    this.visualSpheres = this.visualColors.map((color, index) => {
      const material = new StandardMaterial(
        `visualDistractorSphereMaterial${index + 1}`,
        this.scene
      );

      material.diffuseColor = color;
      material.emissiveColor = color.scale(0.22);
      material.specularColor = new Color3(0.08, 0.08, 0.08);
      material.alpha = 0;

      const mesh = MeshBuilder.CreateSphere(
        `visualDistractorSphere${index + 1}`,
        {
          diameter: 0.58,
          segments: 24
        },
        this.scene
      );

      mesh.material = material;
      mesh.isPickable = false;
      mesh.setEnabled(false);

      return {
        mesh,
        material,
        active: false,
        startPosition: Vector3.Zero(),
        targetPosition: Vector3.Zero(),
        startedAt: 0,
        durationMs: 0,
        pulseOffset: index * 0.7
      };
    });
  }

  private scheduleNextVisualSpawn(delayMs: number): void {
    if (!this.visualEnabled) {
      return;
    }

    this.clearVisualSpawnTimeout();

    this.visualSpawnTimeoutId = window.setTimeout(() => {
      this.visualSpawnTimeoutId = null;

      if (!this.visualEnabled) {
        return;
      }

      this.spawnVisualSphere();

      if (this.randomBetween(0, 1) > 0.72) {
        this.spawnVisualSphere();
      }

      this.scheduleNextVisualSpawn(this.randomBetween(900, 1_850));
    }, delayMs);
  }

  private spawnVisualSphere(): void {
    const visualSphere = this.getAvailableVisualSphere();
    const spawnArea = this.pickRandom(this.visualSpawnAreas);
    const startPosition = new Vector3(
      this.randomBetween(spawnArea.minX, spawnArea.maxX),
      this.randomBetween(spawnArea.minY, spawnArea.maxY),
      spawnArea.z
    );
    const movement = new Vector3(
      this.randomBetween(-0.9, 0.9),
      this.randomBetween(-0.45, 0.45),
      this.randomBetween(-0.06, 0.06)
    );

    visualSphere.startPosition = startPosition;
    visualSphere.targetPosition = startPosition.add(movement);
    visualSphere.startedAt = performance.now();
    visualSphere.durationMs = this.randomBetween(950, 1_750);
    visualSphere.active = true;
    visualSphere.material.alpha = 0;
    visualSphere.mesh.position.copyFrom(startPosition);
    visualSphere.mesh.scaling.setAll(this.randomBetween(1.08, 1.62));
    visualSphere.mesh.setEnabled(true);

    this.emitDistractorEvent({
      distractorId: "floatingSphere",
      type: "visual",
      startedAt: visualSphere.startedAt,
      endedAt: visualSphere.startedAt + visualSphere.durationMs
    });
  }

  private getAvailableVisualSphere(): VisualDistractorSphere {
    const inactiveSphere = this.visualSpheres.find(
      (visualSphere) => !visualSphere.active
    );

    return inactiveSphere ?? this.pickRandom(this.visualSpheres);
  }

  private updateVisualDistractors(): void {
    const now = performance.now();

    this.visualSpheres.forEach((visualSphere) => {
      if (!visualSphere.active) {
        return;
      }

      const progress = Math.min(
        1,
        (now - visualSphere.startedAt) / visualSphere.durationMs
      );

      if (progress >= 1) {
        this.deactivateVisualSphere(visualSphere);
        return;
      }

      const easedProgress = this.easeInOutSine(progress);
      const position = Vector3.Lerp(
        visualSphere.startPosition,
        visualSphere.targetPosition,
        easedProgress
      );
      const fade = Math.sin(progress * Math.PI);
      const pulse = 1 + Math.sin(now * 0.008 + visualSphere.pulseOffset) * 0.08;

      visualSphere.mesh.position.copyFrom(position);
      visualSphere.mesh.scaling.setAll(pulse);
      visualSphere.material.alpha = Math.max(0.16, fade * 0.78);
    });
  }

  private deactivateVisualSphere(visualSphere: VisualDistractorSphere): void {
    visualSphere.active = false;
    visualSphere.material.alpha = 0;
    visualSphere.mesh.setEnabled(false);
  }

  private startVisualCharacterDistractors(): void {
    this.visualActionIntervalIndex = 0;
    this.scheduleNextVisualAction(1_400);
  }

  private scheduleNextVisualAction(delayMs: number): void {
    if (this.activeCondition !== "visual") {
      return;
    }

    this.clearVisualActionTimeout();

    this.visualActionTimeoutId = window.setTimeout(() => {
      this.visualActionTimeoutId = null;

      if (this.activeCondition !== "visual") {
        return;
      }

      const id =
        this.visualDistractorSequence[
          this.visualActionIntervalIndex % this.visualDistractorSequence.length
        ];

      this.visualActionIntervalIndex += 1;
      this.triggerVisualDistractor(id);
      this.scheduleNextVisualAction(
        this.visualActionIntervalsMs[
          this.visualActionIntervalIndex % this.visualActionIntervalsMs.length
        ]
      );
    }, delayMs);
  }

  private playVisualAction(id: VisualDistractorId): CharacterEvent | null {
    switch (id) {
      case "studentLookAround":
        return this.characterManager?.playAction("student01", "lookAround") ?? null;

      case "studentRaiseHand":
        return this.characterManager?.playAction("student10", "raiseHand") ?? null;

      case "studentSmallGesture":
        return this.characterManager?.playAction("student02", "smallGesture") ?? null;
    }
  }

  private startAuditoryDistractor(): void {
    this.auditoryEnabled = true;
    this.auditoryIntervalIndex = 0;
    this.prepareAudio();
    this.scheduleNextAuditoryCue(900);
  }

  private stopAuditoryDistractor(): void {
    this.auditoryEnabled = false;

    if (this.auditoryTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.auditoryTimeoutId);
    this.auditoryTimeoutId = null;
  }

  private scheduleNextAuditoryCue(delayMs: number): void {
    if (!this.auditoryEnabled) {
      return;
    }

    if (this.auditoryTimeoutId !== null) {
      window.clearTimeout(this.auditoryTimeoutId);
    }

    this.auditoryTimeoutId = window.setTimeout(() => {
      this.auditoryTimeoutId = null;

      const id =
        this.auditoryDistractorSequence[
          this.auditoryIntervalIndex % this.auditoryDistractorSequence.length
        ];

      this.auditoryIntervalIndex += 1;
      this.triggerAuditoryDistractor(id);

      const nextDelay =
        this.auditoryIntervalsMs[
          this.auditoryIntervalIndex % this.auditoryIntervalsMs.length
        ];

      this.scheduleNextAuditoryCue(nextDelay);
    }, delayMs);
  }

  private startCombinedDistractors(): void {
    this.combinedEnabled = true;
    this.combinedIntervalIndex = 0;
    this.prepareAudio();
    this.scheduleNextCombinedCue(1_250);
  }

  private stopCombinedDistractors(): void {
    this.combinedEnabled = false;

    if (this.combinedTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.combinedTimeoutId);
    this.combinedTimeoutId = null;
  }

  private scheduleNextCombinedCue(delayMs: number): void {
    if (!this.combinedEnabled) {
      return;
    }

    if (this.combinedTimeoutId !== null) {
      window.clearTimeout(this.combinedTimeoutId);
    }

    this.combinedTimeoutId = window.setTimeout(() => {
      this.combinedTimeoutId = null;

      const id =
        this.combinedDistractorSequence[
          this.combinedIntervalIndex % this.combinedDistractorSequence.length
        ];

      this.combinedIntervalIndex += 1;
      this.triggerCombinedDistractor(id);
      this.scheduleNextCombinedCue(
        this.combinedIntervalsMs[
          this.combinedIntervalIndex % this.combinedIntervalsMs.length
        ]
      );
    }, delayMs);
  }

  private canPlayVisual(): boolean {
    return this.activeCondition === "visual" || this.activeCondition === "combined";
  }

  private canPlayAuditory(): boolean {
    return this.activeCondition === "auditory" || this.activeCondition === "combined";
  }

  private getAuditoryPosition(id: AudioDistractorId): Vector3 {
    switch (id) {
      case "door":
        return new Vector3(8.45, 1.35, -6.15);

      case "footsteps":
        return new Vector3(4.8, 0.25, -2.4);

      case "chairMovement":
        return new Vector3(-5.1, 0.68, -1.05);

      case "pencilDrop":
        return new Vector3(-5.65, 0.85, 3.82);

      case "distantConversation":
        return new Vector3(-8.4, 2.1, -1.2);
    }
  }

  private getAuditoryDurationMs(id: AudioDistractorId): number {
    switch (id) {
      case "footsteps":
        return 900;

      case "door":
        return 440;

      case "chairMovement":
        return 320;

      case "pencilDrop":
        return 180;

      case "distantConversation":
        return 900;
    }
  }

  private emitDistractorEvent(
    event: Omit<DistractorEvent, "condition" | "blockNumber">
  ): void {
    this.onDistractorEvent?.({
      ...event,
      condition: this.activeCondition,
      blockNumber: this.currentBlockNumber
    });
  }

  private clearVisualSpawnTimeout(): void {
    if (this.visualSpawnTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.visualSpawnTimeoutId);
    this.visualSpawnTimeoutId = null;
  }

  private clearVisualActionTimeout(): void {
    if (this.visualActionTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.visualActionTimeoutId);
    this.visualActionTimeoutId = null;
  }

  private pickRandom<T>(items: T[]): T {
    const index = Math.floor(this.randomBetween(0, items.length));

    return items[Math.min(index, items.length - 1)];
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private easeInOutSine(progress: number): number {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }
}
