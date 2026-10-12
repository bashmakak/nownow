import { useEffect, useRef, useState } from 'react';
import { speak } from '../lib/speech.js';
import { Icon } from './Icon.jsx';
import Mouth, { MouthSide, PLACE_TXT, TongueSide } from './Mouth.jsx';
import { FLOORS, STEAK, frNumber, frPlain } from '../lib/fr-data.js';

/* ===== Наглядные схемы для французского с нуля =====
   Вставляются в карточки правил (поле demo урока) и в знакомство со звуком (поле view звука):
   ритм и ударение, немые буквы, носовые гласные, губы для [y], буквосочетания и значки, связки слов,
   счёт до двадцати, слова, которые звучат одинаково. Всё понятно и без звука: звук только дополняет.
   Слова приходят из данных урока (поле w у правила), их звук собирает scripts/audio-list.mjs. */

const say = (lang, voice, w, slow = false) => { if (voice) speak(frPlain(w), lang, { voice, slow }); };

/* Запись слова или фразы: дужки ‿ рисуются аркой между словами, немые буквы в скобках — бледнее */
export function FrText({ text, className = '', silent = false }) {
  const parts = String(text).split(/(‿)/);
  return (
    <span className={`tx ${className}`} lang="fr">
      {parts.map((x, k) => (x === '‿'
        ? <span key={k} className="lk" aria-hidden="true">‿</span>
        : <span key={k}>{silent ? mutes(x) : x.replace(/[()]/g, '')}</span>))}
    </span>
  );
}
function mutes(x) {
  const out = []; let buf = '', mute = false;
  const flush = k => { if (buf) out.push(mute ? <span key={k} className="mute">{buf}</span> : buf); buf = ''; };
  [...x].forEach((ch, k) => {
    if (ch === '(') { flush(k); mute = true; return; }
    if (ch === ')') { flush(k); mute = false; return; }
    buf += ch;
  });
  flush('e');
  return out;
}

/* ---------- ритм: все слоги ровные, ударный — последний ---------- */
export function StressDemo({ w, lang, voice }) {
  const [on, setOn] = useState(null);                  // какое слово «звучит» и номер запуска
  const play = (x, k) => { say(lang, voice, x); setOn({ k, n: Date.now() }); };
  useEffect(() => { const t = setTimeout(() => play(w[0], 0), 600); return () => clearTimeout(t); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lg-demo fr-stress" id="fr-demo-stress">
      {w.map((x, k) => {
        const syl = x.split('·');
        return (
          <button type="button" key={x} className={`fr-stress-row ${on && on.k === k ? 'on' : ''}`} data-w={frPlain(x)} onClick={() => play(x, k)} aria-label={`${frPlain(x)}: ударение на последнем слоге. Послушать`}>
            <span className="fr-syls" key={on && on.k === k ? on.n : 'still'}>
              {syl.map((s, j) => <span key={j} className={`fr-syl ${j === syl.length - 1 ? 'last' : ''}`} style={{ '--d': `${j * 0.22}s` }}>{s}</span>)}
            </span>
            <Icon name="volume-2" size={16} />
          </button>
        );
      })}
      <p className="fr-demo-note">Брусок — слог. Все слоги одной длины и звучат чётко, а последний чуть длиннее: на нём ударение.</p>
    </div>
  );
}

/* ---------- немые буквы: пишутся, но не звучат ---------- */
export function SilentDemo({ w, lang, voice }) {
  const [run, setRun] = useState({});
  const play = x => { say(lang, voice, x); setRun(r => ({ ...r, [x]: (r[x] || 0) + 1 })); };
  return (
    <div className="lg-demo fr-silent" id="fr-demo-silent">
      <div className="fr-silent-row">
        {w.map((x, k) => (
          <button type="button" key={x} className="fr-silent-w" style={{ '--d': `${0.6 + k * 0.35}s` }} data-w={frPlain(x)} onClick={() => play(x)} aria-label={`${frPlain(x)}: послушать`}>
            <span key={run[x] || 0} className="fr-silent-t"><FrText text={x} silent /></span>
            <Icon name="volume-2" size={15} />
          </button>
        ))}
      </div>
      <p className="fr-demo-note">Бледные буквы пишутся, но не произносятся. Нажмите на слово, чтобы послушать.</p>
    </div>
  );
}

/* ---------- носовые гласные: мягкое нёбо опускается, воздух идёт и через нос ---------- */
export function NasalDemo({ w, lang, voice }) {
  // w: [[без носа, с носом, гласная для схемы], …] — beau / bon, bas / banc
  const [sel, setSel] = useState({ k: 0, nasal: false });
  const cur = w[sel.k];
  const play = (k, nasal) => { setSel({ k, nasal }); say(lang, voice, w[k][nasal ? 1 : 0]); };
  return (
    <div className="lg-demo fr-nasal" id="fr-demo-nasal" data-nasal={sel.nasal ? '1' : '0'}>
      <div className="lg-mouth-views">
        <figure className="lg-mouth-view"><MouthSide v={cur[2]} nasal={sel.nasal} /><figcaption>{sel.nasal ? `${cur[1]}: мягкое нёбо опущено, воздух выходит и через нос` : `${cur[0]}: мягкое нёбо поднято, воздух выходит только через рот`}</figcaption></figure>
      </div>
      <div className="fr-pairs" role="group" aria-label="Пары слов: без носа и с носом">
        {w.map(([a, b], k) => (
          <div className="fr-pair" key={a}>
            <button type="button" className={`lg-chip ${sel.k === k && !sel.nasal ? 'on' : ''}`} data-w={a} onClick={() => play(k, false)}><span className="tx" lang="fr">{a}</span><Icon name="volume-2" size={14} /></button>
            <span className="fr-pair-vs" aria-hidden="true">→</span>
            <button type="button" className={`lg-chip nasal ${sel.k === k && sel.nasal ? 'on' : ''}`} data-w={b} onClick={() => play(k, true)}><span className="tx" lang="fr">{b}</span><Icon name="volume-2" size={14} /></button>
          </div>
        ))}
      </div>
      <p className="fr-demo-note">Проверка: зажмите нос пальцами. Слово слева звучит так же, а справа — глухо: воздуху некуда выйти.</p>
    </div>
  );
}

/* ---------- губы и язык: и → [y] → у ---------- */
const LIPS_TXT = {
  i: 'Губы растянуты, язык высоко впереди.',
  ü: 'Язык остался на месте, как для «и», а губы вытянулись трубочкой.',
  u: 'Губы трубочкой, как для [y], но язык ушёл назад.',
  é: 'Губы растянуты, рот приоткрыт чуть шире, чем для «и».',
  ø: 'Язык остался на месте, как для [e], а губы округлились.',
  o: 'Губы округлены, язык ушёл назад.',
};
export function LipsDemo({ w, lang, voice }) {
  // w: [[форма рта, подпись, слово], …]
  const [k, setK] = useState(0);
  const [pulse, setPulse] = useState(0);
  const timers = useRef([]);
  useEffect(() => {
    // показать переход по шагам: и → [y] → у
    timers.current = w.map((_, j) => setTimeout(() => setK(j), 700 + j * 1300));
    return () => timers.current.forEach(clearTimeout);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  const pick = j => { timers.current.forEach(clearTimeout); setK(j); setPulse(x => x + 1); say(lang, voice, w[j][2]); };
  const [v] = w[k];
  return (
    <div className="lg-demo fr-lips" id="fr-demo-lips" data-v={v}>
      <div className="lg-mouth-views">
        <figure className="lg-mouth-view"><Mouth v={v} pulse={pulse} className="big" /><figcaption>Спереди</figcaption></figure>
        <figure className="lg-mouth-view"><MouthSide v={v} /><figcaption>Сбоку: точка — самая высокая часть языка</figcaption></figure>
      </div>
      <p className="lg-mouth-txt" id="fr-lips-txt">{LIPS_TXT[v]}</p>
      <div className="fr-steps" role="group" aria-label="Шаги">
        {w.map(([form, label, word], j) => (
          <button type="button" key={form} className={`lg-chip ${j === k ? 'on' : ''}`} data-v={form} onClick={() => pick(j)} aria-pressed={j === k}>
            <b>{label}</b> <span className="tx" lang="fr">{word}</span><Icon name="volume-2" size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- буквосочетания и значки: несколько букв — один звук ---------- */
export function ComboDemo({ combo, lang, voice }) {
  // combo: [[буквы, звук, [слова], пояснение], …]
  return (
    <div className="lg-demo fr-combo" id="fr-demo-combo">
      {combo.map(([letters, sound, words, note], k) => (
        <div className="fr-combo-row" key={letters} style={{ '--d': `${0.3 + k * 0.45}s` }} data-combo={letters}>
          <span className="fr-combo-tiles" aria-label={`${letters} читается ${sound}`}>
            {letters.split(/(\s*,\s*|\s+или\s+)/).map((x, j) => (/^\s*,\s*$|или/.test(x) ? <span key={j} className="fr-combo-or">{x.trim() === ',' ? ',' : 'или'}</span> : (
              <span key={j} className="fr-combo-set">{[...x].map((ch, n) => <span key={n} className="fr-tile">{ch}</span>)}</span>
            )))}
          </span>
          <span className="fr-combo-eq" aria-hidden="true">=</span>
          <span className="fr-combo-sound">{sound}</span>
          <span className="fr-combo-words">
            {words.map(x => <button type="button" key={x} className="lg-chip" data-w={frPlain(x)} onClick={() => say(lang, voice, x)}><FrText text={x} silent /><Icon name="volume-2" size={13} /></button>)}
          </span>
          {note && <span className="fr-combo-note">{note}</span>}
        </div>
      ))}
    </div>
  );
}

/* ---------- связки: согласный переходит к следующему слову ---------- */
export function LinkDemo({ w, lang, voice }) {
  // w: [[фраза с дужками, звук на дужке], …] — ['les‿amis', 'z']
  const [run, setRun] = useState({});
  const play = x => { say(lang, voice, x); setRun(r => ({ ...r, [x]: (r[x] || 0) + 1 })); };
  return (
    <div className="lg-demo fr-link" id="fr-demo-link">
      {w.map(([x, s], k) => {
        const parts = x.split('‿');
        return (
          <button type="button" key={x} className="fr-link-row" style={{ '--d': `${0.4 + k * 0.4}s` }} data-w={frPlain(x)} onClick={() => play(x)} aria-label={`${frPlain(x)}: слова звучат слитно${s ? `, на стыке звучит [${s}]` : ''}. Послушать`}>
            <span className="fr-link-t" key={run[x] || 0} lang="fr">
              {parts.map((p, j) => (
                <span key={j} className="fr-link-w">{p}{j < parts.length - 1 && <span className="fr-arc" aria-hidden="true"><svg viewBox="0 0 40 16"><path d="M2 3 Q20 18 38 3" /></svg>{s && <i>{s}</i>}</span>}</span>
              ))}
            </span>
            <Icon name="volume-2" size={16} />
          </button>
        );
      })}
      <p className="fr-demo-note">Дужка — слова звучат как одно. Буква над дужкой — звук, который появляется на стыке.</p>
    </div>
  );
}

/* ---------- счёт: кнопки с числами ---------- */
export function CountDemo({ w, lang, voice }) {
  // w: слова по порядку, начиная с нуля, или пары [подпись, слово] — числа, буквы алфавита
  return (
    <div className="lg-demo fr-count" id="fr-demo-count">
      {w.map((x, k) => {
        const [label, word] = Array.isArray(x) ? x : [k, x];
        return (
          <button type="button" key={word} className="fr-num" data-w={word} onClick={() => say(lang, voice, word)} aria-label={`${label}: ${word}. Послушать`}>
            <b>{label}</b><span className="tx" lang="fr">{word}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 70, 80, 90: число из блоков ---------- */
export function NumDemo({ lang, voice }) {
  const [base, setBase] = useState(80);                // 60 — soixante, 80 — quatre-vingt(s)
  const [add, setAdd] = useState(15);
  const n = base + add, word = frNumber(n);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } say(lang, voice, word); }, [n]);  // eslint-disable-line react-hooks/exhaustive-deps
  const blocks = base === 60 ? [[60, 'soixante']] : [[20], [20], [20], [20]];
  return (
    <div className="lg-demo fr-numdemo" id="fr-demo-num" data-n={n}>
      <div className="fr-num-eq" aria-live="polite">
        <span className="fr-blocks">
          {blocks.map((b, k) => <span key={`${base}-${k}`} className={`fr-block ${base === 60 ? 'wide' : ''}`} style={{ '--d': `${k * 0.08}s` }}>{b[0]}</span>)}
          {add > 0 && <span key={`a${add}`} className="fr-block add" style={{ width: `${Math.max(34, add * 5)}px` }}>{add}</span>}
        </span>
        <span className="fr-num-math">{base === 60 ? '60' : '4 × 20'}{add ? ` + ${add}` : ''} = <b>{n}</b></span>
        <button type="button" className="fr-num-word" id="fr-num-word" onClick={() => say(lang, voice, word)} aria-label={`${n}: ${word}. Послушать`}>
          <span className="tx" lang="fr">{word}</span><Icon name="volume-2" size={18} />
        </button>
      </div>
      <div className="lg-bgrp" role="radiogroup" aria-label="Основа">
        <span className="label">Основа</span>
        <div className="lg-chips">
          {[[60, 'soixante — 60'], [80, 'quatre-vingt — 4 × 20']].map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={base === v} className={`lg-chip ${base === v ? 'on' : ''}`} data-v={v} onClick={() => setBase(v)}>{t}</button>)}
        </div>
      </div>
      <div className="lg-bgrp" role="radiogroup" aria-label="Плюс">
        <span className="label">Плюс</span>
        <div className="lg-chips">
          {Array.from({ length: 20 }, (_, k) => k).map(v => <button key={v} type="button" role="radio" aria-checked={add === v} className={`lg-chip ${add === v ? 'on' : ''}`} data-v={v} onClick={() => setAdd(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ---------- лифт: этажи считают с нуля ---------- */
export function FloorsDemo({ lang, voice }) {
  const [at, setAt] = useState(0);
  const go = k => { setAt(k); say(lang, voice, FLOORS[k][0]); };
  return (
    <div className="lg-demo fr-floors" id="fr-demo-floors" data-floor={at}>
      <div className="fr-house" aria-hidden="true">
        {[...FLOORS].map((f, k) => [f, k]).reverse().map(([f, k]) => (
          <div key={k} className={`fr-storey ${k === at ? 'on' : ''}`}>
            <span className="fr-storey-fr tx">{k === 0 ? 'RDC' : k}</span>
            <span className="fr-storey-win" /><span className="fr-storey-win" /><span className="fr-storey-win" />
            <span className="fr-storey-ru">{f[1]} по-нашему</span>
          </div>
        ))}
      </div>
      <div className="fr-lift" role="group" aria-label="Кнопки лифта">
        {[...FLOORS].map((f, k) => [f, k]).reverse().map(([f, k]) => (
          <button key={k} type="button" className={`fr-lift-btn ${k === at ? 'on' : ''}`} data-floor={k} aria-pressed={k === at} onClick={() => go(k)}>
            <b>{k === 0 ? '0' : k}</b><span className="tx" lang="fr">{f[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- прожарка стейка ---------- */
export function SteakDemo({ lang, voice }) {
  const [k, setK] = useState(2);
  const [word, ru, color] = STEAK[k];
  const set = v => { setK(v); say(lang, voice, STEAK[v][0]); };
  return (
    <div className="lg-demo fr-steak" id="fr-demo-steak" data-k={k}>
      <svg viewBox="0 0 220 120" className="fr-steak-svg" aria-hidden="true">
        <ellipse cx="110" cy="64" rx="96" ry="46" fill="#5A3324" />
        <ellipse cx="110" cy="60" rx="88" ry="40" fill="#7B4A33" />
        <ellipse cx="110" cy="60" rx={66 - k * 14} ry={28 - k * 6} fill={color} style={{ transition: 'all .4s' }} />
      </svg>
      <p className="fr-steak-t"><span className="tx" lang="fr">{word}</span> — {ru}</p>
      <input type="range" min="0" max="3" step="1" value={k} onChange={e => set(+e.target.value)} className="fr-range" aria-label="Прожарка" aria-valuetext={`${word}, ${ru}`} />
      <div className="fr-steak-scale" aria-hidden="true">{STEAK.map(([w]) => <span key={w} className="tx">{w}</span>)}</div>
    </div>
  );
}

/* ---------- одинаково звучат, по-разному пишутся ---------- */
export function HomoDemo({ combo, lang, voice }) {
  // combo: [[звук, [[запись, значение], …]], …]; звучит первое слово группы
  return (
    <div className="lg-demo fr-homo" id="fr-demo-homo">
      {combo.map(([sound, items]) => (
        <div className="fr-homo-g" key={sound}>
          <button type="button" className="lg-say" data-w={items[0][0]} onClick={() => say(lang, voice, items[0][0])} aria-label={`Послушать ${sound}`}><Icon name="volume-2" size={18} /></button>
          <span className="fr-homo-s">{sound}</span>
          <ul>{items.map(([x, ru]) => <li key={x}><span className="tx" lang="fr">{x}</span> — {ru}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

/* ---------- схема к звуку: рот, разрез с носом, язык для r ---------- */
const VOWEL = { a: 'a', i: 'i', o: 'o', u: 'u', y: 'ü', 'é': 'é', 'è': 'è', 'ø': 'ø', 'œ': 'œ', 'ə': 'ə' };
export const hasFrView = view => Boolean(VOWEL[view] || /^nasal-/.test(view) || view === 'r');
export function FrSoundView({ view, pulse = 0 }) {
  if (view === 'r') {
    return (
      <div className="lg-demo lg-tongue" id="fr-view-r" data-place="uvular">
        <div className="lg-tongue-main">
          <figure className="lg-mouth-view"><TongueSide place="uvular" /><figcaption>Сбоку, в разрезе: точка — где язык ближе всего к маленькому язычку</figcaption></figure>
          <p className="lg-mouth-txt">{PLACE_TXT.uvular}</p>
        </div>
      </div>
    );
  }
  const nasal = /^nasal-/.test(view);
  const v = nasal ? { 'nasal-a': 'a', 'nasal-o': 'o', 'nasal-e': 'è' }[view] : VOWEL[view];
  if (!v) return null;
  return (
    <div className="lg-demo lg-mouthdemo" id="fr-view-mouth" data-v={v} data-nasal={nasal ? '1' : undefined}>
      <div className="lg-mouth-views">
        <figure className="lg-mouth-view"><Mouth v={v} pulse={pulse} className="big" /><figcaption>Спереди</figcaption></figure>
        <figure className="lg-mouth-view"><MouthSide v={v} nasal={nasal ? true : null} /><figcaption>{nasal ? 'Сбоку: мягкое нёбо опущено, воздух идёт и через нос' : 'Сбоку, в разрезе: точка — самая высокая часть языка'}</figcaption></figure>
      </div>
    </div>
  );
}

/* Схема к правилу по имени из данных урока */
export function frRuleDemo(rule, props) {
  const { demo, w, combo } = rule;
  if (demo === 'fr-stress') return <StressDemo w={w} {...props} />;
  if (demo === 'fr-silent') return <SilentDemo w={w} {...props} />;
  if (demo === 'fr-nasal') return <NasalDemo w={w} {...props} />;
  if (demo === 'fr-lips') return <LipsDemo w={w} {...props} />;
  if (demo === 'fr-combo') return <ComboDemo combo={combo} {...props} />;
  if (demo === 'fr-link') return <LinkDemo w={w} {...props} />;
  if (demo === 'fr-count') return <CountDemo w={w} {...props} />;
  if (demo === 'fr-homo') return <HomoDemo combo={combo} {...props} />;
  if (demo === 'fr-num') return <NumDemo {...props} />;
  if (demo === 'fr-floors') return <FloorsDemo {...props} />;
  if (demo === 'fr-steak') return <SteakDemo {...props} />;
  return null;
}
