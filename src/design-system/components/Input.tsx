import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingAddon?: React.ReactNode;
  monospace?: boolean;
}

export function Input({
  label,
  hint,
  error,
  leadingIcon,
  trailingAddon,
  monospace = false,
  id,
  className = '',
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {label}
          {props.required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {leadingIcon && (
          <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          {...props}
          className={[
            'w-full min-h-11 rounded-xl border bg-[#F8FAFC] dark:bg-[#0D1927] text-sm text-slate-900 dark:text-slate-100',
            'placeholder:text-slate-400 dark:placeholder:text-slate-500',
            'transition-[border-color,box-shadow,background-color] duration-150',
            'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500',
            error
              ? 'border-rose-500/70 focus:ring-rose-500/30 focus:border-rose-500'
              : 'border-slate-200 dark:border-white/[0.12]',
            leadingIcon ? 'pl-10' : 'pl-3.5',
            trailingAddon ? 'pr-14' : 'pr-3.5',
            monospace ? 'font-mono tabular-nums font-semibold' : '',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            className,
          ].join(' ')}
        />
        {trailingAddon && (
          <span className="absolute right-3.5 text-xs font-medium text-slate-400 pointer-events-none">
            {trailingAddon}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {!error && hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}
