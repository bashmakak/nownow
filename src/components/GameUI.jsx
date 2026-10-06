import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COURSE_BY, minutes, pathOf } from '../data';
import { ROUND } from '../data/trainers.js';
import { useStore, update, status, streak, plural } from '../lib/store.js';
import { useUI } from '../lib/ui.jsx';
import { ACHIEVEMENTS, ACH_BY, REVIEW_MIN, dailyPlan, earned, earnedNow, levelOf, playedToday, reviewPool, stats, trainerOf, xpOf } from '../lib/game.js';
import { celebrate } from '../lib/fx.js';
import { Icon } from './Icon.jsx';

export const xpWord = n => `${n} ${plural(n, ['очко', 'очка', 'очков'])} опыта`;
export const boltWord = n => `${n} ${plural(n, ['молния', 'молнии', 'молний'])}`;

/* Число, которое докручивается до значения: для очков и опыта */
export function CountUp({ value, ms = 700 }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, b = value;
    if (a === b || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { from.current = b; setShown(b); return undefined; }
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (b - a) * e));
      if (k < 1) raf = requestAnimationFrame(tick); else from.current = b;
    });
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return shown;
}

/* Оценка раунда: от нуля до трёх молний */
export function Bolts({ n, size = 18, pop = false }) {
  return (
    <span className={`bolts ${pop ? 'pop' : ''}`} role="img" aria-label={`${boltWord(n)} из трёх`}>
      {[0, 1, 2].map(k => (
        <svg key={k} width={size} height={size} viewBox="0 0 100 100" className={k < n ? 'on' : ''} style={{ '--i': k }} aria-hidden="true">
          <use href="#nv-bolt-s" />
        </svg>
      ))}
    </span>
  );
}

/* Полоса опыта до следующего уровня */
export function XpBar({ xp }) {
  const lv = levelOf(xp);
  return (
    <div className="xpbar">
      <div className="xpbar-top"><b>Уровень {lv.level}</b><span>Опыт: <CountUp value={xp} /></span></div>
      <span className="bar bar-lg" role="img" aria-label={`До уровня ${lv.level + 1} осталось ${xpWord(lv.left)}`}><i style={{ width: `${Math.max(lv.pct, 3)}%` }} /></span>
      <p className="xpbar-note">До уровня {lv.level + 1} осталось {xpWord(lv.left)}</p>
    </div>
  );
}

/* Уровень и серия в шапке */
export function LevelChip() {
  const s = useStore();
  const xp = xpOf(s), lv = levelOf(xp), st = streak(s);
  const R = 15, C = 2 * Math.PI * R;
  return (
    <Link className="lvl" to="/me" aria-label={`Уровень ${lv.level}, ${xpWord(xp)}. Серия: ${st} ${plural(st, ['день', 'дня', 'дней'])}. Открыть кабинет`}>
      <span className="lvl-ring">
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r={R} className="lvl-track" />
          <circle cx="18" cy="18" r={R} className="lvl-fill" strokeDasharray={C} strokeDashoffset={C * (1 - lv.pct / 100)} />
        </svg>
        <b>{lv.level}</b>
      </span>
      <span className={`lvl-streak ${st ? 'on' : ''}`}><Icon name="flame" size={16} /><b>{st}</b></span>
    </Link>
  );
}

/* Следит за опытом и достижениями и сообщает о новом уровне и новой награде.
   При первом запуске всё уже заработанное считается показанным: о старых заслугах не объявляем. */
export function Rewards() {
  const s = useStore();
  const ui = useUI();
  const now = earnedNow(s), lvl = levelOf(xpOf(s)).level;
  const sig = `${now.join(',')}|${lvl}`;
  useEffect(() => {
    const g = s.game;
    if (!g.seen) { update(d => { d.game.seen = now; d.game.lvl = lvl; }); return; }
    const fresh = now.filter(id => !g.seen.includes(id));
    const up = lvl > (g.lvl || 1);
    if (!fresh.length && !up) return;
    update(d => { d.game.seen = [...new Set([...d.game.seen, ...now])]; d.game.lvl = Math.max(d.game.lvl || 1, lvl); });
    fresh.forEach(id => ui.toast({ icon: ACH_BY[id].icon, title: `Достижение: ${ACH_BY[id].title}`, text: ACH_BY[id].text, tone: 'win' }));
    if (up) { ui.toast({ icon: 'trophy', title: `Уровень ${lvl}`, text: 'Новый уровень', tone: 'win' }); celebrate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return null;
}

/* Сетка достижений: полученные и те, что впереди, с прогрессом */
const ACH_FIRST = 8;   // столько показываем сразу: полученные и ближайшие
export function Achievements() {
  const s = useStore();
  const [all, setAll] = useState(false);
  const st = stats(s), got = earned(s);
  const ratio = a => { const [n, need] = a.of(st); return got.includes(a.id) ? 2 : Math.min(n, need) / need; };
  const sorted = [...ACHIEVEMENTS].sort((a, b) => ratio(b) - ratio(a));
  const list = all ? sorted : sorted.slice(0, ACH_FIRST);
  return (
    <>
    <ul className="achs" id="achs">
      {list.map(a => {
        const on = got.includes(a.id), [n, need] = a.of(st), cur = Math.min(n, need);
        return (
          <li key={a.id} className={`ach ${on ? 'on' : ''}`}>
            <span className="ach-ic"><Icon name={a.icon} size={22} /></span>
            <span className="ach-body">
              <b>{a.title}</b>
              <span>{a.text}</span>
              {on
                ? <span className="ach-state"><Icon name="check" size={13} />Получено</span>
                : <span className="ach-prog"><span className="bar"><i style={{ width: `${Math.round(cur / need * 100)}%` }} /></span><span className="num">{cur} из {need}</span></span>}
            </span>
          </li>
        );
      })}
    </ul>
    {sorted.length > ACH_FIRST && (
      <div><button type="button" className="btn btn-ghost btn-sm" aria-expanded={all} aria-controls="achs" onClick={() => setAll(!all)}>{all ? 'Свернуть' : `Показать все ${sorted.length}`}</button></div>
    )}
    </>
  );
}
export const achievementCount = s => [earned(s).length, ACHIEVEMENTS.length];

/* Карточка тренажёра */
export function TrainerCard({ id, daily = false }) {
  const s = useStore();
  const t = trainerOf(id), b = s.game.best[id];
  const pool = id === 'review' ? reviewPool(s).length : null;
  const locked = id === 'review' && pool < REVIEW_MIN;
  const lesson = t.lesson && COURSE_BY[t.lesson];
  const body = (
    <>
      <span className="tcard-ic"><Icon name={t.icon} size={22} /></span>
      <span className="tcard-body">
        <b className="tcard-title">{t.title}</b>
        <span className="tcard-hook">{t.hook}</span>
        {lesson && <span className="tcard-from">По уроку «{lesson.title}»</span>}
        {locked && <span className="tcard-from">Откроется, когда вы пройдёте первый урок.</span>}
      </span>
      <span className="tcard-foot">
        <Bolts n={b ? b.bolts : 0} />
        <span className="tcard-best">{b ? <>Лучший результат: <b className="num">{b.score}</b></> : locked ? 'Пока закрыто' : 'Ещё не играли'}</span>
      </span>
    </>
  );
  if (locked) return <div className="tcard locked" data-trainer={id}>{body}</div>;
  return <Link className="tcard" to={`/train/${id}${daily ? '?daily=1' : ''}`} data-trainer={id}>{body}</Link>;
}

/* Тренировка дня: три тренажёра и сколько из них уже сыграно сегодня */
export function DailyPanel() {
  const s = useStore();
  const plan = dailyPlan(s), played = playedToday(s);
  const done = plan.filter(id => played.includes(id)).length, next = plan.find(id => !played.includes(id));
  return (
    <div className="daily theme-dark" id="daily">
      <div className="daily-main">
        <h2 className="h3">Тренировка дня</h2>
        <p>{next ? 'Три коротких раунда. Набор меняется каждый день, а день с тренировкой идёт в серию.' : 'На сегодня всё. Завтра будет новый набор.'}</p>
        <div className="daily-prog">
          <span className="daily-dots" role="img" aria-label={`Сыграно ${done} из ${plan.length}`}>{plan.map(id => <i key={id} className={played.includes(id) ? 'on' : ''} />)}</span>
          <span className="num">{done} из {plan.length}</span>
        </div>
        {next
          ? <Link className="btn btn-primary" to={`/train/${next}?daily=1`}><Icon name="play" size={17} />{done ? 'Продолжить тренировку' : 'Начать тренировку'}</Link>
          : <span className="badge"><Icon name="check" size={13} />Тренировка выполнена</span>}
      </div>
      <ol className="daily-list">
        {plan.map((id, k) => {
          const t = trainerOf(id), ok = played.includes(id);
          return (
            <li key={id} className={ok ? 'on' : id === next ? 'next' : ''}>
              <span className="daily-n">{ok ? <Icon name="check" size={16} /> : k + 1}</span>
              <span className="daily-t"><b>{t.title}</b><small>{ROUND} заданий</small></span>
              <Icon name={t.icon} size={20} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* Маршрут по теме: уроки по порядку, пройденные отмечены, следующий подсвечен */
export function PathMap({ topic }) {
  const s = useStore();
  const list = pathOf(topic);
  if (!list.length) return null;
  const st = list.map(c => status(s, c.slug));
  const done = st.filter(x => x === 'done').length;
  const at = st.findIndex(x => x !== 'done'), next = at < 0 ? null : list[at];
  return (
    <div className="path" id="path">
      <div className="path-head">
        <div>
          <h2 className="h3">Маршрут по теме</h2>
          <p>{next ? `Уроки идут от простого к сложному. Пройдено ${done} из ${list.length}.` : `Все ${list.length} уроков пройдены. Закрепите их в тренажёрах.`}</p>
        </div>
        {next
          ? <Link className="btn btn-primary" to={`/courses/${next.slug}`}>{done || st[at] === 'progress' ? 'Продолжить' : 'Начать'}: урок {at + 1}<Icon name="arrow-right" size={17} /></Link>
          : <Link className="btn btn-primary" to="/train">К тренажёрам<Icon name="arrow-right" size={17} /></Link>}
      </div>
      <ol className="path-row">
        {list.map((c, k) => (
          <li key={c.slug} className={st[k] === 'done' ? 'done' : k === at ? 'now' : ''}>
            <Link to={`/courses/${c.slug}`} aria-label={`Урок ${k + 1}: ${c.title}${st[k] === 'done' ? ', пройден' : k === at ? ', следующий' : ''}`}>
              <span className="path-node">{st[k] === 'done' ? <Icon name="check" size={16} /> : k + 1}</span>
              <span className="path-t">{c.title.split(':')[0]}</span>
              <span className="path-m">{minutes(c, 'short')} мин</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
