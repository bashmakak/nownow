import { useSyncExternalStore } from 'react';
import { COURSE_BY, timing } from '../data';

/* Прогресс, закладки и заметки живут в браузере. Если человек вошёл в учётную запись, копия
   хранится в облаке и сводится с другими устройствами (см. lib/sync.js); без входа сайт работает так же. */
const KEY = 'nownow.v1';
/* game — всё, что относится к тренажёрам и наградам: опыт за раунды, лучшие результаты, сыгранное по дням,
   показанные достижения. Опыт за уроки здесь не хранится: он считается по прогрессу (см. lib/game.js). */
const freshGame = () => ({ xp: 0, best: {}, days: {}, dailies: 0, seen: null, lvl: 1 });
/* owner — чья это копия: идентификатор учётной записи или null, пока человек не входил.
   resetAt — когда прогресс сбросили: по нему другие устройства понимают, что данные надо убрать, а не вернуть. */
const fresh = () => ({ theme: 'dark', name: '', version: 'short', bookmarks: [], courses: {}, notes: {}, activity: {}, game: freshGame(), owner: null, resetAt: 0 });

/* Прогресс короткой версии хранится под slug урока, полной — под «slug@full».
   Заметки к блокам: «ключ:номер блока». */
export const pkey = (slug, v) => (v === 'full' ? `${slug}@full` : slug);
export const splitKey = k => { const i = k.indexOf('@'); return i < 0 ? [k, 'short'] : [k.slice(0, i), k.slice(i + 1) === 'full' ? 'full' : 'short']; };

/* До появления версий полный урок хранил прогресс под обычным slug. Его узнаём по рабочему листу
   или по ответам на четвёртый и пятый вопросы и переносим под ключ полной версии. */
function migrate(st) {
  Object.keys(st.courses).forEach(k => {
    const c = COURSE_BY[k], p = st.courses[k], fk = pkey(k, 'full');
    if (!c || !c.full || st.courses[fk]) return;
    const wasFull = Object.values(p.work || {}).some(v => (v || '').trim()) || Object.keys(p.answers || {}).some(i => +i >= c.check.length);
    if (!wasFull) return;
    st.courses[fk] = p; delete st.courses[k];
    Object.keys(st.notes).forEach(n => { if (n.startsWith(`${k}:`)) { st.notes[`${fk}:${n.slice(k.length + 1)}`] = st.notes[n]; delete st.notes[n]; } });
  });
  return st;
}

const shape = raw => { const st = { ...fresh(), ...raw }; st.game = { ...freshGame(), ...(st.game || {}) }; return migrate(st); };
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return shape(JSON.parse(raw));
  } catch { /* хранилище недоступно: работаем в памяти */ }
  return fresh();
}

let state = load();
const subs = new Set();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* без сохранения */ } };
const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };
export const onChange = subscribe;

/* Сайт открыт в двух вкладках: изменения из соседней вкладки подхватываем сразу, чтобы вкладки не затирали друг друга */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    try { state = shape(JSON.parse(e.newValue)); subs.forEach(f => f()); } catch { /* чужая запись не разобралась: остаёмся при своём */ }
  });
}

export const getState = () => state;
export function update(fn) {
  const next = structuredClone(state);
  fn(next);
  state = next;
  persist();
  subs.forEach(f => f());
}
export const useStore = () => useSyncExternalStore(subscribe, getState);
/* Подставить состояние целиком: так приходят данные из облака. Тема оформления остаётся своей на каждом устройстве. */
export function replaceState(next, owner) {
  state = shape({ ...next, theme: state.theme, owner });
  persist();
  subs.forEach(f => f());
}
/* Выход из учётной записи: в браузере не остаётся ни прогресса, ни заметок */
export function clearLocal() { replaceState(fresh(), null); }

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = draft => draft.activity[dayKey()] || (draft.activity[dayKey()] = { sec: 0, blocks: 0, games: 0 });
/* День засчитан, если пройден хотя бы один блок урока или сыгран раунд в тренажёре */
export const activeDay = a => Boolean(a && (a.blocks > 0 || a.games > 0));

export const newProgress = () => ({
  started: Date.now(), touched: Date.now(), completed: null, finished: false, block: 0,
  done: [0, 0, 0, 0, 0, 0], elapsed: [0, 0, 0, 0, 0, 0], seconds: 0, answers: {}, steps: {}, work: {}, reflect: '', useful: null,
});
export const ensureProgress = (draft, key) => draft.courses[key] || (draft.courses[key] = newProgress());

const stateOf = p => {
  if (!p) return 'new';
  if (p.finished) return 'done';
  if (p.done.some(Boolean) || p.block > 0 || p.seconds > 0) return 'progress';
  return p.completed ? 'done' : 'new';
};
/* Состояние одной версии урока */
export const statusOf = (s, slug, v) => stateOf(s.courses[pkey(slug, v)]);
/* Состояние урока в целом: начатая версия важнее пройденной */
export function status(s, slug) {
  const a = statusOf(s, slug, 'short'), b = statusOf(s, slug, 'full');
  return a === 'progress' || b === 'progress' ? 'progress' : a === 'done' || b === 'done' ? 'done' : 'new';
}
/* Версия, которая откроется по умолчанию: начатая, иначе выбранная человеком, если она у урока есть */
export function activeVersion(s, course) {
  const live = ['short', 'full'].filter(v => statusOf(s, course.slug, v) === 'progress')
    .sort((a, b) => (s.courses[pkey(course.slug, b)].touched || 0) - (s.courses[pkey(course.slug, a)].touched || 0));
  if (live[0]) return live[0];
  return s.version === 'full' && course.full ? 'full' : 'short';
}
/* Сколько осталось по оценке времени: секунды непройденных блоков */
export function remainingSec(s, course, v) {
  const p = s.courses[pkey(course.slug, v)], t = timing(course, v);
  return p ? t.blocks.reduce((sum, sec, i) => sum + (p.done[i] ? 0 : sec), 0) : t.total;
}
export const leftLabel = sec => (sec < 45 ? 'Осталось меньше минуты' : `Осталось ${Math.max(1, Math.round(sec / 60))} мин`);
export function setVersion(v) { update(d => { d.version = v === 'full' ? 'full' : 'short'; }); }
export function streak(s) {
  const has = k => activeDay(s.activity[k]);
  const d = new Date();
  if (!has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function restartCourse(key) {
  update(d => {
    Object.assign(ensureProgress(d, key), {
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
/* Сброс прогресса. Для вошедшего человека запоминаем время сброса: другие его устройства тоже очистятся.
   Без входа отметка не нужна, иначе при первом входе пустая копия стёрла бы прогресс в учётной записи. */
export function resetAll() { const { theme, owner } = state; update(d => { Object.assign(d, fresh(), { theme, owner, resetAt: owner ? Date.now() : 0 }); }); }

export const plural = (n, f) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
};
/* «около 5 минут», «от 3 до 6 минут»: родительный падеж */
export const genMin = n => (n % 10 === 1 && n % 100 !== 11 ? 'минуты' : 'минут');
export const aboutMin = n => `около ${n} ${genMin(n)}`;
export const nMin = n => `${n} ${plural(n, ['минута', 'минуты', 'минут'])}`;
export const nCourses = n => `${n} ${plural(n, ['курс', 'курса', 'курсов'])}`;
export const norm = s => String(s).toLowerCase().replace(/ё/g, 'е').trim();
