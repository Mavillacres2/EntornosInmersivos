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

interface SpaceStationMaterials {
  accentAmber: StandardMaterial;
  accentBlue: StandardMaterial;
  accentCyan: StandardMaterial;
  accentGreen: StandardMaterial;
  console: StandardMaterial;
  darkGlass: StandardMaterial;
  door: StandardMaterial;
  floor: StandardMaterial;
  glass: StandardMaterial;
  lightPanel: StandardMaterial;
  metal: StandardMaterial;
  planetAtmosphere: StandardMaterial;
  plantLeaf: StandardMaterial;
  plantStem: StandardMaterial;
  panel: StandardMaterial;
  posterPaper: StandardMaterial;
  robotBody: StandardMaterial;
  screen: StandardMaterial;
  screenRim: StandardMaterial;
  seat: StandardMaterial;
  trim: StandardMaterial;
  wall: StandardMaterial;
  windowGlow: StandardMaterial;
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

export interface SpaceStationDistractorAnchors {
  windowDistractorAnchor: TransformNode;
  doorDistractorAnchor: TransformNode;
  leftPanelDistractorAnchor: TransformNode;
  rightPanelDistractorAnchor: TransformNode;
  corridorDistractorAnchor: TransformNode;
}

export interface SpaceStationBuildResult {
  explorationEyePosition: Vector3;
  explorationLookAt: Vector3;
  evaluationEyePosition: Vector3;
  evaluationLookAt: Vector3;
  cptScreenMesh: Mesh;
  cptScreenAnchor: TransformNode;
  evaluationSeatAnchor: TransformNode;
  explorationSpawnAnchor: TransformNode;
  distractorAnchors: SpaceStationDistractorAnchors;
  cameraBounds: CameraBounds;
  collisionMeshes: Mesh[];
  evaluationHiddenMeshes: Mesh[];
  shadowCasters: Mesh[];
  shadowReceivers: Mesh[];
  shadowLight: DirectionalLight;
  ambientElements: SpaceAmbientElements;
}

export interface SpaceAmbientElements {
  planets: Mesh[];
  planetRotationSpeeds: number[];
  asteroids: Mesh[];
  starMaterials: StandardMaterial[];
  satelliteRoot: TransformNode;
  asteroidPassMesh: Mesh;
  robotRoot: TransformNode;
  doorPivot: TransformNode;
  consoleLightMaterials: StandardMaterial[];
  leftPanelGlowMaterial: StandardMaterial;
  rightPanelGlowMaterial: StandardMaterial;
}

export class SpaceStationBuilder {
  private readonly scene: Scene;
  private readonly materials: SpaceStationMaterials;
  private readonly shadowCasters: Mesh[] = [];
  private readonly shadowReceivers: Mesh[] = [];
  private readonly collisionMeshes: Mesh[] = [];
  private readonly evaluationHiddenMeshes: Mesh[] = [];
  private readonly windowGlassX = -5.20;
  private readonly windowBackdropX = -7.68;
  private readonly outsideWindowX = -7.02;
  private readonly planets: Mesh[] = [];
  private readonly planetRotationSpeeds: number[] = [];
  private readonly asteroids: Mesh[] = [];
  private readonly starMaterials: StandardMaterial[] = [];
  private readonly consoleLightMaterials: StandardMaterial[] = [];
  private satelliteRoot: TransformNode | null = null;
  private asteroidPassMesh: Mesh | null = null;
  private robotRoot: TransformNode | null = null;
  private doorPivot: TransformNode | null = null;
  private leftPanelGlowMaterial: StandardMaterial | null = null;
  private rightPanelGlowMaterial: StandardMaterial | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.materials = this.createMaterials();
  }

  build(): SpaceStationBuildResult {
    const shadowLight = this.createLighting();

    this.createRoom();
    this.createMainConsole();
    const cptScreenMesh = this.createCPTScreen();
    this.createSpaceWindow();
    this.createSidePanels();
    this.createDoor();
    this.createCeilingLights();
    this.createDecorations();
    this.createAdditionalStationDetails();
    const anchors = this.createAnchors();

    return {
      explorationEyePosition: new Vector3(0, 1.52, -5.6),
      explorationLookAt: new Vector3(0, 2.15, 3.8),
      evaluationEyePosition: new Vector3(0, 1.48, -1.46),
      evaluationLookAt: new Vector3(0, 2.52, 5.55),
      cptScreenMesh,
      cptScreenAnchor: anchors.cptScreenAnchor,
      evaluationSeatAnchor: anchors.evaluationSeatAnchor,
      explorationSpawnAnchor: anchors.explorationSpawnAnchor,
      distractorAnchors: {
        windowDistractorAnchor: anchors.windowDistractorAnchor,
        doorDistractorAnchor: anchors.doorDistractorAnchor,
        leftPanelDistractorAnchor: anchors.leftPanelDistractorAnchor,
        rightPanelDistractorAnchor: anchors.rightPanelDistractorAnchor,
        corridorDistractorAnchor: anchors.corridorDistractorAnchor
      },
      cameraBounds: {
        minX: -5.25,
        maxX: 5.25,
        minZ: -6.85,
        maxZ: 5.05
      },
      collisionMeshes: [...this.collisionMeshes],
      evaluationHiddenMeshes: [...this.evaluationHiddenMeshes],
      shadowCasters: [...this.shadowCasters],
      shadowReceivers: [...this.shadowReceivers],
      shadowLight,
      ambientElements: {
        planets: [...this.planets],
        planetRotationSpeeds: [...this.planetRotationSpeeds],
        asteroids: [...this.asteroids],
        starMaterials: [...this.starMaterials],
        satelliteRoot: this.requireNode(this.satelliteRoot, "spaceSatelliteRoot"),
        asteroidPassMesh: this.requireMesh(this.asteroidPassMesh, "spaceAsteroidPass"),
        robotRoot: this.requireNode(this.robotRoot, "spaceRobotRoot"),
        doorPivot: this.requireNode(this.doorPivot, "spaceDoorPivot"),
        consoleLightMaterials: [...this.consoleLightMaterials],
        leftPanelGlowMaterial: this.requireMaterial(
          this.leftPanelGlowMaterial,
          "leftPanelGlowMaterial"
        ),
        rightPanelGlowMaterial: this.requireMaterial(
          this.rightPanelGlowMaterial,
          "rightPanelGlowMaterial"
        )
      }
    };
  }

  private createMaterials(): SpaceStationMaterials {
    const wall = this.createMaterial("spaceWallMaterial", new Color3(0.36, 0.41, 0.44));
    const floor = this.createMaterial("spaceFloorMaterial", new Color3(0.81, 0.83, 0.83));
    const metal = this.createMaterial("spaceMetalMaterial", new Color3(0.46, 0.51, 0.53));
    const trim = this.createMaterial("spaceTrimMaterial", new Color3(0.24, 0.28, 0.3));
    const console = this.createMaterial("spaceConsoleMaterial", new Color3(0.32, 0.39, 0.41));
    const panel = this.createMaterial("spacePanelMaterial", new Color3(0.12, 0.18, 0.22));
    const screen = this.createMaterial("spaceScreenMaterial", new Color3(0.05, 0.2, 0.27));
    const screenRim = this.createMaterial("spaceScreenRimMaterial", new Color3(0.31, 0.76, 0.85));
    const glass = this.createMaterial("spaceGlassMaterial", new Color3(0.58, 0.82, 0.9));
    const darkGlass = this.createMaterial("spaceDarkGlassMaterial", new Color3(0.02, 0.04, 0.08));
    const door = this.createMaterial("spaceDoorMaterial", new Color3(0.78, 0.82, 0.76));
    const lightPanel = this.createMaterial("spaceLightPanelMaterial", new Color3(0.92, 0.94, 0.86));
    const accentAmber = this.createMaterial("spaceAccentAmberMaterial", new Color3(0.91, 0.77, 0.42));
    const accentBlue = this.createMaterial("spaceAccentBlueMaterial", new Color3(0.29, 0.5, 0.75));
    const accentCyan = this.createMaterial("spaceAccentCyanMaterial", new Color3(0.31, 0.76, 0.85));
    const accentGreen = this.createMaterial("spaceAccentGreenMaterial", new Color3(0.47, 0.66, 0.5));
    const seat = this.createMaterial("spaceSeatMaterial", new Color3(0.35, 0.45, 0.54));
    const windowGlow = this.createMaterial("spaceWindowGlowMaterial", new Color3(0.31, 0.76, 0.85));
    const planetAtmosphere = this.createMaterial("planetAtmosphereMaterial", new Color3(0.38, 0.78, 0.95));
    const posterPaper = this.createMaterial("spacePosterPaperMaterial", new Color3(0.88, 0.84, 0.68));
    const robotBody = this.createMaterial("spaceRobotBodyMaterial", new Color3(0.55, 0.62, 0.65));
    const plantStem = this.createMaterial("spacePlantStemMaterial", new Color3(0.31, 0.38, 0.25));
    const plantLeaf = this.createMaterial("spacePlantLeafMaterial", new Color3(0.43, 0.62, 0.44));

    floor.specularColor = new Color3(0.18, 0.2, 0.2);
    metal.specularColor = new Color3(0.28, 0.3, 0.32);
    lightPanel.emissiveColor = new Color3(0.82, 0.86, 0.74);
    lightPanel.disableLighting = true;
    screen.emissiveColor = new Color3(0.02, 0.14, 0.18);
    screenRim.emissiveColor = new Color3(0.08, 0.24, 0.26);
    screenRim.specularColor = new Color3(0.2, 0.32, 0.35);
    darkGlass.emissiveColor = new Color3(0.02, 0.04, 0.08);
    darkGlass.disableLighting = true;
    glass.alpha = 0.36;
    glass.specularColor = new Color3(0.75, 0.9, 1);
    accentCyan.emissiveColor = new Color3(0.05, 0.18, 0.2);
    accentBlue.emissiveColor = new Color3(0.03, 0.08, 0.16);
    accentAmber.emissiveColor = new Color3(0.16, 0.11, 0.02);
    windowGlow.emissiveColor = new Color3(0.14, 0.32, 0.36);
    windowGlow.alpha = 0.42;
    planetAtmosphere.emissiveColor = new Color3(0.14, 0.34, 0.42);
    planetAtmosphere.alpha = 0.28;

    return {
      accentAmber,
      accentBlue,
      accentCyan,
      accentGreen,
      console,
      darkGlass,
      door,
      floor,
      glass,
      lightPanel,
      metal,
      planetAtmosphere,
      plantLeaf,
      plantStem,
      panel,
      posterPaper,
      robotBody,
      screen,
      screenRim,
      seat,
      trim,
      wall,
      windowGlow
    };
  }

  private createLighting(): DirectionalLight {
    const ambientLight = new HemisphericLight(
      "spaceStationAmbientLight",
      new Vector3(0, 1, 0),
      this.scene
    );

    ambientLight.intensity = 0.72;
    ambientLight.groundColor = new Color3(0.28, 0.32, 0.36);

    const shadowLight = new DirectionalLight(
      "spaceStationWindowLight",
      new Vector3(0.42, -0.9, 0.28),
      this.scene
    );

    shadowLight.position = new Vector3(-4.8, 5.4, -1.6);
    shadowLight.intensity = 0.58;

    const consoleAccentLight = new PointLight(
      "spaceConsoleAccentLight",
      new Vector3(0, 1.9, 2.2),
      this.scene
    );

    consoleAccentLight.intensity = 0.18;
    consoleAccentLight.diffuse = new Color3(0.55, 0.9, 0.92);
    consoleAccentLight.specular = new Color3(0.18, 0.32, 0.34);

    const windowSoftLight = new PointLight(
      "spaceWindowSoftLight",
      new Vector3(-4.9, 2.65, -0.8),
      this.scene
    );

    windowSoftLight.intensity = 0.16;
    windowSoftLight.diffuse = new Color3(0.58, 0.78, 0.92);
    windowSoftLight.specular = new Color3(0.14, 0.2, 0.26);

    return shadowLight;
  }

  private createRoom(): void {
    const floor = MeshBuilder.CreateGround(
      "spaceStationFloor",
      {
        width: 12,
        height: 14,
        subdivisions: 2
      },
      this.scene
    );

    floor.position.z = -0.7;
    floor.material = this.materials.floor;
    floor.isPickable = false;
    floor.receiveShadows = true;
    floor.checkCollisions = true;
    this.shadowReceivers.push(floor);
    this.collisionMeshes.push(floor);

    this.createFloorLines();

    this.createBox({
      name: "spaceStationCeiling",
      width: 12,
      height: 0.16,
      depth: 14,
      position: new Vector3(0, 4.28, -0.7),
      material: this.materials.wall,
      collides: true
    });

    this.createBox({
      name: "spaceStationFrontWall",
      width: 12,
      height: 4.25,
      depth: 0.22,
      position: new Vector3(0, 2.12, 6.3),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "spaceStationBackWall",
      width: 12,
      height: 4.25,
      depth: 0.22,
      position: new Vector3(0, 2.12, -7.7),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createLeftWallWithWindowOpening();

    this.createBox({
      name: "spaceStationRightWall",
      width: 0.22,
      height: 4.25,
      depth: 14,
      position: new Vector3(6, 2.12, -0.7),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBaseboards();
    this.createWallDepthPanels();
  }

  private createLeftWallWithWindowOpening(): void {
    this.createBox({
      name: "spaceStationLeftWallBackSection",
      width: 0.22,
      height: 4.25,
      depth: 3.18,
      position: new Vector3(-6, 2.12, -6.1),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "spaceStationLeftWallFrontSection",
      width: 0.22,
      height: 4.25,
      depth: 3.36,
      position: new Vector3(-6, 2.12, 4.62),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "spaceStationLeftWallBottomSection",
      width: 0.22,
      height: 0.78,
      depth: 7.32,
      position: new Vector3(-6, 0.39, -0.75),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "spaceStationLeftWallTopSection",
      width: 0.22,
      height: 0.25,
      depth: 7.32,
      position: new Vector3(-6, 4.12, -0.75),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });
  }

  private createFloorLines(): void {
    [-6.4, -4.6, -2.8, -1, 0.8, 2.6, 4.4].forEach((zPosition, index) => {
      this.createBox({
        name: `spaceFloorCrossLine${index + 1}`,
        width: 11.35,
        height: 0.012,
        depth: 0.035,
        position: new Vector3(0, 0.014, zPosition),
        material: this.materials.trim
      });
    });

    [-4, -2, 0, 2, 4].forEach((xPosition, index) => {
      this.createBox({
        name: `spaceFloorLongLine${index + 1}`,
        width: 0.035,
        height: 0.012,
        depth: 13.15,
        position: new Vector3(xPosition, 0.016, -0.7),
        material: this.materials.trim
      });
    });

    [
      { x: -3, z: -5.2, width: 1.45, depth: 1.1 },
      { x: 3, z: -5.2, width: 1.45, depth: 1.1 },
      { x: -3, z: -2.1, width: 1.55, depth: 1.2 },
      { x: 3, z: -2.1, width: 1.55, depth: 1.2 },
      { x: -3.2, z: 2.6, width: 1.75, depth: 1.28 },
      { x: 3.2, z: 2.6, width: 1.75, depth: 1.28 }
    ].forEach((panel, index) => {
      this.createBox({
        name: `spaceFloorRaisedPanel${index + 1}`,
        width: panel.width,
        height: 0.018,
        depth: panel.depth,
        position: new Vector3(panel.x, 0.026, panel.z),
        material: this.materials.metal
      });
    });

    [-1.1, 1.1].forEach((xPosition, index) => {
      this.createBox({
        name: `spaceFloorCyanGuide${index + 1}`,
        width: 0.055,
        height: 0.02,
        depth: 5.6,
        position: new Vector3(xPosition, 0.04, 1.3),
        material: this.materials.accentCyan
      });
    });
  }

  private createBaseboards(): void {
    this.createBox({
      name: "spaceFrontBaseboard",
      width: 11.75,
      height: 0.14,
      depth: 0.1,
      position: new Vector3(0, 0.16, 6.16),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceBackBaseboard",
      width: 11.75,
      height: 0.14,
      depth: 0.1,
      position: new Vector3(0, 0.16, -7.56),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceLeftBaseboard",
      width: 0.1,
      height: 0.14,
      depth: 13.65,
      position: new Vector3(-5.86, 0.16, -0.7),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceRightBaseboard",
      width: 0.1,
      height: 0.14,
      depth: 13.65,
      position: new Vector3(5.86, 0.16, -0.7),
      material: this.materials.trim,
      castsShadow: true
    });
  }

  private createWallDepthPanels(): void {
    [-4.8, -2.1, 1.9, 4.8].forEach((zPosition, index) => {
      if (zPosition < -4.4 || zPosition > 4.3) {
        this.createBox({
          name: `leftWallVerticalRib${index + 1}`,
          width: 0.16,
          height: 3.55,
          depth: 0.14,
          position: new Vector3(-5.78, 2.2, zPosition),
          material: this.materials.trim,
          castsShadow: true
        });
      }

      this.createBox({
        name: `rightWallVerticalRib${index + 1}`,
        width: 0.16,
        height: 3.55,
        depth: 0.14,
        position: new Vector3(5.78, 2.2, zPosition),
        material: this.materials.trim,
        castsShadow: true
      });
    });

    [-4.5, 4.5].forEach((xPosition, index) => {
      this.createBox({
        name: `frontWallSupportColumn${index + 1}`,
        width: 0.38,
        height: 3.72,
        depth: 0.2,
        position: new Vector3(xPosition, 2.18, 6.04),
        material: this.materials.trim,
        castsShadow: true
      });

      this.createBox({
        name: `backWallSupportColumn${index + 1}`,
        width: 0.38,
        height: 3.72,
        depth: 0.2,
        position: new Vector3(xPosition, 2.18, -7.45),
        material: this.materials.trim,
        castsShadow: true
      });
    });

    [-3.2, 0, 3.2].forEach((xPosition, index) => {
      this.createBox({
        name: `ceilingLongBeam${index + 1}`,
        width: 0.16,
        height: 0.22,
        depth: 12.8,
        position: new Vector3(xPosition, 4.02, -0.7),
        material: this.materials.trim,
        castsShadow: true
      });
    });

    [-4.8, -0.7, 3.4].forEach((zPosition, index) => {
      this.createBox({
        name: `ceilingCrossBeam${index + 1}`,
        width: 10.8,
        height: 0.16,
        depth: 0.16,
        position: new Vector3(0, 4.04, zPosition),
        material: this.materials.metal,
        castsShadow: true
      });
    });
  }

  private createMainConsole(): void {
    this.createBox({
      name: "cptConsoleBackModule",
      width: 4.7,
      height: 0.86,
      depth: 0.7,
      position: new Vector3(0, 0.62, 1.7),
      material: this.materials.console,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "cptConsoleBody",
      width: 4.35,
      height: 0.72,
      depth: 1.25,
      position: new Vector3(0, 0.58, 1.02),
      material: this.materials.console,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "cptConsoleTop",
      width: 4.65,
      height: 0.16,
      depth: 1.52,
      position: new Vector3(0, 1.02, 1.02),
      material: this.materials.metal,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "cptConsoleAngledPanel",
      width: 3.85,
      height: 0.12,
      depth: 0.82,
      position: new Vector3(0, 1.15, 1.34),
      material: this.materials.panel,
      castsShadow: true,
      rotationX: -0.22
    });

    this.createConsoleMiniScreen(
      "leftConsoleOrbitScreen",
      new Vector3(-1.52, 1.2, 1.2),
      "orbit"
    );
    this.createConsoleMiniScreen(
      "rightConsoleWaveScreen",
      new Vector3(1.52, 1.2, 1.2),
      "wave"
    );

    [
      { x: -1.66, z: 0.68, material: this.materials.accentCyan },
      { x: -1.1, z: 0.78, material: this.materials.accentBlue },
      { x: -0.55, z: 0.68, material: this.materials.accentAmber },
      { x: 0, z: 0.82, material: this.materials.accentCyan },
      { x: 0.55, z: 0.68, material: this.materials.accentBlue },
      { x: 1.1, z: 0.78, material: this.materials.accentGreen },
      { x: 1.66, z: 0.68, material: this.materials.accentAmber }
    ].forEach((button, index) => {
      this.createBox({
        name: `cptConsoleSoftButton${index + 1}`,
        width: 0.28,
        height: 0.025,
        depth: 0.16,
        position: new Vector3(button.x, 1.12, button.z),
        material: button.material,
        castsShadow: true,
        hideDuringEvaluation: true
      });
    });

    [-0.88, -0.44, 0.44, 0.88].forEach((xPosition, index) => {
      const material = this.createEmissiveMaterial(
        `consolePulseIndicatorMaterial${index + 1}`,
        index % 2 === 0
          ? new Color3(0.31, 0.76, 0.85)
          : new Color3(0.91, 0.77, 0.42),
        0.38
      );

      this.consoleLightMaterials.push(material);
      this.createBox({
        name: `consolePulseIndicator${index + 1}`,
        width: 0.14,
        height: 0.022,
        depth: 0.14,
        position: new Vector3(xPosition, 1.31, 1.72),
        material,
        dynamic: true,
        rotationX: -0.22,
        hideDuringEvaluation: true
      });
    });

    this.createBox({
      name: "leftConsoleWing",
      width: 1.1,
      height: 0.58,
      depth: 1.08,
      position: new Vector3(-2.82, 0.56, 1.1),
      material: this.materials.console,
      castsShadow: true,
      collides: true,
      rotationY: -0.18
    });

    this.createBox({
      name: "rightConsoleWing",
      width: 1.1,
      height: 0.58,
      depth: 1.08,
      position: new Vector3(2.82, 0.56, 1.1),
      material: this.materials.console,
      castsShadow: true,
      collides: true,
      rotationY: 0.18
    });

    this.createChair("spaceEvaluationSeat", new Vector3(0, 0, -0.68), 0);
  }

  private createConsoleMiniScreen(
    name: string,
    position: Vector3,
    variant: "orbit" | "wave"
  ): void {
    const material = this.createPanelTextureMaterial(
      `${name}Material`,
      variant,
      512,
      256
    );

    this.createBox({
      name,
      width: 0.94,
      height: 0.024,
      depth: 0.42,
      position,
      material,
      castsShadow: true,
      rotationX: -0.22,
      hideDuringEvaluation: true
    });
  }

  private createCPTScreen(): Mesh {
    this.createBox({
      name: "cptScreenBackPlate",
      width: 6.35,
      height: 3.18,
      depth: 0.16,
      position: new Vector3(0, 2.52, 5.82),
      material: this.materials.panel,
      castsShadow: true
    });

    this.createBox({
      name: "cptScreenOuterGlowTop",
      width: 6.05,
      height: 0.06,
      depth: 0.08,
      position: new Vector3(0, 4.03, 5.62),
      material: this.materials.screenRim
    });

    this.createBox({
      name: "cptScreenOuterGlowBottom",
      width: 6.05,
      height: 0.06,
      depth: 0.08,
      position: new Vector3(0, 1.01, 5.62),
      material: this.materials.screenRim
    });

    this.createBox({
      name: "cptScreenFrameTop",
      width: 6.22,
      height: 0.2,
      depth: 0.24,
      position: new Vector3(0, 3.92, 5.72),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "cptScreenFrameBottom",
      width: 6.22,
      height: 0.2,
      depth: 0.24,
      position: new Vector3(0, 1.12, 5.72),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "cptScreenFrameLeft",
      width: 0.2,
      height: 2.98,
      depth: 0.24,
      position: new Vector3(-2.96, 2.52, 5.72),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "cptScreenFrameRight",
      width: 0.2,
      height: 2.98,
      depth: 0.24,
      position: new Vector3(2.96, 2.52, 5.72),
      material: this.materials.trim,
      castsShadow: true
    });

    [
      { x: -2.96, y: 3.92 },
      { x: 2.96, y: 3.92 },
      { x: -2.96, y: 1.12 },
      { x: 2.96, y: 1.12 }
    ].forEach((corner, index) => {
      this.createBox({
        name: `cptScreenCornerBlock${index + 1}`,
        width: 0.34,
        height: 0.34,
        depth: 0.28,
        position: new Vector3(corner.x, corner.y, 5.68),
        material: this.materials.screenRim,
        castsShadow: true
      });
    });

    const screen = MeshBuilder.CreatePlane(
      "cptScreenDisplay",
      {
        width: 5.52,
        height: 2.52
      },
      this.scene
    );

    screen.position = new Vector3(0, 2.52, 5.61);
    screen.material = this.materials.screen;
    screen.isPickable = false;
    screen.metadata = {
      role: "cpt-screen",
      dynamic: true
    };

    return screen;
  }

  private createSpaceWindow(): void {
    const spaceViewMaterial = this.createSpaceBackdropMaterial(
      "spaceWindowBackdropMaterial",
      "spaceWindowBackdropTexture"
    );
    const backdrop = MeshBuilder.CreatePlane(
      "spaceWindowBackdrop",
      {
        width: 6.8,
        height: 3.15
      },
      this.scene
    );

    backdrop.position = new Vector3(this.windowBackdropX, 2.48, -0.75);
    backdrop.rotation.y = Math.PI / 2;
    backdrop.material = spaceViewMaterial;
    backdrop.isPickable = false;

    const glow = MeshBuilder.CreatePlane(
      "spaceWindowSoftGlow",
      {
        width: 7.02,
        height: 3.36
      },
      this.scene
    );

    glow.position = new Vector3(this.windowGlassX - 0.06, 2.48, -0.75);
    glow.rotation.y = Math.PI / 2;
    glow.material = this.materials.windowGlow;
    glow.isPickable = false;

    const glass = MeshBuilder.CreatePlane(
      "spaceWindowGlass",
      {
        width: 6.28,
        height: 3.08
      },
      this.scene
    );

    glass.position = new Vector3(this.windowGlassX, 2.48, -0.75);
    glass.rotation.y = Math.PI / 2;
    glass.material = this.materials.glass;
    glass.isPickable = false;

    this.createBox({
      name: "spaceWindowTopFrame",
      width: 0.34,
      height: 0.24,
      depth: 7.16,
      position: new Vector3(this.windowGlassX + 0.06, 4.12, -0.75),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceWindowBottomFrame",
      width: 0.34,
      height: 0.24,
      depth: 7.16,
      position: new Vector3(this.windowGlassX + 0.06, 0.84, -0.75),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceWindowRearFrame",
      width: 0.34,
      height: 3.34,
      depth: 0.24,
      position: new Vector3(this.windowGlassX + 0.06, 2.48, -4.24),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceWindowFrontFrame",
      width: 0.34,
      height: 3.34,
      depth: 0.24,
      position: new Vector3(this.windowGlassX + 0.06, 2.48, 2.74),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createWindowNeonFrameLights();
    this.createWindowLedLights();
    this.createWindowSpaceChamber(spaceViewMaterial);
    this.createWindowInteriorMask();
    this.createWindowParallaxLayers();
    this.createStarField();
    this.createPlanets();
    this.createSideWallPlanets();
    this.createWindowDepthOrbits();
    this.createAsteroids();
    this.createSatellite();
    this.createAsteroidPassMesh();
  }

  private createWindowNeonFrameLights(): void {
    const neonMaterial = this.createEmissiveMaterial(
      "spaceWindowFrameNeonMaterial",
      new Color3(0.28, 0.82, 0.94),
      0.9
    );
    const neonX = this.windowGlassX + 0.21;

    neonMaterial.disableLighting = true;
    this.consoleLightMaterials.push(neonMaterial);

    [
      {
        name: "spaceWindowFrameNeonTop",
        width: 0.055,
        height: 0.045,
        depth: 6.28,
        position: new Vector3(neonX, 3.92, -0.75)
      },
      {
        name: "spaceWindowFrameNeonBottom",
        width: 0.055,
        height: 0.045,
        depth: 6.28,
        position: new Vector3(neonX, 1.04, -0.75)
      },
      {
        name: "spaceWindowFrameNeonRearSide",
        width: 0.055,
        height: 2.78,
        depth: 0.045,
        position: new Vector3(neonX, 2.48, -3.98)
      },
      {
        name: "spaceWindowFrameNeonFrontSide",
        width: 0.055,
        height: 2.78,
        depth: 0.045,
        position: new Vector3(neonX, 2.48, 2.48)
      }
    ].forEach((strip) => {
      this.createBox({
        name: strip.name,
        width: strip.width,
        height: strip.height,
        depth: strip.depth,
        position: strip.position,
        material: neonMaterial,
        dynamic: true
      });
    });

    [
      { name: "spaceWindowFrameNeonTopLight", y: 3.92, z: -0.75 },
      { name: "spaceWindowFrameNeonBottomLight", y: 1.04, z: -0.75 }
    ].forEach((lightOptions) => {
      const light = new PointLight(
        lightOptions.name,
        new Vector3(neonX + 0.08, lightOptions.y, lightOptions.z),
        this.scene
      );

      light.intensity = 0.08;
      light.range = 2.4;
      light.diffuse = new Color3(0.32, 0.86, 0.96);
      light.specular = new Color3(0.08, 0.22, 0.25);
    });
  }

  private createWindowLedLights(): void {
    const coolLedMaterial = this.createEmissiveMaterial(
      "spaceWindowCoolLedMaterial",
      new Color3(0.5, 0.9, 1),
      0.92
    );
    const warmLedMaterial = this.createEmissiveMaterial(
      "spaceWindowWarmLedMaterial",
      new Color3(0.95, 0.78, 0.42),
      0.74
    );
    const ledX = this.windowGlassX + 0.18;
    const zPositions = [-3.66, -2.86, -2.06, -1.26, -0.46, 0.34, 1.14, 1.94];
    const yPositions = [1.42, 1.9, 2.38, 2.86, 3.34, 3.72];

    coolLedMaterial.disableLighting = true;
    warmLedMaterial.disableLighting = true;
    this.consoleLightMaterials.push(coolLedMaterial, warmLedMaterial);

    zPositions.forEach((zPosition, index) => {
      this.createWindowLed(
        `spaceWindowTopLed${index + 1}`,
        new Vector3(ledX, 3.9, zPosition),
        index % 5 === 0 ? warmLedMaterial : coolLedMaterial
      );
      this.createWindowLed(
        `spaceWindowBottomLed${index + 1}`,
        new Vector3(ledX, 1.04, zPosition),
        index % 4 === 0 ? warmLedMaterial : coolLedMaterial
      );
    });

    [-3.98, 2.48].forEach((zPosition, sideIndex) => {
      yPositions.forEach((yPosition, index) => {
        this.createWindowLed(
          `spaceWindowSideLed${sideIndex + 1}_${index + 1}`,
          new Vector3(ledX, yPosition, zPosition),
          index % 4 === 1 ? warmLedMaterial : coolLedMaterial
        );
      });
    });

    [
      { name: "spaceWindowTopLedLight", y: 3.86, z: -0.85 },
      { name: "spaceWindowBottomLedLight", y: 1.08, z: -0.85 },
      { name: "spaceWindowRearSideLedLight", y: 2.48, z: -3.92 },
      { name: "spaceWindowFrontSideLedLight", y: 2.48, z: 2.42 }
    ].forEach((lightOptions) => {
      const light = new PointLight(
        lightOptions.name,
        new Vector3(ledX + 0.08, lightOptions.y, lightOptions.z),
        this.scene
      );

      light.intensity = 0.055;
      light.range = 1.85;
      light.diffuse = new Color3(0.48, 0.88, 0.96);
      light.specular = new Color3(0.1, 0.18, 0.2);
    });
  }

  private createWindowLed(
    name: string,
    position: Vector3,
    material: StandardMaterial
  ): void {
    const led = MeshBuilder.CreateSphere(
      name,
      {
        diameter: 0.07,
        segments: 12
      },
      this.scene
    );

    led.position = position;
    led.scaling.x = 0.55;
    led.material = material;
    led.isPickable = false;
    led.metadata = {
      dynamic: true,
      role: "space-window-led"
    };
  }

  private createWindowSpaceChamber(spaceMaterial: StandardMaterial): void {
    const chamberDepth = this.windowGlassX - this.windowBackdropX;
    const chamberCenterX = this.windowBackdropX + chamberDepth / 2;
    const chamberSurfaces = [
      {
        name: "spaceWindowChamberFloorSky",
        width: chamberDepth,
        height: 6.78,
        position: new Vector3(chamberCenterX, 0.96, -0.75),
        rotationX: Math.PI / 2
      },
      {
        name: "spaceWindowChamberCeilingSky",
        width: chamberDepth,
        height: 6.78,
        position: new Vector3(chamberCenterX, 4.0, -0.75),
        rotationX: Math.PI / 2
      },
      {
        name: "spaceWindowChamberRearSideSky",
        width: chamberDepth,
        height: 3.04,
        position: new Vector3(chamberCenterX, 2.48, -4.08),
        rotationX: 0
      },
      {
        name: "spaceWindowChamberFrontSideSky",
        width: chamberDepth,
        height: 3.04,
        position: new Vector3(chamberCenterX, 2.48, 2.58),
        rotationX: 0
      }
    ];

    chamberSurfaces.forEach((surfaceOptions) => {
      const surface = MeshBuilder.CreatePlane(
        surfaceOptions.name,
        {
          width: surfaceOptions.width,
          height: surfaceOptions.height
        },
        this.scene
      );

      surface.position = surfaceOptions.position;
      surface.rotation.x = surfaceOptions.rotationX;
      surface.material = spaceMaterial;
      surface.isPickable = false;
    });

    [
      { name: "spaceWindowChamberRearTopEdge", y: 3.98, z: -4.08 },
      { name: "spaceWindowChamberRearBottomEdge", y: 0.98, z: -4.08 },
      { name: "spaceWindowChamberFrontTopEdge", y: 3.98, z: 2.58 },
      { name: "spaceWindowChamberFrontBottomEdge", y: 0.98, z: 2.58 }
    ].forEach((edge) => {
      this.createBox({
        name: edge.name,
        width: chamberDepth,
        height: 0.045,
        depth: 0.045,
        position: new Vector3(chamberCenterX, edge.y, edge.z),
        material: this.materials.trim
      });
    });

  }

  private createWindowInteriorMask(): void {
    const maskX = this.windowGlassX + 0.13;

    this.createBox({
      name: "spaceWindowRearWallMask",
      width: 0.1,
      height: 3.72,
      depth: 2.9,
      position: new Vector3(maskX, 2.48, -5.76),
      material: this.materials.wall
    });

    this.createBox({
      name: "spaceWindowFrontWallMask",
      width: 0.1,
      height: 3.72,
      depth: 2.8,
      position: new Vector3(maskX, 2.48, 4.12),
      material: this.materials.wall
    });

    this.createBox({
      name: "spaceWindowBottomWallMask",
      width: 0.1,
      height: 0.88,
      depth: 6.86,
      position: new Vector3(maskX, 0.52, -0.75),
      material: this.materials.wall
    });

    this.createBox({
      name: "spaceWindowTopWallMask",
      width: 0.1,
      height: 0.5,
      depth: 6.86,
      position: new Vector3(maskX, 4.18, -0.75),
      material: this.materials.wall
    });
  }

  private createSidePanels(): void {
    this.createWallPanel("leftStationPanel", new Vector3(-3.95, 2.22, 5.94), 0);
    this.createWallPanel("rightStationPanel", new Vector3(3.95, 2.22, 5.94), 0);
    this.createWallPanel("rightSideStationPanel", new Vector3(5.78, 2.35, -2.75), -Math.PI / 2);
  }

  private createDoor(): void {
    const doorPivot = new TransformNode("spaceDoorPivot", this.scene);

    doorPivot.position = new Vector3(-1.08, 0, -7.42);
    doorPivot.metadata = {
      dynamic: true,
      role: "space-door-pivot"
    };
    this.doorPivot = doorPivot;

    const doorPanel = this.createBox({
      name: "spaceDoorPanel",
      width: 2.05,
      height: 2.72,
      depth: 0.12,
      position: new Vector3(0, 1.48, -7.5),
      material: this.materials.door,
      castsShadow: true,
      collides: true,
      dynamic: true
    });
    doorPanel.setParent(doorPivot);

    const doorInset = this.createBox({
      name: "spaceDoorInsetPanel",
      width: 1.52,
      height: 2.08,
      depth: 0.07,
      position: new Vector3(0, 1.54, -7.38),
      material: this.materials.panel,
      castsShadow: true,
      dynamic: true
    });
    doorInset.setParent(doorPivot);

    const doorSeam = this.createBox({
      name: "spaceDoorCenterSeam",
      width: 0.04,
      height: 2.48,
      depth: 0.08,
      position: new Vector3(0, 1.5, -7.42),
      material: this.materials.trim,
      castsShadow: true,
      dynamic: true
    });
    doorSeam.setParent(doorPivot);

    this.createBox({
      name: "spaceDoorStatusLight",
      width: 0.18,
      height: 0.18,
      depth: 0.06,
      position: new Vector3(1.28, 1.95, -7.38),
      material: this.materials.accentGreen,
      castsShadow: true
    });

    this.createBox({
      name: "spaceDoorSideConsole",
      width: 0.42,
      height: 0.78,
      depth: 0.1,
      position: new Vector3(1.55, 1.34, -7.34),
      material: this.materials.panel,
      castsShadow: true
    });

    this.createBox({
      name: "spaceDoorSideConsoleGlow",
      width: 0.22,
      height: 0.14,
      depth: 0.045,
      position: new Vector3(1.55, 1.52, -7.24),
      material: this.materials.screenRim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceDoorFrameTop",
      width: 2.52,
      height: 0.22,
      depth: 0.32,
      position: new Vector3(0, 2.88, -7.34),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceDoorFrameLeft",
      width: 0.22,
      height: 2.94,
      depth: 0.32,
      position: new Vector3(-1.18, 1.46, -7.34),
      material: this.materials.trim,
      castsShadow: true
    });

    this.createBox({
      name: "spaceDoorFrameRight",
      width: 0.22,
      height: 2.94,
      depth: 0.32,
      position: new Vector3(1.18, 1.46, -7.34),
      material: this.materials.trim,
      castsShadow: true
    });
  }

  private createCeilingLights(): void {
    [
      { name: "leftBackSpaceCeilingLight", x: -3.2, z: -4.7 },
      { name: "rightBackSpaceCeilingLight", x: 3.2, z: -4.7 },
      { name: "leftFrontSpaceCeilingLight", x: -3.2, z: 1.4 },
      { name: "rightFrontSpaceCeilingLight", x: 3.2, z: 1.4 }
    ].forEach((lightPanel) => {
      this.createBox({
        name: `${lightPanel.name}Frame`,
        width: 1.05,
        height: 0.08,
        depth: 2.1,
        position: new Vector3(lightPanel.x, 4.18, lightPanel.z),
        material: this.materials.metal,
        castsShadow: true
      });

      this.createBox({
        name: `${lightPanel.name}Panel`,
        width: 0.84,
        height: 0.085,
        depth: 1.82,
        position: new Vector3(lightPanel.x, 4.12, lightPanel.z),
        material: this.materials.lightPanel
      });
    });
  }

  private createDecorations(): void {
    this.createBox({
      name: "frontScreenShelf",
      width: 5.1,
      height: 0.08,
      depth: 0.32,
      position: new Vector3(0, 0.88, 5.48),
      material: this.materials.metal,
      castsShadow: true
    });

    this.createBox({
      name: "leftEquipmentCabinet",
      width: 1.25,
      height: 1.28,
      depth: 0.5,
      position: new Vector3(-4.65, 0.72, -5.55),
      material: this.materials.panel,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "rightEquipmentCabinet",
      width: 1.25,
      height: 1.28,
      depth: 0.5,
      position: new Vector3(4.65, 0.72, -5.55),
      material: this.materials.panel,
      castsShadow: true,
      collides: true
    });

    [-0.36, 0, 0.36].forEach((xOffset, index) => {
      this.createBox({
        name: `leftCabinetDrawer${index + 1}`,
        width: 0.28,
        height: 0.2,
        depth: 0.05,
        position: new Vector3(-4.65 + xOffset, 0.92, -5.82),
        material: this.materials.accentBlue,
        castsShadow: true
      });

      this.createBox({
        name: `rightCabinetDrawer${index + 1}`,
        width: 0.28,
        height: 0.2,
        depth: 0.05,
        position: new Vector3(4.65 + xOffset, 0.92, -5.82),
        material: this.materials.accentGreen,
        castsShadow: true
      });
    });

    this.createMonitorDecoration(new Vector3(-4.7, 1.55, -4.9), 0.25);
    this.createMonitorDecoration(new Vector3(4.7, 1.55, -4.9), -0.25);
    this.createPoster(
      "spaceExplorePoster",
      new Vector3(5.82, 2.92, 0.8),
      -Math.PI / 2,
      "EXPLORE"
    );
    this.createPoster(
      "spaceMissionPoster",
      new Vector3(5.82, 2.78, 2.42),
      -Math.PI / 2,
      "MISION"
    );
    this.createSolarSystemMobile(new Vector3(-3.85, 3.62, -5.65));
    this.createSmallPlant(new Vector3(-2.78, 1.22, 1.75));
    this.createSmallPlant(new Vector3(4.82, 1.34, -5.22));
    this.createDecorativeRobot();
  }

  private createAdditionalStationDetails(): void {
    this.createRightWallStorageBay();
    this.createBackSupplyArea();
    this.createConsoleLooseEquipment();
    this.createFloorCableRuns();
    this.createMaintenanceToolRack();
    this.createSpecimenStation();
    this.createWallAccentPanels();
  }

  private createRightWallStorageBay(): void {
    this.createBox({
      name: "rightWallStorageBackPanel",
      width: 0.08,
      height: 1.42,
      depth: 2.2,
      position: new Vector3(5.68, 1.08, -0.72),
      material: this.materials.panel,
      castsShadow: true
    });

    [0.52, 0.92, 1.32].forEach((yPosition, index) => {
      this.createBox({
        name: `rightWallStorageShelf${index + 1}`,
        width: 0.52,
        height: 0.08,
        depth: 2.12,
        position: new Vector3(5.42, yPosition, -0.72),
        material: this.materials.metal,
        castsShadow: true
      });
    });

    [-1.7, -0.92, -0.14, 0.62].forEach((zPosition, index) => {
      this.createBox({
        name: `rightWallSupplyBin${index + 1}`,
        width: 0.34,
        height: 0.24,
        depth: 0.44,
        position: new Vector3(5.28, 0.66 + (index % 2) * 0.42, zPosition),
        material:
          index % 3 === 0
            ? this.materials.accentAmber
            : index % 3 === 1
            ? this.materials.accentGreen
            : this.materials.accentBlue,
        castsShadow: true
      });
    });

    this.createBox({
      name: "rightWallMedKit",
      width: 0.18,
      height: 0.42,
      depth: 0.58,
      position: new Vector3(5.36, 1.55, 0.34),
      material: this.materials.posterPaper,
      castsShadow: true
    });
  }

  private createBackSupplyArea(): void {
    this.createSupplyCrate(
      "backLeftCargoCrate",
      new Vector3(-3.48, 0, -7.05),
      this.materials.accentBlue,
      0.12,
      1
    );
    this.createSupplyCrate(
      "backMiddleCargoCrate",
      new Vector3(-2.72, 0.36, -7.08),
      this.materials.accentAmber,
      -0.08,
      0.78
    );
    this.createSupplyCrate(
      "backRightCargoCrate",
      new Vector3(3.48, 0, -7.02),
      this.materials.accentGreen,
      -0.16,
      0.92
    );

    this.createOxygenTank("leftOxygenTank", new Vector3(-4.85, 0, -6.72), 0.98);
    this.createOxygenTank("rightOxygenTank", new Vector3(4.88, 0, -6.72), 0.92);
  }

  private createConsoleLooseEquipment(): void {
    this.createDataTablet(
      "leftConsoleLooseTablet",
      new Vector3(-1.72, 1.13, 0.38),
      -0.28,
      this.materials.accentCyan
    );
    this.createDataTablet(
      "rightConsoleLooseTablet",
      new Vector3(1.68, 1.13, 0.42),
      0.32,
      this.materials.accentAmber
    );

    this.createBox({
      name: "consoleNotebookPad",
      width: 0.7,
      height: 0.025,
      depth: 0.44,
      position: new Vector3(0.8, 1.13, 0.44),
      material: this.materials.posterPaper,
      castsShadow: true,
      rotationY: -0.18,
      hideDuringEvaluation: true
    });

    this.createBox({
      name: "consoleStylus",
      width: 0.05,
      height: 0.025,
      depth: 0.52,
      position: new Vector3(0.22, 1.15, 0.58),
      material: this.materials.accentAmber,
      castsShadow: true,
      rotationY: 0.54,
      hideDuringEvaluation: true
    });
  }

  private createFloorCableRuns(): void {
    this.createBox({
      name: "floorCableRunToWindow",
      width: 0.075,
      height: 0.025,
      depth: 4.4,
      position: new Vector3(-2.32, 0.055, -1.58),
      material: this.materials.trim,
      rotationY: -0.28
    });

    this.createBox({
      name: "floorCyanCableRunToConsole",
      width: 3.0,
      height: 0.028,
      depth: 0.07,
      position: new Vector3(2.58, 0.06, -2.95),
      material: this.materials.accentCyan,
      rotationY: 0.1
    });

    this.createBox({
      name: "floorCableConnector",
      width: 0.34,
      height: 0.06,
      depth: 0.2,
      position: new Vector3(1.22, 0.08, -2.84),
      material: this.materials.metal,
      castsShadow: true,
      rotationY: 0.1
    });
  }

  private createMaintenanceToolRack(): void {
    this.createBox({
      name: "maintenanceRackBackPlate",
      width: 0.07,
      height: 0.95,
      depth: 1.18,
      position: new Vector3(5.72, 2.05, -4.28),
      material: this.materials.panel,
      castsShadow: true
    });

    [-0.38, 0, 0.38].forEach((zOffset, index) => {
      this.createBox({
        name: `maintenanceRackTool${index + 1}`,
        width: 0.08,
        height: 0.58 - index * 0.07,
        depth: 0.06,
        position: new Vector3(5.64, 2.02, -4.28 + zOffset),
        material: index === 1 ? this.materials.accentAmber : this.materials.metal,
        castsShadow: true,
        rotationZ: index === 0 ? -0.22 : index === 2 ? 0.2 : 0
      });
    });

    this.createBox({
      name: "maintenanceRackHandle",
      width: 0.08,
      height: 0.1,
      depth: 0.92,
      position: new Vector3(5.62, 1.62, -4.28),
      material: this.materials.accentCyan,
      castsShadow: true
    });
  }

  private createSpecimenStation(): void {
    this.createBox({
      name: "specimenStationTable",
      width: 1.58,
      height: 0.16,
      depth: 0.76,
      position: new Vector3(-4.72, 1.0, 2.85),
      material: this.materials.metal,
      castsShadow: true
    });

    [-0.48, 0, 0.48].forEach((zOffset, index) => {
      this.createSpecimenTube(
        `specimenTube${index + 1}`,
        new Vector3(-4.72, 1.32, 2.85 + zOffset),
        index
      );
    });
  }

  private createWallAccentPanels(): void {
    [
      { y: 2.92, z: -1.8, material: this.materials.accentCyan },
      { y: 2.44, z: -1.2, material: this.materials.accentAmber },
      { y: 1.96, z: -0.62, material: this.materials.accentGreen }
    ].forEach((panel, index) => {
      this.createBox({
        name: `rightWallSmallSignalPanel${index + 1}`,
        width: 0.045,
        height: 0.18,
        depth: 0.52,
        position: new Vector3(5.82, panel.y, panel.z),
        material: panel.material,
        castsShadow: true
      });
    });

    [
      { x: -4.1, y: 2.82, material: this.materials.accentBlue },
      { x: -3.42, y: 2.42, material: this.materials.accentCyan },
      { x: 3.22, y: 2.72, material: this.materials.accentAmber },
      { x: 4.0, y: 2.36, material: this.materials.accentGreen }
    ].forEach((panel, index) => {
      this.createBox({
        name: `backWallEquipmentPlate${index + 1}`,
        width: 0.58,
        height: 0.34,
        depth: 0.045,
        position: new Vector3(panel.x, panel.y, -7.52),
        material: panel.material,
        castsShadow: true
      });
    });
  }

  private createSupplyCrate(
    name: string,
    position: Vector3,
    material: StandardMaterial,
    rotationY: number,
    scale: number
  ): void {
    this.createBox({
      name: `${name}Body`,
      width: 0.76 * scale,
      height: 0.46 * scale,
      depth: 0.56 * scale,
      position: new Vector3(position.x, position.y + 0.23 * scale, position.z),
      material,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}Latch`,
      width: 0.18 * scale,
      height: 0.1 * scale,
      depth: 0.06 * scale,
      position: new Vector3(
        position.x,
        position.y + 0.28 * scale,
        position.z - 0.3 * scale
      ),
      material: this.materials.accentCyan,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}Strap`,
      width: 0.08 * scale,
      height: 0.5 * scale,
      depth: 0.59 * scale,
      position: new Vector3(position.x, position.y + 0.24 * scale, position.z),
      material: this.materials.trim,
      castsShadow: true,
      rotationY
    });
  }

  private createOxygenTank(name: string, position: Vector3, scale: number): void {
    const tank = MeshBuilder.CreateCylinder(
      `${name}Body`,
      {
        height: 1.1 * scale,
        diameter: 0.24 * scale,
        tessellation: 18
      },
      this.scene
    );

    tank.position = new Vector3(position.x, position.y + 0.58 * scale, position.z);
    tank.rotation.z = 0.06;
    tank.material = this.materials.accentCyan;
    tank.isPickable = false;
    this.shadowCasters.push(tank);

    this.createBox({
      name: `${name}Valve`,
      width: 0.18 * scale,
      height: 0.08 * scale,
      depth: 0.16 * scale,
      position: new Vector3(position.x, position.y + 1.18 * scale, position.z),
      material: this.materials.accentAmber,
      castsShadow: true
    });
  }

  private createDataTablet(
    name: string,
    position: Vector3,
    rotationY: number,
    accentMaterial: StandardMaterial
  ): void {
    this.createBox({
      name: `${name}Body`,
      width: 0.58,
      height: 0.024,
      depth: 0.38,
      position,
      material: this.materials.panel,
      castsShadow: true,
      rotationY,
      hideDuringEvaluation: true
    });

    this.createBox({
      name: `${name}GlowLine`,
      width: 0.38,
      height: 0.014,
      depth: 0.045,
      position: new Vector3(position.x, position.y + 0.023, position.z - 0.08),
      material: accentMaterial,
      castsShadow: true,
      rotationY,
      hideDuringEvaluation: true
    });
  }

  private createSpecimenTube(name: string, position: Vector3, index: number): void {
    const tube = MeshBuilder.CreateCylinder(
      `${name}Glass`,
      {
        height: 0.64,
        diameter: 0.18,
        tessellation: 20
      },
      this.scene
    );

    tube.position = position;
    tube.material = this.materials.glass;
    tube.isPickable = false;
    this.shadowCasters.push(tube);

    const sample = MeshBuilder.CreateSphere(
      `${name}Sample`,
      {
        diameter: 0.14,
        segments: 12
      },
      this.scene
    );

    sample.position = new Vector3(position.x, position.y - 0.04, position.z);
    sample.material =
      index === 0
        ? this.materials.accentGreen
        : index === 1
        ? this.materials.accentAmber
        : this.materials.accentBlue;
    sample.isPickable = false;
    this.shadowCasters.push(sample);
  }

  private createAnchors(): SpaceStationDistractorAnchors & {
    cptScreenAnchor: TransformNode;
    evaluationSeatAnchor: TransformNode;
    explorationSpawnAnchor: TransformNode;
  } {
    const cptScreenAnchor = this.createAnchor(
      "cptScreenAnchor",
      "cpt-screen-anchor",
      new Vector3(0, 2.52, 5.5)
    );
    const evaluationSeatAnchor = this.createAnchor(
      "evaluationSeatAnchor",
      "evaluation-seat-anchor",
      new Vector3(0, 1.28, -0.96)
    );
    const explorationSpawnAnchor = this.createAnchor(
      "explorationSpawnAnchor",
      "exploration-spawn-anchor",
      new Vector3(0, 1.52, -5.6)
    );
    const windowDistractorAnchor = this.createAnchor(
      "windowDistractorAnchor",
      "window-distractor-anchor",
      new Vector3(-5.48, 2.42, -0.85)
    );
    const doorDistractorAnchor = this.createAnchor(
      "spaceDoorDistractorAnchor",
      "door-distractor-anchor",
      new Vector3(0, 1.65, -7.18)
    );
    const leftPanelDistractorAnchor = this.createAnchor(
      "leftPanelDistractorAnchor",
      "left-panel-distractor-anchor",
      new Vector3(-3.95, 2.22, 5.72)
    );
    const rightPanelDistractorAnchor = this.createAnchor(
      "rightPanelDistractorAnchor",
      "right-panel-distractor-anchor",
      new Vector3(3.95, 2.22, 5.72)
    );
    const corridorDistractorAnchor = this.createAnchor(
      "corridorDistractorAnchor",
      "corridor-distractor-anchor",
      new Vector3(4.45, 0.54, -2.8)
    );

    return {
      cptScreenAnchor,
      evaluationSeatAnchor,
      explorationSpawnAnchor,
      windowDistractorAnchor,
      doorDistractorAnchor,
      leftPanelDistractorAnchor,
      rightPanelDistractorAnchor,
      corridorDistractorAnchor
    };
  }

  private createChair(name: string, position: Vector3, rotationY: number): void {
    this.createBox({
      name: `${name}Seat`,
      width: 0.86,
      height: 0.14,
      depth: 0.78,
      position: new Vector3(position.x, 0.5, position.z),
      material: this.materials.seat,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}Back`,
      width: 0.86,
      height: 0.82,
      depth: 0.12,
      position: new Vector3(position.x, 0.96, position.z - 0.36),
      material: this.materials.seat,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}Base`,
      width: 0.18,
      height: 0.5,
      depth: 0.18,
      position: new Vector3(position.x, 0.25, position.z),
      material: this.materials.metal,
      castsShadow: true
    });
  }

  private createWallPanel(name: string, position: Vector3, rotationY: number): void {
    const variant =
      name.includes("left") ? "orbit" : name.includes("rightSide") ? "wave" : "status";
    const displayMaterial = this.createPanelTextureMaterial(
      `${name}DisplayMaterial`,
      variant,
      768,
      512
    );
    const glowMaterial = this.createEmissiveMaterial(
      `${name}GlowMaterial`,
      name.includes("left")
        ? new Color3(0.31, 0.76, 0.85)
        : new Color3(0.29, 0.5, 0.75),
      0.32
    );

    glowMaterial.alpha = 0.22;

    if (name.includes("left")) {
      this.leftPanelGlowMaterial = glowMaterial;
    }

    if (name.includes("right") && !name.includes("rightSide")) {
      this.rightPanelGlowMaterial = glowMaterial;
    }

    this.createBox({
      name,
      width: 1.42,
      height: 1.02,
      depth: 0.1,
      position,
      material: this.materials.panel,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}OuterGlow`,
      width: 1.52,
      height: 1.12,
      depth: 0.035,
      position: new Vector3(position.x, position.y, position.z - 0.055),
      material: glowMaterial,
      dynamic: true,
      rotationY
    });

    this.createBox({
      name: `${name}Display`,
      width: 1.14,
      height: 0.72,
      depth: 0.04,
      position: new Vector3(position.x, position.y, position.z - 0.09),
      material: displayMaterial,
      rotationY
    });

    [-0.28, 0, 0.28].forEach((xOffset, index) => {
      this.createBox({
        name: `${name}Indicator${index + 1}`,
        width: 0.12,
        height: 0.12,
        depth: 0.05,
        position: new Vector3(position.x + xOffset, position.y - 0.43, position.z - 0.12),
        material: index === 1 ? this.materials.accentAmber : this.materials.accentCyan,
        rotationY
      });
    });

    this.createBox({
      name: `${name}StatusLine`,
      width: 0.82,
      height: 0.05,
      depth: 0.05,
      position: new Vector3(position.x, position.y + 0.43, position.z - 0.12),
      material: this.materials.accentBlue,
      rotationY
    });
  }

  private createMonitorDecoration(position: Vector3, rotationY: number): void {
    this.createBox({
      name: `sideMonitorBody${position.x}`,
      width: 0.82,
      height: 0.54,
      depth: 0.08,
      position,
      material: this.materials.screen,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `sideMonitorStand${position.x}`,
      width: 0.12,
      height: 0.42,
      depth: 0.12,
      position: new Vector3(position.x, position.y - 0.46, position.z),
      material: this.materials.metal,
      castsShadow: true,
      rotationY
    });
  }

  private createWindowParallaxLayers(): void {
    [
      {
        name: "spaceWindowNearNebula",
        x: this.windowGlassX - 0.72,
        color: new Color3(0.28, 0.72, 0.88),
        alpha: 0.28,
        phase: 0
      },
      {
        name: "spaceWindowDeepNebula",
        x: this.outsideWindowX - 0.24,
        color: new Color3(0.72, 0.6, 0.32),
        alpha: 0.2,
        phase: 1
      }
    ].forEach((layer) => {
      const plane = MeshBuilder.CreatePlane(
        layer.name,
        {
          width: 6.2,
          height: 2.7
        },
        this.scene
      );

      plane.position = new Vector3(layer.x, 2.48, -0.75);
      plane.rotation.y = Math.PI / 2;
      plane.material = this.createNebulaLayerMaterial(
        `${layer.name}Material`,
        `${layer.name}Texture`,
        layer.color,
        layer.alpha,
        layer.phase
      );
      plane.isPickable = false;
    });
  }

  private createStarField(): void {
    const starColors = [
      new Color3(0.95, 0.97, 1),
      new Color3(0.74, 0.9, 1),
      new Color3(1, 0.92, 0.74)
    ];

    const starMaterials = starColors.map((color, index) => {
      const material = this.createEmissiveMaterial(
        `spaceStarMaterial${index + 1}`,
        color,
        0.72
      );

      material.disableLighting = true;
      this.starMaterials.push(material);

      return material;
    });

    for (let index = 0; index < 46; index += 1) {
      const star = MeshBuilder.CreateSphere(
        `spaceWindowStar${index + 1}`,
        {
          diameter: index % 7 === 0 ? 0.052 : 0.032,
          segments: 8
        },
        this.scene
      );
      const depthRange = Math.max(
        0.1,
        this.outsideWindowX - this.windowBackdropX - 0.16
      );
      const xPosition =
        this.outsideWindowX - 0.08 - ((index * 0.19) % depthRange);
      const zPosition = -4 + ((index * 0.73) % 6.4);
      const yPosition = 1.12 + ((index * 0.47) % 2.68);

      star.position = new Vector3(xPosition, yPosition, zPosition);
      star.material = starMaterials[index % starMaterials.length];
      star.isPickable = false;
      star.metadata = {
        dynamic: true,
        role: "space-star"
      };
    }
  }

  private createPlanets(): void {
    const mainPlanet = this.createPlanetMesh({
      name: "spaceMainPlanet",
      position: new Vector3(this.outsideWindowX, 2.22, -2.55),
      diameter: 1.55,
      color: new Color3(0.25, 0.52, 0.78),
      emissive: new Color3(0.04, 0.1, 0.16),
      speed: 0.000008
    });

    this.createPlanetAtmosphere(mainPlanet, 1.72);
    this.createPlanetBand(mainPlanet, 1.55, 0.024, this.materials.accentGreen);

    const secondaryPlanet = this.createPlanetMesh({
      name: "spaceSecondaryPlanet",
      position: new Vector3(this.outsideWindowX - 0.01, 3.22, 1.5),
      diameter: 0.68,
      color: new Color3(0.78, 0.58, 0.38),
      emissive: new Color3(0.14, 0.08, 0.03),
      speed: 0.000012
    });

    this.createPlanetBand(secondaryPlanet, 0.78, 0.014, this.materials.accentAmber);

    this.createPlanetMesh({
      name: "spaceSmallMoon",
      position: new Vector3(this.outsideWindowX - 0.015, 1.7, 2.18),
      diameter: 0.26,
      color: new Color3(0.72, 0.75, 0.72),
      emissive: new Color3(0.07, 0.08, 0.08),
      speed: 0.000016
    });
  }

  private createSideWallPlanets(): void {
    const sidePlanets = [
      {
        name: "spaceRearSideVioletPlanet",
        position: new Vector3(this.windowGlassX - 0.78, 2.82, -3.86),
        diameter: 0.58,
        color: new Color3(0.52, 0.46, 0.82),
        emissive: new Color3(0.09, 0.06, 0.18),
        speed: 0.000014,
        bandMaterial: this.materials.screenRim
      },
      {
        name: "spaceRearSideSmallGoldPlanet",
        position: new Vector3(this.outsideWindowX - 0.22, 1.72, -3.92),
        diameter: 0.32,
        color: new Color3(0.86, 0.65, 0.36),
        emissive: new Color3(0.14, 0.08, 0.02),
        speed: 0.000019
      },
      {
        name: "spaceFrontSideGreenPlanet",
        position: new Vector3(this.windowGlassX - 1.08, 2.2, 2.38),
        diameter: 0.64,
        color: new Color3(0.36, 0.66, 0.54),
        emissive: new Color3(0.05, 0.14, 0.08),
        speed: 0.000013,
        bandMaterial: this.materials.accentAmber
      },
      {
        name: "spaceFrontSideRosePlanet",
        position: new Vector3(this.outsideWindowX - 0.34, 3.32, 2.36),
        diameter: 0.38,
        color: new Color3(0.78, 0.43, 0.5),
        emissive: new Color3(0.13, 0.04, 0.07),
        speed: 0.000017
      }
    ];

    sidePlanets.forEach((planetOptions) => {
      const planet = this.createPlanetMesh(planetOptions);

      if (planetOptions.bandMaterial) {
        this.createPlanetBand(
          planet,
          planetOptions.diameter * 1.12,
          0.012,
          planetOptions.bandMaterial
        );
      }
    });
  }

  private createWindowDepthOrbits(): void {
    [
      {
        name: "spaceWindowNearOrbitArc",
        x: this.windowGlassX - 0.54,
        y: 2.82,
        z: -1.92,
        diameter: 0.88,
        rotationZ: -0.42,
        material: this.materials.screenRim
      },
      {
        name: "spaceWindowMiddleOrbitArc",
        x: this.outsideWindowX - 0.04,
        y: 2.08,
        z: 0.62,
        diameter: 1.18,
        rotationZ: 0.3,
        material: this.materials.accentBlue
      },
      {
        name: "spaceWindowDeepOrbitArc",
        x: this.windowBackdropX + 0.22,
        y: 3.18,
        z: -0.06,
        diameter: 1.48,
        rotationZ: -0.18,
        material: this.materials.accentCyan
      }
    ].forEach((orbit) => {
      const ring = MeshBuilder.CreateTorus(
        orbit.name,
        {
          diameter: orbit.diameter,
          thickness: 0.008,
          tessellation: 48
        },
        this.scene
      );

      ring.position = new Vector3(orbit.x, orbit.y, orbit.z);
      ring.rotation.y = Math.PI / 2;
      ring.rotation.z = orbit.rotationZ;
      ring.material = orbit.material;
      ring.isPickable = false;
    });
  }

  private createPlanetMesh(options: {
    name: string;
    position: Vector3;
    diameter: number;
    color: Color3;
    emissive: Color3;
    speed: number;
  }): Mesh {
    const material = this.createPlanetMaterial(`${options.name}Material`, options.color);
    const planet = MeshBuilder.CreateSphere(
      options.name,
      {
        diameter: options.diameter,
        segments: 32
      },
      this.scene
    );

    material.emissiveColor = options.emissive;
    planet.position = options.position;
    planet.material = material;
    planet.isPickable = false;
    planet.metadata = {
      dynamic: true,
      role: "space-planet"
    };
    this.planets.push(planet);
    this.planetRotationSpeeds.push(options.speed);

    return planet;
  }

  private createPlanetMaterial(name: string, baseColor: Color3): StandardMaterial {
    const texture = new DynamicTexture(
      `${name}Texture`,
      {
        width: 512,
        height: 256
      },
      this.scene,
      false
    );
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const base = this.toRgb(baseColor);

    context.fillStyle = `rgb(${base.r}, ${base.g}, ${base.b})`;
    context.fillRect(0, 0, 512, 256);

    for (let index = 0; index < 28; index += 1) {
      const x = (index * 83 + 31) % 512;
      const y = (index * 41 + 19) % 256;
      const width = 80 + (index % 4) * 38;
      const alpha = 0.08 + (index % 5) * 0.035;

      context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      context.beginPath();
      context.ellipse(x, y, width, 12 + (index % 3) * 8, 0.08, 0, Math.PI * 2);
      context.fill();
    }

    texture.update();

    const material = this.createMaterial(name, baseColor);

    material.diffuseTexture = texture;
    material.specularColor = new Color3(0.04, 0.06, 0.08);

    return material;
  }

  private createPlanetAtmosphere(planet: Mesh, diameter: number): void {
    const atmosphere = MeshBuilder.CreateSphere(
      `${planet.name}Atmosphere`,
      {
        diameter,
        segments: 32
      },
      this.scene
    );

    atmosphere.position = planet.position.clone();
    atmosphere.material = this.materials.planetAtmosphere;
    atmosphere.isPickable = false;
    atmosphere.metadata = {
      dynamic: true,
      role: "space-planet-atmosphere"
    };
    this.planets.push(atmosphere);
    this.planetRotationSpeeds.push(0.000004);
  }

  private createPlanetBand(
    planet: Mesh,
    diameter: number,
    thickness: number,
    material: StandardMaterial
  ): void {
    const band = MeshBuilder.CreateTorus(
      `${planet.name}Band`,
      {
        diameter,
        thickness,
        tessellation: 44
      },
      this.scene
    );

    band.position = planet.position.clone();
    band.rotation.z = 0.42;
    band.rotation.y = Math.PI / 2;
    band.material = material;
    band.isPickable = false;
    band.metadata = {
      dynamic: true,
      role: "space-planet-band"
    };
  }

  private createAsteroids(): void {
    const asteroidMaterial = this.createMaterial(
      "spaceAsteroidMaterial",
      new Color3(0.5, 0.48, 0.42)
    );

    asteroidMaterial.emissiveColor = new Color3(0.03, 0.03, 0.028);

    [
      { y: 3.52, z: -2.95, scale: [0.18, 0.12, 0.24] },
      { y: 2.94, z: -2.06, scale: [0.1, 0.14, 0.12] },
      { y: 1.42, z: -1.58, scale: [0.14, 0.1, 0.18] },
      { y: 3.68, z: 0.24, scale: [0.12, 0.08, 0.16] },
      { y: 1.34, z: 0.84, scale: [0.09, 0.12, 0.1] },
      { y: 2.1, z: 2.46, scale: [0.13, 0.1, 0.2] },
      { y: 3.08, z: 2.22, scale: [0.08, 0.11, 0.13] }
    ].forEach((asteroid, index) => {
      const mesh = MeshBuilder.CreateSphere(
        `spaceAsteroid${index + 1}`,
        {
          diameter: 1,
          segments: 8
        },
        this.scene
      );

      mesh.position = new Vector3(this.outsideWindowX + 0.015, asteroid.y, asteroid.z);
      mesh.scaling.set(asteroid.scale[0], asteroid.scale[1], asteroid.scale[2]);
      mesh.rotation.set(index * 0.24, index * 0.38, index * 0.17);
      mesh.material = asteroidMaterial;
      mesh.isPickable = false;
      mesh.metadata = {
        dynamic: true,
        role: "space-asteroid"
      };
      this.asteroids.push(mesh);
    });
  }

  private createSatellite(): void {
    const root = new TransformNode("spaceSatelliteRoot", this.scene);

    root.position = new Vector3(this.outsideWindowX + 0.02, 2.86, -4.65);
    root.rotation.y = Math.PI / 2;
    root.setEnabled(false);

    const body = MeshBuilder.CreateBox(
      "spaceSatelliteBody",
      {
        width: 0.28,
        height: 0.18,
        depth: 0.18
      },
      this.scene
    );

    body.parent = root;
    body.material = this.materials.metal;
    body.isPickable = false;
    body.metadata = { dynamic: true, role: "space-satellite" };

    [-0.33, 0.33].forEach((xPosition, index) => {
      const panel = MeshBuilder.CreateBox(
        `spaceSatelliteSolarPanel${index + 1}`,
        {
          width: 0.42,
          height: 0.035,
          depth: 0.22
        },
        this.scene
      );

      panel.parent = root;
      panel.position.x = xPosition;
      panel.material = this.materials.accentBlue;
      panel.isPickable = false;
      panel.metadata = { dynamic: true, role: "space-satellite" };
    });

    const antenna = MeshBuilder.CreateCylinder(
      "spaceSatelliteAntenna",
      {
        height: 0.34,
        diameter: 0.025,
        tessellation: 8
      },
      this.scene
    );

    antenna.parent = root;
    antenna.position.y = 0.24;
    antenna.material = this.materials.screenRim;
    antenna.isPickable = false;
    antenna.metadata = { dynamic: true, role: "space-satellite" };

    this.satelliteRoot = root;
  }

  private createAsteroidPassMesh(): void {
    const material = this.createMaterial(
      "spaceAsteroidPassMaterial",
      new Color3(0.58, 0.54, 0.46)
    );
    const mesh = MeshBuilder.CreateSphere(
      "spaceAsteroidPass",
      {
        diameter: 1,
        segments: 8
      },
      this.scene
    );

    mesh.position = new Vector3(this.outsideWindowX + 0.02, 2.2, -4.7);
    mesh.scaling.set(0.2, 0.14, 0.26);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.setEnabled(false);
    mesh.metadata = {
      dynamic: true,
      role: "space-asteroid-pass"
    };
    this.asteroidPassMesh = mesh;
  }

  private createNebulaLayerMaterial(
    materialName: string,
    textureName: string,
    color: Color3,
    alpha: number,
    phase: number
  ): StandardMaterial {
    const texture = new DynamicTexture(
      textureName,
      {
        width: 1024,
        height: 512
      },
      this.scene,
      false
    );
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const rgb = this.toRgb(color);

    context.clearRect(0, 0, 1024, 512);
    context.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`;

    for (let index = 0; index < 5; index += 1) {
      const x = 120 + ((index * 211 + phase * 97) % 820);
      const y = 110 + ((index * 137 + phase * 61) % 310);
      const width = 150 + index * 42;
      const height = 36 + index * 11;

      context.beginPath();
      context.ellipse(x, y, width, height, 0.18 + index * 0.2, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "rgba(246, 250, 255, 0.5)";

    for (let index = 0; index < 42; index += 1) {
      const x = (index * 89 + phase * 43) % 1024;
      const y = (index * 67 + phase * 59) % 512;
      const radius = index % 6 === 0 ? 1.8 : 0.8;

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    texture.hasAlpha = true;
    texture.update();

    const material = new StandardMaterial(materialName, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = color.scale(0.56);
    material.specularColor = new Color3(0, 0, 0);
    material.alpha = alpha;
    material.backFaceCulling = false;
    material.disableLighting = true;
    material.useAlphaFromDiffuseTexture = true;

    return material;
  }

  private createSpaceBackdropMaterial(
    materialName: string = "spaceWindowBackdropMaterial",
    textureName: string = "spaceWindowBackdropTexture"
  ): StandardMaterial {
    const texture = new DynamicTexture(
      textureName,
      {
        width: 1024,
        height: 512
      },
      this.scene,
      false
    );
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    const gradient = context.createLinearGradient(0, 0, 1024, 512);

    gradient.addColorStop(0, "#06101d");
    gradient.addColorStop(0.48, "#0b1728");
    gradient.addColorStop(1, "#102338");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 512);

    context.fillStyle = "rgba(79, 195, 217, 0.08)";
    context.beginPath();
    context.ellipse(238, 190, 260, 68, -0.18, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(233, 196, 106, 0.06)";
    context.beginPath();
    context.ellipse(730, 330, 310, 82, 0.14, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f4f7ff";

    for (let index = 0; index < 128; index += 1) {
      const x = (index * 137 + 53) % 1024;
      const y = (index * 79 + 31) % 512;
      const radius = index % 9 === 0 ? 1.9 : 0.95;

      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    texture.update();

    const material = new StandardMaterial(materialName, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.9, 0.95, 1);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    material.disableLighting = true;

    return material;
  }

  private createPanelTextureMaterial(
    name: string,
    variant: "orbit" | "wave" | "status",
    width: number,
    height: number
  ): StandardMaterial {
    const texture = new DynamicTexture(
      `${name}Texture`,
      {
        width,
        height
      },
      this.scene,
      false
    );
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    context.fillStyle = "#0b2632";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(79, 195, 217, 0.32)";
    context.lineWidth = Math.max(3, width * 0.012);
    context.strokeRect(width * 0.06, height * 0.08, width * 0.88, height * 0.84);

    if (variant === "orbit") {
      this.paintOrbitPanel(context, width, height);
    }

    if (variant === "wave") {
      this.paintWavePanel(context, width, height);
    }

    if (variant === "status") {
      this.paintStatusPanel(context, width, height);
    }

    texture.update();

    const material = new StandardMaterial(name, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.35, 0.72, 0.78);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;

    return material;
  }

  private paintOrbitPanel(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const centerX = width * 0.5;
    const centerY = height * 0.52;

    context.strokeStyle = "rgba(224, 247, 250, 0.62)";
    context.lineWidth = width * 0.012;
    [0.22, 0.34].forEach((radiusScale) => {
      context.beginPath();
      context.ellipse(
        centerX,
        centerY,
        width * radiusScale,
        height * radiusScale * 0.55,
        -0.2,
        0,
        Math.PI * 2
      );
      context.stroke();
    });

    context.fillStyle = "#4fc3d9";
    context.beginPath();
    context.arc(centerX, centerY, width * 0.055, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#e9c46a";
    context.beginPath();
    context.arc(width * 0.68, height * 0.34, width * 0.026, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#86a9d6";
    context.beginPath();
    context.arc(width * 0.3, height * 0.64, width * 0.02, 0, Math.PI * 2);
    context.fill();
  }

  private paintWavePanel(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    context.strokeStyle = "rgba(233, 196, 106, 0.82)";
    context.lineWidth = width * 0.01;
    context.beginPath();

    for (let index = 0; index <= 56; index += 1) {
      const x = width * 0.12 + index * width * 0.014;
      const y =
        height * 0.52 +
        Math.sin(index * 0.42) * height * 0.14 +
        Math.sin(index * 0.13) * height * 0.06;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.stroke();
    context.fillStyle = "rgba(79, 195, 217, 0.64)";

    for (let index = 0; index < 5; index += 1) {
      context.fillRect(
        width * (0.18 + index * 0.13),
        height * 0.72,
        width * 0.08,
        height * (0.04 + index * 0.015)
      );
    }
  }

  private paintStatusPanel(
    context: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    context.fillStyle = "#dff7f3";
    context.font = `700 ${Math.floor(height * 0.12)}px Arial`;
    context.textAlign = "center";
    context.fillText("STATUS", width / 2, height * 0.24);

    ["O2", "NAV", "COM"].forEach((label, index) => {
      const y = height * (0.42 + index * 0.16);

      context.fillStyle = "#dff7f3";
      context.font = `600 ${Math.floor(height * 0.075)}px Arial`;
      context.fillText(label, width * 0.28, y);
      context.fillStyle = index === 1 ? "#e9c46a" : "#4fc3d9";
      context.fillRect(width * 0.42, y - height * 0.035, width * 0.28, height * 0.05);
    });
  }

  private createPoster(
    name: string,
    position: Vector3,
    rotationY: number,
    title: string
  ): void {
    const texture = new DynamicTexture(
      `${name}Texture`,
      {
        width: 512,
        height: 512
      },
      this.scene,
      false
    );
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    texture.uScale = -1;
    texture.uOffset = 1;
    context.fillStyle = "#e4d7ac";
    context.fillRect(0, 0, 512, 512);
    context.strokeStyle = "#3d474d";
    context.lineWidth = 24;
    context.strokeRect(18, 18, 476, 476);
    context.fillStyle = "#1e2f3a";
    context.font = "800 58px Arial";
    context.textAlign = "center";
    context.fillText(title, 256, 104);
    context.strokeStyle = "#4fc3d9";
    context.lineWidth = 8;
    context.beginPath();
    context.ellipse(256, 284, 130, 54, -0.26, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#4a7fbf";
    context.beginPath();
    context.arc(256, 284, 42, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e9c46a";
    context.beginPath();
    context.arc(370, 246, 18, 0, Math.PI * 2);
    context.fill();
    texture.update();

    const material = new StandardMaterial(`${name}Material`, this.scene);

    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.22, 0.2, 0.14);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;

    const poster = MeshBuilder.CreatePlane(
      name,
      {
        width: 0.82,
        height: 0.96
      },
      this.scene
    );

    poster.position = position;
    poster.rotation.y = rotationY;
    poster.material = material;
    poster.isPickable = false;
    this.shadowCasters.push(poster);
  }

  private createSolarSystemMobile(position: Vector3): void {
    const stem = MeshBuilder.CreateCylinder(
      "spaceSolarSystemStem",
      {
        height: 0.72,
        diameter: 0.025,
        tessellation: 8
      },
      this.scene
    );

    stem.position = position;
    stem.material = this.materials.metal;
    stem.isPickable = false;

    [0.22, 0.38, 0.56].forEach((radius, index) => {
      const orbit = MeshBuilder.CreateTorus(
        `spaceSolarSystemOrbit${index + 1}`,
        {
          diameter: radius,
          thickness: 0.008,
          tessellation: 32
        },
        this.scene
      );

      orbit.position = new Vector3(position.x, position.y - 0.42, position.z);
      orbit.rotation.x = Math.PI / 2;
      orbit.material = this.materials.screenRim;
      orbit.isPickable = false;
    });

    [
      { x: -0.2, z: 0.05, diameter: 0.08, material: this.materials.accentAmber },
      { x: 0.02, z: -0.16, diameter: 0.06, material: this.materials.accentBlue },
      { x: 0.26, z: 0.12, diameter: 0.05, material: this.materials.accentGreen }
    ].forEach((planet, index) => {
      const mesh = MeshBuilder.CreateSphere(
        `spaceSolarSystemMiniPlanet${index + 1}`,
        {
          diameter: planet.diameter,
          segments: 12
        },
        this.scene
      );

      mesh.position = new Vector3(
        position.x + planet.x,
        position.y - 0.42,
        position.z + planet.z
      );
      mesh.material = planet.material;
      mesh.isPickable = false;
    });
  }

  private createSmallPlant(position: Vector3): void {
    this.createBox({
      name: `spacePlantPot${position.x}`,
      width: 0.22,
      height: 0.18,
      depth: 0.22,
      position,
      material: this.materials.accentAmber,
      castsShadow: true
    });

    const stem = MeshBuilder.CreateCylinder(
      `spacePlantStem${position.x}`,
      {
        height: 0.36,
        diameter: 0.035,
        tessellation: 8
      },
      this.scene
    );

    stem.position = new Vector3(position.x, position.y + 0.26, position.z);
    stem.material = this.materials.plantStem;
    stem.isPickable = false;
    this.shadowCasters.push(stem);

    [-0.1, 0.1].forEach((xOffset, index) => {
      const leaf = MeshBuilder.CreateSphere(
        `spacePlantLeaf${position.x}${index + 1}`,
        {
          diameter: 0.18,
          segments: 10
        },
        this.scene
      );

      leaf.position = new Vector3(
        position.x + xOffset,
        position.y + 0.43 + index * 0.05,
        position.z
      );
      leaf.scaling.set(0.72, 1, 0.36);
      leaf.material = this.materials.plantLeaf;
      leaf.isPickable = false;
      this.shadowCasters.push(leaf);
    });
  }

  private createDecorativeRobot(): void {
    const root = new TransformNode("spaceRobotRoot", this.scene);

    root.position = new Vector3(2.72, 0, -0.05);
    root.rotation.y = -0.38;
    root.setEnabled(false);
    root.metadata = {
      dynamic: true,
      role: "space-robot-anchor"
    };

    this.robotRoot = root;
  }

  private createEmissiveMaterial(
    name: string,
    color: Color3,
    intensity: number
  ): StandardMaterial {
    const material = this.createMaterial(name, color);

    material.emissiveColor = color.scale(intensity);
    material.specularColor = new Color3(0.04, 0.06, 0.06);
    material.alpha = 1;

    return material;
  }

  private createAnchor(
    name: string,
    role: string,
    position: Vector3
  ): TransformNode {
    const anchor = new TransformNode(name, this.scene);

    anchor.position = position;
    anchor.metadata = {
      role
    };

    return anchor;
  }

  private toRgb(color: Color3): { r: number; g: number; b: number } {
    return {
      r: Math.round(color.r * 255),
      g: Math.round(color.g * 255),
      b: Math.round(color.b * 255)
    };
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);

    material.diffuseColor = color;
    material.specularColor = new Color3(0.1, 0.12, 0.12);

    return material;
  }

  private requireNode(node: TransformNode | null, name: string): TransformNode {
    if (!node) {
      throw new Error(`No se creo el nodo requerido: ${name}`);
    }

    return node;
  }

  private requireMesh(mesh: Mesh | null, name: string): Mesh {
    if (!mesh) {
      throw new Error(`No se creo el mesh requerido: ${name}`);
    }

    return mesh;
  }

  private requireMaterial(
    material: StandardMaterial | null,
    name: string
  ): StandardMaterial {
    if (!material) {
      throw new Error(`No se creo el material requerido: ${name}`);
    }

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
    mesh.rotation.x = options.rotationX ?? 0;
    mesh.rotation.y = options.rotationY ?? 0;
    mesh.rotation.z = options.rotationZ ?? 0;
    mesh.material = options.material;
    mesh.isPickable = false;

    if (options.dynamic) {
      mesh.metadata = {
        dynamic: true
      };
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
}
