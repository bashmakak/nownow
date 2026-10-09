/* Проверка слияния прогресса: node scripts/test-merge.mjs
   Здесь нет ни сети, ни базы: только правила из src/lib/merge.js на придуманных данных. */
import assert from 'node:assert/strict';
import { floorBase, merge, same, synced } from '../src/lib/merge.js';

const game = (xp = 0, best = {}) => ({ xp, best, days: {}, dailies: 0, seen: null, lvl: 1 });
const st = (over = {}) => ({ name: '', version: 'short', bookmarks: [], courses: {}, notes: {}, activity: {}, game: game(), interests: [], interestsAt: 0, resetAt: 0, ...over });
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

test('интересы: добавленное на двух устройствах объединяется, убранное не возвращается', () => {
  const b = st({ interests: ['son', 'pitanie'], interestsAt: 10 });
  const l = st({ interests: ['son', 'brain-memory'], interestsAt: 30 });          // здесь убрали питание и добавили память
  const r = st({ interests: ['son', 'pitanie', 'istoriya'], interestsAt: 20 });   // там добавили историю
  const m = merge(l, r, b);
  assert.deepEqual([...m.interests].sort(), ['brain-memory', 'istoriya', 'son']);
  assert.equal(m.interestsAt, 30);
  // первый вход: выбранное до входа и выбранное в учётной записи складываются
  assert.deepEqual([...merge(st({ interests: ['a'] }), st({ interests: ['b'] }), null).interests].sort(), ['a', 'b']);
});

test('мини-игры: результат в своих единицах берётся у лучшей попытки', () => {
  const l = st({ game: game(0, { 'g-schulte': { score: 1800, bolts: 3, plays: 2, raw: 30.1 } }) });
  const r = st({ game: game(0, { 'g-schulte': { score: 1200, bolts: 2, plays: 1, raw: 45.2 } }) });
  const g = merge(l, r, null).game.best['g-schulte'];
  assert.equal(g.raw, 30.1);
  assert.equal(g.score, 1800);
  assert.equal(merge(r, l, null).game.best['g-schulte'].raw, 30.1);
});

test('авторский урок: отметка о начислении искр и число вопросов не теряются', () => {
  const done = { touched: 10, completed: 10, finished: true, right: 3, checks: 3, credited: 2, useful: 'yes' };
  const again = { touched: 20, completed: null, finished: false, right: 1 };      // на другом устройстве урок начали заново
  const m = merge(st({ courses: { 'u-abc': again } }), st({ courses: { 'u-abc': done } }), null).courses['u-abc'];
  assert.equal(m.credited, 2);
  assert.equal(m.checks, 3);
  assert.equal(m.right, 3);
  assert.equal(m.completed, 10);
});

test('неполные данные из облака не ломают слияние', () => {
  const m = merge(st({ bookmarks: ['a'] }), { bookmarks: ['b'] }, null);
  assert.deepEqual([...m.bookmarks].sort(), ['a', 'b']);
  assert.equal(m.game.lvl, 1);
});

test('языки: уроки с двух устройств складываются, у фразы побеждает поздняя запись', () => {
  const l = st({ lang: { zh: { done: { 'zh-u1-l1': { at: 100, right: 5, total: 8, n: 1 } }, ph: { a: { b: 2, due: 900, at: 300 }, b: { b: 0, due: 200, at: 100 } }, rv: { day: '2026-10-08', n: 1 } } } });
  const r = st({ lang: { zh: { done: { 'zh-u1-l1': { at: 200, right: 7, total: 8, n: 1 }, 'zh-u2-l1': { at: 210, right: 6, total: 9, n: 1 } }, ph: { a: { b: 0, due: 400, at: 250 }, c: { b: 0, due: 500, at: 210 } }, rv: { day: '2026-10-09', n: 2 } } } });
  const z = merge(l, r, null).lang.zh;
  assert.deepEqual(Object.keys(z.done).sort(), ['zh-u1-l1', 'zh-u2-l1']);
  assert.equal(z.done['zh-u1-l1'].right, 7);                 // лучший результат
  assert.equal(z.done['zh-u1-l1'].at, 200);
  assert.deepEqual(Object.keys(z.ph).sort(), ['a', 'b', 'c']);
  assert.equal(z.ph.a.b, 2);                                 // повторение на этом устройстве было позже
  assert.equal(z.rv.day, '2026-10-09');
  // язык, которого нет на одной из сторон, не теряется; настройка озвучки в облако не уходит
  const m = merge(st({ voice: false }), st({ lang: { zh: { done: {}, ph: { a: { b: 1, due: 1, at: 1 } }, rv: null } } }), null);
  assert.ok(m.lang.zh.ph.a);
  assert.equal(m.voice, undefined);
});

console.log(`\nСлияние: ${n} проверок пройдено`);
