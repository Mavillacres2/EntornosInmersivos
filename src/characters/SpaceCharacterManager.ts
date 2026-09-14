import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode
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
}

export class SpaceCharacterManager {
  private readonly scene: Scene;
  private readonly characters: ManagedSpaceCharacter[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async initialize(): Promise<void> {
    for (const config of SPACE_CHARACTER_CONFIGS) {
      const character = await this.createCharacter(config);

      this.characters.push(character);
    }
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
    try {
      return await this.loadGlbCharacter(config);
    } catch (error: unknown) {
      console.warn(
        `No se pudo cargar ${config.modelUrl}. Se usara placeholder.`,
        error
      );
      return this.createFallbackCharacter(config);
    }
  }

  private async loadGlbCharacter(
    config: SpaceCharacterConfig
  ): Promise<ManagedSpaceCharacter> {
    const container = await LoadAssetContainerAsync(config.modelUrl, this.scene);
    const root = new TransformNode(`${config.id}Root`, this.scene);

    container.animationGroups.forEach((animationGroup) => {
      animationGroup.stop();
    });
    container.addAllToScene();
    container.meshes.forEach((mesh) => {
      if (!mesh.parent) {
        mesh.parent = root;
      }

      mesh.isPickable = false;
      mesh.checkCollisions = false;
    });

    root.position = config.position.clone();
    root.rotation.y = config.rotationY;
    root.scaling.setAll(config.scaling);
    root.metadata = {
      role: "space-character",
      id: config.id,
      label: config.label
    };

    return {
      root,
      meshes: container.meshes,
      materials: [],
      container
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
    root.rotation.y = config.rotationY;
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
      container: null
    };
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.specularColor = new Color3(0.08, 0.1, 0.12);

    return material;
  }
}
