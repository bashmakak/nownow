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

