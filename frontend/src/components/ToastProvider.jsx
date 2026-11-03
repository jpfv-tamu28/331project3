import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback((tone, title, message) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, tone, title, message }]);
    // Errors stay longer so they aren't missed.
    setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
  }, [dismiss]);

  const api = useMemo(() => ({
    info: (title, message) => notify('info', title, message),
    success: (title, message) => notify('success', title, message),
    warning: (title, message) => notify('warning', title, message),
    error: (title, message) => notify('error', title, message),
  }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`toast tone-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <div className="toast-text">
              <strong>{t.title}</strong>
              {t.message && <p>{t.message}</p>}
            </div>
            <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
