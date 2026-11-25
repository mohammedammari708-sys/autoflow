import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastValue {
  push: (message: string, kind?: ToastKind) => void;
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastValue>({
  push: () => undefined,
  toasts: [],
  dismiss: () => undefined,
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, toasts, dismiss }), [push, toasts, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="animate-toast-in pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lift dark:border-slate-700 dark:bg-slate-900"
          >
            <span
              aria-hidden
              className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                toast.kind === 'success'
                  ? 'bg-emerald-500'
                  : toast.kind === 'error'
                    ? 'bg-rose-500'
                    : 'bg-brand-500'
              }`}
            />
            <p className="flex-1 text-sm text-slate-800 dark:text-slate-100">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
