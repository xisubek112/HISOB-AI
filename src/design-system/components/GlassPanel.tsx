import React from 'react';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: 'subtle' | 'medium';
}

const intensityClasses = {
  subtle: 'bg-white/75 dark:bg-[#0D1927]/78',
  medium: 'bg-white/88 dark:bg-[#111B27]/88',
};

export function GlassPanel({
  intensity = 'subtle',
  className = '',
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      {...props}
      className={[
        'rounded-2xl border border-slate-200/70 backdrop-blur-xl',
        'shadow-[0_12px_36px_rgba(15,23,42,0.08)]',
        'dark:border-white/[0.10] dark:shadow-[0_16px_44px_rgba(0,0,0,0.32)]',
        intensityClasses[intensity],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
