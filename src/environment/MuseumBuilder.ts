import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  MeshBuilder,
  PointLight,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";

import type { CameraBounds } from "../camera/CameraManager";
import type { MuseumDistractorAnchors } from "../activities/visual-discrimination/VisualDiscriminationDistractorManager";

interface MuseumMaterials {
  accent: StandardMaterial;
  display: StandardMaterial;
  floor: StandardMaterial;
  glass: StandardMaterial;
  panel: StandardMaterial;
  trim: StandardMaterial;
  wall: StandardMaterial;
  warm: StandardMaterial;
}

interface BoxOptions {
  name: string;
  width: number;
  height: number;
  depth: number;
  position: Vector3;
  material: StandardMaterial;
  castsShadow?: boolean;
  receivesShadow?: boolean;
  collides?: boolean;
  dynamic?: boolean;
  rotationY?: number;
}

export interface MuseumBuildResult {
  explorationEyePosition: Vector3;
  explorationLookAt: Vector3;
  evaluationEyePosition: Vector3;
  evaluationLookAt: Vector3;
  activityPanelMesh: Mesh;
  cameraBounds: CameraBounds;
  collisionMeshes: Mesh[];
  shadowCasters: Mesh[];
  shadowReceivers: Mesh[];
  shadowLight: DirectionalLight;
  distractorAnchors: MuseumDistractorAnchors;
}

export class MuseumBuilder {
  private readonly scene: Scene;
  private readonly materials: MuseumMaterials;
  private readonly shadowCasters: Mesh[] = [];
  private readonly shadowReceivers: Mesh[] = [];
  private readonly collisionMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.materials = this.createMaterials();
  }

  build(): MuseumBuildResult {
    const shadowLight = this.createLighting();

    this.createRoom();
    this.createExhibits();
    this.createVisitors();
    const activityPanelMesh = this.createActivityPanel();
    const distractorAnchors = this.createAnchors();

    return {
      explorationEyePosition: new Vector3(0, 1.52, -5.4),
      explorationLookAt: new Vector3(0, 2.05, 4.9),
      evaluationEyePosition: new Vector3(0, 1.42, -3.85),
      evaluationLookAt: new Vector3(0, 2.25, 5.72),
      activityPanelMesh,
      cameraBounds: {
        minX: -6.8,
        maxX: 6.8,
        minZ: -7.0,
        maxZ: 4.7
      },
      collisionMeshes: [...this.collisionMeshes],
      shadowCasters: [...this.shadowCasters],
      shadowReceivers: [...this.shadowReceivers],
      shadowLight,
      distractorAnchors
    };
  }

  private createMaterials(): MuseumMaterials {
    const wall = this.createMaterial("museumWallMaterial", new Color3(0.68, 0.75, 0.73));
    const floor = this.createMaterial("museumFloorMaterial", new Color3(0.62, 0.63, 0.59));
    const trim = this.createMaterial("museumTrimMaterial", new Color3(0.22, 0.28, 0.3));
    const panel = this.createMaterial("museumPanelMaterial", new Color3(0.08, 0.24, 0.25));
    const warm = this.createMaterial("museumWarmMaterial", new Color3(0.82, 0.68, 0.42));
    const accent = this.createMaterial("museumAccentMaterial", new Color3(0.42, 0.57, 0.68));
    const display = this.createMaterial("museumDisplayMaterial", new Color3(0.11, 0.34, 0.39));
    const glass = this.createMaterial("museumGlassMaterial", new Color3(0.72, 0.88, 0.9));

    panel.emissiveColor = new Color3(0.02, 0.08, 0.08);
    display.emissiveColor = new Color3(0.05, 0.16, 0.17);
    glass.alpha = 0.38;
    glass.specularColor = new Color3(0.6, 0.72, 0.76);
    warm.emissiveColor = new Color3(0.13, 0.08, 0.02);

    return {
      accent,
      display,
      floor,
      glass,
      panel,
      trim,
      wall,
      warm
    };
  }

  private createLighting(): DirectionalLight {
    const ambientLight = new HemisphericLight(
      "museumAmbientLight",
      new Vector3(0, 1, 0),
      this.scene
    );

    ambientLight.intensity = 0.62;
    ambientLight.groundColor = new Color3(0.36, 0.34, 0.3);

    const shadowLight = new DirectionalLight(
      "museumGalleryLight",
      new Vector3(0.35, -0.9, 0.28),
      this.scene
    );

    shadowLight.position = new Vector3(-3.8, 5.6, -2.2);
    shadowLight.intensity = 0.72;

    const panelLight = new PointLight("museumPanelSoftLight", new Vector3(0, 2.7, 3.2), this.scene);

    panelLight.intensity = 0.28;
    panelLight.diffuse = new Color3(0.86, 0.82, 0.68);
    panelLight.specular = new Color3(0.1, 0.09, 0.06);

    return shadowLight;
  }

  private createRoom(): void {
    const floor = MeshBuilder.CreateGround(
      "museumFloor",
      {
        width: 15,
        height: 14,
        subdivisions: 2
      },
      this.scene
    );

    floor.position.z = -1;
    floor.material = this.materials.floor;
    floor.isPickable = false;
    floor.receiveShadows = true;
    floor.checkCollisions = true;
    this.shadowReceivers.push(floor);
    this.collisionMeshes.push(floor);

    this.createBox({
      name: "museumCeiling",
      width: 15,
      height: 0.16,
      depth: 14,
      position: new Vector3(0, 4.55, -1),
      material: this.materials.wall,
      collides: true
    });
    this.createBox({
      name: "museumFrontWall",
      width: 15,
      height: 4.55,
      depth: 0.22,
      position: new Vector3(0, 2.27, 6),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });
    this.createBox({
      name: "museumBackWall",
      width: 15,
      height: 4.55,
      depth: 0.22,
      position: new Vector3(0, 2.27, -8),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });
    this.createBox({
      name: "museumLeftWall",
      width: 0.22,
      height: 4.55,
      depth: 14,
      position: new Vector3(-7.5, 2.27, -1),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });
    this.createBox({
      name: "museumRightWall",
      width: 0.22,
      height: 4.55,
      depth: 14,
      position: new Vector3(7.5, 2.27, -1),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    [-5.2, -2.8, -0.4, 2, 4.4].forEach((zPosition, index) => {
      this.createBox({
        name: `museumFloorGuide${index + 1}`,
        width: 14.4,
        height: 0.012,
        depth: 0.035,
        position: new Vector3(0, 0.016, zPosition),
        material: this.materials.trim
      });
    });

    [-4.6, 4.6].forEach((xPosition, index) => {
      this.createBox({
        name: `museumCeilingLight${index + 1}`,
        width: 2.2,
        height: 0.08,
        depth: 0.72,
        position: new Vector3(xPosition, 4.48, -1.2),
        material: this.materials.warm
      });
    });
  }

  private createExhibits(): void {
    [
      { name: "leftPerceptionPanel", x: -6.95, z: 0.6, title: "PERCEPCION" },
      { name: "rightSciencePanel", x: 6.95, z: -2.2, title: "CIENCIA" }
    ].forEach((panel) => {
      const material = this.createPanelMaterial(`${panel.name}Texture`, panel.title);

      this.createBox({
        name: panel.name,
        width: 0.08,
        height: 1.55,
        depth: 2.0,
        position: new Vector3(panel.x, 2.36, panel.z),
        material,
        rotationY: panel.x < 0 ? Math.PI / 2 : -Math.PI / 2,
        castsShadow: true
      });
    });

    [-3.8, 3.8].forEach((xPosition, index) => {
      this.createBox({
        name: `museumDisplayCaseBase${index + 1}`,
        width: 1.3,
        height: 0.72,
        depth: 1.05,
        position: new Vector3(xPosition, 0.36, -0.55),
        material: this.materials.trim,
        castsShadow: true,
        collides: true
      });
      this.createBox({
        name: `museumDisplayCaseGlass${index + 1}`,
        width: 1.08,
        height: 0.58,
        depth: 0.84,
        position: new Vector3(xPosition, 1.0, -0.55),
        material: this.materials.glass,
        castsShadow: true
      });
      this.createArtifact(`museumArtifact${index + 1}`, new Vector3(xPosition, 1.36, -0.55));
    });
  }

  private createVisitors(): void {
    [
      { name: "museumVisitorLeft", position: new Vector3(-5.4, 0, -4.6) },
      { name: "museumVisitorRight", position: new Vector3(5.45, 0, 1.95) }
    ].forEach((visitor) => {
      const body = MeshBuilder.CreateCylinder(
        `${visitor.name}Body`,
        {
          height: 0.82,
          diameter: 0.28,
          tessellation: 12
        },
        this.scene
      );
      const head = MeshBuilder.CreateSphere(
        `${visitor.name}Head`,
        {
          diameter: 0.28,
          segments: 12
        },
        this.scene
      );

      body.position = visitor.position.add(new Vector3(0, 0.72, 0));
      head.position = visitor.position.add(new Vector3(0, 1.28, 0));
      body.material = this.materials.accent;
      head.material = this.materials.warm;
      body.isPickable = false;
      head.isPickable = false;
      this.shadowCasters.push(body, head);
    });
  }

  private createActivityPanel(): Mesh {
    const panel = MeshBuilder.CreatePlane(
      "visualDiscriminationActivityPanel",
      {
        width: 7.4,
        height: 3.7
      },
      this.scene
    );

    panel.position = new Vector3(0, 2.46, 5.72);
    panel.rotation.y = Math.PI;
    panel.material = this.materials.panel;
    panel.metadata = {
      dynamic: true,
      role: "visual-discrimination-panel"
    };
    panel.isPickable = false;
    this.createBox({
      name: "visualDiscriminationPanelFrameTop",
      width: 7.72,
      height: 0.12,
      depth: 0.14,
      position: new Vector3(0, 4.37, 5.64),
      material: this.materials.warm,
      castsShadow: true
    });
    this.createBox({
      name: "visualDiscriminationPanelFrameBottom",
      width: 7.72,
      height: 0.12,
      depth: 0.14,
      position: new Vector3(0, 0.55, 5.64),
      material: this.materials.warm,
      castsShadow: true
    });

    return panel;
  }

  private createAnchors(): MuseumDistractorAnchors {
    return {
      leftExhibitAnchor: this.createAnchor(
        "museumLeftExhibitDistractorAnchor",
        new Vector3(-5.95, 2.4, 1.15)
      ),
      rightExhibitAnchor: this.createAnchor(
        "museumRightExhibitDistractorAnchor",
        new Vector3(5.95, 2.4, -2.05)
      ),
      backVisitorAnchor: this.createAnchor(
        "museumBackVisitorAudioAnchor",
        new Vector3(-3.8, 1.3, -6.2)
      ),
      robotPathAnchor: this.createAnchor(
        "museumRobotPathAnchor",
        new Vector3(0, 0.46, -5.2)
      )
    };
  }

  private createArtifact(name: string, position: Vector3): void {
    const ring = MeshBuilder.CreateTorus(
      `${name}Ring`,
      {
        diameter: 0.44,
        thickness: 0.035,
        tessellation: 32
      },
      this.scene
    );

    ring.position = position;
    ring.rotation.x = Math.PI / 2;
    ring.material = this.materials.warm;
    ring.isPickable = false;
    this.shadowCasters.push(ring);
  }

  private createPanelMaterial(textureName: string, title: string): StandardMaterial {
    const texture = new DynamicTexture(textureName, { width: 512, height: 512 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    context.fillStyle = "#123038";
    context.fillRect(0, 0, 512, 512);
    context.strokeStyle = "#d9b86a";
    context.lineWidth = 18;
    context.strokeRect(24, 24, 464, 464);
    context.fillStyle = "#edf7f3";
    context.font = "800 52px Arial";
    context.textAlign = "center";
    context.fillText(title, 256, 92);
    context.strokeStyle = "#75aeb7";
    context.lineWidth = 10;
    context.beginPath();
    context.arc(256, 282, 94, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#d9b86a";
    context.fillRect(148, 382, 216, 32);
    texture.update();

    const material = new StandardMaterial(`${textureName}Material`, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.16, 0.25, 0.25);
    material.specularColor = new Color3(0, 0, 0);

    return material;
  }

  private createAnchor(name: string, position: Vector3): TransformNode {
    const anchor = new TransformNode(name, this.scene);

    anchor.position = position;
    anchor.metadata = {
      role: "museum-distractor-anchor"
    };

    return anchor;
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.specularColor = new Color3(0.1, 0.11, 0.1);

    return material;
  }

  private createBox(options: BoxOptions): Mesh {
    const mesh = MeshBuilder.CreateBox(
      options.name,
      {
        width: options.width,
        height: options.height,
        depth: options.depth
      },
      this.scene
    );

    mesh.position = options.position;
    mesh.rotation.y = options.rotationY ?? 0;
    mesh.material = options.material;
    mesh.isPickable = false;

    if (options.dynamic) {
      mesh.metadata = { dynamic: true };
    }

    if (options.castsShadow) {
      this.shadowCasters.push(mesh);
    }

    if (options.receivesShadow) {
      mesh.receiveShadows = true;
      this.shadowReceivers.push(mesh);
    }

    if (options.collides) {
      mesh.checkCollisions = true;
      this.collisionMeshes.push(mesh);
    }

    return mesh;
  }
}
