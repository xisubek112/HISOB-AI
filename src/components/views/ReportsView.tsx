/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CheckCircle2,
} from 'lucide-react';
import { FinancialSummary, Transaction } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz, getTodayDateString } from '../../utils/formatters.ts';
import {
  IncomeExpenseBarChart,
  CategoryProgressList,
  DailyTrendLineChart,
  InteractivePieChart,
} from '../charts/InteractiveCharts.tsx';

export const ReportsView: React.FC = () => {
  const [period, setPeriod] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>(getTodayDateString());
  const [endDate, setEndDate] = useState<string>(getTodayDateString());
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportNotice, setExportNotice] = useState<string>('');
  const [reportChartType, setReportChartType] = useState<'line' | 'bar'>('line');
  const [categoryViewType, setCategoryViewType] = useState<'donut' | 'list'>('donut');

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.getSummary({
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
      });
      setSummary(res.summary);

      const txRes = await api.getTransactions({
        startDate: res.startDate,
        endDate: res.endDate,
      });
      setTransactions(txRes.transactions);
    } catch (e) {
      console.error('Failed to load report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [period, startDate, endDate]);

  const periodsList = [
    { id: 'today', label: 'Bugun' },
    { id: 'yesterday', label: 'Kecha' },
    { id: '7days', label: 'Oxirgi 7 kun' },
    { id: '30days', label: 'Oxirgi 30 kun' },
    { id: 'this_month', label: 'Shu oy' },
    { id: 'last_month', label: 'Oʻtgan oy' },
    { id: 'this_year', label: 'Shu yil' },
    { id: 'custom', label: 'Maxsus muddat' },
  ];

  // Export as Multi-sheet Excel (XLSX)
  const exportToExcel = async () => {
    if (!summary) return;

    try {
      showExportToast('Koʻp sahifali Excel tayyorlanmoqda...');

      // Fetch supplementary data for complete multi-sheet export
      const [wRes, bRes, gRes, sRes] = await Promise.all([
        api.getWallets(),
        api.getBudgets(),
        api.getGoals(),
        api.getSubscriptions(),
      ]);

      const wb = XLSX.utils.book_new();

      // Sheet 1: Summary Overview
      const summaryData = [
        ['HISOBOT AI — MOLIYAVIY HISOBOT VA STATISTIKA'],
        ['Hisobot davri:', period],
        ['Generatsiya qilingan sana:', new Date().toLocaleString('uz-UZ')],
        [],
        ['Asosiy koʻrsatkichlar', 'Summa / Miqdor'],
        ['Jami sof balans (soʻm)', summary.totalBalance],
        ['Davriy jami daromad (soʻm)', summary.totalIncome],
        ['Davriy jami xarajat (soʻm)', summary.totalExpense],
        ['Sof tejash (Jamgʻarma) (soʻm)', summary.netSavings],
        ['Jamgʻarma koeffitsiyenti', `${summary.savingsRate}%`],
        ['Kirim tranzaksiyalari soni', summary.incomeCount],
        ['Chiqim tranzaksiyalari soni', summary.expenseCount],
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Umumiy hisobot');

      // Sheet 2: Income Transactions
      const incomeRows = transactions
        .filter((t) => t.type === 'income')
        .map((t) => [
          t.date,
          t.time || '',
          t.categoryName,
          t.description,
          t.paymentMethod,
          t.amount,
          t.currency || 'UZS',
          t.notes || '',
        ]);
      const incomeData = [
        ['Sana', 'Vaqt', 'Kategoriya', 'Tavsif', 'Toʻlov usuli', 'Summa', 'Valyuta', 'Izoh'],
        ...incomeRows,
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incomeData), 'Kirimlar');

      // Sheet 3: Expense Transactions
      const expenseRows = transactions
        .filter((t) => t.type === 'expense')
        .map((t) => [
          t.date,
          t.time || '',
          t.categoryName,
          t.description,
          t.paymentMethod,
          t.amount,
          t.currency || 'UZS',
          t.notes || '',
        ]);
      const expenseData = [
        ['Sana', 'Vaqt', 'Kategoriya', 'Tavsif', 'Toʻlov usuli', 'Summa', 'Valyuta', 'Izoh'],
        ...expenseRows,
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenseData), 'Chiqimlar');

      // Sheet 4: Categories Breakdown
      const catData = [
        ['Toifa nomi', 'Turi', 'Operatsiyalar soni', 'Summa (soʻm)', 'Ulushi (%)'],
        ...summary.categoriesBreakdown.map((c) => [
          c.categoryName,
          c.type === 'income' ? 'Kirim' : 'Chiqim',
          c.count,
          c.amount,
          `${c.percentage}%`,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(catData), 'Toifalar');

      // Sheet 5: Wallets & Cards
      const walletData = [
        ['Hamyon / Karta nomi', 'Turi', 'Valyuta', 'Balans', 'Mask'],
        ...wRes.wallets.map((w) => [
          w.name,
          w.type,
          w.currency,
          w.balance,
          w.accountNumber || '',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(walletData), 'Hamyonlar');

      // Sheet 6: Budgets
      const budgetData = [
        ['Toifa', 'Oylik limit (soʻm)', 'Sarflandi (soʻm)', 'Qoldi (soʻm)', 'Ishlatilish (%)', 'Holat'],
        ...bRes.budgets.map((b) => [
          b.categoryName,
          b.monthlyLimit,
          b.spent,
          b.remaining,
          `${b.percentage}%`,
          b.isExceeded ? 'Oshib ketgan' : b.isWarning ? 'Xavfli chegara' : 'Normada',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(budgetData), 'Budjetlar');

      // Sheet 7: Financial Goals
      const goalData = [
        ['Maqsad nomi', 'Kerakli summa', 'Joriy toʻplangan', 'Bajarilish (%)', 'Muddat', 'Holat'],
        ...gRes.goals.map((g) => [
          g.name,
          g.targetAmount,
          g.savedAmount,
          `${Math.round((g.savedAmount / g.targetAmount) * 100)}%`,
          g.deadline,
          g.isCompleted ? 'Bajarilgan' : 'Jarayonda',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(goalData), 'Jamgʻarma maqsadlari');

      // Sheet 8: Subscriptions
      const subData = [
        ['Xizmat nomi', 'Toʻlov summasi', 'Valyuta', 'Davriylik', 'Keyingi toʻlov sanasi', 'Holat'],
        ...sRes.subscriptions.map((s) => [
          s.serviceName,
          s.amount,
          s.currency,
          s.billingInterval,
          s.nextPaymentDate,
          s.status,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(subData), 'Obunalar');

      // Write file
      XLSX.writeFile(wb, `Hisobot_AI_MultiSheet_${period}_${getTodayDateString()}.xlsx`);
      showExportToast('8 varaqli professional Excel (XLSX) muvaffaqiyatli yuklab olindi!');
    } catch (err: any) {
      console.error('Excel export error:', err);
      alert('Excel eksportida xatolik yuz berdi');
    }
  };

  // Export as CSV
  const exportToCSV = () => {
    if (!transactions || transactions.length === 0) {
      alert('Eksport qilish uchun tranzaksiyalar topilmadi');
      return;
    }

    const headers = ['Sana', 'Vaqt', 'Turi', 'Toifa', 'Tavsif', 'Toʻlov usuli', 'Summa (soʻm)', 'Izoh'];
    const rows = transactions.map((t) => [
      `"${t.date}"`,
      `"${t.time || ''}"`,
      `"${t.type === 'income' ? 'Kirim' : 'Chiqim'}"`,
      `"${t.categoryName}"`,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.paymentMethod}"`,
      t.amount,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Hisobot_AI_${period}_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showExportToast('CSV hisoboti muvaffaqiyatli yuklab olindi');
  };

  // Export as printable / PDF
  const exportToPDF = () => {
    window.print();
  };

  const showExportToast = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {exportNotice && (
        <div className="fixed bottom-6 right-6 z-50 p-4 backdrop-blur-2xl bg-slate-900/90 text-white dark:bg-white/95 dark:text-slate-900 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold border border-white/20 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Period Filter Bar & Export Actions with Glassmorphism */}
      <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Moliyaviy hisobot davri
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kerakli oraliqni tanlang va tahliliy maʼlumotlarni yuklab oling
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl text-xs font-semibold hover:bg-emerald-500/20 transition-all shadow-xs backdrop-blur-md active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel (XLSX)</span>
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-2xl text-xs font-semibold hover:bg-blue-500/20 transition-all shadow-xs backdrop-blur-md active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-white/5 rounded-2xl text-xs font-semibold hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-all shadow-xs backdrop-blur-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Chop etish / PDF</span>
            </button>
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {periodsList.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                period === p.id
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md shadow-violet-500/20'
                  : 'bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/50 dark:border-white/5'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {period === 'custom' && (
          <div className="pt-3 border-t border-slate-200/60 dark:border-white/10 flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Boshlanish:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Tugash:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4 Summary Stat Cards for Selected Period with Glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tanlangan davrdagi kirim</span>
          <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-2 tracking-tight">
            +{formatMoney(summary?.totalIncome || 0)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
            {summary?.incomeCount || 0} ta kirim operatsiyasi
          </span>
        </div>

        <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tanlangan davrdagi chiqim</span>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-2 tracking-tight">
            -{formatMoney(summary?.totalExpense || 0)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
            {summary?.expenseCount || 0} ta chiqim operatsiyasi
          </span>
        </div>

        <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sof kassa oqimi (Cash Flow)</span>
          <div
            className={`text-2xl font-black font-mono mt-2 tracking-tight ${
              (summary?.netSavings || 0) >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {(summary?.netSavings || 0) >= 0 ? '+' : ''}
            {formatMoney(summary?.netSavings || 0)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
            Kirim va chiqim oʻrtasidagi farq
          </span>
        </div>

        <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-lg hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Jamgʻarma koeffitsiyenti</span>
          <div className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-2 tracking-tight">
            {summary?.savingsRate || 0}%
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
            Daromadning tejalgan ulushi
          </span>
        </div>
      </div>

      {/* Visual Analytics with Bar, Line and Donut Charts in Glassmorphic Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {reportChartType === 'line' ? 'Kunlik Kirim va Chiqim Toʻlqini (Line Graph)' : 'Oylik Taqqoslash (Bar Chart)'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tanlangan davr boʻyicha mablagʻ harakatining interaktiv tahlili
                </p>
              </div>

              <div className="p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl flex items-center border border-slate-200/60 dark:border-white/10 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setReportChartType('line')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    reportChartType === 'line'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Line (Chiziqli)
                </button>
                <button
                  type="button"
                  onClick={() => setReportChartType('bar')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                    reportChartType === 'bar'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bar (Ustunli)
                </button>
              </div>
            </div>

            {reportChartType === 'line' ? (
              <DailyTrendLineChart data={summary?.dailyBreakdown || []} height={250} />
            ) : (
              <IncomeExpenseBarChart data={summary?.monthlyComparison || []} height={250} />
            )}
          </div>
        </div>

        <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-5 pb-4 border-b border-slate-200/60 dark:border-white/10">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Xarajatlar Ulushi (Pie / Donut)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Toifalar kesimidagi taqsimot
                </p>
              </div>

              <div className="p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl flex items-center border border-slate-200/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setCategoryViewType('donut')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all ${
                    categoryViewType === 'donut'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Doira
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryViewType('list')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-all ${
                    categoryViewType === 'list'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Roʻyxat
                </button>
              </div>
            </div>

            {categoryViewType === 'donut' ? (
              <InteractivePieChart
                categories={summary?.categoriesBreakdown || []}
                totalAmount={summary?.totalExpense || 0}
              />
            ) : (
              <CategoryProgressList
                categories={summary?.categoriesBreakdown || []}
                totalExpense={summary?.totalExpense || 0}
              />
            )}
          </div>
        </div>
      </div>

      {/* Ledger Table with Glassmorphism */}
      <div className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-white/10 shadow-xl">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
          Davrdagi barcha tranzaksiyalar roʻyxati ({transactions.length} ta)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-white/10 text-slate-400 uppercase text-[10px] font-semibold">
                <th className="py-3 px-3">Sana</th>
                <th className="py-3 px-3">Turi</th>
                <th className="py-3 px-3">Toifa</th>
                <th className="py-3 px-3">Tavsif</th>
                <th className="py-3 px-3">Toʻlov usuli</th>
                <th className="py-3 px-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tranzaksiyalar mavjud emas
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-500">{t.date}</td>
                    <td className="py-3 px-3 font-semibold">
                      <span className={t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {t.type === 'income' ? 'Kirim' : 'Chiqim'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {t.categoryName}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {t.description}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{t.paymentMethod}</td>
                    <td
                      className={`py-3 px-3 text-right font-mono font-black ${
                        t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'}
                      {formatMoney(t.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
