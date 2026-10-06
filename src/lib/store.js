import { useSyncExternalStore } from 'react';
import { BLOCKS } from '../data';

/* Прогресс, закладки и заметки живут в браузере: сервера у сайта нет. */
const KEY = 'nownow.v1';
const fresh = () => ({ theme: 'dark', name: '', bookmarks: [], courses: {}, notes: {}, activity: {} });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...JSON.parse(raw) };
  } catch { /* хранилище недоступно: работаем в памяти */ }
  return fresh();
}

let state = load();
const subs = new Set();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* без сохранения */ } };
const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };

export const getState = () => state;
export function update(fn) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  persist();
  subs.forEach(f => f());
}
export const useStore = () => useSyncExternalStore(subscribe, getState);

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = draft => draft.activity[dayKey()] || (draft.activity[dayKey()] = { sec: 0, blocks: 0 });

export const newProgress = () => ({
  started: Date.now(), touched: Date.now(), completed: null, finished: false, block: 0,
  done: [0, 0, 0, 0, 0, 0], elapsed: [0, 0, 0, 0, 0, 0], seconds: 0, answers: {}, steps: {}, work: {}, reflect: '', useful: null,
});
export const ensureProgress = (draft, slug) => draft.courses[slug] || (draft.courses[slug] = newProgress());

export function status(s, slug) {
  const p = s.courses[slug];
  if (!p) return 'new';
  if (p.finished) return 'done';
  if (p.done.some(Boolean) || p.block > 0 || p.seconds > 0) return 'progress';
  return p.completed ? 'done' : 'new';
}
export function remaining(s, slug) {
  const p = s.courses[slug];
  return p ? BLOCKS.reduce((sum, b, i) => sum + (p.done[i] ? 0 : b.min), 0) : 30;
}
export function streak(s) {
  const has = k => s.activity[k] && s.activity[k].blocks > 0;
  const d = new Date();
  if (!has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function restartCourse(slug) {
  update(d => {
    Object.assign(ensureProgress(d, slug), {
      finished: false, block: 0, done: [0, 0, 0, 0, 0, 0], elapsed: [0, 0, 0, 0, 0, 0], seconds: 0, answers: {}, steps: {}, touched: Date.now(),
    });
  });
}
export function toggleBookmark(slug) {
  let added = false;
  update(d => {
    const i = d.bookmarks.indexOf(slug);
    if (i < 0) { d.bookmarks.unshift(slug); added = true; } else d.bookmarks.splice(i, 1);
  });
  return added;
}
export function applyTheme(theme) {
  const el = document.documentElement;
  if (theme === 'system') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', theme);
}
export function setTheme(theme) { update(d => { d.theme = theme; }); applyTheme(theme); }
export function resetAll() { const theme = state.theme; update(d => { Object.assign(d, fresh(), { theme }); }); }

export const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
};
export const nCourses = n => `${n} ${plural(n, ['курс', 'курса', 'курсов'])}`;
export const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').trim();
