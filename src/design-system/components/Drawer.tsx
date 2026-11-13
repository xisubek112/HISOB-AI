import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './IconButton.tsx';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  side?: 'left' | 'right' | 'bottom';
  children: React.ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  title,
  side = 'right',
  children,
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sidePosition =
    side === 'left'
      ? 'left-0 top-0 bottom-0 w-72 max-w-[85vw] rounded-r-2xl'
      : side === 'bottom'
      ? 'left-0 right-0 bottom-0 max-h-[85dvh] rounded-t-3xl pb-safe'
      : 'right-0 top-0 bottom-0 w-80 max-w-[90vw] rounded-l-2xl';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Panel'}
      className="fixed inset-0 z-50 bg-[#081220]/65 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[
          'fixed bg-white dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.10] shadow-2xl flex flex-col overflow-hidden',
          sidePosition,
        ].join(' ')}
      >
        {title && (
          <div className="px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between shrink-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
            <IconButton label="Yopish" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
