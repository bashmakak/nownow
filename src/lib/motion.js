import { useEffect } from 'react';

/* ===== Движение на страницах =====
   Всё, что здесь включается, только украшает: без него страница выглядит и работает так же.
   Стили лежат в motion.css; при настройке «уменьшить движение» они отключаются. */

/* Появление при прокрутке. Элемент с атрибутом data-rv проявляется сам, у элемента с data-rv-kids
   по очереди проявляются дети. Когда элемент входит в окно, ему ставится data-in.
   Атрибут, а не класс: React не трогает атрибуты, которых нет в разметке компонента. */
export function useReveal(rootId) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !('IntersectionObserver' in window)) { document.documentElement.setAttribute('data-norv', ''); return undefined; }
    const SEL = '[data-rv],[data-rv-kids]';
    const io = new IntersectionObserver(list => list.forEach(e => {
      if (e.isIntersecting) { e.target.setAttribute('data-in', ''); io.unobserve(e.target); }
    // порог нулевой: высокий список (каталог, карточки в кабинете) проявляется, как только его верх входит в окно
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    const scan = node => node.querySelectorAll(SEL).forEach(el => { if (!el.hasAttribute('data-in')) io.observe(el); });
    scan(root);
    const mo = new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      if (n.matches(SEL)) io.observe(n);
      scan(n);
    })));
    mo.observe(root, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [rootId]);
}

/* Световое пятно под курсором на карточках и лёгкий наклон карточки в hero.
   Один обработчик на документ; работает только там, где есть мышь. */
export function usePointerLight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      const t = ev.target.closest ? ev.target.closest('.ccard, .tile, .tcard, .ach, .daily') : null;
      if (t) {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${ev.clientX - r.left}px`);
        t.style.setProperty('--my', `${ev.clientY - r.top}px`);
      }
      const hero = document.querySelector('.hero');
      if (hero) {
        const r = hero.getBoundingClientRect();
        if (ev.clientY < r.bottom) {
          hero.style.setProperty('--px', ((ev.clientX - r.left) / r.width - 0.5).toFixed(3));
          hero.style.setProperty('--py', ((ev.clientY - r.top) / r.height - 0.5).toFixed(3));
        }
      }
    };
    const onMove = e => { ev = e; if (!raf) raf = requestAnimationFrame(apply); };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => { document.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, []);
}

/* Шапка получает data-stuck, когда страница прокручена: фон становится плотнее */
export function useStuck(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const on = () => { if (window.scrollY > 6) el.setAttribute('data-stuck', ''); else el.removeAttribute('data-stuck'); };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [ref]);
}
