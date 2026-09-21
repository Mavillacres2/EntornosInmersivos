import {
  Color3,
  DirectionalLight,
  DynamicTexture,
  HemisphericLight,
  MeshBuilder,
  PointLight,
  SpotLight,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";

import type { MuseumDistractorAnchors } from "../activities/visual-discrimination/VisualDiscriminationDistractorManager";
import type { CameraBounds } from "../camera/CameraManager";

interface MuseumMaterials {
  accent: StandardMaterial;
  accentWall: StandardMaterial;
  charcoal: StandardMaterial;
  display: StandardMaterial;
  floor: StandardMaterial;
  glass: StandardMaterial;
  gold: StandardMaterial;
  lightPanel: StandardMaterial;
  panel: StandardMaterial;
  plantLeaf: StandardMaterial;
  stone: StandardMaterial;
  trim: StandardMaterial;
  wall: StandardMaterial;
  warm: StandardMaterial;
  wood: StandardMaterial;
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
  hideDuringEvaluation?: boolean;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
}

export interface MuseumBuildResult {
  explorationEyePosition: Vector3;
  explorationLookAt: Vector3;
  evaluationEyePosition: Vector3;
  evaluationLookAt: Vector3;
  activityPanelMesh: Mesh;
  cameraBounds: CameraBounds;
  collisionMeshes: Mesh[];
  evaluationHiddenMeshes: Mesh[];
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
  private readonly evaluationHiddenMeshes: Mesh[] = [];
  private readonly assessmentClearZone = {
    minX: -3.25,
    maxX: 3.25,
    minZ: -3.95,
    maxZ: 5.8
  };

  constructor(scene: Scene) {
    this.scene = scene;
    this.materials = this.createMaterials();
  }

  build(): MuseumBuildResult {
    const shadowLight = this.createLighting();

    this.createRoom();
    this.createReceptionArea();
    this.createPerceptionGallery();
    this.createArtGallery();
    this.createScienceExhibits();
    this.createDisplayCases();
    this.createSculptures();
    this.createCentralInstallation();
    this.createFurnitureAndPlants();
    const activityPanelMesh = this.createActivityPanel();
    const distractorAnchors = this.createAnchors();

    return {
      explorationEyePosition: new Vector3(0, 1.52, -1.25),
      explorationLookAt: new Vector3(0, 2.15, 4.6),
      evaluationEyePosition: new Vector3(0, 1.42, -3.85),
      evaluationLookAt: new Vector3(0, 2.25, 5.72),
      activityPanelMesh,
      cameraBounds: {
        minX: -6.85,
        maxX: 6.85,
        minZ: -7,
        maxZ: 4.65
      },
      collisionMeshes: [...this.collisionMeshes],
      evaluationHiddenMeshes: [...this.evaluationHiddenMeshes],
      shadowCasters: [...this.shadowCasters],
      shadowReceivers: [...this.shadowReceivers],
      shadowLight,
      distractorAnchors
    };
  }

  private createMaterials(): MuseumMaterials {
    const wall = this.createMaterial("museumWarmWallMaterial", new Color3(0.78, 0.76, 0.68));
    const accentWall = this.createMaterial("museumPetrolAccentWallMaterial", new Color3(0.08, 0.24, 0.27));
    const floor = this.createMaterial("museumPolishedFloorMaterial", new Color3(0.68, 0.66, 0.6));
    const trim = this.createMaterial("museumSoftTrimMaterial", new Color3(0.34, 0.35, 0.32));
    const panel = this.createMaterial("museumPanelMaterial", new Color3(0.06, 0.22, 0.24));
    const warm = this.createMaterial("museumWarmLightMaterial", new Color3(0.9, 0.78, 0.52));
    const gold = this.createMaterial("museumMutedGoldMaterial", new Color3(0.74, 0.58, 0.28));
    const accent = this.createMaterial("museumBlueAccentMaterial", new Color3(0.34, 0.55, 0.64));
    const display = this.createMaterial("museumDisplayMaterial", new Color3(0.1, 0.32, 0.35));
    const glass = this.createMaterial("museumGlassMaterial", new Color3(0.74, 0.88, 0.9));
    const wood = this.createMaterial("museumLightWoodMaterial", new Color3(0.66, 0.46, 0.28));
    const stone = this.createMaterial("museumStoneMaterial", new Color3(0.48, 0.5, 0.48));
    const charcoal = this.createMaterial("museumCharcoalMaterial", new Color3(0.12, 0.15, 0.16));
    const lightPanel = this.createMaterial("museumLightPanelMaterial", new Color3(1, 0.92, 0.72));
    const plantLeaf = this.createMaterial("museumPlantLeafMaterial", new Color3(0.22, 0.47, 0.28));
    panel.emissiveColor = new Color3(0.015, 0.06, 0.065);
    display.emissiveColor = new Color3(0.025, 0.09, 0.09);
    glass.alpha = 0.34;
    glass.specularColor = new Color3(0.6, 0.72, 0.76);
    warm.emissiveColor = new Color3(0.34, 0.25, 0.08);
    lightPanel.emissiveColor = new Color3(0.82, 0.7, 0.42);
    lightPanel.disableLighting = true;
    floor.specularColor = new Color3(0.16, 0.15, 0.13);

    return {
      accent,
      accentWall,
      charcoal,
      display,
      floor,
      glass,
      gold,
      lightPanel,
      panel,
      plantLeaf,
      stone,
      trim,
      wall,
      warm,
      wood
    };
  }

  private createLighting(): DirectionalLight {
    const ambientLight = new HemisphericLight("museumAmbientLight", new Vector3(0, 1, 0), this.scene);

    ambientLight.intensity = 0.54;
    ambientLight.groundColor = new Color3(0.34, 0.32, 0.28);

    const shadowLight = new DirectionalLight("museumGalleryLight", new Vector3(0.36, -0.9, 0.24), this.scene);

    shadowLight.position = new Vector3(-4.2, 5.7, -2.4);
    shadowLight.intensity = 0.68;

    [
      new Vector3(-4.7, 3.1, -0.9),
      new Vector3(4.7, 3.1, -1.8),
      new Vector3(0, 3.2, 2.8)
    ].forEach((position, index) => {
      const light = new PointLight(`museumWarmExhibitLight${index + 1}`, position, this.scene);

      light.intensity = index === 2 ? 0.2 : 0.16;
      light.diffuse = new Color3(0.94, 0.82, 0.58);
      light.specular = new Color3(0.12, 0.1, 0.06);
    });

    [
      { name: "central", position: new Vector3(-4.1, 4.15, -0.9), target: new Vector3(-4.1, 0, -0.9) },
      { name: "art", position: new Vector3(-5.8, 3.75, -0.4), target: new Vector3(-7.1, 2.2, -0.4) },
      { name: "science", position: new Vector3(5.8, 3.75, -2.4), target: new Vector3(7.1, 2.1, -2.4) }
    ].forEach((spotData) => {
      const spot = new SpotLight(
        `museumSpotlight-${spotData.name}`,
        spotData.position,
        spotData.target.subtract(spotData.position).normalize(),
        Math.PI / 4.6,
        8,
        this.scene
      );

      spot.intensity = 0.34;
      spot.diffuse = new Color3(1, 0.86, 0.62);
      spot.specular = new Color3(0.16, 0.13, 0.08);
    });

    return shadowLight;
  }

  private createRoom(): void {
    const floor = MeshBuilder.CreateGround("museumFloor", { width: 15, height: 14, subdivisions: 2 }, this.scene);

    floor.position.z = -1;
    floor.material = this.materials.floor;
    floor.isPickable = false;
    floor.receiveShadows = true;
    floor.checkCollisions = true;
    this.shadowReceivers.push(floor);
    this.collisionMeshes.push(floor);

    this.createBox({ name: "museumCeiling", width: 15, height: 0.16, depth: 14, position: new Vector3(0, 4.55, -1), material: this.materials.wall, collides: true });
    this.createBox({ name: "museumFrontWall", width: 15, height: 4.55, depth: 0.22, position: new Vector3(0, 2.27, 6), material: this.materials.wall, receivesShadow: true, collides: true });
    this.createBox({ name: "museumBackWall", width: 15, height: 4.55, depth: 0.22, position: new Vector3(0, 2.27, -8), material: this.materials.wall, receivesShadow: true, collides: true });
    this.createBox({ name: "museumLeftWall", width: 0.22, height: 4.55, depth: 14, position: new Vector3(-7.5, 2.27, -1), material: this.materials.wall, receivesShadow: true, collides: true });
    this.createBox({ name: "museumRightWall", width: 0.22, height: 4.55, depth: 14, position: new Vector3(7.5, 2.27, -1), material: this.materials.wall, receivesShadow: true, collides: true });

    this.createArchitecturalPanels();
    this.createSubtleFloorTiles();
    this.createCeilingLightingTracks();
  }

  private createArchitecturalPanels(): void {
    this.createBox({ name: "leftArtAccent", width: 0.06, height: 3.2, depth: 4.3, position: new Vector3(-7.36, 2.32, 0.65), material: this.materials.accentWall });
    this.createBox({ name: "rightScienceAccent", width: 0.06, height: 3.2, depth: 4, position: new Vector3(7.36, 2.32, -2.05), material: this.materials.accentWall });

    [-5.6, -2.8, 2.8, 5.6].forEach((xPosition, index) => {
      this.createBox({ name: `museumFrontWoodPilaster${index + 1}`, width: 0.18, height: 3.7, depth: 0.1, position: new Vector3(xPosition, 2.1, 5.83), material: this.materials.wood });
    });

    [-7.3, 7.3].forEach((xPosition, index) => {
      this.createBox({ name: `museumSideBaseboard${index + 1}`, width: 0.1, height: 0.18, depth: 13.6, position: new Vector3(xPosition, 0.18, -1), material: this.materials.trim });
    });
    [-7.86, 5.86].forEach((zPosition, index) => {
      this.createBox({ name: `museumFrontBackBaseboard${index + 1}`, width: 14.5, height: 0.18, depth: 0.1, position: new Vector3(0, 0.18, zPosition), material: this.materials.trim });
    });
  }

  private createSubtleFloorTiles(): void {
    const joint = this.createMaterial("museumFloorJointMaterial", new Color3(0.5, 0.49, 0.45));

    joint.alpha = 0.42;
    [-5.6, -3.2, -0.8, 1.6, 4].forEach((zPosition, index) => {
      this.createBox({ name: `museumSubtleFloorJointZ${index + 1}`, width: 14.4, height: 0.008, depth: 0.018, position: new Vector3(0, 0.012, zPosition), material: joint });
    });
    [-4.8, -2.4, 0, 2.4, 4.8].forEach((xPosition, index) => {
      this.createBox({ name: `museumSubtleFloorJointX${index + 1}`, width: 0.018, height: 0.009, depth: 13.4, position: new Vector3(xPosition, 0.014, -1), material: joint });
    });
  }

  private createCeilingLightingTracks(): void {
    [-3.8, 0, 3.8].forEach((xPosition, index) => {
      this.createBox({ name: `museumCeilingTrack${index + 1}`, width: 0.08, height: 0.09, depth: 10.8, position: new Vector3(xPosition, 4.42, -0.9), material: this.materials.charcoal });
    });
    [
      { x: -3.8, z: -4.6 }, { x: 0, z: -3.2 }, { x: 3.8, z: -4.2 },
      { x: -3.8, z: 0.4 }, { x: 0, z: 1.1 }, { x: 3.8, z: 0.2 },
      { x: -3.8, z: 3.7 }, { x: 3.8, z: 3.2 }
    ].forEach((fixture, index) => {
      this.createBox({ name: `museumDirectionalLightFixture${index + 1}`, width: 0.32, height: 0.12, depth: 0.42, position: new Vector3(fixture.x, 4.31, fixture.z), material: this.materials.lightPanel });
    });
  }

  private createReceptionArea(): void {
    this.createEntranceDoor();
    this.createEntranceWindows();
    this.createBackWelcomeDetails();
    this.createBox({ name: "museumReceptionDesk", width: 3.2, height: 0.78, depth: 0.72, position: new Vector3(0, 0.39, -7.02), material: this.materials.wood, castsShadow: true, collides: true });
    this.createBox({ name: "museumReceptionTop", width: 3.35, height: 0.12, depth: 0.84, position: new Vector3(0, 0.84, -7.02), material: this.materials.gold, castsShadow: true, collides: true });
    this.createMuseumSign({ name: "museumWelcomeSign", title: "MUSEO DE CIENCIA Y PERCEPCION", subtitle: "Explora - Observa - Descubre", width: 4.95, height: 0.92, position: new Vector3(0, 2.95, -7.86), rotationY: Math.PI });
    this.createMuseumSign({ name: "museumDirectorySign", title: "DIRECTORIO", subtitle: "Arte | Ciencia | Percepcion | Actividad", width: 1.9, height: 0.94, position: new Vector3(3.85, 1.85, -7.84), rotationY: Math.PI });
    this.createPlant(new Vector3(-2.55, 0, -7.15), 0.95);
    this.createPlant(new Vector3(2.55, 0, -7.15), 0.95);
  }

  private createBackWelcomeDetails(): void {
    this.createIllustratedWallPanel({
      name: "museumRouteMapPanel",
      title: "Ruta del museo",
      style: "museumMap",
      width: 1.08,
      height: 0.78,
      position: new Vector3(-6.35, 1.72, -7.84),
      rotationY: Math.PI
    });
    this.createIllustratedWallPanel({
      name: "museumColorWelcomePanel",
      title: "Color y mirada",
      style: "colorWheel",
      width: 1.08,
      height: 0.78,
      position: new Vector3(5.85, 1.55, -7.84),
      rotationY: Math.PI
    });
    this.createBrochureStand(new Vector3(6.38, 0, -6.72));
    this.createWelcomeOrbDisplay(new Vector3(-6.25, 0, -6.7));
    this.createMuseumBackWallPosters();
    this.createMuseumGuideTable(new Vector3(1.45, 0, -6.46));
    this.createReceptionQueueDetails();
  }

  private createEntranceDoor(): void {
    const doorPosition = new Vector3(-4.35, 1.28, -7.84);

    this.createBox({
      name: "museumWoodEntranceDoor",
      width: 1.35,
      height: 2.42,
      depth: 0.08,
      position: doorPosition,
      material: this.materials.wood,
      castsShadow: true
    });
    this.createBox({
      name: "museumEntranceDoorFrameTop",
      width: 1.56,
      height: 0.12,
      depth: 0.12,
      position: new Vector3(-4.35, 2.55, -7.78),
      material: this.materials.gold,
      castsShadow: true
    });
    [-0.74, 0.74].forEach((offset, index) => {
      this.createBox({
        name: `museumEntranceDoorFrameSide${index + 1}`,
        width: 0.1,
        height: 2.55,
        depth: 0.12,
        position: new Vector3(-4.35 + offset, 1.3, -7.78),
        material: this.materials.gold,
        castsShadow: true
      });
    });
    [-0.32, 0.32].forEach((xOffset, index) => {
      this.createBox({
        name: `museumEntranceDoorWindow${index + 1}`,
        width: 0.38,
        height: 0.52,
        depth: 0.035,
        position: new Vector3(-4.35 + xOffset, 1.95, -7.77),
        material: this.materials.glass
      });
    });
    this.createBox({
      name: "museumEntranceDoorHandle",
      width: 0.08,
      height: 0.16,
      depth: 0.04,
      position: new Vector3(-3.86, 1.18, -7.75),
      material: this.materials.gold
    });
  }

  private createEntranceWindows(): void {
    [
      { name: "Left", x: 5.52 },
      { name: "Right", x: 6.58 }
    ].forEach((windowData) => {
      const center = new Vector3(windowData.x, 2.64, -7.82);

      this.createBox({
        name: `museumBackWindow${windowData.name}OuterFrame`,
        width: 0.78,
        height: 0.88,
        depth: 0.075,
        position: center,
        material: this.materials.gold,
        castsShadow: true
      });
      this.createBox({
        name: `museumBackWindow${windowData.name}Recess`,
        width: 0.62,
        height: 0.72,
        depth: 0.045,
        position: new Vector3(center.x, center.y, -7.775),
        material: this.materials.charcoal
      });
      this.createBox({
        name: `museumBackWindow${windowData.name}Glass`,
        width: 0.52,
        height: 0.62,
        depth: 0.035,
        position: new Vector3(center.x, center.y, -7.735),
        material: this.materials.glass
      });
      this.createBox({
        name: `museumBackWindow${windowData.name}MullionVertical`,
        width: 0.032,
        height: 0.62,
        depth: 0.045,
        position: new Vector3(center.x, center.y, -7.7),
        material: this.materials.gold
      });
      this.createBox({
        name: `museumBackWindow${windowData.name}MullionHorizontal`,
        width: 0.52,
        height: 0.032,
        depth: 0.045,
        position: new Vector3(center.x, center.y, -7.695),
        material: this.materials.gold
      });
      this.createBox({
        name: `museumBackWindow${windowData.name}Sill`,
        width: 0.92,
        height: 0.08,
        depth: 0.16,
        position: new Vector3(center.x, 2.15, -7.72),
        material: this.materials.wood,
        castsShadow: true
      });
      this.createBox({
        name: `museumBackWindow${windowData.name}Header`,
        width: 0.92,
        height: 0.07,
        depth: 0.12,
        position: new Vector3(center.x, 3.12, -7.74),
        material: this.materials.gold
      });
    });
  }

  private createBrochureStand(position: Vector3): void {
    this.createBox({
      name: "museumBrochureStandBase",
      width: 0.64,
      height: 0.12,
      depth: 0.42,
      position: position.add(new Vector3(0, 0.06, 0)),
      material: this.materials.charcoal,
      castsShadow: true,
      collides: true
    });
    this.createBox({
      name: "museumBrochureStandBack",
      width: 0.64,
      height: 0.92,
      depth: 0.08,
      position: position.add(new Vector3(0, 0.5, -0.16)),
      material: this.materials.wood,
      castsShadow: true
    });
    [0.12, 0.34, 0.56].forEach((height, shelfIndex) => {
      this.createBox({
        name: `museumBrochureStandShelf${shelfIndex + 1}`,
        width: 0.58,
        height: 0.035,
        depth: 0.24,
        position: position.add(new Vector3(0, height, 0.02)),
        material: this.materials.gold,
        castsShadow: true
      });
    });
    [
      { x: -0.18, color: this.materials.accent },
      { x: 0, color: this.materials.lightPanel },
      { x: 0.18, color: this.materials.panel }
    ].forEach((item, index) => {
      this.createBox({
        name: `museumBrochureCard${index + 1}`,
        width: 0.13,
        height: 0.26,
        depth: 0.025,
        position: position.add(new Vector3(item.x, 0.48 + index * 0.04, 0.14)),
        material: item.color,
        rotationX: -0.22,
        castsShadow: true
      });
    });
  }

  private createWelcomeOrbDisplay(position: Vector3): void {
    this.createPedestal("museumWelcomeOrbPedestal", position, 0.72, 0.54, "Explora");

    const orb = MeshBuilder.CreateSphere("museumWelcomeOrb", { diameter: 0.32, segments: 18 }, this.scene);
    const ringA = MeshBuilder.CreateTorus("museumWelcomeOrbRingA", { diameter: 0.52, thickness: 0.018, tessellation: 44 }, this.scene);
    const ringB = MeshBuilder.CreateTorus("museumWelcomeOrbRingB", { diameter: 0.42, thickness: 0.014, tessellation: 36 }, this.scene);

    orb.position = position.add(new Vector3(0, 1.0, 0));
    orb.material = this.materials.accent;
    orb.isPickable = false;
    ringA.position = orb.position.clone();
    ringA.rotation.x = Math.PI / 2.25;
    ringA.rotation.z = Math.PI / 9;
    ringA.material = this.materials.gold;
    ringA.isPickable = false;
    ringB.position = orb.position.clone();
    ringB.rotation.x = Math.PI / 2;
    ringB.rotation.y = Math.PI / 3.5;
    ringB.material = this.materials.lightPanel;
    ringB.isPickable = false;
    this.shadowCasters.push(orb, ringA, ringB);
  }

  private createMuseumBackWallPosters(): void {
    this.createIllustratedWallPanel({
      name: "museumTemporaryExhibitPanel",
      title: "Exhibicion",
      style: "museumMap",
      width: 0.92,
      height: 0.68,
      position: new Vector3(-0.95, 1.72, -7.84),
      rotationY: Math.PI
    });
    this.createIllustratedWallPanel({
      name: "museumVisitorGuidePanel",
      title: "Guia visual",
      style: "colorWheel",
      width: 0.92,
      height: 0.68,
      position: new Vector3(1.05, 1.72, -7.84),
      rotationY: Math.PI
    });
  }

  private createMuseumGuideTable(position: Vector3): void {
    this.createBox({
      name: "museumGuideTableBase",
      width: 1.06,
      height: 0.56,
      depth: 0.56,
      position: position.add(new Vector3(0, 0.28, 0)),
      material: this.materials.wood,
      castsShadow: true,
      collides: true
    });
    this.createBox({
      name: "museumGuideTableTop",
      width: 1.16,
      height: 0.08,
      depth: 0.66,
      position: position.add(new Vector3(0, 0.6, 0)),
      material: this.materials.gold,
      castsShadow: true,
      collides: true
    });
    [-0.32, -0.08, 0.16, 0.38].forEach((xOffset, index) => {
      this.createBox({
        name: `museumGuideFoldedMap${index + 1}`,
        width: 0.18,
        height: 0.035,
        depth: 0.28,
        position: position.add(new Vector3(xOffset, 0.67 + index * 0.012, -0.03)),
        material: index % 2 === 0 ? this.materials.lightPanel : this.materials.accent,
        rotationY: index % 2 === 0 ? 0.18 : -0.12,
        castsShadow: true
      });
    });
    [
      { x: -0.38, z: 0.2, diameter: 0.12, material: this.materials.accent },
      { x: -0.22, z: 0.18, diameter: 0.09, material: this.materials.gold },
      { x: 0.32, z: 0.2, diameter: 0.1, material: this.materials.stone }
    ].forEach((item, index) => {
      const paperweight = MeshBuilder.CreateSphere(`museumGuideTableObject${index + 1}`, { diameter: item.diameter, segments: 12 }, this.scene);

      paperweight.position = position.add(new Vector3(item.x, 0.73, item.z));
      paperweight.material = item.material;
      paperweight.isPickable = false;
      this.shadowCasters.push(paperweight);
    });
    this.createMuseumLabel("Folletos", position.add(new Vector3(0, 0.82, -0.36)), 0);
  }

  private createReceptionQueueDetails(): void {
    const postPositions = [-1.8, -0.6, 0.6, 1.8];

    postPositions.forEach((xPosition, index) => {
      const post = MeshBuilder.CreateCylinder(`museumReceptionPost${index + 1}`, { height: 0.78, diameter: 0.055, tessellation: 10 }, this.scene);
      const cap = MeshBuilder.CreateSphere(`museumReceptionPostCap${index + 1}`, { diameter: 0.14, segments: 10 }, this.scene);

      post.position = new Vector3(xPosition, 0.39, -6.04);
      post.material = this.materials.gold;
      post.isPickable = false;
      cap.position = new Vector3(xPosition, 0.81, -6.04);
      cap.material = this.materials.gold;
      cap.isPickable = false;
      this.shadowCasters.push(post, cap);
    });

    for (let index = 0; index < postPositions.length - 1; index += 1) {
      const start = postPositions[index];
      const end = postPositions[index + 1];
      const rope = MeshBuilder.CreateCylinder(`museumReceptionRope${index + 1}`, { height: end - start, diameter: 0.035, tessellation: 10 }, this.scene);

      rope.position = new Vector3((start + end) / 2, 0.76, -6.04);
      rope.rotation.z = Math.PI / 2;
      rope.material = this.materials.accent;
      rope.isPickable = false;
      this.shadowCasters.push(rope);
    }
  }

  private createPerceptionGallery(): void {
    this.createMuseumSign({ name: "perceptionGallerySign", title: "PERCEPCION VISUAL", subtitle: "Observamos, interpretamos y respondemos", width: 2.5, height: 0.5, position: new Vector3(-7.32, 3.75, -4.35), rotationY: -Math.PI / 2 });
    [
      { name: "perceptionEyeBrainPanel", title: "Como percibimos?", style: "eyeBrain" as const, position: new Vector3(-7.33, 2.68, -5.55) },
      { name: "visualAttentionPanel", title: "Atencion visual", style: "attention" as const, position: new Vector3(-7.33, 2.72, -4.25) },
      { name: "formsDifferencesPanel", title: "Formas y diferencias", style: "forms" as const, position: new Vector3(-7.33, 2.68, -2.95) }
    ].forEach((panel) => {
      this.createIllustratedWallPanel({
        ...panel,
        width: 1.05,
        height: 0.86,
        rotationY: -Math.PI / 2
      });
    });
    this.createBench("perceptionGalleryBench", new Vector3(-5.6, 0, -4.28), Math.PI / 2);
    this.createPrismExhibit(new Vector3(-5.75, 0, -5.6));
    this.createPlant(new Vector3(-6.85, 0, -2.35), 1.08);
  }

  private createArtGallery(): void {
    this.createMuseumSign({ name: "artZoneSign", title: "GALERIA DE ARTE", subtitle: "Formas, color y movimiento", width: 2.45, height: 0.48, position: new Vector3(-7.32, 3.86, 0.6), rotationY: -Math.PI / 2 });
    [
      { name: "paintingMovement", title: "Movimiento", style: "waves" as const, seed: 11, width: 1.25, height: 0.9, position: new Vector3(-7.34, 2.95, 2.6), rotationY: -Math.PI / 2 },
      { name: "paintingNature", title: "Naturaleza", style: "organic" as const, seed: 29, width: 1, height: 1.15, position: new Vector3(-7.34, 2.35, 1.24), rotationY: -Math.PI / 2 },
      { name: "paintingGeometry", title: "Geometria", style: "geometric" as const, seed: 43, width: 1.35, height: 0.92, position: new Vector3(-7.34, 2.9, -0.25), rotationY: -Math.PI / 2 },
      { name: "paintingDepth", title: "Profundidad", style: "depth" as const, seed: 73, width: 1.1, height: 0.92, position: new Vector3(-7.34, 2.22, -1.65), rotationY: -Math.PI / 2 },
      { name: "paintingUniverse", title: "Universo", style: "orbit" as const, seed: 101, width: 1.18, height: 0.88, position: new Vector3(-7.34, 3.18, 4.1), rotationY: -Math.PI / 2 },
      { name: "paintingContrast", title: "Contraste", style: "contrast" as const, seed: 157, width: 1.08, height: 0.86, position: new Vector3(-7.34, 2.25, 4.1), rotationY: -Math.PI / 2 },
      { name: "paintingOcean", title: "Oceano", style: "waves" as const, seed: 191, width: 1.12, height: 0.84, position: new Vector3(7.34, 3.08, 3.95), rotationY: Math.PI / 2 },
      { name: "paintingRhythm", title: "Ritmo", style: "rhythm" as const, seed: 223, width: 1.08, height: 0.84, position: new Vector3(7.34, 2.18, 3.95), rotationY: Math.PI / 2 }
    ].forEach((painting) => {
      this.createMuseumPainting(painting);
    });
  }

  private createScienceExhibits(): void {
    this.createMuseumSign({ name: "scienceZoneSign", title: "CIENCIA", subtitle: "Modelos para explorar", width: 2.05, height: 0.48, position: new Vector3(7.32, 3.86, -2.1), rotationY: Math.PI / 2 });
    this.createStaticImageWallPanel({
      name: "scienceStaticPoster",
      textureUrl: "/museum/posters/ciencia.png",
      width: 3.3,
      height: 1.86,
      position: new Vector3(7.33, 2.32, -2.14),
      rotationY: Math.PI / 2
    });
    this.createSolarSystemModel(new Vector3(5.15, 0, 1.95));
    this.createDnaModel(new Vector3(5.55, 0, -1.25));
    this.createOpticalIllusionPanel(new Vector3(7.34, 2.28, 1.3), Math.PI / 2);
    this.createNeuronModel(new Vector3(5.15, 0, -4.55));
  }

  private createDisplayCases(): void {
    [
      { name: "fossilCase", position: new Vector3(-4.82, 0, -2.6), artifact: "fossil" as const, label: "Fosil tactil" },
      { name: "crystalCase", position: new Vector3(4.6, 0, -0.05), artifact: "crystal" as const, label: "Cristal mineral" },
      { name: "geometryCase", position: new Vector3(-5.15, 0, 4), artifact: "geometry" as const, label: "Solido imposible" },
      { name: "lensCase", position: new Vector3(4.35, 0, 3.58), artifact: "lens" as const, label: "Lentes de percepcion" }
    ].forEach((item) => {
      this.createDisplayCase(item.name, item.position, item.artifact, item.label);
    });
  }

  private createSculptures(): void {
    this.createAbstractSphereSculpture(new Vector3(-2.95, 0, -3.72), "Conexiones");
    this.createGeometricSculpture(new Vector3(2.9, 0, -3.55), "Equilibrio");
    this.createHumanAbstractSculpture(new Vector3(-5.62, 0, 0.1), "Visitante");
    this.createMoleculeSculpture(new Vector3(5.95, 0, 4.12), "Materia");
  }

  private createCentralInstallation(): void {
    const root = new TransformNode("centralPerceptionKineticRoot", this.scene);
    const installationPosition = new Vector3(-4.08, 0, -0.86);

    root.position = installationPosition.add(new Vector3(0, 1.22, 0));
    root.metadata = { dynamic: true, role: "ambient-kinetic-sculpture" };
    this.createPedestal("centralPerceptionPedestal", installationPosition, 1.22, 0.7, "Orbitas del conocimiento", true);

    [
      { name: "outer", diameter: 1.46, rotation: new Vector3(Math.PI / 2, 0.16, 0), material: this.materials.gold },
      { name: "middle", diameter: 1.04, rotation: new Vector3(0.2, Math.PI / 2, 0.35), material: this.materials.accent },
      { name: "inner", diameter: 0.62, rotation: new Vector3(Math.PI / 2, Math.PI / 2, 0.5), material: this.materials.gold }
    ].forEach((ring) => {
      const mesh = MeshBuilder.CreateTorus(`centralPerceptionRing-${ring.name}`, { diameter: ring.diameter, thickness: 0.025, tessellation: 48 }, this.scene);

      mesh.parent = root;
      mesh.rotation = ring.rotation;
      mesh.material = ring.material;
      mesh.isPickable = false;
      mesh.metadata = { dynamic: true };
      this.shadowCasters.push(mesh);
    });

    const coreMaterial = this.createMaterial("centralPerceptionCoreMaterial", new Color3(0.88, 0.76, 0.44));
    const core = MeshBuilder.CreateSphere("centralPerceptionCore", { diameter: 0.36, segments: 20 }, this.scene);

    coreMaterial.emissiveColor = new Color3(0.16, 0.11, 0.02);
    core.parent = root;
    core.material = coreMaterial;
    core.isPickable = false;
    core.metadata = { dynamic: true };
    this.shadowCasters.push(core);

    this.scene.onBeforeRenderObservable.add(() => {
      const delta = Math.min(0.03, this.scene.getEngine().getDeltaTime() / 1000);

      root.rotation.y += delta * 0.11;
      root.rotation.x = Math.sin(performance.now() * 0.00035) * 0.035;
      core.position.y = Math.sin(performance.now() * 0.0011) * 0.045;
    });
  }

  private createFurnitureAndPlants(): void {
    [
      { position: new Vector3(-2.8, 0, -5.6), rotation: 0.08 },
      { position: new Vector3(2.85, 0, -5.55), rotation: -0.08 },
      { position: new Vector3(-4.7, 0, 2.15), rotation: Math.PI / 2 },
      { position: new Vector3(4.65, 0, 2.55), rotation: Math.PI / 2 }
    ].forEach((bench, index) => this.createBench(`museumBench${index + 1}`, bench.position, bench.rotation));

    [
      new Vector3(-6.75, 0, -6.2),
      new Vector3(6.75, 0, -6),
      new Vector3(-6.55, 0, 4.6),
      new Vector3(6.55, 0, 4.7),
      new Vector3(0.9, 0, -6.7)
    ].forEach((position, index) => this.createPlant(position, index % 2 === 0 ? 0.9 : 0.72));

    this.createBox({ name: "museumInformationTable", width: 1.4, height: 0.72, depth: 0.82, position: new Vector3(-1.25, 0.36, -6.25), material: this.materials.display, castsShadow: true, collides: true });
    this.createBox({ name: "museumRecyclingBin", width: 0.38, height: 0.78, depth: 0.38, position: new Vector3(6.8, 0.39, -4.65), material: this.materials.charcoal, collides: true });
  }

  private createActivityPanel(): Mesh {
    this.createBox({ name: "visualDiscriminationActivityFeatureWall", width: 8.5, height: 4.15, depth: 0.08, position: new Vector3(0, 2.45, 5.88), material: this.materials.accentWall });
    this.createMuseumSign({ name: "activityZoneHeader", title: "LABORATORIO DE PERCEPCION", subtitle: "Observa - Compara - Identifica", width: 4.8, height: 0.62, position: new Vector3(0, 4.12, 5.78) });

    const panel = MeshBuilder.CreatePlane("visualDiscriminationActivityPanel", { width: 7.4, height: 3.7 }, this.scene);

    panel.position = new Vector3(0, 2.46, 5.72);
    panel.material = this.materials.panel;
    panel.metadata = { dynamic: true, role: "visual-discrimination-panel" };
    panel.isPickable = false;

    this.createBox({ name: "visualDiscriminationPanelFrameTop", width: 7.72, height: 0.12, depth: 0.14, position: new Vector3(0, 4.37, 5.64), material: this.materials.gold, castsShadow: true });
    this.createBox({ name: "visualDiscriminationPanelFrameBottom", width: 7.72, height: 0.12, depth: 0.14, position: new Vector3(0, 0.55, 5.64), material: this.materials.gold, castsShadow: true });
    this.createBox({ name: "visualDiscriminationPanelFrameLeft", width: 0.12, height: 3.84, depth: 0.14, position: new Vector3(-3.86, 2.46, 5.64), material: this.materials.gold, castsShadow: true });
    this.createBox({ name: "visualDiscriminationPanelFrameRight", width: 0.12, height: 3.84, depth: 0.14, position: new Vector3(3.86, 2.46, 5.64), material: this.materials.gold, castsShadow: true });
    this.createBox({ name: "activityZoneLightBar", width: 6.5, height: 0.08, depth: 0.12, position: new Vector3(0, 4.58, 5.52), material: this.materials.lightPanel });
    this.createActivityPreviewPoster();

    return panel;
  }

  private createActivityPreviewPoster(): void {
    const material = new StandardMaterial("visualDiscriminationPreviewPosterMaterial", this.scene);
    const poster = MeshBuilder.CreatePlane("visualDiscriminationPreviewPoster", { width: 4.85, height: 3.38 }, this.scene);

    material.diffuseTexture = new Texture("/museum/posters/observa-las-caras.png", this.scene);
    material.emissiveColor = new Color3(0.16, 0.16, 0.12);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;

    poster.position = new Vector3(0, 2.46, 5.46);
    poster.material = material;
    poster.isPickable = false;
    poster.metadata = {
      role: "visual-discrimination-preview-poster",
      description: "Poster visible during museum exploration only"
    };
    this.evaluationHiddenMeshes.push(poster);
  }

  private createStaticImageWallPanel(options: {
    name: string;
    textureUrl: string;
    width: number;
    height: number;
    position: Vector3;
    rotationY: number;
  }): void {
    const material = new StandardMaterial(`${options.name}Material`, this.scene);
    const poster = MeshBuilder.CreatePlane(options.name, { width: options.width, height: options.height }, this.scene);

    material.diffuseTexture = new Texture(options.textureUrl, this.scene);
    material.emissiveColor = new Color3(0.14, 0.14, 0.1);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;

    this.createBox({
      name: `${options.name}Frame`,
      width: options.width + 0.14,
      height: options.height + 0.14,
      depth: 0.06,
      position: options.position,
      material: this.materials.gold,
      rotationY: options.rotationY,
      castsShadow: true
    });

    poster.position = this.offsetTowardViewer(options.position, options.rotationY, 0.045);
    poster.rotation.y = options.rotationY;
    poster.material = material;
    poster.isPickable = false;
    poster.metadata = {
      role: "museum-static-poster",
      textureUrl: options.textureUrl
    };
  }

  private createMuseumPainting(options: {
    name: string;
    title: string;
    style: "geometric" | "organic" | "waves" | "city" | "orbit" | "contrast" | "depth" | "rhythm";
    seed: number;
    width: number;
    height: number;
    position: Vector3;
    rotationY?: number;
    textureUrl?: string;
  }): void {
    const material = new StandardMaterial(`${options.name}Material`, this.scene);

    if (options.textureUrl) {
      material.diffuseTexture = new Texture(options.textureUrl, this.scene);
    } else {
      const texture = new DynamicTexture(`${options.name}Texture`, { width: 512, height: 512 }, this.scene, false);
      const context = texture.getContext() as unknown as CanvasRenderingContext2D;

      this.paintProceduralArtwork(context, options.style, options.seed);
      texture.update();
      material.diffuseTexture = texture;
    }

    material.emissiveColor = new Color3(0.1, 0.1, 0.08);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;

    this.createBox({ name: `${options.name}Frame`, width: options.width + 0.12, height: options.height + 0.12, depth: 0.055, position: options.position, material: this.materials.gold, rotationY: options.rotationY, castsShadow: true });

    const painting = MeshBuilder.CreatePlane(options.name, { width: options.width, height: options.height }, this.scene);

    painting.position = this.offsetTowardViewer(options.position, options.rotationY ?? 0, 0.04);
    painting.rotation.y = options.rotationY ?? 0;
    painting.material = material;
    painting.isPickable = false;
    this.createMuseumLabel(options.title, this.offsetLabelPosition(options.position, options.rotationY ?? 0, options.height), options.rotationY ?? 0);
  }

  private paintProceduralArtwork(
    context: CanvasRenderingContext2D,
    style: "geometric" | "organic" | "waves" | "city" | "orbit" | "contrast" | "depth" | "rhythm",
    seed: number
  ): void {
    const palette = ["#24464f", "#d9b86a", "#e9e0c7", "#7aa0a8", "#b86f45"];

    context.fillStyle = "#f2ebd6";
    context.fillRect(0, 0, 512, 512);

    if (style === "geometric") {
      for (let index = 0; index < 12; index += 1) {
        context.fillStyle = palette[(seed + index) % palette.length];
        context.globalAlpha = 0.58 + (index % 3) * 0.12;
        context.fillRect((seed * (index + 3) * 17) % 430, (seed * (index + 5) * 11) % 420, 54 + (index % 4) * 24, 42 + (index % 5) * 18);
      }
    }

    if (style === "organic") {
      for (let index = 0; index < 9; index += 1) {
        context.fillStyle = palette[(seed + index * 2) % palette.length];
        context.globalAlpha = 0.48;
        context.beginPath();
        context.ellipse(80 + ((seed + index * 59) % 350), 80 + ((seed + index * 83) % 340), 42 + index * 7, 26 + (index % 4) * 16, index * 0.37, 0, Math.PI * 2);
        context.fill();
      }
    }

    if (style === "waves") {
      context.lineWidth = 14;
      for (let line = 0; line < 9; line += 1) {
        context.strokeStyle = palette[(seed + line) % palette.length];
        context.globalAlpha = 0.72;
        context.beginPath();
        for (let x = 0; x <= 512; x += 18) {
          const y = 76 + line * 44 + Math.sin((x + seed * line) * 0.025) * 22;

          if (x === 0) {
            context.moveTo(x, y);
          } else {
            context.lineTo(x, y);
          }
        }
        context.stroke();
      }
    }

    if (style === "city") {
      for (let index = 0; index < 12; index += 1) {
        const height = 80 + ((seed + index * 31) % 260);

        context.fillStyle = palette[(index + 1) % palette.length];
        context.globalAlpha = 0.86;
        context.fillRect(index * 44, 440 - height, 34, height);
      }
    }

    if (style === "orbit") {
      context.strokeStyle = "#24464f";
      context.lineWidth = 12;
      for (let index = 0; index < 5; index += 1) {
        context.beginPath();
        context.ellipse(256, 256, 70 + index * 34, 32 + index * 18, index * 0.42, 0, Math.PI * 2);
        context.stroke();
      }
      [0, 1, 2, 3].forEach((dot, index) => {
        context.fillStyle = palette[(seed + index) % palette.length];
        context.beginPath();
        context.arc(160 + dot * 62, 192 + (index % 2) * 92, 22, 0, Math.PI * 2);
        context.fill();
      });
    }

    if (style === "contrast") {
      for (let index = 0; index < 10; index += 1) {
        const radius = 220 - index * 18;

        context.fillStyle = index % 2 === 0 ? "#24464f" : "#f2ebd6";
        context.beginPath();
        context.arc(256, 256, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 0.75;
      context.fillStyle = "#d9b86a";
      context.fillRect(210, 58, 96, 398);
    }

    if (style === "depth") {
      context.strokeStyle = "#24464f";
      context.lineWidth = 7;
      for (let index = 0; index < 13; index += 1) {
        const inset = index * 17;

        context.globalAlpha = 0.3 + index * 0.045;
        context.strokeRect(54 + inset, 54 + inset * 0.72, 404 - inset * 2, 404 - inset * 1.45);
      }
      context.globalAlpha = 0.82;
      context.fillStyle = "#b86f45";
      context.beginPath();
      context.moveTo(256, 88);
      context.lineTo(420, 430);
      context.lineTo(92, 430);
      context.closePath();
      context.fill();
    }

    if (style === "rhythm") {
      for (let index = 0; index < 14; index += 1) {
        context.fillStyle = palette[(seed + index) % palette.length];
        context.globalAlpha = 0.72;
        context.beginPath();
        context.roundRect(44 + index * 30, 80 + Math.sin(index * 0.9) * 30, 22, 330, 11);
        context.fill();
      }
      context.strokeStyle = "#24464f";
      context.lineWidth = 10;
      context.globalAlpha = 0.7;
      context.beginPath();
      context.moveTo(52, 360);
      context.bezierCurveTo(180, 120, 320, 430, 470, 160);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  private createIllustratedWallPanel(options: {
    name: string;
    title: string;
    style: "eyeBrain" | "attention" | "forms" | "scienceFlow" | "museumMap" | "colorWheel";
    width: number;
    height: number;
    position: Vector3;
    rotationY: number;
  }): void {
    const texture = new DynamicTexture(`${options.name}Texture`, { width: 768, height: 768 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    this.paintEducationalPanel(context, options.title, options.style);
    texture.update();

    const material = new StandardMaterial(`${options.name}Material`, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.08, 0.08, 0.06);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;

    this.createBox({
      name: `${options.name}Frame`,
      width: options.width + 0.12,
      height: options.height + 0.12,
      depth: 0.055,
      position: options.position,
      material: this.materials.gold,
      rotationY: options.rotationY,
      castsShadow: true
    });

    const panel = MeshBuilder.CreatePlane(options.name, { width: options.width, height: options.height }, this.scene);

    panel.position = this.offsetTowardViewer(options.position, options.rotationY, 0.04);
    panel.rotation.y = options.rotationY;
    panel.material = material;
    panel.isPickable = false;
  }

  private paintEducationalPanel(
    context: CanvasRenderingContext2D,
    title: string,
    style: "eyeBrain" | "attention" | "forms" | "scienceFlow" | "museumMap" | "colorWheel"
  ): void {
    context.fillStyle = "#f2ebd6";
    context.fillRect(0, 0, 768, 768);
    context.strokeStyle = "#24464f";
    context.lineWidth = 16;
    context.strokeRect(34, 34, 700, 700);
    context.fillStyle = "#102f31";
    context.textAlign = "center";
    context.font = "800 52px Arial";
    context.fillText(title.toUpperCase(), 384, 105);

    if (style === "eyeBrain") {
      context.strokeStyle = "#24464f";
      context.lineWidth = 12;
      context.beginPath();
      context.ellipse(250, 360, 135, 76, 0, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#7aa0a8";
      context.beginPath();
      context.arc(250, 360, 42, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#d9b86a";
      context.beginPath();
      context.moveTo(390, 360);
      context.bezierCurveTo(450, 312, 488, 418, 548, 360);
      context.stroke();
      context.fillStyle = "#b86f45";
      for (let index = 0; index < 8; index += 1) {
        context.beginPath();
        context.arc(530 + Math.cos(index) * 62, 358 + Math.sin(index * 1.7) * 48, 18, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = "#102f31";
      context.font = "500 34px Arial";
      context.fillText("ojo -> senal -> cerebro", 384, 610);
    }

    if (style === "attention") {
      for (let index = 0; index < 22; index += 1) {
        context.strokeStyle = index % 2 === 0 ? "#24464f" : "#d9b86a";
        context.globalAlpha = 0.34 + (index % 4) * 0.1;
        context.lineWidth = 6;
        context.beginPath();
        context.arc(384, 390, 45 + index * 12, 0, Math.PI * 1.62);
        context.stroke();
      }
      context.globalAlpha = 1;
      context.fillStyle = "#b86f45";
      context.beginPath();
      context.arc(384, 390, 38, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#102f31";
      context.font = "500 34px Arial";
      context.fillText("seleccionamos informacion relevante", 384, 628);
    }

    if (style === "forms") {
      const colors = ["#24464f", "#d9b86a", "#7aa0a8", "#b86f45"];

      for (let index = 0; index < 16; index += 1) {
        const x = 150 + (index % 4) * 130;
        const y = 230 + Math.floor(index / 4) * 92;

        context.fillStyle = colors[index % colors.length];
        context.globalAlpha = 0.82;
        if (index % 3 === 0) {
          context.fillRect(x - 34, y - 34, 68, 68);
        } else if (index % 3 === 1) {
          context.beginPath();
          context.arc(x, y, 38, 0, Math.PI * 2);
          context.fill();
        } else {
          context.beginPath();
          context.moveTo(x, y - 44);
          context.lineTo(x + 44, y + 36);
          context.lineTo(x - 44, y + 36);
          context.closePath();
          context.fill();
        }
      }
      context.globalAlpha = 1;
      context.fillStyle = "#102f31";
      context.font = "500 34px Arial";
      context.fillText("comparamos forma, color y posicion", 384, 628);
    }

    if (style === "scienceFlow") {
      context.strokeStyle = "#d9b86a";
      context.lineWidth = 16;
      context.beginPath();
      context.moveTo(135, 360);
      context.lineTo(325, 360);
      context.lineTo(512, 360);
      context.stroke();
      context.fillStyle = "#24464f";
      ["LUZ", "SENAL", "CEREBRO"].forEach((label, index) => {
        const x = 150 + index * 235;

        context.beginPath();
        context.roundRect(x - 70, 300, 140, 120, 28);
        context.fill();
        context.fillStyle = "#f6f0de";
        context.font = "700 30px Arial";
        context.fillText(label, x, 374);
        context.fillStyle = "#24464f";
      });
      context.fillStyle = "#102f31";
      context.font = "500 34px Arial";
      context.fillText("el cerebro interpreta lo que vemos", 384, 620);
    }

    if (style === "museumMap") {
      context.fillStyle = "#24464f";
      context.globalAlpha = 0.08;
      context.fillRect(92, 170, 584, 410);
      context.globalAlpha = 1;
      context.strokeStyle = "#d9b86a";
      context.lineWidth = 10;
      context.strokeRect(120, 205, 190, 140);
      context.strokeRect(458, 205, 190, 140);
      context.strokeRect(278, 410, 214, 118);
      context.strokeStyle = "#24464f";
      context.lineWidth = 12;
      context.beginPath();
      context.moveTo(310, 276);
      context.lineTo(384, 276);
      context.lineTo(384, 410);
      context.moveTo(458, 276);
      context.lineTo(384, 276);
      context.stroke();
      ["ARTE", "CIENCIA", "ACTIVIDAD"].forEach((label, index) => {
        const points = [
          { x: 215, y: 286 },
          { x: 553, y: 286 },
          { x: 385, y: 480 }
        ];

        context.fillStyle = index === 1 ? "#7aa0a8" : "#b86f45";
        context.beginPath();
        context.arc(points[index].x, points[index].y, 28, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#102f31";
        context.font = "700 30px Arial";
        context.fillText(label, points[index].x, points[index].y + 74);
      });
      context.font = "500 32px Arial";
      context.fillText("elige una zona para observar", 384, 640);
    }

    if (style === "colorWheel") {
      const colors = ["#24464f", "#d9b86a", "#7aa0a8", "#b86f45", "#5b8f64", "#8e6ea8"];

      colors.forEach((color, index) => {
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(384, 374);
        context.arc(384, 374, 150, index * Math.PI / 3, (index + 1) * Math.PI / 3);
        context.closePath();
        context.fill();
      });
      context.fillStyle = "#f2ebd6";
      context.beginPath();
      context.arc(384, 374, 64, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "#102f31";
      context.lineWidth = 10;
      context.beginPath();
      context.ellipse(384, 374, 54, 30, 0, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#24464f";
      context.beginPath();
      context.arc(384, 374, 18, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#102f31";
      context.font = "500 32px Arial";
      context.fillText("los detalles cambian la mirada", 384, 640);
    }

    context.globalAlpha = 1;
  }

  private createDisplayCase(
    name: string,
    position: Vector3,
    artifact: "fossil" | "crystal" | "geometry" | "lens",
    label: string
  ): void {
    this.createBox({ name: `${name}Base`, width: 1.28, height: 0.68, depth: 1, position: position.add(new Vector3(0, 0.34, 0)), material: this.materials.charcoal, castsShadow: true, collides: true, hideDuringEvaluation: true });
    this.createBox({ name: `${name}GoldLip`, width: 1.38, height: 0.08, depth: 1.08, position: position.add(new Vector3(0, 0.72, 0)), material: this.materials.gold, castsShadow: true, hideDuringEvaluation: true });
    this.createBox({ name: `${name}Glass`, width: 1.08, height: 0.66, depth: 0.82, position: position.add(new Vector3(0, 1.12, 0)), material: this.materials.glass, castsShadow: true, hideDuringEvaluation: true });
    this.createBox({ name: `${name}Light`, width: 0.82, height: 0.045, depth: 0.54, position: position.add(new Vector3(0, 1.5, 0)), material: this.materials.lightPanel, hideDuringEvaluation: true });
    this.createArtifactForCase(`${name}Artifact`, position.add(new Vector3(0, 1.15, 0)), artifact);
    this.createMuseumLabel(label, position.add(new Vector3(0, 0.86, -0.54)), 0);
  }

  private createArtifactForCase(
    name: string,
    position: Vector3,
    artifact: "fossil" | "crystal" | "geometry" | "lens"
  ): void {
    if (artifact === "fossil") {
      const fossil = MeshBuilder.CreateTorus(name, { diameter: 0.38, thickness: 0.04, tessellation: 28 }, this.scene);

      fossil.position = position;
      fossil.scaling.z = 0.28;
      fossil.material = this.materials.stone;
      fossil.isPickable = false;
      this.evaluationHiddenMeshes.push(fossil);
      return;
    }

    if (artifact === "crystal") {
      const crystal = MeshBuilder.CreatePolyhedron(name, { type: 1, size: 0.34 }, this.scene);

      crystal.position = position;
      crystal.material = this.materials.accent;
      crystal.isPickable = false;
      this.evaluationHiddenMeshes.push(crystal);
      return;
    }

    if (artifact === "geometry") {
      const knot = MeshBuilder.CreateTorusKnot(name, { radius: 0.22, tube: 0.035, radialSegments: 48, tubularSegments: 8 }, this.scene);

      knot.position = position;
      knot.material = this.materials.gold;
      knot.isPickable = false;
      this.evaluationHiddenMeshes.push(knot);
      return;
    }

    const lens = MeshBuilder.CreateSphere(name, { diameter: 0.38, segments: 20 }, this.scene);

    lens.position = position;
    lens.scaling.z = 0.18;
    lens.material = this.materials.glass;
    lens.isPickable = false;
    this.evaluationHiddenMeshes.push(lens);
  }

  private createSolarSystemModel(position: Vector3): void {
    this.createPedestal("solarSystemPedestal", position, 1.3, 0.64, "Sistema solar");
    const sun = MeshBuilder.CreateSphere("museumSunModel", { diameter: 0.28, segments: 18 }, this.scene);

    sun.position = position.add(new Vector3(0, 1.08, 0));
    sun.material = this.materials.gold;
    sun.isPickable = false;
    [0.32, 0.52, 0.72].forEach((radius, index) => {
      const orbit = MeshBuilder.CreateTorus(`museumOrbit${index + 1}`, { diameter: radius * 2, thickness: 0.008, tessellation: 40 }, this.scene);
      const planet = MeshBuilder.CreateSphere(`museumPlanet${index + 1}`, { diameter: 0.08 + index * 0.025, segments: 12 }, this.scene);

      orbit.position = sun.position.clone();
      orbit.rotation.x = Math.PI / 2;
      orbit.material = this.materials.accent;
      orbit.isPickable = false;
      planet.position = sun.position.add(new Vector3(radius, 0, index * 0.04));
      planet.material = index === 0 ? this.materials.warm : this.materials.accent;
      planet.isPickable = false;
    });
  }

  private createDnaModel(position: Vector3): void {
    this.createPedestal("dnaPedestal", position, 1, 0.62, "Doble helice");
    for (let index = 0; index < 12; index += 1) {
      const y = 0.9 + index * 0.105;
      const angle = index * 0.62;
      const left = position.add(new Vector3(Math.cos(angle) * 0.28, y, Math.sin(angle) * 0.28));
      const right = position.add(new Vector3(Math.cos(angle + Math.PI) * 0.28, y, Math.sin(angle + Math.PI) * 0.28));
      const rung = MeshBuilder.CreateCylinder(`museumDnaRung${index + 1}`, { height: Vector3.Distance(left, right), diameter: 0.018, tessellation: 8 }, this.scene);

      [left, right].forEach((point, pointIndex) => {
        const sphere = MeshBuilder.CreateSphere(`museumDnaNode${index + 1}-${pointIndex + 1}`, { diameter: 0.07, segments: 10 }, this.scene);

        sphere.position = point;
        sphere.material = pointIndex === 0 ? this.materials.gold : this.materials.accent;
        sphere.isPickable = false;
      });
      rung.position = Vector3.Center(left, right);
      rung.rotation.z = Math.PI / 2;
      rung.rotation.y = -angle;
      rung.material = this.materials.trim;
      rung.isPickable = false;
    }
  }

  private createOpticalIllusionPanel(position: Vector3, rotationY: number): void {
    const texture = new DynamicTexture("museumIllusionTexture", { width: 512, height: 512 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    context.fillStyle = "#f2ebd6";
    context.fillRect(0, 0, 512, 512);
    for (let index = 0; index < 16; index += 1) {
      context.strokeStyle = index % 2 === 0 ? "#24464f" : "#d9b86a";
      context.lineWidth = 8;
      context.beginPath();
      context.arc(256, 256, 22 + index * 14, 0, Math.PI * 2);
      context.stroke();
    }
    texture.update();

    const material = new StandardMaterial("museumIllusionMaterial", this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.08, 0.08, 0.06);
    material.backFaceCulling = false;

    this.createBox({
      name: "museumIllusionFrame",
      width: 1.08,
      height: 1.08,
      depth: 0.055,
      position,
      material: this.materials.gold,
      rotationY,
      castsShadow: true
    });

    const panel = MeshBuilder.CreatePlane("museumIllusionPanel", { width: 0.96, height: 0.96 }, this.scene);

    panel.position = this.offsetTowardViewer(position, rotationY, 0.04);
    panel.rotation.y = rotationY;
    panel.material = material;
    panel.isPickable = false;
  }

  private createNeuronModel(position: Vector3): void {
    this.createPedestal("neuronPedestal", position, 1.15, 0.62, "Como percibimos?");
    const center = MeshBuilder.CreateSphere("museumNeuronCenter", { diameter: 0.24, segments: 14 }, this.scene);

    center.position = position.add(new Vector3(0, 1.12, 0));
    center.material = this.materials.warm;
    center.isPickable = false;
    for (let index = 0; index < 7; index += 1) {
      const angle = index * Math.PI * 2 / 7;
      const dendrite = MeshBuilder.CreateCylinder(`museumNeuronDendrite${index + 1}`, { height: 0.58, diameter: 0.025, tessellation: 8 }, this.scene);

      dendrite.position = center.position.add(new Vector3(Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.22));
      dendrite.rotation.z = Math.PI / 2;
      dendrite.rotation.y = -angle;
      dendrite.material = this.materials.gold;
      dendrite.isPickable = false;
    }
  }

  private createPrismExhibit(position: Vector3): void {
    this.createPedestal("perceptionPrismPedestal", position, 0.86, 0.58, "Luz y color");

    const prism = MeshBuilder.CreatePolyhedron("perceptionPrismGlass", { type: 1, size: 0.28 }, this.scene);

    prism.position = position.add(new Vector3(0, 1.05, 0));
    prism.rotation.z = Math.PI / 4;
    prism.material = this.materials.glass;
    prism.isPickable = false;

    [
      { name: "red", color: new Color3(0.9, 0.18, 0.14), offset: -0.11 },
      { name: "gold", color: new Color3(0.95, 0.72, 0.18), offset: 0 },
      { name: "blue", color: new Color3(0.18, 0.52, 0.82), offset: 0.11 }
    ].forEach((beam) => {
      const material = this.createMaterial(`perceptionPrismBeam-${beam.name}`, beam.color);
      const ray = MeshBuilder.CreateBox(`perceptionPrismBeam-${beam.name}`, { width: 0.62, height: 0.025, depth: 0.035 }, this.scene);

      material.emissiveColor = beam.color.scale(0.45);
      ray.position = position.add(new Vector3(0.48, 1.04 + beam.offset, 0));
      ray.rotation.z = beam.offset * 1.6;
      ray.material = material;
      ray.isPickable = false;
    });
  }

  private createAbstractSphereSculpture(position: Vector3, title: string): void {
    this.createPedestal("abstractSpherePedestal", position, 1, 0.7, title);
    [-0.22, 0.02, 0.24].forEach((offset, index) => {
      const sphere = MeshBuilder.CreateSphere(`abstractSphereSculpture${index + 1}`, { diameter: 0.36 - index * 0.05, segments: 16 }, this.scene);

      sphere.position = position.add(new Vector3(offset, 1.03 + index * 0.18, index * 0.08));
      sphere.material = index % 2 === 0 ? this.materials.gold : this.materials.accent;
      sphere.isPickable = false;
      this.shadowCasters.push(sphere);
    });
  }

  private createGeometricSculpture(position: Vector3, title: string): void {
    this.createPedestal("geometricSculpturePedestal", position, 1, 0.7, title);
    const knot = MeshBuilder.CreateTorusKnot("geometricMuseumSculpture", { radius: 0.34, tube: 0.035, radialSegments: 64, tubularSegments: 10 }, this.scene);

    knot.position = position.add(new Vector3(0, 1.22, 0));
    knot.material = this.materials.accent;
    knot.isPickable = false;
    this.shadowCasters.push(knot);
  }

  private createHumanAbstractSculpture(position: Vector3, title: string): void {
    this.createPedestal("humanSculpturePedestal", position, 0.92, 0.68, title);
    const body = MeshBuilder.CreateCylinder("humanAbstractBody", { height: 0.72, diameter: 0.16, tessellation: 12 }, this.scene);
    const head = MeshBuilder.CreateSphere("humanAbstractHead", { diameter: 0.22, segments: 12 }, this.scene);
    const arm = MeshBuilder.CreateCylinder("humanAbstractArm", { height: 0.58, diameter: 0.055, tessellation: 8 }, this.scene);

    body.position = position.add(new Vector3(0, 1.1, 0));
    head.position = position.add(new Vector3(0, 1.58, 0));
    arm.position = position.add(new Vector3(0.2, 1.25, 0));
    arm.rotation.z = 0.92;
    [body, head, arm].forEach((mesh) => {
      mesh.material = this.materials.stone;
      mesh.isPickable = false;
      this.shadowCasters.push(mesh);
    });
  }

  private createMoleculeSculpture(position: Vector3, title: string): void {
    this.createPedestal("moleculePedestal", position, 0.92, 0.68, title);
    [
      new Vector3(0, 1.18, 0),
      new Vector3(0.32, 1.34, 0.12),
      new Vector3(-0.28, 1.38, -0.18),
      new Vector3(0.08, 1.68, 0.26)
    ].forEach((point, index) => {
      const sphere = MeshBuilder.CreateSphere(`moleculeNode${index + 1}`, { diameter: index === 0 ? 0.24 : 0.16, segments: 12 }, this.scene);

      sphere.position = position.add(point);
      sphere.material = index % 2 === 0 ? this.materials.gold : this.materials.accent;
      sphere.isPickable = false;
    });
  }

  private createPedestal(
    name: string,
    position: Vector3,
    width: number,
    height: number,
    label: string,
    hideDuringEvaluation = false
  ): void {
    this.createBox({ name, width, height, depth: width, position: position.add(new Vector3(0, height / 2, 0)), material: this.materials.charcoal, castsShadow: true, collides: true, hideDuringEvaluation });
    this.createMuseumLabel(label, position.add(new Vector3(0, height + 0.08, -width / 2 - 0.03)), 0);
  }

  private createBench(name: string, position: Vector3, rotationY: number): void {
    this.createBox({ name: `${name}Seat`, width: 1.65, height: 0.16, depth: 0.48, position: position.add(new Vector3(0, 0.48, 0)), material: this.materials.wood, rotationY, castsShadow: true, collides: true });
    [-0.58, 0.58].forEach((offset, index) => {
      this.createBox({ name: `${name}Leg${index + 1}`, width: 0.12, height: 0.44, depth: 0.12, position: this.positionFromLocalOffset(position, offset, 0.22, 0, rotationY), material: this.materials.charcoal, rotationY, castsShadow: true });
    });
  }

  private createPlant(position: Vector3, scale: number): void {
    this.createBox({ name: `museumPlantPot${position.x}-${position.z}`, width: 0.32 * scale, height: 0.3 * scale, depth: 0.32 * scale, position: position.add(new Vector3(0, 0.15 * scale, 0)), material: this.materials.charcoal, castsShadow: true, collides: true });
    for (let index = 0; index < 5; index += 1) {
      const leaf = MeshBuilder.CreateSphere(`museumPlantLeaf${position.x}-${position.z}-${index + 1}`, { diameter: 0.28 * scale, segments: 10 }, this.scene);

      leaf.position = position.add(new Vector3(Math.cos(index * 1.26) * 0.16 * scale, 0.48 * scale + index * 0.035, Math.sin(index * 1.26) * 0.16 * scale));
      leaf.scaling.set(0.7, 1.35, 0.45);
      leaf.material = this.materials.plantLeaf;
      leaf.isPickable = false;
    }
  }

  private createMuseumSign(options: {
    name: string;
    title: string;
    subtitle: string;
    width: number;
    height: number;
    position: Vector3;
    rotationY?: number;
  }): void {
    const texture = new DynamicTexture(`${options.name}Texture`, { width: 1024, height: 384 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    context.fillStyle = "#102f31";
    context.fillRect(0, 0, 1024, 384);
    context.strokeStyle = "#d9b86a";
    context.lineWidth = 18;
    context.strokeRect(18, 18, 988, 348);
    context.fillStyle = "#f6f0de";
    context.textAlign = "center";
    context.font = this.getFittedFont(context, options.title, 58, 34, 840, 800);
    context.fillText(options.title, 512, 148);
    context.font = this.getFittedFont(context, options.subtitle, 36, 24, 760, 500);
    context.fillText(options.subtitle, 512, 235);
    texture.update();

    const material = new StandardMaterial(`${options.name}Material`, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.18, 0.24, 0.22);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;

    const sign = MeshBuilder.CreatePlane(options.name, { width: options.width, height: options.height }, this.scene);

    sign.position = options.position;
    sign.rotation.y = options.rotationY ?? 0;
    sign.material = material;
    sign.isPickable = false;
  }

  private getFittedFont(
    context: CanvasRenderingContext2D,
    text: string,
    maxSize: number,
    minSize: number,
    maxWidth: number,
    weight: number
  ): string {
    for (let size = maxSize; size >= minSize; size -= 2) {
      const font = `${weight} ${size}px Arial`;

      context.font = font;
      if (context.measureText(text).width <= maxWidth) {
        return font;
      }
    }

    return `${weight} ${minSize}px Arial`;
  }

  private createMuseumLabel(text: string, position: Vector3, rotationY: number): void {
    const texture = new DynamicTexture(`museumLabelTexture-${text}-${position.x}-${position.z}`, { width: 512, height: 160 }, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    context.fillStyle = "#e7dcc0";
    context.fillRect(0, 0, 512, 160);
    context.strokeStyle = "#9c7a34";
    context.lineWidth = 8;
    context.strokeRect(6, 6, 500, 148);
    context.fillStyle = "#233033";
    context.textAlign = "center";
    context.font = "700 38px Arial";
    context.fillText(text, 256, 96);
    texture.update();

    const material = new StandardMaterial(`museumLabelMaterial-${text}-${position.x}`, this.scene);
    const label = MeshBuilder.CreatePlane(`museumLabel-${text}-${position.x}`, { width: 0.72, height: 0.22 }, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.12, 0.1, 0.06);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    label.position = position;
    label.rotation.y = rotationY;
    label.material = material;
    label.isPickable = false;
  }

  private createAnchors(): MuseumDistractorAnchors {
    return {
      leftExhibitAnchor: this.createAnchor("museumLeftExhibitDistractorAnchor", new Vector3(-5.95, 2.4, 1.15)),
      rightExhibitAnchor: this.createAnchor("museumRightExhibitDistractorAnchor", new Vector3(5.95, 2.4, -2.05)),
      backVisitorAnchor: this.createAnchor("museumBackVisitorAudioAnchor", new Vector3(-3.8, 1.3, -6.2)),
      robotPathAnchor: this.createAnchor("museumRobotPathAnchor", new Vector3(0, 0.46, -5.2))
    };
  }

  private createAnchor(name: string, position: Vector3): TransformNode {
    const anchor = new TransformNode(name, this.scene);

    anchor.position = position;
    anchor.metadata = { role: "museum-distractor-anchor" };

    return anchor;
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.specularColor = new Color3(0.1, 0.11, 0.1);

    return material;
  }

  private createBox(options: BoxOptions): Mesh {
    this.warnIfBoxTouchesAssessmentClearZone(options);

    const mesh = MeshBuilder.CreateBox(
      options.name,
      { width: options.width, height: options.height, depth: options.depth },
      this.scene
    );

    mesh.position = options.position;
    mesh.rotation.x = options.rotationX ?? 0;
    mesh.rotation.y = options.rotationY ?? 0;
    mesh.rotation.z = options.rotationZ ?? 0;
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

    if (options.hideDuringEvaluation) {
      this.evaluationHiddenMeshes.push(mesh);
    }

    return mesh;
  }

  private warnIfBoxTouchesAssessmentClearZone(options: BoxOptions): void {
    if (!options.collides || options.height > 2.8) {
      return;
    }

    const minX = options.position.x - options.width / 2;
    const maxX = options.position.x + options.width / 2;
    const minZ = options.position.z - options.depth / 2;
    const maxZ = options.position.z + options.depth / 2;
    const overlaps =
      maxX > this.assessmentClearZone.minX &&
      minX < this.assessmentClearZone.maxX &&
      maxZ > this.assessmentClearZone.minZ &&
      minZ < this.assessmentClearZone.maxZ;

    if (!overlaps) {
      return;
    }

    console.warn(
      `[MuseumBuilder] ${options.name} invade AssessmentClearZone. Reubicalo para mantener despejada la actividad.`
    );
  }

  private positionFromLocalOffset(
    origin: Vector3,
    xOffset: number,
    y: number,
    zOffset: number,
    rotationY: number
  ): Vector3 {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);

    return new Vector3(
      origin.x + xOffset * cos - zOffset * sin,
      y,
      origin.z + xOffset * sin + zOffset * cos
    );
  }

  private offsetTowardViewer(position: Vector3, rotationY: number, distance: number): Vector3 {
    return position.add(new Vector3(-Math.sin(rotationY) * distance, 0, -Math.cos(rotationY) * distance));
  }

  private offsetLabelPosition(position: Vector3, rotationY: number, height: number): Vector3 {
    return this.offsetTowardViewer(position.add(new Vector3(0, -height / 2 - 0.18, 0)), rotationY, 0.06);
  }
}
