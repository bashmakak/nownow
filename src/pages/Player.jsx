import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BLOCKS, COURSE_BY, DISCLAIMER, REC_ORDER, TOPIC_BY, VERSION, about, coursesOf, isCommunity, lesson, minutes } from '../data';
import { useFull } from '../data/full-loader.js';
import { useStore, getState, update, ensureProgress, newProgress, today, status, statusOf, activeVersion, pkey, leftLabel, streak, plural } from '../lib/store.js';
import { useUI, useTitle, DialogHead } from '../lib/ui.jsx';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { EmptyState, KeyCard } from '../components/Cards.jsx';
import { Play } from '../components/Play.jsx';
import { CountUp, XpBar } from '../components/GameUI.jsx';
import { REVIEW, trainerFor } from '../data/trainers.js';
import { REVIEW_MIN, XP, lessonXp, reviewPool, rightOf, xpOf } from '../lib/game.js';
import { celebrate, sparkFrom } from '../lib/fx.js';
import { CLOUD } from '../config.js';
import { useAuth } from '../lib/cloud.js';
import { settleCredits, useCommunityLesson } from '../lib/community.js';
import { LessonWait } from '../components/Community.jsx';
import NotFound from './NotFound.jsx';

/* ---------- переходы между блоками ---------- */
/* c — урок в открытой версии: по его проверке считается число верных ответов при завершении */
function goNext(slug, c) {
  update(d => {
    const p = ensureProgress(d, slug), i = p.block;
    if (!p.done[i]) { p.done[i] = 1; today(d).blocks++; }
    p.touched = Date.now();
    if (i >= 5) {
      p.finished = true;
      if (!p.completed) p.completed = Date.now();
      // лучший результат проверки остаётся за уроком и при повторном прохождении
      p.right = Math.max(p.right || 0, c.check.filter((q, k) => p.answers[k] === q.correct).length);
      if (c.community) p.checks = c.check.length;     // число вопросов: по нему считается «без ошибок», когда текст урока не загружен
      p.finishedAt = Date.now();
    } else p.block = i + 1;
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
// выделение внутри текста: **важное** и `код`
const fmt = text => String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, k) => {
  if (part.startsWith('**')) return <b key={k}>{part.slice(2, -2)}</b>;
  if (part.startsWith('`')) return <code key={k}>{part.slice(1, -1)}</code>;
  return part;
});
const Paras = ({ text }) => text.map(x => <p key={x}>{fmt(x)}</p>);
const Callout = ({ label, text, icon }) => (
  <div className="callout"><Icon name={icon} size={20} /><p><small>{label}</small>{fmt(text)}</p></div>
);

/* Развёрнутое содержимое блока. Узел — массив [тип, ...данные]:
   p, h, ul, ol, note, think (вопрос с разбором), code, quote, table */
function Rich({ nodes }) {
  return nodes.map((n, k) => {
    const [t, a, b, c] = n;
    switch (t) {
      case 'h': return <h2 className="rt-h" key={k}>{a}</h2>;
      case 'ul': return <ul className="rt-list" key={k}>{a.map(x => <li key={x}>{fmt(x)}</li>)}</ul>;
      case 'ol': return <ol className="rt-list rt-ol" key={k}>{a.map(x => <li key={x}>{fmt(x)}</li>)}</ol>;
      case 'note': return <Callout key={k} label={a} text={b} icon={c || 'lightbulb'} />;
      case 'think': return (
        <div className="think" key={k}>
          <small>Остановитесь и подумайте</small>
          <p>{fmt(a)}</p>
          <details><summary>Показать разбор<Icon name="chevron-down" size={18} /></summary><p>{fmt(b)}</p></details>
        </div>
      );
      case 'code': return <pre className="code" key={k} tabIndex={0} aria-label="Пример кода"><code>{a}</code></pre>;
      case 'quote': return <blockquote className="rt-quote" key={k}><p>{fmt(a)}</p>{b && <cite>{b}</cite>}</blockquote>;
      case 'table': return (
        <div className="rt-table" key={k} tabIndex={0} role="region" aria-label={c || 'Таблица'}>
          {/* роли заданы явно: на узком экране таблица раскладывается в карточки через display:block */}
          <table role="table">
            <thead role="rowgroup"><tr role="row">{a.map(x => <th key={x} scope="col" role="columnheader">{x}</th>)}</tr></thead>
            <tbody role="rowgroup">
              {b.map((row, i) => (
                <tr key={i} role="row">{row.map((x, j) => (j === 0
                  ? <th key={j} scope="row" role="rowheader">{fmt(x)}</th>
                  : <td key={j} role="cell" data-label={a[j]}>{fmt(x)}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      default: return <p key={k}>{fmt(a)}</p>;
    }
  });
}

/* Рабочий лист в практике: несколько полей, ответы сохраняются в прогрессе урока */
function Sheet({ slug, fields, work }) {
  const filled = fields.some((f, k) => (work[k] || '').trim());
  return (
    <div className="sheet">
      {fields.map((f, k) => (
        <div className="sheet-row" key={f.label}>
          <label htmlFor={`pl-sheet-${k}`}><span className="num">{k + 1}</span>{f.label}</label>
          {f.hint && <p className="sheet-hint">{f.hint}</p>}
          <textarea className="input" id={`pl-sheet-${k}`} rows={f.rows || 3} placeholder={f.placeholder || 'Ваш ответ'}
            value={work[k] || ''}
            onChange={e => update(d => { const p = ensureProgress(d, slug); if (!p.work) p.work = {}; p.work[k] = e.target.value; })} />
        </div>
      ))}
      <p className="saved" aria-live="polite">{filled ? 'Сохранено. Ответы появятся в кабинете.' : 'Поля можно пропустить, но урок работает, только если писать.'}</p>
    </div>
  );
}

function Question({ slug, q, qi, total, answer }) {
  const fb = useRef(null);
  const was = useRef(answer);
  const [just, setJust] = useState(false);   // ответ дан только что: показываем реакцию
  const answered = answer != null;
  useEffect(() => {
    if (was.current == null && answer != null) { fb.current?.focus({ preventScroll: true }); setJust(true); }
    was.current = answer;
  }, [answer]);
  return (
    <fieldset className={`q ${just ? 'just' : ''}`} data-q={qi}>
      <legend><small>Вопрос {qi + 1} из {total}</small>{q.q}</legend>
      <div className="q-opts">
        {q.options.map((o, oi) => {
          const sel = answer === oi, right = oi === q.correct;
          const cls = answered ? (right ? 'ok' : sel ? 'bad' : '') : '';
          return (
            <button key={o} type="button" className={`opt ${cls}`} disabled={answered} aria-pressed={sel}
              onClick={e => { if (right) sparkFrom(e.currentTarget); update(d => { const p = ensureProgress(d, slug); if (p.answers[qi] == null) p.answers[qi] = oi; }); }}>
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

/* c — урок в выбранной версии, pk — ключ его прогресса */
function Block({ course: c, pk, note, p, hRef }) {
  const i = p.block, b = BLOCKS[i];
  const kicker = <p className="label pl-kicker">Блок {i + 1} из 6 · {b.label}{note}</p>;
  const h = text => <h1 className="h2" id="pl-h" tabIndex={-1} ref={hRef}>{text}</h1>;
  switch (b.kind) {
    case 'why': return (<>
      {kicker}{h(c.why.title)}
      {c.why.text && <Paras text={c.why.text} />}
      {c.why.body && <Rich nodes={c.why.body} />}
      {c.why.play && <Play cfg={c.why.play} pk={pk} kind="why" was={p.play?.why} />}
      {c.disclaimer && <div className="note-box"><Icon name="info" size={20} /><p>{DISCLAIMER}</p></div>}
    </>);
    case 'idea': return (<>
      {kicker}{h(c.idea.title)}
      {c.idea.intro && <p className="pl-intro">{fmt(c.idea.intro)}</p>}
      {c.idea.points && (
        <ul className="points">{c.idea.points.map(([t, x]) => <li key={t}><div><h2 className="h4">{t}</h2><p>{fmt(x)}</p></div></li>)}</ul>
      )}
      {c.idea.body && <Rich nodes={c.idea.body} />}
      {c.idea.play && <Play cfg={c.idea.play} pk={pk} kind="idea" was={p.play?.idea} />}
      {c.idea.callout && <Callout label="Важно" text={c.idea.callout} icon="lightbulb" />}
    </>);
    case 'example': return (<>
      {kicker}{h(c.example.title)}
      {c.example.text && <Paras text={c.example.text} />}
      {c.example.body && <Rich nodes={c.example.body} />}
      {c.example.play && <Play cfg={c.example.play} pk={pk} kind="example" was={p.play?.example} />}
      {c.example.takeaway && <Callout label="Вывод" text={c.example.takeaway} icon="circle-check" />}
    </>);
    case 'practice': return (<>
      {kicker}{h(c.practice.title)}
      {c.practice.intro && <p className="pl-intro">{fmt(c.practice.intro)}</p>}
      {c.practice.body && <Rich nodes={c.practice.body} />}
      {c.practice.play && <Play cfg={c.practice.play} pk={pk} kind="practice" was={p.play?.practice} />}
      {c.practice.sheet && <Sheet slug={pk} fields={c.practice.sheet} work={p.work || {}} />}
      {c.practice.steps && (
        <ol className="psteps">
          {c.practice.steps.map((step, k) => (
            <li key={step}>
              <label className="pstep">
                <input type="checkbox" id={`pl-step-${k}`} checked={Boolean(p.steps[k])}
                  onChange={e => update(d => { ensureProgress(d, pk).steps[k] = e.target.checked; })} />
                <span className="box"><Icon name="check" size={16} /></span>
                <span><small>Шаг {k + 1}</small>{fmt(step)}</span>
              </label>
            </li>
          ))}
        </ol>
      )}
      {c.practice.reflect && (
        <div className="reflect">
          <label htmlFor="pl-reflect">{c.practice.reflect}</label>
          <textarea className="input" id="pl-reflect" rows={4} placeholder="Ответ сохранится в кабинете. Это поле можно пропустить."
            value={p.reflect || ''} onChange={e => update(d => { ensureProgress(d, pk).reflect = e.target.value; })} />
          <p className="saved" aria-live="polite">{p.reflect ? 'Сохранено' : ''}</p>
        </div>
      )}
    </>);
    case 'check': return (<>
      {kicker}{h('Проверьте себя')}
      <p className="pl-intro">{c.check.length} {plural(c.check.length, ['вопрос', 'вопроса', 'вопросов'])} по материалу урока. После ответа появится объяснение.</p>
      {c.check.map((q, qi) => <Question key={q.q} slug={pk} q={q} qi={qi} total={c.check.length} answer={p.answers[qi] ?? null} />)}
    </>);
    default: return (<>
      {kicker}{h('Итог урока')}<p className="pl-intro">Главное из урока на одной карточке. Она сохранится в кабинете.</p>
      <KeyCard course={c} />
    </>);
  }
}

function Done({ course: c, pk, version, p, hRef }) {
  const s = useStore();
  const right = c.check.filter((q, i) => p.answers[i] === q.correct).length;
  const st = streak(s);
  const mins = Math.max(1, Math.round(p.seconds / 60));
  const nextC = coursesOf(c.topic).concat(REC_ORDER.map(slug => COURSE_BY[slug])).find(x => x.slug !== c.slug && status(s, x.slug) !== 'done');
  const rate = v => update(d => { ensureProgress(d, pk).useful = v; });
  // после короткой версии предлагаем полную, если она есть и ещё не пройдена
  const deeper = version === 'short' && c.full && statusOf(s, c.slug, 'full') !== 'done';
  // опыт за этот урок: сам урок, верные ответы, задания
  const gained = lessonXp(s, pk), plays = Object.values(p.play || {}).filter(x => x && x.done).length;
  // тренажёр по этому уроку; если такого нет, предлагаем повторение пройденного
  const trainer = trainerFor(c.slug) || (reviewPool(s).length >= REVIEW_MIN ? REVIEW : null);
  // искры только в момент завершения, а не при каждом возвращении на этот экран
  useEffect(() => { if (Date.now() - (p.finishedAt || 0) < 4000) celebrate(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  // авторский урок: автору начисляются его искры — за прохождение и отдельно за оценку «полезно».
  // Нужен вход: без него неясно, за кого начислять. Повторный вызов ничего не добавляет (см. complete_lesson в базе)
  const account = useAuth();
  const uid = CLOUD && account.user ? account.user.id : null;
  useEffect(() => { if (c.community && uid) settleCredits(); }, [c.community, uid, p.useful]);
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
      <div className="reward" id="reward">
        <div className="reward-sum"><b>+<CountUp value={gained} ms={900} /></b><span>к опыту за урок</span></div>
        <ul className="reward-list">
          <li><span>Урок пройден</span><b>+{XP[version]}</b></li>
          <li><span>Верные ответы: {rightOf(c, version, p)} из {c.check.length}</span><b>+{rightOf(c, version, p) * XP.answer}</b></li>
          {plays > 0 && <li><span>Задания: {plays}</span><b>+{plays * XP.play}</b></li>}
        </ul>
        <XpBar xp={xpOf(s)} />
      </div>
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
      {c.community && (
        <div className="deeper" id="done-author">
          <div><b>Урок написал участник NowNow: {c.author.name}</b><span>{uid
            ? 'Автор получает искры за каждого читателя, который прошёл урок, и ещё немного, если урок отмечен полезным.'
            : 'Автор получает искры, когда урок проходят читатели, вошедшие в учётную запись. Войдите, и ваше прохождение тоже будет учтено.'}</span></div>
          {!uid && CLOUD && <Link className="btn btn-secondary" to="/login">Войти</Link>}
        </div>
      )}
      {deeper && (
        <div className="deeper">
          <div><b>Хотите разобраться глубже?</b><span>У этого урока есть полная версия: подробный разбор, рабочий лист и больше вопросов.</span></div>
          <Link className="btn btn-secondary" to={`/learn/${c.slug}/full`}>Полная версия · {minutes(c, 'full')} мин</Link>
        </div>
      )}
      {trainer && (
        <div className="deeper deeper-train">
          <div><b>Закрепите в тренажёре «{trainer.title}»</b><span>{trainer.hook} Раунд займёт около двух минут.</span></div>
          <Link className="btn btn-secondary" to={`/train/${trainer.id}`}><Icon name="gamepad-2" size={17} />Сыграть раунд</Link>
        </div>
      )}
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
function PlayerBody({ course: base, version }) {
  const c = lesson(base, version);         // урок в выбранной версии
  useTitle(c.title);
  const slug = pkey(base.slug, version);   // ключ прогресса этой версии
  const T = about(base, version);          // расчётное время блоков в секундах
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
      // в коде и таблицах стрелки нужны для прокрутки
      if (e.target.closest && e.target.closest('pre, .rt-table')) return;
      const onControl = tag === 'button' || tag === 'a' || tag === 'summary';
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(slug, c); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(slug); }
      else if (e.key === 'Enter' && !onControl) { e.preventDefault(); goNext(slug, c); }
      else if (['n', 'N', 'т', 'Т'].includes(e.key)) { e.preventDefault(); openNote(); }
      else if (e.key === '?') { e.preventDefault(); openKeys(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, finished]);

  const i = p.block;
  // направление перехода между блоками: вперёд блок въезжает справа, назад — слева
  const prevBlock = useRef(i);
  const dir = i >= prevBlock.current ? 'fwd' : 'back';
  useEffect(() => { prevBlock.current = i; }, [i]);
  const fill = k => {
    if (p.done[k] || finished) return 100;
    if (k === i) return Math.min(100, Math.max(5, p.elapsed[k] / T.blocks[k] * 100));
    return 0;
  };
  const firstOpen = p.done.findIndex(d => !d);
  const reach = Math.max(firstOpen < 0 ? 5 : firstOpen, i);
  // осталось по оценке: непройденные блоки впереди плюс остаток текущего
  let left = T.blocks.reduce((sum, sec, k) => sum + (k > i && !p.done[k] ? sec : 0), 0);
  if (!p.done[i]) left += Math.max(0, T.blocks[i] - p.elapsed[i]);
  const note = base.full ? ` · ${VERSION[version].toLowerCase()} версия` : '';
  const unanswered = BLOCKS[i].kind === 'check' ? c.check.filter((q, qi) => p.answers[qi] == null).length : 0;

  return (
    <div className="player">
      <header className="pl-top">
        <div className="wrap">
          <div className="pl-top-row">
            <Link className="icon-btn" to={`/courses/${base.slug}`} aria-label="Закрыть урок и вернуться к курсу"><Icon name="x" /></Link>
            <div className="pl-title"><Mark size={20} /><span>{c.title}</span></div>
            <div className="pl-left" id="pl-left">{finished ? 'Урок пройден' : leftLabel(left)}</div>
          </div>
          <ol className="segs" id="pl-segs" aria-label="Блоки урока">
            {BLOCKS.map((b, k) => (
              <li key={b.kind} style={{ flex: `${Math.max(T.blocks[k], T.total * 0.05)} 1 0` }}>
                <button type="button" className="seg" disabled={k > reach || finished} aria-current={k === i && !finished ? 'step' : undefined}
                  aria-label={`Блок ${k + 1}: ${b.label}${p.done[k] ? ', пройден' : ''}`}
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
          <article className="pl-col" id="pl-block" key={finished ? 'done' : i} data-dir={finished ? 'done' : dir}>
            {finished ? <Done course={c} pk={slug} version={version} p={p} hRef={hRef} /> : <Block course={c} pk={slug} note={note} p={p} hRef={hRef} />}
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
              ? <button type="button" className="btn btn-secondary" id="pl-next" onClick={() => goNext(slug, c)}>Пропустить проверку</button>
              : <button type="button" className="btn btn-primary" id="pl-next" onClick={() => goNext(slug, c)}>{i === 5 ? 'Завершить урок' : 'Дальше'}<Icon name={i === 5 ? 'check' : 'arrow-right'} size={18} /></button>}
          </div>
        </footer>
      )}
    </div>
  );
}

/* Адрес /learn/урок/short или /learn/урок/full открывает названную версию.
   Адрес без версии открывает начатую, а если начатых нет — ту, что человек выбрал по умолчанию. */
function PlayerEntry({ course, asked }) {
  const [version] = useState(() => asked || activeVersion(getState(), course));
  // текст полной версии лежит в отдельном файле и скачивается при открытии урока
  const state = useFull(course.slug, version === 'full');
  if (state === 'loading') return <div className="pl-wait" role="status"><Mark size={28} /><span>Загружаем урок…</span></div>;
  if (state === 'error') {
    return (
      <section className="page">
        <div className="wrap">
          <EmptyState title="Не удалось загрузить полную версию" text="Проверьте соединение с интернетом и попробуйте ещё раз. Короткая версия уже загружена и откроется сразу.">
            <div className="row" style={{ justifyContent: 'center' }}>
              {/* браузер запоминает неудачную загрузку файла до перезагрузки страницы, поэтому повтор — это перезагрузка */}
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Повторить</button>
              <Link className="btn btn-secondary" to={`/learn/${course.slug}/short`}>Открыть короткую версию</Link>
            </div>
          </EmptyState>
        </div>
      </section>
    );
  }
  return <PlayerBody course={course} version={version} />;
}

export default function Player() {
  const { slug, version } = useParams();
  // авторский урок скачивается из базы при открытии
  const state = useCommunityLesson(slug);
  const course = COURSE_BY[slug];
  if (!course && isCommunity(slug)) return <LessonWait slug={slug} state={state} player />;
  const known = !version || version === 'short' || (version === 'full' && Boolean(course && course.full));
  return course && known ? <PlayerEntry course={course} asked={version} key={`${slug}/${version || ''}`} /> : <NotFound />;
}
