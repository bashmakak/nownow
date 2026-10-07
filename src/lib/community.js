import { useEffect, useState, useSyncExternalStore } from 'react';
import { CLOUD, SUPABASE_KEY, SUPABASE_URL } from '../config.js';
import { client, getAuth } from './cloud.js';
import { COURSE_BY, PUBLIC, isCommunity, registerCourse } from '../data';
import { FORMATS, toCourse } from './lesson-format.js';
import { getState, update } from './store.js';

/* ===== Авторские уроки: чтение опубликованного =====
   Опубликованные уроки лежат в таблице lessons_public и открыты всем, поэтому читаются простым запросом
   с публикуемым ключом: библиотека Supabase и вход для этого не нужны.
   Список для каталога приходит без текста уроков. Текст скачивается, когда урок открывают,
   и тогда урок добавляется к остальным (registerCourse): страница урока и плеер работают с ним как с любым другим.

   Всё, что приходит отсюда, написано другими людьми. Урок проходит через cleanLesson (lib/lesson-format.js),
   а на экран попадает только как текст: разметку и ссылки из него сайт не исполняет. */

const TOPICS = PUBLIC.map(t => t.slug);
/* В запросе названа связь, по которой подставляется автор (внешний ключ lessons_public.author_id): так запрос не зависит от того, какие ещё связи между таблицами найдёт сервер */
const META = 'id,slug,author_id,title,summary,topic,level,format,tags,minutes,learners,useful,published_at,author:authors!lessons_public_author_id_fkey(name)';

async function rest(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/lessons_public?${query}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
}

/* ---------- состояние: что загружено, что грузится, чего нет ---------- */
const subs = new Set();
let tick = 0;
const bump = () => { tick++; subs.forEach(f => f()); };
const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };
/* Подписка для страниц, которые показывают авторские уроки: перерисоваться, когда что-то загрузилось */
export const useCommunityTick = () => useSyncExternalStore(subscribe, () => tick);

const pending = new Map(), missing = new Set(), failed = new Set();

/* Загрузить уроки по slug и добавить к остальным. Уже загруженные не запрашиваются повторно */
export function loadCommunity(slugs) {
  const need = [...new Set(slugs)].filter(s => isCommunity(s) && /^u-[a-z0-9]+$/.test(s) && !COURSE_BY[s] && !pending.has(s) && !missing.has(s));
  if (!CLOUD || !need.length) return Promise.resolve();
  need.forEach(s => failed.delete(s));
  const job = rest(`select=${META},content&hidden=eq.false&slug=in.(${need.join(',')})`).then(rows => {
    rows.forEach(row => { const c = toCourse(row, TOPICS); if (c) registerCourse(c); });
    need.forEach(s => { if (!COURSE_BY[s]) missing.add(s); });       // урок сняли с публикации или его не было
  }, () => { need.forEach(s => failed.add(s)); }).finally(() => { need.forEach(s => pending.delete(s)); bump(); });
  need.forEach(s => pending.set(s, job));
  bump();
  return job;
}

/* Состояние одного урока: 'ready' | 'loading' | 'missing' | 'error' */
export function useCommunityLesson(slug) {
  useCommunityTick();
  useEffect(() => { if (isCommunity(slug)) loadCommunity([slug]); }, [slug]);
  if (COURSE_BY[slug]) return 'ready';
  if (!CLOUD || missing.has(slug) || !/^u-[a-z0-9]+$/.test(slug)) return 'missing';
  return failed.has(slug) ? 'error' : 'loading';
}
export const retryCommunity = slug => { failed.delete(slug); return loadCommunity([slug]); };

/* Авторские уроки, которые человек начинал или добавил в закладки: нужны кабинету */
export function loadMine() {
  const s = getState();
  const slugs = [...Object.keys(s.courses).map(k => k.split('@')[0]), ...s.bookmarks].filter(isCommunity);
  return loadCommunity(slugs);
}

/* ---------- список для каталога: без текста уроков ---------- */
let list = null, listAt = 0, listJob = null;
const card = row => ({
  slug: row.slug, lessonId: row.id, title: String(row.title || ''), summary: String(row.summary || ''), topic: row.topic,
  level: [1, 2, 3].includes(row.level) ? row.level : 1, format: FORMATS.includes(row.format) ? row.format : 'theory', tags: Array.isArray(row.tags) ? row.tags.map(String).slice(0, 3) : [],
  minutes: Number(row.minutes) || 5, learners: Number(row.learners) || 0, useful: Number(row.useful) || 0,
  author: (row.author && String(row.author.name || '')) || 'Автор', publishedAt: row.published_at,
});
/* Все опубликованные уроки, новые первыми. Ответ помнится минуту */
export function listCommunity(force = false) {
  if (!CLOUD) return Promise.resolve([]);
  if (list && !force && Date.now() - listAt < 60000) return Promise.resolve(list);
  if (!listJob) {
    listJob = rest(`select=${META}&hidden=eq.false&order=published_at.desc&limit=300`)
      .then(rows => { list = rows.filter(r => TOPICS.includes(r.topic)).map(card); listAt = Date.now(); return list; })
      .finally(() => { listJob = null; });
  }
  return listJob;
}

/* Список для страницы: { state: 'loading' | 'ready' | 'error', list, retry } */
export function useCommunityList(on = true) {
  const [st, setSt] = useState(() => ({ state: list || !CLOUD ? 'ready' : 'loading', list: list || [] }));
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on || !CLOUD) return undefined;
    let alive = true;
    listCommunity(n > 0).then(l => { if (alive) setSt({ state: 'ready', list: l }); }, () => { if (alive) setSt({ state: 'error', list: [] }); });
    return () => { alive = false; };
  }, [on, n]);
  return { ...st, retry: () => { setSt({ state: 'loading', list: [] }); setN(x => x + 1); } };
}

/* ---------- действия читателя: для них нужен вход ---------- */
const signedIn = () => (CLOUD && getAuth().user ? client() : Promise.resolve(null));
/* Человек прошёл авторский урок: автору начисляются искры (один раз за человека, см. complete_lesson в базе).
   Без входа ничего не происходит: начислять не за кого. */
export async function creditAuthor(lessonId, useful = false) {
  try {
    const c = await signedIn();
    if (!c || !lessonId) return false;
    const { error } = await c.rpc('complete_lesson', { p_lesson: lessonId, p_useful: Boolean(useful) });
    return !error;
  } catch { return false; }
}
/* Довести начисления авторам по всем пройденным авторским урокам, которые сейчас загружены.
   В прогрессе урока остаётся отметка credited: 1 — прохождение учтено, 2 — учтена и оценка «полезно».
   Вызывается на экране завершения урока и в кабинете: так учитываются и уроки, пройденные до входа или без сети. */
let settling = null;
export function settleCredits() {
  if (!CLOUD || !getAuth().user) return Promise.resolve();
  if (settling) return settling;
  settling = (async () => {
    for (const [key, p] of Object.entries(getState().courses)) {
      const c = COURSE_BY[key];
      if (!c || !c.community || !p.completed) continue;
      const want = p.useful === 'yes' ? 2 : 1;
      if ((p.credited || 0) >= want) continue;
      if (await creditAuthor(c.lessonId, want === 2)) update(d => { if (d.courses[key]) d.courses[key].credited = want; });
    }
  })().finally(() => { settling = null; });
  return settling;
}

/* Жалоба на урок: её видят модераторы. Возвращает 'sent' | 'again' (уже жаловались) | 'guest' | 'error' */
export async function reportLesson(lessonId, reason) {
  try {
    const c = await signedIn();
    if (!c) return 'guest';
    const { error } = await c.from('reports').insert({ lesson_id: lessonId, user_id: getAuth().user.id, reason: reason.trim().slice(0, 600) });
    if (!error) return 'sent';
    return error.code === '23505' ? 'again' : 'error';
  } catch { return 'error'; }
}
