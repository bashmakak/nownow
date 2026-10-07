import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/cloud.js';
import { reportLesson, retryCommunity } from '../lib/community.js';
import { useTitle, useUI, DialogHead } from '../lib/ui.jsx';
import { Icon } from './Icon.jsx';
import { Mark } from './Brand.jsx';
import { EmptyState } from './Cards.jsx';

/* ===== Авторские уроки в читательской части сайта =====
   Урок, который написал участник, приходит из базы уже после запуска сайта (lib/community.js).
   Здесь то, что видит читатель: ожидание загрузки, пометка «авторский урок» и жалоба. */

/* Урок ещё не загружен: ждём, сообщаем об ошибке или о том, что его сняли с публикации */
export function LessonWait({ slug, state, player = false }) {
  useTitle(state === 'loading' ? 'Загружаем урок' : 'Урок недоступен');
  if (state === 'loading') {
    return player
      ? <div className="pl-wait" role="status"><Mark size={28} /><span>Загружаем урок…</span></div>
      : <section className="page"><div className="wrap"><p className="muted" role="status" aria-busy="true" id="lesson-wait">Загружаем урок…</p></div></section>;
  }
  return (
    <section className="page">
      <div className="wrap">
        {state === 'error' ? (
          <EmptyState title="Не удалось загрузить урок" text="Авторские уроки хранятся на сервере. Проверьте соединение с интернетом и попробуйте ещё раз.">
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" id="lesson-retry" onClick={() => retryCommunity(slug)}>Повторить</button>
              <Link className="btn btn-secondary" to="/courses">Открыть каталог</Link>
            </div>
          </EmptyState>
        ) : (
          <EmptyState title="Урок недоступен" text="Автор или модератор снял этот урок с публикации, либо ссылка неверна. Ваш прогресс по нему сохранён.">
            <Link className="btn btn-primary" to="/courses?by=authors">Уроки авторов</Link>
          </EmptyState>
        )}
      </div>
    </section>
  );
}

function ReportDialog({ course }) {
  const { close, toast } = useUI();
  const account = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!account.user) {
    return (
      <div className="dlg">
        <DialogHead title="Пожаловаться на урок" />
        <div className="dlg-body">
          <p>Жалобу может отправить читатель, который вошёл в учётную запись: так модератор понимает, что её написал человек. Автору урока ваш адрес почты не передаётся.</p>
          <div className="row"><Link className="btn btn-primary" to="/login">Войти</Link><button type="button" className="btn btn-ghost" onClick={close}>Закрыть</button></div>
        </div>
      </div>
    );
  }
  const ok = reason.trim().length >= 5;
  const send = async e => {
    e.preventDefault();
    if (!ok || busy) return;
    setBusy(true); setMsg('');
    const res = await reportLesson(course.lessonId, reason);
    setBusy(false);
    if (res === 'sent') { close(); toast('Жалоба отправлена модератору'); }
    else if (res === 'again') setMsg('Вы уже жаловались на этот урок. Модератор увидит вашу первую жалобу.');
    else setMsg('Не получилось отправить. Попробуйте ещё раз чуть позже.');
  };
  return (
    <form className="dlg" method="post" onSubmit={send} id="report-form">
      <DialogHead title="Пожаловаться на урок" />
      <div className="dlg-body">
        <p className="muted">«{course.title}», автор {course.author.name}. Жалобу прочитает модератор. Автор не узнает, кто её отправил.</p>
        {msg && <div className="auth-alert bad" role="alert"><Icon name="shield-alert" size={18} /><span>{msg}</span></div>}
        <label className="sr" htmlFor="report-reason">Что не так с уроком</label>
        <textarea className="input" id="report-reason" rows={5} maxLength={600} data-autofocus placeholder="Что не так: ошибка в фактах, чужой текст, реклама, оскорбления…"
          value={reason} onChange={e => setReason(e.target.value)} />
        <div className="row">
          <button type="submit" className="btn btn-primary" id="report-send" disabled={!ok || busy}>{busy ? 'Отправляем…' : 'Отправить жалобу'}</button>
          <button type="button" className="btn btn-ghost" onClick={close}>Отмена</button>
        </div>
      </div>
    </form>
  );
}

/* Пометка на странице урока: кто автор, что урок проверен, как пожаловаться */
export function AuthorBox({ course }) {
  const ui = useUI();
  return (
    <div className="note-box by-box" id="author-box">
      <Icon name="pen-line" size={20} />
      <div>
        <p><b>Авторский урок.</b> Его написал участник NowNow под именем «{course.author.name}». Перед публикацией урок прочитал модератор, но факты и выводы остаются на ответственности автора.</p>
        <p className="by-box-line">
          {course.learners > 0 && <span><Icon name="graduation-cap" size={15} />прошли: <b className="num">{course.learners}</b></span>}
          {course.useful > 0 && <span><Icon name="circle-check" size={15} />отметили полезным: <b className="num">{course.useful}</b></span>}
          <button type="button" className="link-btn" id="report-open" onClick={() => ui.open(<ReportDialog course={course} />, 'dlg-sm')}>Пожаловаться на урок</button>
        </p>
      </div>
    </div>
  );
}
