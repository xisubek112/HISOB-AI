/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, PieChart } from 'lucide-react';
import { Budget, Category } from '../../types/finance.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { BudgetGaugeChart } from '../charts/InteractiveCharts.tsx';
import {
  BudgetCard,
  Button,
  Card,
  EmptyState,
  ProgressBar,
} from '../../design-system/index.ts';

interface BudgetViewProps {
  budgets: (Budget & {
    spent: number;
    remaining: number;
    percentage: number;
    isWarning: boolean;
    isExceeded: boolean;
  })[];
  categories: Category[];
  onOpenBudgetModal: (budget?: Budget) => void;
  onDeleteBudget: (id: string) => Promise<void>;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  budgets,
  onOpenBudgetModal,
  onDeleteBudget,
}) => {
  const totalBudgetLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalBudgetSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPercentage =
    totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;

  const overallTone =
    overallPercentage > 100 ? 'rose' : overallPercentage >= 80 ? 'amber' : 'emerald';

  return (
    <div className="space-y-6">
      {/* Overview Card with Radial Gauge */}
      <Card padding="lg" className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 w-full">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Joriy oylik umumiy budjet sarfi
          </span>
          <div className="flex flex-wrap items-baseline gap-2.5 mt-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
              {formatMoney(totalBudgetSpent)}
            </span>
            <span className="text-xs font-mono tabular-nums font-medium text-slate-400 dark:text-slate-500">
              / {formatMoney(totalBudgetLimit)}
            </span>
          </div>

          <div className="w-full max-w-md mt-3">
            <ProgressBar
              value={overallPercentage}
              tone={overallTone}
              label="Umumiy oylik budjet sarfi"
            />
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 block tabular-nums">
            Belgilangan umumiy limitning <strong className="text-slate-800 dark:text-slate-200">{overallPercentage}%</strong> qismi sarflandi ({budgets.length} ta toifa)
          </span>

          <div className="mt-4">
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus className="w-4 h-4" />}
              onClick={() => onOpenBudgetModal()}
            >
              Yangi toifa budjeti belgilash
            </Button>
          </div>
        </div>

        {/* Visual Gauge */}
        {totalBudgetLimit > 0 && (
          <div className="shrink-0 p-4 rounded-2xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08]">
            <BudgetGaugeChart
              spent={totalBudgetSpent}
              limit={totalBudgetLimit}
              percentage={overallPercentage}
            />
          </div>
        )}
      </Card>

      {/* Category Budgets Grid */}
      {budgets.length === 0 ? (
        <EmptyState
          icon={<PieChart className="w-6 h-6" />}
          title="Hali toifalar boʻyicha budjet belgilanmagan"
          description="Xarajatlaringizni nazorat qilish va limitga yaqinlashganda ogohlantirish olish uchun oylik limit qoʻying."
          action={
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus className="w-4 h-4" />}
              onClick={() => onOpenBudgetModal()}
            >
              Birinchi budjetni yaratish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              id={b.id}
              categoryName={b.categoryName}
              spent={b.spent}
              monthlyLimit={b.monthlyLimit}
              alertThreshold={b.alertThreshold}
              onEdit={() => onOpenBudgetModal(b)}
              onDelete={() => onDeleteBudget(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
