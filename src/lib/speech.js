import { useEffect, useState } from 'react';
import { audioUrl, hasAudio, playUrl, stopAudio } from './audio.js';

/* ===== Озвучка фраз =====
   Сначала — свои файлы сайта (lib/audio.js): записи носителей и синтез, собранные заранее. Если у трека файлов нет
   или для фразы файла не нашлось, фразу читает синтезатор речи браузера или системы.
   Голос выбирается по языку; для китайского — путунхуа (zh-CN), кантонский (zh-HK) не подходит.
   Голоса, которые работают на самом устройстве, предпочтительнее: сетевые голоса отправляют текст фразы
   на сервер разработчика браузера (см. политику конфиденциальности).

   Если подходящего голоса нет, задания на слух заменяются заданиями на чтение (lib/lang-engine.js).
   Когда появятся записи носителей, их можно подставить в speak(): интерфейс уроков не изменится. */

const ok = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
const norm = s => String(s || '').toLowerCase().replace(/_/g, '-');

/* Насколько голос подходит языку: 0 — не подходит */
function fit(v, lang) {
  const l = norm(v.lang), want = norm(lang);
  if (want.startsWith('zh')) {
    if (/^(zh-hk|yue|zh-yue)/.test(l) || /cantonese|粤/.test(norm(v.name))) return 0;
    if (l === 'zh-cn' || l === 'cmn-hans-cn' || l === 'zh-hans-cn' || l === 'cmn-cn') return 3;
    if (l === 'zh' || l.startsWith('cmn') || l.startsWith('zh-hans')) return 2;
    if (l === 'zh-tw' || l.startsWith('zh-hant') || l.startsWith('zh-')) return 1;
    return 0;
  }
  if (l === want) return 3;
  return l.split('-')[0] === want.split('-')[0] ? 2 : 0;
}
export function pickVoice(voices, lang) {
  let best = null, top = 0;
  voices.forEach(v => {
    const f = fit(v, lang) * 2 + (v.localService ? 1 : 0);
    if (fit(v, lang) && f > top) { best = v; top = f; }
  });
  return best;
}

let voices = [];
let settled = false;
const subs = new Set();
function refresh() {
  if (!ok()) { settled = true; return; }
  voices = window.speechSynthesis.getVoices() || [];
  if (voices.length) settled = true;
  subs.forEach(f => f());
}
if (ok()) {
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
  // некоторые браузеры так и не сообщают о голосах: ждём недолго и считаем, что их нет
  setTimeout(() => { settled = true; refresh(); }, 1500);
}

/* Состояние голоса для языка: { status: 'checking' | 'ready' | 'none', voice }.
   У трека со своими файлами голос есть всегда: voice — метка FILES */
export const FILES = { name: 'files', files: true };
export function useVoice(lang) {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  if (hasAudio(lang)) return { status: 'ready', voice: FILES };
  const voice = ok() ? pickVoice(voices, lang) : null;
  return { status: voice ? 'ready' : settled || !ok() ? 'none' : 'checking', voice };
}

/* Прочитать фразу или слог. py — пиньинь: по нему находится запись слога. slow — медленнее.
   Возвращает false, если ни файла, ни голоса нет */
export function speak(text, lang, { slow = false, voice, py } = {}) {
  const url = audioUrl(lang, { zh: text, py });
  if (url) { if (ok()) window.speechSynthesis.cancel(); playUrl(url, { slow }); return true; }
  if (!ok()) return false;
  stopAudio();
  const v = voice && !voice.files ? voice : pickVoice(voices, lang);
  if (!v) return false;
  const s = window.speechSynthesis;
  s.cancel();
  const u = new window.SpeechSynthesisUtterance(norm(lang).startsWith('zh') ? String(text).replace(/\s+/g, '') : String(text));
  u.lang = v.lang || lang; u.voice = v; u.rate = slow ? 0.55 : 0.85;
  s.speak(u);
  return true;
}
export const stopSpeech = () => { stopAudio(); if (ok()) window.speechSynthesis.cancel(); };
