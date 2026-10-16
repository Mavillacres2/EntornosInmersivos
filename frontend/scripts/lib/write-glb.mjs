import fs from 'node:fs';
/** Small offline glTF 2.0 writer. Input meshes use Babylon's LH convention. */
export class GlbAuthor {
  json = { asset: { version: '2.0', generator: 'NeuroExplora original mesh authoring v2', copyright: 'Original assets authored for this project; see ASSET_SOURCES.md' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }], animations: [], extensionsUsed: ['KHR_materials_unlit'] };
  chunks = []; offset = 0; groups = new Map(); pending = [];
  accessor(values, components, type = 5126, target) {
    const array = type === 5123 ? new Uint16Array(values) : type === 5125 ? new Uint32Array(values) : new Float32Array(values);
    const bytes = Buffer.from(array.buffer); const pad = (4 - bytes.length % 4) % 4;
    const view = this.json.bufferViews.length;
    this.json.bufferViews.push({ buffer: 0, byteOffset: this.offset, byteLength: bytes.length, ...(target ? { target } : {}) });
    this.chunks.push(bytes, Buffer.alloc(pad)); this.offset += bytes.length + pad;
    const min = Array(components).fill(Infinity), max = Array(components).fill(-Infinity);
    values.forEach((value, index) => { const axis = index % components; min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
    const accessor = this.json.accessors.length;
    this.json.accessors.push({ bufferView: view, componentType: type, count: values.length / components, type: ({ 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' })[components], min, max });
    return accessor;
  }
  material(name, hex, roughness = .5, metallic = 0, unlit = false) {
    const rgb = hex.match(/[a-f\d]{2}/gi).map(value => { const c = parseInt(value, 16) / 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
    const index = this.json.materials.length;
    this.json.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], roughnessFactor: roughness, metallicFactor: metallic }, ...(unlit ? { extensions: { KHR_materials_unlit: {} } } : {}) });
    return index;
  }
  node(name, parent = null, position = [0, 0, 0]) {
    const index = this.json.nodes.length; this.json.nodes.push({ name, translation: [position[0], position[1], -position[2]], children: [] });
    if (parent === null) this.json.scenes[0].nodes.push(index); else this.json.nodes[parent].children.push(index);
    return index;
  }
  add(name, data, material, parent, morph = null) {
    const key = `${parent}:${material}`;
    const shared = !morph ? this.groups.get(key) : null;
    if (shared) {
      const offset = shared.data.positions.length / 3;
      shared.data.positions.push(...data.positions); shared.data.normals.push(...data.normals); shared.data.uvs.push(...data.uvs);
      shared.data.indices.push(...data.indices.map(index => index + offset));
      this.json.nodes[shared.node].extras.features.push(name); return shared.node;
    }
    const node = this.node(name, parent), mesh = this.json.meshes.length;
    this.json.nodes[node].mesh = mesh; this.json.nodes[node].extras = { features: [name] };
    this.json.meshes.push(null);
    const pending = { name, data, material, parent, morph, node, mesh }; this.pending.push(pending);
    if (!morph) this.groups.set(key, pending);
    return node;
  }
  flushMesh({ name, data, material, morph, mesh }) {
    const flipZ = values => values.map((value, i) => i % 3 === 2 ? -value : value);
    const primitive = { attributes: { POSITION: this.accessor(flipZ(data.positions), 3, 5126, 34962), NORMAL: this.accessor(flipZ(data.normals), 3, 5126, 34962), TEXCOORD_0: this.accessor(data.uvs, 2, 5126, 34962) }, indices: this.accessor(data.indices, 1, data.positions.length / 3 < 65536 ? 5123 : 5125, 34963), material };
    const morphs = morph ? (Array.isArray(morph) ? morph : [morph]) : [];
    if (morphs.length) primitive.targets = morphs.map(shape=>({ POSITION: this.accessor(flipZ(shape.positions.map((value, i) => value - data.positions[i])), 3, 5126, 34962) }));
    this.json.meshes[mesh] = { name, primitives: [primitive], ...(morphs.length ? { weights: morphs.map(()=>0), extras: { targetNames: ['mouthOpen','mouthRound','mouthWide'].slice(0,morphs.length) } } : {}) };
  }
  clip(name, jointTracks, duration = 2) {
    const samplers = [], channels = [];
    for (const { node, poses } of jointTracks) {
      const input = this.accessor(poses.map(pose => pose[0] * duration), 1);
      const output = this.accessor(poses.flatMap(([, x = 0, y = 0, z = 0]) => {
        const sx = Math.sin(x / 2), cx = Math.cos(x / 2), sy = Math.sin(y / 2), cy = Math.cos(y / 2), sz = Math.sin(z / 2), cz = Math.cos(z / 2);
        return [-(sx * cy * cz - cx * sy * sz), -(cx * sy * cz + sx * cy * sz), cx * cy * sz - sx * sy * cz, cx * cy * cz + sx * sy * sz];
      }), 4);
      channels.push({ sampler: samplers.length, target: { node, path: 'rotation' } }); samplers.push({ input, output, interpolation: 'LINEAR' });
    }
    this.json.animations.push({ name, samplers, channels });
  }
  write(filename) {
    this.pending.forEach(part => this.flushMesh(part));
    this.json.buffers[0].byteLength = this.offset;
    const jsonBytes = Buffer.from(JSON.stringify(this.json));
    const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc((4 - jsonBytes.length % 4) % 4, 32)]);
    const binary = Buffer.concat(this.chunks);
    const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + paddedJson.length + binary.length, 8);
    const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(paddedJson.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
    const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4);
    fs.writeFileSync(filename, Buffer.concat([header, jsonHeader, paddedJson, binHeader, binary]));
  }
}
