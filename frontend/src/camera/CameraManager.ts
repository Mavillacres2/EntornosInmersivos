import {
  Animation,
  CubicEase,
  EasingFunction,
  UniversalCamera,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Observer, Scene } from "@babylonjs/core";

const EXPLORATION_MOVE_SPEED = 3.4;
const DEFAULT_EVALUATION_FOV = 0.72;
const DEFAULT_EVALUATION_YAW_LIMIT = Math.PI / 6;
const DEFAULT_EVALUATION_PITCH_LIMIT = 0.42;

export const CameraMode = {
  Exploration: "exploration",
  Evaluation: "evaluation"
} as const;

export type CameraMode = (typeof CameraMode)[keyof typeof CameraMode];

export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface CameraManagerOptions {
  scene: Scene;
  canvas: HTMLCanvasElement;
  explorationPosition: Vector3;
  explorationTarget: Vector3;
  evaluationPosition: Vector3;
  evaluationTarget: Vector3;
  collisionMeshes: Mesh[];
  bounds: CameraBounds;
  evaluationFov?: number;
  evaluationYawLimit?: number;
  evaluationPitchLimit?: number;
}

export class CameraManager {
  private readonly scene: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly explorationCamera: UniversalCamera;
  private readonly evaluationCamera: UniversalCamera;
  private readonly evaluationPosition: Vector3;
  private readonly evaluationRotation: Vector3;
  private readonly evaluationYawLimit: number;
  private readonly evaluationPitchLimit: number;
  private readonly bounds: CameraBounds;
  private readonly explorationHeight: number;
  private readonly movementKeys = new Set<string>();
  private readonly focusCanvasBound: () => void;
  private readonly keyDownBound: (event: KeyboardEvent) => void;
  private readonly keyUpBound: (event: KeyboardEvent) => void;
  private readonly blurBound: () => void;
  private readonly pointerLockChangeBound: () => void;
  private readonly pointerLockErrorBound: () => void;
  private readonly pointerLockChangeCallbacks = new Set<(locked: boolean) => void>();

  private beforeRenderObserver: Observer<Scene> | null = null;
  private evaluationLookObserver: Observer<Scene> | null = null;
  private mode: CameraMode = CameraMode.Exploration;
  private isTransitioning = false;

  constructor(options: CameraManagerOptions) {
    this.scene = options.scene;
    this.canvas = options.canvas;
    this.bounds = options.bounds;
    this.explorationHeight = options.explorationPosition.y;
    this.evaluationPosition = options.evaluationPosition.clone();
    this.evaluationYawLimit =
      options.evaluationYawLimit ?? DEFAULT_EVALUATION_YAW_LIMIT;
    this.evaluationPitchLimit =
      options.evaluationPitchLimit ?? DEFAULT_EVALUATION_PITCH_LIMIT;

    this.scene.collisionsEnabled = true;
    options.collisionMeshes.forEach((mesh) => {
      mesh.checkCollisions = true;
    });

    this.explorationCamera = this.createExplorationCamera(
      options.explorationPosition,
      options.explorationTarget
    );
    this.evaluationCamera = this.createEvaluationCamera(
      options.evaluationPosition,
      options.evaluationTarget,
      options.evaluationFov ?? DEFAULT_EVALUATION_FOV
    );
    this.evaluationRotation = this.evaluationCamera.rotation.clone();

    this.focusCanvasBound = () => {
      this.canvas.focus();
      this.enablePointerLock();
    };
    this.keyDownBound = (event: KeyboardEvent) => {
      this.handleMovementKeyDown(event);
    };
    this.keyUpBound = (event: KeyboardEvent) => {
      this.handleMovementKeyUp(event);
    };
    this.blurBound = () => {
      this.movementKeys.clear();
    };
    this.pointerLockChangeBound = () => {
      this.notifyPointerLockChange();
    };
    this.pointerLockErrorBound = () => {
      this.notifyPointerLockChange();
    };
    this.canvas.addEventListener("click", this.focusCanvasBound);
    document.addEventListener("keydown", this.keyDownBound);
    document.addEventListener("keyup", this.keyUpBound);
    window.addEventListener("blur", this.blurBound);
    document.addEventListener("pointerlockchange", this.pointerLockChangeBound);
    document.addEventListener("pointerlockerror", this.pointerLockErrorBound);
  }

  get currentMode(): CameraMode {
    return this.mode;
  }

  enterExplorationMode(): void {
    if (this.mode !== CameraMode.Exploration) {
      return;
    }

    this.evaluationCamera.detachControl();
    this.scene.activeCamera = this.explorationCamera;
    this.explorationCamera.attachControl(this.canvas, true);
    this.ensureExplorationClamp();
    this.canvas.focus();
  }

  enablePointerLock(): void {
    if (
      (this.mode !== CameraMode.Exploration &&
        this.mode !== CameraMode.Evaluation) ||
      this.isPointerLocked()
    ) {
      return;
    }

    this.canvas.focus();

    const pointerLockRequest = this.canvas.requestPointerLock?.();

    if (pointerLockRequest instanceof Promise) {
      pointerLockRequest.catch(() => {
        this.notifyPointerLockChange();
      });
    }
  }

  disablePointerLock(): void {
    if (!this.isPointerLocked()) {
      this.notifyPointerLockChange();
      return;
    }

    document.exitPointerLock();
  }

  isPointerLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  onPointerLockChange(callback: (locked: boolean) => void): () => void {
    this.pointerLockChangeCallbacks.add(callback);
    callback(this.isPointerLocked());

    return () => {
      this.pointerLockChangeCallbacks.delete(callback);
    };
  }

  async enterEvaluationMode(): Promise<void> {
    if (this.isTransitioning || this.mode === CameraMode.Evaluation) {
      return;
    }

    this.isTransitioning = true;
    this.enablePointerLock();
    this.explorationCamera.detachControl();
    this.removeExplorationClamp();
    this.movementKeys.clear();
    await this.transitionToEvaluationCamera();
    this.scene.activeCamera = this.evaluationCamera;
    this.mode = CameraMode.Evaluation;
    this.evaluationCamera.attachControl(this.canvas, true);
    this.ensureEvaluationLookClamp();
    this.isTransitioning = false;
  }

  dispose(): void {
    this.disablePointerLock();
    this.removeExplorationClamp();
    this.removeEvaluationLookClamp();
    this.canvas.removeEventListener("click", this.focusCanvasBound);
    document.removeEventListener("keydown", this.keyDownBound);
    document.removeEventListener("keyup", this.keyUpBound);
    window.removeEventListener("blur", this.blurBound);
    document.removeEventListener("pointerlockchange", this.pointerLockChangeBound);
    document.removeEventListener("pointerlockerror", this.pointerLockErrorBound);
    this.explorationCamera.detachControl();
    this.evaluationCamera.detachControl();
    this.explorationCamera.dispose();
    this.evaluationCamera.dispose();
  }

  private createExplorationCamera(position: Vector3, target: Vector3): UniversalCamera {
    const camera = new UniversalCamera(
      "explorationCamera",
      position.clone(),
      this.scene
    );

    camera.setTarget(target);
    camera.fov = 1.08;
    camera.minZ = 0.05;
    camera.maxZ = 80;
    camera.speed = 0;
    camera.inertia = 0.18;
    camera.angularSensibility = 2200;
    camera.checkCollisions = true;
    camera.applyGravity = false;
    camera.ellipsoid = new Vector3(0.18, 0.58, 0.18);
    camera.ellipsoidOffset = new Vector3(0, -0.38, 0);
    camera.keysUp = [87];
    camera.keysDown = [83];
    camera.keysLeft = [65];
    camera.keysRight = [68];
    camera.keysUpward = [];
    camera.keysDownward = [];
    camera.inputs.removeByType("FreeCameraKeyboardMoveInput");

    return camera;
  }

  private createEvaluationCamera(
    position: Vector3,
    target: Vector3,
    fov: number
  ): UniversalCamera {
    const camera = new UniversalCamera(
      "evaluationCamera",
      position.clone(),
      this.scene
    );

    camera.setTarget(target);
    camera.fov = fov;
    camera.minZ = 0.05;
    camera.maxZ = 100;
    camera.speed = 0;
    camera.inertia = 0.12;
    camera.angularSensibility = 2400;
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];
    camera.keysUpward = [];
    camera.keysDownward = [];
    camera.inputs.removeByType("FreeCameraKeyboardMoveInput");

    return camera;
  }

  private ensureExplorationClamp(): void {
    if (this.beforeRenderObserver) {
      return;
    }

    this.beforeRenderObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (
        this.mode !== CameraMode.Exploration ||
        this.scene.activeCamera !== this.explorationCamera
      ) {
        return;
      }

      this.applyExplorationMovement();
      const position = this.explorationCamera.position;

      position.x = this.clamp(position.x, this.bounds.minX, this.bounds.maxX);
      position.y = this.explorationHeight;
      position.z = this.clamp(position.z, this.bounds.minZ, this.bounds.maxZ);
      this.explorationCamera.rotation.x = this.clamp(
        this.explorationCamera.rotation.x,
        -1.05,
        0.95
      );
    });
  }

  private applyExplorationMovement(): void {
    if (this.movementKeys.size === 0) {
      return;
    }

    const forward = this.explorationCamera.getForwardRay(1).direction.clone();
    forward.y = 0;

    if (forward.lengthSquared() <= 0.0001) {
      return;
    }

    forward.normalize();
    const right = Vector3.Cross(Vector3.Up(), forward).normalize();
    const movement = Vector3.Zero();

    if (this.movementKeys.has("KeyW") || this.movementKeys.has("ArrowUp")) {
      movement.addInPlace(forward);
    }

    if (this.movementKeys.has("KeyS") || this.movementKeys.has("ArrowDown")) {
      movement.subtractInPlace(forward);
    }

    if (this.movementKeys.has("KeyA") || this.movementKeys.has("ArrowLeft")) {
      movement.subtractInPlace(right);
    }

    if (this.movementKeys.has("KeyD") || this.movementKeys.has("ArrowRight")) {
      movement.addInPlace(right);
    }

    if (movement.lengthSquared() <= 0.0001) {
      return;
    }

    const deltaSeconds = Math.min(
      0.05,
      this.scene.getEngine().getDeltaTime() / 1000
    );
    movement.normalize().scaleInPlace(EXPLORATION_MOVE_SPEED * deltaSeconds);
    this.explorationCamera.position.addInPlace(movement);
  }

  private handleMovementKeyDown(event: KeyboardEvent): void {
    if (!this.shouldUseMovementKey(event.code)) {
      return;
    }

    event.preventDefault();
    this.movementKeys.add(event.code);
  }

  private handleMovementKeyUp(event: KeyboardEvent): void {
    if (!this.shouldUseMovementKey(event.code)) {
      return;
    }

    event.preventDefault();
    this.movementKeys.delete(event.code);
  }

  private shouldUseMovementKey(code: string): boolean {
    return (
      this.mode === CameraMode.Exploration &&
      [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight"
      ].includes(code)
    );
  }

  private removeExplorationClamp(): void {
    if (!this.beforeRenderObserver) {
      return;
    }

    this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
    this.beforeRenderObserver = null;
  }

  private ensureEvaluationLookClamp(): void {
    if (this.evaluationLookObserver) {
      return;
    }

    this.evaluationLookObserver = this.scene.onBeforeRenderObservable.add(() => {
      if (
        this.mode !== CameraMode.Evaluation ||
        this.scene.activeCamera !== this.evaluationCamera
      ) {
        return;
      }

      this.evaluationCamera.position.copyFrom(this.evaluationPosition);
      this.evaluationCamera.rotation.y = this.clampAngleAroundBase(
        this.evaluationCamera.rotation.y,
        this.evaluationRotation.y,
        this.evaluationYawLimit
      );
      this.evaluationCamera.rotation.x = this.clamp(
        this.evaluationCamera.rotation.x,
        this.evaluationRotation.x - this.evaluationPitchLimit,
        this.evaluationRotation.x + this.evaluationPitchLimit
      );
      this.evaluationCamera.rotation.z = this.evaluationRotation.z;
    });
  }

  private removeEvaluationLookClamp(): void {
    if (!this.evaluationLookObserver) {
      return;
    }

    this.scene.onBeforeRenderObservable.remove(this.evaluationLookObserver);
    this.evaluationLookObserver = null;
  }

  private async transitionToEvaluationCamera(): Promise<void> {
    const frameRate = 60;
    const totalFrames = 36;

    this.evaluationCamera.position.copyFrom(this.explorationCamera.position);
    this.evaluationCamera.rotation.copyFrom(this.explorationCamera.rotation);
    this.scene.activeCamera = this.evaluationCamera;

    const easing = new CubicEase();
    easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);

    const positionAnimation = new Animation(
      "evaluationCameraPositionTransition",
      "position",
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    positionAnimation.setKeys([
      { frame: 0, value: this.evaluationCamera.position.clone() },
      { frame: totalFrames, value: this.evaluationPosition.clone() }
    ]);
    positionAnimation.setEasingFunction(easing);

    const rotationAnimation = new Animation(
      "evaluationCameraRotationTransition",
      "rotation",
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    rotationAnimation.setKeys([
      { frame: 0, value: this.evaluationCamera.rotation.clone() },
      { frame: totalFrames, value: this.evaluationRotation.clone() }
    ]);
    rotationAnimation.setEasingFunction(easing);

    await new Promise<void>((resolve) => {
      this.scene.beginDirectAnimation(
        this.evaluationCamera,
        [positionAnimation, rotationAnimation],
        0,
        totalFrames,
        false,
        1,
        () => {
          resolve();
        }
      );
    });

    this.evaluationCamera.position.copyFrom(this.evaluationPosition);
    this.evaluationCamera.rotation.copyFrom(this.evaluationRotation);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private clampAngleAroundBase(
    value: number,
    base: number,
    maxDelta: number
  ): number {
    const delta = Math.atan2(Math.sin(value - base), Math.cos(value - base));

    return base + this.clamp(delta, -maxDelta, maxDelta);
  }

  private notifyPointerLockChange(): void {
    const locked = this.isPointerLocked();

    this.pointerLockChangeCallbacks.forEach((callback) => {
      callback(locked);
    });
  }
}
