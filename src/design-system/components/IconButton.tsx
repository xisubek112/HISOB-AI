import React from 'react';

export type IconButtonVariant = 'ghost' | 'outline' | 'tinted' | 'primary' | 'danger';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const variants: Record<IconButtonVariant, string> = {
  ghost:
    'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.08]',
  outline:
    'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:border-white/[0.10] dark:bg-[#0D1927] dark:text-slate-300 dark:hover:bg-[#162436]',
  tinted:
    'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
  primary:
    'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_6px_18px_rgba(16,185,129,0.22)]',
  danger:
    'text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/15',
};

const sizes: Record<IconButtonSize, string> = {
  sm: 'w-9 h-9 rounded-lg',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-12 h-12 rounded-xl',
};

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={props.title || label}
      {...props}
      className={[
        'inline-flex items-center justify-center shrink-0 cursor-pointer transition-[background-color,color,transform] duration-150',
        'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-[#F4F7F8] dark:focus-visible:ring-offset-[#081220]',
        'disabled:pointer-events-none disabled:opacity-45',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  );
}
