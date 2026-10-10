import { useEffect, useId, useRef, useState } from 'react';

/* ===== Рот спереди: губы, зубы и язык для простых гласных =====
   Рисунок строится из нескольких чисел (ширина рта, высота раскрытия, округлость губ, растяжение уголков,
   толщина губ, сколько видно зубов и языка), поэтому рот плавно переходит из одной гласной в другую.
   Нижняя часть лица — нос, носогубные складки, подбородок — даёт масштаб: видно, что рот «настоящий». */

export const SHAPES = {
  rest: { w: 44, h: 0, r: 0, s: 0, lu: 11, ll: 14, tt: 0, tb: 0, tg: 0 },
  a: { w: 47, h: 44, r: 0.2, s: 0, lu: 9, ll: 12, tt: 9, tb: 0, tg: 0.9 },
  o: { w: 29, h: 31, r: 0.85, s: 0, lu: 13, ll: 15, tt: 4, tb: 0, tg: 0.35 },
  e: { w: 46, h: 17, r: 0.05, s: 2, lu: 9, ll: 11, tt: 7, tb: 3, tg: 0.25 },
  i: { w: 57, h: 9, r: 0, s: 6, lu: 7, ll: 9, tt: 5, tb: 4, tg: 0 },
  u: { w: 17, h: 14, r: 1, s: 0, lu: 15, ll: 17, tt: 0, tb: 0, tg: 0 },
  ü: { w: 17, h: 12, r: 1, s: 0, lu: 15, ll: 16, tt: 0, tb: 0, tg: 0.75 },
};
const KEYS = Object.keys(SHAPES.rest);
const mix = (a, b, k) => Object.fromEntries(KEYS.map(n => [n, a[n] + (b[n] - a[n]) * k]));
const f = v => Math.round(v * 10) / 10;

const CX = 120, CY = 96;
/* Контуры по числам: раскрытие рта, верхняя губа, все губы целиком */
function geometry(p) {
  const { w, r, s, lu, ll } = p, h = Math.max(p.h, 0.01);
  const L = [CX - w, CY - s], R = [CX + w, CY - s], T = [CX, CY - h * (0.28 + 0.14 * r)], B = [CX, CY + h * (0.72 - 0.14 * r)];
  const cv = 0.16 + 0.42 * r, kx = 0.5 + 0.06 * r;
  const opening = `M${f(L[0])} ${f(L[1])}`
    + ` C${f(L[0] + w * 0.18)} ${f(L[1] - h * cv)} ${f(CX - w * kx)} ${f(T[1])} ${f(T[0])} ${f(T[1])}`
    + ` C${f(CX + w * kx)} ${f(T[1])} ${f(R[0] - w * 0.18)} ${f(R[1] - h * cv)} ${f(R[0])} ${f(R[1])}`
    + ` C${f(R[0] - w * 0.18)} ${f(R[1] + h * (cv + 0.04))} ${f(CX + w * kx)} ${f(B[1])} ${f(B[0])} ${f(B[1])}`
    + ` C${f(CX - w * kx)} ${f(B[1])} ${f(L[0] + w * 0.18)} ${f(L[1] + h * (cv + 0.04))} ${f(L[0])} ${f(L[1])} Z`;
  // внешний контур губ: шире раскрытия, у округлённых губ — почти круг
  const W = w + 5 + 11 * r, oy = CY - s;
  const Lo = [CX - W, oy], Ro = [CX + W, oy];
  const bow = 3.2 * (1 - r) + 1;                              // «лук Купидона» сглаживается, когда губы вытянуты
  const P1 = [CX - W * 0.34, T[1] - lu - bow * 0.6], P2 = [CX + W * 0.34, P1[1]], D = [CX, T[1] - lu + bow];
  const Bo = [CX, B[1] + ll];
  const lift = lu * 0.55 + h * 0.18 * r;
  const upper = `M${f(Lo[0])} ${f(Lo[1])}`
    + ` C${f(Lo[0] + W * 0.12)} ${f(Lo[1] - lift)} ${f(P1[0] - W * 0.24)} ${f(P1[1])} ${f(P1[0])} ${f(P1[1])}`
    + ` C${f(P1[0] + W * 0.12)} ${f(P1[1])} ${f(D[0] - W * 0.08)} ${f(D[1] - 1)} ${f(D[0])} ${f(D[1])}`
    + ` C${f(D[0] + W * 0.08)} ${f(D[1] - 1)} ${f(P2[0] - W * 0.12)} ${f(P2[1])} ${f(P2[0])} ${f(P2[1])}`
    + ` C${f(P2[0] + W * 0.24)} ${f(P2[1])} ${f(Ro[0] - W * 0.12)} ${f(Ro[1] - lift)} ${f(Ro[0])} ${f(Ro[1])}`;
  const drop = ll + h * 0.5;
  const lower = ` C${f(Ro[0] - W * 0.06)} ${f(Ro[1] + drop * 0.85)} ${f(CX + W * 0.58)} ${f(Bo[1])} ${f(Bo[0])} ${f(Bo[1])}`
    + ` C${f(CX - W * 0.58)} ${f(Bo[1])} ${f(Lo[0] + W * 0.06)} ${f(Lo[1] + drop * 0.85)} ${f(Lo[0])} ${f(Lo[1])} Z`;
  // верхняя губа отдельно: от внешнего контура до верхнего края раскрытия
  const upperLip = `${upper} L${f(R[0])} ${f(R[1])}`
    + ` C${f(R[0] - w * 0.18)} ${f(R[1] - h * cv)} ${f(CX + w * kx)} ${f(T[1])} ${f(T[0])} ${f(T[1])}`
    + ` C${f(CX - w * kx)} ${f(T[1])} ${f(L[0] + w * 0.18)} ${f(L[1] - h * cv)} ${f(L[0])} ${f(L[1])} Z`;
  return { opening, lips: upper + lower, upperLip, L, R, T, B, W, Bo, oy };
}

/* Плавный переход между формами: числа меняются за ~0,45 с */
function useAnimated(target, { from = null, pulse = 0 } = {}) {
  const [p, setP] = useState(from || target);
  const cur = useRef(from || target), raf = useRef(0);
  const still = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = (to, ms, then) => {
    cancelAnimationFrame(raf.current);
    if (still) { cur.current = to; setP(to); if (then) then(); return; }
    const a = cur.current, t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms), e = 1 - (1 - k) ** 3;
      const v = mix(a, to, e); cur.current = v; setP(v);
      if (k < 1) raf.current = requestAnimationFrame(step); else if (then) then();
    };
    raf.current = requestAnimationFrame(step);
  };
  useEffect(() => { run(target, 450); return () => cancelAnimationFrame(raf.current); }, [target]);  // eslint-disable-line react-hooks/exhaustive-deps
  // «говорит»: рот чуть сильнее открывается и возвращается
  useEffect(() => { if (pulse) run({ ...target, h: target.h * 1.18 + 3 }, 170, () => run(target, 380)); }, [pulse]);  // eslint-disable-line react-hooks/exhaustive-deps
  return p;
}

export default function Mouth({ v, pulse = 0, animate = true, className = '' }) {
  const target = SHAPES[v] || SHAPES.rest;
  const p = useAnimated(target, { from: animate ? SHAPES.rest : null, pulse });
  const id = useId().replace(/:/g, '');
  const g = geometry(p);
  const open = p.h > 0.8;
  const tw = 8.5;                                             // ширина зуба
  const teeth = n => Array.from({ length: n }, (_, k) => CX + (k - (n - 1) / 2) * tw);
  const creases = p.r > 0.45 ? Array.from({ length: 12 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2 + 0.26, rx1 = p.w + 3, ry1 = p.h / 2 + 3, rx2 = g.W - 3, ry2 = (p.h / 2 + p.lu + p.ll) / 2 + 3;
    return [CX + Math.cos(a) * rx1, CY + 2 + Math.sin(a) * ry1, CX + Math.cos(a) * rx2, CY + 2 + Math.sin(a) * ry2];
  }) : [];
  const chin = g.Bo[1] + 20 + p.h * 0.25;
  return (
    <svg className={`lg-face ${className}`} viewBox="0 0 240 190" aria-hidden="true">
      <defs>
        <radialGradient id={`sk${id}`} cx="50%" cy="45%" r="75%"><stop offset="0" stopColor="#F0C8AC" /><stop offset="0.65" stopColor="#E3AE8F" /><stop offset="1" stopColor="#C98E70" /></radialGradient>
        <linearGradient id={`lp${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A85E62" /><stop offset="0.5" stopColor="#B86E6F" /><stop offset="1" stopColor="#C88481" /></linearGradient>
        <linearGradient id={`ul${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#97535A" /><stop offset="1" stopColor="#AA6367" /></linearGradient>
        <radialGradient id={`mo${id}`} cx="50%" cy="40%" r="65%"><stop offset="0" stopColor="#1A0709" /><stop offset="1" stopColor="#4A1A1F" /></radialGradient>
        <linearGradient id={`tg${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D5737A" /><stop offset="1" stopColor="#A9444D" /></linearGradient>
        <clipPath id={`cl${id}`}><path d={g.opening} /></clipPath>
        <filter id={`bl${id}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <rect x="0" y="0" width="240" height="190" rx="18" fill={`url(#sk${id})`} />
      {/* нос и складки — для масштаба */}
      <path d="M78 0 Q74 22 92 30 Q104 35 112 31 Q120 37 128 31 Q136 35 148 30 Q166 22 162 0 Z" fill="#DDA688" opacity="0.7" />
      <path d="M80 2 Q75 22 92 30" stroke="#B5745B" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M160 2 Q165 22 148 30" stroke="#B5745B" strokeWidth="2" fill="none" opacity="0.5" strokeLinecap="round" />
      <path d="M95 25 Q103 18 113 26 Q104 31 95 25 Z" fill="#6A372B" opacity="0.62" />
      <path d="M145 25 Q137 18 127 26 Q136 31 145 25 Z" fill="#6A372B" opacity="0.62" />
      <ellipse cx="120" cy="10" rx="20" ry="8" fill="#F7D8C2" opacity="0.5" filter={`url(#bl${id})`} />
      <path d={`M${f(CX - 6)} 34 L${f(CX - 7)} ${f(g.T[1] - p.lu - 4)} M${f(CX + 6)} 34 L${f(CX + 7)} ${f(g.T[1] - p.lu - 4)}`} stroke="#C2856A" strokeWidth="2.4" fill="none" opacity="0.28" filter={`url(#bl${id})`} />
      <path d={`M84 34 Q${f(CX - g.W - 24)} ${f(CY - 4)} ${f(CX - g.W - 14)} ${f(CY + 32)}`} stroke="#B97B60" strokeWidth="2" fill="none" opacity="0.26" strokeLinecap="round" />
      <path d={`M156 34 Q${f(CX + g.W + 24)} ${f(CY - 4)} ${f(CX + g.W + 14)} ${f(CY + 32)}`} stroke="#B97B60" strokeWidth="2" fill="none" opacity="0.26" strokeLinecap="round" />
      <path d={`M${f(CX - 22)} ${f(chin)} Q${CX} ${f(chin + 7)} ${f(CX + 22)} ${f(chin)}`} stroke="#B97B60" strokeWidth="2.2" fill="none" opacity="0.32" strokeLinecap="round" />
      {/* тень вокруг губ */}
      <path d={g.lips} fill="#9E5B48" opacity="0.28" filter={`url(#bl${id})`} transform="translate(0 2.5)" />
      {/* губы */}
      <path d={g.lips} fill={`url(#lp${id})`} />
      <path d={g.upperLip} fill={`url(#ul${id})`} />
      <path d={g.upperLip.split(' L')[0]} fill="none" stroke="#E9AE9A" strokeWidth="1.3" opacity="0.45" />
      <circle cx={f(g.L[0] - 2)} cy={f(g.L[1])} r="2.2" fill="#7A3B3A" opacity="0.35" filter={`url(#bl${id})`} />
      <circle cx={f(g.R[0] + 2)} cy={f(g.R[1])} r="2.2" fill="#7A3B3A" opacity="0.35" filter={`url(#bl${id})`} />
      {creases.map((c, k) => <line key={k} x1={f(c[0])} y1={f(c[1])} x2={f(c[2])} y2={f(c[3])} stroke="#8E3640" strokeWidth="1" opacity={f((p.r - 0.45) * 0.9)} strokeLinecap="round" />)}
      {open ? (
        <>
          <path d={g.opening} fill={`url(#mo${id})`} />
          <g clipPath={`url(#cl${id})`}>
            {p.tg > 0.02 && <ellipse cx={CX} cy={f(g.B[1] + 3)} rx={f(p.w * 0.78)} ry={f(Math.max(2, p.h * 0.42 * p.tg))} fill={`url(#tg${id})`} />}
            {p.tt > 0.3 && <g>
              <rect x={f(CX - p.w)} y={f(g.T[1] - 6)} width={f(p.w * 2)} height={f(p.tt + 6)} rx="2.5" fill="#F3EEE4" />
              {teeth(9).map((x, k) => <line key={k} x1={f(x + tw / 2)} y1={f(g.T[1])} x2={f(x + tw / 2)} y2={f(g.T[1] + p.tt)} stroke="#D3CBBE" strokeWidth="0.9" />)}
            </g>}
            {p.tb > 0.3 && <g>
              <rect x={f(CX - p.w)} y={f(g.B[1] - p.tb)} width={f(p.w * 2)} height={f(p.tb + 6)} rx="2.5" fill="#E9E3D7" />
              {teeth(9).map((x, k) => <line key={k} x1={f(x + tw / 2)} y1={f(g.B[1] - p.tb)} x2={f(x + tw / 2)} y2={f(g.B[1])} stroke="#CFC6B8" strokeWidth="0.9" />)}
            </g>}
          </g>
          <path d={g.opening} fill="none" stroke="#5B1E25" strokeWidth="1.6" opacity="0.7" />
        </>
      ) : (
        <path d={`M${f(g.L[0])} ${f(g.L[1])} Q${CX} ${f(CY + 2)} ${f(g.R[0])} ${f(g.R[1])}`} stroke="#6B2229" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      {/* блик на нижней губе */}
      <ellipse cx={CX} cy={f(g.Bo[1] - p.ll * 0.42)} rx={f(g.W * 0.32)} ry={f(Math.max(1.5, p.ll * 0.16))} fill="#FFFFFF" opacity="0.28" filter={`url(#bl${id})`} />
    </svg>
  );
}

/* ===== Рот сбоку: разрез, как в учебниках фонетики =====
   Видно то, чего не видно спереди: где поднята спинка языка (впереди или сзади, высоко или низко),
   насколько опущена челюсть и вытянуты ли губы. Профиль смотрит влево. */
export const SIDE = {
  rest: { jaw: 2, gap: 0, prot: 0, px: 122, py: 84 },
  a: { jaw: 20, gap: 17, prot: 0, px: 136, py: 104 },
  o: { jaw: 11, gap: 9, prot: 7, px: 152, py: 80 },
  e: { jaw: 10, gap: 8, prot: 0, px: 142, py: 79 },
  i: { jaw: 3, gap: 3, prot: -2, px: 98, py: 64 },
  u: { jaw: 6, gap: 4, prot: 10, px: 158, py: 66 },
  ü: { jaw: 4, gap: 3, prot: 10, px: 98, py: 65 },
};
const SKEYS = Object.keys(SIDE.rest);
const smix = (a, b, k) => Object.fromEntries(SKEYS.map(n => [n, a[n] + (b[n] - a[n]) * k]));

export function MouthSide({ v, animate = true, labels = true }) {
  const target = SIDE[v] || SIDE.rest;
  const [p, setP] = useState(animate ? SIDE.rest : target);
  const cur = useRef(animate ? SIDE.rest : target), raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const a = cur.current, t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 500), e = 1 - (1 - k) ** 3; const x = smix(a, target, e); cur.current = x; setP(x); if (k < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [v]);  // eslint-disable-line react-hooks/exhaustive-deps
  const id = useId().replace(/:/g, '');
  const { jaw: J, gap, prot, px, py } = p;
  const P = prot;
  // профиль лица: лоб и нос, верхняя губа, нижняя губа и подбородок опускаются вместе с челюстью
  const face = `M92 0 C88 12 60 22 40 33 C33 37 36 45 47 47 C54 48 60 50 63 54`
    + ` C${f(58 - P * 0.5)} 58 ${f(52 - P)} 63 ${f(51 - P)} 69 C${f(50 - P)} 75 ${f(53 - P * 0.7)} 79 ${f(58 - P * 0.5)} 81`
    + ` L${f(58 - P * 0.5)} ${f(82 + gap)} C${f(52 - P * 0.8)} ${f(85 + gap)} ${f(51 - P)} ${f(93 + J * 0.7)} ${f(56 - P * 0.6)} ${f(98 + J * 0.85)}`
    + ` C60 ${f(102 + J)} 63 ${f(104 + J)} 61 ${f(110 + J)} C57 ${f(120 + J)} 58 ${f(134 + J)} 70 ${f(142 + J)}`
    + ` C86 ${f(151 + J)} 112 ${f(152 + J * 0.6)} 128 ${f(160 + J * 0.4)} L134 200 L260 200 L260 0 Z`;
  // язык: кончик за нижними зубами, спинка поднята к самой высокой точке (px, py), корень уходит в глотку
  const tip = [73, 95 + J * 0.9];
  const tongue = `M${f(tip[0])} ${f(tip[1])} C${f(tip[0] + 10)} ${f(tip[1] - 16)} ${f(px - 34)} ${f(py + 2)} ${f(px)} ${f(py)}`
    + ` C${f(px + 30)} ${f(py - 1)} ${f(Math.max(px + 34, 172))} ${f(py + 24)} 172 ${f(Math.max(py + 46, 124))} C171 150 170 176 170 200`
    + ` L118 200 C108 ${f(178 + J * 0.4)} 94 ${f(150 + J * 0.8)} 84 ${f(126 + J)} C78 ${f(114 + J)} ${f(tip[0] - 4)} ${f(104 + J)} ${f(tip[0])} ${f(tip[1])} Z`;
  // воздух: под нёбом до задней стенки глотки и вниз по глотке
  const air = `M${f(60 - P * 0.4)} 81 C64 78 66 74 72 70 C80 62 94 55 112 53 C134 51 150 53 160 57 C170 61 178 66 183 72`
    + ` C187 78 188 86 188 98 C188 130 187 170 187 200 L160 200 L150 150 L${f(tip[0] + 6)} ${f(tip[1] + 6)}`
    + ` L64 ${f(88 + J)} C62 ${f(86 + gap)} 61 ${f(84 + gap)} ${f(60 - P * 0.4)} ${f(82 + gap)} Z`;
  // твёрдое нёбо — кость, мягкое нёбо с язычком
  const palate = `M68 72 C76 64 92 56 112 54 C134 52 150 54 160 57`;
  const velum = `M160 57 C170 60 178 64 184 70 C188 74 188 80 184 82 C180 84 176 80 172 74 C168 68 164 63 158 60 Z`;
  const upperTooth = `M60 67 C63 66 67 66 69 67 L68 81 C66 84 62 85 60 83 Z`;
  const lowerTooth = `M62 ${f(88 + J)} C64 ${f(86 + J)} 68 ${f(86 + J)} 70 ${f(88 + J)} L72 ${f(104 + J)} C70 ${f(106 + J)} 66 ${f(106 + J)} 65 ${f(104 + J)} Z`;
  const upperLip = `M63 54 C${f(58 - P * 0.6)} 58 ${f(52 - P)} 63 ${f(51 - P)} 69 C${f(50 - P)} 75 ${f(53 - P * 0.7)} 79 ${f(58 - P * 0.5)} 81 L66 81 C65 74 65 62 63 54 Z`;
  const lowerLip = `M${f(58 - P * 0.5)} ${f(82 + gap)} C${f(52 - P * 0.8)} ${f(85 + gap)} ${f(51 - P)} ${f(93 + J * 0.7)} ${f(56 - P * 0.6)} ${f(98 + J * 0.85)} C59 ${f(101 + J)} 62 ${f(103 + J)} 65 ${f(101 + J)} C67 ${f(95 + J * 0.8)} 66 ${f(88 + gap)} 64 ${f(82 + gap)} Z`;
  return (
    <svg className="lg-side" viewBox="0 0 260 200" aria-hidden="true">
      <defs>
        <linearGradient id={`hs${id}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ECBFA4" /><stop offset="1" stopColor="#DCA486" /></linearGradient>
        <linearGradient id={`tn${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#DA7880" /><stop offset="1" stopColor="#B04E59" /></linearGradient>
        <radialGradient id={`ai${id}`} cx="40%" cy="40%" r="80%"><stop offset="0" stopColor="#2A1014" /><stop offset="1" stopColor="#48202A" /></radialGradient>
        <clipPath id={`hc${id}`}><rect x="0" y="0" width="260" height="200" rx="18" /></clipPath>
        <filter id={`sb${id}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <g clipPath={`url(#hc${id})`}>
        <rect x="0" y="0" width="260" height="200" fill="#F5E9E0" />
        <path d={face} fill={`url(#hs${id})`} />
        <path d={face} fill="none" stroke="#B5765C" strokeWidth="1.6" />
        <path d={air} fill={`url(#ai${id})`} />
        <path d={palate} fill="none" stroke="#F3DCCD" strokeWidth="6" strokeLinecap="round" />
        <path d={palate} fill="none" stroke="#9A5A55" strokeWidth="1.4" strokeLinecap="round" transform="translate(0 3)" />
        <path d={velum} fill="#D88E86" stroke="#9A5A55" strokeWidth="1.2" />
        <path d={tongue} fill={`url(#tn${id})`} stroke="#8A3842" strokeWidth="1.5" />
        <ellipse cx={f(px + 4)} cy={f(py + 14)} rx="22" ry="7" fill="#F2A9AE" opacity="0.35" filter={`url(#sb${id})`} />
        <path d={upperTooth} fill="#F6F1E8" stroke="#BDB4A5" strokeWidth="1" />
        <path d={lowerTooth} fill="#EFE9DE" stroke="#BDB4A5" strokeWidth="1" />
        <path d={upperLip} fill="#B46A6C" />
        <path d={lowerLip} fill="#C27D7B" />
        <circle cx={f(px)} cy={f(py - 1)} r="4.5" fill="#D8FF5A" stroke="#0B0F14" strokeWidth="1.5" />
        {labels && <g className="lg-side-lab" fontSize="10.5" fontFamily="Inter, system-ui, sans-serif">
          <text x="98" y="44" fill="#6B4438">нёбо</text>
          <text x="128" y="166" fill="#FFFFFF" opacity="0.9">язык</text>
          <text x="196" y="150" fill="#6B4438">глотка</text>
        </g>}
      </g>
    </svg>
  );
}
