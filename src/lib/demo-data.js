import { mark } from './pinyin.js';

/* Данные наглядных схем вводного курса (components/LangDemos.jsx). Отдельно от компонентов, потому что
   scripts/audio-list.mjs собирает по ним список звуков: у каждой кнопки схемы должен быть файл. */

/* Иероглиф → пиньинь: [знак, начало, конец, тон, перевод] */
export const PY_DEMO = [['妈', 'm', 'a', 1, 'мама'], ['马', 'm', 'a', 3, 'лошадь']];
/* Простые гласные и слог, которым каждую показывают */
export const VOWEL_EX = { a: 'ā', o: 'ō', e: 'ē', i: 'yī', u: 'wū', ü: 'yū' };
/* Конструктор слога: из чего можно собрать */
export const SYL_PARTS = { initials: ['m', 'b', ''], finals: ['a', 'o', 'i', 'u'] };
/* Без согласного впереди i пишут yi, u — wu */
export const spellSyl = (i, f) => (i ? i + f : ({ i: 'yi', u: 'wu' }[f] || f));
export const builderSyllables = () => SYL_PARTS.initials.flatMap(i => SYL_PARTS.finals.flatMap(f => [1, 2, 3, 4].map(t => mark(spellSyl(i, f), t))));
export const pinyinDemoSyllables = () => PY_DEMO.map(([, i, f, t]) => mark(i + f, t));
