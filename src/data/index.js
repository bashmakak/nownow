import { GROUPS, TOPICS, TOPIC_ORDER, BLOCKS, FORMAT, LEVEL, DISCLAIMER } from './topics.js';
import a from './courses-a.js';
import b from './courses-b.js';
import c from './courses-c.js';

export { GROUPS, TOPICS, BLOCKS, FORMAT, LEVEL, DISCLAIMER };

export const COURSES = [...a, ...b, ...c];
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

export const metaLine = x => `30 мин · ${FORMAT[x.format]} · ${LEVEL[x.level]}`;
export const blockTitle = (x, i) => [x.why.title, x.idea.title, x.example.title, x.practice.title, 'Три вопроса на закрепление', x.key.title][i];
export const tagsOf = slug => [...new Set(coursesOf(slug).flatMap(x => x.tags))];
