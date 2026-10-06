import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { useUI } from '../lib/ui.jsx';
import { plural } from '../lib/store.js';
import { XP, normalize, recordPlay, seeded, shuffle } from '../lib/game.js';
import { sparkFrom } from '../lib/fx.js';

/* ===== Интерактивные задания в уроке =====
   Задание описывается объектом в поле play блока урока. Виды:
     pick    — ситуация и варианты, нужно выбрать лучший:        { items: [{ q, options, correct, why }] }
     sort    — карточки раскладывают по двум корзинам:            { buckets: [а, б], items: [[текст, корзина, пояснение]] }
     label   — то же, но меток несколько:                         { labels: […], items: [[текст, метка, пояснение]] }
     predict — фраза с пропуском и слова с условной вероятностью: { items: [{ text, options: [[слово, %]], why }] }
     order   — шаги расставляют по порядку:                       { items: [шаги в верном порядке], why }
     spot    — в тексте отмечают нужные места:                    { mode: 'inline' | 'list', parts: [[текст, вид]], why }
               вид: 0 — обычный текст, 1 — то, что нужно найти, 2 — то, что отмечать не нужно
     temp    — ползунок температуры и примеры ответов:            { prompt, levels: [[название, описание, [ответы]]] }
     build   — запрос собирают из элементов:                      { task, parts: [[название, текст, что будет без него]], weak, result }
     window  — контекстное окно: что видит модель:                { messages: [[кто, текст, ключевое?]], question, seen, lost, why }
   У всех есть title, по желанию intro и note. */

const LETTERS = 'АБВГД';

/* Одно задание с выбором варианта. Общий вид для уроков и тренажёров.
   n — задание после normalize: { stim, options, correct, why, probs, from }; picked — выбранный вариант или null */
export function ChoiceView({ type, n, picked, onPick }) {
  const done = picked != null;
  const cls = i => (!done ? '' : i === n.correct ? 'ok' : i === picked ? 'bad' : 'dim');
  const mark = i => (done && i === n.correct ? <Icon name="check" size={16} /> : done && i === picked ? <Icon name="x" size={16} /> : null);
  const sr = i => (done && i === n.correct ? <span className="sr"> (верный ответ)</span> : null);
  if (type === 'predict') {
    const [head, tail = ''] = n.stim.split('___');
    return (
      <>
        <p className="ch-phrase">{head}<span className={`ch-gap ${done ? 'filled' : ''}`}>{done ? n.options[n.correct] : ' '}</span>{tail}</p>
        <div className="ch-words">
          {n.options.map((o, i) => (
            <button key={o} type="button" className={`ch-word ${cls(i)}`} disabled={done} aria-pressed={picked === i} onClick={e => onPick(i, e.currentTarget)}>
              <span className="ch-word-t">{o}{sr(i)}</span>
              {done && <><span className="ch-bar" aria-hidden="true"><i style={{ width: `${Math.max(n.probs[i], 1)}%` }} /></span><span className="ch-pct">{n.probs[i]} %</span></>}
            </button>
          ))}
        </div>
      </>
    );
  }
  if (type === 'pick') {
    return (
      <>
        {n.from && <p className="ch-from">Из урока «{n.from}»</p>}
        <p className="ch-q">{n.stim}</p>
        <div className="ch-list">
          {n.options.map((o, i) => (
            <button key={o} type="button" className={`ch-opt ${cls(i)}`} disabled={done} aria-pressed={picked === i} onClick={e => onPick(i, e.currentTarget)}>
              <span className="ch-key" aria-hidden="true">{mark(i) || LETTERS[i]}</span>
              <span>{o}{sr(i)}</span>
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="ch-card"><p>{n.stim}</p></div>
      <div className={`ch-buckets ${n.options.length > 2 ? 'many' : ''}`}>
        {n.options.map((o, i) => (
          <button key={o} type="button" className={`ch-bucket ${cls(i)}`} disabled={done} aria-pressed={picked === i} onClick={e => onPick(i, e.currentTarget)}>
            {mark(i)}<span>{o}{sr(i)}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* Точки хода: сколько заданий позади и как на них ответили */
export function Steps({ total, at, marks }) {
  return (
    <div className="play-steps" aria-hidden="true">
      {[...Array(total)].map((_, k) => <i key={k} className={marks[k] === true ? 'ok' : marks[k] === false ? 'bad' : k === at ? 'now' : ''} />)}
    </div>
  );
}

/* Серия заданий с выбором: по одному, с пояснением после ответа */
function ChoiceSet({ cfg, onDone }) {
  const total = cfg.items.length;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [marks, setMarks] = useState([]);
  const [end, setEnd] = useState(false);
  const nextBtn = useRef(null);
  const n = normalize(cfg, cfg.items[i]);
  const right = marks.filter(Boolean).length;
  useEffect(() => { if (picked != null) nextBtn.current?.focus({ preventScroll: true }); }, [picked]);
  const pick = (k, el) => { if (picked != null) return; setPicked(k); setMarks(m => [...m, k === n.correct]); if (k === n.correct) sparkFrom(el); };
  const next = () => {
    if (i + 1 >= total) { setEnd(true); onDone({ right, total }); } else { setI(i + 1); setPicked(null); }
  };
  const again = () => { setI(0); setPicked(null); setMarks([]); setEnd(false); };
  if (end) {
    return (
      <div className="play-end">
        <p className="play-score"><b>{right} из {total}</b> {right === total ? 'Всё верно.' : right >= total / 2 ? 'Хороший результат.' : 'Стоит вернуться к блоку выше и попробовать ещё раз.'}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={again}><Icon name="rotate-ccw" size={16} />Пройти ещё раз</button>
      </div>
    );
  }
  return (
    <>
      <Steps total={total} at={i} marks={marks} />
      <p className="sr">Задание {i + 1} из {total}</p>
      <div className="ch" key={i}><ChoiceView type={cfg.type} n={n} picked={picked} onPick={pick} /></div>
      <div className="ch-fb" aria-live="polite">
        {picked != null && (
          <>
            <p><b>{picked === n.correct ? 'Верно.' : 'Не совсем.'}</b> {n.why}</p>
            <button type="button" className="btn btn-secondary btn-sm" ref={nextBtn} onClick={next}>{i + 1 >= total ? 'Результат' : 'Следующее'}<Icon name="arrow-right" size={16} /></button>
          </>
        )}
      </div>
    </>
  );
}

/* Шаги расставляют по порядку: нажатие переносит шаг в конец своей последовательности */
function Order({ cfg, onDone }) {
  const n = cfg.items.length;
  // порядок, в котором шаги лежат в начале: один и тот же при каждом открытии и никогда не верный
  const pool = useMemo(() => {
    let p = shuffle([...Array(n).keys()], seeded(cfg.title));
    if (p.every((x, k) => x === k)) p = [...p.slice(1), p[0]];
    return p;
  }, [cfg.title, n]);
  const [order, setOrder] = useState([]);
  const [state, setState] = useState('edit'); // edit | wrong | right | shown
  const rest = pool.filter(x => !order.includes(x));
  const locked = state === 'right' || state === 'shown';
  const check = () => {
    const ok = order.every((x, k) => x === k);
    setState(ok ? 'right' : 'wrong');
    if (ok) onDone({ right: 1, total: 1 });
  };
  const show = () => { setOrder([...Array(n).keys()]); setState('shown'); onDone({ right: 0, total: 1 }); };
  const reset = () => { setOrder([]); setState('edit'); };
  return (
    <>
      <ol className="ord-seq" aria-label="Ваш порядок">
        {[...Array(n)].map((_, k) => {
          const x = order[k];
          if (x == null) return <li key={`e${k}`} className="ord-slot"><span className="ord-n">{k + 1}</span></li>;
          const mark = state === 'edit' ? '' : x === k ? 'ok' : 'bad';
          return (
            <li key={x}>
              <button type="button" className={`ord-item placed ${mark}`} disabled={locked}
                aria-label={`Шаг ${k + 1}: ${cfg.items[x]}. Убрать из последовательности`}
                onClick={() => { setOrder(order.filter(y => y !== x)); setState('edit'); }}>
                <span className="ord-n">{k + 1}</span><span>{cfg.items[x]}</span>{!locked && <Icon name="x" size={16} />}
              </button>
            </li>
          );
        })}
      </ol>
      {rest.length > 0 && (
        <div className="ord-pool" role="group" aria-label="Шаги, которые осталось расставить">
          {rest.map(x => (
            <button key={x} type="button" className="ord-item" onClick={() => setOrder([...order, x])}>
              <Icon name="plus" size={16} /><span>{cfg.items[x]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="ch-fb" aria-live="polite">
        {state === 'edit' && rest.length > 0 && <p className="play-hint">Нажимайте шаги в том порядке, в котором их нужно выполнять.</p>}
        {state === 'edit' && rest.length === 0 && <button type="button" className="btn btn-primary btn-sm" onClick={check}>Проверить порядок</button>}
        {state === 'wrong' && (
          <>
            <p><b>Не совсем.</b> Шаги, которые стоят не на своём месте, отмечены. Нажмите на шаг, чтобы убрать его, и поставьте заново.</p>
            <div className="row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={reset}><Icon name="rotate-ccw" size={16} />Начать заново</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={show}>Показать верный порядок</button>
            </div>
          </>
        )}
        {locked && (
          <>
            <p><b>{state === 'right' ? 'Верно.' : 'Верный порядок.'}</b> {cfg.why}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={reset}><Icon name="rotate-ccw" size={16} />Пройти ещё раз</button>
          </>
        )}
      </div>
    </>
  );
}

/* В тексте отмечают места, которые нужно найти */
function Spot({ cfg, onDone }) {
  const [sel, setSel] = useState([]);
  const [checked, setChecked] = useState(false);
  const targets = cfg.parts.map((p, k) => (p[1] === 1 ? k : -1)).filter(k => k >= 0);
  const found = sel.filter(k => targets.includes(k)).length, extra = sel.length - found;
  const toggle = k => { if (!checked) setSel(sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k]); };
  const check = () => { setChecked(true); onDone({ right: Math.max(0, found - extra), total: targets.length }); };
  const cls = (k, kind) => {
    const on = sel.includes(k);
    if (!checked) return on ? 'on' : '';
    return kind === 1 ? (on ? 'hit' : 'miss') : on ? 'wrong' : '';
  };
  const state = (k, kind) => (!checked ? null : kind === 1 ? (sel.includes(k) ? ' (найдено)' : ' (пропущено)') : sel.includes(k) ? ' (отмечать не нужно)' : null);
  // в списке фраза — кнопка; внутри текста — отрезок с ролью кнопки: настоящая кнопка не переносится по словам
  const row = (p, k) => (
    <button key={k} type="button" className={`spot-row ${cls(k, p[1])}`} aria-pressed={sel.includes(k)} disabled={checked} onClick={() => toggle(k)}>
      <span className="spot-box" aria-hidden="true">{sel.includes(k) || (checked && p[1] === 1) ? <Icon name={checked && p[1] !== 1 ? 'x' : 'check'} size={14} /> : null}</span>
      <span>{p[0]}{state(k, p[1]) && <span className="sr">{state(k, p[1])}</span>}</span>
    </button>
  );
  const frag = (p, k) => (
    <span key={k} role="button" tabIndex={checked ? -1 : 0} className={`spot-frag ${cls(k, p[1])}`} aria-pressed={sel.includes(k)} aria-disabled={checked || undefined}
      onClick={() => toggle(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(k); } }}>
      {p[0]}{state(k, p[1]) && <span className="sr">{state(k, p[1])}</span>}
    </span>
  );
  return (
    <>
      {cfg.mode === 'list'
        ? <ul className="spot-list">{cfg.parts.map((p, k) => <li key={k}>{row(p, k)}</li>)}</ul>
        : <p className="spot-text">{cfg.parts.map((p, k) => (p[1] === 0 ? <span key={k}>{p[0]}</span> : frag(p, k)))}</p>}
      <div className="ch-fb" aria-live="polite">
        {!checked && (
          <>
            <p className="play-hint">{sel.length ? `Отмечено: ${sel.length}` : cfg.mode === 'list' ? 'Нажмите на фразы, которые выбрали.' : 'Нажимайте на подчёркнутые места в тексте.'}</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={!sel.length} onClick={check}>Проверить</button>
          </>
        )}
        {checked && (
          <>
            <p><b>Найдено {found} из {targets.length}{extra > 0 ? `, лишних отметок: ${extra}` : ''}.</b> {cfg.why}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSel([]); setChecked(false); }}><Icon name="rotate-ccw" size={16} />Пройти ещё раз</button>
          </>
        )}
      </div>
    </>
  );
}

/* Ползунок температуры: чем выше, тем разнообразнее ответы */
function Temp({ cfg, onDone }) {
  const id = useId();
  const [v, setV] = useState(0);
  const seen = useRef(new Set([0]));
  const [label, desc, samples] = cfg.levels[v];
  const set = x => {
    setV(x);
    const before = seen.current.size;
    seen.current.add(x);
    if (before < cfg.levels.length && seen.current.size === cfg.levels.length) onDone({});
  };
  return (
    <>
      <div className="bubble u"><Icon name="send" size={16} /><span>{cfg.prompt}</span></div>
      <div className="rng">
        <label htmlFor={id}>Температура: <b>{label.toLowerCase()}</b></label>
        <input type="range" id={id} min={0} max={cfg.levels.length - 1} step={1} value={v} aria-valuetext={label} onChange={e => set(+e.target.value)} />
        <div className="rng-scale" aria-hidden="true">{cfg.levels.map(l => <span key={l[0]}>{l[0]}</span>)}</div>
      </div>
      <ul className="tmp-out" key={v} aria-live="polite">
        {samples.map((x, k) => <li key={k} style={{ '--i': k }}><small>Попытка {k + 1}</small>{x}</li>)}
      </ul>
      <p className="play-hint">{desc}</p>
    </>
  );
}

/* Сборка запроса: включённые элементы попадают в текст, отключённые объясняют, чего не хватит */
function Build({ cfg, onDone }) {
  const [on, setOn] = useState(() => cfg.parts.map(() => false));
  const count = on.filter(Boolean).length, total = cfg.parts.length, all = count === total;
  const toggle = k => {
    const next = on.map((x, i) => (i === k ? !x : x));
    setOn(next);
    if (next.every(Boolean) && !all) onDone({});
  };
  return (
    <>
      <div className="bld-toggles" role="group" aria-label="Элементы запроса">
        <span className="bld-tg fixed"><Icon name="check" size={15} />Задача</span>
        {cfg.parts.map(([label], k) => (
          <button key={label} type="button" className="bld-tg" aria-pressed={on[k]} onClick={() => toggle(k)}>
            <Icon name={on[k] ? 'check' : 'plus'} size={15} />{label}
          </button>
        ))}
      </div>
      <div className="bld-meter" role="img" aria-label={`В запросе ${count + 1} из ${total + 1} элементов`}>
        {[...Array(total + 1)].map((_, k) => <i key={k} className={k <= count ? 'on' : ''} />)}
      </div>
      <div className="bubble u col" aria-live="polite">
        <small>Ваш запрос</small>
        <p>
          {on[0] && <mark>{cfg.parts[0][1]} </mark>}
          {cfg.task}
          {cfg.parts.slice(1).map(([label, text], k) => (on[k + 1] ? <mark key={label}> {text}</mark> : null))}
        </p>
      </div>
      {all ? (
        <div className="bubble m ok col"><small>Ответ модели</small><p>{cfg.result}</p></div>
      ) : (
        <>
          {count === 0 && <div className="bubble m col"><small>Ответ модели</small><p>{cfg.weak}</p></div>}
          <ul className="bld-miss">
            {cfg.parts.map(([label, , miss], k) => (on[k] ? null : <li key={label}><b>Нет элемента «{label.toLowerCase()}».</b> {miss}</li>))}
          </ul>
        </>
      )}
    </>
  );
}

/* Контекстное окно: сообщения, которые не помещаются, модель не видит */
function Window({ cfg, onDone }) {
  const id = useId();
  const total = cfg.messages.length;
  const sizes = useMemo(() => { const out = []; for (let n = total; n >= 2; n -= 2) out.push(n); return out; }, [total]);
  const [k, setK] = useState(0);
  const fired = useRef(false);
  const size = sizes[k], from = total - size;
  const lost = cfg.messages.some((m, i) => m[2] && i < from);
  useEffect(() => { if (lost && !fired.current) { fired.current = true; onDone({}); } }, [lost, onDone]);
  return (
    <>
      <div className="rng">
        <label htmlFor={id}>В контекст помещается: <b>{size} {plural(size, ['сообщение', 'сообщения', 'сообщений'])} из {total}</b></label>
        <input type="range" id={id} min={0} max={sizes.length - 1} step={1} value={k} aria-valuetext={`${size} из ${total}`} onChange={e => setK(+e.target.value)} />
        <div className="rng-scale" aria-hidden="true"><span>Всё помещается</span><span>Окно заполнено</span></div>
      </div>
      <ol className="win-chat">
        {cfg.messages.map(([who, text, key], i) => (
          <li key={i} className={`bubble ${who} ${i < from ? 'out' : ''} ${key ? 'key' : ''}`}>
            <span className="sr">{who === 'u' ? 'Вы' : 'Модель'}{i < from ? ', вне контекста' : ''}: </span>
            <span>{text}</span>
            {key && <em>{i < from ? 'условие потеряно' : 'условие'}</em>}
          </li>
        ))}
        <li className="win-sep" aria-hidden="true">новый запрос</li>
        <li className="bubble u"><span className="sr">Вы: </span><span>{cfg.question}</span></li>
        <li className={`bubble m ${lost ? 'bad' : 'ok'}`} aria-live="polite"><span className="sr">Модель: </span><span>{lost ? cfg.lost : cfg.seen}</span></li>
      </ol>
      <p className="play-hint">{lost ? cfg.why : 'Пока первое сообщение помещается в окно, модель соблюдает условие. Сдвиньте ползунок.'}</p>
    </>
  );
}

const KINDS = { pick: ChoiceSet, sort: ChoiceSet, label: ChoiceSet, predict: ChoiceSet, order: Order, spot: Spot, temp: Temp, build: Build, window: Window };

/* Рамка задания в уроке. pk — ключ прогресса урока, kind — блок, в котором стоит задание, was — прошлый результат */
export function Play({ cfg, pk, kind, was }) {
  const ui = useUI();
  const Body = KINDS[cfg.type];
  const done = Boolean(was && was.done);
  if (!Body) return null;
  const onDone = res => {
    if (recordPlay(pk, kind, res || {})) ui.toast({ icon: 'zap', title: `+${XP.play} к опыту`, text: 'Задание выполнено' });
  };
  return (
    <section className={`play play-${cfg.type}`} aria-label={`Задание: ${cfg.title}`} data-play={kind}>
      <header className="play-head">
        <span className="play-tag"><Icon name="mouse-pointer-click" size={15} />Задание</span>
        {done && <span className="play-done"><Icon name="check" size={14} />Выполнено</span>}
      </header>
      <h2 className="play-title">{cfg.title}</h2>
      {cfg.intro && <p className="play-intro">{cfg.intro}</p>}
      <Body cfg={cfg} onDone={onDone} />
      {cfg.note && <p className="play-note">{cfg.note}</p>}
    </section>
  );
}
