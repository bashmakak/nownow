/* Собирает сводку по полным версиям уроков: время, заголовки блоков, карточку итога, источники.
   Сайт берёт её из src/data/full-meta.js, а сам текст полной версии подгружает только при открытии урока.
   Запускается сам перед npm run dev и npm run build. */
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { describe } from '../src/data/timing.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'src/data/full');
const meta = {};
for (const file of readdirSync(dir).filter(f => f.endsWith('.js')).sort()) {
  const slug = file.replace(/\.js$/, '');
  const L = (await import(pathToFileURL(path.join(dir, file)).href)).default;
  if (L.slug !== slug) throw new Error(`${file}: slug в файле («${L.slug}») должен совпадать с именем файла`);
  meta[slug] = { ...describe(L), sources: L.sources || null };
}
writeFileSync(path.join(root, 'src/data/full-meta.js'),
  `/* Файл создаётся командой npm run meta из папки full. Руками не править. */\nexport default ${JSON.stringify(meta, null, 1)};\n`);
console.log(`Полных версий: ${Object.keys(meta).length}`);
