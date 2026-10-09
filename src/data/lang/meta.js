/* ===== Языки для путешествий: что есть и сколько уроков =====
   Короткая сводка, которая нужна сразу при запуске сайта: шапке, кабинету и достижениям.
   Тексты треков лежат отдельно (src/data/lang/<код>.js) и скачиваются, когда человек открывает раздел.
   Числа уроков сверяет с треками проверка данных: scripts/validate-lang.mjs. */

export const BLOCKS = [
  ['base', 'Основа', 'Звуки, вежливость, числа и вывески: без этого не обойтись ни в одной ситуации'],
  ['road', 'В дороге', 'Аэропорт, транспорт и отель: всё, что нужно в первый день'],
  ['place', 'На месте', 'Еда, покупки, достопримечательности, помощь и разговор'],
];

/* units: [id мини-курса, блок, число уроков] */
export const TRACKS = [
  {
    code: 'zh', title: 'Китайский', native: '中文', ready: true, country: 'Китай',
    hook: 'Путунхуа для поездки в Китай: тоны, вывески, цены, такси, отель, еда и помощь.',
    units: [['zh-u1', 'base', 5], ['zh-u2', 'base', 5], ['zh-u3', 'base', 5], ['zh-u4', 'base', 6], ['zh-u5', 'road', 5], ['zh-u6', 'road', 4], ['zh-u7', 'road', 4],
      ['zh-u8', 'place', 5], ['zh-u9', 'place', 4], ['zh-u10', 'place', 4], ['zh-u11', 'place', 4], ['zh-u12', 'place', 4]],
  },
  { code: 'en', title: 'Английский', native: 'English', ready: false, hook: 'Английский, на котором говорят с туристами в любой стране.', units: [] },
  { code: 'es', title: 'Испанский', native: 'Español', ready: false, hook: 'Испания и Латинская Америка: от бара с тапас до рынка в Мехико.', units: [] },
];
export const TRACK_BY = Object.fromEntries(TRACKS.map(t => [t.code, t]));
export const LANG_LESSONS = code => (TRACK_BY[code] ? TRACK_BY[code].units.reduce((n, u) => n + u[2], 0) : 0);

/* Загрузка текста трека по требованию */
const LOADERS = { zh: () => import('./zh.js') };
const cache = {};
export function loadTrack(code) {
  if (!LOADERS[code]) return Promise.reject(new Error('no track'));
  if (!cache[code]) cache[code] = LOADERS[code]().then(m => m.default, e => { delete cache[code]; throw e; });
  return cache[code];
}
