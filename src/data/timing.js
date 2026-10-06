/* Оценка времени урока по тексту. Чистые функции без зависимостей:
   ими пользуются и сайт, и scripts/full-meta.mjs при сборке. */
export const WPM = 150;                                         // средняя скорость внимательного чтения, слов в минуту
export const PAUSE = { question: 15, think: 20, field: 60 };    // секунды: выбрать ответ, обдумать вопрос, заполнить поле листа

const SKIP = new Set(['placeholder', 'rows', 'correct']);
const NODES = new Set(['p', 'h', 'ul', 'ol', 'note', 'think', 'code', 'quote', 'table']);

export const words = v => {
  if (typeof v === 'string') return (v.match(/\S+/g) || []).length;
  if (Array.isArray(v)) return (NODES.has(v[0]) ? v.slice(1) : v).reduce((n, x) => n + words(x), 0);
  if (v && typeof v === 'object') return Object.entries(v).reduce((n, [k, x]) => n + (SKIP.has(k) ? 0 : words(x)), 0);
  return 0;
};
const thinks = part => (part.body || []).filter(n => n[0] === 'think').length;
const qWord = n => (n % 10 === 1 && n !== 11 ? 'вопрос' : n % 10 >= 2 && n % 10 <= 4 && (n < 10 || n > 20) ? 'вопроса' : 'вопросов');

/* Секунды по каждому из шести блоков, всего секунд и минут */
export function blockSeconds(L) {
  const read = part => words(part) / WPM * 60;
  const blocks = [
    read(L.why),
    read(L.idea) + thinks(L.idea) * PAUSE.think,
    read(L.example) + thinks(L.example) * PAUSE.think,
    read(L.practice) + thinks(L.practice) * PAUSE.think + (L.practice.sheet || []).length * PAUSE.field,
    read(L.check) + L.check.length * PAUSE.question,
    read(L.key),
  ].map(Math.round);
  const total = blocks.reduce((n, s) => n + s, 0);
  return { blocks, total, min: Math.max(1, Math.round(total / 60)) };
}

/* Сводка версии урока: всё, что нужно каталогу, странице урока и кабинету без самого текста.
   L — объект с шестью блоками: why, idea, example, practice, check, key. */
export const describe = L => ({
  ...blockSeconds(L),
  titles: [L.why.title, L.idea.title, L.example.title, L.practice.title, `${L.check.length} ${qWord(L.check.length)} на закрепление`, L.key.title],
  checks: L.check.length,
  thinks: thinks(L.idea) + thinks(L.example) + thinks(L.practice),
  sheet: (L.practice.sheet || []).map(f => f.label),
  key: L.key,
});
