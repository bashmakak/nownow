/* Знак-молния, логотип и общие SVG-определения (градиенты, размытие для светового луча). */
const BOLT = 'M63 4 L12 58 L41 58 L31 96 L88 36 L58 36 Z';
const NESTED_FROM = 22; // с этого размера (px) показываем знак со вложенной молнией
export function Defs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nv-g" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#D8FF5A" /><stop offset=".55" stopColor="#7BE87E" /><stop offset="1" stopColor="#00C897" />
        </linearGradient>
        <linearGradient id="nv-gs" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#00C897" stopOpacity="0" /><stop offset=".55" stopColor="#00C897" stopOpacity=".85" /><stop offset="1" stopColor="#D8FF5A" />
        </linearGradient>
        <filter id="nv-b2" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="1.4" /></filter>
        <filter id="nv-b6" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id="nv-b12" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="14" /></filter>
        {/* знак: молния, внутри которой вырезана такая же молния поменьше */}
        <mask id="nv-m" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120">
          <rect x="-10" y="-10" width="120" height="120" fill="#fff" />
          <path d={BOLT} transform="translate(49.5 48.5) scale(.44) translate(-49.5 -48.5)" fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
        </mask>
        <g id="nv-bolt" mask="url(#nv-m)"><path d={BOLT} strokeLinejoin="round" strokeWidth="7" /></g>
        {/* упрощённый знак для мелких размеров, где вложенная молния не читается */}
        <path id="nv-bolt-s" d={BOLT} strokeLinejoin="round" strokeWidth="7" />
      </defs>
    </svg>
  );
}

export function Mark({ size = 24, fill = 'url(#nv-g)', className = '' }) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <use href={size >= NESTED_FROM ? '#nv-bolt' : '#nv-bolt-s'} fill={fill} stroke={fill} />
    </svg>
  );
}

export const Wordmark = () => <span className="wm">Now<b>Now</b></span>;

export function Lockup({ className = '', small = false }) {
  return <span className={`lock ${className}`}><Mark size={small ? 20 : 24} /><Wordmark /></span>;
}

/* Световой луч: фирменный приём для hero и финального блока */
export function HeroFx() {
  return (
    <div className="hero-fx" aria-hidden="true">
      <div className="glow" />
      <svg viewBox="0 0 1200 600" preserveAspectRatio="none">
        <polygon points="560,600 1200,250 1200,292 640,600" fill="url(#nv-gs)" opacity=".5" filter="url(#nv-b12)" />
        <polygon className="streak-core" points="610,600 1200,268 1200,276 628,600" fill="url(#nv-gs)" filter="url(#nv-b2)" />
        {/* вспышка, которая время от времени пробегает по лучу */}
        <line className="beam-pulse" x1="619" y1="600" x2="1200" y2="272" pathLength="100" />
      </svg>
    </div>
  );
}
