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
  // сообщение — строка или объект { title, text, icon, tone }: так показываются опыт, уровень и достижения
  const toast = useCallback(msg => {
    const id = Date.now() + Math.random();
    const t = typeof msg === 'string' ? { text: msg } : msg;
    setToasts(list => [...list.slice(-2), { id, ...t }]);
    setTimeout(() => setToasts(list => list.filter(x => x.id !== id)), t.title ? 4600 : 3200);
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
        {toasts.map(t => (
          <div className={`toast ${t.title ? 'toast-rich' : ''} ${t.tone || ''}`} key={t.id}>
            {t.icon && <span className="toast-ic"><Icon name={t.icon} size={18} /></span>}
            <span>{t.title && <b>{t.title}</b>}{t.text}</span>
          </div>
        ))}
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
  useEffect(() => { document.title = title ? `${title} — NowNow` : 'NowNow — быстрые знания'; }, [title]);
}
