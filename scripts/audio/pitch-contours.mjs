/* Рисунки тона записей носителя для тренажёра тонов: node scripts/audio/pitch-contours.mjs
   Для каждого слога (cmn-*.mp3) — те же 24 точки в полутонах от начала, что строит тренажёр по голосу
   ученика (src/lib/pitch.js). Результат — public/audio/zh/pitch.json, сайт скачивает его только в тренажёре.
   Нужен ffmpeg. */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { contourOf, track } from '../../src/lib/pitch.js';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'public', 'audio', 'zh');
const out = {};
for (const f of fs.readdirSync(dir).filter(x => /^cmn-[a-zv]+[1-4]\.mp3$/.test(x)).sort()) {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(dir, f), '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'], { maxBuffer: 1 << 26 });
  const c = contourOf(track(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4), 16000));
  if (c && c.st) out[f.slice(4, -4)] = c.st;
}
fs.writeFileSync(path.join(dir, 'pitch.json'), JSON.stringify(out));
console.log('рисунков тона:', Object.keys(out).length);
