import { useEffect, useId, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CLOUD, MIN_PASSWORD } from '../config.js';
import { MIN_AGE } from '../data/legal.js';
import { clearNotice, resendConfirmation, sendReset, setPassword, signIn, signUp, useAuth } from '../lib/cloud.js';
import { useTitle, useUI } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState } from '../components/Cards.jsx';

/* ===== Вход, регистрация, восстановление пароля =====
   Адрес почты и пароль живут только в полях формы, пока страница открыта: их нет ни в адресе страницы,
   ни в хранилище браузера, ни в журнале. У форм стоит method="post": даже если скрипт не сработает,
   браузер не подставит введённое в адресную строку. */

const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function Shell({ title, lead, children, foot }) {
  return (
    <section className="page auth-page">
      <div className="wrap">
        <div className="auth-card panel">
          <header className="stack" style={{ gap: 8 }}>
            <h1 className="h2">{title}</h1>
            {lead && <p className="muted">{lead}</p>}
          </header>
          {children}
        </div>
        {foot && <p className="auth-foot">{foot}</p>}
      </div>
    </section>
  );
}

function Alert({ children, tone = 'bad' }) {
  if (!children) return null;
  return <div className={`auth-alert ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}><Icon name={tone === 'bad' ? 'shield-alert' : 'circle-check'} size={18} /><span>{children}</span></div>;
}

function Email({ value, onChange, autoFocus }) {
  const id = useId();
  return (
    <div className="form-row">
      <label htmlFor={id}>Адрес почты</label>
      <input className="input" id={id} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
        required maxLength={254} placeholder="name@example.com" value={value} onChange={e => onChange(e.target.value)} data-autofocus={autoFocus ? '' : undefined} autoFocus={autoFocus} />
    </div>
  );
}

function Password({ value, onChange, label = 'Пароль', fresh = false, hint }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}</label>
      <div className="pass">
        <input className="input" id={id} name={fresh ? 'new-password' : 'password'} type={show ? 'text' : 'password'}
          autoComplete={fresh ? 'new-password' : 'current-password'} required minLength={fresh ? MIN_PASSWORD : undefined} maxLength={72}
          value={value} onChange={e => onChange(e.target.value)} aria-describedby={hint ? `${id}-h` : undefined} />
        <button type="button" className="icon-btn" aria-pressed={show} aria-label={show ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShow(v => !v)}>
          <Icon name={show ? 'eye-off' : 'eye'} size={18} />
        </button>
      </div>
      {hint && <p className="field-hint" id={`${id}-h`}>{hint}</p>}
    </div>
  );
}

/* Общая обвязка формы: состояние отправки и текст ошибки */
function useSubmit(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try { await fn(); } catch (err) { if (alive.current) setError(err && err.message ? err.message : 'Не получилось. Попробуйте ещё раз.'); }
    if (alive.current) setBusy(false);
  };
  return { busy, error, setError, submit };
}

/* Учётные записи отключены в сборке, или человек уже вошёл */
function Gate({ children, allowUser = false }) {
  const a = useAuth();
  if (!CLOUD) {
    return (
      <section className="page"><div className="wrap">
        <EmptyState title="Учётные записи отключены" text="Сайт работает без входа: прогресс хранится в вашем браузере.">
          <Link className="btn btn-primary" to="/courses">Открыть каталог</Link>
        </EmptyState>
      </div></section>
    );
  }
  if (!a.ready) return <section className="page auth-page"><div className="wrap"><div className="auth-card panel" aria-busy="true"><p className="muted">Проверяем вход…</p></div></div></section>;
  if (a.user && !allowUser) return <Navigate to="/me" replace />;
  return children;
}

const PASS_HINT = `Не короче ${MIN_PASSWORD} знаков. Не используйте пароль от других сайтов.`;

export function Login() {
  useTitle('Вход');
  return <Gate><LoginForm /></Gate>;
}
function LoginForm() {
  const nav = useNavigate();
  const a = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [notice] = useState(a.notice);
  useEffect(() => { if (a.notice) clearNotice(); }, [a.notice]);
  const f = useSubmit(async () => {
    if (!emailOk(email)) throw new Error('Проверьте адрес почты: похоже, в нём ошибка.');
    await signIn(email.trim(), password);
    nav('/me', { replace: true });
  });
  return (
    <Shell title="Вход" lead="Прогресс, закладки и заметки появятся на этом устройстве."
      foot={<>Нет учётной записи? <Link to="/signup">Создать</Link></>}>
      {notice === 'link-failed' && !f.error && <Alert>Ссылка из письма устарела или уже использована. Если вы подтверждали адрес, просто войдите. Если восстанавливали пароль, запросите ссылку ещё раз.</Alert>}
      {notice === 'confirmed-login' && !f.error && <Alert tone="ok">Адрес подтверждён. Войдите с паролем, который задали при регистрации.</Alert>}
      <form className="auth-form" method="post" onSubmit={f.submit} noValidate>
        <Alert>{f.error}</Alert>
        <Email value={email} onChange={setEmail} autoFocus />
        <Password value={password} onChange={setPass} />
        <button type="submit" className="btn btn-primary btn-lg" id="auth-submit" disabled={f.busy || !email || !password}>{f.busy ? 'Входим…' : 'Войти'}</button>
        <Link className="auth-link" to="/reset">Забыли пароль?</Link>
      </form>
    </Shell>
  );
}

export function Signup() {
  useTitle('Регистрация');
  return <Gate><SignupForm /></Gate>;
}
function SignupForm() {
  const nav = useNavigate();
  const { toast } = useUI();
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [sent, setSent] = useState(false);
  const [again, setAgain] = useState('');
  const f = useSubmit(async () => {
    if (!emailOk(email)) throw new Error('Проверьте адрес почты: похоже, в нём ошибка.');
    if (password.length < MIN_PASSWORD) throw new Error(`Пароль должен быть не короче ${MIN_PASSWORD} знаков.`);
    if (!terms || !privacy) throw new Error('Чтобы создать учётную запись, нужно отметить оба пункта.');
    const res = await signUp(email.trim(), password);
    setPass('');
    if (res.signedIn) { toast('Учётная запись создана'); nav('/me', { replace: true }); } else setSent(true);
  });
  const resend = async () => {
    setAgain('busy');
    try { await resendConfirmation(email.trim()); setAgain('done'); } catch (e) { setAgain(e.message); }
  };

  if (sent) {
    return (
      <Shell title="Проверьте почту" foot={<>Уже подтвердили адрес? <Link to="/login">Войти</Link></>}>
        <div className="auth-form" id="auth-sent">
          <p>Мы отправили письмо на <b className="auth-mail">{email.trim()}</b>. Откройте его и перейдите по ссылке: так мы убедимся, что адрес ваш. После этого войдите с паролем.</p>
          <p className="muted">Письма нет? Проверьте папку «Спам». Если учётная запись с таким адресом уже есть, новое письмо не придёт: войдите или восстановите пароль.</p>
          {again && again !== 'busy' && <Alert tone={again === 'done' ? 'ok' : 'bad'}>{again === 'done' ? 'Письмо отправлено ещё раз.' : again}</Alert>}
          <div className="row">
            <Link className="btn btn-primary" to="/login">Войти</Link>
            <button type="button" className="btn btn-secondary" onClick={resend} disabled={again === 'busy' || again === 'done'}>{again === 'busy' ? 'Отправляем…' : 'Отправить ещё раз'}</button>
          </div>
        </div>
      </Shell>
    );
  }
  return (
    <Shell title="Создать учётную запись" lead="Прогресс сохранится в облаке и появится на других устройствах. То, что вы уже прошли в этом браузере, перенесётся."
      foot={<>Уже есть учётная запись? <Link to="/login">Войти</Link></>}>
      <form className="auth-form" method="post" onSubmit={f.submit} noValidate>
        <Alert>{f.error}</Alert>
        <Email value={email} onChange={setEmail} autoFocus />
        <Password value={password} onChange={setPass} fresh hint={PASS_HINT} />
        <fieldset className="consents">
          <legend className="sr">Согласия</legend>
          <label className="check"><input type="checkbox" id="c-terms" checked={terms} onChange={e => setTerms(e.target.checked)} />
            <span>Принимаю <Link to="/legal/terms" target="_blank" rel="noopener">пользовательское соглашение</Link> и подтверждаю, что мне исполнилось {MIN_AGE} лет.</span></label>
          <label className="check"><input type="checkbox" id="c-privacy" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />
            <span>Даю согласие на обработку персональных данных на условиях <Link to="/legal/privacy" target="_blank" rel="noopener">политики конфиденциальности</Link>, включая их хранение на серверах за рубежом.</span></label>
        </fieldset>
        <button type="submit" className="btn btn-primary btn-lg" id="auth-submit" disabled={f.busy || !email || !password || !terms || !privacy}>{f.busy ? 'Создаём…' : 'Создать учётную запись'}</button>
      </form>
    </Shell>
  );
}

export function Reset() {
  useTitle('Восстановление пароля');
  return <Gate><ResetForm /></Gate>;
}
function ResetForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const f = useSubmit(async () => {
    if (!emailOk(email)) throw new Error('Проверьте адрес почты: похоже, в нём ошибка.');
    await sendReset(email.trim());
    setSent(true);
  });
  if (sent) {
    return (
      <Shell title="Проверьте почту" foot={<Link to="/login">Вернуться ко входу</Link>}>
        <div className="auth-form" id="auth-sent">
          <p>Если учётная запись с адресом <b className="auth-mail">{email.trim()}</b> существует, на него отправлено письмо со ссылкой. Перейдите по ней и задайте новый пароль.</p>
          <p className="muted">Ссылка действует ограниченное время. Письма нет? Проверьте папку «Спам».</p>
        </div>
      </Shell>
    );
  }
  return (
    <Shell title="Восстановление пароля" lead="Укажите адрес почты учётной записи: мы пришлём ссылку, по которой можно задать новый пароль."
      foot={<Link to="/login">Вернуться ко входу</Link>}>
      <form className="auth-form" method="post" onSubmit={f.submit} noValidate>
        <Alert>{f.error}</Alert>
        <Email value={email} onChange={setEmail} autoFocus />
        <button type="submit" className="btn btn-primary btn-lg" id="auth-submit" disabled={f.busy || !email}>{f.busy ? 'Отправляем…' : 'Прислать ссылку'}</button>
      </form>
    </Shell>
  );
}

export function NewPassword() {
  useTitle('Новый пароль');
  return <Gate allowUser><NewPasswordForm /></Gate>;
}
function NewPasswordForm() {
  const a = useAuth();
  const nav = useNavigate();
  const { toast } = useUI();
  const [password, setPass] = useState('');
  const f = useSubmit(async () => {
    if (password.length < MIN_PASSWORD) throw new Error(`Пароль должен быть не короче ${MIN_PASSWORD} знаков.`);
    await setPassword(password);
    setPass('');
    toast('Пароль изменён');
    nav('/me', { replace: true });
  });
  if (!a.user) {
    return (
      <Shell title="Ссылка не сработала" foot={<Link to="/login">Вернуться ко входу</Link>}>
        <div className="auth-form">
          <p>Ссылка для смены пароля устарела или уже использована. Запросите новую: она придёт на почту.</p>
          <div><Link className="btn btn-primary" to="/reset">Прислать новую ссылку</Link></div>
        </div>
      </Shell>
    );
  }
  return (
    <Shell title="Новый пароль" lead={<>Учётная запись <b className="auth-mail" id="np-mail">{a.user.email}</b>. {a.recovery ? 'Задайте новый пароль: прежний перестанет действовать.' : 'После смены пароля на других устройствах потребуется войти заново.'}</>}>
      <form className="auth-form" method="post" onSubmit={f.submit} noValidate>
        <Alert>{f.error}</Alert>
        {/* скрытое поле с адресом: по нему менеджер паролей понимает, для какой учётной записи сохранить пароль */}
        <input type="email" name="email" autoComplete="username" value={a.user.email} readOnly hidden />
        <Password value={password} onChange={setPass} fresh label="Новый пароль" hint={PASS_HINT} />
        <div className="row">
          <button type="submit" className="btn btn-primary btn-lg" id="auth-submit" disabled={f.busy || !password}>{f.busy ? 'Сохраняем…' : 'Сохранить пароль'}</button>
          {!a.recovery && <Link className="btn btn-ghost" to="/me">Отмена</Link>}
        </div>
      </form>
    </Shell>
  );
}
