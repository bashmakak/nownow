/* Данные о чертах иероглифов для прописей: node scripts/strokes.mjs
   Копирует из пакета hanzi-writer-data файлы только тех знаков, что встречаются в треках, в public/strokes/<код>/,
   по одному файлу на знак (имя — код символа). Сайт скачивает файл, когда знак открывают в прописях,
   и ничего не запрашивает у сторонних серверов.

   Данные извлечены проектом Make Me a Hanzi из шрифтов Arphic и распространяются по лицензии
   Arphic Public License: файлы копируются без изменений, рядом кладётся текст лицензии (ARPHICPL.TXT).
   Папка public/strokes создаётся заново при каждой сборке и в репозиторий не попадает (.gitignore). */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zh from '../src/data/lang/zh.js';
import { charTable, indexTrack } from '../src/lib/lang-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = dirname(createRequire(import.meta.url).resolve('hanzi-writer-data/package.json'));
const hex = ch => ch.codePointAt(0).toString(16);

for (const track of [zh]) {
  const out = join(root, 'public', 'strokes', track.code);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const chars = new Set(charTable(indexTrack(track)).flatMap(g => g.chars.map(c => c.zh)));
  const missing = [];
  chars.forEach(ch => {
    const src = join(data, `${ch}.json`);
    if (existsSync(src)) copyFileSync(src, join(out, `${hex(ch)}.json`));
    else missing.push(ch);
  });
  copyFileSync(join(data, 'ARPHICPL.TXT'), join(out, 'ARPHICPL.TXT'));
  console.log(`Прописи (${track.code}): ${chars.size - missing.length} знаков${missing.length ? `, нет данных: ${missing.join(' ')}` : ''}`);
  if (missing.length) process.exitCode = 1;
}
