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
        'relative min-h-[190px] overflow-hidden rounded-[22px] p-5 sm:p-6 text-white',
        'bg-gradient-to-br from-[#075346] via-[#0B3C35] to-[#0D292A]',
        'border border-white/[0.09]',
        'shadow-[0_16px_45px_rgba(0,0,0,0.22)]',
        className,
      ].join(' ')}
    >
      {/* Ambient emerald glow & subtle contour */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-emerald-300/10 bg-emerald-300/[0.06] blur-2xl"
      />

      <div className="relative flex flex-col justify-between h-full">
        {/* Top row */}
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-emerald-50/85">{title}</div>
          <div className="flex items-center gap-2">
            {onActionClick && actionLabel && (
              <button
                type="button"
                onClick={onActionClick}
                className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-emerald-200 transition-colors cursor-pointer"
              >
                {actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setHidden((prev) => !prev)}
              aria-label={hidden ? 'Balansni koʻrsatish' : 'Balansni yashirish'}
              title={hidden ? 'Balansni koʻrsatish' : 'Balansni yashirish'}
              className="rounded-lg p-2 text-emerald-100/80 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              {hidden ? <EyeOff className="w-[19px] h-[19px]" /> : <Eye className="w-[19px] h-[19px]" />}
            </button>
          </div>
        </div>

        {/* Large Balance Figure */}
        <div className="mb-5 text-3xl sm:text-[38px] font-black tracking-tight text-white tabular-nums leading-[1.12] break-words">
          {hidden ? '••••••••' : formatMoney(amount, currency)}
        </div>

        {/* Inset Daromad & Xarajat Sub-cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/15 p-3 min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-emerald-100/75">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Daromad</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-emerald-300 tabular-nums truncate">
              {hidden ? '••••••' : `+${formatMoney(incomeTotal, currency)}`}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/15 p-3 min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] text-rose-100/75">
              <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              <span>Xarajat</span>
            </div>
            <div className="text-xs sm:text-sm font-bold text-rose-300 tabular-nums truncate">
              {hidden ? '••••••' : `-${formatMoney(expenseTotal, currency)}`}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
