import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'premium';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-500 text-slate-950 font-semibold shadow-[0_8px_24px_rgba(16,185,129,0.22)] hover:bg-emerald-400 focus-visible:ring-emerald-400',
  secondary:
    'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white/[0.08] dark:text-slate-100 dark:hover:bg-white/[0.14] border border-transparent dark:border-white/[0.10] focus-visible:ring-emerald-400',
  outline:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:border-white/[0.12] dark:bg-[#0D1927] dark:text-slate-200 dark:hover:bg-[#162436] focus-visible:ring-emerald-400',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white focus-visible:ring-teal-400',
  danger:
    'bg-rose-600 text-white hover:bg-rose-500 shadow-[0_6px_18px_rgba(239,68,68,0.20)] focus-visible:ring-rose-400',
  premium:
    'bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold shadow-[0_8px_22px_rgba(245,158,11,0.24)] hover:brightness-105 focus-visible:ring-amber-400',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs rounded-lg',
  md: 'min-h-11 px-4 text-xs sm:text-sm rounded-xl',
  lg: 'min-h-12 px-5 text-sm rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none cursor-pointer',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-200',
        'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#F4F7F8] dark:focus-visible:ring-offset-[#081220]',
        'disabled:pointer-events-none disabled:opacity-50',
        fullWidth ? 'w-full' : '',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent shrink-0"
        />
      ) : (
        leadingIcon && <span className="shrink-0 flex items-center">{leadingIcon}</span>
      )}
      <span>{children}</span>
      {!loading && trailingIcon && <span className="shrink-0 flex items-center">{trailingIcon}</span>}
    </button>
  );
}
