import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton.tsx';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideHeader?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  hideHeader = false,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Oyna'}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#081220]/70 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[
          'w-full bg-white dark:bg-[#111B27] border border-slate-200 dark:border-white/[0.10]',
          'rounded-t-3xl sm:rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.38)]',
          'flex flex-col max-h-[92dvh] overflow-hidden hai-scale-in',
          sizeClasses[size],
        ].join(' ')}
      >
        {!hideHeader && (
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-start justify-between gap-3 shrink-0">
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
              )}
            </div>
            <IconButton label="Yopish" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0D1927]/80 shrink-0 pb-safe sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
