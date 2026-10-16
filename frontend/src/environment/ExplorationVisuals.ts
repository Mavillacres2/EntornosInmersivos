import { Constants, ImageProcessingConfiguration, PBRMaterial, RawCubeTexture, RawTexture, SphericalPolynomial, StandardMaterial, Texture } from '@babylonjs/core';
import type { BaseTexture, Material, Mesh, Scene } from '@babylonjs/core';
import type { GuideQuality } from '../guides/GuideSceneConfiguration';
import type { WorldTheme } from '../ui/ScenarioPresentation';
import { ExplorationArtDirection } from './ExplorationArtDirection';

const surfaces: Record<WorldTheme, RegExp> = {
  classroom: /^(wall|ceiling|floor|lightWood|chairFrame|boardFrame|darkTrim|deskLeg|door|shelf|warmFrame|storage\w+)Material$/,
  space: /^space(Wall|Floor|Metal|Trim|Console|Door|Seat)Material$/,
  museum: /^museum(WarmWall|PetrolAccentWall|PolishedFloor|SoftTrim|MutedGold|Glass|LightWood|Stone|Charcoal)Material$/
};

/** Reversible visual layer. Disposed BEFORE the original practice/evaluation flow. */
export class ExplorationVisuals {
  private readonly replacements = new Map<Mesh, Material>();
  private readonly materials: PBRMaterial[] = [];
  private readonly detailTextures: RawTexture[] = [];
  private readonly previousEnvironment: BaseTexture | null;
  private readonly environment: RawCubeTexture | null;
  private readonly restoreImage: () => void;
  private readonly restoreLights: (() => void)[] = [];
  private disposed = false;
  private readonly art: ExplorationArtDirection | null;

  constructor(privateScene: Scene, theme: WorldTheme, quality: GuideQuality = 'balanced', options: { art?: boolean } = {}) {
    this.scene = privateScene;
    const scene = this.scene;
    const image = scene.imageProcessingConfiguration;
    const toneEnabled = image.toneMappingEnabled, toneType = image.toneMappingType;
    this.restoreImage = () => { image.toneMappingEnabled = toneEnabled; image.toneMappingType = toneType; };
    image.toneMappingEnabled = true;
    image.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.previousEnvironment = scene.environmentTexture;
    this.environment = quality === 'low' ? null : createStudioEnvironment(scene, theme);
    if (this.environment) scene.environmentTexture = this.environment;
    const cache = new Map<StandardMaterial, PBRMaterial>();
    const details = new Map<string, RawTexture>();
    scene.meshes.slice().forEach(abstractMesh => {
      const mesh = abstractMesh as Mesh;
      const original = mesh.material;
      if (!(original instanceof StandardMaterial) || !surfaces[theme].test(original.name) || mesh.metadata?.dynamic) return;
      original.freeze();
      let pbr = cache.get(original);
      if (!pbr) {
        pbr = new PBRMaterial(`exploration-PBR-${original.name}`, scene);
        pbr.albedoColor = original.diffuseColor.clone();
        pbr.albedoTexture = original.diffuseTexture;
        pbr.alpha = original.alpha;
        pbr.backFaceCulling = original.backFaceCulling;
        pbr.metallic = /metal|gold|deskLeg|trim/i.test(original.name) ? .42 : .02;
        pbr.roughness = /wood|shelf|door/i.test(original.name) ? .64 : /floor/i.test(original.name) ? .48 : /glass/i.test(original.name) ? .18 : .82;
        pbr.environmentIntensity = theme === 'space' ? .5 : .35;
        pbr.maxSimultaneousLights = 4;
        if (quality !== 'low' && !/glass/i.test(original.name)) {
          const kind = /wood|shelf|door/i.test(original.name) ? 'wood' : /metal|trim|deskLeg/i.test(original.name) ? 'brushed' : 'plaster';
          let detail = details.get(kind);
          if (!detail) { detail = createMicroNormal(scene, kind); details.set(kind, detail); this.detailTextures.push(detail); }
          pbr.bumpTexture = detail;
        }
        // Painted metal is restrained, never mirror-like. Glass retains the original alpha.
        pbr.freeze(); cache.set(original, pbr); this.materials.push(pbr);
      }
      this.replacements.set(mesh, original); mesh.material = pbr;
    });
    scene.lights.forEach(light => {
      if (light.getClassName() !== 'DirectionalLight') return;
      const intensity = light.intensity;
      light.intensity *= theme === 'classroom' ? 1.12 : 1.06;
      this.restoreLights.push(() => { light.intensity = intensity; });
    });
    this.art = options.art === false ? null : new ExplorationArtDirection(scene, theme, quality);
  }
  private readonly scene: Scene;
  dispose(): void {
    if (this.disposed) return; this.disposed = true;
    this.art?.dispose();
    this.replacements.forEach((original, mesh) => { if (!mesh.isDisposed()) mesh.material = original; });
    this.replacements.clear();
    this.materials.forEach(material => material.dispose(false, false));
    this.detailTextures.forEach(texture => texture.dispose());
    this.restoreImage(); this.restoreLights.forEach(restore => restore());
    this.scene.environmentTexture = this.previousEnvironment;
    this.environment?.dispose();
  }
}

function createMicroNormal(scene: Scene, kind: string): RawTexture {
  const size = 64, bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = kind === 'wood' ? Math.sin((y + Math.sin(x * Math.PI / 32)) * Math.PI / 4) * .13
      : kind === 'brushed' ? Math.sin(y * Math.PI / 2) * .07 : Math.sin(x * 2.3 + y * 1.7) * .04;
    const nx = kind === 'plaster' ? Math.cos(x * 1.3 - y * 2.1) * .035 : .01;
    const nz = Math.sqrt(1 - nx * nx - grain * grain), offset = (y * size + x) * 4;
    bytes.set([Math.round((nx + 1) * 127.5), Math.round((grain + 1) * 127.5), Math.round((nz + 1) * 127.5), 255], offset);
  }
  const texture = RawTexture.CreateRGBATexture(bytes, size, size, scene, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.name = `original-${kind}-micro-normal`; texture.gammaSpace = false; texture.level = .35;
  return texture;
}

/** Small original LDR studio cubemap with mipmaps; not a downloaded HDR photograph. */
function createStudioEnvironment(scene: Scene, theme: WorldTheme): RawCubeTexture {
  const size = 32;
  const faces = Array.from({ length: 6 }, (_, face) => {
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x + .5) / size * 2 - 1, v = (y + .5) / size * 2 - 1;
      const directionY = (face === 2 ? 1 : face === 3 ? -1 : -v) / Math.sqrt(1 + u * u + v * v);
      const sky = (directionY + 1) * .5;
      const ground = theme === 'space' ? [53, 66, 89] : [114, 102, 83];
      const ceiling = theme === 'space' ? [165, 202, 237] : [242, 234, 210];
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) pixels[offset + channel] = Math.round(ground[channel]! * (1 - sky) + ceiling[channel]! * sky);
      pixels[offset + 3] = 255;
    }
    return pixels;
  });
  const texture = new RawCubeTexture(scene, faces, size, Constants.TEXTUREFORMAT_RGBA, Constants.TEXTURETYPE_UNSIGNED_BYTE, true, false, Texture.TRILINEAR_SAMPLINGMODE);
  texture.name = `original-${theme}-studio-IBL`; texture.gammaSpace = true;
  const irradiance = new SphericalPolynomial();
  irradiance.xx.set(.22, .24, .26); irradiance.yy.set(.25, .25, .24); irradiance.zz.set(.22, .24, .26);
  texture.sphericalPolynomial = irradiance;
  return texture;
}
