/* ===== Слияние прогресса с двух устройств =====
   Чистые функции без зависимостей: ими пользуется синхронизация и тест scripts/test-merge.mjs.

   Сливаются три состояния: local — то, что в этом браузере, remote — то, что лежит в облаке,
   base — что было на этом устройстве после прошлой синхронизации. База нужна, чтобы отличить
   «удалили здесь» от «добавили там»: без неё удалённая закладка возвращалась бы с другого устройства.

   Правила:
   - изменилось только с одной стороны — берём эту сторону;
   - изменилось с обеих — урок берём тот, которым занимались позже, и не теряем написанное;
     счётчики (опыт, число раундов) складываем, отметки и списки объединяем;
   - если прогресс сбросили, побеждает сторона с более поздним сбросом. */

export const SYNC_KEYS = ['name', 'version', 'bookmarks', 'courses', 'notes', 'activity', 'game', 'interests', 'interestsAt', 'resetAt'];
const EMPTY = { name: '', version: 'short', bookmarks: [], courses: {}, notes: {}, activity: {}, game: { xp: 0, best: {}, days: {}, dailies: 0, seen: null, lvl: 1 }, interests: [], interestsAt: 0, resetAt: 0 };

/* Равенство по содержимому: порядок ключей не важен (база данных хранит их в своём порядке) */
export function same(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  return ka.length === kb.length && ka.every(k => same(a[k], b[k]));
}

/* Только те поля, что уходят в облако */
export const synced = st => Object.fromEntries(SYNC_KEYS.map(k => [k, st[k] === undefined ? EMPTY[k] : st[k]]));
const full = st => ({ ...structuredClone(EMPTY), ...structuredClone(st || {}), game: { ...structuredClone(EMPTY.game), ...structuredClone((st && st.game) || {}) } });

const pick = (l, r, b, clash) => (same(l, r) ? l : same(l, b) ? r : same(r, b) ? l : clash(l, r));
const filled = v => typeof v === 'string' && v.trim().length > 0;
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/* Счётчик, который на каждом устройстве только растёт: к базе прибавляем прирост обеих сторон */
const grow = (l, r, b) => Math.max(num(l), num(r), num(b) + Math.max(0, num(l) - num(b)) + Math.max(0, num(r) - num(b)));

/* Один урок изменили на двух устройствах: за основу берём тот, которым занимались позже */
function mergeCourse(l, r) {
  const [a, o] = num(l.touched) >= num(r.touched) ? [l, r] : [r, l];
  const out = structuredClone(a);
  const done = [a.completed, o.completed].filter(Boolean);
  out.completed = done.length ? Math.min(...done) : null;          // когда урок прошли впервые
  if (a.right != null || o.right != null) out.right = Math.max(num(a.right), num(o.right));
  out.started = Math.min(num(a.started) || Infinity, num(o.started) || Infinity);
  if (!Number.isFinite(out.started)) out.started = a.started;
  // написанное в практике не теряем: пустое поле заполняем тем, что есть на другой стороне
  if (!filled(out.reflect) && filled(o.reflect)) out.reflect = o.reflect;
  const work = { ...(o.work || {}), ...(a.work || {}) };
  Object.keys(work).forEach(k => { if (!filled(work[k]) && filled((o.work || {})[k])) work[k] = o.work[k]; });
  out.work = work;
  // задание считается выполненным, если выполнено хотя бы на одном устройстве
  const play = { ...(o.play || {}) };
  Object.entries(a.play || {}).forEach(([k, v]) => { const w = play[k]; play[k] = w ? { done: Boolean(v.done || w.done), right: Math.max(num(v.right), num(w.right)), total: Math.max(num(v.total), num(w.total)) } : v; });
  if (Object.keys(play).length) out.play = play;
  if (a.useful == null && o.useful != null) out.useful = o.useful;
  // авторские уроки: число вопросов и отметка о том, что автору уже начислены искры
  if (a.checks == null && o.checks != null) out.checks = o.checks;
  if (a.credited || o.credited) out.credited = Math.max(num(a.credited), num(o.credited));
  return out;
}

/* Словарь «ключ → значение»: каждое значение сливается отдельно; удалённое с одной стороны удаляется */
function mergeMap(l, r, b, clash) {
  const out = {};
  new Set([...Object.keys(l), ...Object.keys(r)]).forEach(k => {
    const inL = k in l, inR = k in r, inB = k in b;
    if (inL && inR) out[k] = pick(l[k], r[k], b[k], clash);
    else if (inL) { if (!inB || !same(l[k], b[k])) out[k] = l[k]; }      // есть только здесь: новое или изменённое после удаления там
    else if (!inB || !same(r[k], b[k])) out[k] = r[k];
  });
  return out;
}
function mergeList(l, r, b) {
  const gone = b.filter(x => !l.includes(x) || !r.includes(x));
  return [...new Set([...l, ...r])].filter(x => !gone.includes(x));
}

function mergeGame(l, r, b) {
  const best = {};
  new Set([...Object.keys(l.best), ...Object.keys(r.best)]).forEach(id => {
    const x = l.best[id] || {}, y = r.best[id] || {}, z = (b.best || {})[id] || {};
    best[id] = { score: Math.max(num(x.score), num(y.score)), bolts: Math.max(num(x.bolts), num(y.bolts)), plays: grow(x.plays, y.plays, z.plays), last: Math.max(num(x.last), num(y.last)) || undefined };
    // у мини-игр рядом с очками лежит результат в своих единицах (секунды, клетки): берём его у лучшей попытки
    const top = num(x.score) >= num(y.score) ? x : y;
    if (top.raw != null) best[id].raw = top.raw;
  });
  const days = {};
  new Set([...Object.keys(l.days), ...Object.keys(r.days)]).forEach(d => {
    const x = l.days[d], y = r.days[d];
    if (!x || !y) { days[d] = x || y; return; }
    days[d] = { plan: x.plan || y.plan, done: [...new Set([...(x.done || []), ...(y.done || [])])], bonus: Boolean(x.bonus || y.bonus) };
  });
  const seen = l.seen || r.seen ? [...new Set([...(l.seen || []), ...(r.seen || [])])] : null;
  return { xp: grow(l.xp, r.xp, b.xp), best, days, dailies: Math.max(num(l.dailies), num(r.dailies)), seen, lvl: Math.max(num(l.lvl), num(r.lvl), 1) };
}

/* База потерялась (например, браузер не смог её сохранить), а устройство уже синхронизировалось.
   Списки и уроки тогда просто объединяются, но счётчики складывать нельзя: опыт посчитался бы дважды.
   Поэтому за базу для счётчиков берём меньшее из двух значений. */
export function floorBase(localState, remoteState) {
  const l = full(localState), r = full(remoteState), best = {};
  Object.keys(l.game.best).forEach(id => { if (r.game.best[id]) best[id] = { plays: Math.min(num(l.game.best[id].plays), num(r.game.best[id].plays)) }; });
  return { game: { xp: Math.min(num(l.game.xp), num(r.game.xp)), best } };
}

/* Итог слияния: только синхронизируемые поля. base = null означает, что устройство ещё не синхронизировалось */
export function merge(localState, remoteState, baseState) {
  const l = full(localState);
  if (!remoteState) return synced(l);
  const r = full(remoteState);
  // сброс прогресса: сторона с более поздним сбросом берётся целиком
  if (num(l.resetAt) !== num(r.resetAt)) return synced(num(l.resetAt) > num(r.resetAt) ? l : r);
  const b = full(baseState);
  const activity = mergeMap(l.activity, r.activity, b.activity, (x, y) => ({ sec: Math.max(num(x.sec), num(y.sec)), blocks: Math.max(num(x.blocks), num(y.blocks)), games: Math.max(num(x.games), num(y.games)) }));
  return {
    name: pick(l.name, r.name, b.name, x => x),
    version: pick(l.version, r.version, b.version, x => x),
    bookmarks: mergeList(l.bookmarks, r.bookmarks, b.bookmarks),
    courses: mergeMap(l.courses, r.courses, b.courses, mergeCourse),
    notes: mergeMap(l.notes, r.notes, b.notes, (x, y) => (filled(x) ? x : y)),
    activity,
    game: mergeGame(l.game, r.game, b.game),
    interests: mergeList(l.interests, r.interests, b.interests),
    interestsAt: Math.max(num(l.interestsAt), num(r.interestsAt)),
    resetAt: num(l.resetAt),
  };
}
