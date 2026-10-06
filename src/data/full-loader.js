/* Загрузка текста полной версии по требованию. Каждый файл из папки full попадает в сборку
   отдельным файлом и скачивается, только когда урок открывают в полной версии. */
import { useEffect, useSyncExternalStore } from 'react';
import { putFull, fullReady } from './index.js';

const files = import.meta.glob('./full/*.js');
const pending = new Map(), failed = new Set(), subs = new Set();
let tick = 0;
const bump = () => { tick++; subs.forEach(f => f()); };
const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };

export function loadFull(slug) {
  if (fullReady(slug)) return Promise.resolve(true);
  if (!pending.has(slug)) {
    const get = files[`./full/${slug}.js`];
    failed.delete(slug);
    pending.set(slug, (get ? get() : Promise.reject(new Error('нет полной версии'))).then(
      m => { putFull(slug, m.default); bump(); return true; },
      () => { pending.delete(slug); failed.add(slug); bump(); return false; },
    ));
    bump();
  }
  return pending.get(slug);
}

/* Состояние текста полной версии: 'ready', 'loading' или 'error'. Если need = false, текст не нужен. */
export function useFull(slug, need = true) {
  useSyncExternalStore(subscribe, () => tick);
  useEffect(() => { if (need) loadFull(slug); }, [slug, need]);
  if (!need || fullReady(slug)) return 'ready';
  return failed.has(slug) ? 'error' : 'loading';
}
