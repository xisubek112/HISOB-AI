import React, { useState } from 'react';

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          role="tooltip"
          className={[
            'pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 px-2.5 py-1.5 rounded-lg',
            'bg-[#081220] text-white dark:bg-slate-800 text-[11px] font-medium whitespace-nowrap shadow-lg border border-white/10',
            position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          ].join(' ')}
        >
          {content}
        </div>
      )}
    </div>
  );
}
