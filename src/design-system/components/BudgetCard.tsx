import { Edit2, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '../../utils/formatters.ts';
import { ProgressBar, ProgressTone } from './ProgressBar.tsx';
import { IconButton } from './IconButton.tsx';
import { Badge } from './Badge.tsx';

export interface BudgetCardProps {
  id: string;
  categoryName: string;
  spent: number;
  monthlyLimit: number;
  alertThreshold?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function BudgetCard({
  categoryName,
  spent,
  monthlyLimit,
  alertThreshold = 80,
  onEdit,
  onDelete,
}: BudgetCardProps) {
  const percentage = monthlyLimit > 0 ? Math.round((spent / monthlyLimit) * 100) : 0;
  const remaining = monthlyLimit - spent;
  const isOver = percentage > 100;
  const isWarning = !isOver && percentage >= alertThreshold;

  const tone: ProgressTone = isOver ? 'rose' : isWarning ? 'amber' : 'emerald';

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111B27] p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.22)] space-y-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
            {categoryName}
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {formatMoney(spent)} / {formatMoney(monthlyLimit)}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge tone={isOver ? 'rose' : isWarning ? 'amber' : 'emerald'}>
            {isOver ? (
              <>
                <AlertTriangle className="w-3 h-3" />
                <span>{percentage}%</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>{percentage}%</span>
              </>
            )}
          </Badge>
          {onEdit && (
            <IconButton label="Budjetni tahrirlash" size="sm" onClick={onEdit}>
              <Edit2 className="w-3.5 h-3.5" />
            </IconButton>
          )}
          {onDelete && (
            <IconButton label="Budjetni oʻchirish" variant="danger" size="sm" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </IconButton>
          )}
        </div>
      </div>

      <ProgressBar value={percentage} tone={tone} label={`${categoryName} budjet holati`} />

      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Ogohlantirish: {alertThreshold}%</span>
        <span
          className={[
            'font-semibold tabular-nums',
            remaining < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          ].join(' ')}
        >
          {remaining >= 0 ? `Qoldi: ${formatMoney(remaining)}` : `Oshib ketdi: ${formatMoney(Math.abs(remaining))}`}
        </span>
      </div>
    </section>
  );
}
