import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = Buffer.from(fs.readFileSync(path.join(root, process.argv[2] ?? 'src/guides/narration.es.json'), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'));
const script = JSON.parse(source.toString('utf8'));
const directory = path.join(root, 'public/assets/guides', script.version);
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (manifest.sourceSHA256 !== hash(source) || manifest.version !== script.version || manifest.voice !== script.voice) throw new Error('Narration source/voice changed. Generate a NEW version and its audio.');
if(manifest.locale!==script.locale||!['es-EC','es-MX','es-CO','es-US','es-PE','es-AR','es-CL'].includes(manifest.locale))throw new Error('Expected a verified Latin-American voice, never es-ES');
const clips = ['classroom', 'space', 'museum', 'host'].flatMap(world => script[world] ?? []);
for (const clip of clips) {
  const entry = manifest.clips.find(item => item.id === clip.id);
  const audio = fs.readFileSync(path.join(directory, `${clip.id}.wav`));
  const envelope = JSON.parse(fs.readFileSync(path.join(directory, `${clip.id}.envelope.json`), 'utf8'));
  if (!entry || entry.text !== clip.text || hash(audio) !== entry.sha256 || envelope.wavSHA256 !== entry.sha256) throw new Error(`Audio integrity error: ${clip.id}`);
  if (!(envelope.hz > 0) || !envelope.values.length || !envelope.values.every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error(`Envelope error: ${clip.id}`);
  const timing=JSON.parse(fs.readFileSync(path.join(directory,`${clip.id}.timing.json`),'utf8').replace(/^\uFEFF/,''));
  if(timing.wavSHA256!==entry.sha256||!timing.visemes.length||timing.visemes.length!==entry.visemeCount||!timing.visemes.every((mark,index)=>mark.t>=0&&mark.t<=envelope.duration&&mark.id>=0&&mark.id<=21&&(index===0||mark.t>=timing.visemes[index-1].t)))throw new Error(`Speech mark integrity error: ${clip.id}`);
}
console.log(`${clips.length} audios y envolventes verificados: ${script.version}`);
