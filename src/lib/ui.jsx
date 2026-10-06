import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '../components/Icon.jsx';

/* Общий диалог и всплывающие сообщения. Диалог один на всё приложение. */
const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);

export function UIProvider({ children }) {
  const [dialog, setDialog] = useState(null); // { content, cls }
  const [toasts, setToasts] = useState([]);
  const ref = useRef(null);
  const loc = useLocation();

  const close = useCallback(() => setDialog(null), []);
  const open = useCallback((content, cls = '') => setDialog({ content, cls }), []);
  const toast = useCallback(msg => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (dialog && !d.open) {
      try { d.showModal(); } catch { d.setAttribute('open', ''); }
      const f = d.querySelector('[data-autofocus]');
      if (f) f.focus();
    } else if (!dialog && d.open) d.close();
  }, [dialog]);

  // переход на другую страницу или смена фильтра закрывает диалог
  useEffect(() => { setDialog(null); }, [loc.pathname, loc.search]);

  const value = useMemo(() => ({ open, close, toast }), [open, close, toast]);
  return (
    <UICtx.Provider value={value}>
      {children}
      <dialog ref={ref} className={dialog?.cls || ''} aria-labelledby="dlg-title" onClose={close}
        onClick={e => { if (e.target === ref.current) close(); }}>
        {dialog?.content}
      </dialog>
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => <div className="toast" key={t.id}>{t.msg}</div>)}
      </div>
    </UICtx.Provider>
  );
}

export function DialogHead({ title }) {
  const { close } = useUI();
  return (
    <div className="dlg-head">
      <h2 className="h3" id="dlg-title">{title}</h2>
      <button type="button" className="icon-btn" onClick={close} aria-label="Закрыть"><Icon name="x" /></button>
    </div>
  );
}

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} — NowNow` : 'NowNow — микрообучение за 30 минут'; }, [title]);
}
