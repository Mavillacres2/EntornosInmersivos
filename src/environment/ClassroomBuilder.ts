import {
  Color3,
  DynamicTexture,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";

interface ClassroomMaterials {
  accentCoral: StandardMaterial;
  accentGreen: StandardMaterial;
  accentOrange: StandardMaterial;
  accentSky: StandardMaterial;
  board: StandardMaterial;
  boardFrame: StandardMaterial;
  ceiling: StandardMaterial;
  chair: StandardMaterial;
  darkTrim: StandardMaterial;
  door: StandardMaterial;
  exteriorGround: StandardMaterial;
  floor: StandardMaterial;
  glass: StandardMaterial;
  lightPanel: StandardMaterial;
  metal: StandardMaterial;
  paper: StandardMaterial;
  pencil: StandardMaterial;
  posterPaper: StandardMaterial;
  projector: StandardMaterial;
  shelf: StandardMaterial;
  storageBlue: StandardMaterial;
  storageGreen: StandardMaterial;
  storagePurple: StandardMaterial;
  storageYellow: StandardMaterial;
  treeLeaves: StandardMaterial;
  treeTrunk: StandardMaterial;
  wall: StandardMaterial;
  warmFrame: StandardMaterial;
  windowSky: StandardMaterial;
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
  hideDuringEvaluation?: boolean;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
}

export interface ClassroomCameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface ClassroomBuildResult {
  explorationEyePosition: Vector3;
  explorationLookAt: Vector3;
  studentEyePosition: Vector3;
  studentLookAt: Vector3;
  stimulusAnchorPosition: Vector3;
  cameraBounds: ClassroomCameraBounds;
  collisionMeshes: Mesh[];
  evaluationHiddenMeshes: Mesh[];
  shadowCasters: Mesh[];
  shadowReceivers: Mesh[];
}

export class ClassroomBuilder {
  private readonly scene: Scene;
  private readonly materials: ClassroomMaterials;
  private readonly shadowCasters: Mesh[] = [];
  private readonly shadowReceivers: Mesh[] = [];
  private readonly collisionMeshes: Mesh[] = [];
  private readonly evaluationHiddenMeshes: Mesh[] = [];

  constructor(scene: Scene) {
    this.scene = scene;
    this.materials = this.createMaterials();
  }

  build(): ClassroomBuildResult {
    this.createRoom();
    this.createBoard();
    this.createTeacherDesk();
    this.createStudentFurnitureRows();
    this.createStudentDesk();
    this.createForegroundEdgeFurniture();
    this.createShelf();
    this.createStorageFurniture();
    this.createBackClassroomDetails();
    this.createWindows();
    this.createDoor();
    this.createWallDetails();
    this.createCeilingLightPanels();
    this.createProjector();
    this.createClock();
    this.createDecorations();
    this.createClassroomAnchors();

    return {
      explorationEyePosition: new Vector3(0, 1.52, -2),
      explorationLookAt: new Vector3(0, 2.35, 5.35),
      studentEyePosition: new Vector3(0, 1.3, -7.18),
      studentLookAt: new Vector3(0, 2.22, 5.32),
      stimulusAnchorPosition: new Vector3(0, 2.08, 5.18),
      cameraBounds: {
        minX: -7.85,
        maxX: 7.85,
        minZ: -8.95,
        maxZ: 5.1
      },
      collisionMeshes: [...this.collisionMeshes],
      evaluationHiddenMeshes: [...this.evaluationHiddenMeshes],
      shadowCasters: [...this.shadowCasters],
      shadowReceivers: [...this.shadowReceivers]
    };
  }

  private createMaterials(): ClassroomMaterials {
    const wall = this.createMaterial("wallMaterial", new Color3(0.56, 0.78, 0.72));
    const ceiling = this.createMaterial("ceilingMaterial", new Color3(0.91, 0.91, 0.88));
    const floor = this.createMaterial("floorMaterial", new Color3(0.73, 0.72, 0.67));
    const wood = this.createMaterial("lightWoodMaterial", new Color3(0.86, 0.76, 0.52));
    const chair = this.createMaterial("chairFrameMaterial", new Color3(0.88, 0.86, 0.7));
    const board = this.createMaterial("boardMaterial", new Color3(0.06, 0.27, 0.2));
    const boardFrame = this.createMaterial("boardFrameMaterial", new Color3(0.76, 0.57, 0.3));
    const darkTrim = this.createMaterial("darkTrimMaterial", new Color3(0.28, 0.31, 0.28));
    const metal = this.createMaterial("deskLegMaterial", new Color3(0.68, 0.76, 0.76));
    const door = this.createMaterial("doorMaterial", new Color3(0.9, 0.86, 0.72));
    const glass = this.createMaterial("glassMaterial", new Color3(0.68, 0.86, 0.94));
    const windowSky = this.createMaterial("windowSkyMaterial", new Color3(0.66, 0.84, 0.95));
    const exteriorGround = this.createMaterial("exteriorGroundMaterial", new Color3(0.49, 0.67, 0.42));
    const treeTrunk = this.createMaterial("treeTrunkMaterial", new Color3(0.43, 0.27, 0.12));
    const treeLeaves = this.createMaterial("treeLeavesMaterial", new Color3(0.35, 0.59, 0.34));
    const lightPanel = this.createMaterial("lightPanelMaterial", new Color3(0.98, 0.96, 0.86));
    const paper = this.createMaterial("paperMaterial", new Color3(0.93, 0.92, 0.82));
    const pencil = this.createMaterial("pencilMaterial", new Color3(0.88, 0.67, 0.2));
    const posterPaper = this.createMaterial("posterPaperMaterial", new Color3(0.94, 0.88, 0.67));
    const projector = this.createMaterial("projectorMaterial", new Color3(0.23, 0.26, 0.25));
    const shelf = this.createMaterial("shelfMaterial", new Color3(0.78, 0.61, 0.48));
    const warmFrame = this.createMaterial("warmFrameMaterial", new Color3(0.9, 0.65, 0.16));
    const accentCoral = this.createMaterial("accentCoralMaterial", new Color3(0.68, 0.22, 0.18));
    const accentGreen = this.createMaterial("accentGreenMaterial", new Color3(0.42, 0.6, 0.38));
    const accentOrange = this.createMaterial("accentOrangeMaterial", new Color3(0.82, 0.48, 0.22));
    const accentSky = this.createMaterial("accentSkyMaterial", new Color3(0.44, 0.67, 0.78));
    const storageBlue = this.createMaterial("storageBlueMaterial", new Color3(0.36, 0.56, 0.72));
    const storageGreen = this.createMaterial("storageGreenMaterial", new Color3(0.38, 0.58, 0.43));
    const storagePurple = this.createMaterial("storagePurpleMaterial", new Color3(0.56, 0.43, 0.64));
    const storageYellow = this.createMaterial("storageYellowMaterial", new Color3(0.78, 0.67, 0.28));

    floor.specularColor = new Color3(0.05, 0.05, 0.05);
    ceiling.emissiveColor = new Color3(0.78, 0.76, 0.66);
    ceiling.disableLighting = true;
    glass.alpha = 0.52;
    glass.specularColor = new Color3(0.8, 0.9, 1);
    lightPanel.emissiveColor = new Color3(0.88, 0.86, 0.7);
    lightPanel.disableLighting = true;

    return {
      accentCoral,
      accentGreen,
      accentOrange,
      accentSky,
      board,
      boardFrame,
      ceiling,
      chair,
      darkTrim,
      door,
      exteriorGround,
      floor,
      glass,
      lightPanel,
      metal,
      paper,
      pencil,
      posterPaper,
      projector,
      shelf,
      storageBlue,
      storageGreen,
      storagePurple,
      storageYellow,
      treeLeaves,
      treeTrunk,
      wall,
      warmFrame,
      windowSky,
      wood
    };
  }

  private createMaterial(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.specularColor = new Color3(0.12, 0.12, 0.12);

    return material;
  }

  private createRoom(): void {
    const floor = MeshBuilder.CreateGround(
      "classroomFloor",
      {
        width: 18,
        height: 16,
        subdivisions: 2
      },
      this.scene
    );

    floor.position.z = -2;
    floor.material = this.materials.floor;
    floor.isPickable = false;
    floor.receiveShadows = true;
    floor.checkCollisions = true;
    this.shadowReceivers.push(floor);
    this.collisionMeshes.push(floor);

    this.createBox({
      name: "classroomCeiling",
      width: 18,
      height: 0.14,
      depth: 16,
      position: new Vector3(0, 4.92, -2),
      material: this.materials.ceiling,
      collides: true
    });

    this.createFloorDepthLines();

    this.createBox({
      name: "frontWall",
      width: 18,
      height: 4.9,
      depth: 0.24,
      position: new Vector3(0, 2.45, 6),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "backWall",
      width: 18,
      height: 4.9,
      depth: 0.24,
      position: new Vector3(0, 2.45, -10),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "leftWall",
      width: 0.24,
      height: 4.9,
      depth: 16,
      position: new Vector3(-9, 2.45, -2),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "rightWall",
      width: 0.24,
      height: 4.9,
      depth: 16,
      position: new Vector3(9, 2.45, -2),
      material: this.materials.wall,
      receivesShadow: true,
      collides: true
    });
  }

  private createFloorDepthLines(): void {
    [-8.65, -6.75, -4.85, -2.95, -1.05, 0.85, 2.75, 4.65].forEach(
      (zPosition, index) => {
        this.createBox({
          name: `floorCrossLine${index + 1}`,
          width: 17.25,
          height: 0.012,
          depth: 0.035,
          position: new Vector3(0, 0.014, zPosition),
          material: this.materials.darkTrim
        });
      }
    );

    [-5.75, -2.25, 1.25, 4.75].forEach((xPosition, index) => {
      this.createBox({
        name: `floorPerspectiveLine${index + 1}`,
        width: 0.035,
        height: 0.012,
        depth: 15.25,
        position: new Vector3(xPosition, 0.016, -2),
        material: this.materials.darkTrim
      });
    });
  }

  private createBoard(): void {
    this.createBox({
      name: "boardSurface",
      width: 9.2,
      height: 3.86,
      depth: 0.08,
      position: new Vector3(0, 2.48, 5.78),
      material: this.materials.board,
      receivesShadow: true,
      collides: true
    });

    this.createBox({
      name: "boardFrameTop",
      width: 9.5,
      height: 0.12,
      depth: 0.14,
      position: new Vector3(0, 4.47, 5.67),
      material: this.materials.boardFrame,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "boardFrameBottom",
      width: 9.5,
      height: 0.12,
      depth: 0.14,
      position: new Vector3(0, 0.49, 5.67),
      material: this.materials.boardFrame,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "boardFrameLeft",
      width: 0.12,
      height: 4.02,
      depth: 0.14,
      position: new Vector3(-4.75, 2.48, 5.67),
      material: this.materials.boardFrame,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "boardFrameRight",
      width: 0.12,
      height: 4.02,
      depth: 0.14,
      position: new Vector3(4.75, 2.48, 5.67),
      material: this.materials.boardFrame,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "chalkTray",
      width: 7.15,
      height: 0.08,
      depth: 0.26,
      position: new Vector3(0, 0.34, 5.45),
      material: this.materials.metal,
      castsShadow: true,
      collides: true
    });
  }

  private createTeacherDesk(): void {
    const position = new Vector3(-5.65, 0, 3.82);

    this.createTable({
      name: "teacherDesk",
      position,
      width: 3.05,
      depth: 1.08,
      height: 0.82,
      rotationY: 0.035
    });

    this.createBox({
      name: "teacherDeskFrontPanel",
      width: 2.95,
      height: 0.6,
      depth: 0.1,
      position: this.positionFromLocalOffset(position, 0, 0.47, -0.52, 0.035),
      material: this.materials.wood,
      castsShadow: true,
      collides: true,
      rotationY: 0.035
    });

    this.createBox({
      name: "teacherDeskDrawerLeft",
      width: 0.76,
      height: 0.42,
      depth: 0.06,
      position: this.positionFromLocalOffset(position, -0.72, 0.44, -0.58, 0.035),
      material: this.materials.posterPaper,
      castsShadow: true,
      rotationY: 0.035
    });

    this.createBox({
      name: "teacherDeskDrawerRight",
      width: 0.76,
      height: 0.42,
      depth: 0.06,
      position: this.positionFromLocalOffset(position, 0.72, 0.44, -0.58, 0.035),
      material: this.materials.posterPaper,
      castsShadow: true,
      rotationY: 0.035
    });

    this.createStackedBooks(
      "teacherDeskBooks",
      this.positionFromLocalOffset(position, -0.7, 0.93, 0.04, 0.035),
      0.035
    );
  }

  private createStudentFurnitureRows(): void {
    const desks = [
      { x: -3.1, z: 1.45, rotation: 0.045 },
      { x: 3.1, z: 1.55, rotation: -0.018 },
      { x: -3.45, z: -0.75, rotation: -0.035 },
      { x: 3.45, z: -0.72, rotation: 0.024 },
      { x: -3.55, z: -2.9, rotation: 0.032 },
      { x: 3.55, z: -2.85, rotation: -0.028 },
      { x: -3.25, z: -5.05, rotation: -0.032 },
      { x: 3.25, z: -5.0, rotation: 0.04 }
    ];
    const chairAccents = [
      this.materials.accentCoral,
      this.materials.accentSky,
      this.materials.accentGreen,
      this.materials.storagePurple
    ];

    desks.forEach((desk, index) => {
      const position = new Vector3(desk.x, 0, desk.z);
      const chairPosition = new Vector3(desk.x, 0, desk.z - 0.88);
      const hideDuringEvaluation = index >= 6 || Math.abs(desk.x) < 2.85;

      this.createTable({
        name: `studentDesk${index + 1}`,
        position,
        width: 1.85,
        depth: 1.06,
        height: 0.76,
        rotationY: desk.rotation,
        hideDuringEvaluation
      });
      this.createDeskLearningSupplies(
        `studentDesk${index + 1}`,
        position,
        desk.rotation,
        index,
        hideDuringEvaluation
      );

      this.createChair(
        `studentChair${index + 1}`,
        chairPosition,
        desk.rotation,
        hideDuringEvaluation,
        chairAccents[index % chairAccents.length]
      );
      this.createSeatAnchor(
        `studentSeat${String(index + 1).padStart(2, "0")}Anchor`,
        chairPosition,
        Math.PI + desk.rotation,
        `studentChair${index + 1}`,
        `studentDesk${index + 1}`
      );
    });
  }

  private createStudentDesk(): void {
    const position = new Vector3(0, 0, -4.95);
    const rotationY = 0;

    this.createTable({
      name: "studentDesk",
      position,
      width: 3,
      depth: 1.34,
      height: 0.74,
      rotationY
    });

    this.createBox({
      name: "studentDeskNearLip",
      width: 3.08,
      height: 0.12,
      depth: 0.12,
      position: this.positionFromLocalOffset(position, 0, 0.7, -0.7, rotationY),
      material: this.materials.wood,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: "studentNotebook",
      width: 1.08,
      height: 0.025,
      depth: 0.68,
      position: this.positionFromLocalOffset(position, -0.42, 0.84, -0.14, rotationY),
      material: this.materials.paper,
      castsShadow: true,
      rotationY: rotationY + 0.08
    });

    this.createBox({
      name: "studentPencil",
      width: 0.07,
      height: 0.035,
      depth: 0.88,
      position: this.positionFromLocalOffset(position, 0.54, 0.865, -0.18, rotationY),
      material: this.materials.pencil,
      castsShadow: true,
      rotationY: rotationY + 0.24
    });
  }

  private createForegroundEdgeFurniture(): void {
    this.createChair(
      "foregroundLeftPartialChair",
      new Vector3(-0.95, 0, -6.98),
      0.07,
      true
    );
  }

  private createShelf(): void {
    const position = new Vector3(6.25, 0, 5.38);

    this.createBox({
      name: "frontShelfBack",
      width: 1.42,
      height: 2.52,
      depth: 0.08,
      position: new Vector3(position.x, 1.34, position.z + 0.18),
      material: this.materials.shelf,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "frontShelfLeftSide",
      width: 0.1,
      height: 2.52,
      depth: 0.56,
      position: new Vector3(position.x - 0.71, 1.34, position.z),
      material: this.materials.shelf,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "frontShelfRightSide",
      width: 0.1,
      height: 2.52,
      depth: 0.56,
      position: new Vector3(position.x + 0.71, 1.34, position.z),
      material: this.materials.shelf,
      castsShadow: true,
      collides: true
    });

    [0.18, 0.82, 1.46, 2.1, 2.58].forEach((height, index) => {
      this.createBox({
        name: `frontShelfLevel${index + 1}`,
        width: 1.42,
        height: 0.08,
        depth: 0.58,
        position: new Vector3(position.x, height, position.z),
        material: this.materials.shelf,
        castsShadow: true,
        collides: index === 0
      });
    });

    this.createBox({
      name: "frontShelfCabinetLeft",
      width: 0.58,
      height: 0.56,
      depth: 0.05,
      position: new Vector3(position.x - 0.32, 0.48, position.z - 0.31),
      material: this.materials.storageYellow,
      castsShadow: true
    });

    this.createBox({
      name: "frontShelfCabinetRight",
      width: 0.58,
      height: 0.56,
      depth: 0.05,
      position: new Vector3(position.x + 0.32, 0.48, position.z - 0.31),
      material: this.materials.storageGreen,
      castsShadow: true
    });

    this.createBookRow(
      "frontShelfUpperBooks",
      new Vector3(position.x - 0.44, 2.18, position.z - 0.16),
      7
    );
    this.createBookRow(
      "frontShelfMiddleBooks",
      new Vector3(position.x - 0.48, 1.52, position.z - 0.16),
      8
    );
    this.createStackedBooks(
      "frontShelfStackedBooks",
      new Vector3(position.x + 0.32, 0.92, position.z - 0.1),
      0
    );
    this.createGlobe(new Vector3(position.x + 0.46, 2.88, position.z - 0.02));
  }

  private createStorageFurniture(): void {
    const position = new Vector3(8.42, 0, 0.05);

    this.createBox({
      name: "rightStorageBody",
      width: 0.58,
      height: 0.72,
      depth: 5.65,
      position: new Vector3(position.x, 0.36, position.z),
      material: this.materials.shelf,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "rightStorageTop",
      width: 0.68,
      height: 0.08,
      depth: 5.85,
      position: new Vector3(position.x - 0.03, 0.76, position.z),
      material: this.materials.wood,
      castsShadow: true,
      collides: true
    });

    const drawerMaterials = [
      this.materials.storageBlue,
      this.materials.storageGreen,
      this.materials.storageYellow,
      this.materials.storagePurple
    ];

    [-2.1, -0.7, 0.7, 2.1].forEach((zOffset, index) => {
      this.createBox({
        name: `rightStorageDrawer${index + 1}`,
        width: 0.08,
        height: 0.42,
        depth: 1.05,
        position: new Vector3(position.x - 0.33, 0.42, position.z + zOffset),
        material: drawerMaterials[index],
        castsShadow: true
      });

      this.createBox({
        name: `rightStorageDrawerHandle${index + 1}`,
        width: 0.035,
        height: 0.06,
        depth: 0.34,
        position: new Vector3(position.x - 0.39, 0.45, position.z + zOffset),
        material: this.materials.metal,
        castsShadow: true
      });
    });
  }

  private createBackClassroomDetails(): void {
    this.createBackWallGallery();
    this.createBackLowShelf(
      "backLeftCubbies",
      new Vector3(-6.35, 0, -9.42),
      2.68,
      [
        this.materials.storageBlue,
        this.materials.storageYellow,
        this.materials.storageGreen
      ]
    );
    this.createBackLowShelf(
      "backRightToyShelf",
      new Vector3(6.25, 0, -9.42),
      2.36,
      [
        this.materials.storagePurple,
        this.materials.accentOrange,
        this.materials.accentSky
      ]
    );
    this.createPlayRug();
    this.createPottedPlant(
      "backLeftPottedPlant",
      new Vector3(-8.18, 0, -8.72),
      0.98,
      this.materials.accentOrange
    );
    this.createPottedPlant(
      "backRightPottedPlant",
      new Vector3(8.02, 0, -8.18),
      0.82,
      this.materials.storageYellow
    );
    this.createFloorBookScatter();
    this.createToyScatter();
    this.createBackpacks();
  }

  private createDeskLearningSupplies(
    name: string,
    position: Vector3,
    rotationY: number,
    index: number,
    hideDuringEvaluation: boolean
  ): void {
    const paperX = index % 2 === 0 ? -0.32 : 0.28;
    const paperZ = index % 3 === 0 ? -0.16 : 0.12;
    const pencilX = index % 2 === 0 ? 0.34 : -0.28;
    const pencilZ = index % 3 === 1 ? -0.18 : 0.08;

    this.createBox({
      name: `${name}LoosePaper`,
      width: 0.56,
      height: 0.018,
      depth: 0.38,
      position: this.positionFromLocalOffset(
        position,
        paperX,
        0.855,
        paperZ,
        rotationY
      ),
      material: this.materials.paper,
      castsShadow: true,
      hideDuringEvaluation,
      rotationY: rotationY + (index % 2 === 0 ? 0.12 : -0.1)
    });

    this.createBox({
      name: `${name}Pencil`,
      width: 0.05,
      height: 0.032,
      depth: 0.54,
      position: this.positionFromLocalOffset(
        position,
        pencilX,
        0.875,
        pencilZ,
        rotationY
      ),
      material: this.materials.pencil,
      castsShadow: true,
      hideDuringEvaluation,
      rotationY: rotationY + 0.32 + index * 0.04
    });

    if (index % 2 === 0) {
      this.createBox({
        name: `${name}SmallBook`,
        width: 0.46,
        height: 0.055,
        depth: 0.34,
        position: this.positionFromLocalOffset(
          position,
          0.02,
          0.895,
          0.2,
          rotationY
        ),
        material:
          index % 4 === 0
            ? this.materials.accentSky
            : this.materials.storagePurple,
        castsShadow: true,
        hideDuringEvaluation,
        rotationY: rotationY - 0.16
      });
    }
  }

  private createBackWallGallery(): void {
    [
      {
        name: "backReadingPoster",
        width: 1.22,
        height: 0.82,
        x: -3.65,
        y: 3.26,
        title: "LEER",
        background: "#f4ead0",
        accent: "#547b75",
        secondary: "#c77f57"
      },
      {
        name: "backColorsPoster",
        width: 1.18,
        height: 0.76,
        x: -1.38,
        y: 3.08,
        title: "COLOR",
        background: "#d8e6df",
        accent: "#355f76",
        secondary: "#d39d42"
      },
      {
        name: "backGamesPoster",
        width: 1.2,
        height: 0.76,
        x: 1.38,
        y: 3.1,
        title: "JUGAR",
        background: "#f3d98b",
        accent: "#6d8ea3",
        secondary: "#bf6b45"
      },
      {
        name: "backArtPoster",
        width: 1.18,
        height: 0.82,
        x: 3.68,
        y: 3.28,
        title: "ARTE",
        background: "#f2dfc2",
        accent: "#5d7f8a",
        secondary: "#c99a55"
      }
    ].forEach((poster) => {
      this.createPoster({
        name: poster.name,
        width: poster.width,
        height: poster.height,
        position: new Vector3(poster.x, poster.y, -9.84),
        rotationY: 0,
        title: poster.title,
        background: poster.background,
        accent: poster.accent,
        secondary: poster.secondary
      });
    });
  }

  private createBackLowShelf(
    name: string,
    position: Vector3,
    width: number,
    binMaterials: StandardMaterial[]
  ): void {
    this.createBox({
      name: `${name}Back`,
      width,
      height: 1.18,
      depth: 0.08,
      position: new Vector3(position.x, 0.78, position.z - 0.34),
      material: this.materials.shelf,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: `${name}Top`,
      width,
      height: 0.1,
      depth: 0.74,
      position: new Vector3(position.x, 1.38, position.z),
      material: this.materials.wood,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: `${name}Bottom`,
      width,
      height: 0.1,
      depth: 0.74,
      position: new Vector3(position.x, 0.18, position.z),
      material: this.materials.wood,
      castsShadow: true,
      collides: true
    });

    [-width / 2 + 0.05, width / 2 - 0.05].forEach((xOffset, index) => {
      this.createBox({
        name: `${name}Side${index + 1}`,
        width: 0.1,
        height: 1.2,
        depth: 0.74,
        position: new Vector3(position.x + xOffset, 0.78, position.z),
        material: this.materials.shelf,
        castsShadow: true,
        collides: true
      });
    });

    [-0.33, 0.33].forEach((xOffset, index) => {
      this.createBox({
        name: `${name}Divider${index + 1}`,
        width: 0.08,
        height: 1.1,
        depth: 0.66,
        position: new Vector3(position.x + xOffset * width, 0.78, position.z),
        material: this.materials.shelf,
        castsShadow: true
      });
    });

    [-0.34, 0.04, 0.42].forEach((zOffset, rowIndex) => {
      [-0.34, 0, 0.34].forEach((xFactor, columnIndex) => {
        const itemIndex = rowIndex * 3 + columnIndex;

        this.createBox({
          name: `${name}Bin${itemIndex + 1}`,
          width: width * 0.24,
          height: 0.28,
          depth: 0.28,
          position: new Vector3(
            position.x + xFactor * width,
            0.46 + rowIndex * 0.34,
            position.z + zOffset
          ),
          material: binMaterials[itemIndex % binMaterials.length],
          castsShadow: true
        });
      });
    });

    this.createStackedBooks(
      `${name}TopBooks`,
      new Vector3(position.x - width * 0.24, 1.5, position.z + 0.06),
      0.08
    );
  }

  private createPlayRug(): void {
    this.createBox({
      name: "backPlayRug",
      width: 3.15,
      height: 0.025,
      depth: 1.85,
      position: new Vector3(-2.2, 0.035, -8.22),
      material: this.materials.storageGreen,
      receivesShadow: true,
      rotationY: -0.06
    });

    [
      { x: -3.34, z: -8.62, material: this.materials.accentSky },
      { x: -2.58, z: -7.85, material: this.materials.posterPaper },
      { x: -1.88, z: -8.46, material: this.materials.storageYellow },
      { x: -1.1, z: -7.8, material: this.materials.storagePurple }
    ].forEach((square, index) => {
      this.createBox({
        name: `backPlayRugPatch${index + 1}`,
        width: 0.52,
        height: 0.03,
        depth: 0.46,
        position: new Vector3(square.x, 0.055, square.z),
        material: square.material,
        receivesShadow: true,
        rotationY: index % 2 === 0 ? -0.06 : 0.04
      });
    });
  }

  private createPottedPlant(
    name: string,
    position: Vector3,
    scale: number,
    potMaterial: StandardMaterial
  ): void {
    const pot = MeshBuilder.CreateCylinder(
      `${name}Pot`,
      {
        height: 0.42 * scale,
        diameterTop: 0.5 * scale,
        diameterBottom: 0.38 * scale,
        tessellation: 14
      },
      this.scene
    );

    pot.position = new Vector3(position.x, 0.21 * scale, position.z);
    pot.material = potMaterial;
    pot.isPickable = false;
    this.shadowCasters.push(pot);

    const soil = MeshBuilder.CreateCylinder(
      `${name}Soil`,
      {
        height: 0.035 * scale,
        diameter: 0.43 * scale,
        tessellation: 14
      },
      this.scene
    );

    soil.position = new Vector3(position.x, 0.43 * scale, position.z);
    soil.material = this.materials.darkTrim;
    soil.isPickable = false;
    this.shadowCasters.push(soil);

    const stem = MeshBuilder.CreateCylinder(
      `${name}Stem`,
      {
        height: 0.82 * scale,
        diameter: 0.055 * scale,
        tessellation: 8
      },
      this.scene
    );

    stem.position = new Vector3(position.x, 0.82 * scale, position.z);
    stem.material = this.materials.treeTrunk;
    stem.isPickable = false;
    this.shadowCasters.push(stem);

    [
      { x: -0.18, y: 1.18, z: 0, sx: 0.9, sy: 0.55, sz: 0.38 },
      { x: 0.18, y: 1.24, z: 0.03, sx: 0.82, sy: 0.56, sz: 0.36 },
      { x: 0, y: 1.4, z: -0.08, sx: 0.72, sy: 0.52, sz: 0.34 }
    ].forEach((leafData, index) => {
      const leaf = MeshBuilder.CreateSphere(
        `${name}Leaf${index + 1}`,
        {
          diameter: 0.48 * scale,
          segments: 12
        },
        this.scene
      );

      leaf.position = new Vector3(
        position.x + leafData.x * scale,
        leafData.y * scale,
        position.z + leafData.z * scale
      );
      leaf.scaling.set(leafData.sx, leafData.sy, leafData.sz);
      leaf.material = this.materials.treeLeaves;
      leaf.isPickable = false;
      this.shadowCasters.push(leaf);
    });
  }

  private createFloorBookScatter(): void {
    const books = [
      { x: -5.25, z: -7.48, width: 0.62, depth: 0.42, rot: 0.32, material: this.materials.accentSky },
      { x: -4.72, z: -8.12, width: 0.54, depth: 0.36, rot: -0.22, material: this.materials.posterPaper },
      { x: -0.38, z: -8.72, width: 0.58, depth: 0.4, rot: 0.54, material: this.materials.accentOrange },
      { x: 1.04, z: -7.62, width: 0.5, depth: 0.34, rot: -0.48, material: this.materials.storagePurple },
      { x: 5.12, z: -7.92, width: 0.66, depth: 0.38, rot: 0.18, material: this.materials.storageGreen },
      { x: -7.25, z: -3.82, width: 0.52, depth: 0.34, rot: -0.38, material: this.materials.storageYellow },
      { x: 6.72, z: -2.38, width: 0.58, depth: 0.36, rot: 0.42, material: this.materials.accentSky },
      { x: -6.5, z: 0.92, width: 0.54, depth: 0.36, rot: 0.2, material: this.materials.storagePurple },
      { x: 5.88, z: 2.88, width: 0.62, depth: 0.38, rot: -0.32, material: this.materials.posterPaper }
    ];

    books.forEach((book, index) => {
      this.createBox({
        name: `floorScatteredBook${index + 1}`,
        width: book.width,
        height: 0.055,
        depth: book.depth,
        position: new Vector3(book.x, 0.07, book.z),
        material: book.material,
        castsShadow: true,
        rotationY: book.rot,
        rotationZ: index % 2 === 0 ? 0.02 : -0.018
      });

      this.createBox({
        name: `floorScatteredBookPages${index + 1}`,
        width: book.width * 0.72,
        height: 0.018,
        depth: book.depth * 0.78,
        position: new Vector3(book.x, 0.108, book.z),
        material: this.materials.paper,
        castsShadow: true,
        rotationY: book.rot
      });
    });
  }

  private createToyScatter(): void {
    [
      { x: -2.86, z: -8.24, material: this.materials.accentCoral },
      { x: -2.44, z: -8.58, material: this.materials.storageYellow },
      { x: -1.74, z: -8.08, material: this.materials.accentSky },
      { x: 4.62, z: -8.5, material: this.materials.storagePurple },
      { x: -6.75, z: -5.55, material: this.materials.accentSky },
      { x: -6.32, z: -4.98, material: this.materials.storageGreen },
      { x: 6.38, z: -4.35, material: this.materials.storageYellow },
      { x: 6.86, z: -3.86, material: this.materials.accentCoral },
      { x: -7.05, z: -1.58, material: this.materials.storagePurple },
      { x: 7.1, z: 0.72, material: this.materials.accentSky },
      { x: -5.9, z: 2.28, material: this.materials.storageYellow },
      { x: 5.56, z: 3.36, material: this.materials.storageGreen }
    ].forEach((block, index) => {
      this.createBox({
        name: `floorToyBlock${index + 1}`,
        width: 0.24,
        height: 0.24,
        depth: 0.24,
        position: new Vector3(block.x, 0.14, block.z),
        material: block.material,
        castsShadow: true,
        rotationY: index * 0.32
      });
    });

    const ball = MeshBuilder.CreateSphere(
      "floorToyBall",
      {
        diameter: 0.36,
        segments: 16
      },
      this.scene
    );

    ball.position = new Vector3(2.18, 0.2, -8.26);
    ball.material = this.materials.accentCoral;
    ball.isPickable = false;
    this.shadowCasters.push(ball);

    const sideBall = MeshBuilder.CreateSphere(
      "sideFloorToyBall",
      {
        diameter: 0.3,
        segments: 14
      },
      this.scene
    );

    sideBall.position = new Vector3(-6.52, 0.17, -1.1);
    sideBall.material = this.materials.storageYellow;
    sideBall.isPickable = false;
    this.shadowCasters.push(sideBall);

    const ring = MeshBuilder.CreateTorus(
      "floorToyRing",
      {
        diameter: 0.46,
        thickness: 0.045,
        tessellation: 18
      },
      this.scene
    );

    ring.position = new Vector3(-1.25, 0.08, -8.72);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = 0.32;
    ring.material = this.materials.accentSky;
    ring.isPickable = false;
    this.shadowCasters.push(ring);

    const sideRing = MeshBuilder.CreateTorus(
      "sideFloorToyRing",
      {
        diameter: 0.42,
        thickness: 0.04,
        tessellation: 18
      },
      this.scene
    );

    sideRing.position = new Vector3(6.38, 0.08, -0.62);
    sideRing.rotation.x = Math.PI / 2;
    sideRing.rotation.z = -0.26;
    sideRing.material = this.materials.accentOrange;
    sideRing.isPickable = false;
    this.shadowCasters.push(sideRing);

    this.createToyCar("backFloorToyCar", new Vector3(3.55, 0, -7.55), -0.24);
    this.createToyCar("sideFloorToyCar", new Vector3(-6.15, 0, 1.42), 0.34);
    this.createFloorGameBoard("backFloorGameBoard", new Vector3(-3.05, 0, -7.92), -0.08);
    this.createFloorGameBoard("rightFloorGameBoard", new Vector3(6.34, 0, 1.82), 0.18);
  }

  private createToyCar(name: string, position: Vector3, rotationY: number): void {
    this.createBox({
      name: `${name}Body`,
      width: 0.54,
      height: 0.16,
      depth: 0.28,
      position: new Vector3(position.x, 0.14, position.z),
      material: this.materials.storageBlue,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}Top`,
      width: 0.3,
      height: 0.14,
      depth: 0.22,
      position: this.positionFromLocalOffset(position, 0.02, 0.29, -0.02, rotationY),
      material: this.materials.storageYellow,
      castsShadow: true,
      rotationY
    });

    [-0.2, 0.2].forEach((xOffset, index) => {
      [-0.15, 0.15].forEach((zOffset, wheelIndex) => {
        const wheel = MeshBuilder.CreateCylinder(
          `${name}Wheel${index + 1}${wheelIndex + 1}`,
          {
            height: 0.07,
            diameter: 0.11,
            tessellation: 10
          },
          this.scene
        );

        wheel.position = this.positionFromLocalOffset(
          position,
          xOffset,
          0.08,
          zOffset,
          rotationY
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.rotation.y = rotationY;
        wheel.material = this.materials.darkTrim;
        wheel.isPickable = false;
        this.shadowCasters.push(wheel);
      });
    });
  }

  private createFloorGameBoard(
    name: string,
    position: Vector3,
    rotationY: number
  ): void {
    this.createBox({
      name: `${name}Base`,
      width: 0.86,
      height: 0.025,
      depth: 0.62,
      position: new Vector3(position.x, 0.052, position.z),
      material: this.materials.paper,
      receivesShadow: true,
      rotationY
    });

    [
      { x: -0.24, z: -0.18, material: this.materials.accentCoral },
      { x: 0.02, z: -0.16, material: this.materials.storageYellow },
      { x: 0.26, z: -0.18, material: this.materials.accentSky },
      { x: -0.12, z: 0.12, material: this.materials.storageGreen },
      { x: 0.18, z: 0.14, material: this.materials.storagePurple }
    ].forEach((piece, index) => {
      this.createBox({
        name: `${name}Piece${index + 1}`,
        width: 0.15,
        height: 0.08,
        depth: 0.15,
        position: this.positionFromLocalOffset(
          position,
          piece.x,
          0.12,
          piece.z,
          rotationY
        ),
        material: piece.material,
        castsShadow: true,
        rotationY: rotationY + index * 0.24
      });
    });
  }

  private createBackpacks(): void {
    this.createBackpack(
      "backLeftBackpack",
      new Vector3(-6.95, 0, -7.62),
      this.materials.storagePurple,
      0.34
    );
    this.createBackpack(
      "backMiddleBackpack",
      new Vector3(0.26, 0, -8.0),
      this.materials.accentSky,
      -0.42
    );
    this.createBackpack(
      "backRightBackpack",
      new Vector3(6.88, 0, -7.42),
      this.materials.accentCoral,
      0.18
    );
  }

  private createBackpack(
    name: string,
    position: Vector3,
    material: StandardMaterial,
    rotationY: number
  ): void {
    this.createBox({
      name: `${name}Body`,
      width: 0.46,
      height: 0.62,
      depth: 0.24,
      position: new Vector3(position.x, 0.34, position.z),
      material,
      castsShadow: true,
      rotationY
    });

    this.createBox({
      name: `${name}FrontPocket`,
      width: 0.32,
      height: 0.24,
      depth: 0.04,
      position: this.positionFromLocalOffset(position, 0, 0.28, -0.145, rotationY),
      material: this.materials.posterPaper,
      castsShadow: true,
      rotationY
    });

    [-0.16, 0.16].forEach((xOffset, index) => {
      this.createBox({
        name: `${name}Strap${index + 1}`,
        width: 0.055,
        height: 0.48,
        depth: 0.035,
        position: this.positionFromLocalOffset(position, xOffset, 0.42, 0.14, rotationY),
        material: this.materials.darkTrim,
        castsShadow: true,
        rotationY
      });
    });

    this.createBox({
      name: `${name}Handle`,
      width: 0.24,
      height: 0.055,
      depth: 0.055,
      position: new Vector3(position.x, 0.69, position.z),
      material: this.materials.darkTrim,
      castsShadow: true,
      rotationY
    });
  }

  private createStackedBooks(
    name: string,
    position: Vector3,
    rotationY: number
  ): void {
    const bookMaterials = [
      this.materials.accentSky,
      this.materials.posterPaper,
      this.materials.storagePurple
    ];

    bookMaterials.forEach((material, index) => {
      this.createBox({
        name: `${name}${index + 1}`,
        width: 0.68 - index * 0.06,
        height: 0.06,
        depth: 0.44,
        position: new Vector3(position.x, position.y + index * 0.07, position.z),
        material,
        castsShadow: true,
        rotationY
      });
    });
  }

  private createBookRow(name: string, startPosition: Vector3, count: number): void {
    const materials = [
      this.materials.accentSky,
      this.materials.accentGreen,
      this.materials.accentOrange,
      this.materials.posterPaper,
      this.materials.storagePurple
    ];
    const heights = [0.42, 0.5, 0.36, 0.47, 0.55, 0.4, 0.49, 0.44];
    let xOffset = 0;

    for (let index = 0; index < count; index += 1) {
      const width = 0.09 + (index % 3) * 0.025;
      const height = heights[index % heights.length];

      this.createBox({
        name: `${name}${index + 1}`,
        width,
        height,
        depth: 0.34,
        position: new Vector3(
          startPosition.x + xOffset,
          startPosition.y + height / 2,
          startPosition.z
        ),
        material: materials[index % materials.length],
        castsShadow: true,
        rotationZ: (index % 2 === 0 ? 0.02 : -0.018)
      });

      xOffset += width + 0.035;
    }
  }

  private createGlobe(position: Vector3): void {
    const globe = MeshBuilder.CreateSphere(
      "classroomGlobe",
      {
        diameter: 0.42,
        segments: 16
      },
      this.scene
    );

    globe.position = position;
    globe.material = this.materials.accentSky;
    globe.isPickable = false;
    this.shadowCasters.push(globe);

    const landPatch = MeshBuilder.CreateSphere(
      "classroomGlobeLandPatch",
      {
        diameter: 0.18,
        segments: 8
      },
      this.scene
    );

    landPatch.position = new Vector3(position.x - 0.09, position.y + 0.04, position.z - 0.19);
    landPatch.scaling = new Vector3(1.2, 0.55, 0.18);
    landPatch.material = this.materials.accentGreen;
    landPatch.isPickable = false;
    this.shadowCasters.push(landPatch);

    this.createBox({
      name: "classroomGlobeStand",
      width: 0.1,
      height: 0.2,
      depth: 0.1,
      position: new Vector3(position.x, position.y - 0.29, position.z),
      material: this.materials.metal,
      castsShadow: true
    });
  }

  private createWindows(): void {
    this.createSideWindow("leftWindowBack", -4.65);
    this.createSideWindow("leftWindowMiddle", -1.85);
    this.createSideWindow("leftWindowFront", 1.05);
  }

  private createSideWindow(name: string, zPosition: number): void {
    const windowAnchor = new TransformNode(`${name}DistractorAnchor`, this.scene);
    windowAnchor.position = new Vector3(-8.7, 2.55, zPosition);
    windowAnchor.metadata = {
      role: "window-distractor-anchor"
    };

    this.createBox({
      name: `${name}SkyView`,
      width: 0.035,
      height: 1.45,
      depth: 2.18,
      position: new Vector3(-8.84, 2.55, zPosition),
      material: this.materials.windowSky
    });

    this.createBox({
      name: `${name}ExteriorGround`,
      width: 0.04,
      height: 0.42,
      depth: 2.18,
      position: new Vector3(-8.82, 1.82, zPosition),
      material: this.materials.exteriorGround
    });

    this.createWindowTree(name, zPosition);

    this.createBox({
      name: `${name}Glass`,
      width: 0.05,
      height: 1.45,
      depth: 2.18,
      position: new Vector3(-8.66, 2.55, zPosition),
      material: this.materials.glass
    });

    this.createBox({
      name: `${name}TopFrame`,
      width: 0.14,
      height: 0.1,
      depth: 2.4,
      position: new Vector3(-8.58, 3.32, zPosition),
      material: this.materials.boardFrame,
      castsShadow: true
    });

    this.createBox({
      name: `${name}BottomFrame`,
      width: 0.14,
      height: 0.1,
      depth: 2.4,
      position: new Vector3(-8.58, 1.78, zPosition),
      material: this.materials.boardFrame,
      castsShadow: true
    });

    this.createBox({
      name: `${name}BackFrame`,
      width: 0.14,
      height: 1.62,
      depth: 0.1,
      position: new Vector3(-8.58, 2.55, zPosition - 1.2),
      material: this.materials.boardFrame,
      castsShadow: true
    });

    this.createBox({
      name: `${name}FrontFrame`,
      width: 0.14,
      height: 1.62,
      depth: 0.1,
      position: new Vector3(-8.58, 2.55, zPosition + 1.2),
      material: this.materials.boardFrame,
      castsShadow: true
    });

    this.createBox({
      name: `${name}CenterFrame`,
      width: 0.15,
      height: 1.5,
      depth: 0.07,
      position: new Vector3(-8.55, 2.55, zPosition),
      material: this.materials.boardFrame,
      castsShadow: true
    });

    this.createBox({
      name: `${name}Sill`,
      width: 0.34,
      height: 0.1,
      depth: 2.58,
      position: new Vector3(-8.42, 1.64, zPosition),
      material: this.materials.darkTrim,
      castsShadow: true
    });
  }

  private createWindowTree(name: string, zPosition: number): void {
    const trunk = MeshBuilder.CreateCylinder(
      `${name}ExteriorTreeTrunk`,
      {
        height: 0.68,
        diameter: 0.12,
        tessellation: 10
      },
      this.scene
    );

    trunk.position = new Vector3(-8.72, 1.98, zPosition + 0.42);
    trunk.material = this.materials.treeTrunk;
    trunk.isPickable = false;

    const leaves = MeshBuilder.CreateSphere(
      `${name}ExteriorTreeLeaves`,
      {
        diameter: 0.52,
        segments: 14
      },
      this.scene
    );

    leaves.position = new Vector3(-8.72, 2.5, zPosition + 0.42);
    leaves.material = this.materials.treeLeaves;
    leaves.isPickable = false;
  }

  private createDoor(): void {
    const doorPivot = new TransformNode("doorPivot", this.scene);
    doorPivot.position = new Vector3(8.78, 0, -6.9);
    doorPivot.metadata = {
      role: "door-animation-pivot"
    };

    const doorLeaf = MeshBuilder.CreateBox(
      "doorLeaf",
      {
        width: 0.14,
        height: 2.55,
        depth: 1.48
      },
      this.scene
    );

    doorLeaf.parent = doorPivot;
    doorLeaf.position = new Vector3(0, 1.28, 0.74);
    doorLeaf.material = this.materials.door;
    doorLeaf.isPickable = false;
    doorLeaf.checkCollisions = true;
    this.shadowCasters.push(doorLeaf);
    this.collisionMeshes.push(doorLeaf);

    const doorWindow = MeshBuilder.CreateBox(
      "doorWindowPane",
      {
        width: 0.035,
        height: 0.92,
        depth: 0.54
      },
      this.scene
    );

    doorWindow.parent = doorPivot;
    doorWindow.position = new Vector3(-0.08, 1.74, 0.72);
    doorWindow.material = this.materials.glass;
    doorWindow.isPickable = false;

    [
      { name: "Top", height: 0.06, depth: 0.7, y: 2.29, z: 0.72 },
      { name: "Bottom", height: 0.06, depth: 0.7, y: 1.19, z: 0.72 },
      { name: "Back", height: 1.08, depth: 0.06, y: 1.74, z: 0.36 },
      { name: "Front", height: 1.08, depth: 0.06, y: 1.74, z: 1.08 }
    ].forEach((framePart) => {
      const frame = MeshBuilder.CreateBox(
        `doorWindowFrame${framePart.name}`,
        {
          width: 0.04,
          height: framePart.height,
          depth: framePart.depth
        },
        this.scene
      );

      frame.parent = doorPivot;
      frame.position = new Vector3(-0.1, framePart.y, framePart.z);
      frame.material = this.materials.warmFrame;
      frame.isPickable = false;
      this.shadowCasters.push(frame);
    });

    this.createBox({
      name: "doorFrameTop",
      width: 0.26,
      height: 0.16,
      depth: 1.82,
      position: new Vector3(8.62, 2.66, -6.16),
      material: this.materials.warmFrame,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "doorFrameBack",
      width: 0.26,
      height: 2.72,
      depth: 0.16,
      position: new Vector3(8.62, 1.36, -6.96),
      material: this.materials.warmFrame,
      castsShadow: true,
      collides: true
    });

    this.createBox({
      name: "doorFrameFront",
      width: 0.26,
      height: 2.72,
      depth: 0.16,
      position: new Vector3(8.62, 1.36, -5.36),
      material: this.materials.warmFrame,
      castsShadow: true,
      collides: true
    });

    const knob = MeshBuilder.CreateSphere(
      "doorKnob",
      {
        diameter: 0.14,
        segments: 12
      },
      this.scene
    );

    knob.parent = doorPivot;
    knob.position = new Vector3(-0.09, 1.2, 1.16);
    knob.material = this.materials.metal;
    knob.isPickable = false;
    this.shadowCasters.push(knob);
  }

  private createWallDetails(): void {
    this.createBox({
      name: "frontBaseboard",
      width: 17.7,
      height: 0.16,
      depth: 0.12,
      position: new Vector3(0, 0.16, 5.84),
      material: this.materials.darkTrim,
      castsShadow: true
    });

    this.createBox({
      name: "backBaseboard",
      width: 17.7,
      height: 0.16,
      depth: 0.12,
      position: new Vector3(0, 0.16, -9.84),
      material: this.materials.darkTrim,
      castsShadow: true
    });

    this.createBox({
      name: "leftBaseboard",
      width: 0.12,
      height: 0.16,
      depth: 15.55,
      position: new Vector3(-8.82, 0.16, -2),
      material: this.materials.darkTrim,
      castsShadow: true
    });

    this.createBox({
      name: "rightBaseboard",
      width: 0.12,
      height: 0.16,
      depth: 15.55,
      position: new Vector3(8.82, 0.16, -2),
      material: this.materials.darkTrim,
      castsShadow: true
    });
  }

  private createCeilingLightPanels(): void {
    [
      { name: "leftBackCeilingLight", x: -4.15, z: -7.25, rotation: 0.02 },
      { name: "rightBackCeilingLight", x: 4.15, z: -7.05, rotation: -0.02 },
      { name: "leftMiddleCeilingLight", x: -4.05, z: -2.3, rotation: -0.015 },
      { name: "rightMiddleCeilingLight", x: 4.05, z: -2.1, rotation: 0.015 },
      { name: "leftFrontCeilingLight", x: -4.15, z: 2.45, rotation: 0.01 },
      { name: "rightFrontCeilingLight", x: 4.15, z: 2.65, rotation: -0.01 }
    ].forEach((lightPanel) => {
      this.createCeilingLightFixture(
        lightPanel.name,
        new Vector3(lightPanel.x, 4.78, lightPanel.z),
        lightPanel.rotation
      );
    });
  }

  private createCeilingLightFixture(
    name: string,
    position: Vector3,
    rotationY: number
  ): void {
    this.createBox({
      name: `${name}Frame`,
      width: 1.28,
      height: 0.08,
      depth: 2.25,
      position,
      material: this.materials.metal,
      rotationY
    });

    this.createBox({
      name: `${name}Panel`,
      width: 1.08,
      height: 0.085,
      depth: 2.02,
      position: new Vector3(position.x, position.y - 0.035, position.z),
      material: this.materials.lightPanel,
      rotationY
    });
  }

  private createProjector(): void {
    this.createBox({
      name: "ceilingProjectorStem",
      width: 0.12,
      height: 0.52,
      depth: 0.12,
      position: new Vector3(0.15, 4.46, 1.15),
      material: this.materials.projector,
      castsShadow: true
    });

    this.createBox({
      name: "ceilingProjectorBody",
      width: 1.1,
      height: 0.26,
      depth: 0.68,
      position: new Vector3(0.15, 4.16, 1.15),
      material: this.materials.projector,
      castsShadow: true
    });

    this.createBox({
      name: "ceilingProjectorLens",
      width: 0.24,
      height: 0.13,
      depth: 0.2,
      position: new Vector3(0.15, 4.16, 0.78),
      material: this.materials.glass,
      castsShadow: true
    });
  }

  private createClock(): void {
    const clockPosition = new Vector3(5.18, 3.56, 5.42);
    const clockFace = MeshBuilder.CreateCylinder(
      "frontWallClockFace",
      {
        diameter: 0.56,
        height: 0.06,
        tessellation: 32
      },
      this.scene
    );

    clockFace.position = clockPosition;
    clockFace.rotation.x = Math.PI / 2;
    clockFace.material = this.materials.paper;
    clockFace.isPickable = false;
    this.shadowCasters.push(clockFace);

    const clockRim = MeshBuilder.CreateTorus(
      "frontWallClockRim",
      {
        diameter: 0.59,
        thickness: 0.035,
        tessellation: 32
      },
      this.scene
    );

    clockRim.position = new Vector3(clockPosition.x, clockPosition.y, 5.39);
    clockRim.rotation.x = Math.PI / 2;
    clockRim.material = this.materials.accentCoral;
    clockRim.isPickable = false;
    this.shadowCasters.push(clockRim);

    this.createBox({
      name: "frontWallClockHourHand",
      width: 0.035,
      height: 0.2,
      depth: 0.02,
      position: new Vector3(clockPosition.x - 0.04, clockPosition.y + 0.06, 5.36),
      material: this.materials.darkTrim,
      rotationZ: -0.45
    });

    this.createBox({
      name: "frontWallClockMinuteHand",
      width: 0.03,
      height: 0.25,
      depth: 0.02,
      position: new Vector3(clockPosition.x + 0.05, clockPosition.y + 0.03, 5.35),
      material: this.materials.darkTrim,
      rotationZ: 0.85
    });
  }

  private createDecorations(): void {
    this.createPoster({
      name: "frontAlphabetPoster",
      width: 1.2,
      height: 0.72,
      position: new Vector3(-6.2, 3.56, 5.36),
      title: "ABC",
      background: "#f3d98b",
      accent: "#547b75",
      secondary: "#bf6b45"
    });

    this.createPoster({
      name: "frontNumbersPoster",
      width: 1.12,
      height: 0.68,
      position: new Vector3(-5.0, 3.18, 5.36),
      title: "123",
      background: "#f4ead0",
      accent: "#6d8ea3",
      secondary: "#c99a55"
    });

    this.createPoster({
      name: "rightShapesPoster",
      width: 1.1,
      height: 1.25,
      position: new Vector3(8.28, 2.64, 2.65),
      rotationY: -Math.PI / 2,
      title: "FORMAS",
      background: "#f2dfc2",
      accent: "#5d7f8a",
      secondary: "#d39d42"
    });

    this.createPoster({
      name: "rightSciencePoster",
      width: 1.55,
      height: 1.02,
      position: new Vector3(8.28, 2.62, -1.15),
      rotationY: -Math.PI / 2,
      title: "CIENCIA",
      background: "#d8e6df",
      accent: "#355f76",
      secondary: "#c77f57"
    });

    this.createBox({
      name: "frontBoardChalk",
      width: 0.34,
      height: 0.04,
      depth: 0.05,
      position: new Vector3(-1.15, 0.7, 5.26),
      material: this.materials.paper,
      castsShadow: true,
      rotationZ: -0.03
    });

    this.createBox({
      name: "frontBoardEraser",
      width: 0.46,
      height: 0.09,
      depth: 0.15,
      position: new Vector3(1.1, 0.72, 5.23),
      material: this.materials.darkTrim,
      castsShadow: true
    });
  }

  private createPoster(options: {
    name: string;
    width: number;
    height: number;
    position: Vector3;
    title: string;
    background: string;
    accent: string;
    secondary: string;
    rotationY?: number;
  }): void {
    const texture = new DynamicTexture(
      `${options.name}Texture`,
      {
        width: 512,
        height: 384
      },
      this.scene,
      false
    );
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;

    texture.uScale = -1;
    texture.uOffset = 1;
    context.fillStyle = options.background;
    context.fillRect(0, 0, 512, 384);
    context.strokeStyle = "#c99a55";
    context.lineWidth = 24;
    context.strokeRect(12, 12, 488, 360);
    context.fillStyle = options.accent;
    context.font = "700 58px Arial";
    context.textAlign = "center";
    context.fillText(options.title, 256, 82);

    context.fillStyle = options.secondary;
    for (let index = 0; index < 4; index += 1) {
      const x = 92 + index * 88;
      const y = 170 + (index % 2) * 58;

      context.beginPath();
      context.arc(x, y, 26, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = options.accent;
    for (let index = 0; index < 5; index += 1) {
      context.fillRect(72 + index * 74, 285, 42, 34);
    }

    texture.update();

    const material = new StandardMaterial(`${options.name}Material`, this.scene);
    material.diffuseTexture = texture;
    material.emissiveColor = new Color3(0.18, 0.18, 0.14);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;

    const poster = MeshBuilder.CreatePlane(
      options.name,
      {
        width: options.width,
        height: options.height
      },
      this.scene
    );

    poster.position = options.position;
    poster.rotation.y = options.rotationY ?? Math.PI;
    poster.material = material;
    poster.isPickable = false;
  }

  private createClassroomAnchors(): void {
    [
      {
        name: "doorDistractorAnchor",
        role: "door-distractor-anchor",
        position: new Vector3(8.45, 1.35, -6.15)
      },
      {
        name: "teacherAreaAnchor",
        role: "teacher-area-anchor",
        position: new Vector3(-5.6, 1, 3.7)
      },
      {
        name: "frontClassroomAnchor",
        role: "front-classroom-anchor",
        position: new Vector3(0, 1.6, 4.2)
      },
      {
        name: "sideClassroomAnchor",
        role: "side-classroom-anchor",
        position: new Vector3(7.7, 1.4, -0.4)
      }
    ].forEach((anchorData) => {
      const anchor = new TransformNode(anchorData.name, this.scene);
      anchor.position = anchorData.position;
      anchor.metadata = {
        role: anchorData.role
      };
    });
  }

  private createTable(options: {
    name: string;
    position: Vector3;
    width: number;
    depth: number;
    height: number;
    rotationY: number;
    collides?: boolean;
    hideDuringEvaluation?: boolean;
  }): void {
    const collides = options.collides ?? false;

    this.createBox({
      name: `${options.name}Top`,
      width: options.width,
      height: 0.16,
      depth: options.depth,
      position: new Vector3(options.position.x, options.height, options.position.z),
      material: this.materials.wood,
      castsShadow: true,
      collides,
      hideDuringEvaluation: options.hideDuringEvaluation,
      rotationY: options.rotationY
    });

    this.createBox({
      name: `${options.name}FrontPanel`,
      width: options.width * 0.92,
      height: 0.22,
      depth: 0.08,
      position: this.positionFromLocalOffset(
        options.position,
        0,
        options.height - 0.21,
        -options.depth / 2 + 0.05,
        options.rotationY
      ),
      material: this.materials.accentOrange,
      castsShadow: true,
      collides,
      hideDuringEvaluation: options.hideDuringEvaluation,
      rotationY: options.rotationY
    });

    this.createBox({
      name: `${options.name}BookTray`,
      width: options.width * 0.72,
      height: 0.06,
      depth: 0.12,
      position: this.positionFromLocalOffset(
        options.position,
        0,
        options.height - 0.19,
        options.depth / 2 - 0.08,
        options.rotationY
      ),
      material: this.materials.metal,
      castsShadow: true,
      hideDuringEvaluation: options.hideDuringEvaluation,
      rotationY: options.rotationY
    });

    const legOffsetX = options.width / 2 - 0.16;
    const legOffsetZ = options.depth / 2 - 0.16;
    const legPositions = [
      [-legOffsetX, -legOffsetZ],
      [legOffsetX, -legOffsetZ],
      [-legOffsetX, legOffsetZ],
      [legOffsetX, legOffsetZ]
    ];

    legPositions.forEach(([xOffset, zOffset], index) => {
      this.createBox({
        name: `${options.name}Leg${index + 1}`,
        width: 0.12,
        height: options.height,
        depth: 0.12,
        position: this.positionFromLocalOffset(
          options.position,
          xOffset,
          options.height / 2,
          zOffset,
          options.rotationY
        ),
        material: this.materials.metal,
        castsShadow: true,
        collides: false,
        hideDuringEvaluation: options.hideDuringEvaluation,
        rotationY: options.rotationY
      });
    });
  }

  private createChair(
    name: string,
    position: Vector3,
    rotationY: number,
    hideDuringEvaluation = false,
    accentMaterial: StandardMaterial = this.materials.accentCoral,
    collides = false
  ): void {
    this.createBox({
      name: `${name}Seat`,
      width: 0.92,
      height: 0.14,
      depth: 0.8,
      position: new Vector3(position.x, 0.48, position.z),
      material: accentMaterial,
      castsShadow: true,
      collides,
      hideDuringEvaluation,
      rotationY
    });

    this.createBox({
      name: `${name}Back`,
      width: 0.92,
      height: 0.9,
      depth: 0.12,
      position: this.positionFromLocalOffset(position, 0, 1.0, -0.39, rotationY),
      material: this.materials.chair,
      castsShadow: true,
      collides,
      hideDuringEvaluation,
      rotationY
    });

    this.createBox({
      name: `${name}BackAccent`,
      width: 0.5,
      height: 0.42,
      depth: 0.04,
      position: this.positionFromLocalOffset(position, 0, 1.02, -0.46, rotationY),
      material: accentMaterial,
      castsShadow: true,
      hideDuringEvaluation,
      rotationY
    });

    const legPositions = [
      [-0.35, -0.28],
      [0.35, -0.28],
      [-0.35, 0.28],
      [0.35, 0.28]
    ];

    legPositions.forEach(([xOffset, zOffset], index) => {
      this.createBox({
        name: `${name}Leg${index + 1}`,
        width: 0.08,
        height: 0.5,
        depth: 0.08,
        position: this.positionFromLocalOffset(
          position,
          xOffset,
          0.25,
          zOffset,
          rotationY
        ),
        material: this.materials.metal,
        castsShadow: true,
        collides: false,
        hideDuringEvaluation,
        rotationY
      });
    });
  }

  private createSeatAnchor(
    name: string,
    chairPosition: Vector3,
    rotationY: number,
    seatId: string,
    deskId: string
  ): void {
    const anchor = new TransformNode(name, this.scene);

    anchor.position = this.positionFromLocalOffset(
      chairPosition,
      0,
      0,
      -0.04,
      rotationY - Math.PI
    );
    anchor.rotation.y = rotationY;
    anchor.metadata = {
      role: "student-seat-anchor",
      seatId,
      deskId
    };
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
