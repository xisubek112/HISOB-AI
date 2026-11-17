import { useState } from 'react';
import { Eye, EyeOff, TrendingUp, TrendingDown } from 'lucide-react';
import { formatMoney } from '../../utils/formatters.ts';
import { CurrencyCode } from '../../types/finance.ts';

export interface BalanceCardProps {
  title?: string;
  amount: number;
  currency?: CurrencyCode;
  incomeTotal?: number;
  expenseTotal?: number;
  onActionClick?: () => void;
  actionLabel?: string;
  className?: string;
}

export function BalanceCard({
  title = 'Jami sof balans',
  amount,
  currency = 'UZS',
  incomeTotal = 0,
  expenseTotal = 0,
  onActionClick,
  actionLabel,
  className = '',
}: BalanceCardProps) {
  const [hidden, setHidden] = useState(false);

  return (
    <section
      aria-label={title}
      className={[
        'relative min-h-[190px] overflow-hidden rounded-[22px] p-5 sm:p-6',
        'text-emerald-950 dark:text-white',
        'bg-gradient-to-br from-emerald-400/24 via-emerald-500/14 to-teal-400/20',
        'dark:from-emerald-500/22 dark:via-emerald-700/16 dark:to-teal-900/24',
        'backdrop-blur-xl',
        'border border-emerald-500/30 dark:border-emerald-400/25',
        'shadow-[0_14px_38px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.45)]',
        'dark:shadow-[0_16px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.12)]',
        className,
      ].join(' ')}
    >
      {/* Frosted glass specular sheen & ambient emerald glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent dark:from-white/[0.07]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-emerald-400/25 dark:bg-emerald-400/15 blur-2xl"
      />

      <div className="relative flex flex-col justify-between h-full">
        {/* Top row */}
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-emerald-950/80 dark:text-emerald-50/90">{title}</div>
          <div className="flex items-center gap-2">
            {onActionClick && actionLabel && (
              <button
                type="button"
                onClick={onActionClick}
                className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-white/10 dark:hover:bg-white/15 border border-emerald-600/20 dark:border-white/10 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200 transition-colors cursor-pointer"
              >
                {actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setHidden((prev) => !prev)}
              aria-label={hidden ? 'Balansni koʻrsatish' : 'Balansni yashirish'}
              title={hidden ? 'Balansni koʻrsatish' : 'Balansni yashirish'}
              className="rounded-lg p-2 text-emerald-900/75 hover:bg-emerald-500/15 hover:text-emerald-950 dark:text-emerald-100/80 dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer"
            >
              {hidden ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
            </button>
          </div>
        </div>

        {/* Large Balance Figure */}
        <div className="mb-5 text-3xl sm:text-[38px] font-black tracking-tight text-emerald-950 dark:text-white tabular-nums leading-[1.12] break-words">
          {hidden ? '••••••••' : formatMoney(amount, currency)}
        </div>

        {/* Inset Daromad & Xarajat Sub-cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/25 dark:border-emerald-300/15 bg-white/45 dark:bg-black/20 backdrop-blur-md p-3 min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-900/75 dark:text-emerald-100/75">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Daromad</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums truncate">
              {hidden ? '••••••' : `+${formatMoney(incomeTotal, currency)}`}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/25 dark:border-emerald-300/15 bg-white/45 dark:bg-black/20 backdrop-blur-md p-3 min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-rose-900/75 dark:text-rose-100/75">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span>Xarajat</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 tabular-nums truncate">
              {hidden ? '••••••' : `-${formatMoney(expenseTotal, currency)}`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
