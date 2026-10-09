import { numbered, syllables } from './pinyin.js';

/* ===== Ключи звуковых файлов =====
   Один и тот же ключ считают сайт (lib/audio.js) и сборщик звука (scripts/audio-list.mjs), поэтому он здесь.
   s:<слог с цифрой тона> — запись слога носителем: s:ma1, s:lv4;
   x:<слог с цифрой тона> — учебная версия слога: медленнее и с более широким размахом тона (кнопка «медленно»);
   t:<иероглифы без пробелов и знаков препинания> — слово или фраза: t:登机口在哪儿. */

const PUNCT = /[\s，。？！、；：…,.?!;:“”"'‘’（）()·—\-~～]/g;
export const textKey = zh => `t:${String(zh || '').replace(PUNCT, '')}`;
export function sylKey(py) {
  const s = py ? syllables(py) : null;
  if (!s || s.length !== 1 || s[0].erhua) return null;
  const n = numbered(py);
  return n ? `s:${n}` : null;
}
/* Ключи по порядку предпочтения: отдельный слог — запись слога, иначе — слово или фраза.
   slow — сначала учебная версия слога, если она есть */
export function keysFor({ zh, py }, { slow = false } = {}) {
  const out = [];
  const s = sylKey(py);
  if (s && slow) out.push(`x:${s.slice(2)}`);
  if (s) out.push(s);
  if (zh && textKey(zh) !== 't:') out.push(textKey(zh));
  return out;
}
