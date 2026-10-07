import { describe } from '../data/timing.js';

/* ===== Формат авторского урока =====
   Авторский урок устроен так же, как короткий урок редакции: шесть блоков и карточка итога.
   Здесь три вещи, которыми пользуются редактор, модерация и плеер:
     blankLesson()        — пустая заготовка;
     cleanLesson(data)    — приводит то, что пришло из формы или из базы, к ожидаемому виду. Всё лишнее
                            отбрасывается: урок другого человека — чужие данные, и доверять их форме нельзя;
     checkLesson(data, topics) — список того, что мешает отправить урок на проверку.
   Тексты не содержат разметки, кроме двух пометок, которые понимает плеер: **жирный** и `код`. */

export const LIMITS = {
  title: [5, 90], summary: [40, 260], outcome: 140, tag: 30, blockTitle: [3, 90], para: 700, intro: 600,
  pointTitle: 80, pointText: 500, callout: 260, takeaway: 320, step: 320, reflect: 240,
  question: 220, option: 160, why: 420, thesis: 170, action: 240, source: 220,
  minutes: [2, 9],
};
export const FORMATS = ['theory', 'practice', 'case'];

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
/* Абзацы: в форме это одно поле, абзацы разделены пустой строкой; в уроке — массив строк */
const paras = (v, max, count) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n\s*\n/) : []).map(x => str(x, max)).filter(Boolean).slice(0, count);
const lines = (v, max, count) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : []).map(x => str(x, max)).filter(Boolean).slice(0, count);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

export const blankLesson = () => ({
  title: '', summary: '', topic: '', format: 'theory', level: 1, tags: [], outcomes: ['', '', ''],
  why: { title: '', text: [''] },
  idea: { title: '', intro: '', points: [['', ''], ['', '']], callout: '' },
  example: { title: '', text: [''], takeaway: '' },
  practice: { title: '', intro: '', steps: ['', ''], reflect: '' },
  check: [0, 1, 2].map(() => ({ q: '', options: ['', '', ''], correct: 0, why: '' })),
  key: { title: '', theses: ['', '', ''], action: '' },
  sources: [],
});

/* Урок в том виде, в каком он хранится и показывается. Пустые строки списков отброшены */
export function cleanLesson(raw) {
  const d = obj(raw), L = LIMITS;
  const why = obj(d.why), idea = obj(d.idea), ex = obj(d.example), pr = obj(d.practice), key = obj(d.key);
  const points = (Array.isArray(idea.points) ? idea.points : []).map(p => (Array.isArray(p) ? [str(p[0], L.pointTitle), str(p[1], L.pointText)] : ['', ''])).filter(p => p[0] || p[1]).slice(0, 5);
  const check = (Array.isArray(d.check) ? d.check : []).map(q => {
    const x = obj(q), all = Array.isArray(x.options) ? x.options.map(o => str(o, L.option)) : [];
    // правильный ответ помним по тексту: после удаления пустых вариантов его номер мог сдвинуться
    const right = all[Number.isInteger(x.correct) ? x.correct : 0] || '';
    const options = all.filter(Boolean).slice(0, 4);
    return { q: str(x.q, L.question), options, correct: Math.max(0, options.indexOf(right)), why: str(x.why, L.why) };
  }).filter(q => q.q || q.options.length).slice(0, 5);
  const out = {
    title: str(d.title, L.title[1]), summary: str(d.summary, L.summary[1]), topic: str(d.topic, 60),
    format: FORMATS.includes(d.format) ? d.format : 'theory', level: [1, 2, 3].includes(+d.level) ? +d.level : 1,
    tags: lines(d.tags, L.tag, 3), outcomes: lines(d.outcomes, L.outcome, 4),
    why: { title: str(why.title, L.blockTitle[1]), text: paras(why.text, L.para, 3) },
    idea: { title: str(idea.title, L.blockTitle[1]), intro: str(idea.intro, L.intro), points, callout: str(idea.callout, L.callout) },
    example: { title: str(ex.title, L.blockTitle[1]), text: paras(ex.text, L.para, 4), takeaway: str(ex.takeaway, L.takeaway) },
    practice: { title: str(pr.title, L.blockTitle[1]), intro: str(pr.intro, L.intro), steps: lines(pr.steps, L.step, 5), reflect: str(pr.reflect, L.reflect) },
    check,
    key: { title: str(key.title, L.blockTitle[1]), theses: lines(key.theses, L.thesis, 3), action: str(key.action, L.action) },
    sources: lines(d.sources, L.source, 6),
  };
  out.minutes = lessonMinutes(out);
  return out;
}

/* Время урока считается так же, как у уроков редакции: по объёму текста */
export function lessonMinutes(clean) {
  try { return describe({ ...clean, slug: 'draft' }).min; } catch { return 0; }
}

const dup = list => new Set(list.map(x => x.toLowerCase())).size !== list.length;
const between = (s, [a, b]) => s.length >= a && s.length <= b;

/* Что мешает отправить урок на проверку. Пустой список — урок готов. part — блок формы, к которому относится замечание */
export function checkLesson(raw, topics) {
  const d = cleanLesson(raw), L = LIMITS, out = [];
  const add = (part, text) => out.push({ part, text });
  if (!between(d.title, L.title)) add('meta', `Название: от ${L.title[0]} до ${L.title[1]} знаков.`);
  if (!between(d.summary, L.summary)) add('meta', `Описание: от ${L.summary[0]} до ${L.summary[1]} знаков. Это текст на карточке урока.`);
  if (!topics.includes(d.topic)) add('meta', 'Выберите тему каталога.');
  if (d.tags.length < 1) add('meta', 'Добавьте хотя бы одну метку.');
  if (d.outcomes.length < 3 || dup(d.outcomes)) add('meta', 'Напишите три разных пункта «Что вы узнаете».');
  if (!between(d.why.title, L.blockTitle) || !d.why.text.length) add('why', '«Зачем»: нужны заголовок и хотя бы один абзац.');
  if (!between(d.idea.title, L.blockTitle)) add('idea', '«Идея»: нужен заголовок.');
  if (d.idea.points.length < 2 || d.idea.points.some(p => !p[0] || !p[1]) || dup(d.idea.points.map(p => p[0]))) add('idea', '«Идея»: от двух до пяти тезисов, у каждого заголовок и пояснение, заголовки не повторяются.');
  if (!between(d.example.title, L.blockTitle) || !d.example.text.length || !d.example.takeaway) add('example', '«Пример»: нужны заголовок, текст и вывод.');
  if (!between(d.practice.title, L.blockTitle) || d.practice.steps.length < 2 || dup(d.practice.steps)) add('practice', '«Практика»: нужны заголовок и от двух до пяти разных шагов.');
  if (d.check.length !== 3) add('check', '«Проверка»: нужно ровно три вопроса.');
  d.check.forEach((q, i) => {
    if (!q.q || q.options.length < 2 || dup(q.options) || !q.why) add('check', `Вопрос ${i + 1}: нужны текст вопроса, от двух до четырёх разных вариантов и объяснение ответа.`);
  });
  if (dup(d.check.map(q => q.q).filter(Boolean))) add('check', 'Вопросы не должны повторяться.');
  if (!between(d.key.title, L.blockTitle) || d.key.theses.length < 3 || dup(d.key.theses) || !d.key.action) add('key', '«Ключевое знание»: нужны заголовок, три разных тезиса и действие на сегодня.');
  if (!out.length && (d.minutes < L.minutes[0] || d.minutes > L.minutes[1])) add('meta', `Урок получается на ${d.minutes} мин. Нужно от ${L.minutes[0]} до ${L.minutes[1]}: ${d.minutes > L.minutes[1] ? 'сократите текст' : 'добавьте содержания'}.`);
  return out;
}

/* Строка из базы → урок для каталога и плеера. Содержимое писал другой человек, поэтому оно проходит cleanLesson */
export function toCourse(row, topics) {
  const c = cleanLesson({ ...obj(row.content), title: row.title, summary: row.summary, topic: row.topic, format: row.format, level: row.level, tags: row.tags });
  if (!topics.includes(c.topic) || c.check.length < 1) return null;
  if (c.outcomes.length === 0) c.outcomes = [c.summary];
  if (!c.sources.length) delete c.sources;
  return {
    ...c, slug: row.slug, community: true, lessonId: row.id,
    author: { id: row.author_id, name: str(row.author && row.author.name, 40) || 'Автор' },
    learners: Number(row.learners) || 0, useful: Number(row.useful) || 0, publishedAt: row.published_at || null,
  };
}

/* Статусы черновика: подпись и тон для интерфейса */
export const STATUS = {
  draft: ['Черновик', ''], review: ['На проверке', 'wait'], approved: ['Опубликован', 'ok'], rejected: ['Возвращён на доработку', 'bad'],
};
