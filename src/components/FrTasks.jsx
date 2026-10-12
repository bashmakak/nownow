import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/speech.js';
import { analyzeLine } from '../lib/pitch.js';
import { micSupported, useRecorder } from './ToneMic.jsx';
import { frPlain, latinOf, textLang } from '../lib/fr-data.js';
import { sparkFrom } from '../lib/fx.js';
import { Icon } from './Icon.jsx';
import { FrText } from './FrDemos.jsx';

/* ===== Задания курсов на латинице (французский, испанский) =====
   silent — отметить немые буквы; liaison — поставить дужки там, где слова связываются;
   dictee — написать услышанное слово; sort — разложить слова по двум группам.
   Задания собирает lib/lang-engine.js; ответ проверяется здесь и передаётся в плеер через onAnswer(ok). */

export const FR_TASKS = ['silent', 'liaison', 'dictee', 'sort', 'route', 'digits', 'body', 'board', 'speakLine', 'order'];
const say = (text, lang, voice, slow = false) => { if (voice) speak(frPlain(text), lang, { voice, slow }); };

function Listen({ text, lang, voice, auto = false }) {
  useEffect(() => { if (auto) say(text, lang, voice); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  if (!voice) return null;
  return (
    <div className="lg-listen">
      <button type="button" className="lg-say big" id="lg-play" aria-label="Послушать" onClick={() => say(text, lang, voice)}><Icon name="volume-2" size={30} /></button>
      <button type="button" className="lg-say slow" aria-label="Медленно" onClick={() => say(text, lang, voice, true)}><Icon name="turtle" size={18} /></button>
    </div>
  );
}
function Check({ disabled, onClick, label = 'Проверить' }) {
  return <div className="row"><button type="button" className="btn btn-primary" id="lg-check" disabled={disabled} onClick={onClick}>{label}</button></div>;
}

/* ---------- немые буквы ---------- */
function Silent({ task: x, lang, voice, answer, onAnswer }) {
  const [sel, setSel] = useState(new Set());
  const toggle = k => { if (answer) return; setSel(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }); };
  const check = e => {
    const ok = x.letters.every((l, k) => !l.tap || l.mute === sel.has(k));
    if (ok) sparkFrom(e.currentTarget);
    say(x.w, lang, voice);
    onAnswer(ok, { picked: [...sel] });
  };
  return (
    <>
      <p className="tr-ask lg-ask">Какие буквы в этом слове не читаются?</p>
      <p className="muted">Нажмите на немые буквы. Если читаются все — сразу нажмите «Проверить».</p>
      <div className={`fr-letters ${answer ? 'done' : ''}`} id="fr-letters" role="group" aria-label={`Буквы слова ${x.w}`} lang={textLang()}>
        {x.letters.map((l, k) => (l.tap ? (
          <button type="button" key={k} data-k={k} data-mute={l.mute ? '1' : undefined}
            className={`fr-letter ${sel.has(k) ? 'on' : ''} ${answer ? (l.mute ? 'is-mute' : '') + (l.mute !== sel.has(k) ? ' miss' : '') : ''}`}
            aria-pressed={sel.has(k)} disabled={Boolean(answer)} onClick={() => toggle(k)}>{l.c}</button>
        ) : <span key={k} className="fr-letter fixed">{l.c}</span>))}
      </div>
      {answer && <Listen text={x.w} lang={lang} voice={voice} />}
      {!answer && <Check onClick={check} label={sel.size ? 'Проверить' : 'Все читаются — проверить'} />}
    </>
  );
}

/* ---------- связки: где слова звучат слитно ---------- */
function Liaison({ task: x, lang, voice, answer, onAnswer }) {
  const [on, setOn] = useState(() => x.links.map(() => false));
  const flip = k => { if (answer) return; setOn(a => a.map((v, j) => (j === k ? !v : v))); };
  const check = e => {
    const ok = on.every((v, k) => v === x.links[k]);
    if (ok) sparkFrom(e.currentTarget);
    say(x.say, lang, voice);
    onAnswer(ok, { picked: on });
  };
  return (
    <>
      <p className="tr-ask lg-ask">Где слова звучат слитно?</p>
      <p className="muted">{voice ? `Послушайте и нажмите на промежутки, где ${latinOf().link}.` : `Нажмите на промежутки, где слова связываются: ${latinOf().link}.`}{' '}Связок может и не быть.</p>
      <Listen text={x.say} lang={lang} voice={voice} auto />
      <div className={`fr-gaps ${answer ? 'done' : ''}`} id="fr-gaps" lang={textLang()}>
        {x.words.map((w, k) => (
          <span key={k} className="fr-gw">
            <span className="tx">{w}</span>
            {k < x.links.length && (
              <button type="button" className={`fr-gap ${on[k] ? 'on' : ''} ${answer ? (x.links[k] ? 'is-link' : '') + (on[k] !== x.links[k] ? ' miss' : '') : ''}`}
                data-k={k} data-link={x.links[k] ? '1' : undefined} aria-pressed={on[k]} disabled={Boolean(answer)}
                aria-label={`Между «${w}» и «${x.words[k + 1]}»: ${on[k] ? 'слитно' : 'раздельно'}`} onClick={() => flip(k)}>
                <svg viewBox="0 0 40 16" aria-hidden="true"><path d="M2 3 Q20 18 38 3" /></svg>
              </button>
            )}
          </span>
        ))}
      </div>
      {!answer && <Check onClick={check} />}
    </>
  );
}

/* ---------- диктант: услышать и написать ---------- */
const norm = s => String(s || '').trim().toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ');
const bare = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
function Dictee({ task: x, lang, voice, answer, onAnswer }) {
  const [v, setV] = useState('');
  const inp = useRef(null);
  useEffect(() => { inp.current?.focus({ preventScroll: true }); }, []);
  const add = ch => {
    const el = inp.current; if (!el) { setV(t => t + ch); return; }
    const a = el.selectionStart ?? v.length, b = el.selectionEnd ?? v.length;
    const nv = v.slice(0, a) + ch + v.slice(b); setV(nv);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + ch.length, a + ch.length); });
  };
  const check = e => {
    e.preventDefault();
    if (answer || !v.trim()) return;
    const ok = norm(v) === norm(x.w);
    if (ok) sparkFrom(inp.current);
    onAnswer(ok, { typed: v, accentOnly: !ok && bare(v) === bare(x.w) });
  };
  return (
    <form className="fr-dictee" onSubmit={check} data-w={x.w}>
      <p className="tr-ask lg-ask">{x.say !== x.w ? 'Запишите фамилию, которую продиктовали по буквам' : 'Напишите услышанное слово'}</p>
      <Listen text={x.say} lang={lang} voice={voice} auto />
      <input ref={inp} className={`input fr-input ${answer ? (answer.ok ? 'ok' : 'bad') : ''}`} id="fr-input" lang={textLang()} value={v} onChange={e => setV(e.target.value)}
        disabled={Boolean(answer)} autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Ваш ответ" placeholder={latinOf().word} />
      <div className="fr-keys" role="group" aria-label="Буквы со значками">
        {latinOf().accents.map(ch => <button type="button" key={ch} className="lg-chip" data-ch={ch} disabled={Boolean(answer)} onClick={() => add(ch)}>{ch}</button>)}
      </div>
      {!answer && <div className="row"><button type="submit" className="btn btn-primary" id="lg-check" disabled={!v.trim()}>Проверить</button></div>}
    </form>
  );
}

/* ---------- две группы ---------- */
function Sort({ task: x, lang, voice, answer, onAnswer }) {
  const [pick, setPick] = useState({});
  const all = x.items.every((_, k) => pick[k] !== undefined);
  const check = e => {
    const ok = x.items.every((it, k) => pick[k] === it.g);
    if (ok) sparkFrom(e.currentTarget);
    onAnswer(ok, { picked: pick });
  };
  return (
    <>
      <p className="tr-ask lg-ask">Разложите слова по группам</p>
      <ul className={`fr-sort ${answer ? 'done' : ''}`} id="fr-sort">
        {x.items.map((it, k) => (
          <li key={it.w} data-w={it.w} data-g={it.g} className={answer ? (pick[k] === it.g ? 'ok' : 'bad') : ''}>
            <button type="button" className="fr-sort-w" onClick={() => say(it.w, lang, voice)} aria-label={`${it.w}: послушать`} disabled={!voice}>
              <span className="tx" lang={textLang()}>{it.w}</span>{voice && <Icon name="volume-2" size={14} />}
            </button>
            {it.ru && <span className="fr-sort-ru">{it.ru}</span>}
            <span className="seg-ctl" role="radiogroup" aria-label={`Группа для ${it.w}`}>
              {x.groups.map((g, j) => (
                <button type="button" role="radio" key={g} aria-checked={pick[k] === j} data-g={j} disabled={Boolean(answer)} onClick={() => setPick(p => ({ ...p, [k]: j }))}>{g}</button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {!answer && <Check disabled={!all} onClick={check} />}
    </>
  );
}


/* ---------- маршрут: провести путь по объяснению ---------- */
const ARROW = { L: ['arrow-left', 'налево'], U: ['arrow-up', 'прямо'], R: ['arrow-right', 'направо'] };
function walk(path) {
  // старт внизу по центру, смотрим вверх; L, R — повернуть и пройти квартал, U — пройти квартал прямо
  let x = 3, y = 6, dx = 0, dy = -1;
  const pts = [[x, y]];
  path.forEach(a => {
    if (a === 'L') [dx, dy] = [dy, -dx];
    if (a === 'R') [dx, dy] = [-dy, dx];
    x += dx * 1.5; y += dy * 1.5; pts.push([x, y]);
  });
  return pts;
}
function Route({ task: x, lang, voice, answer, onAnswer }) {
  const [path, setPath] = useState([]);
  const check = e => { const ok = path.join(' ') === x.answer.join(' '); if (ok) sparkFrom(e.currentTarget); onAnswer(ok, { picked: path }); };
  const pts = walk(path), right = answer ? walk(x.answer) : null;
  const P = q => q.map(([a, b]) => `${a * 20 + 10},${b * 20 + 10}`).join(' ');
  return (
    <>
      <p className="tr-ask lg-ask">{voice ? 'Послушайте, как пройти, и проложите маршрут' : 'Прочитайте, как пройти, и проложите маршрут'}</p>
      {voice ? <Listen text={x.say} lang={lang} voice={voice} auto /> : <p className="lg-big"><span className="tx" lang={textLang()} id="lg-zh">{x.say}</span></p>}
      {voice && answer && <p className="fr-route-say"><span className="tx" lang={textLang()}>{x.say}</span></p>}
      <div className="fr-route" data-answer={x.answer.join(' ')}>
        <svg viewBox="0 0 150 150" className="fr-map" aria-label={`Маршрут: ${path.map(a => ARROW[a][1]).join(', ') || 'пока пусто'}`}>
          {Array.from({ length: 5 }, (_, k) => <g key={k}><line x1={k * 30 + 10} y1="0" x2={k * 30 + 10} y2="150" /><line x1="0" y1={k * 30 + 10} x2="150" y2={k * 30 + 10} /></g>)}
          {right && <polyline className="right" points={P(right)} />}
          <polyline className="mine" points={P(pts)} />
          <path className="start" d="M70 121 L64 131 L76 131 Z" />
          <circle className="end" cx={pts.at(-1)[0] * 20 + 10} cy={pts.at(-1)[1] * 20 + 10} r="5" />
        </svg>
        <div className="fr-route-ctl">
          <ol className="fr-route-steps" aria-label="Ваш маршрут">{path.map((a, k) => <li key={k}><Icon name={ARROW[a][0]} size={18} />{ARROW[a][1]}</li>)}</ol>
          {!answer && (
            <div className="fr-route-btns">
              {['L', 'U', 'R'].map(a => <button key={a} type="button" className="lg-chip" data-a={a} disabled={path.length >= 5} onClick={() => setPath(p => [...p, a])}><Icon name={ARROW[a][0]} size={18} />{ARROW[a][1]}</button>)}
              <button type="button" className="btn btn-ghost btn-sm" id="fr-route-undo" disabled={!path.length} onClick={() => setPath(p => p.slice(0, -1))}><Icon name="undo-2" size={15} />Шаг назад</button>
            </div>
          )}
        </div>
      </div>
      {!answer && <Check disabled={!path.length} onClick={check} />}
    </>
  );
}

/* ---------- номер телефона на слух ---------- */
/* Номер группами: во Франции 06 12 34 56 78, в Испании 612 34 56 78 */
const pairs = d => (d.length === 9 ? d.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4') : d.replace(/(\d{2})(?=\d)/g, '$1 '));
function Digits({ task: x, lang, voice, answer, onAnswer }) {
  const [d, setD] = useState('');
  const n = x.answer.length;
  const press = k => { if (answer || d.length >= n) return; setD(v => v + k); };
  const check = e => { const ok = d === x.answer; if (ok) sparkFrom(e.currentTarget); onAnswer(ok, { typed: d }); };
  return (
    <>
      <p className="tr-ask lg-ask">Наберите продиктованный номер</p>
      <Listen text={x.say} lang={lang} voice={voice} auto />
      <p className={`fr-phone-num ${answer ? (answer.ok ? 'ok' : 'bad') : ''}`} id="fr-phone" aria-live="polite" data-answer={x.answer}>{d ? pairs(d) : n === 9 ? '— — — —' : '— — — — —'}</p>
      <div className="fr-keypad" role="group" aria-label="Цифры">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((k, i) => (k === '' ? <span key={i} /> : (
          <button key={k} type="button" className="fr-key" data-k={k} disabled={Boolean(answer)} aria-label={k === 'del' ? 'Стереть' : k}
            onClick={() => (k === 'del' ? setD(v => v.slice(0, -1)) : press(k))}>{k === 'del' ? <Icon name="delete" size={20} /> : k}</button>
        )))}
      </div>
      {!answer && <Check disabled={d.length !== n} onClick={check} />}
    </>
  );
}

/* ---------- где болит: нажать на схему тела ---------- */
const ZONES = {
  head: { name: 'голова', el: <circle cx="100" cy="42" r="26" /> },
  ear: { name: 'ухо', el: <ellipse cx="129" cy="44" rx="7" ry="11" /> },
  teeth: { name: 'зубы', el: <rect x="88" y="52" width="24" height="10" rx="5" /> },
  throat: { name: 'горло', el: <rect x="88" y="70" width="24" height="18" rx="6" /> },
  arm: { name: 'рука', el: <path d="M58 98 L40 168 L52 172 L72 106 Z" /> },
  belly: { name: 'живот', el: <ellipse cx="100" cy="150" rx="28" ry="24" /> },
  knee: { name: 'колено', el: <circle cx="84" cy="236" r="11" /> },
  foot: { name: 'ступня', el: <path d="M70 292 L92 292 L94 306 L62 306 Z" /> },
};
function Body({ task: x, lang, voice, answer, onAnswer }) {
  const [pick, setPick] = useState(null);
  const tap = (z, e) => { if (answer) return; setPick(z); const ok = z === x.zone; if (ok) sparkFrom(e.currentTarget); onAnswer(ok, { picked: z }); };
  return (
    <>
      <p className="tr-ask lg-ask">{voice ? 'Послушайте и покажите, где болит' : 'Прочитайте и покажите, где болит'}</p>
      {voice ? <Listen text={x.say} lang={lang} voice={voice} auto /> : <p className="lg-big"><span className="tx" lang={textLang()} id="lg-zh">{x.say}</span></p>}
      {!answer && <p className="muted fr-body-hint">Нажмите на схеме на ту часть тела, которая болит.</p>}
      <svg viewBox="0 0 200 320" className={`fr-body ${answer ? 'done' : ''}`} id="fr-body" role="group" aria-label="Схема тела">
        <g className="fig" aria-hidden="true">
          <circle cx="100" cy="42" r="26" /><rect x="90" y="66" width="20" height="22" rx="6" />
          <path d="M66 92 Q100 82 134 92 L140 190 Q100 204 60 190 Z" />
          <path d="M66 96 L44 170 L54 174 L74 108 Z" /><path d="M134 96 L156 170 L146 174 L126 108 Z" />
          <path d="M70 190 L76 292 L94 292 L98 200 Z" /><path d="M130 190 L124 292 L106 292 L102 200 Z" />
          <ellipse cx="74" cy="44" rx="7" ry="11" /><ellipse cx="126" cy="44" rx="7" ry="11" />
          <path d="M70 292 L92 292 L94 306 L62 306 Z" /><path d="M130 292 L108 292 L106 306 L138 306 Z" />
        </g>
        {Object.entries(ZONES).map(([z, { name, el }]) => (
          <g key={z} className={`zone ${pick === z ? 'on' : ''} ${answer && z === x.zone ? 'is-right' : ''}`} data-zone={z} data-ok={z === x.zone ? '1' : undefined} role="button" tabIndex={answer ? -1 : 0}
            aria-label={name} onClick={e => tap(z, e)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(z, e); } }}>{el}</g>
        ))}
      </svg>
    </>
  );
}

/* ---------- табло вокзала ---------- */
function Board({ task: x, lang, voice, answer, onAnswer }) {
  const pick = (k, e) => { if (answer) return; const ok = k === x.correct; if (ok) sparkFrom(e.currentTarget); onAnswer(ok, { picked: k }); };
  return (
    <>
      <p className="tr-ask lg-ask">{voice ? 'Послушайте объявление и найдите поезд на табло' : 'Прочитайте объявление и найдите поезд на табло'}</p>
      {voice ? <Listen text={x.say} lang={lang} voice={voice} auto /> : <p className="fr-route-say"><span className="tx" lang={textLang()} id="lg-zh">{x.say}</span></p>}
      <div className="fr-board" id="fr-board" role="group" aria-label="Табло отправления">
        <div className="fr-board-title" aria-hidden="true"><Icon name="clock" size={15} /><span lang={textLang()}>{x.title || latinOf().board}</span></div>
        <div className="fr-board-head" aria-hidden="true">{x.head.map(h => <span key={h}>{h}</span>)}</div>
        {x.rows.map((r, k) => (
          <button key={r[0]} type="button" className={`fr-board-row ${answer ? (k === x.correct ? 'ok' : answer.picked === k ? 'bad' : 'dim') : ''}`} data-k={k} data-ok={k === x.correct ? '1' : undefined} disabled={Boolean(answer)} onClick={e => pick(k, e)}>
            {r.map((c, j) => <span key={j} className={j === 0 ? 'tr' : ''}>{c}</span>)}
          </button>
        ))}
      </div>
    </>
  );
}

/* ---------- порядок событий в рассказе ---------- */
function Order({ task: x, lang, voice, answer, onAnswer }) {
  const [seq, setSeq] = useState([]);
  const put = k => { if (answer) return; setSeq(q => (q.includes(k) ? q.filter(y => y !== k) : [...q, k])); };
  const check = e => { const ok = seq.every((k, i) => k === i); if (ok) sparkFrom(e.currentTarget); onAnswer(ok, { picked: seq }); };
  return (
    <>
      <p className="tr-ask lg-ask">{voice ? 'Послушайте рассказ и расставьте события по порядку' : 'Прочитайте рассказ и расставьте события по порядку'}</p>
      {voice ? <Listen text={x.say} lang={lang} voice={voice} auto /> : <p className="fr-route-say"><span className="tx" lang={textLang()} id="lg-zh">{x.say}</span></p>}
      {voice && answer && <p className="fr-route-say"><span className="tx" lang={textLang()}>{x.say}</span></p>}
      <ol className={`fr-order ${answer ? 'done' : ''}`} id="fr-order" aria-label="Ваш порядок">
        {x.items.map((_, i) => <li key={i} className={answer ? (seq[i] === i ? 'ok' : 'bad') : ''}>{seq[i] !== undefined ? x.items[seq[i]] : <span className="muted">…</span>}</li>)}
      </ol>
      <div className="fr-order-bank">
        {x.bank.map(b => <button key={b.k} type="button" className={`lg-chip ${seq.includes(b.k) ? 'on' : ''}`} data-k={b.k} disabled={Boolean(answer)} aria-pressed={seq.includes(b.k)} onClick={() => put(b.k)}>{b.t}</button>)}
      </div>
      {!answer && <Check disabled={seq.length !== x.items.length} onClick={check} />}
    </>
  );
}

/* ---------- интонация: скажите фразу ---------- */
/* Схема интонации: пунктир — как должна двигаться высота голоса, яркая линия — ваш голос.
   Линии образца нет: озвучка — синтез речи, а он поднимает голос в вопросе слабее, чем живой человек */
function LineChart({ mine, rise }) {
  const W = 300, H = 140, x0 = 12, w = W - 24, mid = H / 2, k = 6;
  const path = st => (st && st.length > 1 ? st.map((v, i) => `${i ? 'L' : 'M'}${(x0 + (i / (st.length - 1)) * w).toFixed(1)} ${(mid - Math.max(-10, Math.min(10, v)) * k).toFixed(1)}`).join(' ') : '');
  return (
    <figure className="lg-micchart fr-linechart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rise ? 'Схема: вопрос, голос поднимается к концу' : 'Схема: утверждение, голос опускается к концу'}>
        <line className="mid" x1={x0} x2={W - 12} y1={mid} y2={mid} />
        <path className="ideal" d={rise ? `M${x0} ${mid + 6} L${x0 + w * 0.7} ${mid} Q${x0 + w * 0.88} ${mid} ${x0 + w} ${mid - 40}` : `M${x0} ${mid - 8} L${x0 + w * 0.6} ${mid - 4} Q${x0 + w * 0.85} ${mid} ${x0 + w} ${mid + 30}`} />
        {mine && <path className="mine done" d={path(mine.st)} />}
      </svg>
      <figcaption><span className="k ideal" />как должно звучать<span className="k mine" />вы</figcaption>
    </figure>
  );
}
function SpeakLine({ task: x, lang, voice, onNext }) {
  const [state, setState] = useState(micSupported() ? 'idle' : 'nomic');
  const [res, setRes] = useState(null);
  const rec = useRecorder();
  const finish = s => { const r = analyzeLine(s.live.samples(), s.ctx.sampleRate, x.rise); setRes(r); setState('done'); };
  const go = async () => {
    if (state === 'rec') { const s = rec.stop(); if (s) finish(s); return; }
    setRes(null);
    try { setState('rec'); await rec.start({ onLevel: () => {}, onFrames: () => {}, onEnd: finish, maxMs: 6000, quietMs: 900 }); }
    catch (e) { setState(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'nomic'); }
  };
  return (
    <div className="lg-rule lg-speak" id="lg-speak-line" data-state={state} data-verdict={res ? (res.ok ? 'ok' : 'bad') : undefined}>
      <p className="label pl-kicker">Скажите сами · интонация</p>
      <h2 className="h3"><span className="tx" lang={textLang()}>{x.text}</span></h2>
      <p className="muted">«{x.ru}» — {x.rise ? 'это вопрос: голос поднимается на последнем слоге.' : 'это утверждение: голос спокойно опускается к концу.'}</p>
      <Listen text={x.text} lang={lang} voice={voice} />
      <LineChart mine={res && res.contour} rise={x.rise} />
      {state === 'nomic' && <p className="lg-mic-tip">Этот браузер не даёт доступа к микрофону — упражнение можно пропустить.</p>}
      {state === 'denied' && <p className="lg-mic-tip">Нет доступа к микрофону. Разрешите его для сайта в настройках браузера.</p>}
      {state === 'rec' && <p className="lg-mic-tip"><span className="lg-mic-dot" />Говорите… Запись остановится сама.</p>}
      {state === 'done' && res && <p className={`lg-mic-tip ${res.ok ? 'ok' : 'bad'}`} id="lg-mic-tip"><b>{res.ok ? 'Получилось.' : res.code === 'silent' ? 'Не расслышали.' : 'Пока не та интонация.'}</b> {res.tip}</p>}
      <div className="row">
        {state !== 'nomic' && <button type="button" className={`btn ${state === 'rec' ? 'btn-secondary' : 'btn-primary'}`} id="lg-mic-rec" onClick={go}><Icon name={state === 'rec' ? 'x' : 'mic'} size={17} />{state === 'rec' ? 'Стоп' : res ? 'Ещё раз' : 'Записать'}</button>}
        <button type="button" className={`btn ${res ? 'btn-primary' : 'btn-ghost'}`} id="lg-next" onClick={onNext}>{res ? 'Дальше' : 'Пропустить'}<Icon name="arrow-right" size={17} /></button>
      </div>
      <p className="lg-mic-privacy">Звук разбирается прямо на устройстве и никуда не отправляется.</p>
    </div>
  );
}

export function FrTask(props) {
  switch (props.task.type) {
    case 'silent': return <Silent {...props} />;
    case 'liaison': return <Liaison {...props} />;
    case 'dictee': return <Dictee {...props} />;
    case 'sort': return <Sort {...props} />;
    case 'route': return <Route {...props} />;
    case 'digits': return <Digits {...props} />;
    case 'body': return <Body {...props} />;
    case 'board': return <Board {...props} />;
    case 'speakLine': return <SpeakLine {...props} />;
    case 'order': return <Order {...props} />;
    default: return null;
  }
}

/* Пояснение после ответа */
export function FrExplain({ task: x, answer }) {
  if (x.type === 'silent') {
    const mute = x.letters.filter(l => l.mute).map(l => l.c);
    return <span className="lg-ex"><FrText text={x.letters.map(l => (l.mute ? `(${l.c})` : l.c)).join('')} silent />{mute.length ? ` — не читаются: ${mute.join(', ')}` : ' — читаются все буквы'}.</span>;
  }
  if (x.type === 'liaison') return <span className="lg-ex"><FrText text={x.src} />{x.links.some(Boolean) ? '' : ' — здесь слова не связываются'}.</span>;
  if (x.type === 'dictee') return <span className="lg-ex">Правильно: <span className="tx" lang={textLang()}>{x.w}</span>{answer && answer.accentOnly ? '. Буквы верные, но значки тоже важны: они меняют чтение и смысл' : ''}.</span>;
  if (x.type === 'route') return <span className="lg-ex"><span className="tx" lang={textLang()}>{x.say}</span> — {x.answer.map(a => ARROW[a][1]).join(', ')}.</span>;
  if (x.type === 'digits') return <span className="lg-ex">Номер: <b>{pairs(x.answer)}</b>.</span>;
  if (x.type === 'body') return <span className="lg-ex"><span className="tx" lang={textLang()}>{x.say}</span> — болит {ZONES[x.zone].name}{x.ru && x.ru !== ZONES[x.zone].name ? ` (${x.ru})` : ''}.</span>;
  if (x.type === 'board') return <span className="lg-ex"><span className="tx" lang={textLang()}>{x.say}</span> — {x.rows[x.correct].join(' · ')}.</span>;
  if (x.type === 'order') return <span className="lg-ex">{x.items.map((t, i) => `${i + 1}) ${t}`).join('; ')}.</span>;
  if (x.type === 'sort') return <span className="lg-ex">{x.groups.map((g, j) => `${g[0].toUpperCase()}${g.slice(1)}: ${x.items.filter(it => it.g === j).map(it => it.w).join(', ')}`).join('. ')}.</span>;
  return null;
}
