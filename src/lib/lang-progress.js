import { dayKey, getState, today, update, useStore } from './store.js';
import { XP } from './game.js';
import { dueAt } from './lang-engine.js';

/* ===== Языки: прогресс человека =====
   Хранится в state.lang[код языка] и синхронизируется вместе с остальным прогрессом:
     done — пройденные уроки: { at, right, total, n };
     ph   — выученные фразы: { b — ступень повторения, due — когда повторить, at — когда встречалась };
     rv   — последний раунд повторения: { day, n } (опыт за повторение — раз в день);
     wr   — знаки, написанные в прописях: { n — сколько раз, best — меньше всего ошибок, at };
     lv   — итог проверки уровня: { id уровня, at }.
   Прописи латиницы хранятся под кодом 'latin': у них нет уроков, только wr. */

const blank = () => ({ done: {}, ph: {}, rv: null, wr: {}, lv: null });
export const langOf = (s, code) => ({ ...blank(), ...((s.lang || {})[code] || {}) });
export const useLang = code => langOf(useStore(), code);

/* Урок пройден. ids — фразы урока: они попадают в разговорник и в повторение.
   Опыт — за первое прохождение урока; день засчитывается в серию при любом прохождении */
export function finishLesson(code, lessonId, { right, total }, ids) {
  let gain = 0, first = false;
  update(d => {
    if (!d.lang) d.lang = {};
    const L = d.lang[code] || (d.lang[code] = blank());
    if (!L.done) L.done = {};
    if (!L.ph) L.ph = {};
    const now = Date.now(), was = L.done[lessonId];
    first = !was;
    L.done[lessonId] = { at: now, right: Math.max(right, was ? was.right || 0 : 0), total, n: (was ? was.n || 0 : 0) + 1 };
    ids.forEach(id => { if (!L.ph[id]) L.ph[id] = { b: 0, due: dueAt(0, now), at: now }; else L.ph[id] = { ...L.ph[id], at: now }; });
    gain = first ? XP.lang : 0;
    d.game.xp += gain;
    const t = today(d); t.games = (t.games || 0) + 1;
  });
  return { gain, first };
}

/* Раунд повторения. results: { id фразы: true — без ошибок | false — была ошибка }.
   Без ошибок — фраза переходит на следующую ступень и вернётся позже; с ошибкой — вернётся завтра */
export function finishReview(code, results) {
  let gain = 0;
  update(d => {
    if (!d.lang) d.lang = {};
    const L = d.lang[code] || (d.lang[code] = blank());
    if (!L.ph) L.ph = {};
    const now = Date.now(), day = dayKey();
    Object.entries(results).forEach(([id, good]) => {
      const x = L.ph[id] || { b: 0 };
      const b = good ? Math.min((x.b || 0) + 1, 5) : 0;
      L.ph[id] = { b, due: dueAt(b, now), at: now };
    });
    if (!L.rv || L.rv.day !== day) { L.rv = { day, n: 1 }; gain = XP.langReview; } else L.rv = { day, n: (L.rv.n || 0) + 1 };
    d.game.xp += gain;
    const t = today(d); t.games = (t.games || 0) + 1;
  });
  return { gain };
}

/* Знак написан в прописях. В уроке опыт даёт сам урок, на странице «Прописи» — 2 очка за каждый новый знак */
export function practiceWrite(code, ch, mistakes, { xp = true } = {}) {
  let gain = 0;
  update(d => {
    if (!d.lang) d.lang = {};
    const L = d.lang[code] || (d.lang[code] = blank());
    if (!L.wr) L.wr = {};
    const was = L.wr[ch];
    L.wr[ch] = { n: (was ? was.n || 0 : 0) + 1, best: Math.min(mistakes, was && was.best != null ? was.best : Infinity), at: Date.now() };
    if (xp && !was) { gain = XP.langWrite; d.game.xp += gain; }
    if (xp) { const t = today(d); t.games = (t.games || 0) + 1; }
  });
  return { gain };
}
/* Итог проверки уровня: с какого уровня советуем начать */
export function setLevel(code, level) {
  update(d => {
    if (!d.lang) d.lang = {};
    const L = d.lang[code] || (d.lang[code] = blank());
    L.lv = { id: level, at: Date.now() };
  });
}

/* Сколько фраз пора повторить */
export function dueCount(s, code, now = Date.now()) {
  return Object.values(langOf(s, code).ph).filter(x => x.due <= now).length;
}
export const learnedCount = (s, code) => Object.keys(langOf(s, code).ph).length;
export const lessonsDone = (s, code) => Object.keys(langOf(s, code).done).length;
export const getLang = code => langOf(getState(), code);
