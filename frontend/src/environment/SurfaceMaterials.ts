import { Color3, DynamicTexture, StandardMaterial, Texture } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

const grainCache = new WeakMap<Scene, DynamicTexture>();

/** Satin finishes retain the existing material API used by ambient animations. */
export function createSurfaceMaterial(name: string, color: Color3, scene: Scene): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = new Color3(0.16, 0.18, 0.2);
  material.specularPower = 64;

  if (/wood|shelf|doorMaterial|boardFrame|warmFrame/i.test(name)) {
    material.diffuseTexture = getWoodGrain(scene);
    material.specularColor = new Color3(0.2, 0.17, 0.13);
    material.specularPower = 48;
  } else if (/metal|gold|trim|projector/i.test(name)) {
    material.specularColor = new Color3(0.42, 0.46, 0.5);
    material.specularPower = 96;
  } else if (/seat|chair|stone|wall|paper|leaf|leaves/i.test(name)) {
    material.specularColor = new Color3(0.06, 0.07, 0.08);
    material.specularPower = 24;
  } else if (/glass/i.test(name)) {
    material.specularPower = 128;
  }
  return material;
}

function getWoodGrain(scene: Scene): DynamicTexture {
  const cached = grainCache.get(scene);
  if (cached) return cached;

  const texture = new DynamicTexture("satinWoodGrain", 256, scene, true, Texture.TRILINEAR_SAMPLINGMODE);
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  const pixels = context.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      // Periodic, restrained grain; no external textures or per-frame work.
      const bend = 1.8 * Math.sin(x * Math.PI / 128);
      const grain = Math.sin((y + bend) * Math.PI / 8) * 4
        + Math.sin((y + bend) * Math.PI / 2) * 2;
      const value = Math.round(244 + grain);
      const offset = (y * 256 + x) * 4;
      pixels.data.set([value, value - 2, value - 5, 255], offset);
    }
  }
  context.putImageData(pixels, 0, 0);
  texture.update();
  texture.uScale = 2;
  texture.vScale = 2;
  texture.anisotropicFilteringLevel = 8;
  grainCache.set(scene, texture);
  return texture;
}
