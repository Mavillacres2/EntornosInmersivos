import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type {
  AbstractMesh,
  AssetContainer,
  Mesh,
  Scene
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

import { SPACE_CHARACTER_CONFIGS } from "./SpaceCharacterConfig";
import type { SpaceCharacterConfig } from "./SpaceCharacterConfig";

interface ManagedSpaceCharacter {
  root: TransformNode;
  meshes: AbstractMesh[];
  materials: StandardMaterial[];
  container: AssetContainer | null;
  config: SpaceCharacterConfig;
}

export class SpaceCharacterManager {
  private readonly scene: Scene;
  private readonly characters: ManagedSpaceCharacter[] = [];
  private activityParticipantTarget: Vector3 | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async initialize(): Promise<void> {
    for (const config of SPACE_CHARACTER_CONFIGS) {
      const character = await this.createCharacter(config);

      this.characters.push(character);
      this.applyActivityParticipantLook(character);
    }
  }

  lookAtActivityParticipant(target: Vector3): void {
    this.activityParticipantTarget = target.clone();
    this.characters.forEach((character) => {
      this.applyActivityParticipantLook(character);
    });
  }

  dispose(): void {
    this.characters.forEach((character) => {
      character.container?.dispose();
      character.materials.forEach((material) => {
        material.dispose();
      });
      character.root.dispose();
    });
    this.characters.length = 0;
  }

  private async createCharacter(
    config: SpaceCharacterConfig
  ): Promise<ManagedSpaceCharacter> {
    const modelUrl = await this.resolveModelUrl(config);

    if (!modelUrl) {
      console.warn(
        `No se encontro un modelo GLB para ${config.id}. Se usara placeholder hasta que agregues el archivo.`
      );
      return this.createFallbackCharacter(config);
    }

    try {
      return await this.loadGlbCharacter(config, modelUrl);
    } catch (error: unknown) {
      console.warn(
        `No se pudo cargar ${modelUrl}. Se usara placeholder.`,
        error
      );
      return this.createFallbackCharacter(config);
    }
  }

  private async resolveModelUrl(config: SpaceCharacterConfig): Promise<string | null> {
    const candidates = [
      config.modelUrl,
      ...(config.modelUrlCandidates ?? [])
    ].filter((candidate, index, allCandidates) =>
      Boolean(candidate) && allCandidates.indexOf(candidate) === index
    );

    for (const candidate of candidates) {
      if (await this.modelExists(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async modelExists(modelUrl: string): Promise<boolean> {
    try {
      const response = await fetch(modelUrl, {
        method: "HEAD"
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async loadGlbCharacter(
    config: SpaceCharacterConfig,
    modelUrl: string
  ): Promise<ManagedSpaceCharacter> {
    const container = await LoadAssetContainerAsync(modelUrl, this.scene);
    const root = new TransformNode(`${config.id}Root`, this.scene);

    container.animationGroups.forEach((animationGroup) => {
      animationGroup.stop();
    });
    container.addAllToScene();
    container.transformNodes.forEach((node) => {
      if (!node.parent) {
        node.parent = root;
      }
    });
    container.meshes.forEach((mesh) => {
      if (!mesh.parent) {
        mesh.parent = root;
      }

      this.prepareImportedMesh(mesh);
    });
    this.hideImportedScenePropMeshes(container.meshes);

    root.position.copyFrom(config.position);
    root.rotation.y = this.getConfiguredRotationY(config);
    root.scaling.setAll(1);
    root.metadata = {
      role: "space-character",
      id: config.id,
      label: config.label,
      source: modelUrl
    };
    this.normalizeImportedCharacterHeight(root, config.targetHeight);
    root.scaling.scaleInPlace(config.scaling);
    this.centerImportedCharacterOnRoot(root);
    this.alignCharacterBottomToY(root, config.position.y);

    return {
      root,
      meshes: container.meshes,
      materials: [],
      container,
      config
    };
  }

  private createFallbackCharacter(
    config: SpaceCharacterConfig
  ): ManagedSpaceCharacter {
    const root = new TransformNode(`${config.id}FallbackRoot`, this.scene);
    const suitMaterial = this.createMaterial(
      `${config.id}FallbackSuitMaterial`,
      config.fallbackColor
    );
    const visorMaterial = this.createMaterial(
      `${config.id}FallbackVisorMaterial`,
      new Color3(0.08, 0.16, 0.2)
    );
    const accentMaterial = this.createMaterial(
      `${config.id}FallbackAccentMaterial`,
      new Color3(0.3, 0.68, 0.74)
    );
    const meshes: Mesh[] = [];

    const body = MeshBuilder.CreateCylinder(
      `${config.id}FallbackBody`,
      {
        height: 0.9,
        diameterTop: 0.32,
        diameterBottom: 0.4,
        tessellation: 14
      },
      this.scene
    );

    body.parent = root;
    body.position.y = 0.92;
    body.material = suitMaterial;
    meshes.push(body);

    const helmet = MeshBuilder.CreateSphere(
      `${config.id}FallbackHelmet`,
      {
        diameter: 0.42,
        segments: 18
      },
      this.scene
    );

    helmet.parent = root;
    helmet.position.y = 1.52;
    helmet.material = suitMaterial;
    meshes.push(helmet);

    const visor = MeshBuilder.CreateBox(
      `${config.id}FallbackVisor`,
      {
        width: 0.28,
        height: 0.12,
        depth: 0.035
      },
      this.scene
    );

    visor.parent = root;
    visor.position.set(0, 1.54, -0.2);
    visor.material = visorMaterial;
    meshes.push(visor);

    [-0.28, 0.28].forEach((xPosition, index) => {
      const arm = MeshBuilder.CreateCylinder(
        `${config.id}FallbackArm${index + 1}`,
        {
          height: 0.58,
          diameter: 0.11,
          tessellation: 10
        },
        this.scene
      );

      arm.parent = root;
      arm.position.set(xPosition, 1.02, 0);
      arm.rotation.z = xPosition > 0 ? -0.22 : 0.22;
      arm.material = suitMaterial;
      meshes.push(arm);
    });

    [-0.12, 0.12].forEach((xPosition, index) => {
      const leg = MeshBuilder.CreateCylinder(
        `${config.id}FallbackLeg${index + 1}`,
        {
          height: 0.62,
          diameter: 0.12,
          tessellation: 10
        },
        this.scene
      );

      leg.parent = root;
      leg.position.set(xPosition, 0.32, 0);
      leg.material = suitMaterial;
      meshes.push(leg);
    });

    const badge = MeshBuilder.CreateBox(
      `${config.id}FallbackBadge`,
      {
        width: 0.12,
        height: 0.08,
        depth: 0.035
      },
      this.scene
    );

    badge.parent = root;
    badge.position.set(0.09, 1.12, -0.2);
    badge.material = accentMaterial;
    meshes.push(badge);

    root.position = config.position.clone();
    root.rotation.y = this.getConfiguredRotationY(config);
    root.scaling.setAll(config.scaling);
    root.metadata = {
      role: "space-character-fallback",
      id: config.id,
      label: config.label
    };

    meshes.forEach((mesh) => {
      mesh.isPickable = false;
      mesh.checkCollisions = false;
    });

    return {
      root,
      meshes,
      materials: [suitMaterial, visorMaterial, accentMaterial],
      container: null,
      config
    };
  }

  private applyActivityParticipantLook(character: ManagedSpaceCharacter): void {
    if (!this.activityParticipantTarget || !character.config.facesActivityParticipant) {
      return;
    }

    character.root.rotation.y =
      this.getLookAtY(character.root.position, this.activityParticipantTarget) +
      (character.config.rotationOffsetY ?? 0);
  }

  private getConfiguredRotationY(config: SpaceCharacterConfig): number {
    return config.rotationY + (config.rotationOffsetY ?? 0);
  }

  private getLookAtY(position: Vector3, target: Vector3): number {
    return Math.atan2(target.x - position.x, target.z - position.z);
  }

  private prepareImportedMesh(mesh: AbstractMesh): void {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      dynamic: true,
      role: "space-character-mesh"
    };
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
    });
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

  private normalizeAssetName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.specularColor = new Color3(0.08, 0.1, 0.12);

    return material;
  }
}
