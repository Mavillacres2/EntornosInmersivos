import { Color3, Vector3 } from "@babylonjs/core";
import type { Observer, Scene, StandardMaterial } from "@babylonjs/core";

import type { CPTBlockCondition } from "../activities/CPTTypes";
import type { SpaceAmbientElements } from "../environment/SpaceStationBuilder";

export type SpaceAmbientMode = "exploration" | "evaluation";

interface TimedVectorMotion {
  active: boolean;
  startedAt: number;
  durationMs: number;
  startPosition: Vector3;
  endPosition: Vector3;
}

interface TimedMaterialPulse {
  active: boolean;
  startedAt: number;
  durationMs: number;
  material: StandardMaterial | null;
}

interface TimedScalarMotion {
  active: boolean;
  startedAt: number;
  durationMs: number;
}

export interface SpaceVisualEffectsController {
  setCondition(condition: CPTBlockCondition): void;
  playSatellitePass(durationMs?: number): number;
  playAsteroidPass(durationMs?: number): number;
  blinkSidePanel(side: "left" | "right", durationMs?: number): number;
  openDoor(durationMs?: number): number;
  moveRobot(durationMs?: number): number;
}

export class SpaceAmbientManager implements SpaceVisualEffectsController {
  private readonly scene: Scene;
  private readonly elements: SpaceAmbientElements;
  private readonly starBaseColors: Color3[];
  private readonly consoleLightBaseColors: Color3[];
  private readonly robotBasePosition: Vector3;
  private readonly robotBaseRotationY: number;
  private readonly doorBaseRotationY: number;
  private observer: Observer<Scene> | null = null;
  private mode: SpaceAmbientMode = "exploration";
  private condition: CPTBlockCondition = "baseline";
  private elapsedMs = 0;
  private explorationSatelliteTimeoutId: number | null = null;
  private satelliteMotion: TimedVectorMotion = this.createEmptyMotion();
  private asteroidMotion: TimedVectorMotion = this.createEmptyMotion();
  private panelPulse: TimedMaterialPulse = {
    active: false,
    startedAt: 0,
    durationMs: 0,
    material: null
  };
  private doorMotion: TimedScalarMotion = {
    active: false,
    startedAt: 0,
    durationMs: 0
  };
  private robotMotion: TimedScalarMotion = {
    active: false,
    startedAt: 0,
    durationMs: 0
  };

  constructor(scene: Scene, elements: SpaceAmbientElements) {
    this.scene = scene;
    this.elements = elements;
    this.starBaseColors = elements.starMaterials.map((material) =>
      material.diffuseColor.clone()
    );
    this.consoleLightBaseColors = elements.consoleLightMaterials.map((material) =>
      material.diffuseColor.clone()
    );
    this.robotBasePosition = elements.robotRoot.position.clone();
    this.robotBaseRotationY = elements.robotRoot.rotation.y;
    this.doorBaseRotationY = elements.doorPivot.rotation.y;
  }

  start(): void {
    if (this.observer) {
      return;
    }

    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      this.update();
    });
    this.scheduleExplorationSatellitePass();
  }

  stop(): void {
    if (this.observer) {
      this.scene.onBeforeRenderObservable.remove(this.observer);
      this.observer = null;
    }

    this.clearExplorationSatelliteTimeout();
    this.elements.satelliteRoot.setEnabled(false);
    this.elements.asteroidPassMesh.setEnabled(false);
    this.restoreDoor();
    this.restoreRobot();
  }

  dispose(): void {
    this.stop();
  }

  setMode(mode: SpaceAmbientMode): void {
    this.mode = mode;

    if (mode === "exploration") {
      this.scheduleExplorationSatellitePass();
      return;
    }

    this.clearExplorationSatelliteTimeout();
  }

  setCondition(condition: CPTBlockCondition): void {
    this.condition = condition;
  }

  playSatellitePass(durationMs: number = 6_600): number {
    this.elements.satelliteRoot.setEnabled(true);
    this.satelliteMotion = {
      active: true,
      startedAt: performance.now(),
      durationMs,
      startPosition: new Vector3(-7, 3.18, -4.75),
      endPosition: new Vector3(-7, 2.42, 3.12)
    };
    this.elements.satelliteRoot.position.copyFrom(this.satelliteMotion.startPosition);

    return durationMs;
  }

  playAsteroidPass(durationMs: number = 5_600): number {
    this.elements.asteroidPassMesh.setEnabled(true);
    this.asteroidMotion = {
      active: true,
      startedAt: performance.now(),
      durationMs,
      startPosition: new Vector3(-7.02, 1.72, 2.9),
      endPosition: new Vector3(-7.02, 3.26, -4.55)
    };
    this.elements.asteroidPassMesh.position.copyFrom(
      this.asteroidMotion.startPosition
    );

    return durationMs;
  }

  blinkSidePanel(side: "left" | "right", durationMs: number = 950): number {
    this.panelPulse = {
      active: true,
      startedAt: performance.now(),
      durationMs,
      material:
        side === "left"
          ? this.elements.leftPanelGlowMaterial
          : this.elements.rightPanelGlowMaterial
    };

    return durationMs;
  }

  openDoor(durationMs: number = 1_200): number {
    this.doorMotion = {
      active: true,
      startedAt: performance.now(),
      durationMs
    };

    return durationMs;
  }

  moveRobot(durationMs: number = 1_650): number {
    this.robotMotion = {
      active: true,
      startedAt: performance.now(),
      durationMs
    };

    return durationMs;
  }

  private update(): void {
    const deltaMs = this.scene.getEngine().getDeltaTime();
    const motionScale = this.getMotionScale();

    this.elapsedMs += deltaMs;
    this.updatePlanets(deltaMs, motionScale);
    this.updateAsteroids(deltaMs, motionScale);
    this.updateStarTwinkle(motionScale);
    this.updateConsoleLights(motionScale);
    this.updateSatelliteMotion();
    this.updateAsteroidMotion();
    this.updatePanelPulse();
    this.updateDoorMotion();
    this.updateRobotMotion(deltaMs, motionScale);
  }

  private updatePlanets(deltaMs: number, motionScale: number): void {
    this.elements.planets.forEach((planet, index) => {
      const speed = this.elements.planetRotationSpeeds[index] ?? 0.000006;

      planet.rotation.y += speed * deltaMs * motionScale;
    });
  }

  private updateAsteroids(deltaMs: number, motionScale: number): void {
    this.elements.asteroids.forEach((asteroid, index) => {
      asteroid.rotation.x += (0.000012 + index * 0.000001) * deltaMs * motionScale;
      asteroid.rotation.y += (0.000018 + index * 0.000001) * deltaMs * motionScale;
      asteroid.position.y +=
        Math.sin(this.elapsedMs * 0.00018 + index) * 0.000035 * motionScale;
    });
  }

  private updateStarTwinkle(motionScale: number): void {
    const amplitude = this.mode === "exploration" ? 0.13 : 0.035 * motionScale;

    this.elements.starMaterials.forEach((material, index) => {
      const baseColor = this.starBaseColors[index] ?? Color3.White();
      const wave = (Math.sin(this.elapsedMs * 0.00055 + index * 1.6) + 1) / 2;
      const intensity = 0.45 + wave * amplitude;

      material.emissiveColor = baseColor.scale(intensity);
      material.alpha = 0.72 + wave * amplitude;
    });
  }

  private updateConsoleLights(motionScale: number): void {
    const amplitude = this.mode === "exploration" ? 0.12 : 0.04 * motionScale;

    this.elements.consoleLightMaterials.forEach((material, index) => {
      const baseColor = this.consoleLightBaseColors[index] ?? Color3.White();
      const wave = (Math.sin(this.elapsedMs * 0.0011 + index * 0.9) + 1) / 2;

      material.emissiveColor = baseColor.scale(0.26 + wave * amplitude);
    });
  }

  private updateSatelliteMotion(): void {
    if (!this.satelliteMotion.active) {
      return;
    }

    const progress = this.getProgress(this.satelliteMotion);

    if (progress >= 1) {
      this.satelliteMotion.active = false;
      this.elements.satelliteRoot.setEnabled(false);

      if (this.mode === "exploration") {
        this.scheduleExplorationSatellitePass();
      }

      return;
    }

    this.elements.satelliteRoot.position.copyFrom(
      Vector3.Lerp(
        this.satelliteMotion.startPosition,
        this.satelliteMotion.endPosition,
        this.easeInOut(progress)
      )
    );
    this.elements.satelliteRoot.rotation.z += 0.001;
  }

  private updateAsteroidMotion(): void {
    if (!this.asteroidMotion.active) {
      return;
    }

    const progress = this.getProgress(this.asteroidMotion);

    if (progress >= 1) {
      this.asteroidMotion.active = false;
      this.elements.asteroidPassMesh.setEnabled(false);
      return;
    }

    this.elements.asteroidPassMesh.position.copyFrom(
      Vector3.Lerp(
        this.asteroidMotion.startPosition,
        this.asteroidMotion.endPosition,
        this.easeInOut(progress)
      )
    );
    this.elements.asteroidPassMesh.rotation.y += 0.002;
  }

  private updatePanelPulse(): void {
    if (!this.panelPulse.active || !this.panelPulse.material) {
      return;
    }

    const elapsedMs = performance.now() - this.panelPulse.startedAt;
    const progress = Math.min(1, elapsedMs / this.panelPulse.durationMs);
    const pulse = Math.sin(progress * Math.PI);

    this.panelPulse.material.alpha = 0.22 + pulse * 0.42;
    this.panelPulse.material.emissiveColor =
      this.panelPulse.material.diffuseColor.scale(0.25 + pulse * 0.48);

    if (progress >= 1) {
      this.panelPulse.material.alpha = 0.22;
      this.panelPulse.material.emissiveColor =
        this.panelPulse.material.diffuseColor.scale(0.32);
      this.panelPulse.active = false;
      this.panelPulse.material = null;
    }
  }

  private updateDoorMotion(): void {
    if (!this.doorMotion.active) {
      return;
    }

    const elapsedMs = performance.now() - this.doorMotion.startedAt;
    const progress = Math.min(1, elapsedMs / this.doorMotion.durationMs);
    const openAmount = Math.sin(progress * Math.PI);

    this.elements.doorPivot.rotation.y =
      this.doorBaseRotationY - openAmount * 0.32;

    if (progress >= 1) {
      this.doorMotion.active = false;
      this.restoreDoor();
    }
  }

  private updateRobotMotion(_deltaMs: number, motionScale: number): void {
    const idleAmount = this.mode === "exploration" ? 1 : 0.25 * motionScale;
    const idleWave = Math.sin(this.elapsedMs * 0.001);

    this.elements.robotRoot.position.y =
      this.robotBasePosition.y + idleWave * 0.012 * idleAmount;
    this.elements.robotRoot.rotation.y =
      this.robotBaseRotationY + Math.sin(this.elapsedMs * 0.0007) * 0.035 * idleAmount;

    if (!this.robotMotion.active) {
      return;
    }

    const elapsedMs = performance.now() - this.robotMotion.startedAt;
    const progress = Math.min(1, elapsedMs / this.robotMotion.durationMs);
    const step = Math.sin(progress * Math.PI);

    this.elements.robotRoot.position.x =
      this.robotBasePosition.x + step * 0.34;
    this.elements.robotRoot.rotation.y += step * 0.22;
    this.elements.robotRoot.rotation.x =
      Math.sin(this.elapsedMs * 0.006) * 0.025;

    if (progress >= 1) {
      this.robotMotion.active = false;
      this.restoreRobot();
      return;
    }

  }

  private restoreDoor(): void {
    this.elements.doorPivot.rotation.y = this.doorBaseRotationY;
  }

  private restoreRobot(): void {
    this.elements.robotRoot.position.copyFrom(this.robotBasePosition);
    this.elements.robotRoot.rotation.x = 0;
    this.elements.robotRoot.rotation.y = this.robotBaseRotationY;
  }

  private scheduleExplorationSatellitePass(): void {
    if (this.mode !== "exploration" || this.explorationSatelliteTimeoutId !== null) {
      return;
    }

    this.explorationSatelliteTimeoutId = window.setTimeout(() => {
      this.explorationSatelliteTimeoutId = null;

      if (this.mode !== "exploration") {
        return;
      }

      this.playSatellitePass(8_000);
    }, this.randomBetween(8_000, 14_000));
  }

  private clearExplorationSatelliteTimeout(): void {
    if (this.explorationSatelliteTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.explorationSatelliteTimeoutId);
    this.explorationSatelliteTimeoutId = null;
  }

  private getMotionScale(): number {
    if (this.mode === "exploration") {
      return 1;
    }

    switch (this.condition) {
      case "baseline":
        return 0.18;

      case "auditory":
        return 0.16;

      case "visual":
        return 0.42;

      case "combined":
        return 0.48;
    }
  }

  private getProgress(motion: TimedVectorMotion): number {
    return Math.min(1, (performance.now() - motion.startedAt) / motion.durationMs);
  }

  private createEmptyMotion(): TimedVectorMotion {
    return {
      active: false,
      startedAt: 0,
      durationMs: 0,
      startPosition: Vector3.Zero(),
      endPosition: Vector3.Zero()
    };
  }

  private easeInOut(progress: number): number {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
