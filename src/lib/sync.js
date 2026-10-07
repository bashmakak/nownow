import { KEYS } from '../config.js';
import { client, endSession, friendly, getAuth, makeStore, onAuth } from './cloud.js';
import { floorBase, merge, same, synced } from './merge.js';
import { clearLocal, getState, onChange, replaceState } from './store.js';

/* ===== Синхронизация прогресса =====
   В облаке у человека одна строка: всё состояние учёбы одним документом (таблица progress).
   Один проход: забрать строку → свести с тем, что в браузере (lib/merge.js) → записать итог в браузер
   и, если он отличается от облака, обратно в облако.

   Запись идёт с проверкой номера версии (rev): если другое устройство успело записать раньше,
   строка не обновится, и проход повторится с новыми данными. Так устройства не затирают друг друга.

   Проход запускается после входа, при возвращении на вкладку, при уходе с неё и не чаще раза
   в минуту, пока человек учится. Без сети всё продолжает работать: изменения уйдут позже. */

const EVERY = 60 * 1000;      // во время урока состояние меняется каждую секунду: пишем не чаще
const SOON = 4 * 1000;        // после входа и при смене страницы
const LIMIT = 900 * 1000;     // размер документа, который ещё принимает база (там порог около мегабайта)

/* phase: off — человек не вошёл; syncing; ok; error; offline; paused — подана заявка на удаление.
   at — когда данные в последний раз сошлись с облаком */
const status = makeStore({ phase: 'off', at: 0, error: null, deleteAt: null });
export const useSync = status.use;
export const getSync = status.get;

let uid = null;          // чей прогресс сейчас синхронизируется
let running = null;      // идущий проход
let timer = 0, due = 0;  // отложенный запуск
let changes = 0, sent = 0;   // счётчик правок в браузере и его значение на момент последней записи в облако
let fails = 0, lastRun = 0;

/* База — что было на этом устройстве после прошлого прохода. Нужна, чтобы отличать удалённое от нового */
const readBase = id => { try { const b = JSON.parse(localStorage.getItem(KEYS.base) || 'null'); return b && b.uid === id ? b : null; } catch { return null; } };
const writeBase = b => { try { localStorage.setItem(KEYS.base, JSON.stringify(b)); } catch { /* без базы слияние просто ничего не удаляет */ } };
const dropBase = () => { try { localStorage.removeItem(KEYS.base); } catch { /* нечего удалять */ } };

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/* В браузере остались данные другой учётной записи (её сеанс истёк, а выйти не успели): новому человеку их не показываем */
const dropForeign = me => { const o = getState().owner; if (o && o !== me) { clearLocal(); dropBase(); } };
const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

async function pass(c, me) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const got = await c.from('progress').select('state,rev').eq('user_id', me).maybeSingle();
    if (got.error) throw got.error;
    if (uid !== me) return 'stopped';
    const row = got.data;
    if (row && row.state && row.state.deleteRequested) { status.set({ phase: 'paused', deleteAt: row.state.deleteRequested, error: null }); return 'paused'; }

    // ---- дальше до записи в облако всё синхронно: состояние в браузере не успеет измениться
    dropForeign(me);
    const local = getState();
    const owned = local.owner === me;
    const remote = row ? row.state : null;
    const saved = owned ? readBase(me) : null;
    const base = saved ? saved.state : owned && remote ? floorBase(local, remote) : null;
    // прогресс, набранный до входа, — это новые данные: сброс, сделанный когда-то в учётной записи, его не касается
    const mine = owned ? local : { ...local, resetAt: num(remote && remote.resetAt) };
    const merged = merge(mine, remote, base);
    if (!owned || !same(merged, synced(local))) replaceState({ ...local, ...merged }, me);
    const mark = changes;

    if (JSON.stringify(merged).length > LIMIT) throw Object.assign(new Error('too big'), { code: 'too_big' });
    let rev = row ? row.rev : 0;
    if (!row) {
      const ins = await c.from('progress').insert({ user_id: me, state: merged }).select('rev');
      if (ins.error && ins.error.code === '23505') continue;                 // строку только что создало другое устройство
      if (ins.error) throw ins.error;
      rev = ins.data[0].rev;
    } else if (!same(merged, remote)) {
      const up = await c.from('progress').update({ state: merged }).eq('user_id', me).eq('rev', row.rev).select('rev');
      if (up.error) throw up.error;
      if (!up.data.length) continue;                                         // другое устройство записало раньше: сводим заново
      rev = up.data[0].rev;
    }
    if (uid !== me) return 'stopped';
    writeBase({ uid: me, rev, state: merged });
    sent = mark;
    return 'ok';
  }
  throw Object.assign(new Error('conflict'), { code: 'conflict' });
}

/* Запустить проход сейчас. Возвращает true, если данные сошлись с облаком */
export function syncNow() {
  if (!uid) return Promise.resolve(false);
  if (running) return running;
  clearTimeout(timer); timer = 0; due = 0;
  if (offline()) { status.set({ phase: 'offline' }); return Promise.resolve(false); }
  const me = uid;
  if (status.get().phase !== 'paused') status.set({ phase: 'syncing' });
  lastRun = Date.now();
  running = (async () => {
    try {
      const res = await pass(await client(), me);
      if (res === 'ok') { fails = 0; status.set({ phase: 'ok', at: Date.now(), error: null, deleteAt: null }); }
      return res === 'ok';
    } catch (e) {
      if (uid !== me) return false;
      fails++;
      const lost = offline() || friendly(e).code === 'network';
      status.set({ phase: lost ? 'offline' : 'error', error: e && e.code === 'too_big' ? 'too_big' : lost ? null : 'failed' });
      plan(Math.min(10 * 60 * 1000, EVERY * 2 ** Math.min(fails, 4)));       // повторим позже, с растущей паузой
      return false;
    } finally {
      running = null;
      if (uid === me && changes !== sent && status.get().phase === 'ok') plan(EVERY);   // за время прохода человек успел что-то сделать
    }
  })();
  return running;
}

function plan(delay) {
  if (!uid) return;
  const at = Date.now() + delay;
  if (timer && due <= at) return;
  clearTimeout(timer);
  due = at;
  timer = setTimeout(() => { timer = 0; due = 0; syncNow(); }, delay);
}
/* Скоро, но не чаще раза в несколько секунд: смена страницы, уход с вкладки */
const soon = () => { if (uid && changes !== sent && status.get().phase !== 'paused') plan(Math.max(0, SOON - (Date.now() - lastRun))); };

function start(id) {
  uid = id; fails = 0; sent = -1;
  dropForeign(id);                 // сразу, не дожидаясь ответа базы: сети может не быть
  status.set({ phase: 'syncing', at: 0, error: null, deleteAt: null });
  syncNow();
}
function stop() {
  uid = null;
  clearTimeout(timer); timer = 0; due = 0;
  status.set({ phase: 'off', at: 0, error: null, deleteAt: null });
}

/* Подключение к сайту: вызывается один раз при запуске */
export function watch() {
  const check = () => {
    // пока человек по ссылке из письма задаёт новый пароль, прогресс не трогаем (см. lib/cloud.js)
    const a = getAuth(), id = a.ready && a.user && !a.recovery ? a.user.id : null;
    if (id === uid) return;
    if (id) start(id); else stop();
  };
  onAuth(check);
  check();
  onChange(() => { changes++; if (uid && status.get().phase !== 'paused') plan(EVERY); });
  window.addEventListener('hashchange', soon);
  window.addEventListener('online', () => { if (uid) syncNow(); });
  document.addEventListener('visibilitychange', () => {
    if (!uid) return;
    if (document.hidden) { if (changes !== sent && status.get().phase !== 'paused') syncNow(); }   // уходим с вкладки: отправляем, что накопилось
    else if (Date.now() - lastRun > 15 * 1000) syncNow();                                          // вернулись: забираем сделанное на другом устройстве
  });
}

/* ---------- действия с учётной записью, которые затрагивают данные ---------- */

/* Выход. Сначала отправляем несохранённое; если не вышло, спрашиваем человека (force — выйти всё равно).
   После выхода в браузере не остаётся ни прогресса, ни заметок: компьютер может быть общим. */
export async function signOut(force = false) {
  if (uid && !force && status.get().phase !== 'paused' && changes !== sent) {
    const ok = await syncNow();
    if (!ok && changes !== sent) return { unsaved: true };
  }
  stop();
  await endSession();
  clearLocal();
  dropBase();
  return { unsaved: false };
}

/* Копия всех данных человека одним файлом */
export async function exportData() {
  const a = getAuth().user;
  let consent = null;
  if (a) {
    try {
      const c = await client();
      const res = await c.from('profiles').select('terms_version,privacy_version,consent_at,created_at').eq('id', a.id).maybeSingle();
      consent = res.data || null;
    } catch { /* без сети выгрузим то, что есть в браузере */ }
  }
  return { exported_at: new Date().toISOString(), account: a ? { email: a.email, id: a.id, created_at: a.createdAt } : null, consent, progress: synced(getState()) };
}

/* Удаление учётной записи. Возвращает 'deleted' или 'requested'.
   Если в базе нет функции delete_account (см. supabase/schema.sql), прогресс в облаке заменяется
   заявкой на удаление: саму запись с адресом почты владелец сайта удаляет вручную. */
export async function deleteAccount() {
  const me = uid || (getAuth().user && getAuth().user.id);
  if (!me) throw friendly({ code: 'session_not_found' });
  let c, done = 'deleted';
  try { c = await client(); } catch (e) { throw friendly(e); }
  const res = await c.rpc('delete_account');
  if (res.error && res.error.code === 'PGRST202') {
    const state = { deleteRequested: new Date().toISOString() };
    const up = await c.from('progress').update({ state }).eq('user_id', me).select('rev');
    if (up.error) throw friendly(up.error);
    if (!up.data.length) {
      const ins = await c.from('progress').insert({ user_id: me, state });
      if (ins.error) throw friendly(ins.error);
    }
    done = 'requested';
  } else if (res.error) throw friendly(res.error);
  stop();
  await endSession();
  clearLocal();
  dropBase();
  return done;
}

/* Отменить заявку на удаление: в облако возвращается то, что сейчас в браузере */
export async function cancelDelete() {
  if (!uid) return;
  const me = uid;
  let c;
  try { c = await client(); } catch (e) { throw friendly(e); }
  const up = await c.from('progress').update({ state: synced(getState()) }).eq('user_id', me).select('rev');
  if (up.error) throw friendly(up.error);
  status.set({ phase: 'syncing', deleteAt: null });
  await syncNow();
}
