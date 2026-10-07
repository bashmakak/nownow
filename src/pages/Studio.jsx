import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CLOUD } from '../config.js';
import { BLOCKS, FORMAT, LEVEL, PUBLIC, TOPIC_BY } from '../data';
import { AUTHOR_RULES, MOD_CHECKLIST, SPARK_RULES } from '../data/rules.js';
import { useAuth } from '../lib/cloud.js';
import { LIMITS, STATUS, blankLesson, checkLesson, cleanLesson } from '../lib/lesson-format.js';
import {
  allPublished, amModerator, createLesson, getLesson, myAuthor, myLessons, openReports, removeLesson, resolveReport, reviewLesson,
  reviewQueue, saveAuthor, saveLesson, setHidden, submitLesson, wallet, withdrawLesson,
} from '../lib/studio.js';
import { plural } from '../lib/store.js';
import { useTitle, useUI, DialogHead } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState } from '../components/Cards.jsx';
import NotFound from './NotFound.jsx';
import '../studio.css';

/* ===== Мастерская автора и модерация =====
   Автор пишет урок в формате NowNow, отправляет на проверку, после одобрения урок появляется в каталоге.
   За опубликованные и пройденные уроки начисляются искры — внутренние очки сайта без денежной стоимости. */

const TOPICS = PUBLIC.map(t => t.slug);
const date = iso => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '');
const sparks = n => `${n} ${plural(n, ['искра', 'искры', 'искр'])}`;

/* ---------- кто может войти ---------- */
function Gate({ children, title = 'Мастерская' }) {
  const a = useAuth();
  if (!CLOUD) {
    return <section className="page"><div className="wrap"><EmptyState title="Мастерская недоступна" text="Для авторских уроков нужны учётные записи, а в этой сборке они отключены."><Link className="btn btn-primary" to="/courses">Открыть каталог</Link></EmptyState></div></section>;
  }
  if (!a.ready) return <section className="page"><div className="wrap"><p className="muted" aria-busy="true">Проверяем вход…</p></div></section>;
  if (!a.user) {
    return (
      <section className="page">
        <div className="wrap">
          <header className="page-head">
            <h1 className="h1">{title}</h1>
            <p className="lead">Здесь пишут уроки для NowNow. Урок проходит проверку модератором и после одобрения появляется в каталоге под именем автора.</p>
          </header>
          <div className="cols3">
            <div className="col3"><span className="tile-ic"><Icon name="pen-line" size={22} /></span><h2 className="h3">Напишите урок</h2><p>Шесть блоков, от 3 до 7 минут: зачем, идея, пример, практика, проверка, ключевое знание. Редактор подскажет, чего не хватает.</p></div>
            <div className="col3"><span className="tile-ic"><Icon name="shield-check" size={22} /></span><h2 className="h3">Пройдите проверку</h2><p>Модератор читает каждый урок. Если что-то не так, урок вернётся с комментарием, и его можно доработать.</p></div>
            <div className="col3"><span className="tile-ic"><Icon name="sparkles" size={22} /></span><h2 className="h3">Получайте искры</h2><p>{SPARK_RULES[0][0]} за опубликованный урок и по {SPARK_RULES[1][0]} за каждого, кто его прошёл. Искры — внутренние очки сайта, не деньги.</p></div>
          </div>
          <div className="group">
            <p className="muted" style={{ marginBottom: 16 }}>Чтобы писать уроки, нужна учётная запись: по ней сайт понимает, чей это урок.</p>
            <div className="row"><Link className="btn btn-primary btn-lg" to="/signup">Создать учётную запись</Link><Link className="btn btn-secondary btn-lg" to="/login">Войти</Link></div>
          </div>
        </div>
      </section>
    );
  }
  return children;
}

function Alert({ children }) {
  return children ? <div className="auth-alert bad" role="alert"><Icon name="shield-alert" size={18} /><span>{children}</span></div> : null;
}
/* Действие с кнопки: состояние «идёт» и текст ошибки */
function useAction() {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const run = useCallback(async (name, fn) => {
    setBusy(name); setError('');
    try { await fn(); } catch (e) { setError(e && e.message ? e.message : 'Не получилось. Попробуйте ещё раз.'); }
    setBusy('');
  }, []);
  return { busy, error, run, setError };
}

/* Человек вернулся на вкладку: данные могли измениться (модератор принял решение, пришли новые уроки) */
function useRefreshOnReturn(load) {
  useEffect(() => {
    const back = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [load]);
}

/* ---------- правила ---------- */
export function Rules() {
  return (
    <ol className="st-rules">
      {AUTHOR_RULES.map(([t, x]) => <li key={t}><b>{t}.</b> {x}</li>)}
    </ol>
  );
}

/* ---------- имя автора ---------- */
function AuthorForm({ author, onSaved, onCancel }) {
  const [name, setName] = useState(author ? author.name : '');
  const [bio, setBio] = useState(author ? author.bio : '');
  const [agree, setAgree] = useState(Boolean(author));
  const act = useAction();
  const ok = name.trim().length >= 2 && agree;
  const submit = e => { e.preventDefault(); if (ok) act.run('save', async () => { await saveAuthor({ name, bio }, Boolean(author)); onSaved(); }); };
  return (
    <form className="panel st-author" id="author-form" method="post" onSubmit={submit}>
      <header className="stack" style={{ gap: 6 }}>
        <h2 className="h3">{author ? 'Профиль автора' : 'Представьтесь читателям'}</h2>
        <p className="muted">Имя автора видно всем рядом с вашими уроками. Это может быть настоящее имя или псевдоним. Адрес почты читателям не показывается.</p>
      </header>
      <Alert>{act.error}</Alert>
      <div className="form-row">
        <label htmlFor="au-name">Имя автора</label>
        <input className="input" id="au-name" type="text" required minLength={2} maxLength={40} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="au-bio">Пара слов о себе <span className="optional">необязательно</span></label>
        <textarea className="input" id="au-bio" rows={2} maxLength={300} placeholder="Например: преподаю статистику, 10 лет работаю аналитиком" value={bio} onChange={e => setBio(e.target.value)} />
      </div>
      {!author && (
        <>
          <details className="st-details"><summary>Правила для авторов</summary><Rules /></details>
          <label className="check"><input type="checkbox" id="au-agree" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>Принимаю правила для авторов из <Link to="/legal/terms?s=authors" target="_blank" rel="noopener">пользовательского соглашения</Link>. Понимаю, что искры — внутренние очки сайта, а не деньги.</span></label>
        </>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" id="au-save" disabled={!ok || Boolean(act.busy)}>{act.busy ? 'Сохраняем…' : author ? 'Сохранить' : 'Стать автором'}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Отмена</button>}
      </div>
    </form>
  );
}

/* ---------- искры ---------- */
const KIND = { published: 'Урок опубликован', learner: 'Урок прошли', useful: 'Урок отметили полезным', adjust: 'Корректировка' };
function Wallet({ w, lessons }) {
  const title = id => { const l = lessons.find(x => x.id === id); return l ? l.data.title || 'Без названия' : 'удалённый урок'; };
  return (
    <div className="panel st-wallet" id="wallet">
      <div className="st-wallet-top">
        <span className="tile-ic"><Icon name="sparkles" size={22} /></span>
        <div><b className="num" id="wallet-balance">{w.balance}</b><span>{plural(w.balance, ['искра', 'искры', 'искр'])}</span></div>
      </div>
      <dl className="st-wallet-parts">
        <div><dt>За публикации</dt><dd className="num">{w.published}</dd></div>
        <div><dt>За читателей</dt><dd className="num">{w.learners}</dd></div>
        <div><dt>За оценки «полезно»</dt><dd className="num">{w.useful}</dd></div>
      </dl>
      <ul className="st-spark-rules">{SPARK_RULES.map(([n, text]) => <li key={text}><b className="num">+{n}</b><span>{text}</span></li>)}</ul>
      <p className="field-hint">Искры — внутренние очки сайта. Сейчас их нельзя потратить или обменять на деньги. Как они будут использоваться, решится, когда на сайте появится оплата; обещать выплаты мы не можем.</p>
      {w.rows.length > 0 && (
        <details className="st-details">
          <summary>Последние начисления</summary>
          <ul className="st-ledger">{w.rows.map(r => <li key={r.id}><span>{KIND[r.kind] || r.kind}{r.lesson_id ? `: ${title(r.lesson_id)}` : ''}</span><span className="muted">{date(r.created_at)}</span><b className="num">+{r.amount}</b></li>)}</ul>
        </details>
      )}
    </div>
  );
}

/* ---------- список уроков автора ---------- */
function LessonRow({ l, reload }) {
  const act = useAction();
  const { toast } = useUI();
  const [ask, setAsk] = useState(false);
  const [label, tone] = STATUS[l.status] || STATUS.draft;
  const topic = TOPIC_BY[l.data.topic];
  const go = (name, fn, done) => act.run(name, async () => { await fn(); if (done) toast(done); await reload(); });
  return (
    <li className="st-lesson" data-lesson={l.id} data-status={l.status}>
      <div className="st-lesson-main">
        <div className="st-lesson-head">
          <Link className="h4" to={`/studio/${l.id}`}>{l.data.title || 'Без названия'}</Link>
          <span className={`st-status ${tone}`}>{label}</span>
          {l.live && l.status !== 'approved' && !l.live.hidden && <span className="st-status ok">Прежняя версия на сайте</span>}
          {l.live && l.live.hidden && <span className="st-status bad">{l.live.hidden_by === 'moderator' ? 'Скрыт модератором' : 'Снят с публикации'}</span>}
        </div>
        <p className="muted st-lesson-meta">{[topic && topic.title, l.data.minutes ? `${l.data.minutes} мин` : null, `изменён ${date(l.updated_at)}`].filter(Boolean).join(' · ')}</p>
        {l.status === 'rejected' && l.note && <div className="note-box st-note"><Icon name="info" size={20} /><p><b>Комментарий модератора.</b> {l.note}</p></div>}
        {l.status === 'review' && <p className="muted st-lesson-meta">Отправлен {date(l.submitted_at)}. Пока урок на проверке, править его нельзя: сначала отзовите.</p>}
        {l.live && <p className="st-lesson-stats"><span><Icon name="graduation-cap" size={16} />прошли: <b className="num">{l.live.learners}</b></span><span><Icon name="circle-check" size={16} />полезно: <b className="num">{l.live.useful}</b></span>{!l.live.hidden && <Link to={`/courses/${l.live.slug}`}>Открыть на сайте</Link>}</p>}
        <Alert>{act.error}</Alert>
      </div>
      {ask ? (
        <div className="row st-lesson-actions">
          <span className="muted">Удалить урок{l.live ? ' вместе с опубликованной версией' : ''}?</span>
          <button type="button" className="btn btn-danger btn-sm" disabled={Boolean(act.busy)} onClick={() => go('del', () => removeLesson(l.id), 'Урок удалён')}>Удалить</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAsk(false)}>Отмена</button>
        </div>
      ) : (
        <div className="row st-lesson-actions">
          {l.status === 'review'
            ? <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(act.busy)} onClick={() => go('back', () => withdrawLesson(l.id), 'Урок отозван с проверки')}>Отозвать</button>
            : <Link className="btn btn-secondary btn-sm" to={`/studio/${l.id}`}>Редактировать</Link>}
          {l.live && !l.live.hidden && <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(act.busy)} onClick={() => go('hide', () => setHidden(l.id, true), 'Урок снят с публикации')}>Снять с публикации</button>}
          {l.live && l.live.hidden && l.live.hidden_by === 'author' && <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(act.busy)} onClick={() => go('show', () => setHidden(l.id, false), 'Урок снова на сайте')}>Вернуть на сайт</button>}
          <button type="button" className="btn btn-ghost btn-sm st-del" onClick={() => setAsk(true)}>Удалить</button>
        </div>
      )}
    </li>
  );
}

function Dashboard() {
  useTitle('Мастерская');
  const nav = useNavigate();
  const [st, setSt] = useState({ loading: true });
  const [edit, setEdit] = useState(false);
  const act = useAction();
  const load = useCallback(async () => {
    try {
      const [author, mod] = await Promise.all([myAuthor(), amModerator()]);
      if (!author) { setSt({ loading: false, author: null, mod }); return; }
      const [lessons, w] = await Promise.all([myLessons(), wallet()]);
      setSt({ loading: false, author, mod, lessons, w });
    } catch (e) { setSt({ loading: false, error: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnReturn(load);
  const create = () => act.run('new', async () => { const id = await createLesson(blankLesson()); nav(`/studio/${id}`); });

  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">Мастерская</h1>
          <p className="lead">Ваши уроки, их проверка и искры за читателей.</p>
        </header>
        {st.loading && <p className="muted" aria-busy="true">Загружаем…</p>}
        {st.error && <><Alert>{st.error}</Alert><div style={{ marginTop: 14 }}><button type="button" className="btn btn-secondary" onClick={() => { setSt({ loading: true }); load(); }}>Повторить</button></div></>}
        {!st.loading && !st.error && !st.author && <div style={{ maxWidth: 640 }}><AuthorForm onSaved={load} /></div>}
        {!st.loading && st.author && (
          <div className="st-grid">
            <div className="stack" style={{ gap: 20, minWidth: 0 }}>
              {st.mod && <Link className="st-mod-link" to="/moderation" id="to-moderation"><Icon name="shield-check" size={20} /><span><b>Вы модератор</b>Уроки на проверке и жалобы читателей</span><Icon name="arrow-right" size={18} /></Link>}
              <div className="panel" id="my-lessons">
                <div className="panel-head">
                  <h2 className="h3">Мои уроки</h2>
                  <button type="button" className="btn btn-primary btn-sm" id="new-lesson" disabled={Boolean(act.busy)} onClick={create}><Icon name="plus" size={16} />Новый урок</button>
                </div>
                <Alert>{act.error}</Alert>
                {st.lessons.length
                  ? <ul className="st-lessons">{st.lessons.map(l => <LessonRow key={l.id} l={l} reload={load} />)}</ul>
                  : <p className="muted">Уроков пока нет. Начните с темы, которую можете объяснить за пять минут: одна идея, один пример, одно действие.</p>}
              </div>
              <div className="panel">
                <h2 className="h3">Правила для авторов</h2>
                <Rules />
                <p className="field-hint">Полный текст — в разделе «Авторские уроки и искры» <Link to="/legal/terms?s=authors">пользовательского соглашения</Link>.</p>
              </div>
            </div>
            <div className="stack" style={{ gap: 20, minWidth: 0 }}>
              <Wallet w={st.w} lessons={st.lessons} />
              {edit
                ? <AuthorForm author={st.author} onSaved={() => { setEdit(false); load(); }} onCancel={() => setEdit(false)} />
                : (
                  <div className="panel st-me" id="author-card">
                    <span className="label">Автор</span>
                    <b className="h4" id="author-name">{st.author.name}</b>
                    {st.author.bio && <p className="muted">{st.author.bio}</p>}
                    <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(true)}>Изменить</button></div>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
export const Studio = () => <Gate><Dashboard /></Gate>;

/* ---------- урок целиком на одной странице: предпросмотр для автора и для модератора ---------- */
export function LessonPreview({ data: raw, answers = true }) {
  const d = cleanLesson(raw), topic = TOPIC_BY[d.topic];
  const label = i => <p className="label lp-kicker">Блок {i + 1} · {BLOCKS[i].label}</p>;
  return (
    <article className="lp">
      <header className="lp-head">
        <p className="label">{[topic ? topic.title : 'Тема не выбрана', FORMAT[d.format], LEVEL[d.level], d.minutes ? `${d.minutes} мин` : null].filter(Boolean).join(' · ')}</p>
        <h2 className="h2">{d.title || 'Без названия'}</h2>
        {d.summary && <p className="lead">{d.summary}</p>}
        {d.tags.length > 0 && <p className="lp-tags">{d.tags.map(t => <span className="chip chip-static" key={t}>{t}</span>)}</p>}
        {d.outcomes.length > 0 && <ul className="lp-list">{d.outcomes.map((o, k) => <li key={k}>{o}</li>)}</ul>}
      </header>
      <section>{label(0)}<h3 className="h3">{d.why.title}</h3>{d.why.text.map((p, k) => <p key={k}>{p}</p>)}</section>
      <section>{label(1)}<h3 className="h3">{d.idea.title}</h3>{d.idea.intro && <p>{d.idea.intro}</p>}
        {d.idea.points.map(([t, x], k) => <div className="lp-point" key={k}><b>{t}</b><p>{x}</p></div>)}
        {d.idea.callout && <p className="lp-call"><b>Важно.</b> {d.idea.callout}</p>}</section>
      <section>{label(2)}<h3 className="h3">{d.example.title}</h3>{d.example.text.map((p, k) => <p key={k}>{p}</p>)}{d.example.takeaway && <p className="lp-call"><b>Вывод.</b> {d.example.takeaway}</p>}</section>
      <section>{label(3)}<h3 className="h3">{d.practice.title}</h3>{d.practice.intro && <p>{d.practice.intro}</p>}
        <ol className="lp-list">{d.practice.steps.map((x, k) => <li key={k}>{x}</li>)}</ol>
        {d.practice.reflect && <p className="lp-call"><b>Вопрос для размышления.</b> {d.practice.reflect}</p>}</section>
      <section>{label(4)}<h3 className="h3">Проверьте себя</h3>
        {d.check.map((q, k) => (
          <div className="lp-q" key={k}>
            <b>{k + 1}. {q.q}</b>
            <ul>{q.options.map((o, n) => <li key={n} className={answers && n === q.correct ? 'ok' : ''}>{answers && n === q.correct && <Icon name="check" size={15} />}{o}</li>)}</ul>
            {answers && q.why && <p className="muted">{q.why}</p>}
          </div>
        ))}</section>
      <section>{label(5)}<h3 className="h3">{d.key.title}</h3><ul className="lp-list">{d.key.theses.map((x, k) => <li key={k}>{x}</li>)}</ul>{d.key.action && <p className="lp-call"><b>Действие на сегодня.</b> {d.key.action}</p>}</section>
      {d.sources.length > 0 && <section><p className="label lp-kicker">Источники</p><ul className="lp-list">{d.sources.map((x, k) => <li key={k}>{x}</li>)}</ul></section>}
    </article>
  );
}
function PreviewDialog({ data }) {
  return <div className="dlg"><DialogHead title="Предпросмотр урока" /><div className="dlg-body"><LessonPreview data={data} /></div></div>;
}

/* ---------- редактор ---------- */
const pad = (list, n, make) => [...list, ...Array.from({ length: Math.max(0, n - list.length) }, make)];
/* Урок → поля формы: абзацы в одном поле через пустую строку, списки дополнены пустыми строками */
function toForm(c) {
  return {
    title: c.title, summary: c.summary, topic: c.topic, format: c.format, level: c.level, tags: c.tags.join(', '),
    outcomes: pad(c.outcomes, 3, () => '').slice(0, 3),
    why: { title: c.why.title, text: c.why.text.join('\n\n') },
    idea: { title: c.idea.title, intro: c.idea.intro, points: pad(c.idea.points, 2, () => ['', '']), callout: c.idea.callout },
    example: { title: c.example.title, text: c.example.text.join('\n\n'), takeaway: c.example.takeaway },
    practice: { title: c.practice.title, intro: c.practice.intro, steps: pad(c.practice.steps, 2, () => ''), reflect: c.practice.reflect },
    check: pad(c.check, 3, () => ({ q: '', options: [], correct: 0, why: '' })).slice(0, 3).map(q => ({ ...q, options: pad(q.options, 3, () => '') })),
    key: { title: c.key.title, theses: pad(c.key.theses, 3, () => '').slice(0, 3), action: c.key.action },
    sources: c.sources.join('\n'),
  };
}
const fromForm = f => ({ ...f, tags: f.tags.split(',') });
const setIn = (o, [k, ...rest], v) => { const out = Array.isArray(o) ? [...o] : { ...o }; out[k] = rest.length ? setIn(o[k], rest, v) : v; return out; };

function F({ label, hint, opt, max, value, children, id }) {
  return (
    <div className="form-row">
      <label htmlFor={id}>{label}{opt && <span className="optional">необязательно</span>}{max != null && <span className={`cnt ${value.length > max ? 'over' : ''}`}>{value.length} / {max}</span>}</label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function Editor({ lesson }) {
  const nav = useNavigate();
  const ui = useUI();
  const [form, setForm] = useState(() => toForm(lesson.data));
  const [status, setStatus] = useState(lesson.status);
  const [saved, setSaved] = useState('saved');        // saved | dirty | saving | error
  const [tried, setTried] = useState(false);
  const act = useAction();
  const { setError } = act;
  const locked = status === 'review';
  const live = useRef({ form, saved });
  live.current = { form, saved };
  useTitle(form.title || 'Новый урок');

  const set = (path, v) => { if (locked) return; setForm(f => setIn(f, path, v)); setSaved('dirty'); };
  // сохранения идут строго по очереди: отправка на проверку дожидается, пока запишется последняя правка
  const job = useRef(Promise.resolve(true));
  const save = useCallback(() => {
    job.current = job.current.then(async () => {
      if (live.current.saved !== 'dirty') return live.current.saved !== 'error';
      const snapshot = live.current.form;
      live.current.saved = 'saving'; setSaved('saving');
      try {
        setStatus(await saveLesson(lesson.id, fromForm(snapshot)));
        const next = live.current.form === snapshot ? 'saved' : 'dirty';
        live.current.saved = next; setSaved(next);
        return next === 'saved' ? true : save();
      } catch (e) { live.current.saved = 'error'; setSaved('error'); setError(e.message); return false; }
    });
    return job.current;
  }, [lesson.id, setError]);
  // черновик сохраняется сам через секунду после последней правки и при уходе со страницы
  useEffect(() => { if (saved !== 'dirty') return undefined; const t = setTimeout(save, 1200); return () => clearTimeout(t); }, [form, saved, save]);
  useEffect(() => () => { if (live.current.saved === 'dirty') saveLesson(lesson.id, fromForm(live.current.form)).catch(() => {}); }, [lesson.id]);

  const clean = useMemo(() => cleanLesson(fromForm(form)), [form]);
  const problems = useMemo(() => checkLesson(fromForm(form), TOPICS), [form]);
  const bad = part => tried && problems.some(p => p.part === part);
  const submit = () => {
    setTried(true);
    if (problems.length) { document.getElementById('st-problems')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    act.run('submit', async () => { if (!(await save())) return; await submitLesson(lesson.id); live.current.saved = 'saved'; ui.toast('Урок отправлен на проверку'); nav('/studio'); });
  };
  const withdraw = () => act.run('back', async () => { await withdrawLesson(lesson.id); setStatus('draft'); ui.toast('Урок отозван с проверки'); });
  const input = (path, value, props = {}) => <input className="input" type="text" disabled={locked} value={value} onChange={e => set(path, e.target.value)} {...props} />;
  const area = (path, value, props = {}) => <textarea className="input" disabled={locked} value={value} onChange={e => set(path, e.target.value)} {...props} />;
  const L = LIMITS;
  const [label, tone] = STATUS[status] || STATUS.draft;

  return (
    <section className="page st-editor" data-status={status} data-saved={saved}>
      <div className="wrap">
        <header className="page-head">
          <Link className="more-link" to="/studio"><Icon name="arrow-left" size={16} />Мастерская</Link>
          <h1 className="h1">{form.title || 'Новый урок'}</h1>
          <p className="st-bar">
            <span className={`st-status ${tone}`} id="st-status">{label}</span>
            <span className="muted" id="st-saved" role="status">{{ saved: 'Сохранено', dirty: 'Есть несохранённые правки', saving: 'Сохраняем…', error: 'Не удалось сохранить' }[saved]}</span>
            <span className="muted num" id="st-minutes">{clean.minutes ? `≈ ${clean.minutes} мин` : ''}</span>
          </p>
        </header>

        {locked && <div className="note-box" style={{ marginBottom: 20 }}><Icon name="lock" size={20} /><p>Урок на проверке, поэтому поля закрыты. Чтобы что-то поправить, отзовите его: <button type="button" className="link-btn" id="st-withdraw" onClick={withdraw}>отозвать с проверки</button>.</p></div>}
        {status === 'rejected' && lesson.note && <div className="note-box st-note" style={{ marginBottom: 20 }}><Icon name="info" size={20} /><p><b>Комментарий модератора.</b> {lesson.note}</p></div>}
        {lesson.live && status !== 'review' && <div className="note-box" style={{ marginBottom: 20 }}><Icon name="info" size={20} /><p>У урока есть опубликованная версия. Она остаётся на сайте без изменений, пока новая не пройдёт проверку.</p></div>}

        <div className="st-form">
          <fieldset className={`panel st-part ${bad('meta') ? 'bad' : ''}`} id="part-meta">
            <legend className="h3">Об уроке</legend>
            <F label="Название" id="f-title" max={L.title[1]} value={form.title}>{input(['title'], form.title, { id: 'f-title', maxLength: L.title[1] })}</F>
            <F label="Описание" id="f-summary" max={L.summary[1]} value={form.summary} hint="Два-три предложения на карточке урока: о чём он и что даст читателю.">{area(['summary'], form.summary, { id: 'f-summary', rows: 3, maxLength: L.summary[1] })}</F>
            <div className="st-three">
              <F label="Тема" id="f-topic"><select className="input" id="f-topic" disabled={locked} value={form.topic} onChange={e => set(['topic'], e.target.value)}><option value="">Выберите тему</option>{PUBLIC.map(t => <option key={t.slug} value={t.slug}>{t.title}</option>)}</select></F>
              <F label="Формат" id="f-format"><select className="input" id="f-format" disabled={locked} value={form.format} onChange={e => set(['format'], e.target.value)}>{Object.entries(FORMAT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
              <F label="Уровень" id="f-level"><select className="input" id="f-level" disabled={locked} value={form.level} onChange={e => set(['level'], +e.target.value)}>{Object.entries(LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></F>
            </div>
            <F label="Метки" id="f-tags" hint="До трёх, через запятую. Например: Сон, Привычки.">{input(['tags'], form.tags, { id: 'f-tags', maxLength: 100 })}</F>
            <div className="form-row"><span className="st-label">Что читатель узнает: три пункта</span>
              {form.outcomes.map((o, k) => <Fragment key={k}>{input(['outcomes', k], o, { id: `f-out-${k}`, maxLength: L.outcome, 'aria-label': `Пункт ${k + 1}`, placeholder: ['Различать…', 'Понимать, почему…', 'Применять…'][k] })}</Fragment>)}</div>
          </fieldset>

          <fieldset className={`panel st-part ${bad('why') ? 'bad' : ''}`} id="part-why">
            <legend className="h3">1. {BLOCKS[0].label}</legend>
            <p className="muted st-hint">{BLOCKS[0].hint}. Начните с ситуации, знакомой читателю.</p>
            <F label="Заголовок" id="f-why-t">{input(['why', 'title'], form.why.title, { id: 'f-why-t', maxLength: L.blockTitle[1] })}</F>
            <F label="Текст" id="f-why-x" hint="Один-три абзаца. Абзацы разделяйте пустой строкой.">{area(['why', 'text'], form.why.text, { id: 'f-why-x', rows: 5 })}</F>
          </fieldset>

          <fieldset className={`panel st-part ${bad('idea') ? 'bad' : ''}`} id="part-idea">
            <legend className="h3">2. {BLOCKS[1].label}</legend>
            <p className="muted st-hint">{BLOCKS[1].hint}. От двух до пяти тезисов.</p>
            <F label="Заголовок" id="f-idea-t">{input(['idea', 'title'], form.idea.title, { id: 'f-idea-t', maxLength: L.blockTitle[1] })}</F>
            <F label="Вступление" id="f-idea-i" opt>{area(['idea', 'intro'], form.idea.intro, { id: 'f-idea-i', rows: 3, maxLength: L.intro })}</F>
            {form.idea.points.map((p, k) => (
              <div className="st-pair" key={k}>
                <span className="st-n">{k + 1}</span>
                <div className="stack" style={{ gap: 8 }}>
                  {input(['idea', 'points', k, 0], p[0], { id: `f-pt-${k}-t`, maxLength: L.pointTitle, placeholder: 'Тезис', 'aria-label': `Тезис ${k + 1}` })}
                  {area(['idea', 'points', k, 1], p[1], { id: `f-pt-${k}-x`, rows: 2, maxLength: L.pointText, placeholder: 'Пояснение', 'aria-label': `Пояснение к тезису ${k + 1}` })}
                </div>
                {form.idea.points.length > 2 && !locked && <button type="button" className="icon-btn" aria-label={`Убрать тезис ${k + 1}`} onClick={() => set(['idea', 'points'], form.idea.points.filter((_, n) => n !== k))}><Icon name="x" size={18} /></button>}
              </div>
            ))}
            {form.idea.points.length < 5 && !locked && <div><button type="button" className="btn btn-ghost btn-sm" id="add-point" onClick={() => set(['idea', 'points'], [...form.idea.points, ['', '']])}><Icon name="plus" size={16} />Ещё тезис</button></div>}
            <F label="Важное одной фразой" id="f-idea-c" opt>{input(['idea', 'callout'], form.idea.callout, { id: 'f-idea-c', maxLength: L.callout })}</F>
          </fieldset>

          <fieldset className={`panel st-part ${bad('example') ? 'bad' : ''}`} id="part-example">
            <legend className="h3">3. {BLOCKS[2].label}</legend>
            <p className="muted st-hint">{BLOCKS[2].hint}. Имена и детали меняйте так, чтобы человека нельзя было узнать.</p>
            <F label="Заголовок" id="f-ex-t">{input(['example', 'title'], form.example.title, { id: 'f-ex-t', maxLength: L.blockTitle[1] })}</F>
            <F label="Текст" id="f-ex-x" hint="Абзацы разделяйте пустой строкой.">{area(['example', 'text'], form.example.text, { id: 'f-ex-x', rows: 6 })}</F>
            <F label="Вывод из примера" id="f-ex-w">{area(['example', 'takeaway'], form.example.takeaway, { id: 'f-ex-w', rows: 2, maxLength: L.takeaway })}</F>
          </fieldset>

          <fieldset className={`panel st-part ${bad('practice') ? 'bad' : ''}`} id="part-practice">
            <legend className="h3">4. {BLOCKS[3].label}</legend>
            <p className="muted st-hint">{BLOCKS[3].hint}. От двух до пяти шагов, которые можно сделать сегодня.</p>
            <F label="Заголовок" id="f-pr-t">{input(['practice', 'title'], form.practice.title, { id: 'f-pr-t', maxLength: L.blockTitle[1] })}</F>
            <F label="Вступление" id="f-pr-i" opt>{input(['practice', 'intro'], form.practice.intro, { id: 'f-pr-i', maxLength: L.intro })}</F>
            {form.practice.steps.map((x, k) => (
              <div className="st-pair" key={k}>
                <span className="st-n">{k + 1}</span>
                {area(['practice', 'steps', k], x, { id: `f-step-${k}`, rows: 2, maxLength: L.step, 'aria-label': `Шаг ${k + 1}` })}
                {form.practice.steps.length > 2 && !locked && <button type="button" className="icon-btn" aria-label={`Убрать шаг ${k + 1}`} onClick={() => set(['practice', 'steps'], form.practice.steps.filter((_, n) => n !== k))}><Icon name="x" size={18} /></button>}
              </div>
            ))}
            {form.practice.steps.length < 5 && !locked && <div><button type="button" className="btn btn-ghost btn-sm" id="add-step" onClick={() => set(['practice', 'steps'], [...form.practice.steps, ''])}><Icon name="plus" size={16} />Ещё шаг</button></div>}
            <F label="Вопрос для размышления" id="f-pr-r" opt hint="Читатель ответит на него своими словами.">{input(['practice', 'reflect'], form.practice.reflect, { id: 'f-pr-r', maxLength: L.reflect })}</F>
          </fieldset>

          <fieldset className={`panel st-part ${bad('check') ? 'bad' : ''}`} id="part-check">
            <legend className="h3">5. {BLOCKS[4].label}</legend>
            <p className="muted st-hint">Три вопроса по тексту урока. Отметьте верный вариант и объясните, почему он верный.</p>
            {form.check.map((q, k) => (
              <div className="st-q" key={k}>
                <F label={`Вопрос ${k + 1}`} id={`f-q-${k}`}>{input(['check', k, 'q'], q.q, { id: `f-q-${k}`, maxLength: L.question })}</F>
                <div className="st-opts" role="radiogroup" aria-label={`Варианты ответа на вопрос ${k + 1}`}>
                  {q.options.map((o, n) => (
                    <label className="st-opt" key={n}>
                      <input type="radio" name={`q-${k}`} disabled={locked} checked={q.correct === n} onChange={() => set(['check', k, 'correct'], n)} aria-label={`Верный вариант: ${n + 1}`} />
                      {input(['check', k, 'options', n], o, { id: `f-q-${k}-o-${n}`, maxLength: L.option, placeholder: `Вариант ${n + 1}`, 'aria-label': `Вариант ${n + 1}` })}
                    </label>
                  ))}
                  {q.options.length < 4 && !locked && <div><button type="button" className="btn btn-ghost btn-sm" onClick={() => set(['check', k, 'options'], [...q.options, ''])}><Icon name="plus" size={16} />Ещё вариант</button></div>}
                </div>
                <F label="Объяснение ответа" id={`f-q-${k}-w`}>{area(['check', k, 'why'], q.why, { id: `f-q-${k}-w`, rows: 2, maxLength: L.why })}</F>
              </div>
            ))}
          </fieldset>

          <fieldset className={`panel st-part ${bad('key') ? 'bad' : ''}`} id="part-key">
            <legend className="h3">6. {BLOCKS[5].label}</legend>
            <p className="muted st-hint">Карточка, которая останется у читателя в кабинете: главный вывод, три тезиса и одно действие.</p>
            <F label="Главный вывод" id="f-key-t">{input(['key', 'title'], form.key.title, { id: 'f-key-t', maxLength: L.blockTitle[1] })}</F>
            <div className="form-row"><span className="st-label">Три тезиса</span>{form.key.theses.map((x, k) => <Fragment key={k}>{input(['key', 'theses', k], x, { id: `f-th-${k}`, maxLength: L.thesis, 'aria-label': `Тезис ${k + 1}` })}</Fragment>)}</div>
            <F label="Действие на сегодня" id="f-key-a">{input(['key', 'action'], form.key.action, { id: 'f-key-a', maxLength: L.action })}</F>
          </fieldset>

          <fieldset className="panel st-part" id="part-sources">
            <legend className="h3">Источники</legend>
            <F label="Откуда взяты факты" id="f-src" opt hint="По одному на строку: автор, название, год. Если в уроке есть цифры и исследования, источники нужны.">{area(['sources'], form.sources, { id: 'f-src', rows: 3 })}</F>
          </fieldset>
        </div>

        <div className="st-foot">
          {tried && problems.length > 0 && (
            <div className="note-box st-problems" id="st-problems" role="alert">
              <Icon name="info" size={20} />
              <div><b>Чтобы отправить урок, осталось:</b><ul>{problems.map(p => <li key={p.text}><a href={`#part-${p.part}`} onClick={e => { e.preventDefault(); document.getElementById(`part-${p.part}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{p.text}</a></li>)}</ul></div>
            </div>
          )}
          <Alert>{act.error}</Alert>
          <div className="row">
            {!locked && <button type="button" className="btn btn-primary btn-lg" id="st-submit" disabled={Boolean(act.busy)} onClick={submit}><Icon name="send" size={18} />{act.busy === 'submit' ? 'Отправляем…' : 'Отправить на проверку'}</button>}
            <button type="button" className="btn btn-secondary btn-lg" id="st-preview" onClick={() => ui.open(<PreviewDialog data={fromForm(form)} />)}><Icon name="eye" size={18} />Предпросмотр</button>
            {!locked && <button type="button" className="btn btn-ghost btn-lg" id="st-save" disabled={saved !== 'dirty' && saved !== 'error'} onClick={() => { if (saved === 'error') setSaved('dirty'); setTimeout(save, 0); }}>Сохранить черновик</button>}
          </div>
          <p className="field-hint">Черновик сохраняется сам. Отправленный урок читает модератор: обычно это занимает несколько дней. Решение появится в мастерской.</p>
        </div>
      </div>
    </section>
  );
}

function EditorEntry() {
  const { id } = useParams();
  const [st, setSt] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    setSt({ loading: true });
    getLesson(id).then(l => { if (alive) setSt({ loading: false, lesson: l }); }, e => { if (alive) setSt({ loading: false, error: e.message }); });
    return () => { alive = false; };
  }, [id]);
  if (st.loading) return <section className="page"><div className="wrap"><p className="muted" aria-busy="true">Загружаем урок…</p></div></section>;
  if (st.error) return <section className="page"><div className="wrap"><Alert>{st.error}</Alert></div></section>;
  if (!st.lesson) return <NotFound />;
  return <Editor lesson={st.lesson} key={id} />;
}
export const LessonEditor = () => <Gate><EditorEntry /></Gate>;

/* ---------- модерация ---------- */
function QueueItem({ item, onDone }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const act = useAction();
  const { toast } = useUI();
  const d = item.data, topic = TOPIC_BY[d.topic];
  const decide = ok => act.run(ok ? 'ok' : 'no', async () => { await reviewLesson(item.id, ok, note); toast(ok ? 'Урок опубликован' : 'Урок возвращён автору'); onDone(item.id); });
  return (
    <li className="panel md-item" data-lesson={item.id}>
      <div className="md-head">
        <div className="stack" style={{ gap: 4, minWidth: 0 }}>
          <b className="h4">{d.title || 'Без названия'}</b>
          <span className="muted">{[item.author && item.author.name, topic && topic.title, d.minutes ? `${d.minutes} мин` : null, `отправлен ${date(item.submitted_at)}`].filter(Boolean).join(' · ')}</span>
          {item.author && item.author.bio && <span className="muted">Об авторе: {item.author.bio}</span>}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Свернуть' : 'Читать урок'}</button>
      </div>
      {open && (
        <>
          <LessonPreview data={d} />
          <div className="md-decide">
            <Alert>{act.error}</Alert>
            <div className="form-row">
              <label htmlFor={`md-note-${item.id}`}>Комментарий автору</label>
              <textarea className="input" id={`md-note-${item.id}`} rows={3} maxLength={2000} placeholder="Обязателен, если урок возвращается: что именно поправить." value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="row">
              <button type="button" className="btn btn-primary md-approve" disabled={Boolean(act.busy)} onClick={() => decide(true)}><Icon name="check" size={17} />Опубликовать</button>
              <button type="button" className="btn btn-secondary md-reject" disabled={Boolean(act.busy) || note.trim().length < 5} onClick={() => decide(false)}>Вернуть на доработку</button>
            </div>
          </div>
        </>
      )}
    </li>
  );
}

function ModerationBody() {
  useTitle('Модерация');
  const { toast } = useUI();
  const [tab, setTab] = useState('queue');
  const [st, setSt] = useState({ loading: true });
  const act = useAction();
  const load = useCallback(async () => {
    try {
      if (!(await amModerator())) { setSt({ loading: false, denied: true }); return; }
      const [queue, reports, live] = await Promise.all([reviewQueue(), openReports(), allPublished()]);
      setSt({ loading: false, queue, reports, live });
    } catch (e) { setSt({ loading: false, error: e.message }); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRefreshOnReturn(load);
  if (st.loading) return <section className="page"><div className="wrap"><p className="muted" aria-busy="true">Загружаем…</p></div></section>;
  if (st.denied) return <section className="page"><div className="wrap"><EmptyState title="Страница для модераторов" text="Здесь проверяют авторские уроки перед публикацией. Модераторов назначает владелец сайта."><Link className="btn btn-primary" to="/studio">В мастерскую</Link></EmptyState></div></section>;
  if (st.error) return <section className="page"><div className="wrap"><Alert>{st.error}</Alert></div></section>;
  const hide = (id, hidden, reportId) => act.run(`h-${id}`, async () => { await setHidden(id, hidden); if (reportId) await resolveReport(reportId); toast(hidden ? 'Урок скрыт' : 'Урок возвращён на сайт'); await load(); });
  const dismiss = id => act.run(`r-${id}`, async () => { await resolveReport(id); toast('Жалоба закрыта'); await load(); });
  const tabs = [['queue', 'На проверке', st.queue.length], ['reports', 'Жалобы', st.reports.length], ['live', 'Опубликованные', st.live.length]];
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">Модерация</h1>
          <p className="lead">Урок появляется в каталоге только после вашего решения. Возвращая урок, напишите автору, что поправить.</p>
        </header>
        <div className="seg-ctl md-tabs" role="tablist">
          {tabs.map(([k, label, n]) => <button key={k} type="button" role="tab" aria-selected={tab === k} aria-checked={tab === k} data-tab={k} onClick={() => setTab(k)}>{label}<span className="num">{n}</span></button>)}
        </div>
        <Alert>{act.error}</Alert>

        {tab === 'queue' && (
          <div className="md-grid">
            {st.queue.length
              ? <ul className="md-list" id="md-queue">{st.queue.map(x => <QueueItem key={x.id} item={x} onDone={load} />)}</ul>
              : <p className="muted" id="md-empty">Очередь пуста: все уроки проверены.</p>}
            <aside className="panel md-check"><h2 className="h4">Что проверить</h2><ul>{MOD_CHECKLIST.map(x => <li key={x}><Icon name="check" size={16} /><span>{x}</span></li>)}</ul></aside>
          </div>
        )}

        {tab === 'reports' && (st.reports.length ? (
          <ul className="md-list" id="md-reports">
            {st.reports.map(r => (
              <li className="panel md-item" key={r.id} data-report={r.id}>
                <div className="stack" style={{ gap: 6 }}>
                  <span className="muted">{date(r.created_at)} · урок {r.lesson ? <Link to={`/courses/${r.lesson.slug}`}>«{r.lesson.title}»</Link> : 'удалён'}{r.lesson && r.lesson.hidden ? ' (скрыт)' : ''}</span>
                  <p>{r.reason}</p>
                </div>
                <div className="row">
                  {r.lesson && !r.lesson.hidden && <button type="button" className="btn btn-danger btn-sm md-hide" disabled={Boolean(act.busy)} onClick={() => hide(r.lesson.id, true, r.id)}>Скрыть урок</button>}
                  <button type="button" className="btn btn-ghost btn-sm md-dismiss" disabled={Boolean(act.busy)} onClick={() => dismiss(r.id)}>Закрыть жалобу</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Открытых жалоб нет.</p>)}

        {tab === 'live' && (st.live.length ? (
          <ul className="md-list" id="md-live">
            {st.live.map(l => (
              <li className="panel md-row" key={l.id} data-lesson={l.id}>
                <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <Link className="h4" to={`/courses/${l.slug}`}>{l.title}</Link>
                  <span className="muted">{[l.author && l.author.name, TOPIC_BY[l.topic] && TOPIC_BY[l.topic].title, `прошли ${l.learners}`, date(l.published_at)].filter(Boolean).join(' · ')}</span>
                </div>
                {l.hidden
                  ? <div className="row"><span className="st-status bad">{l.hidden_by === 'moderator' ? 'Скрыт модератором' : 'Снят автором'}</span><button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(act.busy)} onClick={() => hide(l.id, false)}>Вернуть на сайт</button></div>
                  : <button type="button" className="btn btn-ghost btn-sm md-hide" disabled={Boolean(act.busy)} onClick={() => hide(l.id, true)}>Скрыть</button>}
              </li>
            ))}
          </ul>
        ) : <p className="muted">Опубликованных авторских уроков пока нет.</p>)}
      </div>
    </section>
  );
}
export const Moderation = () => <Gate title="Модерация"><ModerationBody /></Gate>;
