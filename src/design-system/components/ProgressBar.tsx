export type ProgressTone = 'emerald' | 'teal' | 'amber' | 'rose' | 'blue';

export interface ProgressBarProps {
  value: number; // 0 to 100
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  label?: string;
  className?: string;
}

const barColors: Record<ProgressTone, string> = {
  emerald: 'bg-emerald-500',
  teal: 'bg-cyan-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  blue: 'bg-blue-500',
};

export function ProgressBar({
  value,
  tone = 'emerald',
  size = 'md',
  label,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={[
        'w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.08]',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      ].join(' ')}
    >
      <div
        className={[
          'h-full rounded-full transition-[width] duration-500 ease-out',
          barColors[tone],
        ].join(' ')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
