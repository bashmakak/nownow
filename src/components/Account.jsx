import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLOUD, KEYS } from '../config.js';
import { clearNotice, useAuth } from '../lib/cloud.js';
import { cancelDelete, deleteAccount, exportData, signOut, syncNow, useSync } from '../lib/sync.js';
import { useUI } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';

/* ===== Учётная запись в интерфейсе: кнопка в шапке, панель в кабинете, уведомление о хранении данных ===== */

/* Кнопка в шапке и строка в меню. Без учётных записей (CLOUD = false) ничего не показывает */
export function AccountLink({ className = 'btn btn-secondary btn-sm head-login' }) {
  const a = useAuth();
  if (!CLOUD || !a.ready || a.user) return null;
  return <Link className={className} to="/login">Войти</Link>;
}

const time = ts => {
  const d = new Date(ts), now = new Date();
  const hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === now.toDateString() ? `сегодня в ${hm}` : `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${hm}`;
};

function SyncLine() {
  const s = useSync();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(id); }, []);
  const view = {
    syncing: ['repeat', 'Синхронизация…', ''],
    ok: ['circle-check', `Синхронизировано ${time(s.at)}`, 'ok'],
    offline: ['info', 'Нет связи. Изменения сохранены в браузере и отправятся, когда связь появится.', ''],
    error: ['shield-alert', s.error === 'too_big' ? 'Данных слишком много, чтобы сохранить их в облаке. Сократите заметки.' : 'Не удалось синхронизировать. Изменения сохранены в браузере.', 'bad'],
    paused: ['info', 'Синхронизация остановлена: подана заявка на удаление.', ''],
    off: ['info', 'Синхронизация не запущена.', ''],
  }[s.phase] || ['info', '', ''];
  return (
    <p className={`sync-line ${view[2]}`} id="sync-line" data-phase={s.phase} role="status">
      <Icon name={view[0]} size={17} className={s.phase === 'syncing' ? 'spin' : ''} /><span>{view[1]}</span>
      {(s.phase === 'error' || s.phase === 'offline' || s.phase === 'ok') && <button type="button" className="link-btn" onClick={() => syncNow()}>{s.phase === 'ok' ? 'Обновить' : 'Повторить'}</button>}
    </p>
  );
}

function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function downloadMyData() {
  download(`nownow-${new Date().toISOString().slice(0, 10)}.json`, await exportData());
}

/* Панель в кабинете */
export function AccountPanel() {
  const a = useAuth();
  const s = useSync();
  const nav = useNavigate();
  const { toast } = useUI();
  const [ask, setAsk] = useState('');       // '', 'out' — выйти без сохранения, 'delete'
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  if (!CLOUD) return null;

  const guard = (name, fn) => async () => {
    if (busy) return;
    setBusy(name); setError('');
    try { await fn(); } catch (e) { setError(e && e.message ? e.message : 'Не получилось. Попробуйте ещё раз.'); }
    setBusy('');
  };
  const leave = force => guard('out', async () => {
    const res = await signOut(force);
    if (res.unsaved) { setAsk('out'); return; }
    setAsk('');
    toast('Вы вышли. Прогресс сохранён в учётной записи');
  })();
  const remove = guard('delete', async () => {
    const res = await deleteAccount();
    setAsk('');
    toast(res === 'deleted' ? 'Учётная запись и все данные удалены' : 'Заявка на удаление отправлена');
    nav('/', { replace: true });
  });

  if (!a.ready) return <div className="panel acc" id="account" aria-busy="true"><p className="muted">Проверяем вход…</p></div>;

  if (!a.user) {
    return (
      <div className="panel acc" id="account">
        <div className="acc-intro">
          <span className="tile-ic"><Icon name="shield-check" size={22} /></span>
          <div className="stack" style={{ gap: 6 }}>
            <h3 className="h4">Прогресс хранится только в этом браузере</h3>
            <p className="muted">Создайте учётную запись, чтобы он сохранялся в облаке и появлялся на других устройствах. Всё, что вы уже прошли, перенесётся. Без учётной записи сайт работает так же.</p>
          </div>
        </div>
        <div className="row">
          <Link className="btn btn-primary" to="/signup">Создать учётную запись</Link>
          <Link className="btn btn-secondary" to="/login">Войти</Link>
        </div>
      </div>
    );
  }

  if (a.recovery) {
    return (
      <div className="panel acc" id="account">
        <p>Вы перешли по ссылке для смены пароля учётной записи <b className="auth-mail">{a.user.email}</b>. Задайте новый пароль: после этого прогресс начнёт синхронизироваться.</p>
        <div className="row">
          <Link className="btn btn-primary" to="/account/password">Задать пароль</Link>
          <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={() => leave(true)}>Выйти</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel acc" id="account">
      <div className="acc-head">
        <span className="acc-ava" aria-hidden="true">{(a.user.email[0] || '?').toUpperCase()}</span>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <b className="acc-mail" id="acc-mail">{a.user.email}</b>
          <SyncLine />
        </div>
      </div>

      {s.phase === 'paused' && (
        <div className="note-box" id="acc-pending">
          <Icon name="info" size={20} />
          <div className="stack" style={{ gap: 10 }}>
            <p>Заявка на удаление учётной записи отправлена {new Date(s.deleteAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}. Прогресс в облаке уже стёрт; саму запись с адресом почты владелец сайта удаляет вручную. Пока заявка действует, прогресс сохраняется только в этом браузере.</p>
            <div><button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={guard('cancel', async () => { await cancelDelete(); toast('Заявка отменена'); })}>Отменить заявку</button></div>
          </div>
        </div>
      )}
      {error && <div className="auth-alert bad" role="alert"><Icon name="shield-alert" size={18} /><span>{error}</span></div>}

      {ask === 'out' ? (
        <div className="stack" style={{ gap: 12 }}>
          <p>Последние изменения не удалось отправить в облако: нет связи с сервером. Если выйти сейчас, они пропадут.</p>
          <div className="row">
            <button type="button" className="btn btn-secondary" onClick={() => setAsk('')}>Остаться</button>
            <button type="button" className="btn btn-danger" disabled={Boolean(busy)} onClick={() => leave(true)}>Выйти без сохранения</button>
          </div>
        </div>
      ) : ask === 'delete' ? (
        <div className="stack" style={{ gap: 12 }}>
          <p><b>Удалить учётную запись?</b> Адрес почты, прогресс, закладки и заметки будут удалены из облака и из этого браузера. Вернуть их не получится. Перед удалением можно <button type="button" className="link-btn" onClick={() => downloadMyData()}>скачать копию данных</button>.</p>
          <div className="row">
            <button type="button" className="btn btn-danger" id="acc-delete-yes" disabled={Boolean(busy)} onClick={remove}><Icon name="trash-2" size={17} />{busy === 'delete' ? 'Удаляем…' : 'Удалить навсегда'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setAsk('')}>Отмена</button>
          </div>
        </div>
      ) : (
        <div className="row acc-actions">
          <button type="button" className="btn btn-secondary" id="acc-out" disabled={Boolean(busy)} onClick={() => leave(false)}>{busy === 'out' ? 'Выходим…' : 'Выйти'}</button>
          <Link className="btn btn-ghost" to="/account/password">Сменить пароль</Link>
          <button type="button" className="btn btn-ghost acc-del" id="acc-delete" onClick={() => { setError(''); setAsk('delete'); }}>Удалить учётную запись</button>
        </div>
      )}
      <p className="field-hint">При выходе прогресс остаётся в учётной записи, а из этого браузера стирается: так его не увидит следующий человек за этим компьютером.</p>
    </div>
  );
}

/* Сообщение после перехода по ссылке из письма */
export function AuthNotice() {
  const a = useAuth();
  const { toast } = useUI();
  useEffect(() => {
    if (a.notice !== 'confirmed') return;
    toast({ title: 'Адрес подтверждён', text: 'Вы вошли в учётную запись', icon: 'circle-check' });
    clearNotice();
  }, [a.notice, toast]);
  return null;
}

/* Уведомление о хранении данных в браузере. Сайт не ставит cookie и ничего не отслеживает, поэтому
   выбирать здесь нечего: человеку сообщают, что хранится, и дают ссылку на подробности. */
const seenConsent = () => { try { return Boolean(localStorage.getItem(KEYS.consent)); } catch { return true; } };
export function ConsentBar() {
  const [open, setOpen] = useState(() => !seenConsent());
  if (!open) return null;
  const ok = () => {
    try { localStorage.setItem(KEYS.consent, JSON.stringify({ at: new Date().toISOString() })); } catch { /* хранилище недоступно: покажем в следующий раз */ }
    setOpen(false);
  };
  return (
    <aside className="consent theme-dark" id="consent" role="region" aria-label="Хранение данных в браузере">
      <div className="wrap consent-row">
        <p>Сайт хранит в вашем браузере прогресс, настройки и вход в учётную запись. Рекламных и аналитических файлов cookie нет. <Link to="/legal/privacy?s=cookies">Подробнее</Link></p>
        <button type="button" className="btn btn-primary btn-sm" id="consent-ok" onClick={ok}>Понятно</button>
      </div>
    </aside>
  );
}
