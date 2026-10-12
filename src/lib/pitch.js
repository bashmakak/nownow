/* ===== Высота голоса: тренажёр тонов =====
   Всё считается на устройстве, звук никуда не отправляется и не сохраняется.
   track() — высота голоса по кадрам (алгоритм YIN), contourOf() — рисунок тона в полутонах,
   judge() — подходит ли рисунок к нужному тону и что подсказать. */

const SR = 16000;                 // анализ на 16 кГц: голосу хватает, считать быстрее
const FRAME = 640, HOP = 160;     // кадр 40 мс, шаг 10 мс

/* Понизить частоту до 16 кГц: усреднение соседних отсчётов (заодно сглаживает шум) */
export function downsample(x, sr) {
  const k = Math.max(1, Math.round(sr / SR));
  if (k === 1) return x;
  const out = new Float32Array(Math.floor(x.length / k));
  for (let i = 0; i < out.length; i++) { let s = 0; for (let j = 0; j < k; j++) s += x[i * k + j]; out[i] = s / k; }
  return out;
}

/* Основной тон кадра: YIN (de Cheveigné, Kawahara, 2002). 0 — голоса нет */
export function yin(frame, { fmin = 70, fmax = 520, thr = 0.2 } = {}) {
  const tauMin = Math.floor(SR / fmax), tauMax = Math.min(Math.floor(SR / fmin), frame.length >> 1);
  const n = frame.length - tauMax, d = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let s = 0;
    for (let i = 0; i < n; i++) { const v = frame[i] - frame[i + tau]; s += v * v; }
    d[tau] = s;
  }
  let run = 0; d[0] = 1;
  for (let tau = 1; tau <= tauMax + 1; tau++) { run += d[tau]; d[tau] = run > 0 ? (d[tau] * tau) / run : 1; }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < thr) { while (t + 1 <= tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) {                                   // порог не пройден: берём глубокий минимум, если он есть
    let m = tauMin; for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[m]) m = t;
    if (d[m] > 0.35) return 0;
    tau = m;
  }
  if (tau < 1) return 0;
  const a = d[tau - 1], b = d[tau], c = d[tau + 1], den = a - 2 * b + c;
  const shift = den ? (a - c) / (2 * den) : 0;
  return SR / (tau + (Math.abs(shift) < 1 ? shift : 0));
}

const rmsOf = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };

/* Высота голоса по кадрам: [{ f, rms }] каждые 10 мс; f = 0 — пауза или шум */
export function track(samples, sr) {
  const x = downsample(samples, sr);
  const out = [];
  let peak = 0;
  for (let i = 0; i + FRAME <= x.length; i += HOP) peak = Math.max(peak, rmsOf(x, i, i + FRAME));
  const gate = Math.max(0.005, peak * 0.06);
  for (let i = 0; i + FRAME <= x.length; i += HOP) {
    const r = rmsOf(x, i, i + FRAME);
    out.push({ f: r >= gate ? yin(x.subarray(i, i + FRAME)) : 0, rms: r });
  }
  return out;
}

const median = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };
const st = f => 12 * Math.log2(f);

/* Рисунок тона: самый длинный отрезок голоса (разрывы короче 50 мс склеиваются), без скачков на октаву,
   сглаженный; полутоны от начала. Возвращает { st: [...], dur: секунд } или null, если голоса не было */
export function contourOf(frames, { points = 24 } = {}) {
  const v = frames.map(x => x.f > 0);
  const runs = [];
  for (let i = 0; i < v.length; i++) {
    if (!v[i]) continue;
    let j = i; while (j < v.length && v[j]) j++;
    // скрип внизу третьего тона рвёт голос на куски — склеиваем, если высота продолжается без скачка;
    // короткий всплеск после паузы с другой высотой (выдох, щелчок) — отдельный кусок
    const prev = runs[runs.length - 1];
    const jump = prev ? Math.abs(st(frames[i].f) - st(frames[prev[1] - 1].f)) : 99;
    const gap = prev ? i - prev[1] : 99, len = j - i;
    const glue = prev && ((gap <= 5 && jump <= 5) || (gap <= 5 && jump <= 8 && len >= 6) || (gap <= 25 && jump <= 4));
    if (glue) prev[1] = j; else runs.push([i, j]);
    i = j;
  }
  if (!runs.length) return null;
  const [a, b] = runs.reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m));
  if (b - a < 8) return { st: null, dur: (b - a) / 100 };
  let f = frames.slice(a, b).map(x => x.f);
  // пропуски внутри отрезка — по соседям
  for (let i = 0; i < f.length; i++) if (!f[i]) { let j = i; while (j < f.length && !f[j]) j++; const l = f[i - 1] || f[j] || 0, r = f[j] || l; for (let k = i; k < j; k++) f[k] = l + (r - l) * (k - i + 1) / (j - i + 1); i = j; }
  let s = f.map(st);
  // ошибки на октаву: за 10 мс голос не прыгает больше чем на 9 полутонов — такой скачок сдвигаем на октаву
  for (let i = 1; i < s.length; i++) { while (s[i] - s[i - 1] > 9) s[i] -= 12; while (s[i - 1] - s[i] > 9) s[i] += 12; }
  const mid = median(s);
  s = s.map(x => (x - mid > 10 ? x - 12 : mid - x > 10 ? x + 12 : x));      // и далеко от середины — тоже октава
  s = s.map((_, i) => median(s.slice(Math.max(0, i - 2), i + 3)));          // медианный фильтр
  // края голоса неустойчивы (переход от согласного, затухание): отрезаем 12% в начале и 8% в конце
  s = s.slice(Math.floor(s.length * 0.12), s.length - Math.floor(s.length * 0.08));
  const res = Array.from({ length: points }, (_, k) => {
    const pos = (k / (points - 1)) * (s.length - 1), i = Math.floor(pos), t = pos - i;
    return s[i] + ((s[i + 1] ?? s[i]) - s[i]) * t;
  });
  const base = res[0];
  return { st: res.map(x => Math.round((x - base) * 10) / 10), dur: (b - a) / 100, mean: Math.round(mid * 10) / 10 };
}

/* Подходит ли рисунок к тону и что подсказать. c — полутоны от начала */
export function judge(c, tone) {
  if (!c || !c.st) {
    return c && c.dur > 0
      ? { ok: false, code: 'short', tip: 'Слишком коротко: протяните слог чуть дольше, примерно на полсекунды.' }
      : { ok: false, code: 'silent', tip: 'Голос не расслышали: скажите слог громче или поднесите телефон ближе.' };
  }
  const s = c.st, n = s.length;
  const q = Math.max(2, Math.round(n / 5));
  const avg = a => a.reduce((p, x) => p + x, 0) / a.length;
  const start = avg(s.slice(0, q)), end = avg(s.slice(-q));
  const head = s.slice(0, Math.ceil(n * 0.3)), tail = s.slice(Math.floor(n * 0.7));
  let lo = Infinity, at = 0, hi = -Infinity, hiAt = 0;
  s.forEach((x, i) => { if (x < lo) { lo = x; at = i; } if (x > hi) { hi = x; hiAt = i; } });
  const range = hi - lo, d = end - start;
  const m = { start, end, lo, hi, range, d };
  if (tone === 1) {
    // начало слога после согласного часто ниже: ровность оцениваем без первой пятой части
    const body = s.slice(Math.round(n * 0.2)), r1 = Math.max(...body) - Math.min(...body), d1 = end - body[0];
    if (r1 <= 3 && Math.abs(d1) <= 2.2) return { ok: true, code: 'ok', tip: 'Ровно — так и надо: голос держится на одной высоте.', m };
    if (d1 > 0) return { ok: false, code: 'rise', tip: 'Голос поднимается. Первый тон — ровная нота: начните сразу высоко и держите.', m };
    return { ok: false, code: 'fall', tip: 'Голос падает к концу. Держите его ровно, как длинную ноту.', m };
  }
  if (tone === 2) {
    // подъём: самая низкая точка в начале или середине, к концу голос выше на 2,5 полутона и больше
    if (at <= n * 0.65 && Math.max(...tail) - lo >= 2.5 && end >= hi - 2.5 && d >= 1.5) return { ok: true, code: 'ok', tip: 'Голос уверенно идёт вверх — это второй тон.', m };
    if (d <= -2) return { ok: false, code: 'fall', tip: 'Голос идёт вниз, а нужно вверх — как в удивлённом «Да?».', m };
    return { ok: false, code: 'flat', tip: 'Подъём слишком слабый. Начните ниже и поднимите голос к концу слога.', m };
  }
  if (tone === 3) {
    // провал: голос опускается в середине и снова поднимается
    const dip = at > n * 0.15 && at < n * 0.88 && Math.max(...head) - lo >= 1.2 && Math.max(...tail) - lo >= 1.5;
    if (dip) return { ok: true, code: 'ok', tip: 'Голос опустился вниз и немного поднялся — это третий тон.', m };
    if (d >= 2.5) return { ok: false, code: 'rise', tip: 'Похоже на второй тон. Сначала опустите голос вниз, задержите и только потом чуть поднимите.', m };
    if (d <= -3) return { ok: false, code: 'fall', tip: 'Похоже на четвёртый тон: голос падает с высоты. Начните ниже и опуститесь ещё ниже, а в конце чуть поднимитесь.', m };
    return { ok: false, code: 'flat', tip: 'Провала почти нет. Опустите голос заметно ниже обычного, потом чуть поднимите.', m };
  }
  if (tone === 4) {
    // падение: вершина в начале, к концу голос ниже вершины на 3 полутона и больше
    if (hiAt <= n * 0.6 && hi - end >= 3 && end <= start + 0.5) return { ok: true, code: 'ok', tip: 'Резкое падение — это четвёртый тон.', m };
    if (d >= 2) return { ok: false, code: 'rise', tip: 'Голос идёт вверх, а нужно резко вниз — как в «Стой!».', m };
    return { ok: false, code: 'flat', tip: 'Падение слабое. Начните высоко и резко опустите голос.', m };
  }
  return { ok: false, code: 'tone', tip: '' };
}

/* Запись с микрофона по кускам: накапливает звук, считает громкость и высоту для живой линии.
   В конце record() отдаёт всё целиком для окончательного разбора. */
export class LiveTrack {
  constructor(sr) { this.sr = sr; this.parts = []; this.len = 0; this.x16 = []; this.pending = new Float32Array(0); this.frames = []; }
  push(chunk) {
    this.parts.push(chunk); this.len += chunk.length;
    const d = downsample(chunk, this.sr);
    const buf = new Float32Array(this.pending.length + d.length); buf.set(this.pending); buf.set(d, this.pending.length);
    let i = 0;
    for (; i + FRAME <= buf.length; i += HOP) {
      const r = rmsOf(buf, i, i + FRAME);
      this.frames.push({ f: r >= 0.01 ? yin(buf.subarray(i, i + FRAME)) : 0, rms: r });
    }
    this.pending = buf.slice(i);
    return rmsOf(chunk, 0, chunk.length);
  }
  samples() { const out = new Float32Array(this.len); let o = 0; this.parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }
}

/* Итог попытки: рисунок тона и оценка */
export function analyze(samples, sr, tone) {
  const c = contourOf(track(samples, sr));
  return { contour: c, ...judge(c, tone) };
}

/* ===== Интонация фразы (французский): голос к концу вопроса поднимается, к концу утверждения опускается =====
   В отличие от тона слога, здесь нужна вся фраза: берём все кадры с голосом по порядку, без пауз,
   убираем скачки на октаву, сглаживаем и меряем в полутонах от середины голоса. */
export function lineOf(frames, { points = 40 } = {}) {
  const f = frames.map(x => x.f).filter(x => x > 0);
  if (f.length < 15) return null;
  let s = f.map(st);
  for (let i = 1; i < s.length; i++) { while (s[i] - s[i - 1] > 9) s[i] -= 12; while (s[i - 1] - s[i] > 9) s[i] += 12; }
  const mid = median(s);
  s = s.map(x => (x - mid > 10 ? x - 12 : mid - x > 10 ? x + 12 : x));
  s = s.map((_, i) => median(s.slice(Math.max(0, i - 3), i + 4)));
  s = s.slice(0, s.length - Math.floor(s.length * 0.04));         // самый край — затухание
  const res = Array.from({ length: points }, (_, k) => {
    const pos = (k / (points - 1)) * (s.length - 1), i = Math.floor(pos), t = pos - i;
    return s[i] + ((s[i + 1] ?? s[i]) - s[i]) * t;
  });
  const m = median(res);
  return { st: res.map(x => Math.round((x - m) * 10) / 10), voiced: f.length / 100 };
}
/* rise — нужен подъём (вопрос «да или нет»), иначе — спокойное утверждение с понижением к концу */
export function judgeLine(c, rise) {
  if (!c) return { ok: false, code: 'silent', tip: 'Голос не расслышали: скажите фразу громче или поднесите телефон ближе.' };
  const s = c.st, n = s.length, avg = a => a.reduce((p, x) => p + x, 0) / a.length;
  // вопрос поднимается на последнем слоге, поэтому для подъёма берём вершину последней пятой части,
  // а для утверждения — её среднее: голос должен уйти вниз и не взлететь в конце
  const last = s.slice(Math.floor(n * 0.8)), body = avg(s.slice(Math.floor(n * 0.35), Math.floor(n * 0.75)));
  const peak = Math.max(...last) - body, d = avg(last) - body, m = { peak, body, d };
  if (rise) {
    if (peak >= 2.5) return { ok: true, code: 'ok', tip: 'Голос поднялся к концу — так и звучит вопрос.', m };
    return { ok: false, code: 'flat', tip: 'К концу голос не поднялся. Поднимите его на последнем слоге, как в удивлённом «Да?».', m };
  }
  if (d <= 0.5 && peak < 2.5) return { ok: true, code: 'ok', tip: 'Голос спокойно опустился к концу — так звучит утверждение.', m };
  return { ok: false, code: 'rise', tip: 'Голос к концу поднялся, и фраза прозвучала как вопрос. Опустите его на последнем слоге.', m };
}
/* Линия фразы из звука целиком (запись образца) */
export const analyzeLine = (samples, sr, rise) => { const c = lineOf(track(samples, sr)); return { contour: c, ...judgeLine(c, rise) }; };
