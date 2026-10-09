import { numbered, syllables } from './pinyin.js';

/* ===== Ключи звуковых файлов =====
   Один и тот же ключ считают сайт (lib/audio.js) и сборщик звука (scripts/audio-list.mjs), поэтому он здесь.
   s:<слог с цифрой тона> — запись слога носителем: s:ma1, s:lv4;
   t:<иероглифы без пробелов и знаков препинания> — слово или фраза: t:登机口在哪儿. */

const PUNCT = /[\s，。？！、；：…,.?!;:“”"'‘’（）()·—\-~～]/g;
export const textKey = zh => `t:${String(zh || '').replace(PUNCT, '')}`;
export function sylKey(py) {
  const s = py ? syllables(py) : null;
  if (!s || s.length !== 1 || s[0].erhua) return null;
  const n = numbered(py);
  return n ? `s:${n}` : null;
}
/* Ключи по порядку предпочтения: отдельный слог — запись слога, иначе — слово или фраза */
export function keysFor({ zh, py }) {
  const out = [];
  const s = sylKey(py);
  if (s) out.push(s);
  if (zh && textKey(zh) !== 't:') out.push(textKey(zh));
  return out;
}
