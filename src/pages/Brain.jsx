import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAME_BY, SKILL_BY, gameBolts } from '../data/brain.js';
import { useStore, plural } from '../lib/store.js';
import { useTitle } from '../lib/ui.jsx';
import { XP, dailyPlan, playedToday, recordRound, shuffle, trainerOf, xpOf } from '../lib/game.js';
import { celebrate } from '../lib/fx.js';
import { Icon } from '../components/Icon.jsx';
import { Mark } from '../components/Brand.jsx';
import { Bolts, XpBar } from '../components/GameUI.jsx';
import '../brain.css';

/* ===== Мини-игры =====
   Каждая игра — компонент, который сам ведёт раунд и в конце вызывает onDone({ raw, score, lines }):
     raw   — результат в своих единицах (секунды, миллисекунды, клетки, очки): по нему считаются молнии;
     score — очки для сравнения попыток, больше — лучше;
     lines — две-три строки для экрана итога: [значение, подпись].
   onHud(text) показывает строку в шапке: «7 из 25», «Попытка 2 из 5».
   Описания игр и пороги молний — в src/data/brain.js. */

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pickOne = list => list[Math.floor(Math.random() * list.length)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/* Надбавка за скорость: полная при ответе не дольше fast мс, ноль — от slow мс */
const speed = (ms, fast, slow, max = 100) => Math.round(max * clamp(1 - (ms - fast) / (slow - fast)));
const comma = (v, d = 1) => v.toFixed(d).replace('.', ',');

/* Таймеры игры снимаются, когда человек уходит со страницы */
function useTimers() {
  const list = useRef([]);
  useEffect(() => () => list.current.forEach(clearTimeout), []);
  return useCallback((fn, ms) => { const id = setTimeout(fn, ms); list.current.push(id); return id; }, []);
}
/* Клавиши игры; не срабатывают, пока открыт диалог */
function useKeys(handler) {
  const live = useRef(handler);
  live.current = handler;
  useEffect(() => {
    const onKey = e => { if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || document.querySelector('dialog[open]')) return; live.current(e); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

/* ---------- Таблица Шульте ---------- */
function Schulte({ onDone, onHud }) {
  const SIZE = 25;
  const nums = useMemo(() => shuffle([...Array(SIZE)].map((_, i) => i + 1)), []);
  const [next, setNext] = useState(1);
  const [bad, setBad] = useState(0);
  const [now, setNow] = useState(0);
  const t0 = useRef(performance.now()), errs = useRef(0);
  const later = useTimers();
  useEffect(() => { const id = setInterval(() => setNow(performance.now() - t0.current), 100); return () => clearInterval(id); }, []);
  useEffect(() => { onHud(`${next - 1} из ${SIZE}`); }, [next, onHud]);
  const tap = n => {
    if (n === next) {
      if (n < SIZE) { setNext(n + 1); return; }
      const raw = Math.round(((performance.now() - t0.current) / 1000 + errs.current) * 10) / 10;
      onDone({ raw, score: Math.max(50, Math.round(3000 - raw * 40)), lines: [[errs.current, plural(errs.current, ['ошибка', 'ошибки', 'ошибок'])]] });
    } else if (n > next) { errs.current++; setBad(n); later(() => setBad(0), 320); }
  };
  return (
    <div className="bg bg-schulte">
      <p className="bg-ask">Найдите <b className="num" id="bg-target">{next}</b><span className="bg-clock num">{comma(now / 1000 + errs.current)} с</span></p>
      <div className="sch" role="group" aria-label="Таблица чисел">
        {nums.map(n => (
          <button key={n} type="button" className={`sch-cell ${n < next ? 'done' : ''} ${n === bad ? 'bad' : ''}`} data-n={n} disabled={n < next} onClick={() => tap(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Цвет и слово ---------- */
const INKS = [['red', 'КРАСНЫЙ', '#FF6B6B'], ['blue', 'СИНИЙ', '#5AA9FF'], ['green', 'ЗЕЛЁНЫЙ', '#2ED3A0'], ['yellow', 'ЖЁЛТЫЙ', '#FFD84D']];
function Stroop({ onDone, onHud }) {
  const N = 20;
  // половина слов совпадает с цветом, половина нет; порядок случайный
  const trials = useMemo(() => shuffle([...Array(N)].map((_, i) => {
    const word = rand(0, 3);
    return { word, ink: i % 2 ? word : pickOne([0, 1, 2, 3].filter(k => k !== word)) };
  })), []);
  const [i, setI] = useState(0);
  const [fb, setFb] = useState(null);       // 'ok' | 'bad' после ответа
  const log = useRef([]), t0 = useRef(performance.now());
  const later = useTimers();
  useEffect(() => { onHud(`${Math.min(i + 1, N)} из ${N}`); t0.current = performance.now(); }, [i, onHud]);
  const t = trials[i];
  const answer = yes => {
    if (fb || !t) return;
    const ms = performance.now() - t0.current, ok = yes === (t.word === t.ink);
    log.current.push({ ok, ms });
    setFb(ok ? 'ok' : 'bad');
    later(() => {
      setFb(null);
      if (log.current.length < N) { setI(log.current.length); return; }
      const L = log.current, right = L.filter(x => x.ok).length;
      // ошибка стоит столько же, сколько даёт верный ответ: отвечать наугад невыгодно
      const score = Math.max(0, L.reduce((sum, x) => sum + (x.ok ? 100 + speed(x.ms, 500, 2500) : -100), 0));
      const avg = L.reduce((sum, x) => sum + x.ms, 0) / N / 1000;
      onDone({ raw: score, score, lines: [[`${right} из ${N}`, 'верных ответов'], [`${comma(avg, 2)} с`, 'в среднем на слово']] });
    }, ok ? 260 : 620);
  };
  useKeys(e => { if (e.key === 'ArrowLeft') { e.preventDefault(); answer(true); } else if (e.key === 'ArrowRight') { e.preventDefault(); answer(false); } });
  return (
    <div className="bg bg-stroop">
      <p className="bg-ask">Цвет букв совпадает со словом?</p>
      <div className={`stp-card theme-dark ${fb || ''}`} key={i}>
        <span className="stp-word" id="stp-word" data-word={INKS[t.word][0]} data-ink={INKS[t.ink][0]} style={{ color: INKS[t.ink][2] }}>{INKS[t.word][1]}</span>
      </div>
      <div className="bg-two">
        <button type="button" className="btn btn-secondary btn-lg" id="bg-yes" disabled={Boolean(fb)} onClick={() => answer(true)}><kbd aria-hidden="true">←</kbd>Да</button>
        <button type="button" className="btn btn-secondary btn-lg" id="bg-no" disabled={Boolean(fb)} onClick={() => answer(false)}>Нет<kbd aria-hidden="true">→</kbd></button>
      </div>
    </div>
  );
}

/* ---------- Лишний знак ---------- */
const PAIRS = [['О', '0'], ['Б', 'В'], ['Ш', 'Щ'], ['И', 'Й'], ['З', 'Э'], ['6', '9'], ['Е', 'Ё'], ['Ц', 'Ч'], ['Ь', 'Ъ'], ['3', '8'], ['Л', 'П'], ['Х', 'Ж'], ['1', '7'], ['У', 'Ч'], ['Р', 'Ф'], ['Т', 'Г']];
function Odd({ onDone, onHud }) {
  const N = 12, LIMIT = 10000;
  const rounds = useMemo(() => shuffle(PAIRS).slice(0, N).map((p, k) => {
    const side = k < 4 ? 4 : k < 8 ? 5 : 6, [a, b] = Math.random() < 0.5 ? p : [p[1], p[0]];
    return { side, base: a, odd: b, at: rand(0, side * side - 1) };
  }), []);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(null);     // после ответа: { picked, ok }
  const log = useRef([]), t0 = useRef(performance.now()), limit = useRef(0);
  const later = useTimers();
  const r = rounds[i];
  const close = (picked) => {
    if (shown) return;
    clearTimeout(limit.current);
    const ms = performance.now() - t0.current, ok = picked === r.at;
    log.current.push({ ok, ms });
    setShown({ picked, ok });
    later(() => {
      setShown(null);
      if (log.current.length < N) { setI(log.current.length); return; }
      const L = log.current, right = L.filter(x => x.ok).length;
      const score = L.reduce((sum, x) => sum + (x.ok ? 100 + speed(x.ms, 1000, 8000) : 0), 0);
      const found = L.filter(x => x.ok), avg = found.length ? found.reduce((sum, x) => sum + x.ms, 0) / found.length / 1000 : 0;
      onDone({ raw: score, score, lines: [[`${right} из ${N}`, 'найдено'], [found.length ? `${comma(avg)} с` : '—', 'в среднем на поиск']] });
    }, ok ? 320 : 900);
  };
  const live = useRef(close);
  live.current = close;
  useEffect(() => {
    onHud(`${i + 1} из ${N}`);
    t0.current = performance.now();
    limit.current = setTimeout(() => live.current(-1), LIMIT);      // время вышло: показываем, где был знак
    return () => clearTimeout(limit.current);
  }, [i, onHud]);
  return (
    <div className="bg bg-odd">
      <p className="bg-ask">Найдите знак, который отличается</p>
      <div className={`odd odd-${r.side}`} key={i} role="group" aria-label="Поле знаков" style={{ '--side': r.side }}>
        {[...Array(r.side * r.side)].map((_, k) => (
          <button key={k} type="button" data-odd={k === r.at ? '' : undefined} disabled={Boolean(shown)}
            className={`odd-cell ${shown && k === r.at ? 'ok' : ''} ${shown && k === shown.picked && !shown.ok ? 'bad' : ''}`} onClick={() => close(k)}>{k === r.at ? r.odd : r.base}</button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Реакция ---------- */
function React5({ onDone, onHud }) {
  const N = 5, SLOW = 1500;
  const [st, setSt] = useState('wait');      // wait | go | hit | early | slow
  const [last, setLast] = useState(0);
  const times = useRef([]), early = useRef(0), t0 = useRef(0), timer = useRef(0);
  const later = useTimers();
  const arm = useCallback(() => {
    setSt('wait');
    timer.current = setTimeout(() => {
      t0.current = performance.now(); setSt('go');
      timer.current = setTimeout(() => { times.current.push(SLOW); setLast(SLOW); setSt('slow'); }, SLOW);   // не нажали вовсе
    }, rand(1200, 3600));
  }, []);
  useEffect(() => { arm(); return () => clearTimeout(timer.current); }, [arm]);
  useEffect(() => { onHud(`Попытка ${Math.min(times.current.length + 1, N)} из ${N}`); }, [st, onHud]);
  // после попытки: следующая или итог
  useEffect(() => {
    if (st !== 'hit' && st !== 'slow' && st !== 'early') return;
    later(() => {
      if (st === 'early' || times.current.length < N) { arm(); return; }
      const T = times.current, raw = Math.round(T.reduce((a, b) => a + b, 0) / N);
      onDone({ raw, score: Math.max(50, Math.round(1600 - raw * 3)), lines: [[`${Math.min(...T)} мс`, 'лучшая попытка'], [early.current, plural(early.current, ['фальстарт', 'фальстарта', 'фальстартов'])]] });
    }, st === 'early' ? 1100 : 950);
  }, [st, arm, later, onDone]);
  const press = () => {
    if (st === 'go') { clearTimeout(timer.current); const ms = Math.round(performance.now() - t0.current); times.current.push(ms); setLast(ms); setSt('hit'); }
    else if (st === 'wait') { clearTimeout(timer.current); early.current++; setSt('early'); }
  };
  useKeys(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } });
  const text = { wait: 'Ждите…', go: 'Жмите!', hit: `${last} мс`, early: 'Рано. Дождитесь сигнала', slow: 'Слишком долго' }[st];
  return (
    <div className="bg bg-react">
      <p className="bg-ask">Нажмите, как только поле станет ярким</p>
      <div className="rx-pad" id="rx-pad" role="button" tabIndex={0} data-state={st} aria-live="assertive" onPointerDown={e => { e.preventDefault(); press(); }}>
        <span className="rx-text">{text}</span>
        {st === 'wait' && <span className="rx-sub">Не нажимайте раньше времени</span>}
      </div>
    </div>
  );
}

/* ---------- Сигнал: круг — нажать, квадрат — нет ---------- */
function GoNoGo({ onDone, onHud }) {
  const N = 24, SHOW = 900;
  // 7 квадратов из 24, не больше двух подряд и не первым
  const plan = useMemo(() => {
    for (;;) {
      const p = shuffle([...Array(N)].map((_, k) => (k < 7 ? 'nogo' : 'go')));
      if (p[0] === 'go' && !p.some((x, k) => x === 'nogo' && p[k + 1] === 'nogo' && p[k + 2] === 'nogo')) return p;
    }
  }, []);
  const [i, setI] = useState(0);
  const [st, setSt] = useState('gap');      // gap | show | ok | bad
  // два таймера: пауза перед сигналом и время, пока сигнал на экране
  const log = useRef([]), t0 = useRef(0), gap = useRef(0), shown = useRef(0);
  const later = useTimers();
  const kind = plan[i];
  useEffect(() => () => { clearTimeout(gap.current); clearTimeout(shown.current); }, []);
  const close = useCallback(entry => {
    clearTimeout(shown.current);
    log.current.push(entry);
    setSt(entry.ok ? 'ok' : 'bad');
    later(() => {
      if (log.current.length < N) { setI(log.current.length); setSt('gap'); return; }
      const L = log.current;
      // лишнее нажатие стоит дорого: нажимать на всё подряд невыгодно
      const score = Math.max(0, L.reduce((sum, x) => sum + (x.kind === 'go' ? (x.ok ? 100 + speed(x.ms, 250, 900) : 0) : (x.ok ? 130 : -200)), 0));
      const hits = L.filter(x => x.kind === 'go' && x.ok), alarms = L.filter(x => x.kind === 'nogo' && !x.ok).length;
      const avg = hits.length ? Math.round(hits.reduce((sum, x) => sum + x.ms, 0) / hits.length) : 0;
      onDone({ raw: score, score, lines: [[`${hits.length} из ${N - 7}`, 'кругов поймано'], [alarms, plural(alarms, ['лишнее нажатие', 'лишних нажатия', 'лишних нажатий'])], [hits.length ? `${avg} мс` : '—', 'средняя реакция']] });
    }, 330);
  }, [later, onDone]);
  useEffect(() => {
    if (st !== 'gap') return undefined;
    onHud(`${i + 1} из ${N}`);
    gap.current = setTimeout(() => {
      t0.current = performance.now(); setSt('show');
      shown.current = setTimeout(() => close({ kind: plan[i], ok: plan[i] === 'nogo', ms: SHOW }), SHOW);     // не нажали
    }, rand(550, 1100));
    return () => clearTimeout(gap.current);
  }, [i, st, plan, close, onHud]);
  const press = () => { if (st === 'show') close({ kind, ok: kind === 'go', ms: performance.now() - t0.current }); };
  useKeys(e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(); } });
  return (
    <div className="bg bg-gng">
      <p className="bg-ask">Круг — нажимайте. Квадрат — не трогайте</p>
      <div className="gng-pad" id="gng-pad" role="button" tabIndex={0} data-state={st} data-kind={st === 'gap' ? undefined : kind} onPointerDown={e => { e.preventDefault(); press(); }}>
        {st !== 'gap' && <span className={`gng-shape ${kind}`} aria-label={kind === 'go' ? 'Круг' : 'Квадрат'} />}
      </div>
    </div>
  );
}

/* ---------- Матрица ---------- */
function Matrix({ onDone, onHud }) {
  const MAX = 12, LIVES = 2;
  const sideOf = k => (k <= 4 ? 3 : k <= 6 ? 4 : 5);
  const make = k => new Set(shuffle([...Array(sideOf(k) ** 2)].map((_, x) => x)).slice(0, k));
  const [k, setK] = useState(3);
  const [cells, setCells] = useState(() => make(3));
  const [st, setSt] = useState('show');     // show | input | ok | bad
  const [picked, setPicked] = useState(() => new Set());
  const [miss, setMiss] = useState(-1);
  const errs = useRef(0), best = useRef(0), sum = useRef(0);
  const later = useTimers();
  useEffect(() => { onHud(`${k} ${plural(k, ['клетка', 'клетки', 'клеток'])} · ошибок ${errs.current} из ${LIVES}`); }, [k, st, onHud]);
  useEffect(() => { if (st === 'show') later(() => setSt('input'), 900 + k * 190); }, [st, cells, k, later]);
  const round = n => { setK(n); setCells(make(n)); setPicked(new Set()); setMiss(-1); setSt('show'); };
  const finish = () => { const sd = sideOf(Math.max(best.current, 3)); onDone({ raw: best.current, score: sum.current, lines: [[`${sd}×${sd}`, 'последнее поле']] }); };
  const tap = x => {
    if (st !== 'input' || picked.has(x)) return;
    if (!cells.has(x)) {
      errs.current++; setMiss(x); setSt('bad');
      later(() => (errs.current >= LIVES ? finish() : round(k)), 1300);
      return;
    }
    const next = new Set(picked).add(x);
    setPicked(next);
    if (next.size === k) {
      best.current = k; sum.current += k * 100; setSt('ok');
      later(() => (k >= MAX ? finish() : round(k + 1)), 650);
    }
  };
  const side = sideOf(k);
  return (
    <div className="bg bg-matrix">
      <p className="bg-ask" id="mx-ask" data-state={st}>{st === 'show' ? 'Запоминайте' : st === 'input' ? `Отметьте ${k} ${plural(k, ['клетку', 'клетки', 'клеток'])}` : st === 'ok' ? 'Верно' : 'Не та клетка'}</p>
      <div className="mx" style={{ '--side': side }} role="group" aria-label="Поле">
        {[...Array(side * side)].map((_, x) => {
          const lit = (st === 'show' || st === 'bad') && cells.has(x);
          return <button key={x} type="button" disabled={st !== 'input'} aria-pressed={picked.has(x)} data-lit={lit ? '' : undefined}
            className={`mx-cell ${lit ? 'lit' : ''} ${picked.has(x) ? 'on' : ''} ${x === miss ? 'bad' : ''}`} onClick={() => tap(x)}><span className="sr">Клетка {x + 1}</span></button>;
        })}
      </div>
    </div>
  );
}

/* ---------- Ряд цифр ---------- */
function Digits({ onDone, onHud }) {
  const MAX = 10, LIVES = 2, ON = 800, OFF = 260;
  const make = n => { const out = []; while (out.length < n) { const d = rand(0, 9); if (d !== out[out.length - 1]) out.push(d); } return out; };
  const [n, setN] = useState(4);
  const [seq, setSeq] = useState(() => make(4));
  const [st, setSt] = useState('show');     // show | input | ok | bad
  const [at, setAt] = useState(-1);         // какая цифра сейчас на экране; -1 — пауза
  const [typed, setTyped] = useState([]);
  const errs = useRef(0), best = useRef(0), sum = useRef(0);
  const later = useTimers();
  useEffect(() => { onHud(`${n} ${plural(n, ['цифра', 'цифры', 'цифр'])} · ошибок ${errs.current} из ${LIVES}`); }, [n, st, onHud]);
  // показ: цифры по одной с короткой паузой
  useEffect(() => {
    if (st !== 'show') return;
    seq.forEach((_, k) => { later(() => setAt(k), 500 + k * (ON + OFF)); later(() => setAt(-1), 500 + k * (ON + OFF) + ON); });
    later(() => setSt('input'), 500 + seq.length * (ON + OFF));
  }, [st, seq, later]);
  const round = len => { setN(len); setSeq(make(len)); setTyped([]); setAt(-1); setSt('show'); };
  const finish = () => onDone({ raw: best.current, score: sum.current, lines: [[errs.current, plural(errs.current, ['ошибка', 'ошибки', 'ошибок'])]] });
  const key = d => {
    if (st !== 'input') return;
    const next = [...typed, d];
    setTyped(next);
    if (next.length < n) return;
    if (next.every((x, k) => x === seq[k])) {
      best.current = n; sum.current += n * 100; setSt('ok');
      later(() => (n >= MAX ? finish() : round(n + 1)), 700);
    } else {
      errs.current++; setSt('bad');
      later(() => (errs.current >= LIVES ? finish() : round(n)), 1700);
    }
  };
  const back = () => { if (st === 'input') setTyped(t => t.slice(0, -1)); };
  useKeys(e => { if (/^[0-9]$/.test(e.key)) { e.preventDefault(); key(+e.key); } else if (e.key === 'Backspace') { e.preventDefault(); back(); } });
  return (
    <div className="bg bg-digits">
      <p className="bg-ask" id="dg-ask" data-state={st}>{st === 'show' ? 'Запоминайте' : st === 'input' ? 'Повторите ряд' : st === 'ok' ? 'Верно' : 'Было так'}</p>
      {st === 'show'
        ? <div className="dg-show theme-dark" id="dg-show" data-digit={at >= 0 ? seq[at] : undefined} aria-live="off"><span className="num" key={at}>{at >= 0 ? seq[at] : ''}</span></div>
        : (
          <div className={`dg-slots ${st}`} id="dg-slots" aria-label="Введённые цифры">
            {seq.map((d, k) => <span key={k} className={`num ${typed[k] != null || st === 'bad' ? 'on' : ''}`}>{st === 'bad' ? d : typed[k] != null ? typed[k] : ''}</span>)}
          </div>
        )}
      <div className="dg-pad" role="group" aria-label="Цифры">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => <button key={d} type="button" className="dg-key num" data-d={d} disabled={st !== 'input'} onClick={() => key(d)}>{d}</button>)}
        <span />
        <button type="button" className="dg-key num" data-d={0} disabled={st !== 'input'} onClick={() => key(0)}>0</button>
        <button type="button" className="dg-key" aria-label="Стереть" disabled={st !== 'input' || !typed.length} onClick={back}><Icon name="delete" size={22} /></button>
      </div>
    </div>
  );
}

/* ---------- Быстрый счёт ---------- */
function makeSum(level) {
  let a, b, op, val;
  const kind = level >= 2 && Math.random() < 0.4 ? '×' : Math.random() < 0.5 ? '+' : '−';
  if (kind === '×') { a = rand(2, level >= 3 ? 12 : 9); b = rand(2, 9); op = '×'; val = a * b; }
  else {
    const top = [12, 40, 70, 99][Math.min(level, 3)];
    a = rand(level ? 11 : 3, top); b = rand(2, level >= 2 ? Math.min(a, 49) : 9);
    if (kind === '−' && b > a) [a, b] = [b, a];
    op = kind; val = kind === '+' ? a + b : a - b;
  }
  const ok = Math.random() < 0.5;
  // неверный ответ отличается чуть-чуть: на 1, 2 или 10
  let shown = val;
  if (!ok) { do { shown = val + pickOne([-10, -2, -1, 1, 2, 10]); } while (shown < 0 || shown === val); }
  return { text: `${a} ${op} ${b} = ${shown}`, ok };
}
function Count({ onDone, onHud }) {
  const TIME = 45;
  const [q, setQ] = useState(() => makeSum(0));
  const [fb, setFb] = useState(null);
  const [left, setLeft] = useState(TIME);
  const right = useRef(0), wrong = useRef(0), t0 = useRef(performance.now()), over = useRef(false);
  const later = useTimers();
  const live = useRef(onDone);
  live.current = onDone;
  useEffect(() => {
    const id = setInterval(() => {
      const rest = TIME - (performance.now() - t0.current) / 1000;
      setLeft(Math.max(0, rest));
      if (rest <= 0 && !over.current) {
        over.current = true; clearInterval(id);
        const raw = Math.max(0, right.current - wrong.current);
        live.current({ raw, score: raw * 100, lines: [[right.current, plural(right.current, ['верный ответ', 'верных ответа', 'верных ответов'])], [wrong.current, plural(wrong.current, ['ошибка', 'ошибки', 'ошибок'])]] });
      }
    }, 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { onHud(`Счёт: ${Math.max(0, right.current - wrong.current)}`); }, [q, fb, onHud]);
  const answer = yes => {
    if (fb || over.current) return;
    const ok = yes === q.ok;
    if (ok) right.current++; else wrong.current++;
    setFb(ok ? 'ok' : 'bad');
    // после ошибки короткая пауза: нажимать наугад невыгодно
    later(() => { setFb(null); setQ(makeSum(Math.floor(right.current / 5))); }, ok ? 140 : 650);
  };
  useKeys(e => { if (e.key === 'ArrowLeft') { e.preventDefault(); answer(true); } else if (e.key === 'ArrowRight') { e.preventDefault(); answer(false); } });
  return (
    <div className="bg bg-count">
      <p className="bg-ask">Равенство верное?<span className="bg-clock num" id="ct-left">{Math.ceil(left)} с</span></p>
      <span className="ct-bar" aria-hidden="true"><i style={{ transform: `scaleX(${left / TIME})` }} /></span>
      <div className={`ct-card ${fb || ''}`}><span className="num" id="ct-q" data-ok={q.ok ? '1' : '0'}>{q.text}</span></div>
      <div className="bg-two">
        <button type="button" className="btn btn-secondary btn-lg" id="bg-yes" disabled={Boolean(fb)} onClick={() => answer(true)}><kbd aria-hidden="true">←</kbd>Верно</button>
        <button type="button" className="btn btn-secondary btn-lg" id="bg-no" disabled={Boolean(fb)} onClick={() => answer(false)}>Неверно<kbd aria-hidden="true">→</kbd></button>
      </div>
    </div>
  );
}

const PLAY = { 'g-schulte': Schulte, 'g-stroop': Stroop, 'g-odd': Odd, 'g-react': React5, 'g-gonogo': GoNoGo, 'g-matrix': Matrix, 'g-digits': Digits, 'g-count': Count };

/* ---------- экран раунда: вступление, игра, итог ---------- */
const VERDICT = ['Есть куда расти', 'Неплохо', 'Хороший результат', 'Отличный результат'];
/* Что нужно для следующей молнии */
function nextGoal(g, bolts) {
  if (bolts >= 3) return null;
  const t = g.bolts[bolts];
  return `До ${['первой молнии', 'двух молний', 'трёх молний'][bolts]}: ${g.lower ? 'не больше' : 'не меньше'} ${g.fmt(t)}`;
}

export default function GameRound({ id, daily }) {
  const g = GAME_BY[id];
  useTitle(g.title);
  const s = useStore();
  const [phase, setPhase] = useState('intro');    // intro | play | end
  const [run, setRun] = useState(0);
  const [hud, setHud] = useState('');
  const [res, setRes] = useState(null);
  const startBtn = useRef(null), endH = useRef(null);
  const best = s.game.best[id];
  const Game = PLAY[id];
  useEffect(() => { if (phase === 'intro') startBtn.current?.focus({ preventScroll: true }); if (phase === 'end') endH.current?.focus({ preventScroll: true }); window.scrollTo(0, 0); }, [phase]);
  const start = () => { setRes(null); setHud(''); setRun(r => r + 1); setPhase('play'); };
  const done = useCallback(out => {
    const bolts = gameBolts(g, out.raw);
    const rec = recordRound(id, { score: out.score, bolts, raw: out.raw });
    setRes({ ...out, ...rec, bolts });
    setPhase('end');
    if (bolts === 3) celebrate();
  }, [g, id]);
  const plan = dailyPlan(s), played = playedToday(s), nextDaily = plan.find(x => !played.includes(x));
  const dailyAt = plan.indexOf(id);
  const goal = res && nextGoal(g, res.bolts);

  return (
    <div className="player trainer brain" data-phase={phase} data-game={id}>
      <header className="pl-top">
        <div className="wrap">
          <div className="pl-top-row">
            <Link className="icon-btn" to="/train" aria-label="Выйти из игры"><Icon name="x" /></Link>
            <div className="pl-title"><Mark size={20} /><span>{g.title}</span></div>
            <div className="tr-score bg-hud" id="bg-hud" aria-live="off">{phase === 'play' && hud}</div>
          </div>
        </div>
      </header>

      <div className="pl-main">
        <div className="wrap">
          {phase === 'intro' && (
            <div className="pl-col tr-intro">
              <span className="tr-ic"><Icon name={g.icon} size={30} /></span>
              <p className="label pl-kicker">{daily && dailyAt >= 0 ? `Тренировка дня · раунд ${dailyAt + 1} из ${plan.length}` : `${SKILL_BY[g.skill].title} · ${g.time}`}</p>
              <h1 className="h2" id="pl-h">{g.title}</h1>
              <p className="pl-intro">{g.hook}</p>
              <ul className="tr-facts">
                {g.how.map((line, k) => <li key={k}><Icon name={['play', 'eye', 'zap'][k] || 'check'} size={18} /><span>{line}</span></li>)}
              </ul>
              {g.note && <p className="play-note">{g.note}</p>}
              {best && <p className="tr-best"><Bolts n={best.bolts} /><span>Лучший результат: <b className="num">{g.fmt(best.raw)}</b></span></p>}
              <div className="row"><button type="button" className="btn btn-primary btn-lg" id="tr-start" ref={startBtn} onClick={start}><Icon name="play" size={18} />Начать</button></div>
            </div>
          )}

          {phase === 'play' && <div className="pl-col bg-stage" key={run}><Game onDone={done} onHud={setHud} /></div>}

          {phase === 'end' && res && (
            <div className="pl-col tr-end">
              <Bolts n={res.bolts} size={52} pop />
              <div className="stack" style={{ gap: 10 }}>
                <p className="label pl-kicker">{res.newBest ? 'Новый рекорд' : 'Раунд завершён'}</p>
                <h1 className="h2" id="pl-h" tabIndex={-1} ref={endH}>{VERDICT[res.bolts]}</h1>
              </div>
              <div className="done-stats">
                <div className="stat"><b id="bg-raw">{g.fmt(res.raw)}</b><span>{g.unit}</span></div>
                {res.lines.slice(0, 1).map(([v, label]) => <div className="stat" key={label}><b>{v}</b><span>{label}</span></div>)}
                <div className="stat"><b>{g.fmt(s.game.best[id] ? s.game.best[id].raw : res.raw)}</b><span>лучший результат</span></div>
                <div className="stat stat-xp"><b>+{res.gain}</b><span>к опыту</span></div>
              </div>
              {res.lines.length > 1 && <p className="muted bg-more">{res.lines.slice(1).map(([v, label]) => `${v} ${label}`).join(' · ')}</p>}
              {goal && <p className="bg-goal"><Icon name="target" size={18} /><span>{goal}</span></p>}
              {res.gain === 0 && <p className="muted" style={{ fontSize: 15 }}>Опыт за эту игру сегодня уже получен. Ещё раз он начислится за новый рекорд или завтра.</p>}
              {res.daily && <div className="callout win"><Icon name="calendar-check" size={20} /><p><small>Тренировка дня</small>Все три раунда сыграны. За это ещё +{XP.daily} к опыту, а день засчитан в серию.</p></div>}
              <div className="row">
                {daily && nextDaily
                  ? <Link className="btn btn-primary btn-lg" to={`/train/${nextDaily}?daily=1`}>Следующий раунд: {trainerOf(nextDaily).title}<Icon name="arrow-right" size={18} /></Link>
                  : <button type="button" className="btn btn-primary btn-lg" id="tr-again" onClick={start}><Icon name="rotate-ccw" size={18} />Ещё раз</button>}
                {daily && nextDaily && <button type="button" className="btn btn-secondary btn-lg" id="tr-again" onClick={start}>Ещё раз</button>}
                <Link className="btn btn-ghost btn-lg" to="/train">К тренажёрам</Link>
              </div>
              <div style={{ width: '100%' }}><XpBar xp={xpOf(s)} /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
