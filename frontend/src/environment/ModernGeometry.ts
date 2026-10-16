import { Geometry, Mesh, MeshBuilder, Vector3, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

interface BoxDimensions {
  width: number;
  height: number;
  depth: number;
}

const geometryCache = new WeakMap<Scene, Map<string, Geometry>>();

/** Rounded furniture with shared geometry and the same outer bounds as the original box. */
export function createSoftBox(name: string, dimensions: BoxDimensions, scene: Scene): Mesh {
  const { width, height, depth } = dimensions;
  // Keep structural joins closed and leave very small markings inexpensive.
  if (/wall|ceiling|floor|baseboard|joint|beam|track|stripe|line|window.*(frame|glass|backdrop)/i.test(name)
    || Math.min(width, height, depth) < 0.025) {
    return MeshBuilder.CreateBox(name, dimensions, scene);
  }

  const cushioned = /seat|chair.*back|backpack|cushion/i.test(name);
  const radiusLimit = cushioned ? 0.24 : 0.16;
  const half = [width / 2, height / 2, depth / 2];
  // Independent radii give thin tabletops and backrests rounded silhouettes too.
  const radii = half.map((extent) => Math.min(radiusLimit, extent * (cushioned ? 0.72 : 0.48)));
  const key = [...half, ...radii].join(":");
  let cache = geometryCache.get(scene);
  if (!cache) {
    cache = new Map();
    geometryCache.set(scene, cache);
  }
  let geometry = cache.get(key);
  if (!geometry || geometry.isDisposed()) {
    geometry = new Geometry(`softBox:${key}`, scene, buildRoundedBox(half, radii));
    cache.set(key, geometry);
  }
  const mesh = new Mesh(name, scene);
  geometry.applyToMesh(mesh);
  return mesh;
}

function buildRoundedBox(half: number[], radii: number[]): VertexData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  const steps = 3;
  const coordinates = half.map((extent, axis) => {
    const radius = radii[axis]!;
    const edge = Array.from({ length: steps + 1 }, (_, i) =>
      -extent + radius * (1 - Math.cos(i * Math.PI / (2 * steps))));
    return [...edge, ...edge.map((value) => -value).reverse()];
  });

  for (let axis = 0; axis < 3; axis += 1) {
    const uAxis = (axis + 1) % 3;
    const vAxis = (axis + 2) % 3;
    const uCoordinates = coordinates[uAxis]!;
    const vCoordinates = coordinates[vAxis]!;
    for (const sign of [-1, 1]) {
      const start = positions.length / 3;
      for (const v of vCoordinates) {
        for (const u of uCoordinates) {
          const point = [0, 0, 0];
          point[axis] = half[axis]! * sign;
          point[uAxis] = u;
          point[vAxis] = v;
          const center = point.map((value, i) =>
            Math.max(-half[i]! + radii[i]!, Math.min(half[i]! - radii[i]!, value)));
          const direction = Vector3.FromArray(point.map((value, i) => (value - center[i]!) / radii[i]!)).normalize();
          const components = direction.asArray();
          positions.push(...center.map((value, i) => value + components[i]! * radii[i]!));
          const normal = Vector3.FromArray(components.map((value, i) => value / radii[i]!)).normalize();
          normals.push(normal.x, normal.y, normal.z);
          uvs.push(u / (2 * half[uAxis]!) + 0.5, v / (2 * half[vAxis]!) + 0.5);
        }
      }
      const stride = uCoordinates.length;
      for (let row = 0; row < vCoordinates.length - 1; row += 1) {
        for (let column = 0; column < stride - 1; column += 1) {
          const a = start + row * stride + column;
          const b = a + 1;
          const c = a + stride;
          // Babylon's left-handed front-face winding.
          if (sign > 0) indices.push(a, c, b, b, c, c + 1);
          else indices.push(a, b, c, b, c + 1, c);
        }
      }
    }
  }
  const data = new VertexData();
  data.positions = positions;
  data.normals = normals;
  data.indices = indices;
  data.uvs = uvs;
  return data;
}
