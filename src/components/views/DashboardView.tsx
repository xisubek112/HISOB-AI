/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Minus,
  Mic,
  ScanLine,
  ArrowLeftRight,
  MoreHorizontal,
  ChevronRight,
  Sparkles,
  Bot,
  ShoppingBag,
  Car,
  Home,
  Utensils,
  Briefcase,
  CreditCard,
  Target,
  PieChart,
  HandCoins,
  Users,
  Clock,
  Repeat,
  Coins,
  Building2,
  Send,
  TrendingUp,
  Edit2,
  Trash2,
} from 'lucide-react';
import {
  FinancialSummary,
  Transaction,
  FinancialGoal,
  FinancialHealthScore,
} from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { IncomeExpenseBarChart } from '../charts/InteractiveCharts.tsx';
import { NavTab } from '../layout/Sidebar.tsx';
import { DashboardPeriod } from '../layout/Header.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  BalanceCard,
  Card,
  Skeleton,
  EmptyState,
  Button,
  Drawer,
} from '../../design-system/index.ts';

interface DashboardViewProps {
  summary: FinancialSummary | null;
  recentTransactions: Transaction[];
  goals: FinancialGoal[];
  loading?: boolean;
  selectedPeriod: DashboardPeriod;
  onSelectPeriod: (period: DashboardPeriod) => void;
  onOpenTransactionModal: (type: 'income' | 'expense') => void;
  onOpenVoiceModal?: () => void;
  onOpenGoalModal?: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onNavigateTab: (tab: NavTab) => void;
  onOpenGoalDeposit: (goal: FinancialGoal) => void;
}

function getTxIcon(categoryName: string, type: 'income' | 'expense') {
  const lower = categoryName.toLowerCase();
  if (type === 'income') return Briefcase;
  if (lower.includes('ovqat') || lower.includes('kafe') || lower.includes('market')) return Utensils;
  if (lower.includes('transport') || lower.includes('yoqilg')) return Car;
  if (lower.includes('uy') || lower.includes('ijara')) return Home;
  if (lower.includes('xarid') || lower.includes('kiyim')) return ShoppingBag;
  return CreditCard;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  recentTransactions,
  goals,
  loading = false,
  selectedPeriod,
  onSelectPeriod,
  onOpenTransactionModal,
  onOpenVoiceModal,
  onOpenGoalModal,
  onEditTransaction,
  onDeleteTransaction,
  onNavigateTab,
  onOpenGoalDeposit,
}) => {
  const { user } = useAuth();
  const [chartGranularity, setChartGranularity] = useState<'week' | 'month' | 'year'>('week');
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadAIInsight = async () => {
      try {
        const res = await api.getHealthScore();
        if (active && res?.healthScore) {
          setHealthScore(res.healthScore);
        }
      } catch {
        // Fallback summary computed below
      }
    };
    loadAIInsight();
    return () => {
      active = false;
    };
  }, [user, summary?.totalIncome, summary?.totalExpense]);

  const totalBalance = summary?.totalBalance ?? 0;
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const monthlyBudgetLimit = user?.monthlyBudget || 5000000;
  const budgetUsedPct =
    monthlyBudgetLimit > 0 ? Math.min(999, Math.round((totalExpense / monthlyBudgetLimit) * 100)) : 0;
  const ringClampedPct = Math.max(0, Math.min(100, budgetUsedPct));

  const aiAdviceText = useMemo(() => {
    if (healthScore?.summary) return healthScore.summary;
    const topCat = summary?.categoriesBreakdown?.[0];
    if (topCat && totalExpense > 0) {
      const suggestedLimit = Math.round((topCat.amount * 0.9) / 50000) * 50000;
      return `Ushbu davrda ${topCat.categoryName.toLowerCase()} xarajatlaringiz jami sarfning ${topCat.percentage}% qismini tashkil etdi. Keyingi oy uchun ${formatMoney(
        Math.max(100000, suggestedLimit)
      )} limit belgilashni tavsiya qilaman.`;
    }
    return 'Xarajatlaringizni tahlil qilib, budjetingizni samarali boshqarishga yordam beramiz.';
  }, [healthScore?.summary, summary?.categoriesBreakdown, totalExpense]);

  const chartData = useMemo(() => {
    if (chartGranularity === 'week') {
      const daily = summary?.dailyBreakdown || [];
      if (daily.length > 0) {
        return daily.slice(-6).map((d) => ({
          month: formatDateUz(d.date).split(',')[0],
          income: d.income,
          expense: d.expense,
          savings: d.income - d.expense,
        }));
      }
    }
    if (chartGranularity === 'year') {
      return (summary?.monthlyComparison || []).slice(-12);
    }
    return (summary?.monthlyComparison || []).slice(-6);
  }, [chartGranularity, summary?.dailyBreakdown, summary?.monthlyComparison]);

  const quickActions = [
    {
      label: 'Kirim',
      icon: Plus,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/12 dark:bg-emerald-400/10',
      onClick: () => onOpenTransactionModal('income'),
    },
    {
      label: 'Chiqim',
      icon: Minus,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-500/12 dark:bg-rose-400/10',
      onClick: () => onOpenTransactionModal('expense'),
    },
    {
      label: 'Ovoz bilan',
      icon: Mic,
      color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/12 dark:bg-cyan-400/10',
      onClick: () => (onOpenVoiceModal ? onOpenVoiceModal() : onNavigateTab('ai')),
    },
    {
      label: 'Chek skaneri',
      icon: ScanLine,
      color: 'text-sky-600 dark:text-sky-400 bg-sky-500/12 dark:bg-sky-400/10',
      onClick: () => onNavigateTab('receipts'),
    },
    {
      label: 'Oʻtkazma',
      icon: ArrowLeftRight,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/12 dark:bg-amber-400/10',
      onClick: () => onNavigateTab('wallets'),
    },
    {
      label: 'Yana',
      icon: MoreHorizontal,
      color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06]',
      onClick: () => setMoreDrawerOpen(true),
    },
  ];

  const moreTools: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'wallets', label: 'Hamyonlar', icon: ArrowLeftRight },
    { id: 'budgets', label: 'Budjetlar', icon: PieChart },
    { id: 'debts', label: 'Qarzlar', icon: HandCoins },
    { id: 'family', label: 'Oilaviy budjet', icon: Users },
    { id: 'subscriptions', label: 'Obunalar', icon: Clock },
    { id: 'recurring', label: 'Avto-toʻlovlar', icon: Repeat },
    { id: 'currencies', label: 'Valyutalar', icon: Coins },
    { id: 'banks', label: 'Banklar', icon: Building2 },
    { id: 'telegram', label: 'Telegram Bot', icon: Send },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_310px] gap-4 pb-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_.9fr] gap-4">
            <Skeleton className="h-48 rounded-[22px]" />
            <Skeleton className="h-48 rounded-[22px]" />
          </div>
          <Skeleton className="h-24 rounded-[22px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-44 rounded-[22px]" />
            <Skeleton className="h-44 rounded-[22px]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr] gap-4">
            <Skeleton className="h-64 rounded-[22px]" />
            <Skeleton className="h-64 rounded-[22px]" />
          </div>
        </div>
        <Skeleton className="h-[460px] rounded-[22px]" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full pb-2 hai-fade-up">
      {/* Mobile Quick Period Selector (< sm where header dropdown is hidden) */}
      <div className="sm:hidden flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Hisobot davri:
        </span>
        <select
          aria-label="Hisobot davrini tanlash"
          value={selectedPeriod}
          onChange={(e) => onSelectPeriod(e.target.value as DashboardPeriod)}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#0D1927] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100"
        >
          <option value="this_month">Joriy oy</option>
          <option value="last_month">Oʻtgan oy</option>
          <option value="7days">Soʻnggi 7 kun</option>
          <option value="30days">Soʻnggi 30 kun</option>
          <option value="this_year">Joriy yil</option>
        </select>
      </div>

      {/* MAIN GRID: Center Content + Right Transactions Panel */}
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_305px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* 1. BALANCE + HISOBOT AI */}
          <div className="grid gap-4 lg:grid-cols-[1.3fr_.9fr]">
            <BalanceCard
              amount={totalBalance}
              incomeTotal={totalIncome}
              expenseTotal={totalExpense}
              actionLabel="Hamyonlar"
              onActionClick={() => onNavigateTab('wallets')}
            />

            <section
              aria-label="HISOBOT AI yordamchisi"
              className="relative flex min-h-[190px] items-center gap-4 overflow-hidden rounded-[22px] border border-emerald-500/20 dark:border-white/[0.09] bg-gradient-to-br from-[#0F3F3A] via-[#0E3130] to-[#0C2228] p-5 text-white shadow-[0_16px_45px_rgba(0,0,0,0.22)]"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-teal-400/12 blur-3xl"
              />
              <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-teal-300/25 bg-teal-300/10 text-teal-300 shadow-[0_0_30px_rgba(6,182,212,0.14)]">
                <Bot size={36} />
                <Sparkles className="absolute -right-1 -top-1 text-emerald-300" size={16} />
              </div>
              <div className="relative min-w-0 flex-1">
                <h2 className="mb-1 text-lg font-black tracking-tight text-white">HISOBOT AI</h2>
                <p className="mb-3.5 text-xs leading-relaxed text-slate-200/85">
                  Sizning aqlli moliyaviy yordamchingiz.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('ai')}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3.5 py-2 text-xs font-bold text-[#05251D] transition hover:bg-emerald-300 cursor-pointer shadow-[0_4px_16px_rgba(16,185,129,0.28)]"
                >
                  <span>AI bilan suhbat</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </section>
          </div>

          {/* 2. QUICK ACTIONS STRIP */}
          <Card padding="none" className="p-3 sm:p-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {quickActions.map(({ label, icon: Icon, color, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="group flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 transition hover:bg-slate-100/70 dark:hover:bg-white/[0.05] cursor-pointer"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200/70 dark:border-white/[0.08] transition group-hover:scale-105 ${color}`}
                  >
                    <Icon size={20} />
                  </span>
                  <span className="text-center text-[11px] font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white whitespace-nowrap">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* 3. OYLIK BUDJET + AI TAVSIYASI */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card padding="none" className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                  Oylik budjet
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigateTab('budgets')}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer"
                >
                  Batafsil →
                </button>
              </div>

              <div className="flex items-center gap-5">
                <div
                  className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(${
                      budgetUsedPct > 100 ? '#EF4444' : '#10B981'
                    } 0% ${ringClampedPct}%, rgba(148,163,184,0.22) ${ringClampedPct}% 100%)`,
                  }}
                >
                  <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-white dark:bg-[#0D1927]">
                    <b className="text-xl text-slate-900 dark:text-white tabular-nums leading-none">
                      {budgetUsedPct}%
                    </b>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Sarflangan
                    </span>
                  </div>
                </div>

                <div className="min-w-0 space-y-2.5 text-xs">
                  <div className="text-slate-500 dark:text-slate-400">
                    Sarflangan{' '}
                    <b className="block text-sm font-bold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
                      {formatMoney(totalExpense)}
                    </b>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Limit{' '}
                    <b className="block text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums mt-0.5 truncate">
                      {formatMoney(monthlyBudgetLimit)}
                    </b>
                  </div>
                </div>
              </div>
            </Card>

            <Card padding="none" className="relative overflow-hidden p-4 sm:p-5 flex flex-col justify-between">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-teal-400/[0.10] blur-2xl"
              />
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base flex items-center gap-1.5">
                    <span>AI tavsiyasi</span>
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('ai')}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer"
                  >
                    Batafsil →
                  </button>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-3">
                  {aiAdviceText}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('forecast')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 px-3 py-2.5 text-xs font-bold text-[#03251C] transition-all cursor-pointer shadow-[0_6px_18px_rgba(16,185,129,0.25)]"
              >
                <span>Tahlilni koʻrish</span>
                <ChevronRight size={15} />
              </button>
            </Card>
          </div>

          {/* 4. CHART + MAQSADLAR */}
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <Card padding="none" className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                  Daromad va xarajat dinamikasi
                </h3>
                <select
                  aria-label="Grafik davrini tanlash"
                  value={chartGranularity}
                  onChange={(e) => setChartGranularity(e.target.value as 'week' | 'month' | 'year')}
                  className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#142A31] px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                >
                  <option value="week">Hafta</option>
                  <option value="month">Oy</option>
                  <option value="year">Yil</option>
                </select>
              </div>

              <IncomeExpenseBarChart data={chartData} height={220} compact />
            </Card>

            <Card padding="none" className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                  Maqsadlar
                </h3>
                <button
                  type="button"
                  onClick={() => (onOpenGoalModal ? onOpenGoalModal() : onNavigateTab('goals'))}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer"
                >
                  Yangi maqsad +
                </button>
              </div>

              {goals.length === 0 ? (
                <EmptyState
                  icon={<Target className="w-5 h-5" />}
                  title="Maqsadlar mavjud emas"
                  description="Yangi moliyaviy maqsad yarating."
                  action={
                    <Button
                      size="sm"
                      onClick={() => (onOpenGoalModal ? onOpenGoalModal() : onNavigateTab('goals'))}
                    >
                      Maqsad qoʻshish
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {goals.slice(0, 4).map((goal, idx) => {
                    const percent =
                      goal.targetAmount > 0
                        ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
                        : 0;
                    const barGrad =
                      idx % 2 === 0
                        ? 'from-emerald-600 to-emerald-300'
                        : 'from-teal-600 to-teal-300';
                    return (
                      <div
                        key={goal.id}
                        onClick={() => onOpenGoalDeposit(goal)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenGoalDeposit(goal);
                          }
                        }}
                        className="group cursor-pointer rounded-xl p-2 -mx-2 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{goal.name}</span>
                          </span>
                          <b className="text-emerald-600 dark:text-emerald-300 tabular-nums shrink-0">
                            {percent}%
                          </b>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${barGrad} transition-[width] duration-500`}
                            style={{ width: `${Math.max(4, percent)}%` }}
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span className="truncate">
                            {formatMoney(goal.savedAmount)} / {formatMoney(goal.targetAmount)}
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold opacity-80 group-hover:opacity-100 shrink-0">
                            + Toʻldirish
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* RIGHT STICKY TRANSACTIONS PANEL (visible on xl+ alongside workspace, stacked cleanly below on mobile/tablet) */}
        <aside className="min-w-0">
          <Card padding="none" className="xl:sticky xl:top-20 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white sm:text-base">
                Soʻnggi tranzaksiyalar
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('expense')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                Barchasi →
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="w-5 h-5" />}
                title="Tranzaksiyalar yoʻq"
                description="Birinchi operatsiyani kiriting."
                action={
                  <Button size="sm" onClick={() => onOpenTransactionModal('expense')}>
                    Qoʻshish
                  </Button>
                }
              />
            ) : (
              <div className="space-y-1">
                {recentTransactions.slice(0, 8).map((tx) => {
                  const Icon = tx.type === 'income' ? TrendingUp : getTxIcon(tx.categoryName, tx.type);
                  const isIncome = tx.type === 'income';
                  return (
                    <div
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onEditTransaction(tx);
                        }
                      }}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-slate-100/80 dark:hover:bg-white/[0.04] cursor-pointer group"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          isIncome
                            ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <Icon size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                          {formatDateUz(tx.date)}
                          {tx.time ? `, ${tx.time}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`whitespace-nowrap text-[11px] font-bold tabular-nums ${
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatMoney(tx.amount)}
                        </span>
                        <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block ml-1" />
                        <button
                          type="button"
                          aria-label="Tranzaksiyani oʻchirish"
                          title="Oʻchirish"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTransaction(tx.id);
                          }}
                          className="w-6 h-6 rounded-lg items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 hidden sm:flex opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </aside>
      </div>

      {/* "Yana" More Tools Drawer */}
      <Drawer
        isOpen={moreDrawerOpen}
        onClose={() => setMoreDrawerOpen(false)}
        side="bottom"
        title="Barcha moliya vositalari"
      >
        <div className="grid grid-cols-3 gap-2.5 pb-2">
          {moreTools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  setMoreDrawerOpen(false);
                  onNavigateTab(tool.id);
                }}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] hover:border-emerald-500/40 transition-colors cursor-pointer"
              >
                <span className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 text-center leading-tight">
                  {tool.label}
                </span>
              </button>
            );
          })}
        </div>
      </Drawer>
    </div>
  );
};
