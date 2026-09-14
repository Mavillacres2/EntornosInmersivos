import { Color3, Vector3 } from "@babylonjs/core";

export const SPACE_CHARACTER_MODEL_ROOT = "/assets/models/space/";

export interface SpaceCharacterConfig {
  id: string;
  label: string;
  modelUrl: string;
  position: Vector3;
  rotationY: number;
  scaling: number;
  fallbackColor: Color3;
}

export const SPACE_CHARACTER_CONFIGS: SpaceCharacterConfig[] = [
  {
    id: "astronaut01",
    label: "Astronauta observador",
    modelUrl: `${SPACE_CHARACTER_MODEL_ROOT}astronaut01.glb`,
    position: new Vector3(-4.25, 0, 0.85),
    rotationY: Math.PI / 2,
    scaling: 0.82,
    fallbackColor: new Color3(0.82, 0.88, 0.9)
  },
  {
    id: "technician01",
    label: "Tecnico de consola",
    modelUrl: `${SPACE_CHARACTER_MODEL_ROOT}technician01.glb`,
    position: new Vector3(4.45, 0, 1.55),
    rotationY: -Math.PI / 2,
    scaling: 0.82,
    fallbackColor: new Color3(0.52, 0.7, 0.78)
  }
];
