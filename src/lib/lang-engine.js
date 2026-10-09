import { mark, parseSyllable, retone, syllables, toneVariants } from './pinyin.js';

/* ===== Языковые уроки: из данных трека — в задания =====
   Чистые функции без React и без хранилища: их проверяет scripts/validate-lang.mjs.

   Трек (src/data/lang/*.js) описывает фразы и уроки, а задания собираются здесь:
   у каждой новой фразы — знакомство и задание на значение, затем на слух, обратный перевод, пары и сборка
   из слов. Так урок можно дописать, не придумывая упражнений руками, и все уроки устроены одинаково. */

const PUNCT = /[，。？！、；：…,.?!;:]/g;
export const clean = s => s.replace(PUNCT, '').trim();

/* Фраза из строки данных: [id, слова через пробел, пиньинь по тем же словам, перевод, пояснение] */
export function phrase(row, kind = 'phrase') {
  const [id, z, p, ru, note] = row;
  const zt = z.split(' '), pt = p.split(' ');
  return {
    id, kind, ru, note: note || '',
    zh: zt.join(''), py: pt.join(' '),
    // плитки для задания «соберите фразу»: слово и его пиньинь, без знаков препинания
    tiles: zt.map((w, k) => ({ zh: clean(w), py: clean(pt[k] || '') })).filter(t => t.zh),
  };
}

/* Знак для прописей: [знак, пиньинь, значение]. Это не фраза: в разговорник и повторение он не попадает */
export const charOf = ([zh, py, ru]) => ({ id: `w-${zh}`, kind: 'char', zh, py, ru, note: '', tiles: [] });

/* Индекс трека: фразы, знаки для прописей, уроки по порядку, мини-курс урока */
export function indexTrack(track) {
  const phrases = {}, chars = {};
  (track.phrases || []).forEach(r => { const x = phrase(r); phrases[x.id] = x; });
  (track.signs || []).forEach(r => { const x = phrase(r, 'sign'); phrases[x.id] = x; });
  const lessons = [], lessonBy = {}, unitOf = {};
  track.units.forEach(u => u.lessons.forEach(l => {
    lessons.push(l); lessonBy[l.id] = l; unitOf[l.id] = u;
    (l.write || []).forEach(w => { if (!chars[`w-${w[0]}`]) chars[`w-${w[0]}`] = charOf(w); });
  }));
  return { track, phrases, chars, lessons, lessonBy, unitOf };
}
/* Уроки уровня по порядку */
export const levelLessonsOf = (ix, level) => ix.lessons.filter(l => ix.unitOf[l.id].level === level);
/* Следующий урок: первый непройденный начиная с уровня, который показала проверка; если там всё пройдено — любой */
export function nextLessonOf(ix, mine) {
  const done = (mine && mine.done) || {};
  const from = mine && mine.lv ? ix.lessons.findIndex(l => ix.unitOf[l.id].level === mine.lv.id) : 0;
  return ix.lessons.slice(Math.max(0, from)).find(l => !done[l.id]) || ix.lessons.find(l => !done[l.id]) || null;
}

/* ---------- случайность ---------- */
export function shuffle(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pickN = (list, n, rnd) => shuffle(list, rnd).slice(0, n);

/* Неверные варианты: сначала из того же урока, потом из мини-курса, потом из всего трека.
   key — по чему варианты не должны совпадать (перевод или запись) */
function distractors(ix, target, pools, n, key, rnd) {
  const seen = new Set([key(target)]), out = [];
  for (const pool of pools) {
    for (const p of shuffle(pool, rnd)) {
      if (out.length >= n) return out;
      if (!p || p.id === target.id || p.kind !== target.kind || seen.has(key(p))) continue;
      seen.add(key(p)); out.push(p);
    }
  }
  return out;
}
/* Задание с выбором: варианты перемешаны, correct — номер верного */
function choice(type, p, wrong, rnd, extra = {}) {
  const options = shuffle([p, ...wrong], rnd);
  return { type, p, options, correct: options.findIndex(o => o.id === p.id), ...extra };
}

/* Фразы урока, мини-курса и трека: из них берутся неверные варианты */
function poolsFor(ix, lesson) {
  const unit = ix.unitOf[lesson.id];
  const own = (lesson.ph || []).map(id => ix.phrases[id]);
  const unitAll = unit.lessons.flatMap(l => l.ph || []).map(id => ix.phrases[id]);
  return [own, unitAll, Object.values(ix.phrases)];
}

/* ---------- задания на тоны и звуки ---------- */
const TONE_NAMES = ['1-й: ровный высокий', '2-й: восходящий', '3-й: низкий, с провалом', '4-й: резкий падающий'];
export { TONE_NAMES };
/* Слог: «услышьте и выберите тон»; без голоса — «какой тон обозначен» */
function toneTask([zh, py, ru], audio, rnd) {
  const { base, tone } = parseSyllable(py);
  if (audio) {
    const options = toneVariants(base);
    return { type: 'tone', syl: { zh, py, ru }, options, correct: tone - 1 };
  }
  return { type: 'toneRead', syl: { zh, py, ru }, options: TONE_NAMES, correct: tone - 1 };
}
/* Слово из нескольких слогов: верный рисунок тонов и три неверных */
function toneWordTask([zh, py, ru], audio, rnd) {
  const syl = (syllables(py) || []).filter(s => !s.erhua);
  const wrong = new Set();
  for (let guard = 0; wrong.size < 3 && guard < 40; guard++) {
    const at = Math.floor(rnd() * syl.length), t = 1 + Math.floor(rnd() * 4);
    const v = retone(py, at, t);
    if (v !== py) wrong.add(v);
  }
  const options = shuffle([py, ...wrong], rnd);
  return { type: audio ? 'toneWord' : 'toneWordRead', syl: { zh, py, ru }, options, correct: options.indexOf(py) };
}
/* Похожие звуки: только на слух */
function soundTask([zh, py, others], rnd) {
  const options = shuffle([py, ...others], rnd);
  return { type: 'sound', syl: { zh, py }, options, correct: options.indexOf(py) };
}

/* ---------- урок ---------- */
const GRADED = new Set(['meaning', 'reverse', 'listen', 'tiles', 'pairs', 'reply', 'tone', 'toneRead', 'toneWord', 'toneWordRead', 'sound']);
/* Прописи (write) — упражнение без оценки: черты проверяет сам тренажёр письма, а ошибка в черте — не ошибка в языке */
export const isGraded = t => GRADED.has(t.type);

/* Задания одного урока. audio — есть ли на устройстве голос нужного языка */
export function buildLesson(ix, lessonId, { audio = false, rnd = Math.random } = {}) {
  const lesson = ix.lessonBy[lessonId];
  if (!lesson) return [];
  const out = [];
  if (lesson.rule) out.push({ type: 'rule', rule: lesson.rule });

  if (lesson.syl) {                                   // тоны: отдельные слоги
    const items = shuffle([...lesson.syl, ...lesson.syl], rnd);
    items.forEach(s => out.push(toneTask(s, audio, rnd)));
  }
  if (lesson.words) shuffle(lesson.words, rnd).forEach(w => out.push(toneWordTask(w, audio, rnd)));
  if (lesson.sound) {
    if (audio) shuffle([...lesson.sound, ...lesson.sound], rnd).forEach(s => out.push(soundTask(s, rnd)));
    else lesson.sound.forEach(([zh, py]) => out.push(toneTask([zh, py], false, rnd)));
  }
  if (lesson.mix) {                                   // проверка слуха: всё из мини-курса вперемешку
    const unit = ix.unitOf[lesson.id];
    const syl = unit.lessons.flatMap(l => l.syl || []), words = unit.lessons.flatMap(l => l.words || []);
    pickN(syl, 6, rnd).forEach(s => out.push(toneTask(s, audio, rnd)));
    pickN(words, 6, rnd).forEach(w => out.push(toneWordTask(w, audio, rnd)));
  }

  const ph = (lesson.ph || []).map(id => ix.phrases[id]);
  if (ph.length) {
    const pools = poolsFor(ix, lesson), byRu = p => p.ru, byZh = p => p.zh;
    // знакомство: фраза и сразу задание на её значение; после каждых двух — пары
    ph.forEach((p, k) => {
      out.push({ type: 'intro', p });
      out.push(choice('meaning', p, distractors(ix, p, pools, 3, byRu, rnd), rnd));
      if (k % 2 === 1) out.push({ type: 'pairs', items: shuffle(ph.slice(0, k + 1), rnd).slice(0, 4) });
    });
    const order = shuffle(ph, rnd);
    // на слух (без голоса — ещё раз на значение, но с другим набором вариантов)
    order.slice(0, 2).forEach(p => out.push(audio
      ? choice('listen', p, distractors(ix, p, pools, 3, byZh, rnd), rnd)
      : choice('meaning', p, distractors(ix, p, pools, 3, byRu, rnd), rnd)));
    order.slice(2, 4).forEach(p => out.push(choice('reverse', p, distractors(ix, p, pools, 3, byZh, rnd), rnd)));
    order.filter(p => p.tiles.length >= 2).slice(0, 2).forEach(p => out.push(tilesTask(ix, p, pools, rnd)));
    if (ph.length >= 3) out.push({ type: 'pairs', items: pickN(ph, Math.min(5, ph.length), rnd) });
    const sayable = order.find(p => p.kind !== 'sign') || order[0];
    out.push({ type: 'say', p: sayable });
  }

  if (lesson.write) {                                  // прописи: каждый знак по контуру, затем один-два по памяти
    const chars = lesson.write.map(w => ix.chars[`w-${w[0]}`]);
    const unitChars = ix.unitOf[lesson.id].lessons.flatMap(l => l.write || []).map(w => ix.chars[`w-${w[0]}`]);
    const pools = [chars, unitChars, Object.values(ix.chars)];
    chars.forEach(c => out.push({ type: 'write', ch: c, mode: 'trace' }));
    if (!ph.length) {                                  // урок только из знаков: проверка, что их узнают
      shuffle(chars, rnd).forEach(c => out.push(choice('meaning', c, distractors(ix, c, pools, 3, x => x.ru, rnd), rnd)));
      shuffle(chars, rnd).slice(0, 2).forEach(c => out.push(choice('reverse', c, distractors(ix, c, pools, 3, x => x.zh, rnd), rnd)));
    }
    shuffle(chars, rnd).slice(0, ph.length ? 1 : 2).forEach(c => out.push({ type: 'write', ch: c, mode: 'memory' }));
  }
  if (lesson.writeMix) {                               // проверка мини-курса прописей: узнать и написать по памяти
    const all = ix.unitOf[lesson.id].lessons.flatMap(l => l.write || []).map(w => ix.chars[`w-${w[0]}`]);
    const pools = [all, Object.values(ix.chars)];
    pickN(all, 8, rnd).forEach(c => out.push(choice('meaning', c, distractors(ix, c, pools, 3, x => x.ru, rnd), rnd)));
    pickN(all, 4, rnd).forEach(c => out.push(choice('reverse', c, distractors(ix, c, pools, 3, x => x.zh, rnd), rnd)));
    pickN(all, 3, rnd).forEach(c => out.push({ type: 'write', ch: c, mode: 'memory' }));
  }

  if (lesson.dialog) {                                 // сценарий: разговор по репликам
    const history = [];
    lesson.dialog.forEach(line => {
      if (line[0] === 'them') { history.push({ who: 'them', ...phrase(['', line[1], line[2], line[3]]) }); return; }
      const [, okId, noIds, ask] = line, p = ix.phrases[okId];
      const wrong = noIds.map(id => ix.phrases[id]);
      out.push(choice('reply', p, wrong, rnd, { ask: ask || 'Что ответить?', history: [...history] }));
      history.push({ who: 'me', ...p });
    });
  }
  if (lesson.signs) {                                  // проверка вывесок: все вывески мини-курса
    const unit = ix.unitOf[lesson.id];
    const all = unit.lessons.flatMap(l => l.ph || []).map(id => ix.phrases[id]).filter(p => p.kind === 'sign');
    pickN(all, 12, rnd).forEach(p => out.push(choice('meaning', p, distractors(ix, p, [all], 3, x => x.ru, rnd), rnd)));
  }
  if (lesson.card) out.push({ type: 'card', card: lesson.card });
  return out;
}

/* Сборка фразы из слов: верные плитки и одна-две лишние из других фраз */
function tilesTask(ix, p, pools, rnd) {
  const extra = [];
  for (const q of shuffle(pools[1].concat(pools[0]), rnd)) {
    if (extra.length >= Math.min(2, Math.max(1, 5 - p.tiles.length))) break;
    if (q.id === p.id) continue;
    const t = q.tiles.find(x => !p.tiles.some(y => y.zh === x.zh) && !extra.some(y => y.zh === x.zh));
    if (t) extra.push(t);
  }
  const bank = shuffle([...p.tiles.map((t, k) => ({ ...t, k: `a${k}` })), ...extra.map((t, k) => ({ ...t, k: `x${k}` }))], rnd);
  return { type: 'tiles', p, bank, answer: p.tiles.map(t => t.zh) };
}

/* ---------- повторение ---------- */
/* Через сколько дней фраза возвращается: по ступеням. После ошибки ступень сбрасывается */
export const STEPS = [1, 3, 7, 14, 30, 60];
const DAY = 864e5;
export const dueAt = (box, now) => now + STEPS[Math.min(box, STEPS.length - 1)] * DAY;

/* Фразы, которые пора повторить: сначала самые просроченные */
export function duePhrases(ix, mine, now = Date.now()) {
  return Object.entries(mine || {}).filter(([id, x]) => ix.phrases[id] && x.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
}

/* Раунд повторения: до 10 фраз, по одному заданию на фразу, вид задания выбирается случайно */
export function buildReview(ix, mine, { audio = false, rnd = Math.random, now = Date.now(), size = 10 } = {}) {
  let ids = duePhrases(ix, mine, now).slice(0, size);
  // повторять пока нечего — берём давно не встречавшиеся
  if (ids.length < 4) {
    const rest = Object.entries(mine || {}).filter(([id]) => ix.phrases[id] && !ids.includes(id)).sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).map(([id]) => id);
    ids = ids.concat(rest).slice(0, Math.min(size, Math.max(4, ids.length)));
  }
  const all = Object.values(ix.phrases), mineAll = ids.map(id => ix.phrases[id]);
  const pools = [mineAll, all];
  const tasks = shuffle(mineAll, rnd).map(p => {
    const kinds = ['meaning', 'reverse', ...(audio ? ['listen'] : []), ...(p.tiles.length >= 2 ? ['tiles'] : [])];
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    if (kind === 'tiles') return tilesTask(ix, p, [all, mineAll], rnd);
    const key = kind === 'meaning' ? x => x.ru : x => x.zh;
    return choice(kind, p, distractors(ix, p, pools, 3, key, rnd), rnd);
  });
  if (mineAll.length >= 4) tasks.splice(Math.floor(tasks.length / 2), 0, { type: 'pairs', items: pickN(mineAll, 4, rnd) });
  return { ids, tasks };
}

/* ---------- проверка уровня ---------- */
/* Задания на один уровень: фразы из его уроков, на значение, обратный перевод и на слух.
   Человек проходит уровни снизу вверх, пока отвечает уверенно (см. PASS) */
export const PLACEMENT = { size: 6, pass: 5 };
export function buildPlacement(ix, level, { audio = false, rnd = Math.random, size = PLACEMENT.size } = {}) {
  const ph = levelLessonsOf(ix, level).flatMap(l => l.ph || []).map(id => ix.phrases[id]).filter(Boolean);
  const all = Object.values(ix.phrases);
  // вывески и фразы поровну не нужны: вывесок не больше двух
  const signs = shuffle(ph.filter(p => p.kind === 'sign'), rnd).slice(0, 2);
  const picked = shuffle([...signs, ...shuffle(ph.filter(p => p.kind !== 'sign'), rnd)], rnd).slice(0, size);
  return picked.map((p, k) => {
    const kinds = p.kind === 'sign' ? ['meaning'] : ['meaning', 'reverse', ...(audio ? ['listen'] : [])];
    const kind = kinds[k % kinds.length];
    const key = kind === 'meaning' ? x => x.ru : x => x.zh;
    return { ...choice(kind, p, distractors(ix, p, [ph, all], 3, key, rnd), rnd), level };
  });
}

/* ---------- знаки для прописей ---------- */
/* Все знаки трека по мини-курсам: из прописей и из фраз. Для знака из фраз пиньинь берётся из слова,
   а вместо значения показываются фразы, где он встречается. from — откуда знак: id фраз и l:<урок> для прописей */
export function charTable(ix) {
  const seen = {}, units = [];
  ix.track.units.forEach(u => {
    const list = [];
    const add = (zh, info) => {
      if (!/\p{Script=Han}/u.test(zh)) return;
      if (!seen[zh]) { seen[zh] = { zh, py: info.py, ru: info.ru || '', words: [], unit: u.id, from: [] }; list.push(seen[zh]); }
      const c = seen[zh];
      if (info.from && !c.from.includes(info.from)) c.from.push(info.from);
      if (info.own && !c.ru) { c.py = info.py; c.ru = info.ru; }
      if (info.word && c.words.length < 3 && !c.words.some(w => w.zh === info.word.zh)) c.words.push(info.word);
    };
    u.lessons.forEach(l => {
      (l.write || []).forEach(([zh, py, ru]) => add(zh, { py, ru, own: true, from: `l:${l.id}` }));
      (l.ph || []).map(id => ix.phrases[id]).filter(Boolean).forEach(p => {
        p.tiles.forEach(t => {
          const hz = [...t.zh].filter(ch => /\p{Script=Han}/u.test(ch));
          const syl = (syllables(t.py) || []).filter(x => !x.erhua);
          hz.forEach((ch, k) => {
            if (ch === '儿' && hz.length > syl.length) return;     // 儿 после слога — эризация
            add(ch, { py: syl[k] ? mark(syl[k].base, syl[k].tone) : '', word: { zh: p.zh, py: p.py, ru: p.ru }, from: p.id });
          });
        });
      });
    });
    if (list.length) units.push({ unit: u, chars: list });
  });
  return units;
}

/* Фразы, которые урок добавляет в разговорник: сценарии и уроки на тоны их не добавляют */
export const lessonPhrases = (ix, lessonId) => ((ix.lessonBy[lessonId] && ix.lessonBy[lessonId].ph) || []).filter(id => ix.phrases[id]);
