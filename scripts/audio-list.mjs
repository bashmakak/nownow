/* Список всего, что должно звучать в треке: node scripts/audio-list.mjs > список.json
   Нужен сборщику звука (scripts/audio/make_audio.py) и проверке данных: у каждого пункта должен быть файл.
   Поля: key — ключ (lib/audio-keys.js), zh — текст для синтеза, py — пиньинь, role — чья реплика
   (me — фраза ученика, them — собеседник в сценарии, word — слово, syl — слог). */
import zh from '../src/data/lang/zh.js';
import { charTable, indexTrack } from '../src/lib/lang-engine.js';
import { keysFor, sylKey, textKey } from '../src/lib/audio-keys.js';

export function audioNeeds(track) {
  const ix = indexTrack(track), need = new Map();
  const add = (zhText, py, role) => {
    const k = keysFor({ zh: zhText, py })[0];
    if (!k || need.has(k)) return;
    need.set(k, { key: k, zh: zhText || '', py: py || '', role });
  };
  const syl = py => { if (sylKey(py)) add('', py, 'syl'); };
  Object.values(ix.phrases).forEach(p => add(p.zh, p.py, 'me'));
  ix.lessons.forEach(l => {
    (l.dialog || []).forEach(line => { if (line[0] === 'them') add(line[1].replace(/ /g, ''), line[2], 'them'); });
    (l.syl || []).forEach(([z, py]) => syl(py));
    (l.words || []).forEach(([z, py]) => add(z, py.replace(/ /g, '') === py ? py : py, 'word'));
    (l.sound || []).forEach(([z, py, others]) => { syl(py); others.forEach(syl); });
    (l.sounds || []).forEach(([, , ex]) => ex.forEach(syl));
    (l.repeat || []).forEach(syl);
    (l.pick || []).forEach(([py, others]) => { syl(py); others.forEach(syl); });
    (l.minimal || []).forEach(pair => pair.forEach(syl));
    (l.build || []).forEach(syl);
    (l.write || []).forEach(([z, py]) => (sylKey(py) ? syl(py) : add(z, py, 'word')));
    (l.rad || []).forEach(([, , , ex]) => ex.forEach(([z, py]) => (sylKey(py) ? syl(py) : add(z, py, 'word'))));
  });
  // прописи: знак озвучивается слогом, а если тон лёгкий — самим знаком
  charTable(ix).forEach(g => g.chars.forEach(c => (sylKey(c.py) ? syl(c.py) : add(c.zh, c.py, 'word'))));
  // слова в заданиях на тоны: если в слове один слог, нужен и ключ по тексту (так их ищет сайт без пиньиня)
  return [...need.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(audioNeeds(zh), null, 0));
}
export { textKey };
