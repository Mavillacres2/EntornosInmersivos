import { describe, expect, it } from 'vitest';
import { Vector3 } from '@babylonjs/core';
import { contourPanel, loftShell, ovalOutline, roundedPath, sweepTube } from '../../art/ArtGeometry';

describe('authored art geometry',()=>{
  it.each([
    loftShell([[0,.3,.2],[.1,.5,.3],[.7,.4,.25],[1,.2,.1]],24),
    contourPanel(ovalOutline(1,.6,3.3),.08,.015),
    sweepTube(roundedPath(3,2,.4),.08,8)
  ])('has valid bounds, indices and finite normalized lighting data',data=>{
    expect(data.positions.length).toBe(data.normals.length);expect(data.uvs.length).toBe(data.positions.length/3*2);
    expect(data.indices.every(index=>Number.isInteger(index)&&index>=0&&index<data.positions.length/3)).toBe(true);
    expect(data.positions.every(Number.isFinite)).toBe(true);
    for(let i=0;i<data.normals.length;i+=3)expect(Vector3.FromArray(data.normals,i).length()).toBeCloseTo(1,4);
  });
  it('keeps bevel faces and caps in the same Babylon front-face convention',()=>{
    const data=contourPanel(ovalOutline(1,.6,3.3),.08,.015);
    for(let i=0;i<data.indices.length;i+=3){
      const a=Vector3.FromArray(data.positions,data.indices[i]!*3),b=Vector3.FromArray(data.positions,data.indices[i+1]!*3),c=Vector3.FromArray(data.positions,data.indices[i+2]!*3);
      const normals=Vector3.FromArray(data.normals,data.indices[i]!*3).add(Vector3.FromArray(data.normals,data.indices[i+1]!*3)).add(Vector3.FromArray(data.normals,data.indices[i+2]!*3));
      expect(Vector3.Dot(Vector3.Cross(b.subtract(a),c.subtract(a)),normals)).toBeLessThan(0);
    }
  });
});
