import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BLOCKS, COURSE_BY, DISCLAIMER, REC_ORDER, TOPIC_BY, coursesOf } from '../data';
import { useStore, getState, update, ensureProgress, newProgress, today, status, streak, plural } from '../lib/store.js';
import { useUI, useTitle, DialogHead } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { KeyCard } from '../components/Cards.jsx';
import NotFound from './NotFound.jsx';

/* ---------- переходы между блоками ---------- */
function goNext(slug) {
  update(d => {
    const p = ensureProgress(d, slug), i = p.block;
    if (!p.done[i]) { p.done[i] = 1; today(d).blocks++; }
    p.touched = Date.now();
    if (i >= 5) { p.finished = true; if (!p.completed) p.completed = Date.now(); } else p.block = i + 1;
  });
}
function goPrev(slug) { update(d => { const p = ensureProgress(d, slug); if (p.block > 0) p.block--; }); }

/* ---------- диалоги ---------- */
function NoteDialog({ slug, block }) {
  const s = useStore();
  const { close } = useUI();
  const key = `${slug}:${block}`;
  return (
    <div className="dlg">
      <DialogHead title={`Заметка к блоку «${BLOCKS[block].label}»`} />
      <div className="dlg-body">
        <label className="sr" htmlFor="pl-note-ta">Текст заметки</label>
        <textarea className="input" id="pl-note-ta" rows={7} placeholder="Мысль, которую хочется сохранить" data-autofocus
          value={s.notes[key] || ''} onChange={e => update(d => { d.notes[key] = e.target.value; })} />
        <p className="saved">Заметка сохраняется сама и появится в кабинете.</p>
        <div className="row"><button type="button" className="btn btn-primary" onClick={close}>Готово</button></div>
      </div>
    </div>
  );
}
function KeysDialog() {
  const rows = [[['→', 'Enter'], 'Следующий блок'], [['←'], 'Предыдущий блок'], [['N'], 'Заметка к блоку'], [['?'], 'Этот список'], [['Esc'], 'Закрыть окно']];
  return (
    <div className="dlg">
      <DialogHead title="Горячие клавиши" />
      <div className="dlg-body">
        <div className="keys">
          {rows.map(([keys, label]) => (
            <span key={label} style={{ display: 'contents' }}>
              <span>{keys.map(k => <span className="kbd" key={k} style={{ marginRight: 4 }}>{k}</span>)}</span><span>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- содержимое блоков ---------- */
const Paras = ({ text }) => text.map(x => <p key={x}>{x}</p>);
const Callout = ({ label, text, icon }) => (
  <div className="callout"><Icon name={icon} size={20} /><p><small>{label}</small>{text}</p></div>
);

function Question({ slug, q, qi, total, answer }) {
  const fb = useRef(null);
  const was = useRef(answer);
  const answered = answer != null;
  useEffect(() => {
    if (was.current == null && answer != null) fb.current?.focus({ preventScroll: true });
    was.current = answer;
  }, [answer]);
  return (
    <fieldset className="q" data-q={qi}>
      <legend><small>Вопрос {qi + 1} из {total}</small>{q.q}</legend>
      <div className="q-opts">
        {q.options.map((o, oi) => {
          const sel = answer === oi, right = oi === q.correct;
          const cls = answered ? (right ? 'ok' : sel ? 'bad' : '') : '';
          return (
            <button key={o} type="button" className={`opt ${cls}`} disabled={answered} aria-pressed={sel}
              onClick={() => update(d => { const p = ensureProgress(d, slug); if (p.answers[qi] == null) p.answers[qi] = oi; })}>
              <span className="dot">{answered && right ? <Icon name="check" size={14} /> : answered && sel ? <Icon name="x" size={14} /> : null}</span>
              <span>{o}{answered && right && <span className="sr"> (верный ответ)</span>}</span>
            </button>
          );
        })}
      </div>
      {answered && <p className="q-fb" tabIndex={-1} ref={fb}><b>{answer === q.correct ? 'Верно.' : 'Не совсем.'}</b> {q.why}</p>}
    </fieldset>
  );
}

function Block({ course: c, p, hRef }) {
  const i = p.block, b = BLOCKS[i];
  const kicker = <p className="label pl-kicker">Блок {i + 1} из 6 · {b.label} · {b.min} мин</p>;
  const h = text => <h1 className="h2" id="pl-h" tabIndex={-1} ref={hRef}>{text}</h1>;
  switch (b.kind) {
    case 'why': return (<>
      {kicker}{h(c.why.title)}<Paras text={c.why.text} />
      {c.disclaimer && <div className="note-box"><Icon name="info" size={20} /><p>{DISCLAIMER}</p></div>}
    </>);
    case 'idea': return (<>
      {kicker}{h(c.idea.title)}<p className="pl-intro">{c.idea.intro}</p>
      <ul className="points">{c.idea.points.map(([t, x]) => <li key={t}><div><h2 className="h4">{t}</h2><p>{x}</p></div></li>)}</ul>
      <Callout label="Важно" text={c.idea.callout} icon="lightbulb" />
    </>);
    case 'example': return (<>
      {kicker}{h(c.example.title)}<Paras text={c.example.text} />
      <Callout label="Вывод" text={c.example.takeaway} icon="circle-check" />
    </>);
    case 'practice': return (<>
      {kicker}{h(c.practice.title)}<p className="pl-intro">{c.practice.intro}</p>
      <ol className="psteps">
        {c.practice.steps.map((step, k) => (
          <li key={step}>
            <label className="pstep">
              <input type="checkbox" id={`pl-step-${k}`} checked={Boolean(p.steps[k])}
                onChange={e => update(d => { ensureProgress(d, c.slug).steps[k] = e.target.checked; })} />
              <span className="box"><Icon name="check" size={16} /></span>
              <span><small>Шаг {k + 1}</small>{step}</span>
            </label>
          </li>
        ))}
      </ol>
      <div className="reflect">
        <label htmlFor="pl-reflect">{c.practice.reflect}</label>
        <textarea className="input" id="pl-reflect" rows={4} placeholder="Ответ сохранится в кабинете. Это поле можно пропустить."
          value={p.reflect || ''} onChange={e => update(d => { ensureProgress(d, c.slug).reflect = e.target.value; })} />
        <p className="saved" aria-live="polite">{p.reflect ? 'Сохранено' : ''}</p>
      </div>
    </>);
    case 'check': return (<>
      {kicker}{h('Проверьте себя')}<p className="pl-intro">Три вопроса по материалу урока. После ответа появится объяснение.</p>
      {c.check.map((q, qi) => <Question key={q.q} slug={c.slug} q={q} qi={qi} total={c.check.length} answer={p.answers[qi] ?? null} />)}
    </>);
    default: return (<>
      {kicker}{h('Итог урока')}<p className="pl-intro">Главное из урока на одной карточке. Она сохранится в кабинете.</p>
      <KeyCard course={c} />
    </>);
  }
}

function Done({ course: c, p, hRef }) {
  const s = useStore();
  const right = c.check.filter((q, i) => p.answers[i] === q.correct).length;
  const st = streak(s);
  const mins = Math.max(1, Math.round(p.seconds / 60));
  const nextC = coursesOf(c.topic).concat(REC_ORDER.map(slug => COURSE_BY[slug])).find(x => x.slug !== c.slug && status(s, x.slug) !== 'done');
  const rate = v => update(d => { ensureProgress(d, c.slug).useful = v; });
  return (
    <div className="done-wrap">
      <div className="flash" aria-hidden="true">
        <svg viewBox="0 0 100 100"><use href="#nv-bolt" style={{ fill: 'var(--bg-2)', stroke: 'var(--bg-2)' }} /></svg>
        <svg className="f-fill" viewBox="0 0 100 100"><use href="#nv-bolt" fill="url(#nv-g)" stroke="url(#nv-g)" /></svg>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <p className="label pl-kicker">Урок пройден</p>
        <h1 className="h1" id="pl-h" tabIndex={-1} ref={hRef}>Ключевое знание получено</h1>
      </div>
      <div style={{ width: '100%' }}><KeyCard course={c} /></div>
      <div className="done-stats">
        <div className="stat"><b>{mins}</b><span>{plural(mins, ['минута', 'минуты', 'минут'])} на урок</span></div>
        <div className="stat"><b>6</b><span>блоков из 6</span></div>
        <div className="stat"><b>{right}</b><span>{plural(right, ['верный ответ', 'верных ответа', 'верных ответов'])} из {c.check.length}</span></div>
        <div className="stat"><b>{st}</b><span>{plural(st, ['день', 'дня', 'дней'])} подряд</span></div>
      </div>
      <div className="rate">
        <h2 className="h4" id="rate-h">Было полезно?</h2>
        <div className="chips" role="group" aria-labelledby="rate-h">
          {[['yes', 'Да'], ['partly', 'Частично'], ['no', 'Нет']].map(([v, label]) => (
            <button key={v} type="button" className="chip" aria-pressed={p.useful === v} onClick={() => rate(v)}>{label}</button>
          ))}
        </div>
        <p className="saved" aria-live="polite">{p.useful ? 'Спасибо, оценка сохранена.' : ''}</p>
      </div>
      <div className="row">
        {nextC && <Link className="btn btn-primary btn-lg" to={`/courses/${nextC.slug}`}>Следующий курс <Icon name="arrow-right" size={18} /></Link>}
        <Link className="btn btn-secondary btn-lg" to="/me">В кабинет</Link>
        <Link className="btn btn-ghost btn-lg" to="/courses">В каталог</Link>
      </div>
      {nextC && <p className="muted" style={{ fontSize: 15 }}>Дальше: «{nextC.title}», {TOPIC_BY[nextC.topic].title.toLowerCase()}.</p>}
    </div>
  );
}

/* ---------- плеер ---------- */
function PlayerBody({ course: c }) {
  useTitle(c.title);
  const slug = c.slug;
  const s = useStore();
  const ui = useUI();
  const hRef = useRef(null);
  const p = s.courses[slug] || newProgress();
  const finished = p.finished;

  // запись о прогрессе появляется при первом входе в урок
  useEffect(() => { update(d => { ensureProgress(d, slug).touched = Date.now(); }); }, [slug]);

  // таймер: считает время на блоке, пока вкладка активна; урок он не ограничивает
  useEffect(() => {
    if (finished) return undefined;
    const id = setInterval(() => {
      if (document.hidden) return;
      update(d => {
        const q = d.courses[slug];
        if (!q || q.finished) return;
        q.elapsed[q.block]++; q.seconds++; today(d).sec++;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [slug, finished]);

  // новый блок: прокрутка вверх и фокус на заголовке
  useEffect(() => { window.scrollTo(0, 0); hRef.current?.focus({ preventScroll: true }); }, [p.block, finished]);

  const openNote = () => ui.open(<NoteDialog slug={slug} block={(getState().courses[slug] || p).block} />, 'dlg-sm');
  const openKeys = () => ui.open(<KeysDialog />, 'dlg-sm');

  useEffect(() => {
    if (finished) return undefined;
    const onKey = e => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      const onControl = tag === 'button' || tag === 'a' || tag === 'summary';
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(slug); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(slug); }
      else if (e.key === 'Enter' && !onControl) { e.preventDefault(); goNext(slug); }
      else if (['n', 'N', 'т', 'Т'].includes(e.key)) { e.preventDefault(); openNote(); }
      else if (e.key === '?') { e.preventDefault(); openKeys(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, finished]);

  const i = p.block;
  const fill = k => {
    if (p.done[k] || finished) return 100;
    if (k === i) return Math.min(100, Math.max(5, p.elapsed[k] / (BLOCKS[k].min * 60) * 100));
    return 0;
  };
  const firstOpen = p.done.findIndex(d => !d);
  const reach = Math.max(firstOpen < 0 ? 5 : firstOpen, i);
  let left = BLOCKS.reduce((sum, b, k) => sum + (k > i && !p.done[k] ? b.min : 0), 0);
  if (!p.done[i]) left += Math.max(0, BLOCKS[i].min - p.elapsed[i] / 60);
  const unanswered = BLOCKS[i].kind === 'check' ? c.check.filter((q, qi) => p.answers[qi] == null).length : 0;

  return (
    <div className="player">
      <header className="pl-top">
        <div className="wrap">
          <div className="pl-top-row">
            <Link className="icon-btn" to={`/courses/${slug}`} aria-label="Закрыть урок и вернуться к курсу"><Icon name="x" /></Link>
            <div className="pl-title"><Mark size={20} /><span>{c.title}</span></div>
            <div className="pl-left" id="pl-left">{finished ? 'Урок пройден' : `Осталось ${Math.max(1, Math.ceil(left))} мин`}</div>
          </div>
          <ol className="segs" id="pl-segs" aria-label="Блоки урока">
            {BLOCKS.map((b, k) => (
              <li key={b.kind} style={{ flex: `${b.min} 1 0` }}>
                <button type="button" className="seg" disabled={k > reach || finished} aria-current={k === i && !finished ? 'step' : undefined}
                  aria-label={`Блок ${k + 1}: ${b.label}, ${b.min} мин${p.done[k] ? ', пройден' : ''}`}
                  onClick={() => update(d => { ensureProgress(d, slug).block = k; })}>
                  <span><i style={{ width: `${fill(k)}%` }} /></span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </header>
      <div className="pl-main">
        <div className="wrap">
          <article className="pl-col" id="pl-block">
            {finished ? <Done course={c} p={p} hRef={hRef} /> : <Block course={c} p={p} hRef={hRef} />}
          </article>
        </div>
      </div>
      {!finished && (
        <footer className="pl-bottom" id="pl-bottom">
          <div className="wrap pl-bottom-row">
            <button type="button" className="btn btn-ghost" aria-label="Предыдущий блок" disabled={i === 0} onClick={() => goPrev(slug)}>
              <Icon name="arrow-left" size={18} /><span>Назад</span>
            </button>
            <button type="button" className="btn btn-ghost" aria-label="Заметка к блоку" onClick={openNote}>
              <Icon name="notebook-pen" size={18} /><span>Заметка</span>
            </button>
            <span className="sp" />
            <button type="button" className="pl-hint btn btn-ghost btn-sm" onClick={openKeys}><Icon name="keyboard" size={16} />Клавиши</button>
            {unanswered
              ? <button type="button" className="btn btn-secondary" id="pl-next" onClick={() => goNext(slug)}>Пропустить проверку</button>
              : <button type="button" className="btn btn-primary" id="pl-next" onClick={() => goNext(slug)}>{i === 5 ? 'Завершить урок' : 'Дальше'}<Icon name={i === 5 ? 'check' : 'arrow-right'} size={18} /></button>}
          </div>
        </footer>
      )}
    </div>
  );
}

export default function Player() {
  const { slug } = useParams();
  const course = COURSE_BY[slug];
  return course ? <PlayerBody course={course} key={slug} /> : <NotFound />;
}
