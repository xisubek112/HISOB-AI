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
  Car,
  Home,
  Plane,
  ShieldCheck,
  GraduationCap,
  Laptop,
  Heart,
  Trash2,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { FinancialGoal } from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  ProgressTone,
} from '../../design-system/index.ts';

interface GoalsViewProps {
  goals: FinancialGoal[];
  onOpenGoalModal: (goal?: FinancialGoal) => void;
  onOpenGoalDeposit: (goal: FinancialGoal) => void;
  onDeleteGoal: (id: string) => Promise<void>;
}

const normalizeGoalColor = (color?: string): string => {
  if (!color) return '#10B981';
  const upper = color.toUpperCase();
  if (upper === '#8B5CF6' || upper === '#7C3AED') return '#06B6D4';
  if (upper === '#EC4899') return '#10B981';
  return color;
};

const getGoalTone = (color: string, isCompleted: boolean): ProgressTone => {
  if (isCompleted) return 'emerald';
  const upper = color.toUpperCase();
  if (upper === '#06B6D4' || upper === '#14B8A6') return 'teal';
  if (upper === '#F59E0B') return 'amber';
  if (upper === '#3B82F6' || upper === '#0EA5E9') return 'blue';
  return 'emerald';
};

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
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#06b6d4', '#f59e0b', '#3b82f6'],
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
      <Card padding="lg" className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="w-full md:w-auto flex-1">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Jamgʻarma maqsadlari umumiy holati
          </span>
          <div className="flex flex-wrap items-baseline gap-2.5 mt-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatMoney(totalSaved)}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500">
              / {formatMoney(totalTarget)}
            </span>
          </div>

          <div className="w-full max-w-md mt-3">
            <ProgressBar
              value={overallProgress}
              tone="emerald"
              label="Barcha jamgʻarma maqsadlari bajarilishi"
            />
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 mt-2 block tabular-nums">
            Jami maqsadlarning <strong className="text-slate-800 dark:text-slate-200">{overallProgress}%</strong> qismi jamgʻarildi ({goals.length} ta maqsad)
          </span>
        </div>

        <Button
          variant="primary"
          size="md"
          leadingIcon={<Plus className="w-4 h-4" />}
          onClick={() => onOpenGoalModal()}
        >
          Yangi maqsad qoʻshish
        </Button>
      </Card>

      {/* Goals Cards Grid */}
      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-6 h-6" />}
          title="Hali jamgʻarma maqsadlari belgilanmagan"
          description="Avtomobil, uy-joy, sayohat yoki favqulodda jamgʻarma maqsadini yarating."
          action={
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus className="w-4 h-4" />}
              onClick={() => onOpenGoalModal()}
            >
              Maqsad yaratish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {goals.map((g) => {
            const Icon = getIconComponent(g.icon);
            const safeColor = normalizeGoalColor(g.color);
            const percent = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
            const remaining = Math.max(0, g.targetAmount - g.savedAmount);
            const isCompleted = Boolean(percent >= 100 || g.isCompleted);
            const tone = getGoalTone(safeColor, isCompleted);

            return (
              <Card key={g.id} interactive padding="lg" className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${safeColor}1A`, color: safeColor }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {g.name}
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums mt-0.5">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatDateUz(g.deadline)} gacha</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton
                        label="Maqsadni tahrirlash"
                        size="sm"
                        onClick={() => onOpenGoalModal(g)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton
                        label="Maqsadni oʻchirish"
                        variant="danger"
                        size="sm"
                        onClick={() => onDeleteGoal(g.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>

                  {/* Amounts */}
                  <div className="flex items-baseline justify-between text-xs mb-2">
                    <span className="font-mono text-base font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatMoney(g.savedAmount)}
                    </span>
                    <span className="font-mono font-bold text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      {percent}%
                    </span>
                  </div>

                  <ProgressBar
                    value={percent}
                    tone={tone}
                    label={`${g.name} jamgʻarma darajasi`}
                    className="mb-3"
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-4 tabular-nums">
                    <span>
                      Reja: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatMoney(g.targetAmount)}</strong>
                    </span>
                    <span>
                      Qoldi: <strong className="font-mono text-slate-800 dark:text-slate-200">{formatMoney(remaining)}</strong>
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08]">
                  {isCompleted ? (
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      leadingIcon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      onClick={triggerConfetti}
                      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      Maqsadga toʻliq erishildi!
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      fullWidth
                      leadingIcon={<Plus className="w-3.5 h-3.5 text-emerald-500" />}
                      onClick={() => onOpenGoalDeposit(g)}
                    >
                      Mablagʻ qoʻshish
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
