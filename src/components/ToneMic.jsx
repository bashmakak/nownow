import { useEffect, useRef, useState } from 'react';
import { LiveTrack, analyze, contourOf } from '../lib/pitch.js';
import { numbered, parseSyllable } from '../lib/pinyin.js';
import { speak, stopSpeech } from '../lib/speech.js';
import { CONTOUR } from './ToneChart.jsx';
import { Icon } from './Icon.jsx';

/* ===== Тренажёр тонов: скажите слог — и увидите линию своего голоса =====
   На схеме три линии: как тон устроен (пунктир), как его произносит носитель (тонкая) и как сказали вы.
   Все линии начинаются в одной точке: сравнивается движение голоса, а не то, насколько он высокий.
   Звук с микрофона разбирается на устройстве (lib/pitch.js) и никуда не отправляется и не сохраняется. */

export const micSupported = () => typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  && typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);

let pitchData = null;
const loadPitch = () => pitchData || (pitchData = fetch(`${import.meta.env.BASE_URL}audio/zh/pitch.json`).then(r => (r.ok ? r.json() : {}), () => ({})));

/* Запись: до 3,5 с, останавливается сама через полсекунды тишины после голоса */
const MAX_MS = 3500, QUIET_MS = 500, VOICE = 0.02, SILENT = 0.012;
/* Запись с микрофона. Для фразы (интонация во французском) паузы длиннее: maxMs и quietMs задаёт вызов */
export function useRecorder() {
  const st = useRef(null);
  const stop = () => {
    const s = st.current; st.current = null;
    if (!s) return null;
    try { s.proc.disconnect(); s.src.disconnect(); if (s.proc.port) s.proc.port.onmessage = null; } catch { /* уже отключено */ }
    s.stream.getTracks().forEach(t => t.stop());
    try { s.ctx.close(); } catch { /* уже закрыт */ }
    return s;
  };
  const start = async ({ onLevel, onFrames, onEnd, maxMs = MAX_MS, quietMs = QUIET_MS }) => {
    stop();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const live = new LiveTrack(ctx.sampleRate);
    const s = { stream, ctx, src, proc: null, live, t0: performance.now(), voiced: 0, quiet: 0 };
    st.current = s;
    const onChunk = chunk => {
      if (st.current !== s) return;
      const level = live.push(chunk);
      const now = performance.now(), ms = (chunk.length / ctx.sampleRate) * 1000;
      if (level > VOICE) { s.voiced += ms; s.quiet = 0; } else if (s.voiced && level < SILENT) s.quiet += ms;
      onLevel(Math.min(1, level * 8));
      onFrames(live.frames);
      if ((s.voiced > 150 && s.quiet > quietMs) || now - s.t0 > maxMs) { stop(); onEnd(s); }
    };
    // звук идёт в отдельный обработчик (AudioWorklet); старые браузеры — через ScriptProcessor
    const mute = ctx.createGain(); mute.gain.value = 0; mute.connect(ctx.destination);
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      await ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}mic-worklet.js`);   // public/mic-worklet.js
      const node = new AudioWorkletNode(ctx, 'nn-grab');
      node.port.onmessage = e => onChunk(e.data);
      s.proc = node;
      src.connect(node); node.connect(mute);
    } else {
      const proc = ctx.createScriptProcessor(2048, 1, 1);
      proc.onaudioprocess = e => onChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
      s.proc = proc;
      src.connect(proc); proc.connect(mute);     // без подключения к выходу обработка не идёт; звук на выход не попадает
    }
  };
  useEffect(() => () => { stop(); }, []);
  return { start, stop: () => stop() };
}

/* Схема: уровни 1–5, пунктир — как устроен тон, тонкая — носитель, яркая — вы */
const LV = 2.6;                                        // полутонов на одну ступень схемы
function MicChart({ tone, native, mine, live }) {
  const W = 300, H = 170, left = 30, top = 14, step = 30, x0 = left + 8, w = W - x0 - 14;
  const ly = l => top + (5 - Math.max(0.4, Math.min(5.6, l))) * step;
  const start = CONTOUR[tone][0][1];
  const line = st => st && st.length > 1 ? st.map((v, k) => `${k ? 'L' : 'M'}${(x0 + (k / (st.length - 1)) * w).toFixed(1)} ${ly(start + v / LV).toFixed(1)}`).join(' ') : '';
  const pts = CONTOUR[tone].map(([t, l]) => [x0 + t * w, ly(l)]);
  const ideal = pts.length === 2 ? `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`
    : `M${pts[0][0]} ${pts[0][1]} Q${pts[0][0] + (pts[1][0] - pts[0][0]) * 0.3} ${pts[1][1]} ${pts[1][0]} ${pts[1][1]} Q${pts[1][0] + (pts[2][0] - pts[1][0]) * 0.45} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`;
  const shown = mine || live;
  return (
    <figure className="lg-micchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Схема ${tone}-го тона и линия вашего голоса`}>
        {[1, 2, 3, 4, 5].map(l => (
          <g key={l} className="grid"><line x1={left - 4} x2={W - 8} y1={ly(l)} y2={ly(l)} /><text x={left - 14} y={ly(l) + 4} textAnchor="middle">{l}</text></g>
        ))}
        <path className="ideal" d={ideal} />
        {native && <path className="native" d={line(native)} />}
        {shown && <path className={`mine ${mine ? 'done' : 'live'}`} d={line(shown)} />}
      </svg>
      <figcaption>
        <span className="k ideal" />как устроен тон
        {native && <><span className="k native" />носитель</>}
        <span className="k mine" />вы
      </figcaption>
    </figure>
  );
}

export default function ToneMic({ py, lang, voice, onResult, compact = false }) {
  const { tone } = parseSyllable(py);
  const key = numbered(py);
  const [state, setState] = useState(micSupported() ? 'idle' : 'nomic');   // idle | rec | done | denied | nomic
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState(null);
  const [res, setRes] = useState(null);
  const [native, setNative] = useState(null);
  const [tries, setTries] = useState(0);
  const rec = useRecorder();
  const lastLive = useRef(0);
  useEffect(() => { let on = true; loadPitch().then(d => { if (on) setNative(d[key] || null); }); return () => { on = false; }; }, [key]);
  useEffect(() => { setRes(null); setLive(null); setTries(0); if (state !== 'nomic' && state !== 'denied') setState('idle'); rec.stop(); }, [py]);  // eslint-disable-line react-hooks/exhaustive-deps

  const finish = s => {
    const samples = s.live.samples();
    if (typeof window !== 'undefined' && window.__nnMicDebug) window.__nnMicDebug = { sr: s.ctx.sampleRate, samples: Array.from(samples) };   // только для тестов
    const r = analyze(samples, s.ctx.sampleRate, tone);
    setRes(r); setState('done'); setLevel(0); setTries(n => n + 1);
    if (onResult) onResult(r);
  };
  const go = async () => {
    if (state === 'rec') { const s = rec.stop(); if (s) finish(s); return; }
    stopSpeech(); setRes(null); setLive(null);
    try {
      setState('rec');
      await rec.start({
        onLevel: setLevel,
        onFrames: fr => { const now = performance.now(); if (now - lastLive.current > 120) { lastLive.current = now; const c = contourOf(fr); setLive(c && c.st ? c.st : null); } },
        onEnd: finish,
      });
    } catch (e) {
      setState(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'nomic');
    }
  };
  const listen = slow => { rec.stop(); if (voice) speak('', lang, { voice, py, slow }); };
  const verdict = res && (res.ok ? 'ok' : res.code === 'silent' || res.code === 'short' ? 'none' : 'bad');
  return (
    <div className={`lg-mic ${compact ? 'compact' : ''}`} id="lg-mic" data-state={state} data-verdict={verdict || undefined}>
      <div className="lg-mic-head">
        <span className="lg-pyb" id="lg-mic-py">{py}</span>
        {voice && <div className="lg-mic-listen">
          <button type="button" className="lg-say" id="lg-mic-play" onClick={() => listen(false)} aria-label="Послушать носителя"><Icon name="volume-2" size={18} /></button>
          <button type="button" className="lg-say slow" onClick={() => listen(true)} aria-label="Послушать медленно"><Icon name="turtle" size={18} /></button>
        </div>}
      </div>
      <MicChart tone={tone} native={native} mine={res && res.contour && res.contour.st} live={state === 'rec' ? live : null} />
      {state === 'nomic' && <p className="lg-mic-tip" id="lg-mic-tip">Этот браузер не даёт доступа к микрофону. Тренажёр работает в Chrome, Safari, Firefox и Яндекс Браузере на телефоне и компьютере.</p>}
      {state === 'denied' && <p className="lg-mic-tip" id="lg-mic-tip">Нет доступа к микрофону. Разрешите его для этого сайта в настройках браузера и нажмите «Записать» ещё раз.</p>}
      {state === 'idle' && <p className="lg-mic-tip muted" id="lg-mic-tip">Послушайте носителя, потом нажмите «Записать» и скажите слог вслух.</p>}
      {state === 'rec' && <p className="lg-mic-tip" id="lg-mic-tip"><span className="lg-mic-dot" style={{ transform: `scale(${1 + level * 0.8})` }} />Говорите… Запись остановится сама.</p>}
      {state === 'done' && res && <p className={`lg-mic-tip ${verdict}`} id="lg-mic-tip"><b>{res.ok ? 'Получилось.' : verdict === 'none' ? 'Не расслышали.' : 'Пока не тот тон.'}</b> {res.tip}</p>}
      {(state === 'idle' || state === 'rec' || state === 'done' || state === 'denied') && (
        <div className="row lg-mic-btns">
          <button type="button" className={`btn ${state === 'rec' ? 'btn-secondary' : 'btn-primary'}`} id="lg-mic-rec" onClick={go}>
            <Icon name={state === 'rec' ? 'x' : 'mic'} size={17} />{state === 'rec' ? 'Стоп' : tries ? 'Ещё раз' : 'Записать'}
          </button>
        </div>
      )}
      <p className="lg-mic-privacy">Звук разбирается прямо на устройстве и никуда не отправляется.</p>
    </div>
  );
}
