import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

const ToastContext = createContext<((message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 2200);
  }, []);
  const value = useMemo(() => show, [show]);
  return <ToastContext.Provider value={value}>{children}{message ? <div className="toast" role="status">{message}</div> : null}</ToastContext.Provider>;
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('ToastProvider is missing');
  return value;
}
