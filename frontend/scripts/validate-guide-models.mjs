import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','public/assets/models/guides-v2');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
for(const entry of manifest.models){
  const file=fs.readFileSync(path.join(root,entry.file));
  if(file.readUInt32LE(0)!==0x46546c67||file.readUInt32LE(4)!==2||file.readUInt32LE(8)!==file.length)throw new Error(`Invalid GLB header: ${entry.file}`);
  const jsonSize=file.readUInt32LE(12),json=JSON.parse(file.toString('utf8',20,20+jsonSize));
  if(!['Idle','Greeting','Pointing'].every(name=>json.animations.some(clip=>clip.name===name)))throw new Error(`Missing animation: ${entry.file}`);
  const mouth=json.meshes.find(mesh=>mesh.name==='mouth');
  if(mouth?.primitives[0].targets?.length!==3)throw new Error(`Missing mouth blend shapes: ${entry.file}`);
  if(json.buffers.some(buffer=>buffer.uri)||json.images?.some(image=>image.uri?.startsWith('http')))throw new Error('Assets must be local and self-contained');
  for(const name of ['head','torso','leftArm','rightArm','leftForearm','rightForearm'])if(!json.nodes.some(node=>node.name===name))throw new Error(`Missing articulated joint: ${name}`);
  const vertices=json.meshes.reduce((sum,mesh)=>sum+json.accessors[mesh.primitives[0].attributes.POSITION].count,0);
  if(vertices!==entry.vertices||file.length!==entry.bytes)throw new Error(`Stale asset manifest: ${entry.file}`);
}
console.log('9 GLB originales verificados: articulaciones, clips, morfologías y tamaños.');
