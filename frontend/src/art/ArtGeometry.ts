/** Authoring geometry shared by the GLB exporter and the exploration art layer. */
export interface ArtMeshData { positions: number[]; normals: number[]; uvs: number[]; indices: number[] }
export type ProfileRing = readonly [y: number, halfWidth: number, halfDepth: number, x?: number, z?: number, exponent?: number];
export type Point3 = readonly [number, number, number];
const signPow = (value: number, power: number) => Math.sign(value) * Math.pow(Math.abs(value), power);
export function finishArt(positions: number[], indices: number[], uvs: number[] = []): ArtMeshData {
  const normals = Array<number>(positions.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3;
    const ab = [positions[b]! - positions[a]!, positions[b + 1]! - positions[a + 1]!, positions[b + 2]! - positions[a + 2]!];
    const ac = [positions[c]! - positions[a]!, positions[c + 1]! - positions[a + 1]!, positions[c + 2]! - positions[a + 2]!];
    const n = [ab[2]! * ac[1]! - ab[1]! * ac[2]!, ab[0]! * ac[2]! - ab[2]! * ac[0]!, ab[1]! * ac[0]! - ab[0]! * ac[1]!];
    for (const v of [a, b, c]) for (let axis = 0; axis < 3; axis++) normals[v + axis]! += n[axis]!;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i]!, normals[i + 1]!, normals[i + 2]!) || 1;
    normals[i]! /= length; normals[i + 1]! /= length; normals[i + 2]! /= length;
  }
  if (!uvs.length) for (let i = 0; i < positions.length / 3; i++) uvs.push(positions[i * 3]!, positions[i * 3 + 1]!);
  return { positions, indices, normals, uvs };
}
/** Profiled shell: continuous silhouette, changing shoulders/waist and cross-section. */
export function loftShell(profile: readonly ProfileRing[], sides = 32): ArtMeshData {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row < profile.length; row++) {
    const [y, width, depth, x = 0, z = 0, exponent = 2.8] = profile[row]!;
    for (let side = 0; side <= sides; side++) {
      const angle = side / sides * Math.PI * 2;
      positions.push(x + signPow(Math.cos(angle), 2 / exponent) * width, y, z + signPow(Math.sin(angle), 2 / exponent) * depth);
      uvs.push(side / sides, row / (profile.length - 1));
      if (row && side < sides) { const a = (row - 1) * (sides + 1) + side, b = a + 1, c = a + sides + 1; indices.push(a, b, c, b, c + 1, c); }
    }
  }
  for (const end of [0, profile.length - 1]) {
    const ring = profile[end]!, center = positions.length / 3;
    positions.push(ring[3] ?? 0, ring[0], ring[4] ?? 0); uvs.push(.5, .5);
    for (let side = 0; side < sides; side++) {
      const a = end * (sides + 1) + side;
      if (end === 0) indices.push(center, a + 1, a); else indices.push(center, a, a + 1);
    }
  }
  return finishArt(positions, indices, uvs);
}
/** Closed swept tube used for continuous chair frames, piping, fingers and decorative arcs. */
export function sweepTube(path: readonly Point3[], radius: number, sides = 8, flatten = 1): ArtMeshData {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (let row = 0; row < path.length; row++) {
    const p = path[row]!, previous = path[Math.max(0, row - 1)]!, next = path[Math.min(path.length - 1, row + 1)]!;
    const tangent = next.map((value, i) => value - previous[i]!);
    let normal = Math.abs(tangent[1]!) < Math.hypot(...tangent) * .9 ? [-tangent[2]!, 0, tangent[0]!] : [tangent[1]!, -tangent[0]!, 0];
    const nLength = Math.hypot(...normal) || 1; normal = normal.map(value => value / nLength);
    let binormal = [tangent[1]! * normal[2]! - tangent[2]! * normal[1]!, tangent[2]! * normal[0]! - tangent[0]! * normal[2]!, tangent[0]! * normal[1]! - tangent[1]! * normal[0]!];
    const bLength = Math.hypot(...binormal) || 1; binormal = binormal.map(value => value / bLength);
    for (let side = 0; side <= sides; side++) {
      const a = side / sides * Math.PI * 2;
      for (let axis = 0; axis < 3; axis++) positions.push(p[axis]! + radius * (Math.cos(a) * normal[axis]! + Math.sin(a) * binormal[axis]! * flatten));
      uvs.push(side / sides, row / Math.max(1, path.length - 1));
      if (row && side < sides) { const a = (row - 1) * (sides + 1) + side, c = a + sides + 1; indices.push(a, c, a + 1, a + 1, c, c + 1); }
    }
  }
  return finishArt(positions, indices, uvs);
}
/** Rounded perimeter with actual rounded corners, sampled for panels and structural portals. */
export function roundedPath(width: number, height: number, radius: number, z = 0, cornerSteps = 8): Point3[] {
  const result: Point3[] = [];
  const centers = [[width / 2 - radius, height / 2 - radius], [-width / 2 + radius, height / 2 - radius], [-width / 2 + radius, -height / 2 + radius], [width / 2 - radius, -height / 2 + radius]];
  centers.forEach(([x, y], corner) => {
    for (let i = 0; i <= cornerSteps; i++) { const angle = corner * Math.PI / 2 + i / cornerSteps * Math.PI / 2; result.push([x! + Math.cos(angle) * radius, y! + Math.sin(angle) * radius, z]); }
  });
  result.push(result[0]!); return result;
}
/** Thin product-design panel; bevel rings follow a custom outline rather than a box primitive. */
export function contourPanel(outline: readonly (readonly [number, number])[], depth: number, bevel = .025): ArtMeshData {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const layers = [[depth / 2, .94], [depth / 2 - bevel, 1], [-depth / 2 + bevel, 1], [-depth / 2, .94]];
  const count = outline.length;
  layers.forEach(([z, scale], row) => {
    outline.forEach(([x, y], i) => {
      positions.push(x * scale!, y * scale!, z!); uvs.push(x + .5, y + .5);
      if (row) { const a = (row - 1) * count + i, b = (row - 1) * count + (i + 1) % count, c = row * count + i, d = row * count + (i + 1) % count; indices.push(a, b, c, b, d, c); }
    });
  });
  for (const row of [0, 3]) {
    const center = positions.length / 3; positions.push(0, 0, layers[row]![0]!); uvs.push(.5, .5);
    for (let i = 0; i < count; i++) { const a = row * count + i, b = row * count + (i + 1) % count; if (row === 0) indices.push(center, b, a); else indices.push(center, a, b); }
  }
  return finishArt(positions, indices, uvs);
}
export function ovalOutline(width: number, height: number, exponent = 3, segments = 40): [number, number][] {
  return Array.from({ length: segments }, (_, i) => { const a = i / segments * Math.PI * 2; return [signPow(Math.cos(a), 2 / exponent) * width / 2, signPow(Math.sin(a), 2 / exponent) * height / 2]; });
}
export function transformArt(data: ArtMeshData, position: Point3 = [0, 0, 0], scale: Point3 = [1, 1, 1], rotateX = 0): ArtMeshData {
  const positions: number[] = [];
  for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i]! * scale[0], y = data.positions[i + 1]! * scale[1], z = data.positions[i + 2]! * scale[2];
    positions.push(x + position[0], y * Math.cos(rotateX) - z * Math.sin(rotateX) + position[1], y * Math.sin(rotateX) + z * Math.cos(rotateX) + position[2]);
  }
  return finishArt(positions, [...data.indices], [...data.uvs]);
}
export function mergeArt(parts: readonly ArtMeshData[]): ArtMeshData {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (const part of parts) { const offset = positions.length / 3; positions.push(...part.positions); indices.push(...part.indices.map(i => i + offset)); uvs.push(...part.uvs); }
  return finishArt(positions, indices, uvs);
}
