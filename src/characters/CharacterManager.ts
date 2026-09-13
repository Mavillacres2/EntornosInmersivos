import {
  Animation,
  Color3,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type {
  AbstractMesh,
  AnimationGroup,
  AssetContainer,
  Material,
  Mesh,
  Observer,
  Scene,
  Skeleton
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

import type { BlockCondition } from "../activities/GoNoGoTypes";
import {
  CHARACTER_ANIMATION_ALIASES,
  CHARACTER_CONFIG,
  CHARACTER_DEBUG,
  CHARACTER_LAYOUT_DEBUG,
  CHARACTER_MATERIAL_ALIASES
} from "./CharacterConfig";
import type {
  AnimationMap,
  CharacterAction,
  CharacterAnimationKey,
  CharacterConfig,
  CharacterDebugInfo,
  CharacterEvent,
  CharacterManagerOptions,
  CharacterMaterialMappings,
  CharacterMaterialTarget,
  CharacterMaterials,
  CharacterSeatTransform,
  CharacterState,
  LoadedCharacter
} from "./CharacterTypes";

export type {
  AnimationMap,
  CharacterAction,
  CharacterAnimationKey,
  CharacterConfig,
  CharacterDebugInfo,
  CharacterEvent,
  CharacterMaterialMap,
  CharacterMaterialMappings,
  CharacterMaterialTarget,
  CharacterRole,
  CharacterSeatTransform,
  CharacterState,
  LoadedCharacter
} from "./CharacterTypes";

interface ManagedCharacter extends LoadedCharacter {
  basePosition: Vector3;
  baseRotationY: number;
  head: TransformNode | null;
  leftArm: TransformNode | null;
  rightArm: TransformNode | null;
  initialState: CharacterState;
  materials: StandardMaterial[];
  idleOffset: number;
  actionLockedUntil: number;
  forwardCorrectionY: number;
}

const FALLBACK_FORWARD_CORRECTION_Y = Math.PI;
const CHARACTER_SHADOWS_ENABLED = false;
const UNSAFE_MATERIAL_PART_ALIASES = [
  "skin",
  "face",
  "head",
  "hand",
  "eye",
  "mouth",
  "teeth",
  "tongue"
];

export class CharacterManager {
  private readonly scene: Scene;
  private readonly shadowGenerator: CharacterManagerOptions["shadowGenerator"] | null;
  private readonly addShadowCaster: CharacterManagerOptions["addShadowCaster"] | null;
  private readonly characters = new Map<string, ManagedCharacter>();
  private readonly assetContainerCache = new Map<
    string,
    Promise<AssetContainer | null>
  >();
  private readonly actionTimeouts: number[] = [];
  private readonly detectedAnimations = new Map<string, string[]>();

  private idleObserver: Observer<Scene> | null = null;
  private activeCondition: BlockCondition = "baseline";
  private mode: "exploration" | "evaluation" = "exploration";
  private initialized = false;

  constructor(scene: Scene, options: CharacterManagerOptions = {}) {
    this.scene = scene;
    this.shadowGenerator = options.shadowGenerator ?? null;
    this.addShadowCaster = options.addShadowCaster ?? null;
  }

  async initialize(configs: CharacterConfig[] = CHARACTER_CONFIG): Promise<void> {
    await this.loadCharacters(configs);
  }

  async loadCharacters(configs: CharacterConfig[] = CHARACTER_CONFIG): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    await Promise.all(
      configs.map((config, index) => this.loadCharacter(config, index))
    );

    this.startIdleAnimations();
    this.debugLog("[CharacterManager] Characters ready:", this.getCharacterIds());
  }

  async loadCharacter(
    config: CharacterConfig,
    index = this.characters.size
  ): Promise<LoadedCharacter> {
    const existingCharacter = this.characters.get(config.id);

    if (existingCharacter) {
      this.disposeCharacter(existingCharacter);
      this.characters.delete(config.id);
    }

    const modelCharacter = await this.tryLoadModelCharacter(config, index);
    const character =
      modelCharacter ?? this.createFallbackCharacter(config, index);

    this.characters.set(config.id, character);
    this.playDefaultAnimation(character);

    return character;
  }

  setMode(mode: "exploration" | "evaluation"): void {
    this.mode = mode;

    if (mode === "evaluation") {
      this.restoreAllBaseStates();
    }
  }

  setCondition(condition: BlockCondition): void {
    this.activeCondition = condition;

    this.characters.forEach((character) => {
      if (condition === "baseline" || condition === "auditory") {
        this.restoreBaseState(character);
      }
    });
  }

  getCharacterIds(): string[] {
    return [...this.characters.keys()];
  }

  getCharacter(characterId: string): LoadedCharacter | null {
    return this.characters.get(characterId) ?? null;
  }

  getCharacterPosition(characterId: string): Vector3 | null {
    const character = this.characters.get(characterId);

    return character?.root.position.clone() ?? null;
  }

  getDetectedAnimationNames(characterId?: string): Record<string, string[]> {
    if (characterId) {
      return {
        [characterId]: this.detectedAnimations.get(characterId) ?? []
      };
    }

    return Object.fromEntries(this.detectedAnimations.entries());
  }

  debugCharacter(characterId: string): CharacterDebugInfo | null {
    const character = this.characters.get(characterId);

    if (!character) {
      console.warn(`[CharacterManager] ${characterId} is not loaded.`);
      return null;
    }

    const info: CharacterDebugInfo = {
      id: character.id,
      role: character.role,
      modelUrl: character.config.modelUrl,
      position: {
        x: Number(character.root.position.x.toFixed(3)),
        y: Number(character.root.position.y.toFixed(3)),
        z: Number(character.root.position.z.toFixed(3))
      },
      seatId: character.config.seatId ?? null,
      seatAnchorId: character.config.seatAnchorId ?? null,
      rotationY: Number(character.root.rotation.y.toFixed(3)),
      rotationOffsetY: character.config.rotationOffsetY ?? 0,
      scale: character.config.scale,
      defaultAnimation: character.config.defaultAnimation,
      ambientRole: character.config.ambientRole ?? null,
      allowedAmbientActions: character.config.allowedAmbientActions ?? [],
      conversationPartnerId: character.config.conversationPartnerId ?? null,
      walkRoute: character.config.walkRoute ?? null,
      meshes: character.meshes.map((mesh) => mesh.name),
      materials: this.getMaterialNames(character.meshes),
      hasSkeleton: character.skeletons.length > 0,
      appearanceMappings: character.materialMappings,
      animations: this.detectedAnimations.get(character.id) ?? [],
      currentAnimation: character.currentAnimation?.name ?? null,
      currentAnimationKey: character.currentAnimationKey,
      usingFallback: character.usingFallback
    };

    console.log(`[CharacterManager] debug ${character.id}:`, info);
    this.logCharacterInspection(character);
    this.logLayoutDebug(character);

    return info;
  }

  setCharacterColor(
    characterId: string,
    target: CharacterMaterialTarget,
    color: string | Color3
  ): boolean {
    const character = this.characters.get(characterId);

    if (!character) {
      this.debugWarn(`[CharacterManager] ${characterId} is not loaded.`);
      return false;
    }

    const parsedColor = this.parseColor(color);
    const meshes = this.findMeshesForMaterialTarget(character, target);

    if (meshes.length === 0) {
      this.debugWarn(
        `[CharacterManager] No safe independent material found for ${target} in ${character.id}.`
      );
      character.materialMappings[target] = [];
      return false;
    }

    const changedMaterialNames: string[] = [];

    meshes.forEach((mesh) => {
      const material = this.getOwnedMaterialForMesh(character, mesh, target);

      if (!material) {
        return;
      }

      this.tintMaterial(material, parsedColor);
      changedMaterialNames.push(material.name);
    });

    character.materialMappings[target] = [...new Set(changedMaterialNames)];
    character.materialMap[target] = meshes
      .map((mesh) => mesh.material)
      .filter((material): material is Material => Boolean(material));

    return changedMaterialNames.length > 0;
  }

  findAnimation(
    characterId: string,
    possibleNames: string[]
  ): AnimationGroup | null {
    const character = this.characters.get(characterId);

    if (!character) {
      return null;
    }

    return this.findAnimationByAliases(character, possibleNames);
  }

  playAnimation(
    characterId: string,
    animationKey: CharacterAnimationKey,
    loop = this.isLoopAnimation(animationKey)
  ): AnimationGroup | null {
    const character = this.characters.get(characterId);

    if (!character) {
      this.debugWarn(`[CharacterManager] ${characterId} is not loaded.`);
      return null;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return null;
    }

    const state = this.normalizeAnimationKey(animationKey);
    const animation = this.playStateAnimation(character, state, loop);

    if (!animation) {
      this.debugWarn(
        `[CharacterManager] ${character.id} has no animation for ${state}.`,
        this.detectedAnimations.get(character.id) ?? []
      );
    }

    return animation;
  }

  playIdle(characterId: string): void {
    const character = this.characters.get(characterId);

    if (!character) {
      return;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return;
    }

    this.playStateAnimation(character, "idle", true);
    character.currentAnimationKey = "idle";
  }

  playSit(characterId: string): void {
    const character = this.characters.get(characterId);

    if (!character) {
      return;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return;
    }

    const animation = this.playStateAnimation(character, "sitting", true);

    if (!animation) {
      this.playStateAnimation(character, "idle", true);
    }

    character.currentAnimationKey = "sitting";
  }

  playWalk(characterId: string): void {
    const character = this.characters.get(characterId);

    if (!character) {
      return;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return;
    }

    this.playStateAnimation(character, "walking", true);
    character.currentAnimationKey = "walking";
  }

  playAction(characterId: string, action: CharacterAction): CharacterEvent | null {
    const character = this.characters.get(characterId);

    if (!character) {
      this.debugWarn(`[CharacterManager] ${characterId} is not loaded.`);
      return null;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return null;
    }

    switch (action) {
      case "lookAround":
        return this.playLookAround(character);

      case "raiseHand":
        return this.playRaiseHand(character);

      case "smallGesture":
        return this.playSmallGesture(character);

      case "talk":
        return this.playTalk(character);

      case "walkAcross":
        return this.playWalkPath(
          characterId,
          character.root.position.clone(),
          character.root.position.add(new Vector3(1.15, 0, 0.55)),
          2800
        );
    }
  }

  async walkTo(
    characterId: string,
    targetPosition: Vector3,
    durationMs = 3000
  ): Promise<void> {
    const character = this.characters.get(characterId);

    if (!character) {
      this.debugWarn(`[CharacterManager] ${characterId} is not loaded.`);
      return;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return;
    }

    await this.moveCharacter(
      characterId,
      character.root.position.clone(),
      targetPosition.clone(),
      durationMs
    );
  }

  moveCharacter(
    characterId: string,
    from: Vector3,
    to: Vector3,
    durationMs: number
  ): Promise<void> {
    const character = this.characters.get(characterId);

    if (!character) {
      this.debugWarn(`[CharacterManager] ${characterId} is not loaded.`);
      return Promise.resolve();
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return Promise.resolve();
    }

    this.stopAction(characterId);
    character.root.position.copyFrom(from);
    character.basePosition.copyFrom(from);
    character.root.rotation.y = this.calculateYawToward(
      from,
      to,
      character.forwardCorrectionY
    );
    character.baseRotationY = character.root.rotation.y;
    character.actionLockedUntil = performance.now() + durationMs;
    this.playWalk(characterId);

    return this.animateVectorProperty(
      character.root,
      "position",
      from,
      to,
      durationMs
    ).then(() => {
      character.root.position.copyFrom(to);
      character.basePosition.copyFrom(to);
      this.restoreBaseState(character);
    });
  }

  playWalkPath(
    characterId: string,
    start: Vector3,
    end: Vector3,
    durationMs: number
  ): CharacterEvent | null {
    const character = this.characters.get(characterId);

    if (!character) {
      this.debugWarn(`[CharacterManager] ${characterId} is not loaded.`);
      return null;
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return null;
    }

    const startedAt = performance.now();
    const endedAt = startedAt + durationMs;
    const originalBasePosition = character.basePosition.clone();
    const originalBaseRotationY = character.baseRotationY;
    const animationGroupName =
      this.findAnimationByAliases(
        character,
        this.getAliasesForState(character.config, "walking")
      )?.name ?? null;

    void this.moveCharacter(characterId, start, end, durationMs).then(() => {
      const timeoutId = window.setTimeout(() => {
        character.basePosition.copyFrom(originalBasePosition);
        character.baseRotationY = originalBaseRotationY;
        character.root.position.copyFrom(originalBasePosition);
        character.root.rotation.y = originalBaseRotationY;
        this.restoreBaseState(character);
      }, 220);

      this.actionTimeouts.push(timeoutId);
    });

    return {
      id: character.id,
      characterId: character.id,
      action: "walkAcross",
      state: "walking",
      startedAt,
      endedAt,
      animationGroupName
    };
  }

  stopAction(characterId: string): void {
    const character = this.characters.get(characterId);

    if (!character) {
      return;
    }

    this.scene.stopAnimation(character.root);

    if (character.head) {
      this.scene.stopAnimation(character.head);
    }

    if (character.leftArm) {
      this.scene.stopAnimation(character.leftArm);
    }

    if (character.rightArm) {
      this.scene.stopAnimation(character.rightArm);
    }

    character.animationGroups.forEach((group) => {
      group.stop();
    });
    character.currentAnimation = null;
    character.actionLockedUntil = 0;
    this.restoreBaseState(character);
  }

  stopAllActions(): void {
    this.clearActionTimeouts();

    this.characters.forEach((character) => {
      this.scene.stopAnimation(character.root);

      if (character.head) {
        this.scene.stopAnimation(character.head);
      }

      if (character.leftArm) {
        this.scene.stopAnimation(character.leftArm);
      }

      if (character.rightArm) {
        this.scene.stopAnimation(character.rightArm);
      }

      character.animationGroups.forEach((group) => {
        group.stop();
      });
      character.currentAnimation = null;
      character.actionLockedUntil = 0;
      this.restoreBaseState(character);
    });
  }

  restoreCharacterBaseState(characterId: string): void {
    const character = this.characters.get(characterId);

    if (!character) {
      return;
    }

    this.restoreBaseState(character);
  }

  restoreAllBaseStates(): void {
    this.clearActionTimeouts();

    this.characters.forEach((character) => {
      this.restoreBaseState(character);
    });
  }

  dispose(): void {
    if (this.idleObserver) {
      this.scene.onBeforeRenderObservable.remove(this.idleObserver);
      this.idleObserver = null;
    }

    this.clearActionTimeouts();

    this.characters.forEach((character) => {
      this.disposeCharacter(character);
    });
    this.characters.clear();
    this.detectedAnimations.clear();
    this.assetContainerCache.forEach((containerPromise) => {
      void containerPromise.then((container) => {
        container?.dispose();
      });
    });
    this.assetContainerCache.clear();
  }

  private async resolveModelUrl(config: CharacterConfig): Promise<string | null> {
    const candidates = [
      config.modelUrl,
      ...(config.modelUrlCandidates ?? [])
    ].filter((url): url is string => Boolean(url));
    const uniqueCandidates = [...new Set(candidates)];

    for (const modelUrl of uniqueCandidates) {
      if (await this.modelExists(modelUrl)) {
        return modelUrl;
      }

      this.debugWarn(
        `[CharacterManager] Model candidate not found for ${config.id}: ${modelUrl}`
      );
    }

    return null;
  }

  private getAssetContainer(modelUrl: string): Promise<AssetContainer | null> {
    const cachedContainer = this.assetContainerCache.get(modelUrl);

    if (cachedContainer) {
      this.debugLog(`[CharacterManager] Reusing cached model: ${modelUrl}`);
      return cachedContainer;
    }

    const containerPromise = LoadAssetContainerAsync(modelUrl, this.scene)
      .then((container) => {
        container.removeAllFromScene();
        this.debugLog(`[CharacterManager] Cached model loaded: ${modelUrl}`);

        return container;
      })
      .catch((error: unknown) => {
        this.debugWarn(`[CharacterManager] Could not load ${modelUrl}.`, error);

        return null;
      });

    this.assetContainerCache.set(modelUrl, containerPromise);

    return containerPromise;
  }

  private getSeatTransform(config: CharacterConfig): CharacterSeatTransform {
    if (!config.seatAnchorId) {
      return {
        position: config.position.clone(),
        rotationY: config.rotationY,
        found: false
      };
    }

    const anchor = this.scene.getTransformNodeByName(config.seatAnchorId);

    if (!anchor) {
      this.debugWarn(
        `[CharacterManager] Seat anchor not found for ${config.id}: ${config.seatAnchorId}. Using configured position.`
      );

      return {
        position: config.position.clone(),
        rotationY: config.rotationY,
        found: false
      };
    }

    return {
      position: anchor.position.clone(),
      rotationY: anchor.rotation.y,
      found: true
    };
  }

  private async tryLoadModelCharacter(
    config: CharacterConfig,
    index: number
  ): Promise<ManagedCharacter | null> {
    const modelUrl = await this.resolveModelUrl(config);

    if (!modelUrl) {
      this.debugWarn(
        `[CharacterManager] No model file found for ${config.id}. Fallback enabled.`
      );
      this.detectedAnimations.set(config.id, []);
      return null;
    }

    const container = await this.getAssetContainer(modelUrl);

    if (!container) {
      this.debugWarn(
        `[CharacterManager] Model could not be loaded for ${config.id}: ${modelUrl}. Fallback enabled.`
      );
      this.detectedAnimations.set(config.id, []);
      return null;
    }

    try {
      const entries = container.instantiateModelsToScene(
        (sourceName) => `${config.id}_${sourceName}`,
        true,
        { doNotInstantiate: true }
      );
      const root = new TransformNode(`characterRoot_${config.id}`, this.scene);
      const seatTransform = this.getSeatTransform(config);
      const desiredPosition = this.getConfiguredPosition(config, seatTransform);
      const desiredRotationY = this.getConfiguredRotationY(config, seatTransform);
      const animationNames = entries.animationGroups.map((group) => group.name);
      const animationMap = this.createAnimationMap(config, entries.animationGroups);

      entries.rootNodes.forEach((node) => {
        if (node instanceof TransformNode) {
          node.parent = root;
        }
      });
      const meshes = root.getChildMeshes(false);

      if (
        this.shouldUseSeatedFallbackForStaticModel(
          config,
          animationMap,
          entries.skeletons
        )
      ) {
        this.detectedAnimations.set(config.id, animationNames);
        this.debugWarn(
          `[CharacterManager] ${config.id} has no sitting animation. Using seated classroom fallback instead of showing an unseated pose.`
        );
        this.disposeInstantiatedCharacterAssets(
          root,
          entries.animationGroups,
          entries.skeletons
        );

        return null;
      }

      meshes.forEach((mesh) => {
        this.prepareImportedMesh(mesh);
      });
      this.hideImportedScenePropMeshes(meshes);

      root.metadata = {
        role: config.role,
        characterId: config.id,
        seatId: config.seatId ?? null,
        deskId: config.deskId ?? null,
        seatAnchorId: config.seatAnchorId ?? null,
        source: modelUrl
      };
      root.position.copyFrom(desiredPosition);
      root.rotation.y = desiredRotationY;
      root.scaling.setAll(1);

      if (config.targetHeight) {
        this.normalizeImportedCharacterHeight(root, config.targetHeight);
      }

      root.scaling.scaleInPlace(config.scale);
      this.centerImportedCharacterOnRoot(root);
      this.alignCharacterBottomToY(root, desiredPosition.y);

      const character: ManagedCharacter = {
        id: config.id,
        role: config.role,
        root,
        meshes,
        skeletons: entries.skeletons,
        animationGroups: entries.animationGroups,
        animationMap,
        materialMap: {},
        materialMappings: {},
        currentAnimation: null,
        currentAnimationKey: null,
        usingFallback: false,
        config: {
          ...config,
          modelUrl
        },
        basePosition: root.position.clone(),
        baseRotationY: root.rotation.y,
        head: null,
        leftArm: null,
        rightArm: null,
        initialState: config.defaultAnimation,
        materials: [],
        idleOffset: index * 0.83,
        actionLockedUntil: 0,
        forwardCorrectionY: 0
      };

      this.detectedAnimations.set(config.id, animationNames);
      this.applyConfiguredAppearance(character);
      this.logCharacterInspection(character);
      this.logLayoutDebug(character);

      return character;
    } catch (error: unknown) {
      this.debugWarn(
        `[CharacterManager] Loader failed for ${config.id}: ${modelUrl}. Fallback enabled.`,
        error
      );
      this.detectedAnimations.set(config.id, []);
      return null;
    }
  }

  private shouldUseSeatedFallbackForStaticModel(
    config: CharacterConfig,
    animationMap: AnimationMap,
    skeletons: Skeleton[]
  ): boolean {
    if (config.role !== "student" || config.defaultAnimation !== "sitting") {
      return false;
    }

    if (animationMap.sitting) {
      return false;
    }

    if (skeletons.length > 0) {
      this.debugWarn(
        `[CharacterManager] ${config.id} has skeletons but no sitting animation. Skeleton posing is intentionally not forced here.`
      );
    }

    return true;
  }

  private disposeInstantiatedCharacterAssets(
    root: TransformNode,
    animationGroups: AnimationGroup[],
    skeletons: Skeleton[]
  ): void {
    animationGroups.forEach((group) => {
      group.stop();
      group.dispose();
    });
    skeletons.forEach((skeleton) => {
      skeleton.dispose();
    });
    root.dispose(false, true);
  }

  private createFallbackCharacter(
    config: CharacterConfig,
    index: number
  ): ManagedCharacter {
    if (!config.fallback) {
      this.debugWarn(
        `[CharacterManager] ${config.id} has fallback=false, but a temporary fallback is kept so the scene does not fail.`
      );
    }

    const root = new TransformNode(`characterRoot_${config.id}`, this.scene);
    const materials = this.createCharacterMaterials(config);
    const seatTransform = this.getSeatTransform(config);
    const seated = config.defaultAnimation === "sitting";
    const torsoHeight = seated ? 0.52 : 0.78;
    const torsoY = seated ? 0.92 : 0.82;
    const headY = seated ? 1.34 : 1.42;
    const hipY = seated ? 0.66 : 0.42;

    root.position = this.getConfiguredPosition(config, seatTransform);
    root.rotation.y = this.getConfiguredRotationY(config, seatTransform);
    root.scaling.setAll(
      config.scale * ((config.targetHeight ?? 1.2) / (seated ? 1.22 : 1.72))
    );
    root.metadata = {
      role: config.role,
      characterId: config.id,
      seatId: config.seatId ?? null,
      deskId: config.deskId ?? null,
      seatAnchorId: config.seatAnchorId ?? null,
      fallback: true
    };

    this.createCylinderPart(
      `${config.id}Torso`,
      root,
      0.3,
      torsoHeight,
      new Vector3(0, torsoY, 0),
      materials.shirt
    );
    this.createCylinderPart(
      `${config.id}Neck`,
      root,
      0.11,
      0.14,
      new Vector3(0, headY - 0.24, 0),
      materials.skin
    );
    this.createBoxPart(
      `${config.id}Shoulders`,
      root,
      new Vector3(0.58, 0.14, 0.18),
      new Vector3(0, torsoY + torsoHeight * 0.35, 0),
      materials.shirt
    );
    const head = this.createSpherePart(
      `${config.id}Head`,
      root,
      0.34,
      new Vector3(0, headY, 0),
      materials.skin
    );
    const hair = this.createSpherePart(
      `${config.id}Hair`,
      root,
      0.37,
      new Vector3(0, headY + 0.13, 0.02),
      materials.hair
    );
    hair.scaling.y = 0.48;
    hair.scaling.z = 0.72;
    this.createBoxPart(
      `${config.id}LeftEye`,
      root,
      new Vector3(0.045, 0.035, 0.012),
      new Vector3(-0.07, headY + 0.03, -0.16),
      materials.eye
    );
    this.createBoxPart(
      `${config.id}RightEye`,
      root,
      new Vector3(0.045, 0.035, 0.012),
      new Vector3(0.07, headY + 0.03, -0.16),
      materials.eye
    );
    this.createBoxPart(
      `${config.id}Nose`,
      root,
      new Vector3(0.045, 0.06, 0.035),
      new Vector3(0, headY - 0.025, -0.18),
      materials.skin
    );
    this.createBoxPart(
      `${config.id}Mouth`,
      root,
      new Vector3(0.13, 0.025, 0.012),
      new Vector3(0, headY - 0.12, -0.18),
      materials.eye
    );

    const leftArm = this.createCylinderPart(
      `${config.id}LeftArm`,
      root,
      0.08,
      seated ? 0.42 : 0.54,
      new Vector3(-0.28, seated ? 0.96 : 0.93, 0),
      materials.skin
    );
    const rightArm = this.createCylinderPart(
      `${config.id}RightArm`,
      root,
      0.08,
      seated ? 0.42 : 0.54,
      new Vector3(0.28, seated ? 0.96 : 0.93, 0),
      materials.skin
    );

    leftArm.rotation.z = -0.18;
    rightArm.rotation.z = 0.18;
    this.createSpherePart(
      `${config.id}LeftHand`,
      root,
      0.1,
      new Vector3(-0.33, seated ? 0.74 : 0.64, -0.03),
      materials.skin
    );
    this.createSpherePart(
      `${config.id}RightHand`,
      root,
      0.1,
      new Vector3(0.33, seated ? 0.74 : 0.64, -0.03),
      materials.skin
    );

    if (seated) {
      this.createSeatedLegs(config.id, root, hipY, materials);
    } else {
      this.createStandingLegs(config.id, root, hipY, materials);
    }

    this.detectedAnimations.set(config.id, []);
    this.debugLog(
      `[CharacterManager] ${config.id} using fallback at`,
      root.position
    );

    const character: ManagedCharacter = {
      id: config.id,
      role: config.role,
      root,
      meshes: root.getChildMeshes(false),
      skeletons: [],
      animationGroups: [],
      animationMap: {},
      materialMap: {
        shirt: [materials.shirt],
        pants: [materials.accent],
        hair: [materials.hair],
        shoes: [materials.shoe]
      },
      materialMappings: {
        shirt: [materials.shirt.name],
        pants: [materials.accent.name],
        hair: [materials.hair.name],
        shoes: [materials.shoe.name]
      },
      currentAnimation: null,
      currentAnimationKey: null,
      usingFallback: true,
      config,
      basePosition: root.position.clone(),
      baseRotationY: root.rotation.y,
      head,
      leftArm,
      rightArm,
      initialState: config.defaultAnimation,
      materials: Object.values(materials),
      idleOffset: index * 0.83,
      actionLockedUntil: 0,
      forwardCorrectionY: FALLBACK_FORWARD_CORRECTION_Y
    };

    this.logCharacterInspection(character);
    this.logLayoutDebug(character);

    return character;
  }

  private createSeatedLegs(
    id: string,
    root: TransformNode,
    hipY: number,
    materials: CharacterMaterials
  ): void {
    this.createBoxPart(
      `${id}LeftThigh`,
      root,
      new Vector3(0.12, 0.12, 0.46),
      new Vector3(-0.11, hipY + 0.05, -0.2),
      materials.accent
    );
    this.createBoxPart(
      `${id}RightThigh`,
      root,
      new Vector3(0.12, 0.12, 0.46),
      new Vector3(0.11, hipY + 0.05, -0.2),
      materials.accent
    );
    this.createBoxPart(
      `${id}LeftLowerLeg`,
      root,
      new Vector3(0.1, 0.36, 0.12),
      new Vector3(-0.11, 0.35, -0.41),
      materials.accent
    );
    this.createBoxPart(
      `${id}RightLowerLeg`,
      root,
      new Vector3(0.1, 0.36, 0.12),
      new Vector3(0.11, 0.35, -0.41),
      materials.accent
    );
    this.createBoxPart(
      `${id}LeftShoe`,
      root,
      new Vector3(0.14, 0.06, 0.2),
      new Vector3(-0.11, 0.14, -0.48),
      materials.shoe
    );
    this.createBoxPart(
      `${id}RightShoe`,
      root,
      new Vector3(0.14, 0.06, 0.2),
      new Vector3(0.11, 0.14, -0.48),
      materials.shoe
    );
  }

  private createStandingLegs(
    id: string,
    root: TransformNode,
    hipY: number,
    materials: CharacterMaterials
  ): void {
    this.createCylinderPart(
      `${id}LeftLeg`,
      root,
      0.09,
      0.72,
      new Vector3(-0.1, hipY, 0),
      materials.accent
    );
    this.createCylinderPart(
      `${id}RightLeg`,
      root,
      0.09,
      0.72,
      new Vector3(0.1, hipY, 0),
      materials.accent
    );
    this.createBoxPart(
      `${id}LeftShoe`,
      root,
      new Vector3(0.13, 0.06, 0.22),
      new Vector3(-0.1, 0.04, -0.06),
      materials.shoe
    );
    this.createBoxPart(
      `${id}RightShoe`,
      root,
      new Vector3(0.13, 0.06, 0.22),
      new Vector3(0.1, 0.04, -0.06),
      materials.shoe
    );
  }

  private playDefaultAnimation(character: ManagedCharacter): void {
    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return;
    }

    const defaultAnimation = this.playStateAnimation(
      character,
      character.config.defaultAnimation,
      this.isLoopAnimation(character.config.defaultAnimation)
    );

    if (!defaultAnimation && character.config.defaultAnimation === "sitting") {
      character.currentAnimationKey = "sitting";
      return;
    }

    character.currentAnimationKey = character.config.defaultAnimation;
  }

  private startIdleAnimations(): void {
    if (this.idleObserver) {
      return;
    }

    this.idleObserver = this.scene.onBeforeRenderObservable.add(() => {
      const now = performance.now();
      const seconds = now / 1000;
      const intensity = this.getIdleIntensity();

      this.characters.forEach((character) => {
        if (this.isStaticTeacher(character)) {
          return;
        }

        const usesProceduralMotion = character.usingFallback;

        if (!usesProceduralMotion) {
          return;
        }

        const phase = seconds * 1.25 + character.idleOffset;
        const isActionLocked = now < character.actionLockedUntil;
        const isTeacher = character.role === "teacher";
        const roleMotion = isTeacher ? 0.18 : 1;
        const state = character.currentAnimationKey ?? character.initialState;
        const verticalAmount = isTeacher
          ? 0.0015
          : state === "walking"
            ? 0.022
            : state === "talking"
              ? 0.01
              : 0.008;
        const rotationAmount = isTeacher
          ? 0.006
          : state === "talking"
            ? 0.055
            : state === "walking"
              ? 0.018
              : 0.024;
        const speedMultiplier =
          state === "walking" ? 2.15 : state === "talking" ? 1.35 : 1;

        if (!isActionLocked) {
          character.root.position.y =
            character.basePosition.y +
            Math.sin(phase * speedMultiplier) * verticalAmount * intensity;
          character.root.rotation.y =
            character.baseRotationY +
            Math.sin(phase * 0.55 * speedMultiplier) *
              rotationAmount *
              intensity *
              roleMotion;
        }

        if (character.head && !isActionLocked) {
          character.head.rotation.x = Math.sin(phase * 0.72) * 0.035 * intensity;
          character.head.rotation.y = Math.sin(phase * 0.48) * 0.055 * intensity;
        }

        if (character.leftArm && character.rightArm && !isActionLocked) {
          const armAmount = state === "talking" ? 0.09 : 0.035;
          const armOffset = Math.sin(phase * 0.68) * armAmount * intensity;

          character.leftArm.rotation.z = -0.18 + armOffset;
          character.rightArm.rotation.z = 0.18 - armOffset;
        }
      });
    });
  }

  private playLookAround(character: ManagedCharacter): CharacterEvent {
    const startedAt = performance.now();
    const durationMs = 1600;
    const animation = this.playStateAnimation(character, "lookAround", false);

    character.actionLockedUntil = startedAt + durationMs;

    if (!animation) {
      const target = character.head ?? character.root;
      const isRootTarget = target === character.root;
      const baseRotationY = isRootTarget ? character.baseRotationY : 0;
      const turnAmount = character.role === "teacher" ? 0.08 : 0.16;

      this.animateNumberProperty(
        target,
        "rotation.y",
        isRootTarget ? character.root.rotation.y : target.rotation.y,
        baseRotationY + turnAmount,
        durationMs / 2
      );

      const timeoutId = window.setTimeout(() => {
        this.animateNumberProperty(
          target,
          "rotation.y",
          baseRotationY + turnAmount,
          baseRotationY - turnAmount * 0.65,
          durationMs / 2
        );
      }, durationMs / 2);
      this.actionTimeouts.push(timeoutId);
    }

    this.restoreBaseStateAfter(character, durationMs);

    return this.createCharacterEvent(
      character,
      "lookAround",
      "lookAround",
      startedAt,
      durationMs,
      animation?.name ?? null
    );
  }

  private playRaiseHand(character: ManagedCharacter): CharacterEvent {
    const startedAt = performance.now();
    const durationMs = 1900;
    const animation = this.playStateAnimation(character, "raiseHand", false);

    character.actionLockedUntil = startedAt + durationMs;

    if (!animation) {
      const armTarget = character.rightArm;

      if (armTarget) {
        this.animateNumberProperty(
          armTarget,
          "rotation.z",
          armTarget.rotation.z,
          -1.25,
          720
        );
      } else {
        this.animateNumberProperty(
          character.root,
          "rotation.y",
          character.baseRotationY,
          character.baseRotationY + 0.12,
          720
        );
      }

      const timeoutId = window.setTimeout(() => {
        if (armTarget) {
          this.animateNumberProperty(armTarget, "rotation.z", -1.25, 0.18, 880);
          return;
        }

        this.animateNumberProperty(
          character.root,
          "rotation.y",
          character.baseRotationY + 0.12,
          character.baseRotationY,
          880
        );
      }, 900);
      this.actionTimeouts.push(timeoutId);
    }

    this.restoreBaseStateAfter(character, durationMs);

    return this.createCharacterEvent(
      character,
      "raiseHand",
      "raiseHand",
      startedAt,
      durationMs,
      animation?.name ?? null
    );
  }

  private playSmallGesture(character: ManagedCharacter): CharacterEvent {
    const startedAt = performance.now();
    const durationMs = 1300;
    const animation = this.playStateAnimation(character, "talking", false);

    character.actionLockedUntil = startedAt + durationMs;

    if (!animation) {
      const armTarget = character.leftArm ?? character.rightArm;

      if (armTarget) {
        this.animateNumberProperty(
          armTarget,
          "rotation.z",
          armTarget.rotation.z,
          0.82,
          520
        );
      } else {
        this.animateNumberProperty(
          character.root,
          "rotation.y",
          character.baseRotationY,
          character.baseRotationY + 0.08,
          520
        );
      }

      const timeoutId = window.setTimeout(() => {
        if (armTarget) {
          this.animateNumberProperty(armTarget, "rotation.z", 0.82, -0.18, 620);
          return;
        }

        this.animateNumberProperty(
          character.root,
          "rotation.y",
          character.baseRotationY + 0.08,
          character.baseRotationY,
          620
        );
      }, 650);
      this.actionTimeouts.push(timeoutId);
    }

    this.restoreBaseStateAfter(character, durationMs);

    return this.createCharacterEvent(
      character,
      "smallGesture",
      "talking",
      startedAt,
      durationMs,
      animation?.name ?? null
    );
  }

  private playTalk(character: ManagedCharacter): CharacterEvent {
    const startedAt = performance.now();
    const durationMs = 1700;
    const animation = this.playStateAnimation(character, "talking", false);

    character.actionLockedUntil = startedAt + durationMs;

    if (!animation) {
      const head = character.head ?? character.root;
      const arm = character.leftArm ?? character.rightArm ?? character.root;

      this.animateNumberProperty(head, "rotation.y", head.rotation.y, 0.18, 420);
      this.animateNumberProperty(arm, "rotation.z", arm.rotation.z, 0.72, 520);

      const timeoutId = window.setTimeout(() => {
        this.animateNumberProperty(head, "rotation.y", 0.18, -0.12, 520);
        this.animateNumberProperty(arm, "rotation.z", 0.72, -0.18, 620);
      }, 650);
      this.actionTimeouts.push(timeoutId);
    }

    this.restoreBaseStateAfter(character, durationMs);

    return this.createCharacterEvent(
      character,
      "talk",
      "talking",
      startedAt,
      durationMs,
      animation?.name ?? null
    );
  }

  private playStateAnimation(
    character: ManagedCharacter,
    state: CharacterState,
    loop: boolean
  ): AnimationGroup | null {
    const animation = this.findAnimationByAliases(
      character,
      this.getAliasesForState(character.config, state)
    );

    if (!animation) {
      character.currentAnimationKey = state;
      return null;
    }

    character.animationGroups.forEach((group) => {
      if (group !== animation) {
        group.stop();
      }
    });

    animation.reset();
    animation.start(loop);
    character.currentAnimation = animation;
    character.currentAnimationKey = state;
    this.debugLog(
      `[CharacterManager] ${character.id} playing ${state}: ${animation.name}`
    );

    if (!loop) {
      animation.onAnimationGroupEndObservable.addOnce(() => {
        this.restoreBaseState(character);
      });
    }

    return animation;
  }

  private createAnimationMap(
    config: CharacterConfig,
    animationGroups: AnimationGroup[]
  ): AnimationMap {
    const map: AnimationMap = {};

    (Object.keys(CHARACTER_ANIMATION_ALIASES) as CharacterState[]).forEach(
      (state) => {
        const animation = this.findAnimationByAliasesInGroups(
          animationGroups,
          this.getAliasesForState(config, state)
        );

        if (animation) {
          map[state] = animation;
        }
      }
    );

    return map;
  }

  private findAnimationByAliases(
    character: LoadedCharacter,
    possibleNames: string[]
  ): AnimationGroup | null {
    return this.findAnimationByAliasesInGroups(
      character.animationGroups,
      possibleNames
    );
  }

  private findAnimationByAliasesInGroups(
    animationGroups: AnimationGroup[],
    possibleNames: string[]
  ): AnimationGroup | null {
    const normalizedNames = possibleNames.map((name) =>
      this.normalizeAnimationName(name)
    );

    return (
      animationGroups.find((group) => {
        const groupName = this.normalizeAnimationName(group.name);

        return normalizedNames.some((name) => groupName.includes(name));
      }) ?? null
    );
  }

  private getAliasesForState(
    config: CharacterConfig,
    state: CharacterState
  ): string[] {
    return [
      ...(config.animationAliases?.[state] ?? []),
      ...CHARACTER_ANIMATION_ALIASES[state]
    ];
  }

  private restoreBaseStateAfter(
    character: ManagedCharacter,
    durationMs: number
  ): void {
    const timeoutId = window.setTimeout(() => {
      this.restoreBaseState(character);
    }, durationMs);

    this.actionTimeouts.push(timeoutId);
  }

  private restoreBaseState(character: ManagedCharacter): void {
    character.actionLockedUntil = 0;
    character.currentAnimation?.stop();
    character.currentAnimation = null;
    character.root.position.copyFrom(character.basePosition);
    character.root.rotation.y = character.baseRotationY;

    if (character.head) {
      character.head.rotation.set(0, 0, 0);
    }

    if (character.leftArm) {
      character.leftArm.rotation.set(0, 0, -0.18);
    }

    if (character.rightArm) {
      character.rightArm.rotation.set(0, 0, 0.18);
    }

    if (this.isStaticTeacher(character)) {
      this.keepStaticTeacherPose(character);
      return;
    }

    if (character.initialState === "sitting") {
      this.playStateAnimation(character, "sitting", true);
      character.currentAnimationKey = "sitting";
      return;
    }

    this.playStateAnimation(
      character,
      character.initialState,
      this.isLoopAnimation(character.initialState)
    );
    character.currentAnimationKey = character.initialState;
  }

  private isStaticTeacher(character: ManagedCharacter): boolean {
    return character.role === "teacher";
  }

  private keepStaticTeacherPose(character: ManagedCharacter): void {
    character.currentAnimation?.stop();
    character.currentAnimation = null;
    character.currentAnimationKey = null;
    character.actionLockedUntil = 0;
    character.animationGroups.forEach((group) => {
      group.stop();
    });
    this.scene.stopAnimation(character.root);
    character.root.position.copyFrom(character.basePosition);
    character.root.rotation.y = character.baseRotationY;

    if (character.head) {
      this.scene.stopAnimation(character.head);
      character.head.rotation.set(0, 0, 0);
    }

    if (character.leftArm) {
      this.scene.stopAnimation(character.leftArm);
      character.leftArm.rotation.set(0, 0, -0.18);
    }

    if (character.rightArm) {
      this.scene.stopAnimation(character.rightArm);
      character.rightArm.rotation.set(0, 0, 0.18);
    }
  }

  private createCharacterEvent(
    character: ManagedCharacter,
    action: CharacterAction,
    state: CharacterState,
    startedAt: number,
    durationMs: number,
    animationGroupName: string | null
  ): CharacterEvent {
    return {
      id: character.id,
      characterId: character.id,
      action,
      state,
      startedAt,
      endedAt: startedAt + durationMs,
      animationGroupName
    };
  }

  private animateNumberProperty(
    target: TransformNode,
    property: string,
    from: number,
    to: number,
    durationMs: number
  ): Promise<void> {
    const frameRate = 60;
    const totalFrames = Math.max(1, Math.round((durationMs / 1000) * frameRate));
    const animation = new Animation(
      `${target.name}${property}Animation`,
      property,
      frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    animation.setKeys([
      { frame: 0, value: from },
      { frame: totalFrames, value: to }
    ]);

    return new Promise((resolve) => {
      this.scene.beginDirectAnimation(
        target,
        [animation],
        0,
        totalFrames,
        false,
        1,
        () => {
          resolve();
        }
      );
    });
  }

  private animateVectorProperty(
    target: TransformNode,
    property: string,
    from: Vector3,
    to: Vector3,
    durationMs: number
  ): Promise<void> {
    const frameRate = 60;
    const totalFrames = Math.max(1, Math.round((durationMs / 1000) * frameRate));
    const animation = new Animation(
      `${target.name}${property}Animation`,
      property,
      frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    );

    animation.setKeys([
      { frame: 0, value: from.clone() },
      { frame: totalFrames, value: to.clone() }
    ]);

    return new Promise((resolve) => {
      this.scene.beginDirectAnimation(
        target,
        [animation],
        0,
        totalFrames,
        false,
        1,
        () => {
          resolve();
        }
      );
    });
  }

  private async modelExists(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        cache: "no-cache"
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private getConfiguredPosition(
    config: CharacterConfig,
    seatTransform: CharacterSeatTransform = this.getSeatTransform(config)
  ): Vector3 {
    const position = seatTransform.found
      ? seatTransform.position.clone()
      : config.position.clone();

    if (config.positionOffset) {
      position.addInPlace(config.positionOffset);
    }

    return position;
  }

  private getConfiguredRotationY(
    config: CharacterConfig,
    seatTransform: CharacterSeatTransform = this.getSeatTransform(config)
  ): number {
    const baseRotationY = seatTransform.found
      ? seatTransform.rotationY
      : config.rotationY;

    return baseRotationY + (config.rotationOffsetY ?? 0);
  }

  private normalizeImportedCharacterHeight(
    root: TransformNode,
    targetHeight: number
  ): void {
    root.computeWorldMatrix(true);

    const bounds = root.getHierarchyBoundingVectors(
      true,
      (mesh) => mesh.isEnabled()
    );
    const currentHeight = bounds.max.y - bounds.min.y;

    if (currentHeight > 0.001) {
      root.scaling.scaleInPlace(targetHeight / currentHeight);
    }
  }

  private alignCharacterBottomToY(root: TransformNode, yPosition: number): void {
    root.computeWorldMatrix(true);

    const bounds = root.getHierarchyBoundingVectors(
      true,
      (mesh) => mesh.isEnabled()
    );

    root.position.y += yPosition - bounds.min.y;
  }

  private centerImportedCharacterOnRoot(root: TransformNode): void {
    root.computeWorldMatrix(true);

    const bounds = root.getHierarchyBoundingVectors(
      true,
      (mesh) => mesh.isEnabled()
    );
    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    const deltaWorld = new Vector3(
      root.position.x - centerX,
      0,
      root.position.z - centerZ
    );

    if (
      !Number.isFinite(deltaWorld.x) ||
      !Number.isFinite(deltaWorld.z) ||
      deltaWorld.lengthSquared() <= 0.0001
    ) {
      return;
    }

    const inverseRootMatrix = root.getWorldMatrix().clone().invert();
    const deltaLocal = Vector3.TransformNormal(deltaWorld, inverseRootMatrix);

    root.getChildren().forEach((child) => {
      if (child instanceof TransformNode) {
        child.position.addInPlace(deltaLocal);
      }
    });
    root.computeWorldMatrix(true);
  }

  private prepareImportedMesh(mesh: AbstractMesh): void {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = CHARACTER_SHADOWS_ENABLED;

    if (CHARACTER_SHADOWS_ENABLED) {
      this.shadowGenerator?.addShadowCaster(mesh, true);
      this.addShadowCaster?.(mesh);
    }
  }

  private hideImportedScenePropMeshes(meshes: AbstractMesh[]): void {
    meshes.forEach((mesh) => {
      const meshName = this.normalizeAssetName(mesh.name);
      const shouldHide =
        meshName.includes("floor") ||
        meshName.includes("ground") ||
        meshName.includes("baseplate") ||
        meshName.includes("shadowplane");

      if (!shouldHide) {
        return;
      }

      mesh.setEnabled(false);
      mesh.isVisible = false;
      mesh.isPickable = false;
      this.debugLog(
        `[CharacterManager] Hidden imported scene prop mesh in character model: ${mesh.name}`
      );
    });
  }


  private applyConfiguredAppearance(character: ManagedCharacter): void {
    const appearance = character.config.appearance;

    if (!appearance) {
      return;
    }

    this.applyAppearanceColor(character, "shirt", appearance.shirtColor);
    this.applyAppearanceColor(character, "pants", appearance.pantsColor);
    this.applyAppearanceColor(character, "hair", appearance.hairColor);
    this.applyAppearanceColor(character, "shoes", appearance.shoesColor);
  }

  private applyAppearanceColor(
    character: ManagedCharacter,
    target: CharacterMaterialTarget,
    color: string | undefined
  ): void {
    if (!color) {
      return;
    }

    this.setCharacterColor(character.id, target, color);
  }

  private findMeshesForMaterialTarget(
    character: ManagedCharacter,
    target: CharacterMaterialTarget
  ): AbstractMesh[] {
    const targetAliases = this.getMaterialAliasesForTarget(
      character.config,
      target
    );

    return character.meshes.filter((mesh) => {
      const material = mesh.material;

      if (!material) {
        return false;
      }

      const meshName = this.normalizeAssetName(mesh.name);
      const materialName = this.normalizeAssetName(material.name);
      const matchesTarget = targetAliases.some(
        (alias) => meshName.includes(alias) || materialName.includes(alias)
      );

      if (!matchesTarget) {
        return false;
      }

      return !this.isUnsafeMaterialTarget(meshName, materialName, target);
    });
  }

  private getMaterialAliasesForTarget(
    config: CharacterConfig,
    target: CharacterMaterialTarget
  ): string[] {
    return [
      ...(config.materialAliases?.[target] ?? []),
      ...CHARACTER_MATERIAL_ALIASES[target]
    ].map((name) => this.normalizeAssetName(name));
  }

  private isUnsafeMaterialTarget(
    meshName: string,
    materialName: string,
    target: CharacterMaterialTarget
  ): boolean {
    if (target === "hair") {
      return ["skin", "face", "eye", "mouth"].some(
        (name) => meshName.includes(name) || materialName.includes(name)
      );
    }

    return UNSAFE_MATERIAL_PART_ALIASES.some(
      (name) => meshName.includes(name) || materialName.includes(name)
    );
  }

  private getOwnedMaterialForMesh(
    character: ManagedCharacter,
    mesh: AbstractMesh,
    target: CharacterMaterialTarget
  ): Material | null {
    const material = mesh.material;

    if (!material) {
      return null;
    }

    if (material.metadata?.characterMaterialOwner === character.id) {
      return material;
    }

    const clonedMaterial = material.clone(`${character.id}_${target}_${material.name}`);

    if (!clonedMaterial) {
      this.debugWarn(
        `[CharacterManager] Could not clone material ${material.name} for ${character.id}.`
      );
      return null;
    }

    clonedMaterial.metadata = {
      ...(clonedMaterial.metadata ?? {}),
      characterMaterialOwner: character.id,
      appearanceTarget: target
    };
    mesh.material = clonedMaterial;

    return clonedMaterial;
  }

  private tintMaterial(material: Material, color: Color3): void {
    if (material instanceof StandardMaterial) {
      material.diffuseColor = color;
      return;
    }

    if (material instanceof PBRMaterial) {
      material.albedoColor = color;
      return;
    }

    this.debugWarn(
      `[CharacterManager] Material ${material.name} does not expose a safe color tint.`
    );
  }

  private parseColor(color: string | Color3): Color3 {
    if (color instanceof Color3) {
      return color;
    }

    return Color3.FromHexString(color);
  }

  private createCharacterMaterials(config: CharacterConfig): CharacterMaterials {
    return {
      skin: this.createMaterial(
        `${config.id}SkinMaterial`,
        new Color3(0.9, 0.68, 0.52)
      ),
      shirt: this.createMaterial(
        `${config.id}ShirtMaterial`,
        this.getFallbackColor(config, "shirt", new Color3(0.56, 0.72, 0.9))
      ),
      accent: this.createMaterial(
        `${config.id}AccentMaterial`,
        this.getFallbackColor(config, "pants", new Color3(0.45, 0.5, 0.6))
      ),
      hair: this.createMaterial(
        `${config.id}HairMaterial`,
        this.getFallbackColor(config, "hair", new Color3(0.22, 0.16, 0.1))
      ),
      eye: this.createMaterial(
        `${config.id}EyeMaterial`,
        new Color3(0.05, 0.06, 0.07)
      ),
      shoe: this.createMaterial(
        `${config.id}ShoeMaterial`,
        this.getFallbackColor(config, "shoes", new Color3(0.12, 0.12, 0.12))
      )
    };
  }

  private getFallbackColor(
    config: CharacterConfig,
    target: CharacterMaterialTarget,
    fallback: Color3
  ): Color3 {
    const appearanceColor = this.getAppearanceColor(config, target);

    if (appearanceColor) {
      return this.parseColor(appearanceColor);
    }

    if (target === "shirt" && config.shirtColor) {
      return config.shirtColor;
    }

    if (target === "pants" && config.accentColor) {
      return config.accentColor;
    }

    return fallback;
  }

  private getAppearanceColor(
    config: CharacterConfig,
    target: CharacterMaterialTarget
  ): string | undefined {
    switch (target) {
      case "shirt":
        return config.appearance?.shirtColor;

      case "pants":
        return config.appearance?.pantsColor;

      case "hair":
        return config.appearance?.hairColor;

      case "shoes":
        return config.appearance?.shoesColor;
    }
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.specularColor = new Color3(0.08, 0.08, 0.08);

    return material;
  }

  private createCylinderPart(
    name: string,
    parent: TransformNode,
    diameter: number,
    height: number,
    position: Vector3,
    material: StandardMaterial
  ): Mesh {
    const mesh = MeshBuilder.CreateCylinder(
      name,
      {
        diameter,
        height,
        tessellation: 12
      },
      this.scene
    );

    return this.prepareFallbackMesh(mesh, parent, position, material);
  }

  private createSpherePart(
    name: string,
    parent: TransformNode,
    diameter: number,
    position: Vector3,
    material: StandardMaterial
  ): Mesh {
    const mesh = MeshBuilder.CreateSphere(
      name,
      {
        diameter,
        segments: 14
      },
      this.scene
    );

    return this.prepareFallbackMesh(mesh, parent, position, material);
  }

  private createBoxPart(
    name: string,
    parent: TransformNode,
    dimensions: Vector3,
    position: Vector3,
    material: StandardMaterial
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(
      name,
      {
        width: dimensions.x,
        height: dimensions.y,
        depth: dimensions.z
      },
      this.scene
    );

    return this.prepareFallbackMesh(mesh, parent, position, material);
  }

  private prepareFallbackMesh(
    mesh: Mesh,
    parent: TransformNode,
    position: Vector3,
    material: StandardMaterial
  ): Mesh {
    mesh.parent = parent;
    mesh.position = position;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = CHARACTER_SHADOWS_ENABLED;

    if (CHARACTER_SHADOWS_ENABLED) {
      this.shadowGenerator?.addShadowCaster(mesh);
      this.addShadowCaster?.(mesh);
    }

    return mesh;
  }

  private disposeCharacter(character: ManagedCharacter): void {
    character.animationGroups.forEach((group) => {
      group.stop();
      group.dispose();
    });
    character.skeletons.forEach((skeleton) => {
      skeleton.dispose();
    });
    character.materials.forEach((material) => {
      material.dispose();
    });
    character.root.dispose(false, true);
  }

  private calculateYawToward(
    from: Vector3,
    to: Vector3,
    forwardCorrectionY: number
  ): number {
    const direction = to.subtract(from);

    if (direction.lengthSquared() <= 0.0001) {
      return 0;
    }

    return Math.atan2(direction.x, direction.z) + forwardCorrectionY;
  }

  private normalizeAnimationName(name: string): string {
    return name.toLowerCase().replace(/[\s_-]+/g, "");
  }

  private normalizeAnimationKey(
    animationKey: CharacterAnimationKey
  ): CharacterState {
    return animationKey === "walk" ? "walking" : animationKey;
  }

  private isLoopAnimation(animationKey: CharacterAnimationKey): boolean {
    const state = this.normalizeAnimationKey(animationKey);

    return (
      state === "idle" ||
      state === "sitting" ||
      state === "walking" ||
      state === "talking"
    );
  }

  private clearActionTimeouts(): void {
    this.actionTimeouts.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    this.actionTimeouts.length = 0;
  }

  private getIdleIntensity(): number {
    if (this.mode === "exploration") {
      return 0.7;
    }

    switch (this.activeCondition) {
      case "baseline":
        return 0.22;

      case "auditory":
        return 0.3;

      case "visual":
      case "combined":
        return 0.54;
    }
  }

  private logCharacterInspection(character: ManagedCharacter): void {
    if (!CHARACTER_DEBUG) {
      return;
    }

    const meshNames = character.meshes.map((mesh) => mesh.name);
    const materialNames = this.getMaterialNames(character.meshes);
    const animationList =
      character.animationGroups.length > 0
        ? character.animationGroups.map((group) => `- ${group.name}`).join("\n")
        : "- sin animaciones";
    const meshList =
      meshNames.length > 0
        ? meshNames.map((name) => `- ${name}`).join("\n")
        : "- sin meshes";
    const materialList =
      materialNames.length > 0
        ? materialNames.map((name) => `- ${name}`).join("\n")
        : "- sin materiales";
    const mappingsList = this.formatMaterialMappings(character.materialMappings);

    console.log(
      [
        "================================",
        `CHARACTER: ${character.id}`,
        "================================",
        `Model: ${character.config.modelUrl ?? "none"}`,
        `Position: ${character.root.position.toString()}`,
        `Seat: ${character.config.seatId ?? "none"}`,
        `Seat anchor: ${character.config.seatAnchorId ?? "none"}`,
        `RotationY: ${character.root.rotation.y.toFixed(3)}`,
        `RotationOffsetY: ${(character.config.rotationOffsetY ?? 0).toFixed(3)}`,
        `Scale: ${character.config.scale}`,
        `Ambient role: ${character.config.ambientRole ?? "none"}`,
        `Allowed ambient actions: ${(character.config.allowedAmbientActions ?? []).join(", ") || "none"}`,
        `Conversation partner: ${character.config.conversationPartnerId ?? "none"}`,
        "Meshes:",
        meshList,
        "Materials:",
        materialList,
        `Skeleton: ${character.skeletons.length > 0 ? "yes" : "no"}`,
        "Animations:",
        animationList,
        "Appearance mappings:",
        mappingsList,
        `Current animation: ${character.currentAnimation?.name ?? "none"}`,
        `Using fallback: ${character.usingFallback}`,
        "================================"
      ].join("\n")
    );
  }

  private logLayoutDebug(character: ManagedCharacter): void {
    if (!CHARACTER_LAYOUT_DEBUG) {
      return;
    }

    console.table([
      {
        id: character.id,
        role: character.config.ambientRole ?? character.role,
        position: character.root.position.toString(),
        rotationY: character.root.rotation.y.toFixed(3),
        seat: character.config.seatId ?? "none",
        seatAnchor: character.config.seatAnchorId ?? "none",
        desk: character.config.deskId ?? "none"
      }
    ]);
  }

  private getMaterialNames(meshes: AbstractMesh[]): string[] {
    const materialNames = meshes
      .map((mesh) => mesh.material?.name)
      .filter((name): name is string => Boolean(name));

    return [...new Set(materialNames)];
  }

  private formatMaterialMappings(mappings: CharacterMaterialMappings): string {
    const targets: CharacterMaterialTarget[] = ["shirt", "pants", "hair", "shoes"];

    return targets
      .map((target) => {
        const mappedMaterials = mappings[target];

        if (!mappedMaterials || mappedMaterials.length === 0) {
          return `${target} -> no seguro/no encontrado`;
        }

        return `${target} -> ${mappedMaterials.join(", ")}`;
      })
      .join("\n");
  }

  private normalizeAssetName(name: string): string {
    return name.toLowerCase().replace(/[\s_\-.]+/g, "");
  }

  private debugLog(...args: unknown[]): void {
    if (CHARACTER_DEBUG) {
      console.log(...args);
    }
  }

  private debugWarn(...args: unknown[]): void {
    if (CHARACTER_DEBUG) {
      console.warn(...args);
    }
  }
}
