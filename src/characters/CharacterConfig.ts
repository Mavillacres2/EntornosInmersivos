import { Vector3 } from "@babylonjs/core";

import type {
  AmbientAction,
  CharacterAmbientRole,
  CharacterConfig,
  CharacterMaterialTarget,
  CharacterState
} from "./CharacterTypes";

export const CHARACTER_DEBUG = false;
export const CHARACTER_LAYOUT_DEBUG = false;
export const CHARACTER_AMBIENT_BEHAVIOR_ENABLED = true;

export const CHARACTER_MODEL_ROOT = "/assets/models/characters/";
export const STUDENT_SHARED_MODEL_URL = `${CHARACTER_MODEL_ROOT}student.glb`;

const standingActions: AmbientAction[] = [
  "idle",
  "stand",
  "lookAround",
  "smallGesture"
];
const teacherAmbientRole: CharacterAmbientRole = "teacher";
const childMainDeskTarget = new Vector3(0, 0, -4.95);

const rotationTowardChild = (x: number, z: number): number =>
  Math.atan2(childMainDeskTarget.x - x, childMainDeskTarget.z - z);

export const CHARACTER_ANIMATION_ALIASES: Record<CharacterState, string[]> = {
  idle: ["idle", "breath", "stand", "standingidle", "neutral"],
  sitting: ["sit", "sitting", "sittingidle", "seated", "chair"],
  walking: ["walk", "walking", "locomotion", "move"],
  talking: ["talk", "talking", "speak", "speaking", "conversation", "gesture"],
  raiseHand: ["raise", "raisehand", "handup", "wave", "answer"],
  lookAround: ["look", "lookaround", "looking", "head", "turn"]
};

export const CHARACTER_MATERIAL_ALIASES: Record<
  CharacterMaterialTarget,
  string[]
> = {
  shirt: [
    "shirt",
    "tshirt",
    "top",
    "uniform",
    "blouse",
    "jacket",
    "sweater",
    "clothesupper",
    "upperbody"
  ],
  pants: [
    "pants",
    "trousers",
    "bottom",
    "jeans",
    "shorts",
    "skirt",
    "clotheslower",
    "lowerbody"
  ],
  hair: ["hair", "hairstyle"],
  shoes: ["shoe", "shoes", "sneaker", "boot", "footwear"]
};

export const CHARACTER_CONFIG: CharacterConfig[] = [
  {
    id: "teacher",
    role: "teacher",
    ambientRole: teacherAmbientRole,
    modelUrl: `${CHARACTER_MODEL_ROOT}teacher.glb`,
    fallback: true,
    position: new Vector3(-3, 0, 3),
    positionOffset: new Vector3(0, 0, 0),
    rotationY: rotationTowardChild(-3, 3),
    rotationOffsetY: 0,
    scale: 0.92,
    targetHeight: 1.72,
    defaultAnimation: "idle",
    deskId: "teacherDesk",
    allowedAmbientActions: [],
    appearance: {
      shirtColor: "#C8896D",
      pantsColor: "#44546A",
      hairColor: "#3B2A20",
      shoesColor: "#2C2D30"
    }
  },

  {
    id: "student01",
    role: "student",
    ambientRole: "standingStudent",
    modelUrl: `${CHARACTER_MODEL_ROOT}student01.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    fallback: true,
    position: new Vector3(6, 0, 4),
    positionOffset: new Vector3(0, 0, 0),
    seatAnchorId: null,
    rotationY: rotationTowardChild(4.25, 1.45),
    rotationOffsetY: 0,
    scale: 0.92,
    targetHeight: 1.34,
    defaultAnimation: "idle",
    seatId: null,
    deskId: "studentDesk2",
    allowedAmbientActions: standingActions,
    appearance: {
      shirtColor: "#6D91B8",
      pantsColor: "#44546A",
      hairColor: "#3B2A20",
      shoesColor: "#34363A"
    }
  },
  {
    id: "student02",
    role: "student",
    ambientRole: "standingStudent",
    modelUrl: `${CHARACTER_MODEL_ROOT}student04.glb`,
    modelUrlCandidates: [STUDENT_SHARED_MODEL_URL],
    fallback: true,
    position: new Vector3(-4.65, 0, -0.7),
    positionOffset: new Vector3(0, 0, 0),
    seatAnchorId: null,
    rotationY: rotationTowardChild(-4.65, -0.7),
    rotationOffsetY: 0,
    scale: 0.9,
    targetHeight: 1.33,
    defaultAnimation: "idle",
    seatId: null,
    deskId: "studentDesk3",
    allowedAmbientActions: standingActions,
    appearance: {
      shirtColor: "#C98A62",
      pantsColor: "#3F4F61",
      hairColor: "#2B2118",
      shoesColor: "#3A3633"
    }
  },
 
  {
    id: "student08",
    role: "student",
    ambientRole: "standingStudent",
    modelUrl: `${CHARACTER_MODEL_ROOT}student08.glb`,
    fallback: true,
    position: new Vector3(-1.95, 0, 1.2),
    positionOffset: new Vector3(0, 0, 0),
    seatAnchorId: null,
    rotationY: rotationTowardChild(-1.95, 1.2),
    rotationOffsetY: 0,
    scale: 0.88,
    targetHeight: 1.33,
    defaultAnimation: "idle",
    seatId: null,
    deskId: "studentDesk1",
    allowedAmbientActions: standingActions,
    appearance: {
      shirtColor: "#9A7FA6",
      pantsColor: "#4A5360",
      hairColor: "#35251C",
      shoesColor: "#2E3135"
    }
  },
  {
    id: "student09",
    role: "student",
    ambientRole: "standingStudent",
    modelUrl: `${CHARACTER_MODEL_ROOT}student09.glb`,
    fallback: true,
    position: new Vector3(-2.35, 0, -2.75),
    positionOffset: new Vector3(0, 0, 0),
    seatAnchorId: null,
    rotationY: rotationTowardChild(-2.35, -2.75),
    rotationOffsetY: 0,
    scale: 0.88,
    targetHeight: 1.33,
    defaultAnimation: "idle",
    seatId: null,
    deskId: "studentDesk5",
    allowedAmbientActions: standingActions,
    appearance: {
      shirtColor: "#6D9A95",
      pantsColor: "#45535F",
      hairColor: "#2F221B",
      shoesColor: "#303338"
    }
  },
  {
    id: "student10",
    role: "student",
    ambientRole: "standingStudent",
    modelUrl: `${CHARACTER_MODEL_ROOT}student10.glb`,
    fallback: true,
    position: new Vector3(2.35, 0, -2.75),
    positionOffset: new Vector3(0, 0, 0),
    seatAnchorId: null,
    rotationY: rotationTowardChild(2.35, -2.75),
    rotationOffsetY: 0,
    scale: 0.88,
    targetHeight: 1.34,
    defaultAnimation: "idle",
    seatId: null,
    deskId: "studentDesk6",
    allowedAmbientActions: standingActions,
    appearance: {
      shirtColor: "#B8985B",
      pantsColor: "#3F4D5A",
      hairColor: "#3C291F",
      shoesColor: "#343434"
    }
  }
];
