import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = JSON.parse(fs.readFileSync(path.join(root, process.argv[2] ?? 'src/guides/narration.es.json'), 'utf8'));
const directory = path.join(root, 'public/assets/guides', script.version);
for (const clip of ['classroom', 'space', 'museum', 'host'].flatMap(world => script[world] ?? [])) {
  const bytes = fs.readFileSync(path.join(directory, `${clip.id}.wav`));
  if (bytes.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Expected RIFF WAV');
  let format, channels, rate, bits, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (id === 'fmt ') { format = bytes.readUInt16LE(start); channels = bytes.readUInt16LE(start + 2); rate = bytes.readUInt32LE(start + 4); bits = bytes.readUInt16LE(start + 14); }
    if (id === 'data') data = bytes.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (format !== 1 || bits !== 16 || !data || !rate || !channels) throw new Error(`Unsupported WAV: ${clip.id}`);
  const hz = 30, block = Math.round(rate / hz), frames = data.length / (2 * channels), rms = [];
  for (let frame = 0; frame < frames; frame += block) {
    let sum = 0, count = 0;
    for (let i = frame; i < Math.min(frame + block, frames); i++) for (let channel = 0; channel < channels; channel++) {
      const value = data.readInt16LE((i * channels + channel) * 2) / 32768;
      sum += value * value; count++;
    }
    rms.push(Math.sqrt(sum / count));
  }
  const peak = Math.max(...rms, 0.01);
  const values = rms.map(value => Number((value < 0.006 ? 0 : Math.min(1, value / peak * 1.4)).toFixed(3)));
  fs.writeFileSync(path.join(directory, `${clip.id}.envelope.json`), JSON.stringify({ hz: rate / block, duration: frames / rate, wavSHA256: crypto.createHash('sha256').update(bytes).digest('hex'), values }));
  console.log(`${clip.id}: ${(frames / rate).toFixed(2)} s`);
}
