/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Target,
  Mic,
  Crown,
  Receipt,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  FinancialSummary,
  Transaction,
  FinancialGoal,
  FinancialHealthScore,
} from '../../types/finance.ts';
import { formatMoney } from '../../utils/formatters.ts';
import {
  IncomeExpenseBarChart,
  CategoryProgressList,
  InteractivePieChart,
  DailyTrendLineChart,
  BudgetGaugeChart,
} from '../charts/InteractiveCharts.tsx';
import { NavTab } from '../layout/Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  BalanceCard,
  Card,
  ChartCard,
  AIInsightCard,
  TransactionRow,
  ProgressBar,
  Skeleton,
  EmptyState,
  Button,
} from '../../design-system/index.ts';

interface DashboardViewProps {
  summary: FinancialSummary | null;
  recentTransactions: Transaction[];
  goals: FinancialGoal[];
  loading?: boolean;
  onOpenTransactionModal: (type: 'income' | 'expense') => void;
  onOpenVoiceModal?: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onNavigateTab: (tab: NavTab) => void;
  onOpenGoalDeposit: (goal: FinancialGoal) => void;
  onOpenPremiumModal?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  recentTransactions,
  goals,
  loading = false,
  onOpenTransactionModal,
  onOpenVoiceModal,
  onEditTransaction,
  onDeleteTransaction,
  onNavigateTab,
  onOpenGoalDeposit,
  onOpenPremiumModal,
}) => {
  const { user } = useAuth();
  const [leftChartType, setLeftChartType] = useState<'bar' | 'line'>('bar');
  const [rightViewMode, setRightViewMode] = useState<'budget' | 'donut' | 'list'>('donut');
  const [txFilter, setTxFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadAIInsight = async () => {
      try {
        setInsightLoading(true);
        const res = await api.getHealthScore();
        if (active && res?.healthScore) {
          setHealthScore(res.healthScore);
        }
      } catch {
        // Silent fallback handled cleanly in UI badge
      } finally {
        if (active) setInsightLoading(false);
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
  const netSavings = summary?.netSavings ?? totalIncome - totalExpense;
  const savingsRate = summary?.savingsRate ?? 0;
  const monthlyBudgetLimit = user?.monthlyBudget || 5000000;
  const budgetUsedPct =
    monthlyBudgetLimit > 0 ? Math.round((totalExpense / monthlyBudgetLimit) * 100) : 0;
  const budgetRemaining = monthlyBudgetLimit - totalExpense;

  const filteredTransactions = useMemo(() => {
    const base =
      txFilter === 'all'
        ? recentTransactions
        : recentTransactions.filter((t) => t.type === txFilter);
    return base.slice(0, 7);
  }, [recentTransactions, txFilter]);

  const firstName = (user?.fullName || 'Foydalanuvchi').trim().split(/\s+/)[0];
  const currentMonthLabel = new Intl.DateTimeFormat('uz-UZ', {
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const hasLiveInsight = Boolean(healthScore && healthScore.summary);
  const insightText = hasLiveInsight
    ? `${healthScore!.summary} Moliyaviy salomatlik indeksi: ${healthScore!.score}/100 (${healthScore!.grade} daraja).`
    : 'Masalan: «Bugun 150 ming soʻm ovqatga sarfladim» yoki «Ishdan 5 million oylik oldim» deb yozib yoki gapirib koʻring.';

  if (loading) {
    return (
      <div className="space-y-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Skeleton className="h-12 w-64 rounded-xl" />
          <Skeleton className="h-11 w-72 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Skeleton className="lg:col-span-7 h-56 rounded-[22px]" />
          <div className="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-4">
            <Skeleton className="h-26 rounded-2xl" />
            <Skeleton className="h-26 rounded-2xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <Skeleton className="lg:col-span-7 h-36 rounded-2xl" />
          <Skeleton className="lg:col-span-5 h-36 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-8 h-80 rounded-2xl" />
          <Skeleton className="lg:col-span-4 h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 pb-4 hai-fade-up">
      {/* 1. Refined Page Heading & Action Area */}
      <section
        aria-label="Sahifa sarlavhasi va tezkor amallar"
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 capitalize">
            {currentMonthLabel} · Shaxsiy moliya sharhi
          </p>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-0.5 truncate">
            Assalomu alaykum, {firstName}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="md"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => onOpenTransactionModal('income')}
          >
            Kirim qoʻshish
          </Button>
          <Button
            variant="outline"
            size="md"
            leadingIcon={<ArrowUpRight className="w-4 h-4 text-rose-500" />}
            onClick={() => onOpenTransactionModal('expense')}
          >
            Chiqim yozish
          </Button>
          {onOpenVoiceModal && (
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<Mic className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />}
              onClick={onOpenVoiceModal}
              className="col-span-2 sm:col-span-1"
            >
              Ovoz bilan
            </Button>
          )}
        </div>
      </section>

      {/* 2 & 3. Hero Balance Card + Paired Income & Expense Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7">
          <BalanceCard
            amount={totalBalance}
            incomeTotal={totalIncome}
            expenseTotal={totalExpense}
            netSavings={netSavings}
            savingsRate={savingsRate}
            actionLabel="Hamyonlar"
            onActionClick={() => onNavigateTab('wallets')}
            className="h-full flex flex-col justify-between"
          />
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 lg:grid-cols-1 gap-3.5 sm:gap-4">
          {/* Monthly Income Card */}
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                  Oylik daromad
                </span>
                <div className="text-base sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight mt-1.5 break-words">
                  +{formatMoney(totalIncome)}
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">{summary?.incomeCount || 0} ta tushum</span>
              <button
                type="button"
                onClick={() => onNavigateTab('income')}
                className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                Batafsil →
              </button>
            </div>
          </Card>

          {/* Monthly Expense Card */}
          <Card padding="md" className="flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                  Oylik xarajat
                </span>
                <div className="text-base sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums tracking-tight mt-1.5 break-words">
                  -{formatMoney(totalExpense)}
                </div>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="tabular-nums">{summary?.expenseCount || 0} ta chiqim</span>
              <button
                type="button"
                onClick={() => onNavigateTab('expense')}
                className="font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                Batafsil →
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* 4. Savings & Budget Summary + Compact Quick Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <Card padding="md" className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Oylik budjet va jamgʻarma xulosasi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Belgilangan limit boʻyicha joriy oy sarfi
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('budgets')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap cursor-pointer shrink-0"
            >
              Budjetlar →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 pb-3.5">
            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Qolgan limit
              </span>
              <span
                className={`text-sm sm:text-lg font-extrabold tabular-nums block mt-0.5 truncate ${
                  budgetRemaining >= 0
                    ? 'text-slate-900 dark:text-white'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {budgetRemaining >= 0
                  ? formatMoney(budgetRemaining)
                  : `-${formatMoney(Math.abs(budgetRemaining))}`}
              </span>
            </div>

            <div className="min-w-0">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Oylik meʼyor
              </span>
              <span className="text-sm sm:text-lg font-bold text-slate-700 dark:text-slate-200 tabular-nums block mt-0.5 truncate">
                {formatMoney(monthlyBudgetLimit)}
              </span>
            </div>

            <div className="min-w-0 text-right">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                Sof jamgʻarma
              </span>
              <span
                className={`text-sm sm:text-lg font-extrabold tabular-nums block mt-0.5 truncate ${
                  netSavings >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {netSavings >= 0 ? '+' : '-'}
                {formatMoney(Math.abs(netSavings))}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <ProgressBar
              size="md"
              value={budgetUsedPct}
              tone={budgetUsedPct > 100 ? 'rose' : budgetUsedPct >= 80 ? 'amber' : 'emerald'}
              label="Oylik budjet sarflanishi"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              <span>Limitdan {budgetUsedPct}% sarflandi</span>
              <span>Tejash koʻrsatkichi: {savingsRate}%</span>
            </div>
          </div>
        </Card>

        {/* Compact Quick Tools Grid */}
        <Card padding="md" className="lg:col-span-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tezkor vositalar
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Asosiy boʻlimlarga oʻtish
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('receipts')}
              className="flex items-center gap-2.5 min-h-12 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] hover:border-emerald-500/40 transition-colors text-left cursor-pointer"
            >
              <span className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-slate-200/70 dark:border-white/[0.08] flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                <Receipt className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                Chek skaneri
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('wallets')}
              className="flex items-center gap-2.5 min-h-12 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] hover:border-emerald-500/40 transition-colors text-left cursor-pointer"
            >
              <span className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-slate-200/70 dark:border-white/[0.08] flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <ArrowRightLeft className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                Oʻtkazma
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="flex items-center gap-2.5 min-h-12 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] hover:border-emerald-500/40 transition-colors text-left cursor-pointer"
            >
              <span className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-slate-200/70 dark:border-white/[0.08] flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <BarChart3 className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                Hisobotlar
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('forecast')}
              className="flex items-center gap-2.5 min-h-12 p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] hover:border-cyan-500/40 transition-colors text-left cursor-pointer"
            >
              <span className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.07] border border-slate-200/70 dark:border-white/[0.08] flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </span>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                AI Prognoz
              </span>
            </button>
          </div>
        </Card>
      </div>

      {/* 5. Spacious Interactive Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <ChartCard
          className="lg:col-span-8"
          title={
            leftChartType === 'bar'
              ? 'Daromad va xarajat dinamikasi'
              : 'Kunlik pul oqimi grafigi'
          }
          subtitle={
            leftChartType === 'bar'
              ? 'Oylar boʻyicha tushum, xarajat va sof jamgʻarma'
              : 'Kunlik tushum va xarajatlar trendi'
          }
          headerAction={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1 bg-slate-100 dark:bg-white/[0.06] rounded-xl flex items-center border border-slate-200/70 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setLeftChartType('bar')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    leftChartType === 'bar'
                      ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Ustunli
                </button>
                <button
                  type="button"
                  onClick={() => setLeftChartType('line')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    leftChartType === 'line'
                      ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Chiziqli
                </button>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('reports')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline px-2 py-1 cursor-pointer whitespace-nowrap"
              >
                Hisobotlar →
              </button>
            </div>
          }
        >
          {leftChartType === 'bar' ? (
            <IncomeExpenseBarChart data={summary?.monthlyComparison || []} height={265} />
          ) : (
            <DailyTrendLineChart data={summary?.dailyBreakdown || []} height={265} />
          )}
        </ChartCard>

        <ChartCard
          className="lg:col-span-4"
          title="Toifalar va budjet"
          subtitle="Joriy oydagi asosiy chiqimlar"
          headerAction={
            <div className="p-1 bg-slate-100 dark:bg-white/[0.06] rounded-xl flex items-center border border-slate-200/70 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setRightViewMode('donut')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  rightViewMode === 'donut'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Doira
              </button>
              <button
                type="button"
                onClick={() => setRightViewMode('list')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  rightViewMode === 'list'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Roʻyxat
              </button>
              <button
                type="button"
                onClick={() => setRightViewMode('budget')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  rightViewMode === 'budget'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Budjet
              </button>
            </div>
          }
          footer={
            <Button
              variant="outline"
              size="sm"
              fullWidth
              onClick={() => onNavigateTab('budgets')}
            >
              Budjet limitlarini boshqarish
            </Button>
          }
        >
          {rightViewMode === 'donut' ? (
            <InteractivePieChart
              categories={summary?.categoriesBreakdown || []}
              totalAmount={totalExpense}
            />
          ) : rightViewMode === 'list' ? (
            <CategoryProgressList
              categories={summary?.categoriesBreakdown || []}
              totalExpense={totalExpense}
            />
          ) : (
            <div className="py-4">
              <BudgetGaugeChart
                spent={totalExpense}
                limit={monthlyBudgetLimit}
                percentage={budgetUsedPct}
              />
            </div>
          )}
        </ChartCard>
      </div>

      {/* 6 & 7. Recent Transactions + AI Financial Insight & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* 6. Recent Transactions */}
        <Card padding="lg" className="lg:col-span-7 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-slate-100 dark:border-white/[0.08]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Soʻnggi tranzaksiyalar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Oxirgi kirim va chiqim operatsiyalari
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="p-1 bg-slate-100 dark:bg-white/[0.06] rounded-xl flex items-center border border-slate-200/70 dark:border-white/[0.08]">
                {(
                  [
                    { id: 'all', label: 'Barchasi' },
                    { id: 'income', label: 'Kirim' },
                    { id: 'expense', label: 'Chiqim' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTxFilter(item.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      txFilter === item.id
                        ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab(txFilter === 'income' ? 'income' : 'expense')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline px-1.5 py-1 cursor-pointer whitespace-nowrap"
              >
                Barchasi →
              </button>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-5 h-5" />}
              title="Tranzaksiyalar topilmadi"
              description="Tanlangan filtr boʻyicha yozuvlar mavjud emas yoki yangi operatsiya qoʻshing."
              action={
                <Button size="sm" onClick={() => onOpenTransactionModal('expense')}>
                  Chiqim qoʻshish
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {filteredTransactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onEdit={onEditTransaction}
                  onDelete={onDeleteTransaction}
                />
              ))}
            </div>
          )}
        </Card>

        {/* 7. AI Insight + Goals */}
        <div className="lg:col-span-5 space-y-5">
          {insightLoading && !healthScore ? (
            <Skeleton className="h-44 rounded-2xl" />
          ) : (
            <AIInsightCard
              title="AI moliyaviy tavsiyasi"
              sourceLabel={
                hasLiveInsight
                  ? `${healthScore!.title} · Tejash ulushi ${savingsRate}%`
                  : 'Ovozli va matnli kiritish namunasi'
              }
              insight={insightText}
              isLiveInsight={hasLiveInsight}
              ctaLabel="AI bilan suhbat"
              onCtaClick={() => onNavigateTab('ai')}
              secondaryAction={
                <button
                  type="button"
                  onClick={() => onNavigateTab('forecast')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  3 oylik prognoz →
                </button>
              }
            />
          )}

          <Card padding="lg">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Maqsadlar
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('goals')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                Barchasi ({goals.length})
              </button>
            </div>

            {goals.length === 0 ? (
              <EmptyState
                icon={<Target className="w-5 h-5" />}
                title="Maqsadlar mavjud emas"
                description="Avtomobil, uy-joy yoki jamgʻarma maqsadini qoʻshing."
                action={
                  <Button size="sm" onClick={() => onNavigateTab('goals')}>
                    Maqsad qoʻshish
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {goals.slice(0, 3).map((goal) => {
                  const percent =
                    goal.targetAmount > 0
                      ? Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100))
                      : 0;
                  return (
                    <div key={goal.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {goal.name}
                        </span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                          {percent}%
                        </span>
                      </div>

                      <ProgressBar
                        value={percent}
                        tone={percent >= 100 ? 'teal' : 'emerald'}
                        size="sm"
                      />

                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono tabular-nums truncate">
                          {formatMoney(goal.savedAmount)} / {formatMoney(goal.targetAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenGoalDeposit(goal)}
                          className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold shrink-0 cursor-pointer"
                        >
                          + Qoʻshish
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 8. Compact Subscription Banner */}
      {onOpenPremiumModal && (
        <section
          aria-label="HISOBOT AI obuna"
          className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-slate-200/85 dark:border-white/[0.09] bg-[#081220] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/25 text-amber-300 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {user?.isPremium
                    ? `HISOBOT AI ${user.premiumPlan?.toUpperCase() || 'PRO'} faol`
                    : 'HISOBOT AI Premium imkoniyatlari'}
                </h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-400 text-slate-950 whitespace-nowrap">
                  {user?.isPremium ? 'FAOL' : '-17% YILLIK'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 truncate">
                {user?.isPremium
                  ? 'Cheksiz hamyonlar, AI maslahatchi va oilaviy budjet vositalari ochiq.'
                  : 'Cheksiz hamyonlar, chek skaneri, 3 oylik AI prognoz va Telegram sinxronizatsiyasi.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPremiumModal}
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shrink-0 cursor-pointer whitespace-nowrap"
          >
            <span>{user?.isPremium ? 'Tarif tafsilotlari' : 'Obunani koʻrish'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>
      )}
    </div>
  );
};
