import { SYLLABLES, mark, parseSyllable, retone, splitSyllable, spoken3, syllables, toneVariants } from './pinyin.js';

/* ===== Языковые уроки: из данных трека — в задания =====
   Чистые функции без React и без хранилища: их проверяет scripts/validate-lang.mjs.

   Трек (src/data/lang/*.js) описывает фразы и уроки, а задания собираются здесь:
   у каждой новой фразы — знакомство и задание на значение, затем на слух, обратный перевод, пары и сборка
   из слов. Так урок можно дописать, не придумывая упражнений руками, и все уроки устроены одинаково. */

const PUNCT = /[，。？！、；：…,.?!;:]/g;
export const clean = s => s.replace(PUNCT, '').trim();
const cleanLat = s => s.replace(/[,.?!;:…«»"“”()]/g, '').trim();
/* Связка или сцепление слов во французском: в данных — знак ‿ между словами (vous‿avez).
   В записи фразы он рисуется дужкой, для плиток и звука это обычный промежуток */
export const LINK = '‿';
export const plain = s => String(s || '').replace(/‿/g, ' ');

/* Фраза из строки данных.
   Иероглифы: [id, слова через пробел, пиньинь по тем же словам, перевод, пояснение].
   Латиница (track.script === 'latin'): [id, текст, перевод, пояснение] — слова разделены пробелами сами.
   Поле zh — текст на языке трека (для латиницы — с дужками связок), py — пиньинь (у латиницы пустой) */
export function phrase(row, kind = 'phrase', latin = false) {
  if (latin) {
    const [id, text, ru, note] = row;
    return {
      id, kind, ru, note: note || '', zh: text, py: '',
      tiles: text.split(/[ ‿]+/).map(w => ({ zh: cleanLat(w), py: '' })).filter(t => t.zh),
    };
  }
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
export const charOf = ([zh, py, ru]) => ({ id: `w-${zh}`, kind: 'char', zh, py: py || '', ru: ru || '', note: '', tiles: [] });
/* Слово уровня «С нуля» (латиница): [слово, перевод, пояснение] — для знакомства, заданий на значение и пар.
   В разговорник и повторение слова не попадают: там только фразы */
export const wordOf = ([w, ru, note]) => ({ id: `v-${w}`, kind: 'word', zh: w, py: '', ru, note: note || '', tiles: [] });

/* Индекс трека: фразы, знаки для прописей, слова, уроки по порядку, мини-курс урока */
export function indexTrack(track) {
  const latin = track.script === 'latin';
  const phrases = {}, chars = {}, vocab = {};
  (track.phrases || []).forEach(r => { const x = phrase(r, 'phrase', latin); phrases[x.id] = x; });
  (track.signs || []).forEach(r => { const x = phrase(r, 'sign', latin); phrases[x.id] = x; });
  const lessons = [], lessonBy = {}, unitOf = {};
  track.units.forEach(u => u.lessons.forEach(l => {
    lessons.push(l); lessonBy[l.id] = l; unitOf[l.id] = u;
    (l.write || []).forEach(w => { if (!chars[`w-${w[0]}`]) chars[`w-${w[0]}`] = charOf(w); });
    (l.vocab || []).forEach(w => { if (!vocab[`v-${w[0]}`]) vocab[`v-${w[0]}`] = wordOf(w); });
  }));
  return { track, latin, phrases, chars, vocab, lessons, lessonBy, unitOf };
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
/* Слоги, на которых схема тонов даёт послушать каждый тон */
export const TONE_EXAMPLES = ['mā', 'má', 'mǎ', 'mà'];
export { TONE_NAMES };
/* Слог: «услышьте и выберите тон»; без голоса — «какой тон обозначен» */
function toneTask([zh, py, ru], audio, rnd) {
  const { base, tone } = parseSyllable(py);
  if (audio) {
    const options = toneVariants(base);
    return { type: 'tone', syl: { zh: zh || '', py, ru: ru || '', base }, options, correct: tone - 1 };
  }
  return { type: 'toneRead', syl: { zh: zh || '', py, ru: ru || '', base }, options: TONE_NAMES, correct: tone - 1 };
}
/* Слово из нескольких слогов: верный рисунок тонов и три неверных */
function toneWordTask([zh, py, ru], audio, rnd) {
  const syl = (syllables(py) || []).filter(s => !s.erhua);
  const hz = [...(zh || '')].filter(ch => /\p{Script=Han}/u.test(ch));
  // варианты, которые неверными не назовёшь: так слово звучит (два третьих подряд) или так его пишут словари (不 bù, 一 yī)
  const spoken = spoken3(py), also = new Set([spoken]);
  if (hz.length === syl.length) hz.forEach((ch, k) => {
    if (ch === '不' && syl[k].tone !== 4) also.add(retone(py, k, 4));
    if (ch === '一' && syl[k].tone !== 1) also.add(retone(py, k, 1));
  });
  const wrong = new Set();
  for (let guard = 0; wrong.size < 3 && guard < 60; guard++) {
    const at = Math.floor(rnd() * syl.length), t = 1 + Math.floor(rnd() * 4);
    const v = retone(py, at, t);
    if (v !== py && !also.has(v)) wrong.add(v);
  }
  const options = shuffle([py, ...wrong], rnd);
  return { type: audio ? 'toneWord' : 'toneWordRead', syl: { zh, py, ru, spoken: spoken || '' }, options, correct: options.indexOf(py) };
}
/* Похожие звуки: только на слух */
function soundTask([zh, py, others], rnd, latin = false) {
  const options = shuffle([py, ...others], rnd);
  // латиница: звучит само слово (zh), пиньиня нет
  return { type: 'sound', syl: latin ? { zh: py, py: '' } : { zh: zh || '', py }, options, correct: options.indexOf(py) };
}

/* ---------- задания вводного фонетического курса ---------- */
const SOUND_GROUPS = [['b', 'p'], ['d', 't'], ['g', 'k'], ['j', 'q', 'x'], ['z', 'c', 's'], ['zh', 'ch', 'sh', 'r'], ['m', 'n', 'l', 'f', 'h'],
  ['an', 'ang'], ['en', 'eng'], ['in', 'ing'], ['ai', 'ei'], ['ao', 'ou'], ['ian', 'iang'], ['uan', 'uang'], ['u', 'ü'], ['i', 'ü'], ['ie', 'iu', 'iao'], ['ui', 'un', 'uo']];
function confusable(x, pool, n, rnd) {
  const near = SOUND_GROUPS.filter(g => g.includes(x)).flat().filter(y => y !== x);
  const rest = shuffle(pool.filter(y => y !== x && !near.includes(y)), rnd);
  return [...new Set([...shuffle(near, rnd), ...rest])].slice(0, n);
}
/* Диктант слога: услышать и собрать из начала, конца и тона */
function buildTask(py, lessonSyl, rnd) {
  const { base, tone } = parseSyllable(py);
  const { initial, final } = splitSyllable(base);
  const parts = lessonSyl.map(x => splitSyllable(parseSyllable(x).base));
  const inis = shuffle([initial, ...confusable(initial, [...new Set(parts.map(x => x.initial).filter(Boolean))], 3, rnd)], rnd);
  // после j, q, x пишут u, а звучит ü: варианты u и ü тут оба «верны», поэтому ü не предлагается
  const jqx = ['j', 'q', 'x'].includes(initial);
  const okFinal = f => !(jqx && (f.startsWith('ü') || f === final.replace(/^u/, 'ü')));
  const fins = shuffle([final, ...confusable(final, [...new Set(parts.map(x => x.final))].filter(okFinal), 6, rnd).filter(okFinal).slice(0, 3)], rnd);
  return { type: 'build', syl: { zh: '', py }, initials: inis, finals: fins, answer: { initial, final, tone } };
}
/* Без звука: та же запись на чтение — «b + a, первый тон» → выбрать bā */
function composeTask(py, lessonSyl, rnd) {
  const { base, tone } = parseSyllable(py);
  const { initial, final } = splitSyllable(base);
  const wrong = new Set();
  const others = lessonSyl.filter(x => x !== py);
  for (let g = 0; wrong.size < 3 && g < 30; g++) {
    const k = g % 3;
    const v = k === 0 ? mark(base, 1 + ((tone + Math.floor(rnd() * 3)) % 4)) : k === 1 && others.length ? others[Math.floor(rnd() * others.length)] : mark(`${confusable(initial, [], 1, rnd)[0] || initial}${final}`, tone);
    if (v && v !== py && SYLLABLES.has(parseSyllable(v).base)) wrong.add(v);
  }
  const options = shuffle([py, ...wrong], rnd);
  return { type: 'compose', syl: { zh: '', py }, parts: { initial, final, tone }, options, correct: options.indexOf(py) };
}
/* Две записи на слух: какая из них — нужный слог */
function hear2Task([target, other], rnd, latin = false) {
  const options = shuffle([target, other], rnd);
  return { type: 'hear2', syl: latin ? { zh: target, py: '' } : { zh: '', py: target }, options, correct: options.indexOf(target) };
}
function spellTask([ask, right, wrong, why], rnd) {
  const options = shuffle([right, ...wrong], rnd);
  return { type: 'spell', ask, why: why || '', options, correct: options.indexOf(right) };
}
/* Ключи иероглифов: знакомство и «какой ключ у этого знака» */
const radOf = ([zh, ru]) => ({ id: `r-${zh}`, kind: 'radical', zh, ru });
function radTasks(rads, allRads, rnd) {
  const out = [];
  rads.forEach(r => out.push({ type: 'radIntro', rad: { zh: r[0], ru: r[1], how: r[2] || '', ex: r[3].map(([zh, py, ru]) => ({ zh, py, ru })) } }));
  const pool = allRads.map(radOf);
  const items = shuffle(rads.flatMap(r => r[3].map(e => [r, e])), rnd);
  items.forEach(([r, [zh, py, ru]]) => {
    const right = radOf(r);
    const wrong = shuffle(pool.filter(x => x.zh !== right.zh), rnd).slice(0, 2);
    const options = shuffle([right, ...wrong], rnd);
    out.push({ type: 'radPick', ch: { zh, py, ru }, options, correct: options.findIndex(o => o.zh === right.zh) });
  });
  return out;
}

/* ---------- урок ---------- */
const GRADED = new Set(['meaning', 'reverse', 'listen', 'tiles', 'pairs', 'reply', 'tone', 'toneRead', 'toneWord', 'toneWordRead', 'sound',
  'build', 'compose', 'hear2', 'spell', 'radPick', 'silent', 'liaison', 'hear', 'read', 'dictee', 'sort', 'route', 'digits', 'body', 'board', 'order']);
/* Объяснения: идут до первого задания с ответом (проверка данных за этим следит) */
export const EXPLAIN = ['rule', 'toneIntro', 'soundIntro', 'repeat'];
/* Прописи (write) — упражнение без оценки: черты проверяет сам тренажёр письма, а ошибка в черте — не ошибка в языке */
export const isGraded = t => GRADED.has(t.type);

/* Задания одного урока. audio — есть ли на устройстве голос нужного языка */
export function buildLesson(ix, lessonId, { audio = false, mic = false, rnd = Math.random } = {}) {
  const lesson = ix.lessonBy[lessonId];
  if (!lesson) return [];
  const out = [];
  // вводные карточки идут по порядку, до правила: с них начинается курс с нуля
  if (lesson.intro) lesson.intro.forEach(r => out.push({ type: 'rule', rule: { k: 'С чего начать', ...r } }));
  if (lesson.rule) out.push({ type: 'rule', rule: lesson.rule });
  // тоны: каждый по очереди — знак, схема, как звучит
  if (lesson.tones) lesson.tones.forEach(([tone, how, ex]) => out.push({ type: 'toneIntro', tone, how, ex }));
  // звуки урока: сначала знакомство с каждым, потом «послушайте и повторите»
  // view — какую схему показать (для латиницы: губы, разрез с носом, язык; см. components/FrDemos.jsx)
  if (lesson.sounds) lesson.sounds.forEach(([py, how, ex, view]) => out.push({ type: 'soundIntro', s: { py, how, ex, view: view || '' } }));
  if (lesson.repeat && audio) out.push({ type: 'repeat', items: lesson.repeat });
  // знак тона на чтение: «какой тон обозначен» — и со звуком, и без
  if (lesson.marks) shuffle(lesson.marks, rnd).forEach(py => out.push(toneTask(['', py], false, rnd)));

  if (lesson.syl) {                                   // тоны: отдельные слоги
    const items = shuffle([...lesson.syl, ...lesson.syl], rnd);
    items.forEach(s => out.push(toneTask(s, audio, rnd)));
  }
  if (lesson.words) shuffle(lesson.words, rnd).forEach(w => out.push(toneWordTask(w, audio, rnd)));
  if (lesson.sound) {
    if (audio) shuffle([...lesson.sound, ...lesson.sound], rnd).forEach(s => out.push(soundTask(s, rnd)));
    else lesson.sound.forEach(([zh, py]) => out.push(toneTask([zh, py], false, rnd)));
  }
  // латиница: в уроке с фразами задания на маршрут, номер, табло и т. п. идут после знакомства с фразами
  const late = ix.latin && (lesson.ph || []).length > 0;
  if (!late) phoneticTasks(lesson, audio, rnd, out, ix.latin);
  if ((lesson.mixSounds || lesson.mixLevel) && ix.latin) {   // проверка мини-курса (mixLevel — всего уровня), латиница
    const unit = ix.unitOf[lesson.id];
    const L = lesson.mixLevel ? levelLessonsOf(ix, unit.level) : unit.lessons, all = k => L.flatMap(l => l[k] || []);
    const sorts = L.map(l => l.sort).filter(Boolean);
    const hears = L.flatMap(l => (l.hear || []).map(h => [h[0], h[1], h[2], h[3], l.hearAsk]));
    const mixed = { pick: pickN(all('pick'), 4, rnd), minimal: pickN(all('minimal'), 3, rnd), spell: pickN(all('spell'), audio ? 3 : 5, rnd),
      silent: pickN(all('silent'), 3, rnd), link: pickN(all('link'), 2, rnd), hear: pickN(hears, 3, rnd), dictee: pickN(all('dictee'), 2, rnd),
      sort: sorts.length ? { ...sorts[0], items: pickN(sorts.flatMap(x => x.items), 6, rnd) } : null };
    phoneticTasks(mixed, audio, rnd, out, true);
    const words = L.flatMap(l => l.vocab || []).map(w => ix.vocab[`v-${w[0]}`]);
    pickN(words, 3, rnd).forEach(w => out.push(choice('meaning', w, distractors(ix, w, [words, Object.values(ix.vocab)], 3, x => x.ru, rnd), rnd)));
  }
  if (lesson.mixSounds && !ix.latin) {                             // проверка фонетического мини-курса: всё вперемешку
    const unit = ix.unitOf[lesson.id], L = unit.lessons;
    const mixed = { pick: pickN(L.flatMap(l => l.pick || []), 5, rnd), minimal: pickN(L.flatMap(l => l.minimal || []), 3, rnd),
      build: pickN(L.flatMap(l => l.build || []), 4, rnd), spell: pickN(L.flatMap(l => l.spell || []), 2, rnd), buildPool: L.flatMap(l => l.build || []) };
    const syl = pickN(L.flatMap(l => l.syl || []), 3, rnd);
    syl.forEach(x => out.push(toneTask(x, audio, rnd)));
    phoneticTasks(mixed, audio, rnd, out);
    pickN(L.flatMap(l => l.words || []), 3, rnd).forEach(w => out.push(toneWordTask(w, audio, rnd)));
  }
  if (lesson.rad) out.push(...radTasks(lesson.rad, ix.track.units.flatMap(u => u.lessons.flatMap(l => l.rad || [])), rnd));
  if (lesson.radMix) {                                 // проверка ключей: знаки из всего мини-курса
    const unit = ix.unitOf[lesson.id], all = unit.lessons.flatMap(l => l.rad || []);
    const tasks = radTasks(all, all, rnd).filter(t => t.type === 'radPick');
    out.push(...pickN(tasks, 10, rnd));
  }
  if (lesson.mix) {                                   // проверка слуха: всё из мини-курса вперемешку
    const unit = ix.unitOf[lesson.id];
    const syl = unit.lessons.flatMap(l => l.syl || []), words = unit.lessons.flatMap(l => l.words || []);
    pickN(syl, 6, rnd).forEach(s => out.push(toneTask(s, audio, rnd)));
    pickN(words, 6, rnd).forEach(w => out.push(toneWordTask(w, audio, rnd)));
  }

  if (lesson.vocab) {                                  // слова уровня «С нуля»: знакомство, значение, пары, на слух
    const words = lesson.vocab.map(w => ix.vocab[`v-${w[0]}`]);
    const unitWords = ix.unitOf[lesson.id].lessons.flatMap(l => l.vocab || []).map(w => ix.vocab[`v-${w[0]}`]);
    const pools = [words, unitWords, Object.values(ix.vocab)];
    words.forEach((w, k) => {
      out.push({ type: 'intro', p: w });
      out.push(choice('meaning', w, distractors(ix, w, pools, 3, x => x.ru, rnd), rnd));
      if (k % 3 === 2) out.push({ type: 'pairs', items: shuffle(words.slice(0, k + 1), rnd).slice(0, 4) });
    });
    const order = shuffle(words, rnd);
    order.slice(0, 3).forEach(w => out.push(audio
      ? choice('listen', w, distractors(ix, w, pools, 3, x => x.zh, rnd), rnd)
      : choice('reverse', w, distractors(ix, w, pools, 3, x => x.zh, rnd), rnd)));
    if (words.length >= 4) out.push({ type: 'pairs', items: pickN(words, Math.min(5, words.length), rnd) });
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
    if (late) phoneticTasks(lesson, audio, rnd, out, true);
    out.push({ type: 'say', p: sayable });
  }

  if (lesson.write) {                                  // прописи: каждый знак по контуру, затем один-два по памяти
    const chars = lesson.write.map(w => ix.chars[`w-${w[0]}`]);
    const unitChars = ix.unitOf[lesson.id].lessons.flatMap(l => l.write || []).map(w => ix.chars[`w-${w[0]}`]);
    const pools = [chars, unitChars, Object.values(ix.chars)];
    chars.forEach(c => out.push({ type: 'write', ch: c, mode: 'trace', script: ix.latin ? 'latin' : 'hanzi' }));
    if (!ph.length && !ix.latin) {                                  // урок только из знаков: проверка, что их узнают
      shuffle(chars, rnd).forEach(c => out.push(choice('meaning', c, distractors(ix, c, pools, 3, x => x.ru, rnd), rnd)));
      shuffle(chars, rnd).slice(0, 2).forEach(c => out.push(choice('reverse', c, distractors(ix, c, pools, 3, x => x.zh, rnd), rnd)));
    }
    shuffle(chars, rnd).slice(0, ph.length ? 1 : 2).forEach(c => out.push({ type: 'write', ch: c, mode: 'memory', script: ix.latin ? 'latin' : 'hanzi' }));
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
      if (line[0] === 'them') { history.push({ who: 'them', ...(ix.latin ? phrase(['', line[1], line[2]], 'phrase', true) : phrase(['', line[1], line[2], line[3]])) }); return; }
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
  // тренажёр тонов: скажите слог сами — линия голоса на схеме (нужны звук и микрофон; задание без оценки)
  if (lesson.speak && audio && mic && !ix.latin) lesson.speak.forEach(py => out.push({ type: 'speakTone', syl: { py } }));
  // интонация (латиница): скажите фразу — линия голоса рядом с линией образца; вопрос поднимается к концу
  if (lesson.speakQ && audio && mic) lesson.speakQ.forEach(([text, ru, rise]) => out.push({ type: 'speakLine', text, ru, rise: Boolean(rise) }));
  if (lesson.card) out.push({ type: 'card', card: lesson.card });
  return out;
}

/* Задания на звуки из полей урока: pick — услышать и выбрать слог, minimal — пара похожих слогов,
   build — диктант слога, spell — правило записи. Без звука слух заменяется чтением */
function phoneticTasks(src, audio, rnd, out, latin = false) {
  const pool = src.buildPool || src.build || [];
  if (latin) {                                        // латиница: на слух — только со звуком, без него остаются задания на чтение
    if (audio) shuffle(src.pick || [], rnd).forEach(([w, others]) => out.push(soundTask(['', w, others], rnd, true)));
    if (audio) shuffle(src.minimal || [], rnd).forEach(pair => out.push(hear2Task(pair, rnd, true)));
    shuffle(src.spell || [], rnd).forEach(x => out.push(spellTask(x, rnd)));
    latinTasks(src, audio, rnd, out);
    return;
  }
  shuffle(src.pick || [], rnd).forEach(([py, others]) => out.push(audio ? soundTask(['', py, others], rnd) : toneTask(['', py], false, rnd)));
  shuffle(src.minimal || [], rnd).forEach(pair => out.push(audio ? hear2Task(pair, rnd) : toneTask(['', pair[0]], false, rnd)));
  shuffle(src.build || [], rnd).forEach(py => out.push(audio ? buildTask(py, pool, rnd) : composeTask(py, pool, rnd)));
  shuffle(src.spell || [], rnd).forEach(x => out.push(spellTask(x, rnd)));
}

/* ---------- задания для латиницы (французский) ---------- */
/* Немые буквы: в данных они в скобках — peti(t), (h)ôtel, beau(x). Задание: отметить буквы, которые не звучат */
export function silentOf(src) {
  const letters = []; let mute = false;
  for (const ch of src) {
    if (ch === '(') { mute = true; continue; }
    if (ch === ')') { mute = false; continue; }
    letters.push({ c: ch, mute, tap: /\p{L}/u.test(ch) });
  }
  return { w: letters.map(x => x.c).join(''), letters };
}
/* Связки: фраза с дужками ‿ там, где слова связываются, и пробелами там, где нет. Задание: поставить дужки */
export function linksOf(src) {
  // слова разделены обычным пробелом или дужкой; неразрывный пробел перед ? ! : ; остаётся внутри слова
  const words = src.split(/([ ‿]+)/).filter(Boolean);
  const out = { words: [], links: [] };
  words.forEach(x => { if (/^[ ‿]+$/.test(x)) out.links.push(x.includes('‿')); else out.words.push(x); });
  return out;
}
/* Варианты на слух: [что звучит, верный ответ, [неверные], пояснение]. Без звука — то же на чтение */
function hearTask([say, right, wrong, why, ask], audio, rnd) {
  const options = shuffle([right, ...wrong], rnd);
  return { type: audio ? 'hear' : 'read', say, why: why || '', ask: ask || '', options, correct: options.indexOf(right) };
}
/* Маршрут по объяснению: стрелки L — налево, R — направо, U — прямо */
function routeTask([say, path]) { return { type: 'route', say, answer: path.split(' ') }; }
/* Номер на слух: набрать цифры */
function digitsTask([say, digits]) { return { type: 'digits', say, answer: digits }; }
function latinTasks(src, audio, rnd, out) {
  shuffle(src.silent || [], rnd).forEach(x => out.push({ type: 'silent', ...silentOf(x) }));
  shuffle(src.link || [], rnd).forEach(x => out.push({ type: 'liaison', src: x, say: plain(x), ...linksOf(x) }));
  // вопрос к заданию на слух — у урока (hearAsk), а в проверке мини-курса — у каждого пункта свой
  shuffle(src.hear || [], rnd).forEach(x => out.push(hearTask(x.length > 4 ? x : [x[0], x[1], x[2], x[3], src.hearAsk], audio, rnd)));
  // диктант: слово или [что звучит, что написать] — фамилия по буквам
  if (audio) shuffle(src.dictee || [], rnd).forEach(d => out.push(Array.isArray(d) ? { type: 'dictee', w: d[1], say: d[0] } : { type: 'dictee', w: d, say: d }));
  (src.sort ? [src.sort] : []).forEach(sv => out.push({ type: 'sort', groups: sv.groups, items: shuffle(sv.items, rnd).map(([w, g, ru]) => ({ w, g, ru: ru || '' })) }));
  shuffle(src.route || [], rnd).forEach(x => out.push(routeTask(x)));
  if (audio) shuffle(src.digits || [], rnd).forEach(x => out.push(digitsTask(x)));
  shuffle(src.body || [], rnd).forEach(([say, zone, ru]) => out.push({ type: 'body', say, zone, ru: ru || '' }));
  // порядок событий в рассказе: события даны по порядку, на экране — вперемешку
  shuffle(src.order || [], rnd).forEach(([say, items]) => out.push({ type: 'order', say, items, bank: shuffle(items.map((t, k) => ({ t, k })), rnd) }));
  (src.board ? [src.board] : []).forEach(b => shuffle(b.ask, rnd).forEach(([say, row]) => out.push({ type: 'board', rows: b.rows, head: b.head, say, correct: row })));
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
  const lessons = levelLessonsOf(ix, level);
  const ph = lessons.flatMap(l => l.ph || []).map(id => ix.phrases[id]).filter(Boolean);
  if (ph.length < size && ix.latin) {                   // вводный курс латиницы: звуки, чтение, немые буквы, связки
    const all = k => lessons.flatMap(l => l[k] || []);
    const hears = lessons.flatMap(l => (l.hear || []).map(h => [h[0], h[1], h[2], h[3], l.hearAsk]));
    const src = { pick: pickN(all('pick'), 2, rnd), minimal: pickN(all('minimal'), 1, rnd), spell: pickN(all('spell'), audio ? 1 : 3, rnd),
      silent: pickN(all('silent'), 1, rnd), link: pickN(all('link'), 1, rnd), hear: pickN(hears, 1, rnd) };
    const out = [];
    phoneticTasks(src, audio, rnd, out, true);
    return shuffle(out, rnd).slice(0, size).map(x => ({ ...x, level }));
  }
  if (ph.length < size) {                              // уровень без фраз — вводный курс: звуки и тоны
    const src = { pick: pickN(lessons.flatMap(l => l.pick || []), 2, rnd), minimal: pickN(lessons.flatMap(l => l.minimal || []), 1, rnd),
      spell: pickN(lessons.flatMap(l => l.spell || []), 1, rnd) };
    const out = [];
    pickN(lessons.flatMap(l => l.syl || []), 2, rnd).forEach(x => out.push(toneTask(x, audio, rnd)));
    phoneticTasks(src, audio, rnd, out);
    return out.slice(0, size).map(x => ({ ...x, level }));
  }
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
  const readings = ix.track.readings || {};               // словарные чтения знаков, которые в курсе встречаются только с лёгким тоном
  ix.track.units.forEach(u => {
    const list = [];
    const add = (zh, info) => {
      if (!/\p{Script=Han}/u.test(zh)) return;
      if (!seen[zh]) { seen[zh] = { zh, py: readings[zh] || info.py, ru: info.ru || '', words: [], unit: u.id, from: [] }; list.push(seen[zh]); }
      const c = seen[zh];
      if (info.from && !c.from.includes(info.from)) c.from.push(info.from);
      if (info.own && !c.ru) { c.py = info.py; c.ru = info.ru; }
      else if (!parseSyllable(c.py).tone && parseSyllable(info.py || '').tone) c.py = info.py;   // лёгкий тон из слова — на словарный
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
