/* ===== Искры: короткий всплеск частиц на общем холсте =====
   Частицы — осколки светового луча в цветах бренда. Холст создаётся при первом всплеске, лежит поверх
   страницы и не перехватывает нажатия. При настройке «уменьшить движение» ничего не рисуется. */
const COLORS = ['#D8FF5A', '#00C897', '#7BE87E', '#F5F7FA'];
const still = () => typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas = null, ctx = null, parts = [], raf = 0, last = 0;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  const fit = () => {
    const r = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * r; canvas.height = window.innerHeight * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  };
  fit();
  window.addEventListener('resize', fit);
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  parts = parts.filter(p => p.life < p.ttl);
  for (const p of parts) {
    p.life += dt;
    p.vy += p.g * dt; p.vx *= 0.985; p.vy *= 0.985;
    p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.spin * dt;
    const k = 1 - p.life / p.ttl;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.6);
    ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.fillStyle = p.c;
    // осколок луча: вытянутый скошенный четырёхугольник
    ctx.beginPath();
    ctx.moveTo(-p.w / 2, p.h / 2); ctx.lineTo(-p.w / 2 + p.skew, -p.h / 2); ctx.lineTo(p.w / 2 + p.skew, -p.h / 2); ctx.lineTo(p.w / 2, p.h / 2);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (parts.length) raf = requestAnimationFrame(frame);
  else { raf = 0; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
}

/* Всплеск из точки (x, y). count — число частиц, power — начальная скорость, spread — раствор в радианах, angle — направление */
export function burst(x, y, { count = 14, power = 260, spread = Math.PI * 2, angle = -Math.PI / 2, gravity = 620, ttl = 0.9, size = 1 } = {}) {
  if (still()) return;
  ensure();
  for (let i = 0; i < count; i++) {
    const a = angle + (Math.random() - 0.5) * spread, v = power * (0.45 + Math.random() * 0.75);
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity, a: Math.random() * 6.28, spin: (Math.random() - 0.5) * 12,
      w: (3 + Math.random() * 4) * size, h: (8 + Math.random() * 12) * size, skew: 3 * size, c: COLORS[i % COLORS.length],
      life: 0, ttl: ttl * (0.7 + Math.random() * 0.6),
    });
  }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}

/* Искры от элемента: для верного ответа */
export function sparkFrom(el, opts) {
  if (!el || still()) return;
  const r = el.getBoundingClientRect();
  burst(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2, { count: 10, power: 190, ttl: 0.7, size: 0.8, ...opts });
}

/* Большой всплеск: урок пройден, новый уровень */
export function celebrate() {
  if (still()) return;
  const w = window.innerWidth, h = window.innerHeight;
  burst(w * 0.5, h * 0.32, { count: 46, power: 520, ttl: 1.5, gravity: 520, size: 1.15 });
  setTimeout(() => burst(w * 0.22, h * 0.42, { count: 22, power: 420, spread: 2.2, angle: -1.1, ttl: 1.3 }), 140);
  setTimeout(() => burst(w * 0.78, h * 0.42, { count: 22, power: 420, spread: 2.2, angle: -2.05, ttl: 1.3 }), 260);
}
