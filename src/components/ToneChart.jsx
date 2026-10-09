import { useEffect, useRef, useState } from 'react';
import { currentAudio } from '../lib/audio.js';

/* ===== Схема тонов путунхуа =====
   Как в учебниках: высота голоса по шкале от 1 (низко) до 5 (высоко). Первый тон 5–5, второй 3–5,
   третий 2–1–4, четвёртый 5–1. ToneChart — вся схема или один тон крупно. Нажатие на тон запускает
   точку «голоса», которая бежит по линии вместе со звуком (onPlay — проиграть звук). pulse — внешний
   повод запустить точку ещё раз (например, нажали на пример). ToneIcon — маленький рисунок тона. */

const CONTOUR = { 1: [[0, 5], [1, 5]], 2: [[0, 3], [1, 5]], 3: [[0, 2], [0.42, 1], [1, 4]], 4: [[0, 5], [1, 1]] };
export const TONE_MARK = { 1: 'ˉ', 2: 'ˊ', 3: 'ˇ', 4: 'ˋ' };

/* Путь тона в прямоугольнике x0…x0+w, уровни 1…5 → y через ly */
function path(tone, x0, w, ly) {
  const pts = CONTOUR[tone].map(([t, l]) => [x0 + t * w, ly(l)]);
  if (pts.length === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  const [a, b, c] = pts;            // третий тон: плавно вниз до нижней точки и вверх, ниже уровня 1 не уходит
  const k1 = [a[0] + (b[0] - a[0]) * 0.3, b[1]], k2 = [b[0] + (c[0] - b[0]) * 0.45, b[1]];
  return `M${a[0]} ${a[1]} Q${k1[0]} ${k1[1]} ${b[0]} ${b[1]} Q${k2[0]} ${k2[1]} ${c[0]} ${c[1]}`;
}

/* Сколько идёт точка: по длине звука, если он играет, иначе около секунды */
const durOf = el => (el && Number.isFinite(el.duration) && el.duration > 0 ? Math.max(650, Math.min(1500, el.duration * 1000 / (el.playbackRate || 1) - 120)) : 950);

export default function ToneChart({ only = null, labels = ['mā', 'má', 'mǎ', 'mà'], onPlay = null, pulse = 0, autoplay = false }) {
  const tones = only ? [only] : [1, 2, 3, 4];
  const col = only ? 120 : 64, gap = only ? 0 : 18, left = 34, top = 14, step = 26;
  const W = left + tones.length * col + (tones.length - 1) * gap + 12, H = top + step * 4 + 46;
  const ly = l => top + (5 - l) * step;
  const paths = useRef({}), dot = useRef(null), raf = useRef(0), timers = useRef([]);
  const [active, setActive] = useState(null);

  const run = (n, dur) => {
    cancelAnimationFrame(raf.current);
    const p = paths.current[n], d = dot.current;
    if (!p || !d) return;
    const L = p.getTotalLength(), t0 = performance.now();
    setActive(n);
    const frame = now => {
      const k = Math.min(1, (now - t0) / dur), pt = p.getPointAtLength(L * k);
      d.setAttribute('cx', pt.x); d.setAttribute('cy', pt.y); d.style.opacity = '1';
      if (k < 1) raf.current = requestAnimationFrame(frame);
      else timers.current.push(setTimeout(() => { d.style.opacity = '0'; setActive(null); }, 260));
    };
    raf.current = requestAnimationFrame(frame);
  };
  // точка стартует, когда звук действительно зазвучал; если звука нет — сразу
  const go = (n, sound = true) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (sound && onPlay) onPlay(n);
    const el = sound && onPlay ? currentAudio() : null;
    if (el && !el.ended) {
      let started = false;
      const start = () => { if (!started) { started = true; run(n, durOf(el)); } };
      el.addEventListener('playing', start, { once: true });
      timers.current.push(setTimeout(start, 450));
    } else run(n, 950);
  };
  useEffect(() => { if (autoplay && only) timers.current.push(setTimeout(() => go(only), 350)); }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pulse && only) go(only, false); }, [pulse]);                                       // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { cancelAnimationFrame(raf.current); timers.current.forEach(clearTimeout); }, []);

  return (
    <figure className={`lg-tchart ${only ? 'one' : 'all'}`} data-only={only || undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={only ? `Схема ${only}-го тона: высота голоса от 1 до 5` : 'Схема четырёх тонов: высота голоса от 1 до 5'}>
        <g className="grid" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(l => (
            <g key={l}>
              <line x1={left - 6} x2={W - 6} y1={ly(l)} y2={ly(l)} />
              <text className="lv" x={left - 14} y={ly(l) + 4} textAnchor="middle">{l}</text>
            </g>
          ))}
        </g>
        {tones.map((n, k) => {
          const x0 = left + k * (col + gap) + 6, w = col - 12;
          return (
            <g key={n} className={`t t${n} ${active === n ? 'on' : ''}`} role="button" tabIndex={0} data-tone={n}
              aria-label={onPlay ? `${n}-й тон: послушать ${labels[n - 1]}` : `${n}-й тон: показать движение голоса`}
              onClick={() => go(n)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(n); } }}>
              <rect className="hit" x={x0 - 6} y={top - 10} width={col} height={step * 4 + 52} rx="10" />
              <path className="c" d={path(n, x0, w, ly)} pathLength="1" ref={el => { paths.current[n] = el; }} />
              <text className="lab" x={x0 + w / 2} y={H - 18} textAnchor="middle">{labels[n - 1]}</text>
              <text className="num" x={x0 + w / 2} y={H - 3} textAnchor="middle">{n}-й тон</text>
            </g>
          );
        })}
        <circle className="dot" r="8" cx="-20" cy="-20" ref={dot} aria-hidden="true" />
      </svg>
    </figure>
  );
}

/* Маленький рисунок тона: рядом с вариантом ответа */
export function ToneIcon({ tone }) {
  if (!CONTOUR[tone]) return null;
  return (
    <svg className="lg-ticon" viewBox="0 0 26 18" aria-hidden="true">
      <path d={path(tone, 3, 20, l => 2 + (5 - l) * 3.5)} />
    </svg>
  );
}
