import { COURSES, COURSE_BY, TOPIC_BY, coursesOf, isCommunity, isPublic } from '../data';
import { TRAINERS, TRAINER_BY, REVIEW, ROUND } from '../data/trainers.js';
import { GAMES, GAME_BY, SKILLS, isGame, skillKey } from '../data/brain.js';
import { update, splitKey, streak, dayKey, today, ensureProgress, status } from './store.js';

/* ===== Опыт, уровни, достижения и тренажёры =====
   Опыт за уроки не хранится, а считается по прогрессу: так его получают и те, кто занимался до появления
   наград. Опыт за тренажёры накапливается в state.game.xp. */
export const XP = { short: 40, full: 100, answer: 5, play: 5, round: 10, bolt: 10, daily: 30, game: 5, gameBolt: 5 };
export const AI_TOPIC = 'iskusstvennyj-intellekt';

/* Верных ответов в проверке. Число сохраняется при завершении урока; для старого прогресса короткой версии считаем по ответам */
export const rightOf = (c, v, p) => {
  if (typeof p.right === 'number') return p.right;
  return v === 'short' ? c.check.filter((q, i) => p.answers && p.answers[i] === q.correct).length : 0;
};
const totalOf = (c, v) => (v === 'full' && c.full ? c.full.checks : c.check.length);
const playsOf = p => Object.values((p && p.play) || {}).filter(x => x && x.done).length;

/* Сколько опыта принёс один урок в одной версии */
export function lessonXp(s, key) {
  const p = s.courses[key], [slug, v] = splitKey(key), c = COURSE_BY[slug];
  // авторский урок: его текст скачивается отдельно, поэтому опыт считаем по тому, что записано в прогрессе
  if (p && isCommunity(slug)) return p.completed ? XP.short + (p.right || 0) * XP.answer : 0;
  if (!p || !c) return 0;
  return playsOf(p) * XP.play + (p.completed ? XP[v] + rightOf(c, v, p) * XP.answer : 0);
}
export const xpOf = s => Object.keys(s.courses).reduce((n, k) => n + lessonXp(s, k), 0) + ((s.game && s.game.xp) || 0);

/* Уровень по опыту: первый шаг 100, каждый следующий на 50 длиннее */
export function levelOf(xp) {
  let level = 1, base = 0, need = 100;
  while (xp >= base + need) { base += need; level++; need = 100 + 50 * (level - 1); }
  return { level, into: xp - base, need, left: base + need - xp, pct: Math.round((xp - base) / need * 100) };
}

/* Молнии за раунд: все верно — три, от трёх четвертей — две, от половины — одна */
export const boltsFor = (right, total) => (!total ? 0 : right >= total ? 3 : right / total >= 0.75 ? 2 : right / total >= 0.5 ? 1 : 0);

/* ---------- сводка для достижений ---------- */
export function stats(s) {
  const all = Object.keys(s.courses).filter(k => COURSE_BY[splitKey(k)[0]] || isCommunity(splitKey(k)[0]));
  const done = all.filter(k => s.courses[k].completed);
  const slugs = [...new Set(done.map(k => splitKey(k)[0]))];
  const known = slugs.filter(x => COURSE_BY[x] && !isCommunity(x));     // уроки редакции: у них известны тема и вопросы
  const ai = coursesOf(AI_TOPIC);
  const best = (s.game && s.game.best) || {};
  return {
    lessons: slugs.length,
    slugs,
    fulls: done.filter(k => splitKey(k)[1] === 'full').length,
    perfect: done.some(k => { const [slug, v] = splitKey(k), c = COURSE_BY[slug], p = s.courses[k]; return isCommunity(slug) ? (p.right || 0) >= (p.checks || 3) : rightOf(c, v, p) >= totalOf(c, v); }) ? 1 : 0,
    groups: new Set(known.map(x => TOPIC_BY[COURSE_BY[x].topic].g)).size,
    ai: ai.filter(c => slugs.includes(c.slug)).length,
    aiTotal: ai.length,
    plays: all.reduce((n, k) => n + playsOf(s.courses[k]), 0),
    written: all.filter(k => (s.courses[k].reflect || '').trim() || Object.values(s.courses[k].work || {}).some(v => (v || '').trim())).length,
    streak: streak(s),
    rounds: Object.values(best).reduce((n, b) => n + (b.plays || 0), 0),
    top: TRAINERS.filter(t => best[t.id] && best[t.id].bolts === 3).length,
    // «без единой ошибки» — это про вопросы; у мини-игр три молнии даются за скорость и объём
    anyTop: Object.entries(best).some(([id, b]) => !isGame(id) && b.bolts === 3) ? 1 : 0,
    dailies: (s.game && s.game.dailies) || 0,
    brain: GAMES.filter(g => best[g.id]).length,
    brainTotal: GAMES.length,
    brainTop: GAMES.filter(g => best[g.id] && best[g.id].bolts === 3).length,
  };
}

/* Достижения. of(st) возвращает [сколько сделано, сколько нужно] */
export const ACHIEVEMENTS = [
  { id: 'first', icon: 'zap', title: 'Первое знание', text: 'Пройти первый урок', of: st => [st.lessons, 1] },
  { id: 'five', icon: 'layers', title: 'Пять знаний', text: 'Пройти пять уроков', of: st => [st.lessons, 5] },
  { id: 'fifteen', icon: 'award', title: 'Пятнадцать знаний', text: 'Пройти пятнадцать уроков', of: st => [st.lessons, 15] },
  { id: 'deep', icon: 'book-open', title: 'Вглубь', text: 'Пройти полную версию урока', of: st => [st.fulls, 1] },
  { id: 'perfect', icon: 'target', title: 'Без ошибок', text: 'Ответить верно на все вопросы проверки в одном уроке', of: st => [st.perfect, 1] },
  { id: 'hands', icon: 'mouse-pointer-click', title: 'Своими руками', text: 'Выполнить пять интерактивных заданий в уроках', of: st => [st.plays, 5] },
  { id: 'writer', icon: 'notebook-pen', title: 'Свои слова', text: 'Записать ответы в практике трёх уроков', of: st => [st.written, 3] },
  { id: 'wide', icon: 'compass', title: 'Широкий кругозор', text: 'Пройти уроки из трёх разных разделов', of: st => [st.groups, 3] },
  { id: 'ai', icon: 'bot', title: 'Знаток ИИ', text: 'Пройти все уроки темы «Искусственный интеллект»', of: st => [st.ai, st.aiTotal] },
  { id: 'streak3', icon: 'flame', title: 'Три дня подряд', text: 'Заниматься три дня подряд', of: st => [st.streak, 3] },
  { id: 'streak7', icon: 'flame', title: 'Неделя подряд', text: 'Заниматься семь дней подряд', of: st => [st.streak, 7] },
  { id: 'warmup', icon: 'gamepad-2', title: 'Разминка', text: 'Сыграть первый раунд в тренажёре', of: st => [st.rounds, 1] },
  { id: 'bolts', icon: 'sparkles', title: 'Три молнии', text: 'Пройти раунд без единой ошибки', of: st => [st.anyTop, 1] },
  { id: 'daily', icon: 'calendar-check', title: 'Тренировка дня', text: 'Выполнить тренировку дня', of: st => [st.dailies, 1] },
  { id: 'daily5', icon: 'medal', title: 'Пять тренировок', text: 'Выполнить тренировку дня пять раз', of: st => [st.dailies, 5] },
  { id: 'master', icon: 'crown', title: 'Полный заряд', text: 'Получить три молнии во всех тренажёрах по ИИ', of: st => [st.top, TRAINERS.length] },
  { id: 'brain', icon: 'brain', title: 'Разминка для ума', text: 'Сыграть в любую мини-игру', of: st => [st.brain, 1] },
  { id: 'brain-all', icon: 'layout-grid', title: 'Полный круг', text: 'Сыграть во все мини-игры', of: st => [st.brain, st.brainTotal] },
  { id: 'brain-top', icon: 'gauge', title: 'В отличной форме', text: 'Получить три молнии в трёх мини-играх', of: st => [st.brainTop, 3] },
];
export const ACH_BY = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));
/* Достижения, условия которых выполнены сейчас */
export function earnedNow(s) { const st = stats(s); return ACHIEVEMENTS.filter(a => { const [n, need] = a.of(st); return need > 0 && n >= need; }).map(a => a.id); }
/* Полученные когда-либо: серия может прерваться, а достижение остаётся */
export const earned = s => [...new Set([...((s.game && s.game.seen) || []), ...earnedNow(s)])];

/* ---------- случайность с зерном: набор на день одинаков при каждом открытии ---------- */
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
/* Генератор случайных чисел, который для одной строки всегда даёт одну и ту же последовательность */
export const seeded = str => rng(hash(str));
export function shuffle(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ---------- тренажёры ---------- */
/* Вопросы для повторения: проверки уроков, которые человек прошёл в любой версии */
export function reviewPool(s) {
  return stats(s).slugs.filter(slug => COURSE_BY[slug] && !isCommunity(slug)).flatMap(slug => COURSE_BY[slug].check.map(q => ({ ...q, from: COURSE_BY[slug].title, slug })));
}
export const REVIEW_MIN = 3;

/* Вопросы по теме: проверки всех её уроков. Так тренировка есть у каждой темы каталога, а не только у ИИ.
   Отвечать можно и до урока: ошибка покажет, какой урок стоит открыть. */
export const topicQuizId = slug => `t-${slug}`;
const quizTopic = id => (typeof id === 'string' && id.startsWith('t-') ? id.slice(2) : null);
export const topicPool = slug => coursesOf(slug).flatMap(c => c.check.map(q => ({ ...q, from: c.title, slug: c.slug })));
const quizzes = new Map();
function topicQuiz(slug) {
  const t = TOPIC_BY[slug];
  if (!t || !isPublic(t)) return null;
  if (!quizzes.has(slug)) {
    quizzes.set(slug, {
      id: topicQuizId(slug), kind: 'topic', type: 'pick', icon: t.icon, dynamic: true, topicSlug: slug,
      title: t.title, sub: 'Вопросы по теме', card: t.hook,
      hook: `Вопросы из уроков темы «${t.title}». Отвечать можно и до уроков: в разборе ошибок будет ответ и урок, из которого вопрос.`,
      ask: 'Выберите ответ',
    });
  }
  return quizzes.get(slug);
}

/* Любой тренажёр по его id: набор по ИИ, повторение, вопросы по теме («t-<тема>») или мини-игра («g-<игра>») */
export const trainerOf = id => (id === 'review' ? REVIEW : TRAINER_BY[id] || GAME_BY[id] || (quizTopic(id) ? topicQuiz(quizTopic(id)) : null) || null);
/* Сколько заданий в наборе, из которого собирается раунд */
export function poolSize(id, s) {
  if (id === 'review') return reviewPool(s).length;
  if (quizTopic(id)) return topicPool(quizTopic(id)).length;
  return TRAINER_BY[id] ? TRAINER_BY[id].items.length : 0;
}
/* Задания одного раунда */
export function makeRound(id, s) {
  if (id === 'review') return shuffle(reviewPool(s)).slice(0, ROUND);
  if (quizTopic(id)) return shuffle(topicPool(quizTopic(id))).slice(0, ROUND);
  const t = TRAINER_BY[id];
  return t ? shuffle(t.items).slice(0, ROUND) : [];
}

/* ---------- интересы ---------- */
/* Темы каталога и навыки мини-игр, которые человек выбрал */
export const myTopics = s => (s.interests || []).filter(x => TOPIC_BY[x] && isPublic(TOPIC_BY[x]));
export const mySkills = s => SKILLS.map(k => k.id).filter(k => (s.interests || []).includes(skillKey(k)));
/* Уроки для блока «Для вас»: по очереди из каждой выбранной темы, начатые раньше не начатых, пройденные не предлагаем */
export function recommend(s, n = 6) {
  const order = { progress: 0, new: 1 };
  const lists = myTopics(s).map(t => coursesOf(t).filter(c => status(s, c.slug) !== 'done').sort((a, b) => order[status(s, a.slug)] - order[status(s, b.slug)]));
  const out = [];
  for (let i = 0; out.length < n && lists.some(l => l[i]); i++) lists.forEach(l => { if (l[i] && out.length < n) out.push(l[i]); });
  return out;
}
/* Задание любого типа в одном виде: { stim, options, correct, why, probs, from } */
export function normalize(cfg, it) {
  switch (cfg.type) {
    case 'sort': return { stim: it[0], options: cfg.buckets, correct: it[1], why: it[2] };
    case 'label': return { stim: it[0], options: cfg.labels, correct: it[1], why: it[2] || (cfg.whys && cfg.whys[it[1]]) };
    case 'predict': { const probs = it.options.map(o => o[1]); return { stim: it.text, options: it.options.map(o => o[0]), probs, correct: probs.indexOf(Math.max(...probs)), why: it.why }; }
    default: return { stim: it.q, options: it.options, correct: it.correct, why: it.why, from: it.from, slug: it.slug };
  }
}

/* Тренировка дня: три раунда. Набор зависит от даты и от интересов человека:
   1) разминка — мини-игра на выбранный навык (если навыки не выбраны, любая);
   2) знания — тренажёр или вопросы по одной из выбранных тем (если темы не выбраны, тренажёр по ИИ);
   3) повторение пройденного, а пока повторять нечего — вторая тема или вторая игра.
   Набор фиксируется после первого сыгранного раунда: если сменить интересы днём, начатая тренировка не поменяется. */
export function dailyPlan(s, key = dayKey()) {
  const saved = s.game && s.game.days && s.game.days[key];
  if (saved && saved.plan) return saved.plan;
  const rnd = rng(hash(key));
  const skills = mySkills(s);
  const games = shuffle(GAMES.filter(g => !skills.length || skills.includes(g.skill)), rnd).map(g => g.id);
  // у темы могут быть свои тренажёры (сейчас у ИИ) и всегда есть вопросы по урокам
  const forTopic = slug => shuffle([...TRAINERS.filter(t => t.topic === slug).map(t => t.id), topicQuizId(slug)], rnd)[0];
  let quiz = shuffle(myTopics(s), rnd).map(forTopic);
  if (!quiz.length) quiz = shuffle(TRAINERS.map(t => t.id), rnd);
  const plan = [games[0], quiz[0]];
  const third = reviewPool(s).length >= REVIEW_MIN ? 'review' : quiz[1] || games[1];
  plan.push(third && !plan.includes(third) ? third : shuffle(GAMES.map(g => g.id), rnd).find(id => !plan.includes(id)));
  return plan;
}
export const playedToday = s => ((s.game && s.game.days && s.game.days[dayKey()]) || { done: [] }).done;
export const dailyDone = s => { const d = playedToday(s); return dailyPlan(s).every(id => d.includes(id)); };

/* Очки за одно задание: 100 за верный ответ, до 50 за скорость, по 10 за каждый верный подряд (не больше 50) */
export const SPEED_MS = 12000;
export function points(ms, run) {
  const speed = Math.round(50 * Math.max(0, 1 - ms / SPEED_MS));
  return 100 + speed + Math.min(Math.max(run - 1, 0), 5) * 10;
}

/* Итог раунда: лучший результат, опыт, отметка в тренировке дня.
   Мини-игры передают молнии сами (bolts) и результат в своих единицах (raw: секунды, клетки, верные ответы). */
export function recordRound(id, { score, right, total, bolts: given, raw }) {
  const bolts = given != null ? given : boltsFor(right, total);
  let out = { gain: 0, bolts, newBest: false, daily: false };
  update(d => {
    const g = d.game, key = dayKey();
    const day = g.days[key] || (g.days[key] = { plan: dailyPlan(d, key), done: [], bonus: false });
    const b = g.best[id] || (g.best[id] = { score: 0, bolts: 0, plays: 0 });
    const newBest = b.plays > 0 && score > b.score;
    if (raw != null && (b.raw == null || score >= b.score)) b.raw = raw;
    b.plays++; b.score = Math.max(b.score, score); b.bolts = Math.max(b.bolts, bolts); b.last = Date.now();
    let gain = XP.round + bolts * XP.bolt, daily = false;
    // мини-игра длится меньше минуты, поэтому опыта за неё вдвое меньше, и даётся он за первый раунд в день
    // и за новый рекорд: основной источник опыта — уроки
    if (isGame(id)) gain = day.done.includes(id) && !newBest ? 0 : XP.game + bolts * XP.gameBolt;
    if (!day.done.includes(id)) day.done.push(id);
    if (!day.bonus && day.plan.every(x => day.done.includes(x))) { day.bonus = true; g.dailies++; gain += XP.daily; daily = true; }
    g.xp += gain;
    const t = today(d); t.games = (t.games || 0) + 1;
    // записи о тренировках старше месяца не нужны
    Object.keys(g.days).sort().slice(0, -31).forEach(k => { delete g.days[k]; });
    out = { gain, bolts, newBest, daily };
  });
  return out;
}

/* Интерактивное задание в уроке: результат хранится в прогрессе урока. Возвращает true, если задание выполнено впервые */
export function recordPlay(pk, kind, res) {
  let first = false;
  update(d => {
    const p = ensureProgress(d, pk);
    if (!p.play) p.play = {};
    const was = p.play[kind];
    first = !(was && was.done);
    p.play[kind] = { done: true, right: Math.max(res.right || 0, (was && was.right) || 0), total: res.total || 0 };
  });
  return first;
}

export const LESSONS_TOTAL = COURSES.length;
