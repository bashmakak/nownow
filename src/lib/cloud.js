import { useSyncExternalStore } from 'react';
import { CLOUD, DOCS, KEYS, SUPABASE_KEY, SUPABASE_URL } from '../config.js';

/* ===== Учётная запись =====
   Вход по адресу почты и паролю через Supabase. Пароль уходит только в службу входа Supabase по HTTPS:
   сайт его не хранит, не пишет в журнал и не кладёт в адрес страницы. В браузере остаётся только
   сеанс (ключ nownow.auth) — пара временных токенов, по которым пароль восстановить нельзя.

   Библиотека Supabase скачивается, только когда она нужна: есть сохранённый сеанс, человек пришёл
   по ссылке из письма или открыл страницу входа. Тем, кто учится без учётной записи, она не грузится. */

/* Маленькое хранилище с подпиской: им пользуются и вход, и синхронизация */
export function makeStore(initial) {
  let value = initial;
  const subs = new Set();
  const get = () => value;
  const set = patch => { value = { ...value, ...patch }; subs.forEach(f => f()); };
  const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };
  return { get, set, subscribe, use: () => useSyncExternalStore(subscribe, get) };
}

/* ready — стало известно, вошёл человек или нет; user — { id, email, createdAt } или null;
   recovery — человек пришёл по ссылке «сбросить пароль» и должен задать новый;
   notice — одноразовое сообщение после перехода по ссылке из письма:
   'confirmed' (адрес подтверждён, человек вошёл), 'confirmed-login' (подтверждён, нужно войти), 'link-failed' */
const auth = makeStore({ ready: !CLOUD, user: null, recovery: false, notice: null });
export const useAuth = auth.use;
export const getAuth = auth.get;
export const onAuth = auth.subscribe;
export const clearNotice = () => auth.set({ notice: null });

/* Адрес сайта без параметров: на него возвращают ссылки из писем */
export const siteUrl = () => window.location.origin + window.location.pathname;

const userOf = u => (u ? { id: u.id, email: u.email || '', createdAt: u.created_at || null } : null);

/* ---------- защита от чужой ссылки ----------
   Ссылку с токенами может прислать кто угодно: «перейдите, это ваш урок». Если просто принять её,
   человек окажется в чужой учётной записи, и его прогресс из браузера уйдёт её владельцу.
   Поэтому по ссылке подтверждения сайт входит сам, только если регистрацию начинали в этом же браузере
   (здесь запомнен идентификатор новой записи — случайная строка, без адреса почты). Иначе адрес считается
   подтверждённым, а войти нужно с паролем. Сеанс по ссылке «сбросить пароль» живёт, пока не задан новый
   пароль: до этого прогресс не синхронизируется, а в другой вкладке или при следующем открытии сайта
   такой сеанс закрывается. Перезагрузку той же вкладки он переживает: телефон часто перезагружает страницу,
   пока человек ходит за паролем в другое приложение. */
const DAY = 24 * 60 * 60 * 1000;
const readFlow = () => { try { return JSON.parse(localStorage.getItem(KEYS.flow) || '{}') || {}; } catch { return {}; } };
const writeFlow = patch => {
  try {
    const next = { ...readFlow(), ...patch };
    Object.keys(next).forEach(k => { if (next[k] == null) delete next[k]; });
    if (Object.keys(next).length) localStorage.setItem(KEYS.flow, JSON.stringify(next)); else localStorage.removeItem(KEYS.flow);
  } catch { /* без хранилища вход по ссылке просто попросит пароль */ }
};
const tabRecovery = on => {
  try {
    if (on === undefined) return sessionStorage.getItem(KEYS.flow) === 'recovery';
    if (on) sessionStorage.setItem(KEYS.flow, 'recovery'); else sessionStorage.removeItem(KEYS.flow);
  } catch { /* вкладка без хранилища: после перезагрузки ссылку придётся запросить снова */ }
  return false;
};
const setRecovery = on => { writeFlow({ recovery: on ? true : null }); tabRecovery(on); };
const startedHere = id => { const s = readFlow().signup; return Boolean(id && s && s.id === id && Date.now() - s.at < 2 * DAY); };
const subOf = token => { try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || null; } catch { return null; } };

/* ---------- ссылка из письма ----------
   Supabase возвращает человека на сайт с данными после знака #: «#access_token=…&type=recovery».
   Маршруты сайта тоже живут после #, поэтому разбираем это сами до запуска страниц и сразу
   убираем из адреса: токены не остаются ни в строке адреса, ни в истории браузера. */
function capture() {
  const { hash, search, pathname } = window.location;
  const h = /^#(access_token|error|error_code|error_description)=/.test(hash) ? new URLSearchParams(hash.slice(1)) : null;
  const q = new URLSearchParams(search);
  let found = null;
  if (h && h.get('access_token') && h.get('refresh_token')) {
    const type = h.get('type') || 'signup';
    // чужую ссылку подтверждения не принимаем: токены отбрасываются, человек входит с паролем
    found = type === 'recovery' || startedHere(subOf(h.get('access_token')))
      ? { tokens: { access_token: h.get('access_token'), refresh_token: h.get('refresh_token') }, type }
      : { confirmed: true };
  } else if (q.get('token_hash') && q.get('type')) {
    // вариант ссылки для своих шаблонов писем: работает, даже если письмо открыли на другом устройстве
    found = { otp: { token_hash: q.get('token_hash'), type: q.get('type') }, type: q.get('type') };
  } else if ((h && (h.get('error') || h.get('error_code'))) || q.get('error_code') || q.get('error')) {
    found = { failed: true };
  }
  if (!found) return null;
  const route = found.failed || found.confirmed ? '/login' : found.type === 'recovery' ? '/account/password' : '/me';
  try { window.history.replaceState(null, '', `${pathname}#${route}`); } catch { window.location.hash = route; }
  return found;
}
const pending = CLOUD && typeof window !== 'undefined' ? capture() : null;

/* ---------- клиент ---------- */
let clientP = null;
export function client() {
  if (!CLOUD) return Promise.reject(Object.assign(new Error('cloud off'), { code: 'cloud_off' }));
  if (!clientP) {
    clientP = import('@supabase/supabase-js').then(({ createClient }) => {
      const c = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { flowType: 'implicit', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true, storageKey: KEYS.auth },
      });
      // внутри обработчика нельзя вызывать методы входа: откладываем на следующий тик
      c.auth.onAuthStateChange((event, session) => { setTimeout(() => {
        if (event === 'SIGNED_OUT') auth.set({ user: null, recovery: false });
        else if (session) auth.set({ user: userOf(session.user) });
      }, 0); });
      return c;
    }).catch(e => { clientP = null; throw e; });
  }
  return clientP;
}

const hasStored = () => { try { return Boolean(localStorage.getItem(KEYS.auth)); } catch { return false; } };

/* Запуск при открытии сайта: восстановить сеанс или принять ссылку из письма */
export async function boot() {
  if (!CLOUD) return;
  if (!pending && !hasStored()) { auth.set({ ready: true }); return; }
  try {
    const c = await client();
    const recovering = Boolean(pending && pending.type === 'recovery');
    let notice = null, recovery = false;
    // остался сеанс по ссылке сброса, а пароль так и не задали: в той же вкладке продолжаем, иначе закрываем его
    if (readFlow().recovery && !recovering) {
      if (tabRecovery()) recovery = true;
      else { await c.auth.signOut({ scope: 'local' }); setRecovery(false); }
    }
    if (pending && pending.failed) notice = 'link-failed';
    else if (pending && pending.confirmed) notice = 'confirmed-login';
    else if (pending) {
      if (recovering) setRecovery(true);
      const res = pending.tokens ? await c.auth.setSession(pending.tokens) : await c.auth.verifyOtp(pending.otp);
      const got = res.data && res.data.session;
      if (res.error || !got) { notice = 'link-failed'; if (recovering) setRecovery(false); }
      else if (recovering) recovery = true;
      else if (startedHere(got.user.id)) { notice = 'confirmed'; writeFlow({ signup: null }); }
      else { await c.auth.signOut({ scope: 'local' }); notice = 'confirmed-login'; }
      if (notice && notice !== 'confirmed') window.location.hash = '/login';
    }
    const { data } = await c.auth.getSession();
    const user = userOf(data.session && data.session.user);
    auth.set({ ready: true, user, recovery: Boolean(user && recovery), notice: user && notice !== 'confirmed' ? null : notice });
  } catch {
    // нет сети или библиотека не скачалась: считаем, что человек не вошёл; прогресс в браузере цел
    auth.set({ ready: true });
  }
}

/* ---------- сообщения об ошибках ---------- */
const TEXT = {
  invalid_credentials: 'Неверный адрес почты или пароль.',
  email_not_confirmed: 'Адрес почты ещё не подтверждён. Откройте письмо, которое пришло при регистрации, и перейдите по ссылке.',
  user_already_exists: 'Учётная запись с таким адресом уже есть. Войдите или восстановите пароль.',
  email_exists: 'Учётная запись с таким адресом уже есть. Войдите или восстановите пароль.',
  weak_password: 'Пароль слишком простой. Сделайте его длиннее и добавьте цифры или знаки.',
  same_password: 'Новый пароль совпадает с прежним. Придумайте другой.',
  over_email_send_rate_limit: 'Слишком много писем за короткое время. Подождите несколько минут и попробуйте снова.',
  over_request_rate_limit: 'Слишком много попыток. Подождите минуту и попробуйте снова.',
  email_address_not_authorized: 'Регистрация пока открыта не для всех адресов: на этот адрес письмо с подтверждением отправить нельзя.',
  email_address_invalid: 'Проверьте адрес почты: похоже, в нём ошибка.',
  validation_failed: 'Проверьте адрес почты и пароль: что-то заполнено неверно.',
  signup_disabled: 'Регистрация сейчас закрыта.',
  email_provider_disabled: 'Вход по почте сейчас отключён.',
  otp_expired: 'Ссылка устарела или уже использована. Запросите новую.',
  user_banned: 'Учётная запись заблокирована.',
  session_not_found: 'Сеанс завершён. Войдите снова.',
  session_expired: 'Сеанс завершён. Войдите снова.',
  reauthentication_needed: 'Для смены пароля нужно войти заново: выйдите и воспользуйтесь восстановлением пароля.',
  cloud_off: 'Учётные записи сейчас отключены.',
  network: 'Нет связи с сервером. Проверьте интернет и попробуйте снова.',
  unknown: 'Не получилось. Попробуйте ещё раз чуть позже.',
};
/* Ошибку Supabase превращаем в понятный текст. В сообщение не попадают ни адрес почты, ни пароль */
export function friendly(error) {
  const raw = error || {};
  let code = raw.code || '';
  if (!TEXT[code]) code = raw.name === 'AuthRetryableFetchError' || raw.status === 0 || /fetch|network|load failed/i.test(raw.message || '') ? 'network' : 'unknown';
  return Object.assign(new Error(TEXT[code]), { code });
}
const run = async fn => {
  let res;
  try { res = await fn(await client()); } catch (e) { throw friendly(e); }
  if (res && res.error) throw friendly(res.error);
  return res ? res.data : null;
};

/* ---------- действия ---------- */
export async function signUp(email, password) {
  const data = await run(c => c.auth.signUp({
    email, password,
    // в запись о согласии попадают только даты редакций документов
    options: { emailRedirectTo: siteUrl(), data: { terms_version: DOCS.terms, privacy_version: DOCS.privacy } },
  }));
  if (data.session) auth.set({ user: userOf(data.session.user) });
  // без сеанса человек должен подтвердить адрес по ссылке из письма; запоминаем, что регистрация начата здесь
  else if (data.user && data.user.id) writeFlow({ signup: { id: data.user.id, at: Date.now() } });
  return { signedIn: Boolean(data.session) };
}
export const resendConfirmation = email => run(c => c.auth.resend({ type: 'signup', email, options: { emailRedirectTo: siteUrl() } }));
export async function signIn(email, password) {
  const data = await run(c => c.auth.signInWithPassword({ email, password }));
  writeFlow({ signup: null }); setRecovery(false);
  auth.set({ user: userOf(data.user), recovery: false });
}
export const sendReset = email => run(c => c.auth.resetPasswordForEmail(email, { redirectTo: siteUrl() }));
export async function setPassword(password) {
  await run(c => c.auth.updateUser({ password }));
  setRecovery(false);
  auth.set({ recovery: false });
}
/* Выход только на этом устройстве: на остальных человек остаётся в учётной записи */
export async function endSession() {
  try { await (await client()).auth.signOut({ scope: 'local' }); } catch { /* сеанс уже недействителен */ }
  setRecovery(false);
  auth.set({ user: null, recovery: false });
}
