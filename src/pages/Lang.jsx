import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BLOCKS, TRACKS, TRACK_BY, loadTrack } from '../data/lang/meta.js';
import { TONE_NAMES, buildLesson, buildReview, duePhrases, indexTrack, isGraded, lessonPhrases, shuffle } from '../lib/lang-engine.js';
import { finishLesson, finishReview, langOf } from '../lib/lang-progress.js';
import { speak, stopSpeech, useVoice } from '../lib/speech.js';
import { getState, plural, update, useStore } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { xpOf } from '../lib/game.js';
import { celebrate, sparkFrom } from '../lib/fx.js';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { Crumbs, EmptyState } from '../components/Cards.jsx';
import { CountUp, XpBar } from '../components/GameUI.jsx';
import NotFound from './NotFound.jsx';
import '../lang.css';

/* ===== Языки для путешествий =====
   /lang — список языков; /lang/<код> — трек; /lang/<код>/l/<урок> — урок; /lang/<код>/review — повторение;
   /lang/<код>/phrases — разговорник. Тексты трека скачиваются при открытии (data/lang/meta.js). */

const LETTERS = 'АБВГД';
const date = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const nLessons = n => `${n} ${plural(n, ['урок', 'урока', 'уроков'])}`;
const nPhrases = n => `${n} ${plural(n, ['фраза', 'фразы', 'фраз'])}`;

/* ---------- загрузка трека ---------- */
const ready = {};
function useTrack(code) {
  const [st, setSt] = useState(() => (ready[code] ? { ix: ready[code] } : { loading: true }));
  useEffect(() => {
    if (!TRACK_BY[code] || !TRACK_BY[code].ready) { setSt({ missing: true }); return undefined; }
    if (ready[code]) { setSt({ ix: ready[code] }); return undefined; }
    let alive = true;
    setSt({ loading: true });
    loadTrack(code).then(t => { ready[code] = indexTrack(t); if (alive) setSt({ ix: ready[code] }); }, () => { if (alive) setSt({ error: true }); });
    return () => { alive = false; };
  }, [code]);
  // браузер запоминает неудачную загрузку модуля, поэтому повторная попытка — это перезагрузка страницы
  return { ...st, retry: () => window.location.reload() };
}
function Gate({ code, player = false, children }) {
  const t = useTrack(code);
  if (t.missing) return <NotFound />;
  if (t.error) {
    return (
      <section className="page"><div className="wrap">
        <EmptyState title="Не удалось загрузить курс" text="Проверьте соединение с интернетом и попробуйте ещё раз.">
          <button type="button" className="btn btn-primary" onClick={t.retry}>Повторить</button>
        </EmptyState>
      </div></section>
    );
  }
  if (!t.ix) return player ? <div className="pl-wait" role="status"><Mark size={28} /><span>Загружаем урок…</span></div> : <section className="page" aria-busy="true"><div className="wrap"><p className="muted" role="status">Загружаем курс…</p></div></section>;
  return children(t.ix);
}

/* ---------- озвучка ---------- */
function SpeakBtn({ text, lang, voice, big = false, slow = false, label, id }) {
  if (!voice) return null;
  return (
    <button type="button" className={`lg-say ${big ? 'big' : ''} ${slow ? 'slow' : ''}`} id={id} aria-label={label || (slow ? 'Медленно' : 'Послушать')}
      onClick={() => speak(text, lang, { slow, voice })}>
      <Icon name={slow ? 'turtle' : 'volume-2'} size={big ? 30 : 18} />
    </button>
  );
}
/* Голос с учётом настройки: озвучку можно выключить, тогда задания на слух заменяются заданиями на чтение.
   Настройка хранится только на этом устройстве, как тема оформления */
function useSound(lang) {
  const v = useVoice(lang);
  const on = useStore().voice !== false;
  return { ...v, has: v.status, on, voice: on ? v.voice : null, status: on || v.status !== 'ready' ? v.status : 'off' };
}
function SoundSwitch({ v }) {
  if (v.has !== 'ready') return null;
  return (
    <button type="button" role="switch" aria-checked={v.on} className={`lg-switch ${v.on ? 'on' : ''}`} id="lg-sound"
      onClick={() => { if (v.on) stopSpeech(); update(d => { d.voice = !v.on; }); }}>
      <Icon name={v.on ? 'volume-2' : 'volume-x'} size={17} />Озвучка<i aria-hidden="true" />
    </button>
  );
}
function VoiceNote({ v, lang }) {
  if (v.status === 'off') {
    return (
      <div className="note-box lg-voice" id="lg-voiceoff">
        <Icon name="volume-x" size={20} />
        <p><b>Озвучка выключена.</b> Задания на слух заменены заданиями на чтение. Включить её можно переключателем «Озвучка».</p>
      </div>
    );
  }
  if (v.status !== 'none') return null;
  return (
    <div className="note-box lg-voice" id="lg-novoice">
      <Icon name="volume-2" size={20} />
      <p><b>На этом устройстве нет голоса для языка {lang === 'zh-CN' ? 'путунхуа' : lang}.</b> Задания на слух заменены заданиями на чтение. Голос можно добавить в настройках системы, в разделе синтеза речи, или открыть урок в другом браузере.</p>
    </div>
  );
}

/* ---------- список языков ---------- */
export function LangHub() {
  useTitle('Языки для путешествий');
  const s = useStore();
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">Языки для путешествий</h1>
          <p className="lead">Короткие уроки под ситуации поездки: аэропорт, такси, отель, кафе, покупки и помощь. Плюс местные правила, которые стоит знать до вылета. Учётная запись не нужна.</p>
        </header>
        <div className="lg-tracks">
          {TRACKS.map(t => {
            const done = Object.keys(langOf(s, t.code).done).length, total = t.units.reduce((n, u) => n + u[2], 0);
            const body = (
              <>
                <span className="lg-native" lang={t.code}>{t.native}</span>
                <h2 className="h3">{t.title}</h2>
                <p>{t.hook}</p>
                {t.ready
                  ? <p className="lg-track-meta"><span>{nLessons(total)}</span>{done > 0 && <span className="badge"><Icon name="check" size={13} />пройдено {done}</span>}</p>
                  : <p className="lg-track-meta"><span className="badge badge-play">Готовится</span></p>}
              </>
            );
            return t.ready
              ? <Link className="lg-track" to={`/lang/${t.code}`} key={t.code} data-track={t.code}>{body}</Link>
              : <div className="lg-track lg-soon" key={t.code} data-track={t.code}>{body}</div>;
          })}
        </div>
        <div className="group" style={{ maxWidth: 760 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Как устроен курс</h2>
          <div className="stack" style={{ gap: 12 }}>
            <p><b>Мини-курс — одна ситуация.</b> В нём 3–5 уроков по несколько минут и в конце сценарий: разговор, где вы выбираете свои реплики.</p>
            <p><b>Задания</b> — как в языковых приложениях: значение фразы, на слух, сборка из слов, пары, ответ собеседнику. Ошибка не наказывается: задание просто вернётся в конце урока.</p>
            <p><b>Повторение.</b> Каждая выученная фраза возвращается через день, три дня, неделю и дальше реже. Если ошиблись, она вернётся завтра.</p>
            <p><b>Разговорник.</b> Все выученные фразы собираются на одной странице, её можно распечатать и взять с собой.</p>
            <p><b>Звук.</b> Фразы читает голос вашего браузера или системы. Если голоса для языка нет, задания на слух заменяются заданиями на чтение.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- трек ---------- */
export function LangTrack() {
  const { code } = useParams();
  return <Gate code={code}>{ix => <TrackBody ix={ix} />}</Gate>;
}
function Card({ c }) {
  return (
    <div className="lg-card">
      <b>{c.t}</b>
      <p>{c.x}</p>
      {c.src && (
        <p className="lg-card-src">
          Источник: <a href={c.src.url} target="_blank" rel="noopener noreferrer">{c.src.name}</a>
          {(c.more || []).map(m => <span key={m.url}>, <a href={m.url} target="_blank" rel="noopener noreferrer">{m.name}</a></span>)}
          . Проверено {date(c.checked)}.
        </p>
      )}
    </div>
  );
}
function TrackBody({ ix }) {
  const t = ix.track;
  useTitle(`${t.title} для путешествий`);
  const s = useStore();
  const L = langOf(s, t.code);
  const voice = useSound(t.lang);
  const done = ix.lessons.filter(l => L.done[l.id]).length;
  const next = ix.lessons.find(l => !L.done[l.id]);
  const due = duePhrases(ix, L.ph).length, learned = Object.keys(L.ph).filter(id => ix.phrases[id]).length;
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <Crumbs items={[['Языки', '/lang'], [t.title]]} />
          <h1 className="h1">{t.title} для путешествий</h1>
          <p className="lead">{t.hook}</p>
          {t.draft && <p className="lg-draft"><Icon name="info" size={16} />Пробная версия: тексты ещё не проверил носитель языка. Если заметите ошибку, напишите нам.</p>}
        </header>
        <div className="lg-top">
          <div className="panel lg-progress" id="lg-progress">
            <div className="lg-progress-row">
              <div><b className="num">{done}</b><span>из {nLessons(ix.lessons.length)}</span></div>
              <div><b className="num">{learned}</b><span>{plural(learned, ['фраза выучена', 'фразы выучено', 'фраз выучено'])}</span></div>
            </div>
            <span className="bar bar-lg"><i style={{ width: `${Math.max(2, Math.round(done / ix.lessons.length * 100))}%` }} /></span>
            <div className="row">
              {next && <Link className="btn btn-primary" id="lg-continue" to={`/lang/${t.code}/l/${next.id}`}>{done ? 'Продолжить' : 'Начать'}: {next.title}<Icon name="arrow-right" size={17} /></Link>}
              {learned > 0 && <Link className="btn btn-secondary" id="lg-review" to={`/lang/${t.code}/review`}><Icon name="repeat" size={17} />{due ? `Повторить: ${nPhrases(due)}` : 'Повторить фразы'}</Link>}
              <Link className="btn btn-ghost" id="lg-phrases" to={`/lang/${t.code}/phrases`}><Icon name="book-open" size={17} />Разговорник</Link>
            </div>
          </div>
          <div className="stack lg-side">
            <SoundSwitch v={voice} />
            <VoiceNote v={voice} lang={t.lang} />
          </div>
        </div>

        {BLOCKS.map(([b, title, hint]) => {
          const units = t.units.filter(u => u.block === b);
          if (!units.length) return null;
          return (
            <div className="group" key={b} data-block={b}>
              <h2 className="h3" style={{ marginBottom: 6 }}>{title}</h2>
              <p className="muted" style={{ marginBottom: 18 }}>{hint}</p>
              <div className="lg-units">{units.map(u => <Unit key={u.id} code={t.code} u={u} L={L} next={next} />)}</div>
            </div>
          );
        })}

        <div className="group" id="lg-before">
          <h2 className="h3" style={{ marginBottom: 6 }}>Перед поездкой</h2>
          <p className="muted" style={{ marginBottom: 18, maxWidth: '64ch' }}>Правила, которые меняются. У каждой карточки указан источник и дата проверки: перед поездкой сверьтесь с официальными сайтами.</p>
          <div className="lg-cards">{t.before.map(c => <Card c={c} key={c.t} />)}</div>
        </div>
      </div>
    </section>
  );
}
function Unit({ code, u, L, next }) {
  const n = u.lessons.filter(l => L.done[l.id]).length;
  return (
    <article className={`lg-unit ${n === u.lessons.length ? 'full' : ''}`} data-unit={u.id}>
      <header>
        <span className="tile-ic"><Icon name={u.icon} size={22} /></span>
        <div>
          <h3 className="h4">{u.title}</h3>
          <p>{u.hook}</p>
        </div>
      </header>
      <div className="lg-unit-bar"><span className="bar"><i style={{ width: `${Math.round(n / u.lessons.length * 100)}%` }} /></span><span className="num">{n} из {u.lessons.length}</span></div>
      <ol className="lg-lessons">
        {u.lessons.map((l, k) => {
          const done = Boolean(L.done[l.id]);
          return (
            <li key={l.id}>
              <Link to={`/lang/${code}/l/${l.id}`} data-lesson={l.id} data-done={done ? '1' : undefined} className={next && next.id === l.id ? 'next' : ''}>
                <span className="lg-n">{done ? <Icon name="check" size={14} /> : l.kind === 'scene' ? <Icon name="message-circle" size={14} /> : k + 1}</span>
                <span className="lg-l-t">{l.title}</span>
                {next && next.id === l.id && <span className="lg-next">Дальше</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </article>
  );
}

/* ---------- урок и повторение ---------- */
export function LangLesson() {
  const { code, lessonId } = useParams();
  return <Gate code={code} player>{ix => (ix.lessonBy[lessonId] ? <Player ix={ix} lessonId={lessonId} key={lessonId} /> : <NotFound />)}</Gate>;
}
export function LangReview() {
  const { code } = useParams();
  return <Gate code={code} player>{ix => <Player ix={ix} review key="review" />}</Gate>;
}

const PROMPT = {
  meaning: 'Что это значит?', reverse: 'Как сказать по-китайски?', listen: 'Что прозвучало?',
  tone: 'Каким тоном произнесён слог?', toneRead: 'Какой это тон?', toneWord: 'Где тоны записаны верно?', toneWordRead: 'Где тоны записаны верно?', sound: 'Какой слог прозвучал?',
};

function Player({ ix, lessonId, review = false }) {
  const t = ix.track;
  const lesson = review ? null : ix.lessonBy[lessonId];
  const unit = lesson && ix.unitOf[lessonId];
  useTitle(review ? `Повторение — ${t.title}` : lesson.title);
  const s = useStore();
  const voice = useSound(t.lang);
  const audio = voice.status === 'ready';
  const [phase, setPhase] = useState('intro');       // intro | play | end
  const [queue, setQueue] = useState([]);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);         // ответ на текущее задание: { ok, ... }
  const [marks, setMarks] = useState([]);              // по одному на пройденное задание: true, false или 'seen'
  const [res, setRes] = useState(null);
  const first = useRef({}), wrong = useRef(new Set()), ids = useRef([]);
  const nextBtn = useRef(null), headRef = useRef(null);
  const L = langOf(s, t.code);
  const reviewEmpty = review && !Object.keys(L.ph).some(id => ix.phrases[id]);

  useEffect(() => () => stopSpeech(), []);
  useEffect(() => { window.scrollTo(0, 0); headRef.current?.focus({ preventScroll: true }); }, [phase, i]);
  useEffect(() => { if (answer) nextBtn.current?.focus({ preventScroll: true }); }, [answer]);

  const start = () => {
    let tasks;
    if (review) { const r = buildReview(ix, getState().lang?.[t.code]?.ph || {}, { audio }); tasks = r.tasks; ids.current = r.ids; }
    else tasks = buildLesson(ix, lessonId, { audio });
    first.current = {}; wrong.current = new Set();
    setQueue(tasks.map((x, k) => ({ ...x, key: k }))); setI(0); setAnswer(null); setMarks([]); setRes(null); setPhase('play');
  };
  const task = phase === 'play' ? queue[i] : null;
  const total = queue.length;

  const finish = () => {
    const graded = queue.filter(x => isGraded(x) && !x.retry);
    const right = graded.filter(x => first.current[x.key] === true).length;
    let out;
    if (review) out = finishReview(t.code, Object.fromEntries(ids.current.map(id => [id, !wrong.current.has(id)])));
    else out = finishLesson(t.code, lessonId, { right, total: graded.length }, lessonPhrases(ix, lessonId));
    setRes({ ...out, right, total: graded.length });
    setPhase('end');
    if (graded.length && right === graded.length) celebrate();
  };
  const next = () => {
    stopSpeech();
    setMarks(m => { const c = [...m]; c[i] = answer ? answer.ok : 'seen'; return c; });
    if (i + 1 >= queue.length) finish();
    else { setI(i + 1); setAnswer(null); }
  };
  // ответ на задание с проверкой: ошибка возвращает задание в конец урока (один раз)
  const onAnswer = (ok, info = {}) => {
    if (answer) return;
    const x = queue[i];
    if (!x.retry && first.current[x.key] === undefined) first.current[x.key] = ok;
    if (!ok) {
      (info.wrongIds || (x.p ? [x.p.id] : [])).forEach(id => wrong.current.add(id));
      if (!x.retry && x.type !== 'pairs') setQueue(q => [...q, { ...x, retry: true }]);
    }
    setAnswer({ ok, ...info });
  };

  // клавиатура: цифры выбирают вариант, Enter — дальше
  useEffect(() => {
    const onKey = e => {
      if (phase !== 'play' || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (/^[1-9]$/.test(e.key) && !answer) {
        const b = document.querySelectorAll('.lg-body .lg-opts > button')[+e.key - 1];
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      } else if (e.key === 'Enter' && answer && tag !== 'button' && tag !== 'a') { e.preventDefault(); next(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const back = `/lang/${t.code}`;
  const idx = review ? -1 : ix.lessons.findIndex(l => l.id === lessonId);
  const after = idx >= 0 ? ix.lessons[idx + 1] : null;
  const due = duePhrases(ix, L.ph).length;
  const title = review ? 'Повторение' : lesson.title;

  return (
    <div className="player lg-player" data-phase={phase}>
      <header className="pl-top">
        <div className="wrap">
          <div className="pl-top-row">
            <Link className="icon-btn" to={back} aria-label="Выйти из урока"><Icon name="x" /></Link>
            <div className="pl-title"><Mark size={20} /><span>{title}</span></div>
            <div className="pl-left">{phase === 'play' ? `${Math.min(i + 1, total)} / ${total}` : ''}</div>
          </div>
          {phase === 'play' && (
            <div className="play-steps lg-steps" aria-hidden="true">
              {queue.map((_, k) => <i key={k} className={marks[k] === true ? 'ok' : marks[k] === false ? 'bad' : marks[k] === 'seen' ? 'seen' : k === i ? 'now' : ''} />)}
            </div>
          )}
        </div>
      </header>

      <div className="pl-main">
        <div className="wrap">
          {phase === 'intro' && (
            <div className="pl-col lg-intro">
              <p className="label pl-kicker">{review ? t.title : `${unit.title} · ${lesson.kind === 'scene' ? 'сценарий' : `урок ${unit.lessons.indexOf(lesson) + 1} из ${unit.lessons.length}`}`}</p>
              <h1 className="h2" id="pl-h" tabIndex={-1} ref={headRef}>{title}</h1>
              <p className="pl-intro">{review
                ? (reviewEmpty ? 'Повторять пока нечего: фразы появятся здесь после первого урока.' : due ? `Пора повторить ${nPhrases(due)}. Раунд займёт пару минут.` : 'Сегодня повторять нечего, но можно освежить фразы, которые давно не встречались.')
                : `Цель: ${lesson.goal[0].toLowerCase()}${lesson.goal.slice(1)}.`}</p>
              {!review && lesson.ph && <p className="muted">{nPhrases(lessonPhrases(ix, lessonId).length)} в этом уроке. Выученные попадут в разговорник.</p>}
              <VoiceNote v={voice} lang={t.lang} />
              <SoundSwitch v={voice} />
              <div className="row">
                {reviewEmpty
                  ? <Link className="btn btn-primary btn-lg" to={back}>К курсу</Link>
                  : <button type="button" className="btn btn-primary btn-lg" id="lg-start" disabled={voice.status === 'checking'} onClick={start}><Icon name="play" size={18} />{voice.status === 'checking' ? 'Проверяем звук…' : review ? 'Начать повторение' : 'Начать урок'}</button>}
                <Link className="btn btn-ghost btn-lg" to={back}>К курсу</Link>
              </div>
            </div>
          )}

          {phase === 'play' && task && (
            <div className="pl-col lg-body" key={`${i}-${task.key}`} data-type={task.type} data-i={i}>
              {task.retry && <p className="label lg-retry">Ещё раз</p>}
              <h1 className="sr" tabIndex={-1} ref={headRef}>{title}: задание {i + 1} из {total}</h1>
              <Task task={task} lang={t.lang} voice={voice.voice} answer={answer} onAnswer={onAnswer} onNext={next} />
              {answer && (
                <div className={`lg-fb ${answer.ok ? 'ok' : 'bad'}`} id="lg-fb" aria-live="polite">
                  <p><b>{answer.ok ? (answer.self === false ? 'Потренируйтесь ещё.' : 'Верно.') : 'Не совсем.'}</b> <Explain task={task} /></p>
                  <button type="button" className="btn btn-primary" id="lg-next" ref={nextBtn} onClick={next}>{i + 1 >= queue.length ? 'К итогу' : 'Дальше'}<Icon name="arrow-right" size={17} /></button>
                </div>
              )}
            </div>
          )}

          {phase === 'end' && res && (
            <div className="pl-col lg-end">
              <p className="label pl-kicker">{review ? 'Повторение завершено' : lesson.kind === 'scene' ? 'Сценарий пройден' : 'Урок пройден'}</p>
              <h1 className="h2" id="pl-h" tabIndex={-1} ref={headRef}>{!res.total || res.right === res.total ? 'Без единой ошибки' : res.right / res.total >= 0.75 ? 'Хороший результат' : 'Есть над чем поработать'}</h1>
              <div className="done-stats">
                <div className="stat"><b>{res.right}</b><span>верно с первого раза из {res.total}</span></div>
                <div className="stat stat-xp"><b>+<CountUp value={res.gain} ms={700} /></b><span>{res.gain ? 'к опыту' : review ? 'опыт за повторение — раз в день' : 'опыт — за первое прохождение'}</span></div>
                {!review && lessonPhrases(ix, lessonId).length > 0 && <div className="stat"><b>{lessonPhrases(ix, lessonId).length}</b><span>{plural(lessonPhrases(ix, lessonId).length, ['фраза', 'фразы', 'фраз'])} в разговорнике</span></div>}
              </div>
              {!review && lessonPhrases(ix, lessonId).length > 0 && (
                <ul className="lg-list" id="lg-learned">
                  {lessonPhrases(ix, lessonId).map(id => <PhraseRow key={id} p={ix.phrases[id]} lang={t.lang} voice={voice.voice} />)}
                </ul>
              )}
              <div className="row">
                {after && !review && <Link className="btn btn-primary btn-lg" id="lg-after" to={`/lang/${t.code}/l/${after.id}`}>Дальше: {after.title}<Icon name="arrow-right" size={18} /></Link>}
                {review && <button type="button" className="btn btn-primary btn-lg" id="lg-again" onClick={start}><Icon name="rotate-ccw" size={18} />Ещё раунд</button>}
                <Link className="btn btn-secondary btn-lg" to={back}>К курсу</Link>
              </div>
              <div style={{ width: '100%' }}><XpBar xp={xpOf(s)} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Пояснение после ответа: верный вариант и перевод */
function Explain({ task: x }) {
  if (x.p) return <span className="lg-ex"><span className="zh" lang="zh-CN">{x.p.zh}</span> <span className="py">{x.p.py}</span> — {x.p.ru}{x.p.note ? `. ${x.p.note}` : ''}</span>;
  if (x.syl) return <span className="lg-ex"><span className="zh" lang="zh-CN">{x.syl.zh}</span> <span className="py">{x.syl.py}</span>{x.syl.ru ? ` — ${x.syl.ru}` : ''}{x.type === 'toneRead' ? `: ${TONE_NAMES[x.correct]} тон` : ''}</span>;
  return null;
}

/* ---------- задания ---------- */
function Task(props) {
  const { task } = props;
  switch (task.type) {
    case 'intro': return <Intro {...props} />;
    case 'rule': return <Note kicker="Правило" title={task.rule.t} text={task.rule.x} onNext={props.onNext} id="lg-rule" />;
    case 'card': return <CountryCard card={task.card} onNext={props.onNext} />;
    case 'say': return <Say {...props} />;
    case 'tiles': return <Tiles {...props} />;
    case 'pairs': return <Pairs {...props} />;
    default: return <Choice {...props} />;
  }
}
function Big({ p, lang, voice, auto }) {
  useEffect(() => { if (auto && voice) speak(p.zh, lang, { voice }); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`lg-big ${p.kind === 'sign' ? 'sign' : ''}`}>
      <div className="lg-big-row">
        <span className="zh" lang="zh-CN" id="lg-zh">{p.zh}</span>
        <SpeakBtn text={p.zh} lang={lang} voice={voice} id="lg-play" />
        <SpeakBtn text={p.zh} lang={lang} voice={voice} slow />
      </div>
      <span className="py" id="lg-py">{p.py}</span>
    </div>
  );
}
function Intro({ task: { p }, lang, voice, onNext }) {
  return (
    <>
      <p className="label pl-kicker">{p.kind === 'sign' ? 'Новая вывеска' : 'Новая фраза'}</p>
      <Big p={p} lang={lang} voice={voice} auto />
      <p className="lg-ru" id="lg-ru">{p.ru}</p>
      {p.note && <p className="lg-note"><Icon name="lightbulb" size={16} />{p.note}</p>}
      <div className="row"><button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Дальше<Icon name="arrow-right" size={17} /></button></div>
    </>
  );
}
function Note({ kicker, title, text, onNext, id }) {
  return (
    <div className="lg-rule" id={id}>
      <p className="label pl-kicker">{kicker}</p>
      <h2 className="h3">{title}</h2>
      <p>{text}</p>
      <div className="row"><button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Понятно<Icon name="arrow-right" size={17} /></button></div>
    </div>
  );
}
function CountryCard({ card, onNext }) {
  return (
    <div className="lg-rule lg-country" id="lg-country">
      <p className="label pl-kicker">{card.src ? 'Страна' : 'Полезно знать'}</p>
      <Card c={card} />
      <div className="row"><button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Дальше<Icon name="arrow-right" size={17} /></button></div>
    </div>
  );
}

/* Задания с выбором варианта */
function Choice({ task: x, lang, voice, answer, onAnswer }) {
  const picked = answer ? answer.picked : null;
  const pick = (k, el) => {
    if (answer) return;
    const ok = k === x.correct;
    if (ok) sparkFrom(el);
    if (ok && voice && (x.type === 'reverse' || x.type === 'reply')) speak(x.p.zh, lang, { voice });
    onAnswer(ok, { picked: k });
  };
  const last = x.type === 'reply' ? x.history.filter(h => h.who === 'them').at(-1) : null;
  useEffect(() => {
    if (!voice) return;
    if (x.type === 'listen') speak(x.p.zh, lang, { voice });
    if (['tone', 'toneWord', 'sound'].includes(x.type)) speak(x.syl.zh, lang, { voice });
    if (last) speak(last.zh, lang, { voice });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const cls = k => (!answer ? '' : k === x.correct ? 'ok' : k === picked ? 'bad' : 'dim');
  const optText = o => (typeof o === 'string'
    ? <span className={x.type === 'toneRead' ? '' : 'py py-opt'}>{o}</span>
    : x.type === 'meaning' ? <span>{o.ru}</span> : <span className="lg-opt-zh"><span className="zh" lang="zh-CN">{o.zh}</span><span className="py">{o.py}</span></span>);
  return (
    <>
      {x.type === 'reply' && <Chat history={x.history} lang={lang} voice={voice} />}
      <p className="tr-ask lg-ask">{x.type === 'reply' ? x.ask : PROMPT[x.type]}</p>
      {x.type === 'meaning' && <Big p={x.p} lang={lang} voice={voice} />}
      {x.type === 'reverse' && <p className="lg-ru big" id="lg-ru">{x.p.ru}</p>}
      {x.type === 'listen' && <div className="lg-listen"><SpeakBtn text={x.p.zh} lang={lang} voice={voice} big id="lg-play" label="Послушать ещё раз" /><SpeakBtn text={x.p.zh} lang={lang} voice={voice} slow /></div>}
      {['tone', 'toneWord'].includes(x.type) && <div className="lg-big"><div className="lg-big-row"><span className="zh" lang="zh-CN">{x.syl.zh}</span><SpeakBtn text={x.syl.zh} lang={lang} voice={voice} id="lg-play" /><SpeakBtn text={x.syl.zh} lang={lang} voice={voice} slow /></div>{x.syl.ru && <span className="lg-ru">{x.syl.ru}</span>}</div>}
      {['toneRead', 'toneWordRead'].includes(x.type) && <div className="lg-big"><span className="zh" lang="zh-CN">{x.syl.zh}</span>{x.type === 'toneRead' ? <span className="py">{x.syl.py}</span> : x.syl.ru && <span className="lg-ru">{x.syl.ru}</span>}</div>}
      {x.type === 'sound' && <div className="lg-listen"><SpeakBtn text={x.syl.zh} lang={lang} voice={voice} big id="lg-play" label="Послушать ещё раз" /><SpeakBtn text={x.syl.zh} lang={lang} voice={voice} slow /></div>}
      <div className="lg-opts ch-list" role="group" aria-label="Варианты ответа">
        {x.options.map((o, k) => (
          <button key={typeof o === 'string' ? o : o.id} type="button" className={`ch-opt ${cls(k)}`} disabled={Boolean(answer)} aria-pressed={picked === k} data-ok={k === x.correct ? '1' : undefined} onClick={e => pick(k, e.currentTarget)}>
            <span className="ch-key" aria-hidden="true">{answer && k === x.correct ? <Icon name="check" size={16} /> : answer && k === picked ? <Icon name="x" size={16} /> : LETTERS[k]}</span>
            {optText(o)}
            {answer && k === x.correct && <span className="sr"> (верный ответ)</span>}
          </button>
        ))}
      </div>
    </>
  );
}
function Chat({ history, lang, voice }) {
  const lines = history.slice(-4);
  return (
    <ul className="lg-chat" aria-label="Разговор">
      {lines.map((h, k) => (
        <li key={k} className={h.who}>
          <span className="zh" lang="zh-CN">{h.zh}</span>
          <span className="py">{h.py}</span>
          <span className="lg-chat-ru">{h.ru}</span>
          {h.who === 'them' && <SpeakBtn text={h.zh} lang={lang} voice={voice} />}
        </li>
      ))}
    </ul>
  );
}

/* Сборка фразы из слов */
function Tiles({ task: x, lang, voice, answer, onAnswer }) {
  const [order, setOrder] = useState([]);
  const by = useMemo(() => Object.fromEntries(x.bank.map(b => [b.k, b])), [x]);
  const put = k => { if (answer) return; setOrder(o => (o.includes(k) ? o.filter(y => y !== k) : [...o, k])); const b = by[k]; if (voice && !order.includes(k)) speak(b.zh, lang, { voice }); };
  const check = () => {
    const ok = order.map(k => by[k].zh).join('|') === x.answer.join('|');
    if (ok && voice) speak(x.p.zh, lang, { voice });
    onAnswer(ok);
  };
  return (
    <>
      <p className="tr-ask lg-ask">Соберите фразу по-китайски</p>
      <p className="lg-ru big" id="lg-ru">{x.p.ru}</p>
      <div className={`lg-line ${answer ? (answer.ok ? 'ok' : 'bad') : ''}`} id="lg-line" aria-label="Ваш ответ">
        {order.length ? order.map(k => (
          <button key={k} type="button" className="lg-tile on" disabled={Boolean(answer)} onClick={() => put(k)}><span className="zh" lang="zh-CN">{by[k].zh}</span><span className="py">{by[k].py}</span></button>
        )) : <span className="lg-line-hint">Нажимайте на слова по порядку</span>}
      </div>
      <div className="lg-bank" id="lg-bank">
        {x.bank.map(b => (
          <button key={b.k} type="button" className="lg-tile" data-k={b.k} disabled={Boolean(answer) || order.includes(b.k)} onClick={() => put(b.k)}>
            <span className="zh" lang="zh-CN">{b.zh}</span><span className="py">{b.py}</span>
          </button>
        ))}
      </div>
      {!answer && <div className="row"><button type="button" className="btn btn-primary" id="lg-check" disabled={!order.length} onClick={check}>Проверить</button></div>}
    </>
  );
}

/* Пары: иероглифы слева, перевод справа */
function Pairs({ task: x, lang, voice, answer, onAnswer }) {
  const right = useMemo(() => shuffle(x.items), [x]);
  const [sel, setSel] = useState(null);           // { side, id }
  const [done, setDone] = useState([]);
  const [miss, setMiss] = useState(null);         // неверная пара для подсветки
  const mistakes = useRef([]);
  const tap = (side, id) => {
    if (answer || done.includes(id)) return;
    if (side === 'l' && voice) speak(x.items.find(p => p.id === id).zh, lang, { voice });
    if (!sel || sel.side === side) { setSel({ side, id }); return; }
    if (sel.id === id) {
      const all = [...done, id];
      setDone(all); setSel(null);
      if (all.length === x.items.length) onAnswer(mistakes.current.length === 0, { wrongIds: [...new Set(mistakes.current)] });
    } else {
      mistakes.current.push(side === 'l' ? id : sel.id);
      setMiss({ a: sel, b: { side, id } }); setSel(null);
      setTimeout(() => setMiss(null), 600);
    }
  };
  const state = (side, id) => (done.includes(id) ? 'ok' : miss && ((miss.a.side === side && miss.a.id === id) || (miss.b.side === side && miss.b.id === id)) ? 'bad' : sel && sel.side === side && sel.id === id ? 'sel' : '');
  return (
    <>
      <p className="tr-ask lg-ask">Найдите пары</p>
      <div className="lg-pairs" id="lg-pairs">
        <div className="lg-col">
          {x.items.map(p => <button key={p.id} type="button" className={`lg-pair ${state('l', p.id)}`} data-side="l" data-id={p.id} disabled={done.includes(p.id)} onClick={() => tap('l', p.id)}><span className="zh" lang="zh-CN">{p.zh}</span><span className="py">{p.py}</span></button>)}
        </div>
        <div className="lg-col">
          {right.map(p => <button key={p.id} type="button" className={`lg-pair ${state('r', p.id)}`} data-side="r" data-id={p.id} disabled={done.includes(p.id)} onClick={() => tap('r', p.id)}><span>{p.ru}</span></button>)}
        </div>
      </div>
    </>
  );
}

/* Скажите сами, потом сверьтесь */
function Say({ task: { p }, lang, voice, answer, onAnswer }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <p className="tr-ask lg-ask">Скажите вслух по-китайски</p>
      <p className="lg-ru big" id="lg-ru">{p.ru}</p>
      {!shown && <p className="muted">Произнесите фразу, а потом откройте ответ и сравните.</p>}
      {shown && <Big p={p} lang={lang} voice={voice} auto />}
      {!shown && <div className="row"><button type="button" className="btn btn-primary" id="lg-show" onClick={() => setShown(true)}><Icon name="eye" size={17} />Показать ответ</button></div>}
      {shown && !answer && (
        <div className="row">
          <button type="button" className="btn btn-primary" id="lg-self-yes" onClick={() => onAnswer(true, { self: true })}>Получилось</button>
          <button type="button" className="btn btn-secondary" id="lg-self-no" onClick={() => onAnswer(true, { self: false })}>Ещё потренируюсь</button>
        </div>
      )}
    </>
  );
}

/* ---------- разговорник ---------- */
function PhraseRow({ p, lang, voice, locked = false }) {
  return (
    <li className={`lg-phrase ${locked ? 'locked' : ''}`} data-phrase={p.id}>
      <div className="lg-phrase-main">
        <span className="zh" lang="zh-CN">{p.zh}</span>
        <span className="py">{p.py}</span>
      </div>
      <span className="lg-phrase-ru">{p.ru}</span>
      <SpeakBtn text={p.zh} lang={lang} voice={voice} />
    </li>
  );
}
export function LangPhrases() {
  const { code } = useParams();
  return <Gate code={code}>{ix => <Phrasebook ix={ix} />}</Gate>;
}
function Phrasebook({ ix }) {
  const t = ix.track;
  useTitle(`Разговорник — ${t.title}`);
  const s = useStore();
  const L = langOf(s, t.code);
  const voice = useSound(t.lang);
  const [all, setAll] = useState(false);
  const groups = t.units.map(u => ({
    u, items: u.lessons.flatMap(l => lessonPhrases(ix, l.id)).filter(id => all || L.ph[id]).map(id => ix.phrases[id]),
  })).filter(g => g.items.length);
  const learned = Object.keys(L.ph).filter(id => ix.phrases[id]).length;
  return (
    <section className="page lg-book">
      <div className="wrap">
        <header className="page-head">
          <Crumbs items={[['Языки', '/lang'], [t.title, `/lang/${t.code}`], ['Разговорник']]} />
          <h1 className="h1">Разговорник: {t.title.toLowerCase()}</h1>
          <p className="lead">{learned ? `${nPhrases(learned)} из пройденных уроков, по ситуациям.` : 'Здесь собираются фразы из пройденных уроков.'} Страницу можно распечатать или сохранить в PDF и взять с собой.</p>
          <div className="row lg-book-tools">
            <div className="seg-ctl" role="radiogroup" aria-label="Какие фразы показывать">
              <button type="button" role="radio" aria-checked={!all} onClick={() => setAll(false)}>Выученные</button>
              <button type="button" role="radio" aria-checked={all} id="lg-all" onClick={() => setAll(true)}>Все фразы курса</button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" id="lg-print" onClick={() => window.print()}><Icon name="printer" size={16} />Распечатать</button>
          </div>
        </header>
        {groups.length ? groups.map(g => (
          <div className="group lg-book-group" key={g.u.id} data-unit={g.u.id}>
            <h2 className="h3">{g.u.title}</h2>
            <ul className="lg-list">{g.items.map(p => <PhraseRow key={p.id} p={p} lang={t.lang} voice={voice.voice} locked={!L.ph[p.id]} />)}</ul>
          </div>
        )) : (
          <EmptyState title="Пока пусто" text="Пройдите первый урок с фразами — например, «Здравствуйте и спасибо», — и они появятся здесь.">
            <div className="row" style={{ justifyContent: 'center' }}>
              <Link className="btn btn-primary" to={`/lang/${t.code}/l/zh-u2-l1`}>Открыть урок</Link>
              <button type="button" className="btn btn-secondary" onClick={() => setAll(true)}>Показать все фразы курса</button>
            </div>
          </EmptyState>
        )}
        <p className="lg-print-note">NowNow · {t.title} для путешествий · {new Date().toLocaleDateString('ru-RU')}</p>
      </div>
    </section>
  );
}
