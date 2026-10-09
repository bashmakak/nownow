import { keysFor } from './audio-keys.js';

/* ===== Звуковые файлы языковых треков =====
   Слоги, слова и фразы лежат на сайте: public/audio/<код>/*.mp3, список — src/data/lang/<код>-audio.js
   (собирает scripts/audio/make_audio.py). Трек регистрирует свой список при загрузке, и speak() из lib/speech.js
   сначала ищет файл, а голос браузера берёт, только если файла нет. */

const banks = {};
const norm = lang => String(lang || '').toLowerCase().split('-')[0];
export function registerAudio(lang, manifest, base) { banks[norm(lang)] = { manifest: manifest || {}, base }; }
export const hasAudio = lang => Boolean(banks[norm(lang)]);
export function audioUrl(lang, item) {
  const b = banks[norm(lang)];
  if (!b) return null;
  for (const k of keysFor(item)) if (b.manifest[k]) return b.base + b.manifest[k];
  return null;
}

let current = null;
/* Звук, который играет сейчас: по нему анимации подстраиваются под длительность */
export const currentAudio = () => current;
export function stopAudio() {
  if (current) { try { current.pause(); } catch { /* уже остановлен */ } current = null; }
}
/* Проиграть файл. slow — медленнее, высота голоса сохраняется. Возвращает обещание: true, если звук пошёл */
export function playUrl(url, { slow = false } = {}) {
  stopAudio();
  const a = new Audio(url);
  a.preservesPitch = true;
  a.playbackRate = slow ? 0.7 : 1;
  current = a;
  if (typeof window !== 'undefined') window.__nnAudio = (window.__nnAudio || []).concat({ url, rate: a.playbackRate });   // для проверки в тестах
  const p = a.play();
  return p && p.then ? p.then(() => true, () => false) : Promise.resolve(true);
}
/* Заранее скачать файлы урока, чтобы звук начинался без паузы */
const warm = new Set();
export function preload(urls) {
  urls.filter(u => u && !warm.has(u)).slice(0, 60).forEach(u => {
    warm.add(u);
    const a = new Audio(); a.preload = 'auto'; a.src = u;
  });
}
