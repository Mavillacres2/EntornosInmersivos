import {
  Color3,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import type {
  AbstractMesh,
  AnimationGroup,
  AssetContainer,
  Scene
} from "@babylonjs/core";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

type MuseumVisitorKind = "adult" | "child";
type MuseumVisitorPose = "idle" | "looking" | "talking" | "walking";

interface MuseumVisitorConfig {
  id: string;
  label: string;
  kind: MuseumVisitorKind;
  modelUrl: string;
  modelUrlCandidates?: string[];
  position: Vector3;
  rotationY: number;
  lookAt?: Vector3;
  targetHeight: number;
  pose: MuseumVisitorPose;
  idleOffset: number;
  appearance?: MuseumVisitorAppearance;
}

interface MuseumVisitorAppearance {
  shirtColor?: string;
  pantsColor?: string;
  hairColor?: string;
  shoesColor?: string;
}

interface MuseumVisitor {
  root: TransformNode;
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
  container: AssetContainer;
  config: MuseumVisitorConfig;
  activeAnimation: AnimationGroup | null;
}

const MODEL_ROOT = "/assets/models/characters/";
const STUDENT_SHARED_MODEL_URL = `${MODEL_ROOT}student.glb`;

const MUSEUM_VISITOR_CONFIGS: MuseumVisitorConfig[] = [
  {
    id: "museumArtTeacher",
    label: "Profesora observando galeria",
    kind: "adult",
    modelUrl: `${MODEL_ROOT}teacher.glb`,
    position: new Vector3(-6.2, 0, 1.82),
    rotationY: Math.PI / 2,
    lookAt: new Vector3(-7.35, 2, 2.3),
    targetHeight: 1.68,
    pose: "looking",
    idleOffset: 0.1,
    appearance: {
      shirtColor: "#7F6B9A",
      pantsColor: "#374554",
      hairColor: "#2F231C",
      shoesColor: "#24272B"
    }
  },
  {
    id: "museumChildArtCompanion",
    label: "Nino con adulto en galeria",
    kind: "child",
    modelUrl: `${MODEL_ROOT}student01.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(-5.62, 0, 1.05),
    rotationY: Math.PI / 2.25,
    lookAt: new Vector3(-7.35, 1.8, 1.25),
    targetHeight: 1.28,
    pose: "talking",
    idleOffset: 1.5,
    appearance: {
      shirtColor: "#3D7EA6",
      pantsColor: "#3D4652",
      hairColor: "#3C2A1D"
    }
  },
  {
    id: "museumTallScienceVisitor",
    label: "Visitante joven en ciencia",
    kind: "adult",
    modelUrl: `${MODEL_ROOT}student10.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(5.75, 0, -2.7),
    rotationY: -Math.PI / 2,
    lookAt: new Vector3(7.35, 2.2, -3.15),
    targetHeight: 1.58,
    pose: "looking",
    idleOffset: 2.4,
    appearance: {
      shirtColor: "#5B8F64",
      pantsColor: "#303E4A",
      hairColor: "#2A211A"
    }
  },
  {
    id: "museumChildScienceOne",
    label: "Nino mirando ADN",
    kind: "child",
    modelUrl: `${MODEL_ROOT}student04.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(4.88, 0, -1.35),
    rotationY: -Math.PI / 2.15,
    lookAt: new Vector3(5.55, 1.3, -1.25),
    targetHeight: 1.3,
    pose: "talking",
    idleOffset: 3.1,
    appearance: {
      shirtColor: "#C28745",
      pantsColor: "#394857",
      hairColor: "#33241B"
    }
  },
  {
    id: "museumChildScienceTwo",
    label: "Nina mirando ciencia",
    kind: "child",
    modelUrl: `${MODEL_ROOT}student08.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(5.7, 0, 2.75),
    rotationY: -1.72,
    lookAt: new Vector3(5.15, 1.1, 1.95),
    targetHeight: 1.29,
    pose: "looking",
    idleOffset: 4.2,
    appearance: {
      shirtColor: "#B75B63",
      pantsColor: "#40515E",
      hairColor: "#221A16"
    }
  },
  {
    id: "museumFamilyOlderStudent",
    label: "Visitante mayor de familia",
    kind: "adult",
    modelUrl: `${MODEL_ROOT}student08.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(-5.38, 0, -3.18),
    rotationY: 0.12,
    lookAt: new Vector3(-4.82, 1.2, -2.6),
    targetHeight: 1.52,
    pose: "talking",
    idleOffset: 7.4,
    appearance: {
      shirtColor: "#8E6EA8",
      pantsColor: "#303B48",
      hairColor: "#3A2A20"
    }
  },
  {
    id: "museumPerceptionGalleryVisitor",
    label: "Visitante en galeria de percepcion",
    kind: "child",
    modelUrl: `${MODEL_ROOT}student04.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(-5.95, 0, -4.25),
    rotationY: -Math.PI / 2,
    lookAt: new Vector3(-7.33, 2.5, -4.25),
    targetHeight: 1.32,
    pose: "idle",
    idleOffset: 8.6,
    appearance: {
      shirtColor: "#477EA0",
      pantsColor: "#33424F",
      hairColor: "#2E2118"
    }
  },
  {
    id: "museumSideWalker",
    label: "Visitante lateral",
    kind: "adult",
    modelUrl: `${MODEL_ROOT}student01.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    position: new Vector3(6.2, 0, 4.55),
    rotationY: -2.28,
    lookAt: new Vector3(7.34, 2.8, 3.95),
    targetHeight: 1.5,
    pose: "walking",
    idleOffset: 9.7,
    appearance: {
      shirtColor: "#A76B4C",
      pantsColor: "#3B4856",
      hairColor: "#2B1F17"
    }
  }
];

export class MuseumCharacterManager {
  private readonly scene: Scene;
  private readonly visitors: MuseumVisitor[] = [];
  private readonly modelAvailability = new Map<string, Promise<boolean>>();
  private evaluationMode = false;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  async initialize(): Promise<void> {
    for (const config of MUSEUM_VISITOR_CONFIGS) {
      const visitor = await this.createVisitor(config);

      if (visitor) {
        this.visitors.push(visitor);
      }
    }

    this.startSubtleIdleMotion();
  }

  setMode(mode: "exploration" | "evaluation"): void {
    this.evaluationMode = mode === "evaluation";

    this.visitors.forEach((visitor) => {
      visitor.activeAnimation?.stop();
      visitor.activeAnimation = null;

      if (this.evaluationMode) {
        visitor.root.rotation.z = 0;
        visitor.root.rotation.y = this.getConfiguredRotationY(visitor.config);
        visitor.root.position.copyFrom(visitor.config.position);
      } else {
        this.playBestIdleAnimation(visitor);
      }
    });
  }

  dispose(): void {
    this.visitors.forEach((visitor) => {
      visitor.animationGroups.forEach((group) => {
        group.stop();
        group.dispose();
      });
      visitor.container.dispose();
      visitor.root.dispose(false, true);
    });
    this.visitors.length = 0;
  }

  private async createVisitor(config: MuseumVisitorConfig): Promise<MuseumVisitor | null> {
    const modelUrl = await this.resolveModelUrl(config);

    if (!modelUrl) {
      console.warn(`[MuseumCharacterManager] No se encontro modelo GLB para ${config.id}. Se omite para evitar placeholders.`);
      return null;
    }

    try {
      const container = await LoadAssetContainerAsync(modelUrl, this.scene);
      const root = new TransformNode(`${config.id}Root`, this.scene);

      container.animationGroups.forEach((group) => {
        group.stop();
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
      root.metadata = {
        dynamic: true,
        role: "museum-visitor",
        id: config.id,
        label: config.label,
        kind: config.kind,
        source: modelUrl
      };

      this.normalizeImportedCharacterHeight(root, config.targetHeight);
      this.centerImportedCharacterOnRoot(root);
      this.alignCharacterBottomToY(root, config.position.y);
      this.applyAppearance(container.meshes, config);

      const visitor: MuseumVisitor = {
        root,
        meshes: container.meshes,
        animationGroups: container.animationGroups,
        container,
        config,
        activeAnimation: null
      };

      this.playBestIdleAnimation(visitor);

      return visitor;
    } catch (error: unknown) {
      console.warn(`[MuseumCharacterManager] No se pudo cargar ${modelUrl}.`, error);
      return null;
    }
  }

  private async resolveModelUrl(config: MuseumVisitorConfig): Promise<string | null> {
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

  private modelExists(modelUrl: string): Promise<boolean> {
    const cached = this.modelAvailability.get(modelUrl);

    if (cached) {
      return cached;
    }

    const request = fetch(modelUrl, { method: "HEAD", cache: "no-cache" })
      .then((response) => response.ok)
      .catch(() => false);

    this.modelAvailability.set(modelUrl, request);

    return request;
  }

  private prepareImportedMesh(mesh: AbstractMesh): void {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = false;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      dynamic: true,
      role: "museum-visitor-mesh"
    };
  }

  private applyAppearance(meshes: AbstractMesh[], config: MuseumVisitorConfig): void {
    const appearance = config.appearance;

    if (!appearance) {
      return;
    }

    this.tintMeshes(meshes, config.id, "shirt", appearance.shirtColor);
    this.tintMeshes(meshes, config.id, "pants", appearance.pantsColor);
    this.tintMeshes(meshes, config.id, "hair", appearance.hairColor);
    this.tintMeshes(meshes, config.id, "shoes", appearance.shoesColor);
  }

  private tintMeshes(
    meshes: AbstractMesh[],
    ownerId: string,
    target: "shirt" | "pants" | "hair" | "shoes",
    colorValue: string | undefined
  ): void {
    if (!colorValue) {
      return;
    }

    const color = Color3.FromHexString(colorValue);
    const aliases = this.getMaterialAliases(target);

    meshes.forEach((mesh) => {
      const material = mesh.material;

      if (!material) {
        return;
      }

      const meshName = this.normalizeAssetName(mesh.name);
      const materialName = this.normalizeAssetName(material.name);
      const matchesTarget = aliases.some((alias) =>
        meshName.includes(alias) || materialName.includes(alias)
      );

      if (!matchesTarget || this.isUnsafeTintTarget(meshName, materialName, target)) {
        return;
      }

      const clonedMaterial = material.clone(`${ownerId}-${target}-${material.name}`);

      if (!clonedMaterial) {
        return;
      }

      if (clonedMaterial instanceof StandardMaterial) {
        clonedMaterial.diffuseColor = color;
      }

      if (clonedMaterial instanceof PBRMaterial) {
        clonedMaterial.albedoColor = color;
      }

      mesh.material = clonedMaterial;
    });
  }

  private getMaterialAliases(target: "shirt" | "pants" | "hair" | "shoes"): string[] {
    if (target === "shirt") {
      return ["shirt", "tshirt", "top", "uniform", "blouse", "jacket", "sweater", "upperbody"];
    }

    if (target === "pants") {
      return ["pants", "trousers", "bottom", "jeans", "shorts", "skirt", "lowerbody"];
    }

    if (target === "hair") {
      return ["hair", "hairstyle"];
    }

    return ["shoe", "shoes", "sneaker", "boot", "footwear"];
  }

  private isUnsafeTintTarget(
    meshName: string,
    materialName: string,
    target: "shirt" | "pants" | "hair" | "shoes"
  ): boolean {
    const unsafeParts = ["skin", "face", "head", "hand", "eye", "mouth", "teeth", "tongue"];

    if (target === "hair") {
      return ["skin", "face", "eye", "mouth"].some((name) =>
        meshName.includes(name) || materialName.includes(name)
      );
    }

    return unsafeParts.some((name) =>
      meshName.includes(name) || materialName.includes(name)
    );
  }

  private hideImportedScenePropMeshes(meshes: AbstractMesh[]): void {
    meshes.forEach((mesh) => {
      const normalizedName = this.normalizeAssetName(mesh.name);
      const shouldHide =
        normalizedName.includes("floor") ||
        normalizedName.includes("ground") ||
        normalizedName.includes("baseplate") ||
        normalizedName.includes("shadowplane");

      if (!shouldHide) {
        return;
      }

      mesh.setEnabled(false);
      mesh.isVisible = false;
    });
  }

  private playBestIdleAnimation(visitor: MuseumVisitor): void {
    const aliases = this.getAnimationAliases(visitor.config.pose);
    const animation = visitor.animationGroups.find((group) => {
      const normalizedName = this.normalizeAssetName(group.name);

      return aliases.some((alias) => normalizedName.includes(alias));
    }) ?? visitor.animationGroups[0] ?? null;

    if (!animation) {
      return;
    }

    animation.start(true, visitor.config.pose === "walking" ? 0.38 : 0.22);
    visitor.activeAnimation = animation;
  }

  private getAnimationAliases(pose: MuseumVisitorPose): string[] {
    if (pose === "walking") {
      return ["walk", "walking", "locomotion"];
    }

    if (pose === "talking") {
      return ["talk", "speak", "gesture", "idle"];
    }

    if (pose === "looking") {
      return ["look", "idle", "stand", "breath"];
    }

    return ["idle", "stand", "breath", "neutral"];
  }

  private startSubtleIdleMotion(): void {
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.evaluationMode) {
        return;
      }

      const time = performance.now() * 0.001;

      this.visitors.forEach((visitor) => {
        if (visitor.config.pose === "walking") {
          visitor.root.position.x =
            visitor.config.position.x + Math.sin(time * 0.18 + visitor.config.idleOffset) * 0.16;
        }

        if (visitor.config.pose === "looking" || visitor.config.pose === "talking") {
          visitor.root.rotation.y =
            this.getConfiguredRotationY(visitor.config) + Math.sin(time * 0.22 + visitor.config.idleOffset) * 0.035;
        }
      });
    });
  }

  private getConfiguredRotationY(config: MuseumVisitorConfig): number {
    if (!config.lookAt) {
      return config.rotationY;
    }

    return this.getLookAtY(config.position, config.lookAt) + Math.PI;
  }

  private getLookAtY(position: Vector3, target: Vector3): number {
    return Math.atan2(target.x - position.x, target.z - position.z);
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
}
