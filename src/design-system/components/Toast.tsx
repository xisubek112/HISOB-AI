import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { Button } from './Button.tsx';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  tone: ToastTone;
  title?: string;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone, title?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

const toneStyles: Record<ToastTone, { container: string; icon: React.ReactNode }> = {
  success: {
    container:
      'bg-white dark:bg-[#111B27] border-emerald-500/35 text-slate-900 dark:text-slate-100',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
  },
  error: {
    container:
      'bg-white dark:bg-[#111B27] border-rose-500/35 text-slate-900 dark:text-slate-100',
    icon: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
  },
  warning: {
    container:
      'bg-white dark:bg-[#111B27] border-amber-500/35 text-slate-900 dark:text-slate-100',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
  },
  info: {
    container:
      'bg-white dark:bg-[#111B27] border-cyan-500/35 text-slate-900 dark:text-slate-100',
    icon: <Info className="w-4 h-4 text-cyan-500 shrink-0" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const confirmResolverRef = useRef<((val: boolean) => void) | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'info', title?: string) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, message }]);
      setTimeout(() => {
        dismissToast(id);
      }, 4200);
    },
    [dismissToast]
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState(options);
    });
  }, []);

  const handleConfirmChoice = (accepted: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmState(null);
    if (resolver) resolver(accepted);
  };

  const value: ToastContextValue = {
    showToast,
    success: (m, t) => showToast(m, 'success', t),
    error: (m, t) => showToast(m, 'error', t),
    warning: (m, t) => showToast(m, 'warning', t),
    info: (m, t) => showToast(m, 'info', t),
    confirm,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Non-blocking Toast Viewport */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 sm:w-96 pointer-events-none"
      >
        {toasts.map((t) => {
          const st = toneStyles[t.tone];
          return (
            <div
              key={t.id}
              className={[
                'pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-[0_14px_34px_rgba(0,0,0,0.18)] hai-fade-up',
                st.container,
              ].join(' ')}
            >
              <div className="mt-0.5">{st.icon}</div>
              <div className="flex-1 min-w-0">
                {t.title && <div className="text-xs font-bold mb-0.5">{t.title}</div>}
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                aria-label="Yopish"
                onClick={() => dismissToast(t.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Global Confirm Dialog replacing window.confirm */}
      <Modal
        isOpen={Boolean(confirmState)}
        onClose={() => handleConfirmChoice(false)}
        title={confirmState?.title || 'Tasdiqlash'}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="ghost" size="sm" onClick={() => handleConfirmChoice(false)}>
              {confirmState?.cancelLabel || 'Bekor qilish'}
            </Button>
            <Button
              variant={confirmState?.danger ? 'danger' : 'primary'}
              size="sm"
              onClick={() => handleConfirmChoice(true)}
            >
              {confirmState?.confirmLabel || 'Tasdiqlash'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {confirmState?.message}
        </p>
      </Modal>
    </ToastContext.Provider>
  );
}
