import { GROUPS, TOPICS, TOPIC_ORDER, BLOCKS, VERSION, FORMAT, LEVEL, DISCLAIMER } from './topics.js';
import { WPM, describe } from './timing.js';
import FULL_META from './full-meta.js';
import a from './courses-a.js';
import b from './courses-b.js';
import c from './courses-c.js';
import d from './courses-d.js';
import e from './courses-e.js';
import f from './courses-f.js';
import g from './courses-g.js';
import h from './courses-h.js';

export { GROUPS, TOPICS, BLOCKS, VERSION, FORMAT, LEVEL, DISCLAIMER, WPM };

/* ---------- версии урока ----------
   У каждого урока есть короткая версия: она лежит в courses-*.js и загружается сразу.
   Полная версия — те же шесть блоков, написанные подробно. Она лежит в папке full в файле
   с именем slug. Её текст подгружается только при открытии урока (см. full-loader.js),
   а сводка — время, заголовки блоков, карточка итога — берётся из full-meta.js.
   Поле full у урока — эта сводка. Если оно есть, у урока есть полная версия. */
const PARTS = ['why', 'idea', 'example', 'practice', 'check', 'key'];

export const COURSES = [...a, ...b, ...c, ...d, ...e, ...f, ...g, ...h].map(x => {
  const full = FULL_META[x.slug];
  return full ? { ...x, sources: full.sources || x.sources, full } : x;
});
export const versionsOf = x => (x.full ? ['short', 'full'] : ['short']);

/* Загруженные тексты полных версий */
const fullText = new Map();
export const putFull = (slug, L) => { fullText.set(slug, Object.fromEntries(PARTS.map(k => [k, L[k]]))); };
export const fullReady = slug => fullText.has(slug);
/* Урок в выбранной версии: общие сведения (название, тема, уровень) плюс шесть блоков этой версии.
   Для полной версии, текст которой ещё не загружен, возвращает null. */
export const lesson = (x, v) => {
  if (v !== 'full' || !x.full) return x;
  return fullText.has(x.slug) ? { ...x, ...fullText.get(x.slug) } : null;
};

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

/* ---------- время урока и сводка версии ----------
   Сервера и статистики прохождений у сайта нет, поэтому время считается по тексту (см. timing.js).
   Когда появятся данные о реальных прохождениях, среднее по ним должно заменить эту оценку. */
const shortInfo = new Map();
/* Сводка версии: blocks и total в секундах, min, titles, checks, thinks, sheet, key */
export function about(x, v = 'short') {
  if (v === 'full' && x.full) return x.full;
  if (!shortInfo.has(x.slug)) shortInfo.set(x.slug, describe(x));
  return shortInfo.get(x.slug);
}
export const timing = about;
export const minutes = (x, v) => about(x, v).min;

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

export const metaLine = (x, v) => `${minutes(x, v)} мин · ${FORMAT[x.format]} · ${LEVEL[x.level]}`;
export const tagsOf = slug => [...new Set(coursesOf(slug).flatMap(x => x.tags))];
