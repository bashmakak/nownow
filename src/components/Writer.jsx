import { useEffect, useRef, useState } from 'react';
import { GUIDES, letterData } from '../data/lang/letters.js';
import { Icon } from './Icon.jsx';
import { plural } from '../lib/store.js';

/* ===== Прописи: знак обводят пальцем или мышью, черта за чертой =====
   Тренажёр письма — библиотека Hanzi Writer (MIT): она показывает порядок черт и проверяет каждую черту
   по направлению и форме. Сама библиотека и данные о чертах скачиваются, только когда открыты прописи.

   Иероглифы: данные Make Me a Hanzi из пакета hanzi-writer-data (Arphic Public License), лежат на нашем сайте
   в strokes/<язык>/<код знака>.json — к сторонним серверам за ними сайт не обращается.
   Латиница: черты описаны в data/lang/letters.js.

   mode: 'trace' — по контуру, сначала показывается порядок черт; 'memory' — без контура, подсказка после двух
   ошибок подряд; 'show' — только посмотреть порядок черт. */

const hex = ch => ch.codePointAt(0).toString(16);
const glyphs = {};
export function loadGlyph(ch, script = 'hanzi') {
  if (script === 'latin') { const d = letterData(ch); return d ? Promise.resolve(d) : Promise.reject(new Error('no letter')); }
  const key = `${script}:${ch}`;
  if (!glyphs[key]) {
    glyphs[key] = fetch(`${import.meta.env.BASE_URL}strokes/zh/${hex(ch)}.json`)
      .then(r => { if (!r.ok) throw new Error(`strokes ${r.status}`); return r.json(); })
      .catch(e => { delete glyphs[key]; throw e; });
  }
  return glyphs[key];
}
let lib = null;
const loadLib = () => lib || (lib = import('hanzi-writer').then(m => m.default, e => { lib = null; throw e; }));

/* Положение точки знака на экране: так же, как считает сама библиотека (поле 1024, y вверх, от −124 до 900) */
const PAD = 10;
function placer(px) {
  const eff = px - 2 * PAD, scale = eff / 1024;
  const xo = PAD, yo = 124 * scale + PAD;
  return { scale, x: X => xo + X * scale, y: Y => px - yo - Y * scale };
}

/* Сетка под знаком: для иероглифа — квадрат с диагоналями (米字格), для букв — линейки прописи */
function Grid({ px, script }) {
  const p = placer(px), e = px - PAD, s = PAD;
  if (script === 'latin') {
    const line = (y, dash, key) => <line key={key} x1={s} x2={e} y1={p.y(y)} y2={p.y(y)} strokeDasharray={dash ? '6 6' : undefined} />;
    return (
      <svg className="wr-grid" width={px} height={px} aria-hidden="true">
        {line(GUIDES.cap, true, 'c')}{line(GUIDES.x, true, 'x')}{line(GUIDES.desc, true, 'd')}<g className="wr-base">{line(GUIDES.base, false, 'b')}</g>
      </svg>
    );
  }
  const m = px / 2;
  return (
    <svg className="wr-grid" width={px} height={px} aria-hidden="true">
      <rect x={s} y={s} width={e - s} height={e - s} fill="none" />
      <g strokeDasharray="6 6"><line x1={s} y1={m} x2={e} y2={m} /><line x1={m} y1={s} x2={m} y2={e} /><line x1={s} y1={s} x2={e} y2={e} /><line x1={e} y1={s} x2={s} y2={e} /></g>
    </svg>
  );
}

export default function Writer({ ch, script = 'hanzi', mode = 'trace', onDone, onStart, label }) {
  const box = useRef(null), host = useRef(null), writer = useRef(null), run = useRef(0);
  const [px, setPx] = useState(280);
  const [st, setSt] = useState({ phase: 'loading', total: 0, done: 0, mistakes: 0 });
  const done = useRef(onDone); done.current = onDone;

  // размер поля — по ширине колонки, от 220 до 320 точек
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const fit = w => setPx(p => { const n = Math.max(220, Math.min(320, Math.floor(w))); return Math.abs(n - p) > 8 ? n : p; });
    fit(el.parentElement ? el.parentElement.clientWidth : 280);
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width));
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  }, []);

  const quiz = () => {
    const w = writer.current;
    if (!w) return;
    const id = run.current;
    setSt(s => ({ ...s, phase: 'quiz', done: 0, mistakes: 0 }));
    w.quiz({
      onCorrectStroke: d => { if (run.current === id) setSt(s => ({ ...s, done: d.strokeNum + 1, mistakes: d.totalMistakes })); },
      onMistake: d => { if (run.current === id) setSt(s => ({ ...s, mistakes: d.totalMistakes })); },
      onComplete: d => {
        if (run.current !== id) return;
        setSt(s => ({ ...s, phase: 'done', done: s.total, mistakes: d.totalMistakes }));
        if (done.current) done.current({ mistakes: d.totalMistakes });
      },
    });
  };
  const demo = (then = quiz) => {
    const w = writer.current;
    if (!w) return;
    const id = ++run.current;
    w.cancelQuiz();
    setSt(s => ({ ...s, phase: 'demo' }));
    w.hideCharacter({ duration: 0 });
    w.animateCharacter({ onComplete: () => { if (run.current !== id || !writer.current) return; w.hideCharacter({ duration: 250 }); setTimeout(() => { if (run.current === id) then(); }, 260); } });
  };
  const restart = () => { const w = writer.current; if (!w) return; run.current++; w.cancelQuiz(); w.hideCharacter({ duration: 0 }); quiz(); };

  useEffect(() => {
    let alive = true;
    const id = ++run.current;
    setSt({ phase: 'loading', total: 0, done: 0, mistakes: 0 });
    Promise.all([loadLib(), loadGlyph(ch, script)]).then(([HW, data]) => {
      if (!alive || !host.current) return;
      host.current.innerHTML = '';
      const css = getComputedStyle(box.current), c = n => css.getPropertyValue(n).trim();
      writer.current = HW.create(host.current, ch, {
        width: px, height: px, padding: PAD, renderer: 'svg',
        showCharacter: false, showOutline: mode !== 'memory',
        strokeColor: c('--wr-ink') || '#F5F7FA', outlineColor: c('--wr-outline') || '#34404B', drawingColor: c('--wr-pen') || '#D8FF5A',
        highlightColor: c('--wr-hint') || '#00C897', radicalColor: null,
        drawingWidth: Math.max(14, Math.round(px / 18)), strokeAnimationSpeed: 1.4, delayBetweenStrokes: 180, strokeHighlightSpeed: 2,
        showHintAfterMisses: mode === 'memory' ? 2 : 3, highlightOnComplete: true,
        charDataLoader: (_c, onLoad) => { onLoad(data); return data; },
      });
      setSt({ phase: 'ready', total: data.strokes.length, done: 0, mistakes: 0 });
      if (onStart) onStart({ strokes: data.strokes.length });
      if (run.current !== id) return;
      if (mode === 'trace' || mode === 'show') demo(mode === 'show' ? () => setSt(s => ({ ...s, phase: 'shown' })) : quiz);
      else quiz();
    }, () => { if (alive) setSt(s => ({ ...s, phase: 'error' })); });
    return () => {
      alive = false; run.current++;
      const w = writer.current; writer.current = null;
      try { if (w) w.cancelQuiz(); } catch { /* уже остановлен */ }
    };
  }, [ch, script, mode, px]);   // eslint-disable-line react-hooks/exhaustive-deps

  const { phase, total, done: n, mistakes } = st;
  const status = phase === 'loading' ? 'Загружаем знак…'
    : phase === 'error' ? 'Не удалось загрузить знак. Проверьте соединение.'
      : phase === 'demo' ? 'Смотрите порядок черт'
        : phase === 'shown' ? `${total} ${plural(total, ['черта', 'черты', 'черт'])}`
          : phase === 'done' ? (mistakes ? `Готово. Ошибок в чертах: ${mistakes}` : 'Готово, без ошибок')
            : `Черта ${Math.min(n + 1, total)} из ${total}${mistakes ? ` · ошибок: ${mistakes}` : ''}`;
  return (
    <div className="wr" ref={box} data-phase={phase} data-mode={mode} data-char={ch}>
      <div className="wr-pad" style={{ width: px, height: px }} role="img" aria-label={label || `Поле для письма: ${ch}`}>
        <Grid px={px} script={script} />
        <div className="wr-host" ref={host} />
      </div>
      <p className="wr-status" id="wr-status" aria-live="polite">{status}</p>
      <div className="row wr-tools">
        <button type="button" className="btn btn-ghost btn-sm" id="wr-demo" disabled={phase === 'loading' || phase === 'error' || phase === 'demo'}
          onClick={() => demo(mode === 'show' ? () => setSt(s => ({ ...s, phase: 'shown' })) : quiz)}><Icon name="play" size={15} />Порядок черт</button>
        {mode !== 'show' && <button type="button" className="btn btn-ghost btn-sm" id="wr-again" disabled={phase === 'loading' || phase === 'error' || phase === 'demo'} onClick={restart}><Icon name="rotate-ccw" size={15} />Заново</button>}
      </div>
    </div>
  );
}
