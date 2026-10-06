/* Знак-молния, логотип и общие SVG-определения (градиенты, размытие для светового луча). */
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
        <path id="nv-bolt" d="M63 4 L12 58 L41 58 L31 96 L88 36 L58 36 Z" strokeLinejoin="round" strokeWidth="7" />
      </defs>
    </svg>
  );
}

export function Mark({ size = 24, fill = 'url(#nv-g)', className = '' }) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <use href="#nv-bolt" fill={fill} stroke={fill} />
    </svg>
  );
}

export const Wordmark = () => <span className="wm">Now<b>Now</b></span>;

export function Lockup({ className = '' }) {
  return <span className={`lock ${className}`}><Mark /><Wordmark /></span>;
}

/* Световой луч: фирменный приём для hero и финального блока */
export function HeroFx() {
  return (
    <div className="hero-fx" aria-hidden="true">
      <div className="glow" />
      <svg viewBox="0 0 1200 600" preserveAspectRatio="none">
        <polygon points="560,600 1200,250 1200,292 640,600" fill="url(#nv-gs)" opacity=".5" filter="url(#nv-b12)" />
        <polygon className="streak-core" points="610,600 1200,268 1200,276 628,600" fill="url(#nv-gs)" filter="url(#nv-b2)" />
      </svg>
    </div>
  );
}
