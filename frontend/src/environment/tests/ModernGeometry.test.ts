import { afterEach, describe, expect, it } from "vitest";
import { NullEngine, Scene, Vector3, VertexBuffer } from "@babylonjs/core";
import { createSoftBox } from "../ModernGeometry";

const engines: NullEngine[] = [];
function createScene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}
afterEach(() => engines.splice(0).forEach((engine) => engine.dispose()));

describe("rounded scenario furniture", () => {
  it.each([
    { width: 1.8, height: 0.16, depth: 0.9 },
    { width: 0.92, height: 0.9, depth: 0.12 },
    { width: 0.08, height: 0.5, depth: 0.08 }
  ])("preserves outer dimensions and has outward normals for %o", (dimensions) => {
    const mesh = createSoftBox("deskTop", dimensions, createScene());
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind)!;
    const bounds = mesh.getBoundingInfo().boundingBox;
    expect(bounds.extendSize.x * 2).toBeCloseTo(dimensions.width);
    expect(bounds.extendSize.y * 2).toBeCloseTo(dimensions.height);
    expect(bounds.extendSize.z * 2).toBeCloseTo(dimensions.depth);
    for (let i = 0; i < positions.length; i += 3) {
      const point = Vector3.FromArray(positions, i);
      const normal = Vector3.FromArray(normals, i);
      expect(normal.length()).toBeCloseTo(1);
      expect(Vector3.Dot(point, normal)).toBeGreaterThan(0);
    }
    const indices = mesh.getIndices()!;
    for (let i = 0; i < indices.length; i += 3) {
      const a = Vector3.FromArray(positions, indices[i]! * 3);
      const b = Vector3.FromArray(positions, indices[i + 1]! * 3);
      const c = Vector3.FromArray(positions, indices[i + 2]! * 3);
      const normal = Vector3.FromArray(normals, indices[i]! * 3);
      const cross = Vector3.Cross(b.subtract(a), c.subtract(a));
      expect(cross.lengthSquared()).toBeGreaterThan(0);
      expect(Vector3.Dot(cross, normal)).toBeLessThan(0);
    }
  });

  it("shares geometry for repeated furniture while keeping transforms independent", () => {
    const scene = createScene();
    const dimensions = { width: 1.8, height: 0.16, depth: 0.9 };
    const first = createSoftBox("desk1Top", dimensions, scene);
    const second = createSoftBox("desk2Top", dimensions, scene);
    expect(first.geometry).toBe(second.geometry);
    first.position.x = 3;
    expect(second.position.x).toBe(0);
  });

  it("retains simple closed architectural surfaces", () => {
    const wall = createSoftBox("museumFrontWall", { width: 15, height: 4.55, depth: 0.22 }, createScene());
    expect(wall.getTotalVertices()).toBe(24);
    expect(wall.getTotalIndices()).toBe(36);
  });
});
