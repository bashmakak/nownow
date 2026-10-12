/* ===== Французский: общие функции для схем, проверки данных и сборщика звука =====
   Без React, чтобы их могли использовать scripts/validate-lang.mjs и scripts/audio-list.mjs. */

/* Текст для озвучки: без дужек связок, точек между слогами и скобок у немых букв */
export const frPlain = s => String(s || '').replace(/‿/g, ' ').replace(/·/g, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();

/* Схемы к правилам (components/FrDemos.jsx) и к звукам */
export const FR_DEMOS = ['fr-stress', 'fr-silent', 'fr-nasal', 'fr-lips', 'fr-combo', 'fr-link', 'fr-count', 'fr-homo', 'fr-num', 'fr-floors', 'fr-steak'];

/* Число словами, 0–99, в написании Франции (soixante-dix, quatre-vingts) */
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
export function frNumber(n) {
  if (n < 20) return UNITS[n];
  if (n < 70) { const t = TENS[Math.floor(n / 10)], u = n % 10; return u === 0 ? t : u === 1 ? `${t} et un` : `${t}-${UNITS[u]}`; }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${UNITS[n - 60]}`;
  return n === 80 ? 'quatre-vingts' : `quatre-vingt-${UNITS[n - 80]}`;
}
/* Схема «лифт»: этажи по-французски и по-нашему */
export const FLOORS = [['rez-de-chaussée', 'первый'], ['premier étage', 'второй'], ['deuxième étage', 'третий'], ['troisième étage', 'четвёртый']];
/* Схема «прожарка»: от почти сырого до хорошо прожаренного */
export const STEAK = [['bleu', 'почти сырой', '#B3182C'], ['saignant', 'с кровью', '#C8343F'], ['à point', 'средней прожарки, розовый внутри', '#C76F68'], ['bien cuit', 'хорошо прожаренный', '#8A5A44']];
export const FR_VIEWS = ['', 'a', 'i', 'o', 'u', 'y', 'é', 'è', 'ø', 'œ', 'ə', 'nasal-a', 'nasal-o', 'nasal-e', 'r'];

/* Слова, которые звучат в схеме правила: их звук должен быть собран */
export function frDemoWords(rule) {
  const { demo, w = [], combo = [] } = rule;
  if (demo === 'fr-nasal') return w.flatMap(([a, b]) => [a, b]);
  if (demo === 'fr-lips') return w.map(x => x[2]);
  if (demo === 'fr-link') return w.map(x => x[0]);
  if (demo === 'fr-combo') return combo.flatMap(x => x[2]);
  if (demo === 'fr-homo') return combo.map(x => x[1][0][0]);
  if (demo === 'fr-count') return w.map(x => (Array.isArray(x) ? x[1] : x));
  if (demo === 'fr-num') return Array.from({ length: 40 }, (_, k) => frNumber(60 + k));
  if (demo === 'fr-floors') return FLOORS.map(x => x[0]);
  if (demo === 'fr-steak') return STEAK.map(x => x[0]);
  return w;
}
