/* Проверка языковых треков: node scripts/validate-lang.mjs
   Ищет опечатки в пиньине, расхождение числа иероглифов и слогов, ссылки на несуществующие фразы
   и собирает каждый урок по нескольку раз, проверяя, что у каждого задания есть верный ответ. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import zh from '../src/data/lang/zh.js';
import { LETTERS, letterData } from '../src/data/lang/letters.js';
import { LEVEL_BY, TRACK_BY, levelsOf } from '../src/data/lang/meta.js';
import { buildLesson, buildPlacement, buildReview, charTable, indexTrack, isGraded, phrase } from '../src/lib/lang-engine.js';
import { hanziCount, parseSyllable, syllables } from '../src/lib/pinyin.js';

let n = 0, problems = [];
// данные о чертах иероглифов: пакет hanzi-writer-data (только для разработки, в сборку копируются нужные знаки)
const STROKES = dirname(createRequire(import.meta.url).resolve('hanzi-writer-data/package.json'));
const hasStrokes = ch => existsSync(join(STROKES, `${ch}.json`));
const ok = (cond, msg) => { n++; if (!cond) problems.push(msg); };

/* Слово: иероглифов столько же, сколько слогов (儿 после слога — эризация, отдельного слога нет) */
function checkWord(z, p, where) {
  const zc = z.replace(/[，。？！、；：…,.?!;:]/g, ''), pc = p.replace(/[，。？！、；：…,.?!;:]/g, '');
  if (!zc && !pc) return;
  if (/^[A-Za-z]+$/.test(zc)) { ok(zc === pc, `${where}: латиница должна совпадать «${z}» / «${p}»`); return; }
  const syl = syllables(pc);
  ok(syl !== null, `${where}: пиньинь не разбирается «${p}»`);
  if (!syl) return;
  const er = syl.filter(s => s.erhua).length, real = syl.length - er;
  ok(hanziCount(zc) === real + er, `${where}: «${z}» — ${hanziCount(zc)} иероглифов, «${p}» — ${real} слогов${er ? ` и ${er} эризация` : ''}`);
  ok(!er || zc.includes('儿'), `${where}: эризация без 儿 в «${z}»`);
}
function checkLine(z, p, where) {
  const zt = z.split(' '), pt = p.split(' ');
  ok(zt.length === pt.length, `${where}: слов ${zt.length} и ${pt.length}: «${z}» / «${p}»`);
  zt.forEach((w, k) => checkWord(w, pt[k] || '', `${where} [${w}]`));
}

function checkTrack(track) {
  const meta = TRACK_BY[track.code];
  ok(meta && meta.ready, `${track.code}: нет в meta.js`);
  const ids = new Set();
  [...track.phrases, ...track.signs].forEach(r => {
    ok(!ids.has(r[0]), `повтор id ${r[0]}`); ids.add(r[0]);
    ok(r.length >= 4 && r[3], `${r[0]}: нет перевода`);
    checkLine(r[1], r[2], r[0]);
  });
  const ix = indexTrack(track);
  // одинаковая запись у двух фраз запутает задания с выбором
  const zhSeen = {};
  Object.values(ix.phrases).forEach(p => { ok(!zhSeen[p.zh], `одинаковая запись ${p.zh}: ${zhSeen[p.zh]} и ${p.id}`); zhSeen[p.zh] = p.id; });

  ok(meta.units.length === track.units.length, `${track.code}: мини-курсов в meta.js ${meta.units.length}, в треке ${track.units.length}`);
  const lessonIds = new Set(), used = new Set();
  track.units.forEach((u, k) => {
    const m = meta.units[k] || [];
    ok(m[0] === u.id && m[1] === u.level && m[2] === u.lessons.length, `${u.id}: в meta.js ${m.join(',')}, в треке ${u.id},${u.level},${u.lessons.length}`);
    ok(LEVEL_BY[u.level], `${u.id}: неизвестный уровень ${u.level}`);
    ok(k === 0 || Object.keys(LEVEL_BY).indexOf(track.units[k - 1].level) <= Object.keys(LEVEL_BY).indexOf(u.level), `${u.id}: уровни идут не по порядку`);
    ok(u.lessons.at(-1).kind === 'scene', `${u.id}: последний урок должен быть сценарием или проверкой`);
    u.lessons.forEach(l => {
      ok(!lessonIds.has(l.id) && l.id.startsWith(`${u.id}-`), `урок ${l.id}: повтор или чужой префикс`); lessonIds.add(l.id);
      ok(l.title && l.goal, `${l.id}: нет названия или цели`);
      (l.ph || []).forEach(id => { ok(ix.phrases[id], `${l.id}: нет фразы ${id}`); ok(!used.has(id), `${l.id}: фраза ${id} уже вводилась в другом уроке`); used.add(id); });
      (l.syl || []).forEach(([z, p]) => { const s = syllables(p); ok(hanziCount(z) === 1 && s && s.length === 1 && parseSyllable(p).tone > 0, `${l.id}: слог ${z} ${p}`); });
      (l.words || []).forEach(([z, p]) => checkWord(z, p.replace(/ /g, ''), `${l.id} слово`));
      (l.sound || []).forEach(([z, p, others]) => { ok(hanziCount(z) === 1 && syllables(p)?.length === 1, `${l.id}: звук ${z}`); others.forEach(o => ok(syllables(o)?.length === 1 && o !== p, `${l.id}: вариант ${o}`)); });
      (l.dialog || []).forEach((line, j) => {
        const where = `${l.id} реплика ${j + 1}`;
        if (line[0] === 'them') { checkLine(line[1], line[2], where); ok(line[3], `${where}: нет перевода`); return; }
        ok(ix.phrases[line[1]], `${where}: нет фразы ${line[1]}`);
        line[2].forEach(id => ok(ix.phrases[id] && id !== line[1], `${where}: неверный вариант ${id}`));
        ok(new Set([line[1], ...line[2]].map(id => ix.phrases[id] && ix.phrases[id].zh)).size === 3, `${where}: варианты совпадают`);
      });
      if (l.card) ok(l.card.t && l.card.x && (!l.card.src || /^https:\/\//.test(l.card.src.url)), `${l.id}: карточка`);
      (l.write || []).forEach(([z, p, ru]) => {
        const s = syllables(p);
        ok(hanziCount(z) === 1 && [...z].length === 1 && s && s.length === 1 && ru, `${l.id}: знак для прописей ${z} ${p}`);
        ok(hasStrokes(z), `${l.id}: нет данных о чертах для ${z}`);
      });
      if (l.writeMix) ok(u.lessons.some(x => (x.write || []).length), `${l.id}: проверка прописей без знаков`);
    });
  });
  track.before.forEach((c, k) => ok(c.t && c.x && c.src && /^https:\/\//.test(c.src.url) && c.checked, `перед поездкой ${k + 1}`));
  // знаки для страницы «Прописи»: у каждого есть данные о чертах
  const table = charTable(ix), seenChars = new Set();
  table.forEach(g => g.chars.forEach(c => {
    ok(!seenChars.has(c.zh), `прописи: знак ${c.zh} дважды`); seenChars.add(c.zh);
    ok(hasStrokes(c.zh), `прописи: нет данных о чертах для ${c.zh}`);
    ok(c.py && (c.ru || c.words.length), `прописи: у знака ${c.zh} нет чтения или примера`);
  }));
  // проверка уровня: на каждый уровень хватает фраз
  levelsOf(track.code).forEach(lv => {
    for (const audio of [true, false]) {
      const tasks = buildPlacement(ix, lv.id, { audio });
      ok(tasks.length === 6, `проверка уровня ${lv.id}: ${tasks.length} заданий`);
      tasks.forEach((t, k) => checkTask(t, `проверка уровня ${lv.id}#${k} ${t.type}`));
    }
  });
  // каждая фраза входит в какой-то урок, иначе её не встретить
  Object.keys(ix.phrases).forEach(id => ok(used.has(id), `фраза ${id} не входит ни в один урок`));

  // сборка уроков: с голосом и без, на разных зёрнах
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const l of ix.lessons) {
    for (const audio of [true, false]) {
      for (let round = 0; round < 6; round++) {
        const tasks = buildLesson(ix, l.id, { audio, rnd });
        const graded = tasks.filter(isGraded);
        ok(graded.length >= 4, `${l.id}: всего ${graded.length} заданий с ответом`);
        tasks.forEach((t, k) => checkTask(t, `${l.id}#${k} ${t.type}${audio ? '' : ' без голоса'}`));
      }
    }
  }
  // повторение: из всех фраз трека
  const mine = Object.fromEntries(Object.keys(ix.phrases).map((id, k) => [id, { b: 0, due: k, at: k }]));
  for (let round = 0; round < 10; round++) {
    const { tasks, ids: got } = buildReview(ix, mine, { audio: round % 2 === 0, rnd, now: 1e12 });
    ok(got.length === 10 && tasks.length >= 10, `повторение: ${got.length} фраз`);
    tasks.forEach((t, k) => checkTask(t, `повторение#${k} ${t.type}`));
  }
  return ix;
}

function checkTask(t, where) {
  if (['meaning', 'reverse', 'listen', 'reply'].includes(t.type)) {
    ok(t.options.length >= 3 && t.correct >= 0 && t.options[t.correct].id === t.p.id, `${where}: верный вариант`);
    const key = t.type === 'meaning' ? o => o.ru : o => o.zh;
    ok(new Set(t.options.map(key)).size === t.options.length, `${where}: варианты совпадают`);
  } else if (['tone', 'toneRead', 'toneWord', 'toneWordRead', 'sound'].includes(t.type)) {
    ok(t.options.length >= 3 && t.correct >= 0 && t.correct < t.options.length && new Set(t.options).size === t.options.length, `${where}: варианты тона`);
  } else if (t.type === 'tiles') {
    const bank = t.bank.map(b => b.zh);
    ok(t.answer.length >= 2 && t.answer.every(w => bank.includes(w)), `${where}: плитки`);
    ok(new Set(t.bank.map(b => b.k)).size === t.bank.length, `${where}: ключи плиток`);
  } else if (t.type === 'write') {
    ok(t.ch && [...t.ch.zh].length === 1 && ['trace', 'memory'].includes(t.mode), `${where}: прописи`);
  } else if (t.type === 'pairs') {
    ok(t.items.length >= 2 && new Set(t.items.map(p => p.ru)).size === t.items.length && new Set(t.items.map(p => p.zh)).size === t.items.length, `${where}: пары`);
  }
}

checkTrack(zh);
// латиница для прописей: у каждой буквы есть черты, средние линии внутри поля и контур
LETTERS.forEach(ch => {
  const d = letterData(ch);
  ok(d && d.strokes.length && d.strokes.length === d.medians.length, `буква ${ch}: черты`);
  if (!d) return;
  d.medians.forEach((m, k) => {
    ok(m.length >= 2 && m.every(([x, y]) => x >= 0 && x <= 1024 && y >= -124 && y <= 900), `буква ${ch}, черта ${k + 1}: точки вне поля`);
    ok(/^M [\d.-]+ [\d.-]+( L [\d.-]+ [\d.-]+)+ Z$/.test(d.strokes[k]), `буква ${ch}, черта ${k + 1}: контур`);
  });
});
// разбор строки: слова и плитки
const p = phrase(['x', '我 要 这个。', 'wǒ yào zhège.', 'Мне вот это.']);
assert.equal(p.zh, '我要这个。'); assert.equal(p.py, 'wǒ yào zhège.'); assert.deepEqual(p.tiles.map(t => t.zh), ['我', '要', '这个']);

if (problems.length) {
  console.log(`Языковые треки: ${problems.length} ошибок из ${n} проверок`);
  [...new Set(problems)].slice(0, 60).forEach(x => console.log('  ✗', x));
  process.exit(1);
}
console.log(`Языковые треки: ${n} проверок пройдено`);
