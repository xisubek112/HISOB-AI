import React from 'react';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  headerAction,
  footer,
  children,
  className = '',
}: ChartCardProps) {
  return (
    <section
      className={[
        'rounded-2xl border border-slate-200/85 dark:border-white/[0.08] bg-white dark:bg-[#111B27]',
        'p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.03)] dark:shadow-none',
        'flex flex-col justify-between min-w-0',
        className,
      ].join(' ')}
    >
      <div className="min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0 flex items-center gap-2">{headerAction}</div>}
        </div>

        <div className="min-w-0">{children}</div>
      </div>

      {footer && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.08]">{footer}</div>
      )}
    </section>
  );
}
