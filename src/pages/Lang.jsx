import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LEVELS, LEVEL_BY, TRACKS, TRACK_BY, levelsOf, loadTrack } from '../data/lang/meta.js';
import { LETTER_GROUPS } from '../data/lang/letters.js';
import { PLACEMENT, TONE_EXAMPLES, TONE_NAMES, buildLesson, buildPlacement, buildReview, charTable, duePhrases, indexTrack, isGraded, lessonPhrases, levelLessonsOf, nextLessonOf, shuffle } from '../lib/lang-engine.js';
import { finishLesson, finishReview, langOf, practiceWrite, setLevel } from '../lib/lang-progress.js';
import { speak, stopSpeech, useVoice } from '../lib/speech.js';
import { audioUrl, preload, registerAudio } from '../lib/audio.js';
import { getState, plural, update, useStore } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { mark as markPy } from '../lib/pinyin.js';
import { xpOf } from '../lib/game.js';
import { celebrate, sparkFrom } from '../lib/fx.js';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { Crumbs, EmptyState } from '../components/Cards.jsx';
import { CountUp, XpBar } from '../components/GameUI.jsx';
import Writer from '../components/Writer.jsx';
import ToneChart, { ToneIcon } from '../components/ToneChart.jsx';
import { BreathDemo, MouthDemo, PinyinDemo, SyllableBuilder, TonesDemo, demoFor } from '../components/LangDemos.jsx';
import { VOWEL_EX } from '../lib/demo-data.js';
import NotFound from './NotFound.jsx';
import '../lang.css';

/* ===== Языки для путешествий =====
   /lang — список языков; /lang/<код> — трек; /lang/<код>/l/<урок> — урок; /lang/<код>/review — повторение;
   /lang/<код>/phrases — разговорник; /lang/<код>/test — проверка уровня; /lang/<код>/write — прописи
   (/lang/latin/write — прописи латиницы). Тексты трека скачиваются при открытии (data/lang/meta.js).
   Уровни — LEVELS в meta.js: «С нуля», A1, A2, B1, B2. Уроки не запираются: можно открыть любой,
   а «Продолжить» ведёт к первому непройденному с уровня, который показала проверка. */

const LETTERS = 'АБВГД';
const date = iso => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const nLessons = n => `${n} ${plural(n, ['урок', 'урока', 'уроков'])}`;
const nPhrases = n => `${n} ${plural(n, ['фраза', 'фразы', 'фраз'])}`;
const nChars = n => `${n} ${plural(n, ['знак', 'знака', 'знаков'])}`;
/* Подпись уровня: «С нуля» или «A1 · Первые разговоры» */
const levelName = id => (LEVEL_BY[id] ? (LEVEL_BY[id].id === 'a0' ? LEVEL_BY[id].title : `${LEVEL_BY[id].code} · ${LEVEL_BY[id].title}`) : '');

/* ---------- загрузка трека ---------- */
const ready = {};
function useTrack(code) {
  const [st, setSt] = useState(() => (ready[code] ? { ix: ready[code] } : { loading: true }));
  useEffect(() => {
    if (!TRACK_BY[code] || !TRACK_BY[code].ready) { setSt({ missing: true }); return undefined; }
    if (ready[code]) { setSt({ ix: ready[code] }); return undefined; }
    let alive = true;
    setSt({ loading: true });
    loadTrack(code).then(t => {
      // свои звуковые файлы трека: speak() найдёт их раньше голоса браузера
      if (t.audio) registerAudio(t.lang, t.audio, `${import.meta.env.BASE_URL}audio/${t.code}/`);
      ready[code] = indexTrack(t); if (alive) setSt({ ix: ready[code] });
    }, () => { if (alive) setSt({ error: true }); });
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
function SpeakBtn({ text, py, lang, voice, big = false, slow = false, label, id }) {
  if (!voice) return null;
  return (
    <button type="button" className={`lg-say ${big ? 'big' : ''} ${slow ? 'slow' : ''}`} id={id} aria-label={label || (slow ? 'Медленно' : 'Послушать')}
      onClick={() => speak(text, lang, { slow, voice, py })}>
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
          <p className="lead">Короткие уроки по уровням. «С нуля» — вводный курс произношения и письма, как в учебниках, дальше — ситуации поездки: аэропорт, такси, отель, кафе, покупки и помощь. Плюс местные правила, которые стоит знать до вылета. Учётная запись не нужна.</p>
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
                  ? (
                    <>
                      <p className="lg-track-levels" aria-label="Уровни">{levelsOf(t.code).map(l => <span key={l.id} className="lg-lv-chip">{l.code}</span>)}</p>
                      <p className="lg-track-meta"><span>{nLessons(total)}</span>{done > 0 && <span className="badge"><Icon name="check" size={13} />пройдено {done}</span>}</p>
                    </>
                  )
                  : <p className="lg-track-meta"><span className="badge badge-play">Готовится</span></p>}
              </>
            );
            return t.ready
              ? <Link className="lg-track" to={`/lang/${t.code}`} key={t.code} data-track={t.code}>{body}</Link>
              : <div className="lg-track lg-soon" key={t.code} data-track={t.code}>{body}</div>;
          })}
        </div>
        <div className="group" id="lg-write-hub">
          <h2 className="h3" style={{ marginBottom: 6 }}>Прописи</h2>
          <p className="muted" style={{ marginBottom: 18, maxWidth: '64ch' }}>Обводите знак пальцем или мышью по контуру, черта за чертой: тренажёр покажет порядок черт и подскажет, если черта пошла не туда.</p>
          <div className="lg-write-links">
            <Link className="lg-write-link" to="/lang/zh/write" id="lg-write-zh"><span className="lg-write-glyph" lang="zh-CN" aria-hidden="true">写</span><span><b>Иероглифы</b><span>Все знаки китайского курса</span></span><Icon name="arrow-right" size={18} /></Link>
            <Link className="lg-write-link" to="/lang/latin/write" id="lg-write-latin"><span className="lg-write-glyph latin" aria-hidden="true">Aa</span><span><b>Латиница</b><span>Буквы для английского и испанского</span></span><Icon name="arrow-right" size={18} /></Link>
          </div>
        </div>
        <div className="group" style={{ maxWidth: 760 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Как устроен курс</h2>
          <div className="stack" style={{ gap: 12 }}>
            <p><b>Уровни.</b> {LEVELS.map(l => l.code).join(', ')} — по общеевропейской шкале CEFR, в объёме, который нужен путешественнику. Начать можно с нуля, а если вы уже что-то знаете, короткая проверка покажет, с какого уровня продолжить. Уроки не запираются: любой можно открыть сразу.</p>
            <p><b>Мини-курс — одна ситуация.</b> В нём 3–5 уроков по несколько минут и в конце сценарий: разговор, где вы выбираете свои реплики.</p>
            <p><b>Задания</b> — как в языковых приложениях: значение фразы, на слух, сборка из слов, пары, ответ собеседнику. Ошибка не наказывается: задание просто вернётся в конце урока.</p>
            <p><b>Повторение.</b> Каждая выученная фраза возвращается через день, три дня, неделю и дальше реже. Если ошиблись, она вернётся завтра.</p>
            <p><b>Разговорник.</b> Все выученные фразы собираются на одной странице, её можно распечатать и взять с собой.</p>
            <p><b>Прописи.</b> Знаки обводят по контуру, а потом пишут по памяти. Ошибка в черте не влияет на результат урока: это тренировка руки и глаза.</p>
            <p><b>Звук.</b> Слоги и многие слова записаны носителями языка, остальные фразы озвучены синтезатором речи. Все файлы лежат на сайте, поэтому звук работает в любом браузере. Озвучку можно выключить — тогда задания на слух заменятся заданиями на чтение.</p>
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
  const next = nextLessonOf(ix, L);
  const due = duePhrases(ix, L.ph).length, learned = Object.keys(L.ph).filter(id => ix.phrases[id]).length;
  const now = next ? ix.unitOf[next.id].level : null;
  const levels = LEVELS.map(lv => {
    const units = t.units.filter(u => u.level === lv.id), lessons = units.flatMap(u => u.lessons);
    return { lv, units, total: lessons.length, done: lessons.filter(l => L.done[l.id]).length };
  });
  const jump = id => { const el = document.getElementById(`lg-level-${id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
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
            {now && <p className="label lg-now" id="lg-now">Сейчас: {levelName(now)}</p>}
            <div className="lg-progress-row">
              <div><b className="num">{done}</b><span>из {nLessons(ix.lessons.length)}</span></div>
              <div><b className="num">{learned}</b><span>{plural(learned, ['фраза выучена', 'фразы выучено', 'фраз выучено'])}</span></div>
            </div>
            <span className="bar bar-lg"><i style={{ width: `${Math.max(2, Math.round(done / ix.lessons.length * 100))}%` }} /></span>
            <div className="row">
              {next && <Link className="btn btn-primary" id="lg-continue" to={`/lang/${t.code}/l/${next.id}`}>{done ? 'Продолжить' : 'Начать'}: {next.title}<Icon name="arrow-right" size={17} /></Link>}
              {learned > 0 && <Link className="btn btn-secondary" id="lg-review" to={`/lang/${t.code}/review`}><Icon name="repeat" size={17} />{due ? `Повторить: ${nPhrases(due)}` : 'Повторить фразы'}</Link>}
              <Link className="btn btn-ghost" id="lg-phrases" to={`/lang/${t.code}/phrases`}><Icon name="book-open" size={17} />Разговорник</Link>
              <Link className="btn btn-ghost" id="lg-write" to={`/lang/${t.code}/write`}><Icon name="brush" size={17} />Прописи</Link>
            </div>
          </div>
          <div className="stack lg-side">
            <div className="panel lg-test" id="lg-test">
              {L.lv && LEVEL_BY[L.lv.id]
                ? <p><b>Проверка уровня: {levelName(L.lv.id)}.</b> С него начинается «Продолжить». Уроки других уровней открыты всегда.</p>
                : <p><b>Уже знаете основы?</b> Короткая проверка покажет, с какого уровня начать. Это 2–4 минуты.</p>}
              <div><Link className="btn btn-secondary btn-sm" id="lg-test-go" to={`/lang/${t.code}/test`}><Icon name="gauge" size={16} />{L.lv ? 'Пройти проверку ещё раз' : 'Проверить уровень'}</Link></div>
            </div>
            <SoundSwitch v={voice} />
            <VoiceNote v={voice} lang={t.lang} />
          </div>
        </div>

        <nav className="lg-levels" aria-label="Уровни курса" id="lg-levels">
          {levels.map(({ lv, units, total, done: d }) => (
            <button type="button" key={lv.id} className={`lg-level-chip ${now === lv.id ? 'now' : ''} ${!units.length ? 'is-soon' : ''} ${units.length && d === total ? 'full' : ''}`} data-level={lv.id} onClick={() => jump(lv.id)}>
              <b>{lv.code}</b><span>{units.length ? `${d} из ${total}` : 'готовится'}</span>
            </button>
          ))}
        </nav>

        {levels.filter(x => x.units.length).map(({ lv, units, total, done: d }) => (
          <section className="group lg-level" key={lv.id} id={`lg-level-${lv.id}`} data-level={lv.id} aria-labelledby={`lg-lh-${lv.id}`}>
            <header className="lg-level-head">
              <span className={`lg-level-code ${lv.id === 'a0' ? 'zero' : ''}`} aria-hidden="true">{lv.id === 'a0' ? '0' : lv.code}</span>
              <div>
                <h2 className="h3" id={`lg-lh-${lv.id}`}>{lv.id === 'a0' ? lv.title : `${lv.code}. ${lv.title}`}</h2>
                <p>{lv.can}</p>
              </div>
              <span className="lg-level-prog"><span className="bar"><i style={{ width: `${Math.round(d / total * 100)}%` }} /></span><span className="num">{d} из {total}</span></span>
            </header>
            <div className="lg-units">{units.map(u => <Unit key={u.id} code={t.code} u={u} L={L} next={next} />)}</div>
          </section>
        ))}

        {levels.some(x => !x.units.length) && (
          <div className="group" id="lg-soon">
            <h2 className="h3" style={{ marginBottom: 18 }}>Следующие уровни</h2>
            <div className="lg-soon-levels">
              {levels.filter(x => !x.units.length).map(({ lv }) => (
                <div className="lg-soon-level" key={lv.id} id={`lg-level-${lv.id}`} data-level={lv.id}>
                  <span className="lg-level-code" aria-hidden="true">{lv.code}</span>
                  <div><b>{lv.code}. {lv.title}</b><p>{lv.can}</p><span className="badge badge-play">Готовится</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="group" id="lg-before">
          <h2 className="h3" style={{ marginBottom: 6 }}>Перед поездкой</h2>
          <p className="muted" style={{ marginBottom: 18, maxWidth: '64ch' }}>Правила, которые меняются. У каждой карточки указан источник и дата проверки: перед поездкой сверьтесь с официальными сайтами.</p>
          <div className="lg-cards">{t.before.map(c => <Card c={c} key={c.t} />)}</div>
        </div>
        {t.audio && (
          <p className="wr-credits" id="lg-audio-credits">Звук: слоги — записи носителя из проекта <a href="https://github.com/hugolpz/audio-cmn" target="_blank" rel="noopener noreferrer">audio-cmn</a> (голос Chen Wang), слова — записи Yue Tan из того же проекта (Shtooka), обе коллекции — по лицензии CC BY-SA; фразы — синтез речи Kokoro (Apache 2.0). <a href="licenses/audio-zh.txt" target="_blank" rel="noopener">Подробнее о лицензиях</a>.</p>
        )}
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
                <span className="lg-n">{done ? <Icon name="check" size={14} /> : l.writeMix ? <Icon name="brush" size={14} /> : l.kind === 'scene' ? <Icon name="message-circle" size={14} /> : k + 1}</span>
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

/* Объяснения со схемами занимают больше места на экране */
const isWide = t => t.type === 'toneIntro' || t.type === 'soundIntro' || (t.type === 'rule' && Boolean(t.rule.demo));
const PROMPT = {
  meaning: 'Что это значит?', reverse: 'Как сказать по-китайски?', listen: 'Что прозвучало?',
  tone: 'Каким тоном произнесён слог?', toneRead: 'Какой это тон?', toneWord: 'Где тоны записаны верно?', toneWordRead: 'Где тоны записаны верно?', sound: 'Какой слог прозвучал?',
  radPick: 'Какой ключ у этого знака?',
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
  const first = useRef({}), wrong = useRef(new Set()), ids = useRef([]), written = useRef(0);
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
    first.current = {}; wrong.current = new Set(); written.current = 0;
    if (audio) preload(tasks.flatMap(x => [x.p, x.syl, x.ch, ...(x.options || []).map(o => (typeof o === 'string' ? { py: o } : o))].filter(Boolean).map(o => audioUrl(t.lang, { zh: o.zh, py: o.py }))));
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
    setRes({ ...out, right, total: graded.length, written: written.current });
    setPhase('end');
    if (graded.length && right === graded.length) celebrate();
  };
  const next = () => {
    stopSpeech();
    setMarks(m => { const c = [...m]; c[i] = answer && !answer.skipped ? answer.ok : 'seen'; return c; });
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
    if (x.type === 'write' && !info.skipped) { written.current += 1; practiceWrite(t.code, x.ch.zh, info.mistakes || 0, { xp: false }); }
    setAnswer({ ok, ...info });
  };

  // клавиатура: цифры выбирают вариант, Enter — дальше
  useEffect(() => {
    const onKey = e => {
      if (phase !== 'play' || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (/^[1-9]$/.test(e.key) && !answer) {
        const b = document.querySelectorAll('.lg-body .lg-opts .ch-opt')[+e.key - 1];
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
              <p className="label pl-kicker">{review ? t.title : `${LEVEL_BY[unit.level] ? `${LEVEL_BY[unit.level].code} · ` : ''}${unit.title} · ${lesson.kind === 'scene' ? (lesson.dialog ? 'сценарий' : 'проверка') : `урок ${unit.lessons.indexOf(lesson) + 1} из ${unit.lessons.length}`}`}</p>
              <h1 className="h2" id="pl-h" tabIndex={-1} ref={headRef}>{title}</h1>
              <p className="pl-intro">{review
                ? (reviewEmpty ? 'Повторять пока нечего: фразы появятся здесь после первого урока.' : due ? `Пора повторить ${nPhrases(due)}. Раунд займёт пару минут.` : 'Сегодня повторять нечего, но можно освежить фразы, которые давно не встречались.')
                : `Цель: ${lesson.goal[0].toLowerCase()}${lesson.goal.slice(1)}.`}</p>
              {!review && lesson.ph && <p className="muted">{nPhrases(lessonPhrases(ix, lessonId).length)} в этом уроке. Выученные попадут в разговорник.</p>}
              {!review && (lesson.write || lesson.writeMix) && <p className="muted">В уроке есть прописи: знаки обводят пальцем или мышью. Если писать неудобно, такое задание можно пропустить.</p>}
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
            <div className={`pl-col lg-body ${isWide(task) ? 'wide' : ''}`} key={`${i}-${task.key}`} data-type={task.type} data-i={i}>
              {task.retry && <p className="label lg-retry">Ещё раз</p>}
              <h1 className="sr" tabIndex={-1} ref={headRef}>{title}: задание {i + 1} из {total}</h1>
              <Task task={task} lang={t.lang} voice={voice.voice} answer={answer} onAnswer={onAnswer} onNext={next} />
              {answer && (
                <div className={`lg-fb ${answer.ok ? 'ok' : 'bad'}`} id="lg-fb" aria-live="polite">
                  <p><b>{task.type === 'write' ? (answer.skipped ? 'Пропущено.' : answer.mistakes ? `Готово, ошибок в чертах: ${answer.mistakes}.` : 'Готово, без ошибок.') : answer.ok ? (answer.self === false ? 'Потренируйтесь ещё.' : 'Верно.') : 'Не совсем.'}</b> <Explain task={task} /></p>
                  <button type="button" className="btn btn-primary" id="lg-next" ref={nextBtn} onClick={next}>{i + 1 >= queue.length ? 'К итогу' : 'Дальше'}<Icon name="arrow-right" size={17} /></button>
                </div>
              )}
            </div>
          )}

          {phase === 'end' && res && (
            <div className="pl-col lg-end">
              <p className="label pl-kicker">{review ? 'Повторение завершено' : lesson.kind === 'scene' ? (lesson.dialog ? 'Сценарий пройден' : 'Проверка пройдена') : 'Урок пройден'}</p>
              <h1 className="h2" id="pl-h" tabIndex={-1} ref={headRef}>{!res.total || res.right === res.total ? 'Без единой ошибки' : res.right / res.total >= 0.75 ? 'Хороший результат' : 'Есть над чем поработать'}</h1>
              <div className="done-stats">
                <div className="stat"><b>{res.right}</b><span>верно с первого раза из {res.total}</span></div>
                <div className="stat stat-xp"><b>+<CountUp value={res.gain} ms={700} /></b><span>{res.gain ? 'к опыту' : review ? 'опыт за повторение — раз в день' : 'опыт — за первое прохождение'}</span></div>
                {!review && lessonPhrases(ix, lessonId).length > 0 && <div className="stat"><b>{lessonPhrases(ix, lessonId).length}</b><span>{plural(lessonPhrases(ix, lessonId).length, ['фраза', 'фразы', 'фраз'])} в разговорнике</span></div>}
                {res.written > 0 && <div className="stat" id="lg-written"><b>{res.written}</b><span>{plural(res.written, ['знак написан', 'знака написано', 'знаков написано'])} в прописях</span></div>}
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
  if (x.type === 'spell') return <span className="lg-ex"><span className="py">{x.options[x.correct]}</span>{x.why ? ` — ${x.why}` : ''}</span>;
  if (x.type === 'radPick') return <span className="lg-ex"><span className="zh" lang="zh-CN">{x.ch.zh}</span> <span className="py">{x.ch.py}</span> — {x.ch.ru}; ключ <span className="zh" lang="zh-CN">{x.options[x.correct].zh}</span> «{x.options[x.correct].ru}»</span>;
  if (['build', 'compose', 'hear2'].includes(x.type) || (x.type === 'sound' && !x.syl.zh)) return <span className="lg-ex">Это <span className="py">{x.syl.py}</span>.</span>;
  if (x.ch) return <span className="lg-ex"><span className="zh" lang="zh-CN">{x.ch.zh}</span> <span className="py">{x.ch.py}</span> — {x.ch.ru}</span>;
  if (x.syl) return <span className="lg-ex"><span className="zh" lang="zh-CN">{x.syl.zh}</span> <span className="py">{x.syl.py}</span>{x.syl.ru ? ` — ${x.syl.ru}` : ''}{x.type === 'toneRead' ? `: ${TONE_NAMES[x.correct]} тон` : ''}{x.syl.spoken ? <>. Звучит <span className="py">{x.syl.spoken}</span>: из двух третьих тонов подряд первый произносят вторым, а пишут третьим</> : ''}</span>;
  return null;
}

/* ---------- задания ---------- */
function Task(props) {
  const { task } = props;
  switch (task.type) {
    case 'intro': return <Intro {...props} />;
    case 'rule': return <Note kicker={task.rule.k || 'Правило'} title={task.rule.t} text={task.rule.x} onNext={props.onNext} id="lg-rule" demo={ruleDemo(task.rule.demo, props)} />;
    case 'toneIntro': return <ToneIntro {...props} />;
    case 'card': return <CountryCard card={task.card} onNext={props.onNext} />;
    case 'say': return <Say {...props} />;
    case 'tiles': return <Tiles {...props} />;
    case 'pairs': return <Pairs {...props} />;
    case 'write': return <WriteTask {...props} />;
    case 'soundIntro': return <SoundIntro {...props} />;
    case 'repeat': return <Repeat {...props} />;
    case 'hear2': return <Hear2 {...props} />;
    case 'build': return <Build {...props} />;
    case 'radIntro': return <RadIntro {...props} />;
    default: return <Choice {...props} />;
  }
}
function Big({ p, lang, voice, auto }) {
  useEffect(() => { if (auto && voice) speak(p.zh, lang, { voice, py: p.py }); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`lg-big ${p.kind === 'sign' ? 'sign' : ''}`}>
      <div className="lg-big-row">
        <span className="zh" lang="zh-CN" id="lg-zh">{p.zh}</span>
        <SpeakBtn text={p.zh} py={p.py} lang={lang} voice={voice} id="lg-play" />
        <SpeakBtn text={p.zh} py={p.py} lang={lang} voice={voice} slow />
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
/* Наглядная схема к правилу: demo в данных урока */
function ruleDemo(kind, { lang, voice }) {
  if (kind === 'tones') return <TonesDemo lang={lang} voice={voice} labels={TONE_EXAMPLES} />;
  if (kind === 'pinyin') return <PinyinDemo lang={lang} voice={voice} />;
  if (kind === 'syllable') return <SyllableBuilder lang={lang} voice={voice} />;
  return null;
}
function Note({ kicker, title, text, onNext, id, demo = null }) {
  return (
    <div className={`lg-rule ${demo ? 'has-demo' : ''}`} id={id}>
      <p className="label pl-kicker">{kicker}</p>
      <h2 className="h3">{title}</h2>
      <p>{text}</p>
      {demo}
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
    if (ok && voice && (x.type === 'reverse' || x.type === 'reply')) speak(x.p.zh, lang, { voice, py: x.p.py });
    onAnswer(ok, { picked: k });
  };
  const last = x.type === 'reply' ? x.history.filter(h => h.who === 'them').at(-1) : null;
  useEffect(() => {
    if (!voice) return;
    if (x.type === 'listen') speak(x.p.zh, lang, { voice, py: x.p.py });
    if (['tone', 'toneWord', 'sound'].includes(x.type)) speak(x.syl.zh, lang, { voice, py: x.syl.py });
    if (last) speak(last.zh, lang, { voice, py: last.py });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const cls = k => (!answer ? '' : k === x.correct ? 'ok' : k === picked ? 'bad' : 'dim');
  const icon = k => (x.type === 'tone' || x.type === 'toneRead' ? <ToneIcon tone={k + 1} /> : null);
  const optText = (o, k) => (typeof o === 'string'
    ? <span className="lg-opt-t">{icon(k)}<span className={x.type === 'toneRead' || x.type === 'radPick' ? '' : 'py py-opt'}>{o}</span></span>
    : x.type === 'meaning' ? <span>{o.ru}</span> : <span className="lg-opt-zh"><span className="zh" lang="zh-CN">{o.zh}</span><span className="py">{o.py}</span></span>);
  return (
    <>
      {x.type === 'reply' && <Chat history={x.history} lang={lang} voice={voice} />}
      <p className="tr-ask lg-ask">{x.type === 'reply' || x.type === 'spell' ? x.ask : x.type === 'compose' ? 'Как это записать?' : x.p && x.p.kind === 'char' ? (x.type === 'meaning' ? 'Что значит этот знак?' : 'Какой знак это значит?') : PROMPT[x.type]}</p>
      {x.type === 'meaning' && <Big p={x.p} lang={lang} voice={voice} />}
      {x.type === 'reverse' && <p className="lg-ru big" id="lg-ru">{x.p.ru}</p>}
      {x.type === 'listen' && <div className="lg-listen"><SpeakBtn text={x.p.zh} py={x.p.py} lang={lang} voice={voice} big id="lg-play" label="Послушать ещё раз" /><SpeakBtn text={x.p.zh} py={x.p.py} lang={lang} voice={voice} slow /></div>}
      {['tone', 'toneWord'].includes(x.type) && <div className="lg-big"><div className="lg-big-row">{x.syl.zh ? <span className="zh" lang="zh-CN">{x.syl.zh}</span> : <span className="lg-pyb" id="lg-base">{x.syl.base}</span>}<SpeakBtn text={x.syl.zh} py={x.syl.py} lang={lang} voice={voice} id="lg-play" /><SpeakBtn text={x.syl.zh} py={x.syl.py} lang={lang} voice={voice} slow /></div>{x.syl.ru && x.type === 'toneWord' && <span className="lg-ru">{x.syl.ru}</span>}</div>}
      {['toneRead', 'toneWordRead'].includes(x.type) && <div className="lg-big">{x.syl.zh ? <span className="zh" lang="zh-CN">{x.syl.zh}</span> : null}{x.type === 'toneRead' ? <span className={x.syl.zh ? 'py' : 'lg-pyb'}>{x.syl.py}</span> : x.syl.ru && <span className="lg-ru">{x.syl.ru}</span>}</div>}
      {x.type === 'sound' && <div className="lg-listen"><SpeakBtn text={x.syl.zh} py={x.syl.py} lang={lang} voice={voice} big id="lg-play" label="Послушать ещё раз" /><SpeakBtn text={x.syl.zh} py={x.syl.py} lang={lang} voice={voice} slow /></div>}
      {x.type === 'compose' && <div className="lg-big lg-parts" id="lg-parts"><span className="lg-pyb">{x.parts.initial || '—'}</span><span className="lg-plus">+</span><span className="lg-pyb">{x.parts.final}</span><span className="lg-plus">,</span><span className="lg-tone-name">{TONE_NAMES[x.parts.tone - 1]} тон</span></div>}
      {x.type === 'radPick' && <div className="lg-big"><div className="lg-big-row"><span className="zh" lang="zh-CN">{x.ch.zh}</span><SpeakBtn text={x.ch.zh} py={x.ch.py} lang={lang} voice={voice} /></div><span className="py">{x.ch.py}</span></div>}
      <div className="lg-opts ch-list" role="group" aria-label="Варианты ответа">
        {x.options.map((o, k) => (
          <button key={typeof o === 'string' ? o : o.id || o.zh} type="button" className={`ch-opt ${cls(k)}`} disabled={Boolean(answer)} aria-pressed={picked === k} data-ok={k === x.correct ? '1' : undefined} onClick={e => pick(k, e.currentTarget)}>
            <span className="ch-key" aria-hidden="true">{answer && k === x.correct ? <Icon name="check" size={16} /> : answer && k === picked ? <Icon name="x" size={16} /> : LETTERS[k]}</span>
            {x.type === 'radPick' ? <span className="lg-rad-opt"><span className="zh" lang="zh-CN">{o.zh}</span><span>{o.ru}</span></span> : optText(o, k)}
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
          {h.who === 'them' && <SpeakBtn text={h.zh} py={h.py} lang={lang} voice={voice} />}
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
  const state = (side, id) => (done.includes(id) ? 'ok' : miss && ((miss.a.side === side && miss.a.id === id) || (miss.b.side === side && miss.b.id === id)) ? 'bad' : sel && sel.side === side && sel.id === id ? 'is-sel' : '');
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

/* ---------- вводный фонетический курс ---------- */
/* Слог-кнопка: нажать — услышать */
function SylBtn({ py, lang, voice, id, onPlay }) {
  return (
    <button type="button" className="lg-syl" id={id} data-py={py} onClick={() => (onPlay ? onPlay() : voice && speak('', lang, { voice, py }))} aria-label={`Послушать ${py}`}>
      <span className="lg-syl-py">{py}</span>{voice && <Icon name="volume-2" size={15} />}
    </button>
  );
}
/* Знакомство со звуком: как произносить, наглядная схема (губы или свеча) и примеры */
function SoundIntro({ task: { s }, lang, voice, onNext }) {
  const [pulse, setPulse] = useState(0);
  const play = py => { if (voice) speak('', lang, { voice, py }); setPulse(x => x + 1); };
  useEffect(() => { if (s.ex[0]) { const t = setTimeout(() => play(s.ex[0]), 250); return () => clearTimeout(t); } return undefined; }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const demo = demoFor(s.py, s.ex[0]);
  return (
    <div className={`lg-rule lg-sound ${demo ? 'has-demo' : ''}`} id="lg-sound-intro">
      <p className="label pl-kicker">Новый звук</p>
      <div className="lg-sound-head"><span className="lg-pyb" id="lg-sound-py">{s.py}</span><p>{s.how}</p></div>
      {demo === 'mouth' && <MouthDemo v={s.py} pulse={pulse} lang={lang} voice={voice} examples={VOWEL_EX} />}
      {demo === 'breath' && <BreathDemo ini={s.py} ex={s.ex[0]} pulse={pulse} lang={lang} voice={voice} />}
      <div className="lg-syls" aria-label="Примеры">{s.ex.map((py, k) => <SylBtn key={py} py={py} lang={lang} voice={voice} id={k === 0 ? 'lg-ex0' : undefined} onPlay={() => play(py)} />)}</div>
      {!voice && <p className="muted">Озвучка выключена: включите её, чтобы услышать примеры.</p>}
      <div className="row"><button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Дальше<Icon name="arrow-right" size={17} /></button></div>
    </div>
  );
}
/* Знакомство с тоном: знак, схема высоты голоса, как звучит и примеры */
const TONE_TITLE = { 1: 'Первый тон', 2: 'Второй тон', 3: 'Третий тон', 4: 'Четвёртый тон' };
function ToneIntro({ task: { tone, how, ex }, lang, voice, onNext }) {
  const [pulse, setPulse] = useState(0);
  const play = py => { if (voice) speak('', lang, { voice, py }); setPulse(x => x + 1); };
  return (
    <div className="lg-rule lg-tone" id="lg-tone-intro" data-tone={tone}>
      <p className="label pl-kicker">Тон {tone} из 4</p>
      <h2 className="h3">{TONE_TITLE[tone]} <span className="lg-tone-mark">{ex[0]}</span></h2>
      <div className="lg-tone-body">
        <ToneChart only={tone} labels={[ex[0], ex[0], ex[0], ex[0]]} autoplay pulse={pulse} onPlay={voice ? () => speak('', lang, { voice, py: ex[0] }) : null} />
        <div className="lg-tone-text">
          <p>{how}</p>
          <div className="lg-syls" aria-label="Примеры">{ex.map((py, k) => <SylBtn key={py} py={py} lang={lang} voice={voice} id={k === 0 ? 'lg-ex0' : undefined} onPlay={() => play(py)} />)}</div>
        </div>
      </div>
      {!voice && <p className="muted">Озвучка выключена: включите её, чтобы услышать тон.</p>}
      <div className="row"><button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Дальше<Icon name="arrow-right" size={17} /></button></div>
    </div>
  );
}
/* Послушайте и повторите: по очереди или все подряд */
function Repeat({ task: { items }, lang, voice, onNext }) {
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const all = () => {
    timers.current.forEach(clearTimeout);
    timers.current = items.map((py, k) => setTimeout(() => speak('', lang, { voice, py }), k * 1300));
  };
  return (
    <div className="lg-rule" id="lg-repeat">
      <p className="label pl-kicker">Послушайте и повторите</p>
      <p>Нажимайте на слоги по очереди и повторяйте каждый вслух, подражая высоте голоса.</p>
      <div className="lg-syls">{items.map(py => <SylBtn key={py} py={py} lang={lang} voice={voice} />)}</div>
      <div className="row">
        <button type="button" className="btn btn-secondary" id="lg-play-all" onClick={all}><Icon name="play" size={16} />Все подряд</button>
        <button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Готово<Icon name="arrow-right" size={17} /></button>
      </div>
    </div>
  );
}
/* Две записи: в какой звучит нужный слог */
function Hear2({ task: x, lang, voice, answer, onAnswer }) {
  const timers = useRef([]);
  const play = k => speak('', lang, { voice, py: x.options[k] });
  useEffect(() => {
    if (voice) timers.current = [setTimeout(() => play(0), 150), setTimeout(() => play(1), 1500)];
    return () => timers.current.forEach(clearTimeout);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const picked = answer ? answer.picked : null;
  const cls = k => (!answer ? '' : k === x.correct ? 'ok' : k === picked ? 'bad' : 'dim');
  return (
    <>
      <p className="tr-ask lg-ask">Где звучит <span className="py py-opt" id="lg-target">{x.syl.py}</span>?</p>
      <div className="lg-opts lg-h2s" role="group" aria-label="Варианты ответа">
        {x.options.map((py, k) => (
          <div className="lg-h2" key={py}>
            <button type="button" className="lg-say big" aria-label={`Послушать вариант ${k + 1}`} data-play={k} onClick={() => play(k)}><Icon name="volume-2" size={26} /></button>
            <button type="button" className={`ch-opt ${cls(k)}`} disabled={Boolean(answer)} aria-pressed={picked === k} data-ok={k === x.correct ? '1' : undefined}
              onClick={e => { if (answer) return; const ok = k === x.correct; if (ok) sparkFrom(e.currentTarget); onAnswer(ok, { picked: k }); }}>
              <span className="ch-key" aria-hidden="true">{answer && k === x.correct ? <Icon name="check" size={16} /> : answer && k === picked ? <Icon name="x" size={16} /> : LETTERS[k]}</span>
              <span>Вариант {k + 1}{answer && <> — <span className="py">{py}</span></>}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
/* Диктант слога: начало, конец и тон */
const TONE_MARKS = ['ˉ', 'ˊ', 'ˇ', 'ˋ'];
function Build({ task: x, lang, voice, answer, onAnswer }) {
  const [sel, setSel] = useState({ initial: null, final: null, tone: null });
  useEffect(() => { if (voice) speak('', lang, { voice, py: x.syl.py }); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const ready = sel.initial != null && sel.final != null && sel.tone != null;
  const preview = ready ? markPy(`${sel.initial}${sel.final}`, sel.tone) : `${sel.initial ?? '…'} + ${sel.final ?? '…'}${sel.tone ? ` ${TONE_MARKS[sel.tone - 1]}` : ''}`;
  const check = () => onAnswer(sel.initial === x.answer.initial && sel.final === x.answer.final && sel.tone === x.answer.tone, { built: preview });
  const group = (name, label, items, show = v => v) => (
    <div className="lg-bgrp" role="radiogroup" aria-label={label} data-group={name}>
      <span className="label">{label}</span>
      <div className="lg-chips">
        {items.map(v => <button key={v} type="button" role="radio" aria-checked={sel[name] === v} className={`lg-chip ${sel[name] === v ? 'on' : ''}`} disabled={Boolean(answer)} data-v={v} onClick={() => setSel(s => ({ ...s, [name]: v }))}>{show(v)}</button>)}
      </div>
    </div>
  );
  return (
    <div className="lg-build" data-i={x.answer.initial} data-f={x.answer.final} data-t={x.answer.tone}>
      <p className="tr-ask lg-ask">Соберите услышанный слог</p>
      <div className="lg-listen"><SpeakBtn text="" py={x.syl.py} lang={lang} voice={voice} big id="lg-play" label="Послушать ещё раз" /><SpeakBtn text="" py={x.syl.py} lang={lang} voice={voice} slow /></div>
      {group('initial', 'Начало', x.initials)}
      {group('final', 'Конец', x.finals)}
      {group('tone', 'Тон', [1, 2, 3, 4], v => <><b>{TONE_MARKS[v - 1]}</b> {v}-й</>)}
      <p className={`lg-built ${answer ? (answer.ok ? 'ok' : 'bad') : ''}`} id="lg-built" aria-live="polite">{preview}</p>
      {!answer && <div className="row"><button type="button" className="btn btn-primary" id="lg-check" disabled={!ready} onClick={check}>Проверить</button></div>}
    </div>
  );
}
/* Ключ иероглифа: что значит и в каких знаках встречается */
function RadIntro({ task: { rad }, lang, voice, onNext }) {
  return (
    <div className="lg-rule lg-rad" id="lg-rad-intro">
      <p className="label pl-kicker">Ключ</p>
      <div className="lg-sound-head"><span className="zh lg-rad-big" lang="zh-CN">{rad.zh}</span><div><b className="lg-rad-ru">«{rad.ru}»</b><p>{rad.how}</p></div></div>
      <ul className="lg-rad-ex">
        {rad.ex.map(e => <li key={e.zh}><span className="zh" lang="zh-CN">{e.zh}</span><span className="py">{e.py}</span><span>{e.ru}</span><SpeakBtn text={e.zh} py={e.py} lang={lang} voice={voice} /></li>)}
      </ul>
      <div className="row"><button type="button" className="btn btn-primary" id="lg-next" onClick={onNext}>Дальше<Icon name="arrow-right" size={17} /></button></div>
    </div>
  );
}

/* Прописи в уроке: знак по контуру или по памяти. Ошибка в черте не считается ошибкой урока */
function WriteTask({ task: x, lang, voice, answer, onAnswer }) {
  const memory = x.mode === 'memory';
  return (
    <>
      <p className="tr-ask lg-ask">{memory ? 'Напишите знак по памяти' : 'Обведите знак по контуру'}</p>
      <div className="lg-write-head">
        {!memory && <span className="zh lg-write-zh" lang="zh-CN">{x.ch.zh}</span>}
        <div className="lg-write-meta"><span className="py">{x.ch.py}</span><span className="lg-write-ru">{x.ch.ru}</span></div>
        <SpeakBtn text={x.ch.zh} py={x.ch.py} lang={lang} voice={voice} />
      </div>
      <Writer ch={x.ch.zh} mode={memory ? 'memory' : 'trace'} onDone={({ mistakes }) => onAnswer(true, { mistakes })}
        label={memory ? `Поле для письма: знак «${x.ch.ru}»` : `Поле для письма: знак ${x.ch.zh}, «${x.ch.ru}»`} />
      {!answer && <div className="row"><button type="button" className="btn btn-ghost btn-sm" id="lg-skip" onClick={() => onAnswer(true, { skipped: true })}><Icon name="skip-forward" size={16} />Пропустить</button></div>}
    </>
  );
}

/* ---------- проверка уровня ---------- */
export function LangTest() {
  const { code } = useParams();
  return <Gate code={code} player>{ix => <Placement ix={ix} />}</Gate>;
}
function Placement({ ix }) {
  const t = ix.track;
  useTitle(`Проверка уровня — ${t.title}`);
  const s = useStore();
  const voice = useSound(t.lang);
  const audio = voice.status === 'ready';
  const levels = levelsOf(t.code);
  const [phase, setPhase] = useState('intro');        // intro | play | end
  const [stage, setStage] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState(null);
  const [log, setLog] = useState([]);                   // по уровням: { id, right, total }
  const [result, setResult] = useState(null);
  const right = useRef(0), headRef = useRef(null), nextBtn = useRef(null);
  const L = langOf(s, t.code);

  useEffect(() => () => stopSpeech(), []);
  useEffect(() => { window.scrollTo(0, 0); headRef.current?.focus({ preventScroll: true }); }, [phase, i, stage]);
  useEffect(() => { if (answer) nextBtn.current?.focus({ preventScroll: true }); }, [answer]);

  const begin = k => {
    setStage(k); setTasks(buildPlacement(ix, levels[k].id, { audio }).map((x, n) => ({ ...x, key: n })));
    setI(0); setAnswer(null); right.current = 0; setPhase('play');
  };
  const start = () => { setLog([]); setResult(null); begin(0); };
  const onAnswer = (ok, info = {}) => { if (answer) return; if (ok) right.current += 1; setAnswer({ ok, ...info }); };
  const next = () => {
    stopSpeech();
    if (i + 1 < tasks.length) { setI(i + 1); setAnswer(null); return; }
    const lv = levels[stage], r = right.current, all = [...log, { id: lv.id, right: r, total: tasks.length }];
    setLog(all);
    if (r >= PLACEMENT.pass && stage + 1 < levels.length) { begin(stage + 1); return; }
    setLevel(t.code, lv.id);
    setResult({ id: lv.id, top: r >= PLACEMENT.pass });
    setPhase('end');
  };
  useEffect(() => {
    const onKey = e => {
      if (phase !== 'play' || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (/^[1-9]$/.test(e.key) && !answer) {
        const b = document.querySelectorAll('.lg-body .lg-opts .ch-opt')[+e.key - 1];
        if (b && !b.disabled) { e.preventDefault(); b.click(); }
      } else if (e.key === 'Enter' && answer && tag !== 'button' && tag !== 'a') { e.preventDefault(); next(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const back = `/lang/${t.code}`;
  const task = phase === 'play' ? tasks[i] : null;
  const first = result ? (levelLessonsOf(ix, result.id).find(l => !L.done[l.id]) || levelLessonsOf(ix, result.id)[0]) : null;
  return (
    <div className="player lg-player" data-phase={phase}>
      <header className="pl-top">
        <div className="wrap">
          <div className="pl-top-row">
            <Link className="icon-btn" to={back} aria-label="Выйти из проверки"><Icon name="x" /></Link>
            <div className="pl-title"><Mark size={20} /><span>Проверка уровня</span></div>
            <div className="pl-left">{phase === 'play' ? `${levels[stage].code} · ${i + 1} / ${tasks.length}` : ''}</div>
          </div>
          {phase === 'play' && (
            <div className="play-steps lg-steps" aria-hidden="true">
              {levels.map((lv, k) => <i key={lv.id} className={k < stage ? 'ok' : k === stage ? 'now' : ''} />)}
            </div>
          )}
        </div>
      </header>
      <div className="pl-main">
        <div className="wrap">
          {phase === 'intro' && (
            <div className="pl-col lg-intro">
              <p className="label pl-kicker">{t.title}</p>
              <h1 className="h2" id="pl-h" tabIndex={-1} ref={headRef}>Проверка уровня</h1>
              <p className="pl-intro">По {PLACEMENT.size} заданий на каждый уровень, начиная с самого простого. Если ответите верно на {PLACEMENT.pass} из {PLACEMENT.size}, откроется следующий. На ошибках проверка останавливается и советует, с какого уровня начать.</p>
              <p className="muted">Опыт за проверку не начисляется, уроки не отмечаются пройденными: она только выбирает, куда ведёт кнопка «Продолжить».</p>
              <VoiceNote v={voice} lang={t.lang} />
              <div className="row">
                <button type="button" className="btn btn-primary btn-lg" id="lg-start" disabled={voice.status === 'checking'} onClick={start}><Icon name="gauge" size={18} />{voice.status === 'checking' ? 'Проверяем звук…' : 'Начать проверку'}</button>
                <Link className="btn btn-ghost btn-lg" to={back}>К курсу</Link>
              </div>
            </div>
          )}
          {phase === 'play' && task && (
            <div className="pl-col lg-body" key={`${stage}-${i}`} data-type={task.type} data-level={levels[stage].id} data-i={i}>
              <p className="label lg-test-level">{levelName(levels[stage].id)}</p>
              <h1 className="sr" tabIndex={-1} ref={headRef}>Проверка уровня {levels[stage].code}: задание {i + 1} из {tasks.length}</h1>
              <Task task={task} lang={t.lang} voice={voice.voice} answer={answer} onAnswer={onAnswer} onNext={next} />
              {answer && (
                <div className={`lg-fb ${answer.ok ? 'ok' : 'bad'}`} id="lg-fb" aria-live="polite">
                  <p><b>{answer.ok ? 'Верно.' : 'Не совсем.'}</b> <Explain task={task} /></p>
                  <button type="button" className="btn btn-primary" id="lg-next" ref={nextBtn} onClick={next}>Дальше<Icon name="arrow-right" size={17} /></button>
                </div>
              )}
            </div>
          )}
          {phase === 'end' && result && (
            <div className="pl-col lg-end" id="lg-test-end" data-result={result.id}>
              <p className="label pl-kicker">Проверка завершена</p>
              <h1 className="h2" id="pl-h" tabIndex={-1} ref={headRef}>{result.id === 'a0' ? 'Начните с нуля' : `Ваш уровень — ${LEVEL_BY[result.id].code}`}</h1>
              <p className="pl-intro">{result.top
                ? `Задания всех готовых уровней вы решили уверенно. Следующие уровни готовятся, а пока повторяйте фразы ${LEVEL_BY[result.id].code} и проходите сценарии.`
                : result.id === 'a0' ? 'Курс начинается со звуков, вежливых слов и чисел — с них и стоит начать.' : `Материал ниже вы знаете. Начните с уровня ${LEVEL_BY[result.id].code}: ${LEVEL_BY[result.id].can[0].toLowerCase()}${LEVEL_BY[result.id].can.slice(1)}`}</p>
              <ul className="lg-test-log" id="lg-test-log">
                {log.map(x => <li key={x.id} className={x.right >= PLACEMENT.pass ? 'ok' : ''}><b>{levelName(x.id)}</b><span className="num">{x.right} из {x.total}</span></li>)}
              </ul>
              <div className="row">
                {first && <Link className="btn btn-primary btn-lg" id="lg-test-start" to={`/lang/${t.code}/l/${first.id}`}>Начать: {first.title}<Icon name="arrow-right" size={18} /></Link>}
                <Link className="btn btn-secondary btn-lg" to={back}>К курсу</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- прописи ---------- */
export function LangWrite() {
  const { code } = useParams();
  if (code === 'latin') return <LatinWrite />;
  return <Gate code={code}>{ix => <HanziWrite ix={ix} />}</Gate>;
}
function HanziWrite({ ix }) {
  const t = ix.track;
  useTitle(`Прописи — ${t.title}`);
  const s = useStore();
  const L = langOf(s, t.code);
  const [all, setAll] = useState(true);
  const table = useMemo(() => charTable(ix), [ix]);
  const learned = c => c.from.some(f => (f.startsWith('l:') ? L.done[f.slice(2)] : L.ph[f]));
  const groups = table.map(g => ({ id: g.unit.id, title: g.unit.title, level: g.unit.level, items: g.chars.filter(c => all || learned(c)) })).filter(g => g.items.length);
  return (
    <WritePage code={t.code} script="hanzi" lang={t.lang} groups={groups} wr={L.wr}
      title={`Прописи: ${t.title.toLowerCase()}`} crumbs={[['Языки', '/lang'], [t.title, `/lang/${t.code}`], ['Прописи']]}
      lead="Все иероглифы курса по мини-курсам. Выберите знак, посмотрите порядок черт и обведите его по контуру, а потом напишите по памяти."
      filter={(
        <div className="seg-ctl" role="radiogroup" aria-label="Какие знаки показывать">
          <button type="button" role="radio" aria-checked={all} onClick={() => setAll(true)}>Все знаки курса</button>
          <button type="button" role="radio" aria-checked={!all} id="wr-learned" onClick={() => setAll(false)}>Из пройденных уроков</button>
        </div>
      )}
      empty="Пройдите урок с фразами или с прописями — знаки из него появятся здесь."
      credits={<>Порядок и форма черт — данные проекта <a href="https://github.com/skishore/makemeahanzi" target="_blank" rel="noopener noreferrer">Make Me a Hanzi</a> (© 1999 Arphic Technology Co., Ltd., © 2016 Shaunak Kishore) по <a href="strokes/zh/ARPHICPL.TXT" target="_blank" rel="noopener">лицензии Arphic Public License</a>. Тренажёр письма — <a href="https://github.com/chanind/hanzi-writer" target="_blank" rel="noopener noreferrer">Hanzi Writer</a> (© 2014 David Chanin, <a href="licenses/hanzi-writer.txt" target="_blank" rel="noopener">лицензия MIT</a>).</>} />
  );
}
function LatinWrite() {
  useTitle('Прописи — латиница');
  const s = useStore();
  const L = langOf(s, 'latin');
  const groups = LETTER_GROUPS.map(g => ({ id: g.id, title: g.title, items: g.chars.map(ch => ({ zh: ch, py: '', ru: '', words: [], from: [] })) }));
  return (
    <WritePage code="latin" script="latin" groups={groups} wr={L.wr}
      title="Прописи: латиница" crumbs={[['Языки', '/lang'], ['Прописи: латиница']]}
      lead="Печатные буквы латинского алфавита — для английского и испанского. Буквы пишут между линейками: строчные — до средней линии, заглавные и высокие строчные — до верхней."
      credits={<>Буквы нарисованы для NowNow. Тренажёр письма — <a href="https://github.com/chanind/hanzi-writer" target="_blank" rel="noopener noreferrer">Hanzi Writer</a> (© 2014 David Chanin, <a href="licenses/hanzi-writer.txt" target="_blank" rel="noopener">лицензия MIT</a>).</>} />
  );
}
const MODES = [['show', 'Порядок'], ['trace', 'По контуру'], ['memory', 'По памяти']];
function WritePage({ code, script, lang, groups, wr, title, crumbs, lead, filter, empty, credits }) {
  const flat = groups.flatMap(g => g.items);
  const [sel, setSel] = useState(() => (flat.find(c => !wr[c.zh]) || flat[0] || {}).zh);
  const [mode, setMode] = useState('trace');
  const [gain, setGain] = useState(null);
  const voice = useSound(lang || 'zh-CN');
  const panel = useRef(null);
  const c = flat.find(x => x.zh === sel) || flat[0];
  useEffect(() => { if (flat.length && !flat.some(x => x.zh === sel)) setSel(flat[0].zh); }, [flat.length]);  // eslint-disable-line react-hooks/exhaustive-deps
  const pick = ch => {
    setSel(ch); setGain(null);
    if (window.innerWidth < 1024 && panel.current) panel.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const nextChar = () => { const k = flat.findIndex(x => x.zh === c.zh); if (k >= 0 && flat.length) pick(flat[(k + 1) % flat.length].zh); };
  const onDone = ({ mistakes }) => { const r = practiceWrite(code, c.zh, mistakes); setGain(r.gain); };
  const count = Object.keys(wr).length;
  return (
    <section className="page wr-page">
      <div className="wrap">
        <header className="page-head">
          <Crumbs items={crumbs} />
          <h1 className="h1">{title}</h1>
          <p className="lead">{lead}</p>
          <div className="row">{filter}<span className="muted" id="wr-count">{count ? `Написано: ${nChars(count)}` : 'Пока ничего не написано'}</span></div>
        </header>
        {!c ? <EmptyState title="Пока пусто" text={empty || 'Знаков нет.'} /> : (
          <div className="wr-layout">
            <div className="panel wr-panel" ref={panel} id="wr-panel">
              <div className="wr-info">
                <span className={`wr-big ${script === 'hanzi' ? 'zh' : 'latin'}`} lang={script === 'hanzi' ? 'zh-CN' : undefined}>{c.zh}</span>
                <div className="wr-meta">
                  {c.py && <span className="py">{c.py}</span>}
                  {c.ru && <span className="wr-ru">{c.ru}</span>}
                  {wr[c.zh] && <span className="badge"><Icon name="check" size={13} />написан {wr[c.zh].n} {plural(wr[c.zh].n, ['раз', 'раза', 'раз'])}</span>}
                </div>
                {script === 'hanzi' && <SpeakBtn text={c.zh} py={c.py} lang={lang} voice={voice.voice} />}
              </div>
              <div className="seg-ctl wr-modes" role="radiogroup" aria-label="Режим прописи">
                {MODES.map(([m, label]) => <button key={m} type="button" role="radio" aria-checked={mode === m} data-mode={m} onClick={() => { setMode(m); setGain(null); }}>{label}</button>)}
              </div>
              <Writer key={`${c.zh}-${mode}`} ch={c.zh} script={script} mode={mode} onDone={onDone} label={`Поле для письма: ${c.zh}`} />
              {gain != null && <p className="wr-gain" id="wr-gain" aria-live="polite">{gain ? `+${gain} к опыту за новый знак` : 'Записано в прописи'}</p>}
              {c.words && c.words.length > 0 && (
                <ul className="wr-words" aria-label="Где встречается">
                  {c.words.map(w => <li key={w.zh}><span className="zh" lang="zh-CN">{w.zh}</span> <span className="py">{w.py}</span> — {w.ru}</li>)}
                </ul>
              )}
              <div className="row"><button type="button" className="btn btn-secondary btn-sm" id="wr-next" onClick={nextChar}>Следующий знак<Icon name="arrow-right" size={16} /></button></div>
            </div>
            <div className="wr-sets">
              {groups.map(g => (
                <div className="wr-set" key={g.id} data-set={g.id}>
                  <h2 className="h4">{g.level && LEVEL_BY[g.level] ? <span className="lg-lv-tag">{LEVEL_BY[g.level].code}</span> : null}{g.title}</h2>
                  <div className="wr-cells">
                    {g.items.map(x => (
                      <button key={x.zh} type="button" className={`wr-cell ${script === 'hanzi' ? 'zh' : 'latin'} ${wr[x.zh] ? 'done' : ''}`} aria-pressed={x.zh === c.zh} data-ch={x.zh}
                        aria-label={`${x.zh}${x.py ? `, ${x.py}` : ''}${wr[x.zh] ? ', написан' : ''}`} onClick={() => pick(x.zh)}>
                        <span lang={script === 'hanzi' ? 'zh-CN' : undefined}>{x.zh}</span>{wr[x.zh] && <i aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="wr-credits">{credits}</p>
      </div>
    </section>
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
      <SpeakBtn text={p.zh} py={p.py} lang={lang} voice={voice} />
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
            <h2 className="h3">{LEVEL_BY[g.u.level] && <span className="lg-lv-tag">{LEVEL_BY[g.u.level].code}</span>}{g.u.title}</h2>
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
