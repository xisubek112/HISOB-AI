import { useState } from 'react';
import {
  Eye,
  EyeOff,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  PiggyBank,
} from 'lucide-react';
import { formatMoney } from '../../utils/formatters.ts';
import { CurrencyCode } from '../../types/finance.ts';

export interface BalanceCardProps {
  title?: string;
  amount: number;
  currency?: CurrencyCode;
  subtitle?: string;
  incomeTotal?: number;
  expenseTotal?: number;
  netSavings?: number;
  savingsRate?: number;
  onActionClick?: () => void;
  actionLabel?: string;
  className?: string;
}

export function BalanceCard({
  title = 'Jami sof balans',
  amount,
  currency = 'UZS',
  subtitle = 'Barcha faol hamyon va kartalar boʻyicha',
  incomeTotal,
  expenseTotal,
  netSavings,
  savingsRate,
  onActionClick,
  actionLabel,
  className = '',
}: BalanceCardProps) {
  const [hidden, setHidden] = useState(false);

  return (
    <section
      aria-label={title}
      className={[
        'relative overflow-hidden rounded-[22px] p-5 sm:p-7 text-white',
        'bg-gradient-to-br from-[#081220] via-[#0B1E2B] to-[#0D2E2A]',
        'border border-emerald-500/25',
        'shadow-[0_18px_48px_rgba(8,18,32,0.22)] dark:shadow-[0_22px_54px_rgba(0,0,0,0.45)]',
        className,
      ].join(' ')}
    >
      {/* Subtle architectural emerald illumination (hero focal point only) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 rounded-full bg-emerald-500/18 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-8 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl"
      />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-slate-200 block truncate">
              {title}
            </span>
            <span className="text-[11px] text-slate-400 block truncate">{subtitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onActionClick && actionLabel && (
            <button
              type="button"
              onClick={onActionClick}
              className="hidden sm:inline-flex items-center gap-1 min-h-9 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.10] text-xs font-semibold text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>{actionLabel}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setHidden((prev) => !prev)}
            aria-label={hidden ? 'Balansni koʻrsatish' : 'Balansni yashirish'}
            title={hidden ? 'Balansni koʻrsatish' : 'Balansni yashirish'}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] transition-colors cursor-pointer"
          >
            {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Dominant Hero Amount */}
      <div className="relative z-10 mt-5 sm:mt-6">
        <div className="text-3xl sm:text-[38px] font-extrabold tracking-tight text-white tabular-nums leading-[1.12] break-words">
          {hidden ? '•••••••• soʻm' : formatMoney(amount, currency)}
        </div>

        {netSavings !== undefined && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <PiggyBank className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span>Joriy oy sof natijasi:</span>
              <strong
                className={`font-bold tabular-nums ${
                  netSavings >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {hidden
                  ? '•••'
                  : `${netSavings >= 0 ? '+' : '-'}${formatMoney(Math.abs(netSavings), currency)}`}
              </strong>
            </span>
            {savingsRate !== undefined && (
              <>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="tabular-nums text-cyan-300 font-semibold">
                  Tejash ulushi: {savingsRate}%
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Integrated Cashflow Strip */}
      {(incomeTotal !== undefined || expenseTotal !== undefined || onActionClick) && (
        <div className="relative z-10 mt-5 pt-4 border-t border-white/[0.10] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {incomeTotal !== undefined && (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                </span>
                <div>
                  <span className="text-[11px] text-slate-400 block leading-none">Kirim</span>
                  <span className="font-bold text-emerald-300 tabular-nums mt-0.5 block">
                    {hidden ? '•••' : `+${formatMoney(incomeTotal, currency)}`}
                  </span>
                </div>
              </div>
            )}
            {expenseTotal !== undefined && (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-300 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
                <div>
                  <span className="text-[11px] text-slate-400 block leading-none">Chiqim</span>
                  <span className="font-bold text-rose-300 tabular-nums mt-0.5 block">
                    {hidden ? '•••' : `-${formatMoney(expenseTotal, currency)}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {onActionClick && actionLabel && (
            <button
              type="button"
              onClick={onActionClick}
              className="sm:hidden inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:underline cursor-pointer"
            >
              <span>{actionLabel}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
