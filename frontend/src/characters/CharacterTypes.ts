import type {
  AbstractMesh,
  AnimationGroup,
  Color3,
  Material,
  ShadowGenerator,
  Skeleton,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";

export type CharacterRole = "teacher" | "student";

export type CharacterState =
  | "idle"
  | "sitting"
  | "walking"
  | "talking"
  | "raiseHand"
  | "lookAround";

export type CharacterAnimationKey = CharacterState | "walk";

export type CharacterMaterialTarget = "shirt" | "pants" | "hair" | "shoes";

export type AmbientAction =
  | "idle"
  | "talk"
  | "lookAround"
  | "stand"
  | "walk"
  | "smallGesture";

export type CharacterAmbientRole =
  | "teacher"
  | "seatedStudent"
  | "conversationStudent"
  | "standingStudent"
  | "walkingStudent";

export type CharacterAction =
  | "lookAround"
  | "raiseHand"
  | "smallGesture"
  | "talk"
  | "walkAcross";

export interface CharacterWalkRoute {
  pointA: Vector3;
  pointB: Vector3;
  durationMs?: number;
  minWaitMs?: number;
  maxWaitMs?: number;
}

export interface CharacterConfig {
  id: string;
  role: CharacterRole;
  ambientRole?: CharacterAmbientRole;
  modelUrl: string | null;
  modelUrlCandidates?: string[];
  fallback: boolean;
  position: Vector3;
  positionOffset?: Vector3;
  seatAnchorId?: string | null;
  rotationY: number;
  rotationOffsetY?: number;
  scale: number;
  targetHeight?: number;
  defaultAnimation: CharacterState;
  seatId?: string | null;
  deskId?: string | null;
  allowedAmbientActions?: AmbientAction[];
  conversationPartnerId?: string | null;
  walkRoute?: CharacterWalkRoute;
  appearance?: CharacterAppearance;
  shirtColor?: Color3;
  accentColor?: Color3;
  animationAliases?: Partial<Record<CharacterState, string[]>>;
  materialAliases?: Partial<Record<CharacterMaterialTarget, string[]>>;
}

export interface CharacterAppearance {
  shirtColor?: string;
  pantsColor?: string;
  hairColor?: string;
  shoesColor?: string;
}

export type CharacterMaterialMappings = Partial<
  Record<CharacterMaterialTarget, string[]>
>;

export type CharacterMaterialMap = Partial<
  Record<CharacterMaterialTarget, Material[]>
>;

export interface CharacterSeatTransform {
  position: Vector3;
  rotationY: number;
  found: boolean;
}

export interface CharacterEvent {
  id: string;
  characterId: string;
  action: CharacterAction;
  state: CharacterState;
  startedAt: number;
  endedAt: number;
  animationGroupName: string | null;
}

export type AnimationMap = Partial<Record<CharacterState, AnimationGroup>>;

export interface LoadedCharacter {
  id: string;
  role: CharacterRole;
  root: TransformNode;
  meshes: AbstractMesh[];
  skeletons: Skeleton[];
  animationGroups: AnimationGroup[];
  animationMap: AnimationMap;
  materialMap: CharacterMaterialMap;
  materialMappings: CharacterMaterialMappings;
  currentAnimation: AnimationGroup | null;
  currentAnimationKey: CharacterState | null;
  usingFallback: boolean;
  config: CharacterConfig;
}

export interface CharacterDebugInfo {
  id: string;
  role: CharacterRole;
  modelUrl: string | null;
  position: {
    x: number;
    y: number;
    z: number;
  };
  seatId: string | null;
  seatAnchorId: string | null;
  rotationY: number;
  rotationOffsetY: number;
  scale: number;
  defaultAnimation: CharacterState;
  ambientRole: CharacterAmbientRole | null;
  allowedAmbientActions: AmbientAction[];
  conversationPartnerId: string | null;
  walkRoute: CharacterWalkRoute | null;
  meshes: string[];
  materials: string[];
  hasSkeleton: boolean;
  appearanceMappings: CharacterMaterialMappings;
  animations: string[];
  currentAnimation: string | null;
  currentAnimationKey: CharacterState | null;
  usingFallback: boolean;
}

export interface CharacterManagerOptions {
  shadowGenerator?: ShadowGenerator;
  addShadowCaster?: (mesh: AbstractMesh) => void;
}

export interface CharacterMaterials {
  skin: StandardMaterial;
  shirt: StandardMaterial;
  accent: StandardMaterial;
  hair: StandardMaterial;
  eye: StandardMaterial;
  shoe: StandardMaterial;
}

export interface CharacterAmbientActionConfig {
  characterId: string;
  action: CharacterAction;
}
