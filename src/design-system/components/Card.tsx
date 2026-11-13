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
        'rounded-[22px] border border-slate-200/85 bg-white dark:border-white/[0.09] dark:bg-[#0D1927]/90',
        elevation === 'raised'
          ? 'shadow-[0_12px_34px_rgba(15,23,42,0.06)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.28)]'
          : 'shadow-[0_4px_18px_rgba(15,23,42,0.04)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.22)]',
        paddingClasses[padding],
        interactive
          ? 'transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)] dark:hover:shadow-[0_18px_48px_rgba(0,0,0,0.34)]'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </section>
  );
}
