/* ===== Языки на латинице (французский, испанский): общие функции для схем, проверки данных и сборщика звука =====
   Без React, чтобы их могли использовать scripts/validate-lang.mjs и scripts/audio-list.mjs. */

/* Текст для озвучки: без дужек связок, точек между слогами, знака ударного слога ˈ и скобок у немых букв */
export const frPlain = s => String(s || '').replace(/‿/g, ' ').replace(/[·ˈ]/g, '').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();

/* Язык открытого трека: атрибут lang у текста, клавиши со значками в диктанте, подписи заданий.
   Открыт всегда один трек, его задаёт Gate в pages/Lang.jsx */
let TL = 'fr';
export const setTextLang = code => { TL = code === 'zh' ? TL : code; };
export const textLang = () => TL;
export const LATIN = {
  fr: { accents: ['é', 'è', 'ê', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'œ', 'ë', "'"], word: 'Слово по-французски', board: 'Départs',
    link: 'согласный переходит к следующему слову', group: 2 },
  es: { accents: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'], word: 'Слово по-испански', board: 'Salidas',
    link: 'слова сливаются: согласный или гласный переходит к следующему слову', group: 3 },
};
export const latinOf = () => LATIN[TL] || LATIN.fr;

/* Схемы к правилам (components/FrDemos.jsx) и к звукам */
export const FR_DEMOS = ['fr-stress', 'fr-silent', 'fr-nasal', 'fr-lips', 'fr-combo', 'fr-link', 'fr-count', 'fr-homo', 'fr-num', 'fr-floors', 'fr-steak',
  'es-stress', 'es-combo', 'es-count', 'es-homo', 'es-link', 'es-silent', 'es-floors', 'es-steak', 'es-rr', 'es-world', 'es-false'];
/* Схемы испанского, которые устроены как французские: es-combo — та же схема, что fr-combo */
export const demoKind = demo => (/^es-(stress|combo|count|homo|link|silent|floors|steak)$/.test(demo || '') ? demo.replace(/^es-/, 'fr-') : demo);
/* Страны в схеме es-world: вариант голоса (ключ звука mx:…, ar:…) и подпись */
export const WORLD = [['', 'Испания'], ['mx', 'Мексика'], ['ar', 'Аргентина']];

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
export const FR_VIEWS = ['', 'a', 'i', 'o', 'u', 'y', 'é', 'è', 'ø', 'œ', 'ə', 'nasal-a', 'nasal-o', 'nasal-e', 'r', 'x', 'tap', 'th'];

/* Слова, которые звучат в схеме правила: их звук должен быть собран */
export function frDemoWords(rule) {
  const { w = [], combo = [] } = rule;
  const demo = demoKind(rule.demo);
  if (demo === 'es-rr') return w.flat();
  if (demo === 'es-world') return w.map(x => x[0]);
  if (demo === 'es-false') return combo.map(x => x[0]);
  if (demo === 'fr-homo' && rule.each) return combo.flatMap(x => x[1].map(y => y[0]));
  if (demo === 'fr-nasal') return w.flatMap(([a, b]) => [a, b]);
  if (demo === 'fr-lips') return w.map(x => x[2]);
  if (demo === 'fr-link') return w.map(x => x[0]);
  if (demo === 'fr-combo') return combo.flatMap(x => x[2]);
  if (demo === 'fr-homo') return combo.map(x => x[1][0][0]);
  if (demo === 'fr-count') return w.map(x => (Array.isArray(x) ? x[1] : x));
  if (demo === 'fr-num') return Array.from({ length: 40 }, (_, k) => frNumber(60 + k));
  if (demo === 'fr-floors') return (rule.w || FLOORS).map(x => x[0]);
  if (demo === 'fr-steak') return (rule.w || STEAK).map(x => x[0]);
  return w;
}
/* Слова схемы, которые звучат голосом другой страны: [{ text, v }] — v: mx, ar */
export function frDemoVariants(rule) {
  if (rule.demo !== 'es-world') return [];
  return (rule.w || []).flatMap(x => WORLD.filter(([v]) => v).map(([v]) => ({ text: x[0], v })));
}
