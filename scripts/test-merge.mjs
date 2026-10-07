/* Проверка слияния прогресса: node scripts/test-merge.mjs
   Здесь нет ни сети, ни базы: только правила из src/lib/merge.js на придуманных данных. */
import assert from 'node:assert/strict';
import { floorBase, merge, same, synced } from '../src/lib/merge.js';

const game = (xp = 0, best = {}) => ({ xp, best, days: {}, dailies: 0, seen: null, lvl: 1 });
const st = (over = {}) => ({ name: '', version: 'short', bookmarks: [], courses: {}, notes: {}, activity: {}, game: game(), resetAt: 0, ...over });
const lesson = (over = {}) => ({ started: 100, touched: 100, completed: null, finished: false, block: 0, done: [0, 0, 0, 0, 0, 0], elapsed: [0, 0, 0, 0, 0, 0], seconds: 0, answers: {}, steps: {}, work: {}, reflect: '', useful: null, ...over });
let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`  ok  ${name}`); };

test('порядок ключей не важен', () => {
  assert.ok(same({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 }));
  assert.ok(!same({ a: 1 }, { a: 2 }));
  assert.ok(same({ a: 1, b: undefined }, { a: 1 }));
});

test('в облаке пусто: уходит то, что в браузере', () => {
  const l = st({ bookmarks: ['a'], theme: 'light', owner: null });
  const m = merge(l, null, null);
  assert.deepEqual(m.bookmarks, ['a']);
  assert.equal(m.theme, undefined);          // тема и владелец в облако не попадают
  assert.equal(m.owner, undefined);
});

test('первый вход: прогресс из браузера и из учётной записи складываются', () => {
  const l = st({ bookmarks: ['a'], courses: { x: lesson({ completed: 500, finished: true }) }, game: game(120) });
  const r = st({ bookmarks: ['b'], courses: { y: lesson({ completed: 300, finished: true }) }, game: game(300) });
  const m = merge(l, r, null);
  assert.deepEqual([...m.bookmarks].sort(), ['a', 'b']);
  assert.deepEqual(Object.keys(m.courses).sort(), ['x', 'y']);
  assert.equal(m.game.xp, 420);
});

test('изменилось только на одной стороне: берётся она', () => {
  const b = st({ name: 'Аня', notes: { 'x:0': 'старое' } });
  const l = st({ name: 'Аня', notes: { 'x:0': 'новое' } });
  const m = merge(l, b, b);
  assert.equal(m.notes['x:0'], 'новое');
  const m2 = merge(b, st({ name: 'Анна', notes: { 'x:0': 'старое' } }), b);
  assert.equal(m2.name, 'Анна');
});

test('закладку удалили на одном устройстве: она не возвращается с другого', () => {
  const b = st({ bookmarks: ['a', 'b'] });
  const m = merge(st({ bookmarks: ['b'] }), st({ bookmarks: ['a', 'b', 'c'] }), b);
  assert.deepEqual([...m.bookmarks].sort(), ['b', 'c']);
});

test('заметку стёрли здесь, а там не трогали: она удаляется', () => {
  const b = st({ notes: { k: 'текст' } });
  assert.deepEqual(merge(st({ notes: {} }), b, b).notes, {});
  // а если там её успели изменить, изменённая остаётся
  assert.deepEqual(merge(st({ notes: {} }), st({ notes: { k: 'дописали' } }), b).notes, { k: 'дописали' });
});

test('один урок на двух устройствах: позднее занятие главное, написанное не теряется', () => {
  const b = st({ courses: { x: lesson() } });
  const l = st({ courses: { x: lesson({ touched: 900, block: 4, done: [1, 1, 1, 1, 0, 0], reflect: '', work: { 0: 'мой ответ' }, right: 2 }) } });
  const r = st({ courses: { x: lesson({ touched: 700, block: 5, completed: 650, finished: true, reflect: 'вывод', right: 3, play: { why: { done: true, right: 3, total: 4 } } }) } });
  const x = merge(l, r, b).courses.x;
  assert.equal(x.block, 4);                 // продолжаем с места, где занимались позже
  assert.equal(x.completed, 650);           // но урок уже считался пройденным
  assert.equal(x.reflect, 'вывод');
  assert.equal(x.work[0], 'мой ответ');
  assert.equal(x.right, 3);
  assert.ok(x.play.why.done);
});

test('опыт и число раундов складываются, а не затираются', () => {
  const b = st({ game: game(100, { t: { score: 500, bolts: 2, plays: 3, last: 10 } }) });
  const l = st({ game: game(160, { t: { score: 500, bolts: 2, plays: 4, last: 20 } }) });
  const r = st({ game: game(130, { t: { score: 700, bolts: 3, plays: 5, last: 30 } }) });
  const g = merge(l, r, b).game;
  assert.equal(g.xp, 190);                  // 100 + 60 + 30
  assert.deepEqual(g.best.t, { score: 700, bolts: 3, plays: 6, last: 30 });
});

test('повторная синхронизация ничего не меняет', () => {
  const b = st({ game: game(100) });
  const l = st({ game: game(160), bookmarks: ['a'] });
  const r = st({ game: game(130), bookmarks: ['b'] });
  const m = merge(l, r, b);
  assert.ok(same(merge(m, m, m), m));
  assert.ok(same(merge({ ...m, theme: 'dark', owner: 'u' }, m, m), m));
});

test('сброс прогресса побеждает старые данные на другом устройстве', () => {
  const old = st({ bookmarks: ['a'], courses: { x: lesson() }, game: game(300) });
  const reset = st({ resetAt: 5000 });
  assert.ok(same(merge(old, reset, old), synced(reset)));
  assert.ok(same(merge(reset, old, old), synced(reset)));
  // после сброса учёба продолжается как обычно
  const after = st({ resetAt: 5000, bookmarks: ['n'] });
  assert.deepEqual(merge(after, reset, reset).bookmarks, ['n']);
});

test('база потерялась: опыт не удваивается', () => {
  const l = st({ game: game(160, { t: { score: 1, bolts: 1, plays: 4 } }) });
  const r = st({ game: game(130, { t: { score: 1, bolts: 1, plays: 3 } }) });
  const g = merge(l, r, floorBase(l, r)).game;
  assert.equal(g.xp, 160);
  assert.equal(g.best.t.plays, 4);
});

test('неполные данные из облака не ломают слияние', () => {
  const m = merge(st({ bookmarks: ['a'] }), { bookmarks: ['b'] }, null);
  assert.deepEqual([...m.bookmarks].sort(), ['a', 'b']);
  assert.equal(m.game.lvl, 1);
});

console.log(`\nСлияние: ${n} проверок пройдено`);
