import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/speech.js';
import { airPair, mark, parseSyllable, splitSyllable, withInitial } from '../lib/pinyin.js';
import { PY_DEMO, SYL_PARTS, spellSyl as spell } from '../lib/demo-data.js';
import { Icon } from './Icon.jsx';
import ToneChart, { TONE_MARK, ToneIcon } from './ToneChart.jsx';
import Mouth, { MouthSide } from './Mouth.jsx';

/* ===== Наглядные объяснения для вводного курса =====
   Анимации и интерактивные схемы, которые вставляются в карточки урока:
   PinyinDemo — иероглиф и его запись пиньинем, SyllableBuilder — слог из начала, конца и тона,
   MouthDemo — положение губ для простых гласных, BreathDemo — свеча и выдох для пар b — p.
   Всё работает и без звука: анимация показывает движение, звук его дополняет. */

const say = (lang, voice, py, slow = false) => { if (voice) speak('', lang, { voice, py, slow }); };

/* ---------- иероглиф → пиньинь ---------- */
export function PinyinDemo({ lang, voice }) {
  const [run, setRun] = useState(0);
  const timers = useRef([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = PY_DEMO.map(([, i, f, t], k) => setTimeout(() => say(lang, voice, mark(i + f, t)), 1500 + k * 1700));
    return () => timers.current.forEach(clearTimeout);
  }, [run]);  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lg-demo lg-pydemo" id="lg-demo-pinyin">
      <div className="lg-pyd-row" key={run}>
        {PY_DEMO.map(([zh, i, f, t, ru], k) => (
          <button type="button" key={zh} className="lg-pyd" style={{ '--d': `${k * 1.7}s` }} data-py={mark(i + f, t)}
            onClick={() => say(lang, voice, mark(i + f, t))} aria-label={`${zh} читается ${mark(i + f, t)}, «${ru}». Послушать`}>
            <span className="zh" lang="zh-CN">{zh}</span>
            <span className="lg-pyd-arrow" aria-hidden="true">↓</span>
            <span className="lg-pyd-py" aria-hidden="true"><span className="l1">{i}</span><span className="l2">{f}<span className="tm">{TONE_MARK[t]}</span></span></span>
            <span className="lg-pyd-ru">«{ru}»</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" id="lg-demo-again" onClick={() => setRun(r => r + 1)}><Icon name="rotate-ccw" size={15} />Показать ещё раз</button>
    </div>
  );
}

/* ---------- конструктор слога ---------- */
export function SyllableBuilder({ lang, voice }) {
  const [ini, setIni] = useState('m'), [fin, setFin] = useState('a'), [tone, setTone] = useState(1);
  const [n, setN] = useState(0);
  const res = mark(spell(ini, fin), tone);
  useEffect(() => { const t = setTimeout(() => say(lang, voice, res), n ? 60 : 1900); return () => clearTimeout(t); }, [n]);  // eslint-disable-line react-hooks/exhaustive-deps
  const set = (fn, v) => { fn(v); setN(x => x + 1); };
  const note = !ini && (fin === 'i' || fin === 'u') ? `Без согласного впереди ${fin} пишут ${spell('', fin)} — читается так же, «${fin === 'i' ? 'и' : 'у'}».` : null;
  const group = (label, items, cur, fn, show = v => v) => (
    <div className="lg-bgrp" role="radiogroup" aria-label={label}>
      <span className="label">{label}</span>
      <div className="lg-chips">{items.map(v => <button key={v} type="button" role="radio" aria-checked={cur === v} className={`lg-chip ${cur === v ? 'on' : ''}`} data-v={v} onClick={() => set(fn, v)}>{show(v)}</button>)}</div>
    </div>
  );
  return (
    <div className="lg-demo lg-sylb" id="lg-demo-syllable">
      <div className="lg-sylb-eq">
        <div className="lg-sylb-part p-ini" data-empty={!ini || undefined}><span className="k">начало</span><span className="v">{ini || '—'}</span><span className="s">согласный</span></div>
        <span className="op" aria-hidden="true">+</span>
        <div className="lg-sylb-part p-fin"><span className="k">конец</span><span className="v">{fin}</span><span className="s">гласная часть</span></div>
        <span className="op" aria-hidden="true">+</span>
        <div className="lg-sylb-part p-tone"><span className="k">тон</span><span className="v"><ToneIcon tone={tone} /></span><span className="s">{tone}-й</span></div>
        <span className="op eq" aria-hidden="true">=</span>
        <button type="button" className={`lg-sylb-res ${n ? 'now' : ''}`} key={res} id="lg-sylb-res" data-py={res} onClick={() => say(lang, voice, res)} aria-label={`Слог ${res}. Послушать`}>
          <span className="py">{res}</span>{voice && <Icon name="volume-2" size={20} />}
        </button>
      </div>
      <p className="lg-sylb-note" aria-live="polite">{note || 'Меняйте части — слог соберётся заново и прозвучит.'}</p>
      <div className="lg-sylb-ctl">
        {group('Начало', SYL_PARTS.initials, ini, setIni, v => v || 'без согласного')}
        {group('Конец', SYL_PARTS.finals, fin, setFin)}
        {group('Тон', [1, 2, 3, 4], tone, setTone, v => <><ToneIcon tone={v} />{v}-й</>)}
      </div>
    </div>
  );
}

/* ---------- губы и язык для простых гласных: рот спереди и в разрезе сбоку (components/Mouth.jsx) ---------- */
const VOWEL_TXT = {
  a: 'Рот открыт широко, челюсть опущена. Язык лежит низко и спокойно.',
  o: 'Губы округлены и чуть вытянуты. Язык оттянут назад, его спинка приподнята.',
  e: 'Губы не округлены, рот приоткрыт. Язык оттянут назад, как для «о», а губы — как для «э».',
  i: 'Губы растянуты, зубы почти сомкнуты. Язык поднят высоко и вперёд, почти касается нёба.',
  u: 'Губы вытянуты вперёд трубочкой. Язык оттянут назад и поднят.',
  ü: 'Губы трубочкой, как для u, а язык — высоко впереди, как для i.',
};
export const hasMouth = v => Boolean(VOWEL_TXT[v]);
export function MouthDemo({ v, pulse = 0, lang, voice, examples = {} }) {
  return (
    <div className="lg-demo lg-mouthdemo" id="lg-demo-mouth" data-v={v}>
      <div className="lg-mouth-views">
        <figure className="lg-mouth-view"><Mouth v={v} pulse={pulse} className="big" /><figcaption>Спереди</figcaption></figure>
        <figure className="lg-mouth-view"><MouthSide v={v} /><figcaption>Сбоку, в разрезе: точка — самая высокая часть языка</figcaption></figure>
      </div>
      <p className="lg-mouth-txt">{VOWEL_TXT[v]}</p>
      <div className="lg-mouth-strip" role="group" aria-label="Сравните рот для шести гласных">
        {Object.keys(VOWEL_TXT).map(k => (
          <button type="button" key={k} className={`lg-mouth-mini ${k === v ? 'on' : ''}`} data-v={k} onClick={() => say(lang, voice, examples[k])} aria-label={`Гласная ${k}: послушать ${examples[k] || k}`}>
            <Mouth v={k} animate={false} /><span className="py">{k}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- свеча: выдох в парах b — p ---------- */
export const hasBreath = ini => Boolean(airPair(ini));
function Candle({ strong, pulse, label, sub, onClick, id }) {
  return (
    <button type="button" className={`lg-candle ${strong ? 'strong' : 'weak'}`} onClick={onClick} id={id} aria-label={`${label}: ${sub}. Послушать`}>
      <svg viewBox="0 0 120 150" aria-hidden="true">
        <g className="air" key={`a${pulse}`} data-run={pulse ? 1 : undefined}>
          {[0, 1, 2].map(k => <path key={k} d={`M4 ${44 + k * 12} q14 -5 28 0`} style={{ animationDelay: `${k * 70}ms` }} />)}
        </g>
        <rect className="body" x="66" y="78" width="26" height="62" rx="4" />
        <line className="wick" x1="79" y1="78" x2="79" y2="70" />
        <g className="flame-g" key={`f${pulse}`} data-run={pulse ? 1 : undefined}>
          <path className="flame" d="M79 30 C 92 50, 90 66, 79 70 C 68 66, 66 50, 79 30 Z" />
          <path className="core" d="M79 50 C 84 58, 84 66, 79 68 C 74 66, 74 58, 79 50 Z" />
        </g>
      </svg>
      <span className="py">{label}</span><span className="lg-candle-sub">{sub}</span>
    </button>
  );
}
export function BreathDemo({ ini, ex, pulse = 0, lang, voice }) {
  const [weak, strong] = airPair(ini);
  const [run, setRun] = useState({ w: 0, s: 0 });
  const first = useRef(true);
  // пример урока прозвучал — дуем на «свою» свечу
  useEffect(() => { if (first.current && !pulse) return; first.current = false; setRun(r => (ini === strong ? { ...r, s: r.s + 1 } : { ...r, w: r.w + 1 })); }, [pulse]);  // eslint-disable-line react-hooks/exhaustive-deps
  const pyW = withInitial(ex, weak), pyS = withInitial(ex, strong);
  const blow = isStrong => { say(lang, voice, isStrong ? pyS : pyW); setRun(r => (isStrong ? { ...r, s: r.s + 1 } : { ...r, w: r.w + 1 })); };
  return (
    <div className="lg-demo lg-breath" id="lg-demo-breath" data-ini={ini}>
      <p className="lg-breath-lead">Поднесите ладонь или свечу ко рту и скажите оба слога: разница — в струе воздуха.</p>
      <div className="lg-candles">
        <Candle strong={false} pulse={run.w} label={pyW} sub={`${weak} — без выдоха`} onClick={() => blow(false)} id="lg-candle-weak" />
        <Candle strong pulse={run.s} label={pyS} sub={`${strong} — с сильным выдохом`} onClick={() => blow(true)} id="lg-candle-strong" />
      </div>
    </div>
  );
}

/* Схема тонов в карточке: все четыре, нажать — услышать */
export function TonesDemo({ lang, voice, labels }) {
  return (
    <div className="lg-demo lg-tonesdemo" id="lg-demo-tones">
      <ToneChart labels={labels} onPlay={voice ? n => say(lang, voice, labels[n - 1], true) : null} />
      {voice && <p className="lg-teach-note">Звучит учебная запись носителя: медленно и чуть ярче обычного, чтобы тон было легче расслышать.</p>}
    </div>
  );
}

/* Какая наглядная схема подходит звуку: губы для гласных, свеча для пар с выдохом */
export function demoFor(py, ex) {
  if (hasMouth(py)) return 'mouth';
  const { base } = parseSyllable(ex || '');
  if (airPair(py) && splitSyllable(base).initial === py) return 'breath';
  return null;
}
