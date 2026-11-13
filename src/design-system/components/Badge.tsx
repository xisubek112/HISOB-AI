import React from 'react';

export type BadgeTone = 'emerald' | 'rose' | 'teal' | 'amber' | 'blue' | 'neutral';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
}

const tones: Record<BadgeTone, string> = {
  emerald:
    'bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  rose:
    'bg-rose-500/12 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  teal:
    'bg-cyan-500/12 text-cyan-700 border-cyan-500/25 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  amber:
    'bg-amber-500/15 text-amber-800 border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  blue:
    'bg-blue-500/12 text-blue-700 border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  neutral:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/[0.06] dark:text-slate-300 dark:border-white/[0.10]',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[11px] rounded-md',
  md: 'px-2.5 py-1 text-xs rounded-lg',
};

export function Badge({
  tone = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      {...props}
      className={[
        'inline-flex items-center gap-1 font-semibold border whitespace-nowrap leading-none',
        tones[tone],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}
