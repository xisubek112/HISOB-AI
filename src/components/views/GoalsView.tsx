/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import confetti from 'canvas-confetti';
import {
  Plus,
  Target,
  Calendar,
  CheckCircle2,
  Clock,
  Car,
  Home,
  Plane,
  ShieldCheck,
  GraduationCap,
  Laptop,
  Heart,
  Trash2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { FinancialGoal } from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';

interface GoalsViewProps {
  goals: FinancialGoal[];
  onOpenGoalModal: (goal?: FinancialGoal) => void;
  onOpenGoalDeposit: (goal: FinancialGoal) => void;
  onDeleteGoal: (id: string) => Promise<void>;
}

export const GoalsView: React.FC<GoalsViewProps> = ({
  goals,
  onOpenGoalModal,
  onOpenGoalDeposit,
  onDeleteGoal,
}) => {
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
  };

  const getIconComponent = (name: string) => {
    switch (name) {
      case 'Car':
        return Car;
      case 'Home':
        return Home;
      case 'Plane':
        return Plane;
      case 'ShieldCheck':
        return ShieldCheck;
      case 'GraduationCap':
        return GraduationCap;
      case 'Laptop':
        return Laptop;
      case 'Heart':
        return Heart;
      default:
        return Target;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Jamgʻarma maqsadlari umumiy holati
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
              {formatMoney(totalSaved)}
            </span>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              / {formatMoney(totalTarget)}
            </span>
          </div>

          <div className="w-full md:w-80 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(3, overallProgress))}%` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
            Jami maqsadlarning {overallProgress}% qismi jamgʻarildi ({goals.length} ta maqsad)
          </span>
        </div>

        <button
          onClick={() => onOpenGoalModal()}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi maqsad qoʻshish</span>
        </button>
      </div>

      {/* Goals Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {goals.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Target className="w-10 h-10 mx-auto mb-2 opacity-40 text-blue-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Hali jamgʻarma maqsadlari belgilanmagan
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Avtomobil, uy-joy, sayohat yoki favqulodda jamgʻarma maqsadini yarating
            </p>
            <button
              onClick={() => onOpenGoalModal()}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold"
            >
              Maqsad yaratish
            </button>
          </div>
        ) : (
          goals.map((g) => {
            const Icon = getIconComponent(g.icon);
            const percent = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
            const remaining = Math.max(0, g.targetAmount - g.savedAmount);
            const isCompleted = percent >= 100 || g.isCompleted;

            return (
              <div
                key={g.id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: `${g.color}15`, color: g.color }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {g.name}
                        </h3>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateUz(g.deadline)} gacha</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenGoalModal(g)}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                        title="Tahrirlash"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteGoal(g.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        title="Oʻchirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="flex items-baseline justify-between text-xs mb-2">
                    <span className="font-mono text-base font-extrabold text-slate-900 dark:text-slate-100">
                      {formatMoney(g.savedAmount)}
                    </span>
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {percent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: isCompleted ? '#10B981' : g.color || '#3B82F6',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                    <span>Reja: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatMoney(g.targetAmount)}</strong></span>
                    <span>Qoldi: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatMoney(remaining)}</strong></span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {isCompleted ? (
                    <div
                      onClick={triggerConfetti}
                      className="w-full py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span>Maqsadga toʻliq erishildi! 🎉</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onOpenGoalDeposit(g)}
                      className="w-full py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Mablagʻ qoʻshish</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
