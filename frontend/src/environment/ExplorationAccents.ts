import { Color3, DynamicTexture, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";
import type { WorldTheme } from "../ui/ScenarioPresentation";
import { createSoftBox } from "./ModernGeometry";

/** Quiet, static landmarks for free exploration; all are hidden during assessment. */
export function createExplorationAccents(scene: Scene, theme: WorldTheme): Mesh[] {
  const meshes: Mesh[] = [];
  const palettes = {
    classroom: ["#86b6a2", "#e5bc78", "#db9380"],
    space: ["#77b7cb", "#8499ce", "#e3bd80"],
    museum: ["#b29ac5", "#8ab6ac", "#d6b274"]
  };
  const materials = palettes[theme].map((color, index) => {
    const material = new StandardMaterial(`${theme}ExplorationAccent${index}`, scene);
    material.diffuseColor = Color3.FromHexString(color);
    material.specularColor = Color3.Black();
    return material;
  });
  const track = (mesh: Mesh, material: StandardMaterial): Mesh => {
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.metadata = { ignoreSightline: true, role: "exploration-decoration" };
    meshes.push(mesh);
    return mesh;
  };

  // Rounded islands break up the floor grid without adding obstacles or movement.
  const rug = track(MeshBuilder.CreateDisc(`${theme}ExplorationRug`, { radius: 1.35, tessellation: 64 }, scene), materials[0]!);
  rug.rotation.x = Math.PI / 2;
  const rugPosition = theme === "classroom" ? new Vector3(-6.3, 0.045, -1.5)
    : theme === "space" ? new Vector3(0, 0.045, -4.4) : new Vector3(-4.1, 0.045, -0.86);
  rug.position.copyFrom(rugPosition);
  rug.scaling.set(theme === "space" ? 1.4 : 1, 0.8, 1);

  const ring = track(MeshBuilder.CreateTorus(`${theme}ExplorationRugBorder`, { diameter: 2.56, thickness: 0.025, tessellation: 64 }, scene), materials[1]!);
  ring.position.copyFrom(rugPosition.add(new Vector3(0, 0.008, 0)));
  ring.scaling.set(theme === "space" ? 1.4 : 1, 1, 0.8);

  // A wall medallion gives each world a recognizable silhouette and welcome sign.
  const x = theme === "classroom" ? -6.4 : theme === "space" ? 4.7 : -5.6;
  const z = theme === "classroom" ? 5.58 : theme === "space" ? 6.01 : 5.72;
  const plaque = track(createSoftBox(`${theme}WelcomePlaque`, { width: 1.58, height: 1.8, depth: 0.09 }, scene), materials[0]!);
  plaque.position.set(x, 2.45, z);
  const emblem = track(MeshBuilder.CreateTorus(`${theme}WelcomeEmblem`, { diameter: 0.8, thickness: 0.055, tessellation: 64 }, scene), materials[1]!);
  emblem.rotation.x = Math.PI / 2;
  emblem.position.set(x, 2.73, z - 0.08);
  const core = track(MeshBuilder.CreateSphere(`${theme}WelcomeCore`, { diameter: 0.35, segments: 24 }, scene), materials[2]!);
  core.position.set(x, 2.73, z - 0.1);
  core.scaling.z = 0.3;
  if (theme === "space") emblem.rotation.z = -0.45;

  const texture = new DynamicTexture(`${theme}WelcomeLabelTexture`, { width: 512, height: 160 }, scene, true);
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  context.clearRect(0, 0, 512, 160);
  context.fillStyle = "#193d40";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 48px Trebuchet MS, sans-serif";
  context.fillText(theme === "classroom" ? "DESCUBRE" : theme === "space" ? "EXPLORA" : "IMAGINA", 256, 80);
  texture.hasAlpha = true;
  texture.update();
  const textMaterial = new StandardMaterial(`${theme}WelcomeLabelMaterial`, scene);
  textMaterial.diffuseTexture = texture;
  textMaterial.emissiveColor = new Color3(0.16, 0.16, 0.16);
  textMaterial.useAlphaFromDiffuseTexture = true;
  const label = track(MeshBuilder.CreatePlane(`${theme}WelcomeLabel`, { width: 1.28, height: 0.4 }, scene), textMaterial);
  label.position.set(x, 2.02, z - 0.06);
  return meshes;
}
