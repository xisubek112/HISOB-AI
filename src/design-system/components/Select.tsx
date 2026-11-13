import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Select({
  label,
  hint,
  error,
  id,
  className = '',
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
          {props.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          {...props}
          className={[
            'w-full min-h-11 appearance-none rounded-xl border bg-[#F8FAFC] dark:bg-[#0D1927] pl-3.5 pr-9 text-sm text-slate-900 dark:text-slate-100',
            'transition-[border-color,box-shadow] duration-150',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500',
            error
              ? 'border-rose-500/70'
              : 'border-slate-200 dark:border-white/[0.12]',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            className,
          ].join(' ')}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
        />
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {!error && hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
