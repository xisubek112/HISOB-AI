import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle';
}

export function Skeleton({
  variant = 'rect',
  className = '',
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={[
        'animate-pulse bg-slate-200/80 dark:bg-white/[0.07]',
        variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'rounded-md h-4' : 'rounded-xl',
        className,
      ].join(' ')}
    />
  );
}
