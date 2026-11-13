import { ArrowDownLeft, ArrowUpRight, Edit2, Trash2 } from 'lucide-react';
import { Transaction } from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { IconButton } from './IconButton.tsx';

export interface TransactionRowProps {
  transaction: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  className = '',
}: TransactionRowProps) {
  const isIncome = transaction.type === 'income';

  return (
    <div
      className={[
        'py-3 px-2.5 sm:px-3 flex items-center justify-between gap-3 rounded-xl',
        'hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors',
        className,
      ].join(' ')}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={[
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
            isIncome
              ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/20',
          ].join(' ')}
        >
          {isIncome ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {transaction.description}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {transaction.categoryName}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatDateUz(transaction.date)}</span>
            {transaction.walletName && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                  {transaction.walletName}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div
          className={[
            'text-xs sm:text-sm font-bold tabular-nums text-right',
            isIncome
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400',
          ].join(' ')}
        >
          {isIncome ? '+' : '-'}
          {formatMoney(transaction.amount)}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex items-center gap-0.5">
            {onEdit && (
              <IconButton
                label="Tranzaksiyani tahrirlash"
                size="sm"
                onClick={() => onEdit(transaction)}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </IconButton>
            )}
            {onDelete && (
              <IconButton
                label="Tranzaksiyani oʻchirish"
                variant="danger"
                size="sm"
                onClick={() => onDelete(transaction.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
