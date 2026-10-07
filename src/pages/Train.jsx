import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { COURSE_BY, TOPIC_BY } from '../data';
import { ROUND, TRAINERS } from '../data/trainers.js';
import { useStore, getState, streak, plural } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { AI_TOPIC, REVIEW_MIN, SPEED_MS, XP, dailyPlan, makeRound, normalize, playedToday, points, recordRound, reviewPool, trainerOf, xpOf } from '../lib/game.js';
import { celebrate, sparkFrom } from '../lib/fx.js';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { ChoiceView, Steps } from '../components/Play.jsx';
import { Bolts, CountUp, DailyPanel, TrainerCard, XpBar } from '../components/GameUI.jsx';
import NotFound from './NotFound.jsx';

/* ---------- список тренажёров ---------- */
export function Train() {
  useTitle('Тренажёры');
  const s = useStore();
  const st = streak(s);
  return (
    <section className="page">
      <div className="wrap">
        <header className="page-head">
          <h1 className="h1">Тренажёры</h1>
          <p className="lead">Раунд из {ROUND} заданий занимает около двух минут. За точность даются молнии, за каждый раунд — опыт. После раунда показан разбор ошибок.</p>
        </header>
        <div className="train-top">
          <DailyPanel />
          <div className="panel train-me">
            <XpBar xp={xpOf(s)} />
            <p className="train-streak"><Icon name="flame" size={18} /><span><b className="num">{st}</b> {plural(st, ['день', 'дня', 'дней'])} подряд</span></p>
            <Link className="more-link" to="/me">Достижения в кабинете <Icon name="arrow-right" size={16} /></Link>
          </div>
        </div>
        <div className="group">
          <h2 className="h3" style={{ marginBottom: 6 }}>{TOPIC_BY[AI_TOPIC].title}</h2>
          <p className="muted" style={{ marginBottom: 18, maxWidth: '62ch' }}>Каждый тренажёр закрепляет один урок темы. Если раунд даётся тяжело, урок открывается по ссылке на карточке результата.</p>
          <div className="tcards" data-rv-kids="">{TRAINERS.map(t => <TrainerCard id={t.id} key={t.id} />)}</div>
        </div>
        <div className="group">
          <h2 className="h3" style={{ marginBottom: 6 }}>Повторение пройденного</h2>
          <p className="muted" style={{ marginBottom: 18, maxWidth: '62ch' }}>Вопросы из уроков любых тем, которые вы уже прошли. Чем больше пройдено, тем разнообразнее раунд.</p>
          <div className="tcards"><TrainerCard id="review" /></div>
        </div>
        <div className="group" style={{ maxWidth: 720 }}>
          <h2 className="h3" style={{ marginBottom: 14 }}>Как считаются очки</h2>
          <ul className="rules">
            <li><b>100</b><span>за каждый верный ответ</span></li>
            <li><b>до 50</b><span>за скорость: чем быстрее ответ, тем больше</span></li>
            <li><b>до 50</b><span>за серию верных ответов подряд</span></li>
          </ul>
          <p className="time-note">Молнии зависят только от точности: три за раунд без ошибок, две — от трёх четвертей верных, одна — от половины. Рейтинга игроков нет: свои результаты видите только вы.</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- раунд ---------- */
const NEXT_MS = 1100;
const VERDICT = ['Есть над чем поработать', 'Неплохо', 'Отличный раунд', 'Без единой ошибки'];

function Round({ id, daily }) {
  const t = trainerOf(id);
  useTitle(t.title);
  const cfg = id === 'review' ? { type: 'pick' } : t;
  const s = useStore();
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState('intro'); // intro | play | end
  // задания раунда: новый набор при каждом запуске
  const items = useMemo(() => makeRound(id, getState()), [id, run]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [log, setLog] = useState([]);   // по одному на задание: { ok, picked, pts, n }
  const [res, setRes] = useState(null); // итог раунда
  const logRef = useRef([]), t0 = useRef(0), timer = useRef(0);
  const nextBtn = useRef(null), startBtn = useRef(null), endH = useRef(null);
  const total = items.length;
  const n = phase === 'play' && items[i] ? normalize(cfg, items[i]) : null;
  const score = log.reduce((x, y) => x + y.pts, 0);
  let runLen = 0; for (let j = log.length - 1; j >= 0 && log[j].ok; j--) runLen++;
  const waiting = picked != null && !(log[i] && log[i].ok && cfg.type !== 'predict');   // ждём нажатия «Дальше»
  const best = s.game.best[id];
  const pool = id === 'review' ? reviewPool(s).length : t.items.length;
  const locked = id === 'review' && pool < REVIEW_MIN;

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (phase === 'intro') startBtn.current?.focus({ preventScroll: true }); if (phase === 'end') endH.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [phase]);
  useEffect(() => { if (phase === 'play') t0.current = performance.now(); }, [phase, i, run]);
  useEffect(() => { if (waiting) nextBtn.current?.focus({ preventScroll: true }); }, [waiting]);

  const start = () => { logRef.current = []; setLog([]); setI(0); setPicked(null); setRes(null); setRun(r => r + 1); setPhase('play'); };
  const finish = () => {
    const L = logRef.current, right = L.filter(x => x.ok).length, sum = L.reduce((x, y) => x + y.pts, 0);
    const out = recordRound(id, { score: sum, right, total: L.length });
    setRes({ ...out, right, score: sum, total: L.length });
    setPhase('end');
    if (out.bolts === 3) celebrate();
  };
  const next = () => {
    clearTimeout(timer.current);
    if (logRef.current.length >= total) finish(); else { setI(logRef.current.length); setPicked(null); }
  };
  const pick = (k, el) => {
    if (picked != null || !n) return;
    const ok = k === n.correct, ms = performance.now() - t0.current;
    let len = 0; for (let j = logRef.current.length - 1; j >= 0 && logRef.current[j].ok; j--) len++;
    const pts = ok ? points(ms, len + 1) : 0;
    logRef.current = [...logRef.current, { ok, picked: k, pts, n }];
    setLog(logRef.current); setPicked(k);
    if (ok) { sparkFrom(el); if (cfg.type !== 'predict') timer.current = setTimeout(next, NEXT_MS); }
  };

  // клавиши: цифры и стрелки выбирают вариант, Enter и пробел ведут дальше
  const live = useRef({});
  live.current = { phase, picked, n, pick, next, waiting };
  useEffect(() => {
    const onKey = e => {
      const L = live.current, tag = (e.target.tagName || '').toLowerCase();
      if (L.phase !== 'play' || !L.n || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      if (L.picked == null) {
        let k = -1;
        if (/^[1-9]$/.test(e.key)) k = +e.key - 1;
        else if (L.n.options.length === 2 && e.key === 'ArrowLeft') k = 0;
        else if (L.n.options.length === 2 && e.key === 'ArrowRight') k = 1;
        if (k >= 0 && k < L.n.options.length) { e.preventDefault(); L.pick(k, document.querySelectorAll('.tr-body .ch button')[k]); }
      } else if ((e.key === 'Enter' || e.key === ' ') && tag !== 'button' && tag !== 'a') { e.preventDefault(); L.next(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const plan = dailyPlan(s), played = playedToday(s), nextDaily = plan.find(x => !played.includes(x));
  const dailyAt = plan.indexOf(id);
  const lesson = t.lesson && COURSE_BY[t.lesson];

  return (
    <div className="player trainer" data-phase={phase}>
      <header className="pl-top">
        <div className="wrap">
          <div className="pl-top-row">
            <Link className="icon-btn" to="/train" aria-label="Выйти из тренажёра"><Icon name="x" /></Link>
            <div className="pl-title"><Mark size={20} /><span>{t.title}</span></div>
            <div className="tr-score" id="tr-score" aria-label={`Очки: ${score}`}>
              {runLen >= 2 && phase === 'play' && <span className="tr-run" key={runLen}><Icon name="zap" size={14} />{runLen} подряд</span>}
              <b><CountUp value={phase === 'intro' ? 0 : score} ms={400} /></b>
            </div>
          </div>
          {phase === 'play' && (
            <>
              <Steps total={total} at={i} marks={log.map(x => x.ok)} />
              <span className="tr-timer" key={`${run}-${i}`} data-stop={picked != null ? '' : undefined} aria-hidden="true"><i style={{ animationDuration: `${SPEED_MS}ms` }} /></span>
            </>
          )}
        </div>
      </header>

      <div className="pl-main">
        <div className="wrap">
          {phase === 'intro' && (
            <div className="pl-col tr-intro">
              <span className="tr-ic"><Icon name={t.icon} size={30} /></span>
              {daily && dailyAt >= 0 && <p className="label pl-kicker">Тренировка дня · раунд {dailyAt + 1} из {plan.length}</p>}
              <h1 className="h2" id="pl-h">{t.title}</h1>
              <p className="pl-intro">{t.hook}</p>
              {locked ? (
                <>
                  <div className="note-box"><Icon name="lock" size={20} /><p>Повторять пока нечего: тренажёр собирает вопросы из уроков, которые вы прошли. Пройдите любой урок, и он откроется.</p></div>
                  <div className="row"><Link className="btn btn-primary btn-lg" to="/courses">Выбрать урок</Link><Link className="btn btn-ghost btn-lg" to="/train">К тренажёрам</Link></div>
                </>
              ) : (
                <>
                  <ul className="tr-facts">
                    <li><Icon name="list-ordered" size={18} /><span>{Math.min(ROUND, pool)} {plural(Math.min(ROUND, pool), ['задание', 'задания', 'заданий'])} из набора в {pool}</span></li>
                    <li><Icon name="zap" size={18} /><span>100 очков за верный ответ, ещё до 100 за скорость и серию</span></li>
                    <li><Icon name="keyboard" size={18} /><span>На клавиатуре варианты выбирают цифрами</span></li>
                  </ul>
                  {best && <p className="tr-best"><Bolts n={best.bolts} /><span>Лучший результат: <b className="num">{best.score}</b></span></p>}
                  <div className="row"><button type="button" className="btn btn-primary btn-lg" id="tr-start" ref={startBtn} onClick={start}><Icon name="play" size={18} />Начать раунд</button></div>
                </>
              )}
            </div>
          )}

          {phase === 'play' && n && (
            <div className="pl-col tr-body" key={`${run}-${i}`} data-i={i}>
              <p className="tr-ask">{t.ask}<span className="sr"> Задание {i + 1} из {total}.</span></p>
              <div className={`ch ch-${cfg.type}`}>
                <ChoiceView type={cfg.type} n={n} picked={picked} onPick={pick} />
              </div>
              <div className="ch-fb tr-fb" aria-live="polite">
                {picked != null && (
                  <>
                    <p>
                      <b>{log[i].ok ? 'Верно.' : 'Не совсем.'}</b>{' '}
                      {log[i].ok && <span className="tr-pts">+{log[i].pts}</span>}{' '}
                      {(waiting || cfg.type === 'predict') && n.why}
                    </p>
                    {waiting && <button type="button" className="btn btn-primary" id="tr-next" ref={nextBtn} onClick={next}>{i + 1 >= total ? 'К результату' : 'Дальше'}<Icon name="arrow-right" size={17} /></button>}
                  </>
                )}
              </div>
              {t.note && <p className="play-note">{t.note}</p>}
            </div>
          )}

          {phase === 'end' && res && (
            <div className="pl-col tr-end">
              <Bolts n={res.bolts} size={52} pop />
              <div className="stack" style={{ gap: 10 }}>
                <p className="label pl-kicker">{res.newBest ? 'Новый рекорд' : 'Раунд завершён'}</p>
                <h1 className="h2" id="pl-h" tabIndex={-1} ref={endH}>{VERDICT[res.bolts]}</h1>
              </div>
              <div className="done-stats">
                <div className="stat"><b><CountUp value={res.score} ms={900} /></b><span>{plural(res.score, ['очко', 'очка', 'очков'])}</span></div>
                <div className="stat"><b>{res.right}</b><span>верно из {res.total}</span></div>
                <div className="stat"><b>{s.game.best[id] ? s.game.best[id].score : res.score}</b><span>лучший результат</span></div>
                <div className="stat stat-xp"><b>+{res.gain}</b><span>к опыту</span></div>
              </div>
              {res.daily && <div className="callout win"><Icon name="calendar-check" size={20} /><p><small>Тренировка дня</small>Все три раунда сыграны. За это ещё +{XP.daily} к опыту, а день засчитан в серию.</p></div>}
              {log.some(x => !x.ok) && (
                <div className="tr-review">
                  <h2 className="h4">Разбор ошибок</h2>
                  <ul>
                    {log.filter(x => !x.ok).map((x, k) => (
                      <li key={k}>
                        <p className="tr-rv-q">{x.n.stim.replace('___', '…')}</p>
                        <p className="tr-rv-a"><span className="bad"><Icon name="x" size={14} />{x.n.options[x.picked]}</span><span className="ok"><Icon name="check" size={14} />{x.n.options[x.n.correct]}</span></p>
                        <p className="tr-rv-w">{x.n.why}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="row">
                {daily && nextDaily
                  ? <Link className="btn btn-primary btn-lg" to={`/train/${nextDaily}?daily=1`}>Следующий раунд: {trainerOf(nextDaily).title}<Icon name="arrow-right" size={18} /></Link>
                  : <button type="button" className="btn btn-primary btn-lg" id="tr-again" onClick={start}><Icon name="rotate-ccw" size={18} />Ещё раунд</button>}
                {daily && nextDaily && <button type="button" className="btn btn-secondary btn-lg" id="tr-again" onClick={start}>Ещё раунд</button>}
                <Link className="btn btn-ghost btn-lg" to="/train">К тренажёрам</Link>
              </div>
              {lesson && <p className="muted" style={{ fontSize: 15 }}>Материал этого тренажёра: урок <Link to={`/courses/${lesson.slug}`}>«{lesson.title}»</Link>.</p>}
              <div style={{ width: '100%' }}><XpBar xp={xpOf(s)} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Trainer() {
  const { id } = useParams();
  const [params] = useSearchParams();
  if (!trainerOf(id)) return <NotFound />;
  return <Round id={id} daily={params.get('daily') === '1'} key={id} />;
}
