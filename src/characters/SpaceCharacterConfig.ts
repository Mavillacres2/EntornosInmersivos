import { Color3, Vector3 } from "@babylonjs/core";

export const SPACE_CHARACTER_MODEL_ROOT = "/assets/models/space/characters/";

export interface SpaceCharacterConfig {
  id: string;
  label: string;
  modelUrl: string;
  modelUrlCandidates?: string[];
  position: Vector3;
  rotationY: number;
  rotationOffsetY?: number;
  scaling: number;
  targetHeight: number;
  facesActivityParticipant: boolean;
  fallbackColor: Color3;
}

const lookAtXZ = (position: Vector3, target: Vector3): number =>
  Math.atan2(target.x - position.x, target.z - position.z);

const spaceWindowTarget = new Vector3(-6.65, 0, -0.75);
const activityParticipantTarget = new Vector3(0, 0, -0.96);

export const SPACE_CHARACTER_CONFIGS: SpaceCharacterConfig[] = [
  {
    id: "spaceStudent01",
    label: "Estudiante mirando la ventana",
    modelUrl: `${SPACE_CHARACTER_MODEL_ROOT}space-student-01.glb`,
    modelUrlCandidates: [
      `${SPACE_CHARACTER_MODEL_ROOT}space-student01.glb`,
      `${SPACE_CHARACTER_MODEL_ROOT}student01.glb`
    ],
    position: new Vector3(-4.35, 0, -2.35),
    rotationY: lookAtXZ(new Vector3(-4.35, 0, -2.35), spaceWindowTarget),
    rotationOffsetY: 0,
    scaling: 1,
    targetHeight: 1.34,
    facesActivityParticipant: false,
    fallbackColor: new Color3(0.5, 0.75, 0.9)
  },
  {
    id: "spaceStudent02",
    label: "Estudiante al lado izquierdo del niño",
    modelUrl: `${SPACE_CHARACTER_MODEL_ROOT}space-student-02.glb`,
    modelUrlCandidates: [
      `${SPACE_CHARACTER_MODEL_ROOT}space-student02.glb`,
      `${SPACE_CHARACTER_MODEL_ROOT}student02.glb`
    ],
    position: new Vector3(-2.85, 0, -0.2),
    rotationY: lookAtXZ(new Vector3(-2.85, 0, -0.2), activityParticipantTarget),
    rotationOffsetY: 0,
    scaling: 1,
    targetHeight: 1.34,
    facesActivityParticipant: true,
    fallbackColor: new Color3(0.72, 0.58, 0.86)
  }
];
