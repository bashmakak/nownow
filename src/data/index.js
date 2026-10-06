import { GROUPS, TOPICS, TOPIC_ORDER, BLOCKS, VERSION, FORMAT, LEVEL, DISCLAIMER } from './topics.js';
import fullDecisions from './full/psihologiya-prinyatiya-reshenij.js';
import fullBudget from './full/lichnyj-byudzhet.js';
import fullPrompts from './full/prompty.js';
import fullSleep from './full/gigiena-sna.js';
import fullListening from './full/aktivnoe-slushanie.js';
import fullMatrix from './full/matrica-ejzenhauera.js';
import a from './courses-a.js';
import b from './courses-b.js';
import c from './courses-c.js';
import d from './courses-d.js';
import e from './courses-e.js';
import f from './courses-f.js';
import g from './courses-g.js';
import h from './courses-h.js';

export { GROUPS, TOPICS, BLOCKS, VERSION, FORMAT, LEVEL, DISCLAIMER };

/* ---------- версии урока ----------
   У каждого урока есть короткая версия: она лежит в courses-*.js.
   Полная версия — те же шесть блоков, написанные подробно. Она лежит в папке full
   в файле с именем slug и подключается здесь. */
const FULL = [fullDecisions, fullBudget, fullPrompts, fullSleep, fullListening, fullMatrix];
const PARTS = ['why', 'idea', 'example', 'practice', 'check', 'key'];
const fullBy = Object.fromEntries(FULL.map(x => [x.slug, x]));

export const COURSES = [...a, ...b, ...c, ...d, ...e, ...f, ...g, ...h].map(x => {
  const full = fullBy[x.slug];
  if (!full) return x;
  return { ...x, sources: full.sources || x.sources, full: Object.fromEntries(PARTS.map(k => [k, full[k]])) };
});
export const versionsOf = x => (x.full ? ['short', 'full'] : ['short']);
/* Урок в выбранной версии: общие сведения (название, тема, уровень) плюс шесть блоков этой версии */
export const lesson = (x, v) => (v === 'full' && x.full ? { ...x, ...x.full } : x);

export const TOPIC_BY = Object.fromEntries(TOPICS.map(t => [t.slug, t]));
export const COURSE_BY = Object.fromEntries(COURSES.map(x => [x.slug, x]));
export const coursesOf = slug => COURSES.filter(x => x.topic === slug);

/* Тема открыта в каталоге, когда в ней минимум два курса */
export const isPublic = t => coursesOf(t.slug).length >= 2;
export const PUBLIC = TOPIC_ORDER.map(s => TOPIC_BY[s]).filter(t => t && isPublic(t))
  .concat(TOPICS.filter(t => isPublic(t) && !TOPIC_ORDER.includes(t.slug)));
export const SOON = TOPICS.filter(t => !isPublic(t));

export const FEATURED = ['psihologiya-prinyatiya-reshenij', 'lichnyj-byudzhet', 'prompty', 'gigiena-sna', 'aktivnoe-slushanie', 'matrica-ejzenhauera'];
export const REC_ORDER = FEATURED.concat(COURSES.map(x => x.slug).filter(s => !FEATURED.includes(s)));
export const START_COURSE = 'psihologiya-prinyatiya-reshenij';

/* ---------- время урока ----------
   Сервера и статистики прохождений у сайта нет, поэтому время считается по тексту:
   чтение со скоростью WPM слов в минуту плюс паузы на задания.
   Когда появятся данные о реальных прохождениях, среднее по ним должно заменить эту оценку. */
export const WPM = 150;
const PAUSE = { question: 15, think: 20, field: 60 };   // секунды: выбрать ответ, обдумать вопрос, заполнить поле листа
const SKIP = new Set(['placeholder', 'rows', 'correct']);
const NODES = new Set(['p', 'h', 'ul', 'ol', 'note', 'think', 'code', 'quote', 'table']);

const words = v => {
  if (typeof v === 'string') return (v.match(/\S+/g) || []).length;
  if (Array.isArray(v)) return (NODES.has(v[0]) ? v.slice(1) : v).reduce((n, x) => n + words(x), 0);
  if (v && typeof v === 'object') return Object.entries(v).reduce((n, [k, x]) => n + (SKIP.has(k) ? 0 : words(x)), 0);
  return 0;
};
const thinks = part => (part.body || []).filter(n => n[0] === 'think').length;

const cache = new Map();
/* Оценка времени: секунды по каждому из шести блоков, всего секунд и минут */
export function timing(x, v = 'short') {
  const ver = v === 'full' && x.full ? 'full' : 'short', id = `${x.slug}@${ver}`;
  if (cache.has(id)) return cache.get(id);
  const L = lesson(x, ver), read = part => words(part) / WPM * 60;
  const blocks = [
    read(L.why),
    read(L.idea) + thinks(L.idea) * PAUSE.think,
    read(L.example) + thinks(L.example) * PAUSE.think,
    read(L.practice) + thinks(L.practice) * PAUSE.think + (L.practice.sheet || []).length * PAUSE.field,
    read(L.check) + L.check.length * PAUSE.question,
    read(L.key),
  ].map(Math.round);
  const total = blocks.reduce((n, s) => n + s, 0);
  const t = { blocks, total, min: Math.max(1, Math.round(total / 60)) };
  cache.set(id, t);
  return t;
}
export const minutes = (x, v) => timing(x, v).min;

/* Сводные цифры для текстов сайта */
const spread = list => { const m = list.map(Number).sort((p, q) => p - q); return { min: m[0], max: m[m.length - 1], mid: m[Math.floor(m.length / 2)] }; };
export const WITH_FULL = COURSES.filter(x => x.full);
export const TIME = {
  short: spread(COURSES.map(x => minutes(x, 'short'))),
  full: WITH_FULL.length ? spread(WITH_FULL.map(x => minutes(x, 'full'))) : null,
};
/* Какую долю урока в среднем занимает каждый блок, в процентах */
export const BLOCK_SHARE = (() => {
  const sum = [0, 0, 0, 0, 0, 0];
  COURSES.forEach(x => { const t = timing(x); t.blocks.forEach((s, i) => { sum[i] += s / t.total; }); });
  const pct = sum.map(s => Math.round(s / COURSES.length * 100));
  pct[1] += 100 - pct.reduce((n, s) => n + s, 0);   // погрешность округления уходит в самый длинный блок
  return pct;
})();

const qWord = n => (n % 10 === 1 && n !== 11 ? 'вопрос' : n % 10 >= 2 && n % 10 <= 4 && (n < 10 || n > 20) ? 'вопроса' : 'вопросов');
export const metaLine = (x, v) => `${minutes(x, v)} мин · ${FORMAT[x.format]} · ${LEVEL[x.level]}`;
/* Заголовок блока. x — урок в нужной версии (см. lesson) */
export const blockTitle = (x, i) => [x.why.title, x.idea.title, x.example.title, x.practice.title, `${x.check.length} ${qWord(x.check.length)} на закрепление`, x.key.title][i];
export const tagsOf = slug => [...new Set(coursesOf(slug).flatMap(x => x.tags))];
