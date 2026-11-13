/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  PieChart,
  Trash2,
  Edit2,
  TrendingUp,
} from 'lucide-react';
import { Budget, Category } from '../../types/finance.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { BudgetGaugeChart } from '../charts/InteractiveCharts.tsx';

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
  categories,
  onOpenBudgetModal,
  onDeleteBudget,
}) => {
  const totalBudgetLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalBudgetSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overallPercentage =
    totalBudgetLimit > 0 ? Math.round((totalBudgetSpent / totalBudgetLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Overview Card with Radial Gauge */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Joriy oylik umumiy budjet sarfi
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl font-black font-mono text-slate-900 dark:text-slate-100">
              {formatMoney(totalBudgetSpent)}
            </span>
            <span className="text-xs font-mono font-medium text-slate-400 dark:text-slate-500">
              / {formatMoney(totalBudgetLimit)}
            </span>
          </div>

          <div className="w-full max-w-md bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                overallPercentage > 100
                  ? 'bg-rose-600'
                  : overallPercentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, overallPercentage))}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 block font-medium">
            Belgilangan umumiy limitning {overallPercentage}% qismi sarflandi ({budgets.length} ta toifa)
          </span>

          <div className="mt-4">
            <button
              onClick={() => onOpenBudgetModal()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Yangi toifa budjeti belgilash</span>
            </button>
          </div>
        </div>

        {/* Visual Gauge */}
        {totalBudgetLimit > 0 && (
          <div className="shrink-0 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <BudgetGaugeChart
              spent={totalBudgetSpent}
              limit={totalBudgetLimit}
              percentage={overallPercentage}
            />
          </div>
        )}
      </div>

      {/* Category Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {budgets.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <PieChart className="w-10 h-10 mx-auto mb-2 opacity-40 text-blue-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Hali toifalar boʻyicha budjet belgilanmagan
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Xarajatlaringizni nazorat qilish uchun oylik limit qoʻying
            </p>
            <button
              onClick={() => onOpenBudgetModal()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
            >
              Birinchi budjetni yaratish
            </button>
          </div>
        ) : (
          budgets.map((b) => {
            const isExceeded = b.isExceeded;
            const isWarning = b.isWarning && !isExceeded;

            return (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {b.categoryName}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenBudgetModal(b)}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                        title="Tahrirlash"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteBudget(b.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        title="Oʻchirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between text-xs mb-2">
                    <span className="text-slate-500 dark:text-slate-400">
                      Sarflangan: <strong className="font-mono text-slate-900 dark:text-slate-100">{formatMoney(b.spent)}</strong>
                    </span>
                    <span className="font-mono font-bold text-slate-400">
                      {b.percentage}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExceeded
                          ? 'bg-rose-600'
                          : isWarning
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(3, b.percentage))}%` }}
                    />
                  </div>

                  {/* Warning Badges / Details */}
                  {isExceeded ? (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs rounded-xl flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/40">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Limitdan {formatMoney(b.spent - b.monthlyLimit)} oshib ketdi!</span>
                    </div>
                  ) : isWarning ? (
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs rounded-xl flex items-center gap-1.5 border border-amber-200 dark:border-amber-900/40">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{b.alertThreshold}% chegara ogohlantirishi faollashdi</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Qolgan limit:</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(b.remaining)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex justify-between items-center">
                  <span>Oylik reja:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {formatMoney(b.monthlyLimit)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
