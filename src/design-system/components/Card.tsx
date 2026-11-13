import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  elevation?: 'flat' | 'raised';
}

const paddingClasses = {
  none: 'p-0',
  sm: 'p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export function Card({
  interactive = false,
  padding = 'md',
  elevation = 'flat',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <section
      {...props}
      className={[
        'rounded-2xl border border-slate-200/85 bg-white dark:border-white/[0.08] dark:bg-[#111B27]',
        elevation === 'raised'
          ? 'shadow-[0_6px_22px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.24)]'
          : 'shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:shadow-none',
        paddingClasses[padding],
        interactive
          ? 'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:hover:shadow-[0_14px_32px_rgba(0,0,0,0.32)]'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </section>
  );
}
