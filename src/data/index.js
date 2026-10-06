import { GROUPS, TOPICS, TOPIC_ORDER, BLOCKS, FORMAT, LEVEL, DISCLAIMER } from './topics.js';
import full from './lesson-decisions.js';
import a from './courses-a.js';
import b from './courses-b.js';
import c from './courses-c.js';
import d from './courses-d.js';
import e from './courses-e.js';
import f from './courses-f.js';
import g from './courses-g.js';
import h from './courses-h.js';

export { GROUPS, TOPICS, BLOCKS, FORMAT, LEVEL, DISCLAIMER };

/* Первым идёт урок, написанный в полную длину (full: true). Остальные пока в сокращённом виде. */
export const COURSES = [full, ...a, ...b, ...c, ...d, ...e, ...f, ...g, ...h];
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

const qWord = n => (n % 10 === 1 && n !== 11 ? 'вопрос' : n % 10 >= 2 && n % 10 <= 4 && (n < 10 || n > 20) ? 'вопроса' : 'вопросов');
export const metaLine = x => `30 мин · ${FORMAT[x.format]} · ${LEVEL[x.level]}`;
export const blockTitle = (x, i) => [x.why.title, x.idea.title, x.example.title, x.practice.title, `${x.check.length} ${qWord(x.check.length)} на закрепление`, x.key.title][i];
export const tagsOf = slug => [...new Set(coursesOf(slug).flatMap(x => x.tags))];
