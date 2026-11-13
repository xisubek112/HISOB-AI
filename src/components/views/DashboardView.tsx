/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  Target,
  Mic,
  Crown,
  Receipt,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { FinancialSummary, Transaction, FinancialGoal } from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import {
  IncomeExpenseBarChart,
  CategoryProgressList,
  InteractivePieChart,
  DailyTrendLineChart,
} from '../charts/InteractiveCharts.tsx';
import { NavTab } from '../layout/Sidebar.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

interface DashboardViewProps {
  summary: FinancialSummary | null;
  recentTransactions: Transaction[];
  goals: FinancialGoal[];
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
  const [rightChartType, setRightChartType] = useState<'donut' | 'list'>('donut');

  const totalBalance = summary?.totalBalance ?? 0;
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const netSavings = summary?.netSavings ?? 0;
  const savingsRate = summary?.savingsRate ?? 0;

  return (
    <div className="relative space-y-5 sm:space-y-7 pb-6 hai-dashboard">
      {/* Ambient background blur orbs for Glassmorphism depth */}
      <div className="pointer-events-none absolute -top-10 -left-10 w-96 h-96 bg-violet-500/10 dark:bg-violet-600/15 rounded-full blur-3xl -z-10" />
      <div className="pointer-events-none absolute top-72 -right-10 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-600/15 rounded-full blur-3xl -z-10" />
      <div className="pointer-events-none absolute bottom-20 left-1/3 w-80 h-80 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl -z-10" />

      {/* Premium Status Banner with Glassmorphism */}
      {onOpenPremiumModal && (
        <div
          onClick={onOpenPremiumModal}
          className={`p-5 rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden group shadow-xl backdrop-blur-xl ${
            user?.isPremium
              ? 'bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border-amber-400/40 hover:border-amber-400/70 hover:shadow-amber-500/10 dark:bg-amber-950/20'
              : 'bg-gradient-to-br from-[#073B35] via-[#0B5B50] to-[#087E70] border-emerald-300/20 hover:border-emerald-300/50 hover:shadow-emerald-500/20 dark:from-[#073B35] dark:via-[#0B5B50] dark:to-[#087E70]'
          }`}
        >
          {/* Subtle light sweep reflection */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

          <div className="flex items-center gap-3.5 relative z-10">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md backdrop-blur-md ${
                user?.isPremium
                  ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-amber-500/30'
                  : 'bg-white/15 text-white shadow-emerald-900/20 ring-1 ring-white/20'
              }`}
            >
              <Crown className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {user?.isPremium
                    ? `HISOBOT AI ${user.premiumPlan?.toUpperCase()} — Faol Premium Obuna`
                    : 'HISOBOT AI Premium: Cheksiz moliyaviy imkoniyatlar'}
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wide shadow-xs ${
                    user?.isPremium
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 font-bold'
                      : 'bg-emerald-300 text-emerald-950'
                  }`}
                >
                  {user?.isPremium ? 'PRO STATUS' : 'CHEGIRMA -17%'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {user?.isPremium
                  ? 'Cheksiz hamyonlar, AI tahlil, OCR chek skaner va oilaviy budjet funksiyalaridan toʻliq foydalanmoqdasiz.'
                  : 'Oylik 39 000 soʻm evaziga cheksiz kartalar, OCR chek skaner, 3 oylik AI prognoz va Telegram botni oching.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-100 group-hover:translate-x-1 transition-transform shrink-0 relative z-10">
            <span>{user?.isPremium ? 'Tarif tafsilotlari' : 'Obunani faollashtirish'}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* 4 Metric Cards with Cohesive Glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Balance Card */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-[24px] bg-white dark:bg-[#111B27] border border-slate-200/70 dark:border-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-emerald-500/10 to-teal-500/0 rounded-full blur-xl group-hover:from-blue-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-4">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Jami sof balans</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center backdrop-blur-md border border-blue-500/20 shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white tracking-tight">
              {formatMoney(totalBalance)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
              <span>Barcha hisob va kartalar boʻyicha</span>
            </div>
          </div>
        </div>

        {/* Total Income Card */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-[24px] bg-white dark:bg-[#111B27] border border-slate-200/70 dark:border-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-emerald-500/10 to-cyan-500/0 rounded-full blur-xl group-hover:from-emerald-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-4">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Joriy oydagi daromad</span>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center backdrop-blur-md border border-emerald-500/20 shadow-xs">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{formatMoney(totalIncome)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-xs shadow-emerald-500/50" />
              <span>{summary?.incomeCount || 0} ta tushum qayd etilgan</span>
            </div>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-[24px] bg-white dark:bg-[#111B27] border border-slate-200/70 dark:border-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-rose-500/10 to-violet-500/0 rounded-full blur-xl group-hover:from-rose-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-4">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Joriy oydagi xarajat</span>
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 dark:bg-rose-400/10 text-rose-600 dark:text-rose-400 flex items-center justify-center backdrop-blur-md border border-rose-500/20 shadow-xs">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              -{formatMoney(totalExpense)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-rose-500 shadow-xs shadow-rose-500/50" />
              <span>{summary?.expenseCount || 0} ta chiqim amalga oshirilgan</span>
            </div>
          </div>
        </div>

        {/* Net Savings & Rate Card */}
        <div className="relative overflow-hidden p-5 sm:p-6 rounded-[24px] bg-white dark:bg-[#111B27] border border-slate-200/70 dark:border-white/10 shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:shadow-[0_16px_36px_rgba(15,23,42,0.10)] hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-br from-teal-500/10 to-emerald-500/0 rounded-full blur-xl group-hover:from-violet-500/20 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-4">
            <span className="font-semibold text-slate-600 dark:text-slate-300">Sof tejash (Jamgʻarma)</span>
            <div className="w-9 h-9 rounded-2xl bg-teal-500/10 dark:bg-teal-400/10 text-teal-600 dark:text-teal-400 flex items-center justify-center backdrop-blur-md border border-violet-500/20 shadow-xs">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black font-mono tracking-tight ${
              netSavings >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {netSavings >= 0 ? '+' : ''}{formatMoney(netSavings)}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-gradient-to-r from-violet-600 to-blue-500 shadow-xs shadow-violet-500/50" />
              <span>Daromadning {savingsRate}% qismi tejaldi</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant Quick Banner with Glassmorphic Gradient */}
      <div className="relative overflow-hidden p-6 rounded-3xl backdrop-blur-2xl bg-gradient-to-r from-[#073B35] via-[#087E70] to-[#0E9F83] text-white border border-white/30 shadow-2xl shadow-emerald-900/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
            <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>HISOBOT AI: Tabiiy tilda kirim-chiqimlarni kiriting</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-blue-100 font-mono">Ovoz & Matn</span>
            </h3>
            <p className="text-xs text-emerald-50/90 mt-1">
              Masalan: «Bugun 150 ming soʻm ovqatga sarfladim» yoki «Ishdan 5 million oylik oldim»
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 relative z-10 flex-wrap">
          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-2xl text-xs font-bold transition-all whitespace-nowrap shadow-sm backdrop-blur-md border border-white/25 active:scale-95"
            >
              <Mic className="w-4 h-4 text-purple-200" />
              <span>Ovoz bilan kiritish</span>
            </button>
          )}
          <button
            onClick={() => onNavigateTab('receipts')}
            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold transition-all whitespace-nowrap border border-white/25 backdrop-blur-md active:scale-95"
          >
            <Receipt className="w-4 h-4 text-emerald-200" />
            <span>Chek skaner (OCR)</span>
          </button>
          <button
            onClick={() => onNavigateTab('ai')}
            className="px-4 py-2.5 bg-white text-emerald-800 rounded-2xl text-xs font-extrabold hover:bg-blue-50 transition-all shadow-md whitespace-nowrap active:scale-95"
          >
            AI yordamchi
          </button>
        </div>
      </div>

      {/* Charts & Breakdown Split with Glassmorphism */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dynamic Financial Flow: Bar Chart vs Line Graph */}
        <div className="lg:col-span-2 relative overflow-hidden p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{leftChartType === 'bar' ? 'Kirim va Chiqim Oylik Dinamikasi' : 'Kunlik Pul Oqimi Grafigi'}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {leftChartType === 'bar'
                    ? 'Oylar boʻyicha tushum va xarajatlar taqqoslanishi (Vibrant Ustunli grafik)'
                    : 'Kunlik tushum va chiqimlarning toʻlqinsimon chiziqli grafigi'}
                </p>
              </div>

              {/* View Switcher: Bar vs Line */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <div className="p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl flex items-center border border-slate-200/60 dark:border-white/10 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setLeftChartType('bar')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                      leftChartType === 'bar'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Ustunli (Bar)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeftChartType('line')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 ${
                      leftChartType === 'line'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Chiziqli (Line)</span>
                  </button>
                </div>
                <button
                  onClick={() => onNavigateTab('reports')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline px-2.5 py-1"
                >
                  Hisobotlar →
                </button>
              </div>
            </div>

            {leftChartType === 'bar' ? (
              <IncomeExpenseBarChart data={summary?.monthlyComparison || []} height={260} />
            ) : (
              <DailyTrendLineChart data={summary?.dailyBreakdown || []} height={260} />
            )}
          </div>
        </div>

        {/* Spending Breakdown: Donut Chart vs Category List */}
        <div className="relative overflow-hidden p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-5 pb-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Toifalar Taqsimoti
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Joriy oydagi eng katta chiqimlar
                </p>
              </div>

              {/* View Switcher: Donut vs List */}
              <div className="p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl flex items-center border border-slate-200/60 dark:border-white/10 shadow-inner">
                <button
                  type="button"
                  onClick={() => setRightChartType('donut')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all duration-200 ${
                    rightChartType === 'donut'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Doira grafik"
                >
                  Doira
                </button>
                <button
                  type="button"
                  onClick={() => setRightChartType('list')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all duration-200 ${
                    rightChartType === 'list'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Roʻyxat"
                >
                  Roʻyxat
                </button>
              </div>
            </div>

            {rightChartType === 'donut' ? (
              <InteractivePieChart
                categories={summary?.categoriesBreakdown || []}
                totalAmount={totalExpense}
              />
            ) : (
              <CategoryProgressList
                categories={summary?.categoriesBreakdown || []}
                totalExpense={totalExpense}
              />
            )}
          </div>

          <button
            onClick={() => onNavigateTab('budgets')}
            className="w-full mt-4 py-2.5 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-white/10 transition-colors text-center backdrop-blur-xs"
          >
            Budjet limitlarini boshqarish
          </button>
        </div>
      </div>

      {/* Financial Goals & Recent Transactions Row with Glassmorphism */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Goals Widget */}
        <div className="relative overflow-hidden p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 dark:bg-teal-400/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-violet-500/20">
                <Target className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Jamgʻarma maqsadlari
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('goals')}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Barchasi ({goals.length})
            </button>
          </div>

          <div className="space-y-3.5">
            {goals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Jamgʻarma maqsadlari mavjud emas.
              </div>
            ) : (
              goals.slice(0, 3).map((goal) => {
                const percent = Math.min(100, Math.round((goal.savedAmount / goal.targetAmount) * 100));
                return (
                  <div
                    key={goal.id}
                    className="p-4 rounded-2xl backdrop-blur-md bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-white/5 hover:border-violet-500/40 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-200 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                        {goal.name}
                      </span>
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                        {percent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200/60 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden mb-2.5">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-blue-500 rounded-full transition-all duration-500 shadow-xs"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-medium">
                        {formatMoney(goal.savedAmount)} / {formatMoney(goal.targetAmount)}
                      </span>
                      <button
                        onClick={() => onOpenGoalDeposit(goal)}
                        className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-bold transition-colors"
                      >
                        + Qoʻshish
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="lg:col-span-2 relative overflow-hidden p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Oxirgi tranzaksiyalar
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Yaqinda kiritilgan kirim va chiqimlar
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenTransactionModal('expense')}
                  className="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl flex items-center gap-1.5 font-semibold transition-all border border-slate-200/50 dark:border-white/5 active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Qoʻshish</span>
                </button>
                <button
                  onClick={() => onNavigateTab('expense')}
                  className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline px-2 py-1"
                >
                  Tarix →
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
              {recentTransactions.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Hozircha tranzaksiyalar mavjud emas. Yuqoridagi tezkor tugmalar orqali kirim yoki chiqim qoʻshing.
                </div>
              ) : (
                recentTransactions.slice(0, 6).map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 px-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 rounded-2xl transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs backdrop-blur-md ${
                          tx.type === 'income'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-emerald-500/10'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-rose-500/10'
                        }`}
                      >
                        {tx.type === 'income' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="font-medium text-slate-600 dark:text-slate-400">{tx.categoryName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{formatDateUz(tx.date)}</span>
                          {tx.walletName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 border border-slate-200/40 dark:border-white/5 font-mono">
                                {tx.walletName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div
                        className={`font-mono text-xs font-black text-right ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatMoney(tx.amount)}
                      </div>

                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          title="Tahrirlash"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Oʻchirish"
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
