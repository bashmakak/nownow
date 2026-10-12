/* Проверка языковых треков: node scripts/validate-lang.mjs
   Ищет опечатки в пиньине, расхождение числа иероглифов и слогов, ссылки на несуществующие фразы
   и собирает каждый урок по нескольку раз, проверяя, что у каждого задания есть верный ответ. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import zh from '../src/data/lang/zh.js';
import fr from '../src/data/lang/fr.js';
import { LETTERS, letterData } from '../src/data/lang/letters.js';
import { audioNeeds, latinNeeds } from './audio-list.mjs';
import { FR_DEMOS, FR_VIEWS } from '../src/lib/fr-data.js';
import { LEVEL_BY, TRACK_BY, levelsOf } from '../src/data/lang/meta.js';
import { EXPLAIN, buildLesson, buildPlacement, buildReview, charTable, indexTrack, isGraded, linksOf, phrase, silentOf } from '../src/lib/lang-engine.js';
import { SYLLABLES, hanziCount, numbered, parseSyllable, splitSyllable, syllables } from '../src/lib/pinyin.js';
const root0 = join(dirname(new URL(import.meta.url).pathname), '..');

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
      (l.syl || []).forEach(([z, p]) => { const s = syllables(p); ok((z === '' || hanziCount(z) === 1) && s && s.length === 1 && parseSyllable(p).tone > 0, `${l.id}: слог ${z} ${p}`); });
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
      // вводный фонетический курс: каждый слог — настоящий слог путунхуа с тоном
      const syl1 = (py, where) => { const s = syllables(py); ok(s && s.length === 1 && !s[0].erhua && parseSyllable(py).tone > 0, `${where}: слог «${py}»`); };
      const DEMOS = [undefined, 'tones', 'pinyin', 'syllable', 'rows'];
      [...(l.intro || []), ...(l.rule ? [l.rule] : [])].forEach((r, k) => ok(r.t && r.x && DEMOS.includes(r.demo), `${l.id}: карточка ${k + 1} (схема «${r.demo}»)`));
      (l.tones || []).forEach(([tone, how, ex], k) => {
        ok(tone === k + 1 && how && ex.length >= 1, `${l.id}: тоны идут по порядку, ${tone}-й`);
        ex.forEach(x => { syl1(x, `${l.id} тон ${tone}`); ok(parseSyllable(x).tone === tone, `${l.id}: пример ${x} не ${tone}-го тона`); });
      });
      (l.marks || []).forEach(x => syl1(x, `${l.id} знак тона`));
      (l.speak || []).forEach(x => { syl1(x, `${l.id} скажите сами`); ok(existsSync(join(root0, 'public', 'audio', track.code, `cmn-${numbered(x)}.mp3`)), `${l.id}: для тренажёра нужна запись носителя ${x}`); });
      (l.sounds || []).forEach(([py, how, ex]) => { ok(py && how && ex.length >= 2, `${l.id}: звук ${py}`); ex.forEach(x => syl1(x, `${l.id} звук ${py}`)); });
      (l.repeat || []).forEach(x => syl1(x, `${l.id} повтор`));
      (l.pick || []).forEach(([py, others]) => { syl1(py, `${l.id} выбор`); others.forEach(o => syl1(o, `${l.id} выбор ${py}`)); ok(new Set([py, ...others]).size === others.length + 1, `${l.id}: варианты к ${py} совпадают`); });
      (l.minimal || []).forEach(([a, b]) => { syl1(a, `${l.id} пара`); syl1(b, `${l.id} пара`); ok(a !== b, `${l.id}: пара ${a}`); });
      (l.build || []).forEach(py => { syl1(py, `${l.id} диктант`); ok(splitSyllable(parseSyllable(py).base).initial, `${l.id}: в диктанте нужен слог с согласным: ${py}`); });
      (l.spell || []).forEach(([ask, right, wrong]) => ok(ask && right && wrong.length >= 2 && !wrong.includes(right) && new Set(wrong).size === wrong.length, `${l.id}: правило записи «${ask}»`));
      (l.rad || []).forEach(([z, ru, how, ex]) => {
        ok(hanziCount(z) === 1 && ru && ex.length >= 3, `${l.id}: ключ ${z}`);
        ex.forEach(([c, py, m]) => { ok(hanziCount(c) === 1 && syllables(py) && syllables(py).length === 1 && m, `${l.id}: пример ${c} к ключу ${z}`); ok(hasStrokes(c), `${l.id}: нет черт для ${c}`); });
      });
      if (u.level === 'a0') ok(!(l.ph || []).length && !l.dialog, `${l.id}: на уровне «С нуля» нет фраз — только звуки и письмо`);
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
  // звук: у всего, что звучит в уроках, есть файл (иначе пересоберите звук: scripts/audio/make_audio.py)
  const root = join(dirname(new URL(import.meta.url).pathname), '..');
  const needs = audioNeeds(track), man = track.audio || {};
  const lost = needs.filter(x => !man[x.key] || !existsSync(join(root, 'public', 'audio', track.code, man[x.key])));
  ok(!lost.length, `звук: нет файлов для ${lost.length} из ${needs.length}: ${lost.slice(0, 8).map(x => x.key).join(', ')}`);
  // у каждой записи слога носителем есть учебная версия (кнопка «медленно»)
  const noSlow = Object.entries(man).filter(([k, f]) => k.startsWith('s:') && f.startsWith('cmn-') && !(man[`x:${k.slice(2)}`] && existsSync(join(root, 'public', 'audio', track.code, man[`x:${k.slice(2)}`]))));
  ok(!noSlow.length, `звук: нет учебной версии для ${noSlow.length} слогов: ${noSlow.slice(0, 6).map(x => x[0]).join(', ')}`);
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
        const tasks = buildLesson(ix, l.id, { audio, mic: true, rnd });
        const graded = tasks.filter(isGraded);
        ok(graded.length >= 4, `${l.id}: всего ${graded.length} заданий с ответом`);
        tasks.forEach((t, k) => checkTask(t, `${l.id}#${k} ${t.type}${audio ? '' : ' без голоса'}`));
        // сначала объяснение, потом задания: ни одно знакомство со звуком или тоном не идёт после вопроса
        const firstQ = tasks.findIndex(isGraded), lastIntro = tasks.map(t => ['rule', 'toneIntro', 'soundIntro', 'repeat'].includes(t.type)).lastIndexOf(true);
        if (round === 0 && firstQ >= 0) ok(lastIntro < firstQ, `${l.id}: объяснение после задания (${tasks[lastIntro]?.type} после ${tasks[firstQ].type})`);
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


/* ---------- латиница (французский) ---------- */
const NBSP = ' ';
const BODY_ZONES = ['head', 'ear', 'teeth', 'throat', 'arm', 'belly', 'knee', 'foot'];
function checkFrText(t, where) {
  ok(typeof t === 'string' && t.trim() === t && !/ {2}/.test(t), `${where}: лишние пробелы «${t}»`);
  ok(!/ [?!:;»]/.test(t), `${where}: перед ? ! : ; нужен неразрывный пробел «${t}»`);
  ok(!/(^|[ ‿])‿|‿($|[ ‿])/.test(t), `${where}: дужка не между словами «${t}»`);
  ok(!/[一-鿿]/.test(t), `${where}: иероглифы во французском тексте`);
}
const frWord = (w, where) => { ok(typeof w === 'string' && w && !/[‿()]/.test(w), `${where}: слово «${w}»`); };
function checkLatinTrack(track) {
  const meta = TRACK_BY[track.code];
  ok(meta && meta.ready && meta.script === 'latin' && track.script === 'latin', `${track.code}: нет в meta.js или не латиница`);
  ok(track.inLang && track.lang, `${track.code}: нет inLang или lang`);
  const ids = new Set();
  [...track.phrases, ...track.signs].forEach(r => {
    ok(!ids.has(r[0]), `повтор id ${r[0]}`); ids.add(r[0]);
    ok(r.length >= 3 && r[2], `${r[0]}: нет перевода`);
    checkFrText(r[1], r[0]);
  });
  const ix = indexTrack(track);
  const seenText = {};
  Object.values(ix.phrases).forEach(p => { ok(!seenText[p.zh], `одинаковая запись ${p.zh}: ${seenText[p.zh]} и ${p.id}`); seenText[p.zh] = p.id; ok(p.tiles.length >= 1, `${p.id}: нет слов`); });
  ok(meta.units.length === track.units.length, `${track.code}: мини-курсов в meta.js ${meta.units.length}, в треке ${track.units.length}`);
  const lessonIds = new Set(), used = new Set();
  track.units.forEach((u, k) => {
    const m = meta.units[k] || [];
    ok(m[0] === u.id && m[1] === u.level && m[2] === u.lessons.length, `${u.id}: в meta.js ${m.join(',')}, в треке ${u.id},${u.level},${u.lessons.length}`);
    ok(LEVEL_BY[u.level] && u.icon && u.title && u.hook, `${u.id}: уровень, значок, название`);
    ok(k === 0 || Object.keys(LEVEL_BY).indexOf(track.units[k - 1].level) <= Object.keys(LEVEL_BY).indexOf(u.level), `${u.id}: уровни идут не по порядку`);
    ok(u.lessons.at(-1).kind === 'scene', `${u.id}: последний урок должен быть сценарием или проверкой`);
    u.lessons.forEach(l => {
      ok(!lessonIds.has(l.id) && l.id.startsWith(`${u.id}-`), `урок ${l.id}: повтор или чужой префикс`); lessonIds.add(l.id);
      ok(l.title && l.goal, `${l.id}: нет названия или цели`);
      (l.ph || []).forEach(id => { ok(ix.phrases[id], `${l.id}: нет фразы ${id}`); ok(!used.has(id), `${l.id}: фраза ${id} уже вводилась в другом уроке`); used.add(id); });
      [...(l.intro || []), ...(l.rule ? [l.rule] : [])].forEach((r, j) => {
        ok(r.t && r.x && (r.demo === undefined || FR_DEMOS.includes(r.demo)), `${l.id}: карточка ${j + 1} (схема «${r.demo}»)`);
        if (['fr-stress', 'fr-silent', 'fr-count'].includes(r.demo)) ok(Array.isArray(r.w) && r.w.length >= 2, `${l.id}: слова для схемы ${r.demo}`);
        if (r.demo === 'fr-stress') r.w.forEach(w => ok(w.includes('·') || !/[aeiouyéèêàâîôûœ].*[aeiouyéèêàâîôûœ]/i.test(w), `${l.id}: ${w} — слоги через точку`));
        if (r.demo === 'fr-nasal') ok(r.w.every(x => x.length === 3 && x[0] !== x[1]), `${l.id}: пары для схемы носовых`);
        if (r.demo === 'fr-lips') ok(r.w.every(x => x.length === 3), `${l.id}: шаги для схемы губ`);
        if (r.demo === 'fr-link') ok(r.w.every(x => x.length === 2), `${l.id}: связки для схемы`);
        if (r.demo === 'fr-combo') ok(r.combo.every(x => x[0] && x[1] && x[2].length >= 1), `${l.id}: сочетания для схемы`);
        if (r.demo === 'fr-homo') ok(r.combo.every(x => x[1].length >= 2 && new Set(x[1].map(y => y[0])).size === x[1].length), `${l.id}: омофоны для схемы`);
      });
      (l.sounds || []).forEach(([sym, how, ex, view]) => { ok(sym && how && ex.length >= 2 && FR_VIEWS.includes(view || ''), `${l.id}: звук ${sym}`); ex.forEach(w => frWord(w, `${l.id} звук ${sym}`)); });
      (l.repeat || []).forEach(w => frWord(w, `${l.id} повтор`));
      (l.pick || []).forEach(([w, others]) => { frWord(w, `${l.id} выбор`); ok(others.length >= 2 && new Set([w, ...others]).size === others.length + 1, `${l.id}: варианты к ${w}`); });
      (l.minimal || []).forEach(([a, b]) => ok(a && b && a !== b, `${l.id}: пара ${a}`));
      (l.spell || []).forEach(([ask, right, wrong]) => ok(ask && right && wrong.length >= 2 && !wrong.includes(right) && new Set(wrong).size === wrong.length, `${l.id}: вопрос «${ask}»`));
      (l.silent || []).forEach(x => {
        ok(/^[^()]*(\([^()]+\)[^()]*)*$/.test(x), `${l.id}: скобки в «${x}»`);
        const sv = silentOf(x); ok(sv.letters.some(y => y.tap), `${l.id}: немые буквы «${x}»`);
      });
      (l.link || []).forEach(x => { checkFrText(x, `${l.id} связка`); const lk = linksOf(x); ok(lk.links.length >= 1 && lk.words.length === lk.links.length + 1, `${l.id}: связка «${x}»`); });
      (l.hear || []).forEach(([sayText, right, wrong]) => { checkFrText(sayText, `${l.id} на слух`); ok(right && wrong.length >= 1 && !wrong.includes(right) && new Set(wrong).size === wrong.length, `${l.id}: на слух «${sayText}»`); });
      if (l.hear) ok(l.hearAsk, `${l.id}: нет вопроса hearAsk к заданиям на слух`);
      (l.dictee || []).forEach(d => (Array.isArray(d) ? ok(d[0] && d[1] && !/\s/.test(d[1]), `${l.id}: диктант по буквам ${d[1]}`) : frWord(d, `${l.id} диктант`)));
      (l.route || []).forEach(([sayText, path]) => { checkFrText(sayText, `${l.id} маршрут`); ok(/^[LUR]( [LUR])*$/.test(path), `${l.id}: стрелки маршрута «${path}»`); });
      (l.digits || []).forEach(([sayText, d]) => ok(sayText && /^\d{10}$/.test(d), `${l.id}: номер ${d}`));
      (l.body || []).forEach(([sayText, zone]) => { checkFrText(sayText, `${l.id} тело`); ok(BODY_ZONES.includes(zone), `${l.id}: часть тела ${zone}`); });
      if (l.board) ok(l.board.head.length === l.board.rows[0].length && l.board.rows.every(r => r.length === l.board.head.length) && l.board.ask.every(([t, k]) => t && l.board.rows[k]), `${l.id}: табло`);
      (l.order || []).forEach(([t, items]) => { checkFrText(t, `${l.id} рассказ`); ok(items.length >= 3 && new Set(items).size === items.length, `${l.id}: события рассказа`); });
      (l.speakQ || []).forEach(([t, ru]) => { checkFrText(t, `${l.id} интонация`); ok(ru, `${l.id}: перевод для интонации`); });
      if (l.sort) {
        const g = l.sort.items.map(x => x[1]);
        ok(l.sort.groups.length === 2 && g.every(x => x === 0 || x === 1) && g.includes(0) && g.includes(1) && new Set(l.sort.items.map(x => x[0])).size === g.length, `${l.id}: сортировка`);
      }
      (l.vocab || []).forEach(([w, ru]) => { frWord(w, `${l.id} слово`); ok(ru, `${l.id}: перевод слова ${w}`); });
      (l.write || []).forEach(([ch]) => ok(letterData(ch), `${l.id}: нет буквы ${ch} в прописях`));
      (l.dialog || []).forEach((line, j) => {
        const where = `${l.id} реплика ${j + 1}`;
        if (line[0] === 'them') { checkFrText(line[1], where); ok(line[2], `${where}: нет перевода`); return; }
        ok(ix.phrases[line[1]], `${where}: нет фразы ${line[1]}`);
        line[2].forEach(id => ok(ix.phrases[id] && id !== line[1], `${where}: неверный вариант ${id}`));
        ok(new Set([line[1], ...line[2]].map(id => ix.phrases[id] && ix.phrases[id].zh)).size === line[2].length + 1, `${where}: варианты совпадают`);
      });
      if (l.card) ok(l.card.t && l.card.x && (!l.card.src || (/^https:\/\//.test(l.card.src.url) && l.card.checked)), `${l.id}: карточка`);
      if (u.level === 'a0') ok(!(l.ph || []).length && !l.dialog, `${l.id}: на уровне «С нуля» нет фраз — только звуки, чтение и слова`);
      if (l.mixSounds || l.mixLevel) ok(l.kind === 'scene', `${l.id}: проверка должна быть последним уроком мини-курса`);
    });
  });
  track.before.forEach((c, k) => ok(c.t && c.x && c.src && /^https:\/\//.test(c.src.url) && c.checked, `перед поездкой ${k + 1}`));
  // звук: у всего, что звучит, есть файл (пересоберите: scripts/audio/make_audio_fr.py)
  const root = join(dirname(new URL(import.meta.url).pathname), '..');
  const needs = latinNeeds(track), man = track.audio || {};
  const lost = needs.filter(x => !man[x.key] || !existsSync(join(root, 'public', 'audio', track.code, man[x.key])));
  ok(!lost.length, `звук: нет файлов для ${lost.length} из ${needs.length}: ${lost.slice(0, 8).map(x => x.key).join(', ')}`);
  levelsOf(track.code).forEach(lv => {
    for (const audio of [true, false]) {
      const tasks = buildPlacement(ix, lv.id, { audio });
      ok(tasks.length === 6, `проверка уровня ${lv.id}${audio ? '' : ' без голоса'}: ${tasks.length} заданий`);
      tasks.forEach((t, k) => checkTask(t, `проверка уровня ${lv.id}#${k} ${t.type}`));
    }
  });
  Object.keys(ix.phrases).forEach(id => ok(used.has(id), `фраза ${id} не входит ни в один урок`));
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const l of ix.lessons) {
    for (const audio of [true, false]) {
      for (let round = 0; round < 6; round++) {
        const tasks = buildLesson(ix, l.id, { audio, mic: true, rnd });
        const graded = tasks.filter(isGraded);
        ok(graded.length >= 4, `${l.id}${audio ? '' : ' без голоса'}: всего ${graded.length} заданий с ответом`);
        tasks.forEach((t, k) => checkTask(t, `${l.id}#${k} ${t.type}${audio ? '' : ' без голоса'}`));
        const firstQ = tasks.findIndex(isGraded), lastIntro = tasks.map(t => EXPLAIN.includes(t.type)).lastIndexOf(true);
        if (round === 0 && firstQ >= 0) ok(lastIntro < firstQ, `${l.id}: объяснение после задания (${tasks[lastIntro]?.type} после ${tasks[firstQ].type})`);
        if (!audio) ok(!tasks.some(t => ['sound', 'hear2', 'hear', 'dictee', 'listen', 'digits', 'speakLine'].includes(t.type)), `${l.id}: задание на слух без голоса`);
      }
    }
  }
  if (Object.keys(ix.phrases).length >= 10) {
    const mine = Object.fromEntries(Object.keys(ix.phrases).map((id, k) => [id, { b: 0, due: k, at: k }]));
    for (let round = 0; round < 10; round++) {
      const { tasks, ids: got } = buildReview(ix, mine, { audio: round % 2 === 0, rnd, now: 1e12 });
      ok(got.length === 10 && tasks.length >= 10, `повторение: ${got.length} фраз`);
      tasks.forEach((t, k) => checkTask(t, `повторение#${k} ${t.type}`));
    }
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
  } else if (['build'].includes(t.type)) {
    ok(t.initials.includes(t.answer.initial) && t.finals.includes(t.answer.final) && new Set(t.initials).size === t.initials.length && new Set(t.finals).size === t.finals.length && t.initials.length >= 2 && t.finals.length >= 2, `${where}: диктант слога`);
  } else if (['compose', 'hear2', 'spell'].includes(t.type)) {
    ok(t.options.length >= 2 && t.correct >= 0 && new Set(t.options).size === t.options.length, `${where}: варианты`);
  } else if (t.type === 'radPick') {
    ok(t.options.length === 3 && t.correct >= 0 && new Set(t.options.map(o => o.zh)).size === 3, `${where}: ключи`);
  } else if (t.type === 'speakTone') {
    ok(t.syl && parseSyllable(t.syl.py).tone > 0, `${where}: скажите сами`);
  } else if (t.type === 'toneIntro') {
    ok(t.tone >= 1 && t.tone <= 4 && t.how && t.ex.length >= 1, `${where}: знакомство с тоном`);
  } else if (t.type === 'write') {
    ok(t.ch && [...t.ch.zh].length === 1 && ['trace', 'memory'].includes(t.mode), `${where}: прописи`);
  } else if (t.type === 'silent') {
    ok(t.w && t.letters.length === [...t.w].length, `${where}: немые буквы`);
  } else if (t.type === 'liaison') {
    ok(t.words.length === t.links.length + 1 && t.say && !t.say.includes('‿'), `${where}: связки`);
  } else if (['hear', 'read'].includes(t.type)) {
    ok(t.say && t.options.length >= 2 && t.correct >= 0 && new Set(t.options).size === t.options.length && t.ask, `${where}: варианты`);
  } else if (t.type === 'dictee') {
    ok(t.w && t.w.trim() === t.w && t.say, `${where}: диктант`);
  } else if (t.type === 'route') {
    ok(t.say && t.answer.length >= 1 && t.answer.every(x => 'LUR'.includes(x)), `${where}: маршрут`);
  } else if (t.type === 'digits') {
    ok(t.say && /^\d{10}$/.test(t.answer), `${where}: номер`);
  } else if (t.type === 'body') {
    ok(t.say && BODY_ZONES.includes(t.zone), `${where}: тело`);
  } else if (t.type === 'board') {
    ok(t.say && t.rows[t.correct], `${where}: табло`);
  } else if (t.type === 'order') {
    ok(t.say && t.items.length === t.bank.length && t.bank.every(b => t.items[b.k] === b.t), `${where}: порядок событий`);
  } else if (t.type === 'speakLine') {
    ok(t.text, `${where}: интонация`);
  } else if (t.type === 'sort') {
    ok(t.groups.length === 2 && t.items.length >= 4 && t.items.every(x => x.g === 0 || x.g === 1), `${where}: сортировка`);
  } else if (t.type === 'pairs') {
    ok(t.items.length >= 2 && new Set(t.items.map(p => p.ru)).size === t.items.length && new Set(t.items.map(p => p.zh)).size === t.items.length, `${where}: пары`);
  }
}

checkTrack(zh);
checkLatinTrack(fr);
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
