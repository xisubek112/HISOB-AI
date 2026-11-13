/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  BarChart3,
} from 'lucide-react';
import { FinancialSummary, Transaction } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, getTodayDateString } from '../../utils/formatters.ts';
import {
  IncomeExpenseBarChart,
  CategoryProgressList,
  DailyTrendLineChart,
  InteractivePieChart,
} from '../charts/InteractiveCharts.tsx';
import {
  Button,
  Card,
  ChartCard,
  EmptyState,
  Skeleton,
  TransactionRow,
  useToast,
} from '../../design-system/index.ts';

export const ReportsView: React.FC = () => {
  const toast = useToast();
  const [period, setPeriod] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>(getTodayDateString());
  const [endDate, setEndDate] = useState<string>(getTodayDateString());
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [exportingExcel, setExportingExcel] = useState<boolean>(false);
  const [reportChartType, setReportChartType] = useState<'line' | 'bar'>('line');
  const [categoryViewType, setCategoryViewType] = useState<'donut' | 'list'>('donut');

  const fetchReport = useCallback(async () => {
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
      toast.error('Hisobot maʼlumotlarini yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, toast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

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
      setExportingExcel(true);
      toast.info('Koʻp sahifali Excel hisoboti tayyorlanmoqda...');

      const [wRes, bRes, gRes, sRes] = await Promise.all([
        api.getWallets(),
        api.getBudgets(),
        api.getGoals(),
        api.getSubscriptions(),
      ]);

      const wb = XLSX.utils.book_new();

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

      XLSX.writeFile(wb, `Hisobot_AI_MultiSheet_${period}_${getTodayDateString()}.xlsx`);
      toast.success('8 varaqli Excel (XLSX) hisoboti yuklab olindi');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Excel eksportida xatolik yuz berdi');
    } finally {
      setExportingExcel(false);
    }
  };

  // Export as CSV
  const exportToCSV = () => {
    if (!transactions || transactions.length === 0) {
      toast.warning('Eksport qilish uchun tranzaksiyalar topilmadi');
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
    URL.revokeObjectURL(url);
    toast.success('CSV hisoboti yuklab olindi');
  };

  // Export as printable / PDF
  const exportToPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Period Filter & Export Controls */}
      <Card padding="lg" className="space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight text-balance">
              Moliyaviy hisobot va eksport
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Davrni tanlang va tahliliy maʼlumotlarni Excel, CSV yoki PDF koʻrinishida yuklab oling
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              loading={exportingExcel}
              disabled={!summary}
              leadingIcon={<FileSpreadsheet className="w-4 h-4" />}
              onClick={exportToExcel}
            >
              Excel (XLSX)
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<FileText className="w-4 h-4 text-blue-500" />}
              onClick={exportToCSV}
            >
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Printer className="w-4 h-4" />}
              onClick={exportToPDF}
            >
              Chop etish / PDF
            </Button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {periodsList.map((p) => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={[
                  'min-h-10 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  active
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_6px_18px_rgba(16,185,129,0.22)]'
                    : 'bg-slate-100 dark:bg-[#0D1927] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08] border border-transparent dark:border-white/[0.08]',
                ].join(' ')}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Pickers */}
        {period === 'custom' && (
          <div className="pt-4 border-t border-slate-200/70 dark:border-white/[0.08] flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Boshlanish:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-10 px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.12] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Tugash:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-10 px-3 py-1.5 bg-[#F8FAFC] dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.12] rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </label>
          </div>
        )}
      </Card>

      {/* Summary KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card interactive padding="lg">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tanlangan davrdagi kirim
            </span>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1.5 tracking-tight">
              +{formatMoney(summary?.totalIncome || 0)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block tabular-nums">
              {summary?.incomeCount || 0} ta kirim operatsiyasi
            </span>
          </Card>

          <Card interactive padding="lg">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tanlangan davrdagi chiqim
            </span>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1.5 tracking-tight">
              -{formatMoney(summary?.totalExpense || 0)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block tabular-nums">
              {summary?.expenseCount || 0} ta chiqim operatsiyasi
            </span>
          </Card>

          <Card interactive padding="lg">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sof kassa oqimi
            </span>
            <div
              className={[
                'text-2xl font-extrabold font-mono tabular-nums mt-1.5 tracking-tight',
                (summary?.netSavings || 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              ].join(' ')}
            >
              {(summary?.netSavings || 0) >= 0 ? '+' : ''}
              {formatMoney(summary?.netSavings || 0)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
              Kirim va chiqim oʻrtasidagi farq
            </span>
          </Card>

          <Card interactive padding="lg">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Jamgʻarma koeffitsiyenti
            </span>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-cyan-600 dark:text-cyan-400 mt-1.5 tracking-tight">
              {summary?.savingsRate || 0}%
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block">
              Daromadning tejalgan ulushi
            </span>
          </Card>
        </div>
      )}

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          className="lg:col-span-2"
          title={reportChartType === 'line' ? 'Kunlik kirim va chiqim toʻlqini' : 'Oylik taqqoslash'}
          subtitle="Tanlangan davr boʻyicha mablagʻ harakati"
          headerAction={
            <div className="p-1 bg-slate-100 dark:bg-[#0D1927] rounded-xl flex items-center border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setReportChartType('line')}
                className={[
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                  reportChartType === 'line'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                Chiziqli
              </button>
              <button
                type="button"
                onClick={() => setReportChartType('bar')}
                className={[
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                  reportChartType === 'bar'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                Ustunli
              </button>
            </div>
          }
        >
          {reportChartType === 'line' ? (
            <DailyTrendLineChart data={summary?.dailyBreakdown || []} height={260} />
          ) : (
            <IncomeExpenseBarChart data={summary?.monthlyComparison || []} height={260} />
          )}
        </ChartCard>

        <ChartCard
          title="Xarajatlar ulushi"
          subtitle="Toifalar kesimida"
          headerAction={
            <div className="p-1 bg-slate-100 dark:bg-[#0D1927] rounded-xl flex items-center border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setCategoryViewType('donut')}
                className={[
                  'px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                  categoryViewType === 'donut'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                Doira
              </button>
              <button
                type="button"
                onClick={() => setCategoryViewType('list')}
                className={[
                  'px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                  categoryViewType === 'list'
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                Roʻyxat
              </button>
            </div>
          }
        >
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
        </ChartCard>
      </div>

      {/* Ledger Table (Desktop) & Card Stack (Mobile) */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Davrdagi tranzaksiyalar roʻyxati
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              Jami {transactions.length} ta operatsiya
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<BarChart3 className="w-6 h-6" />}
              title="Ushbu davr uchun operatsiyalar topilmadi"
              description="Boshqa hisobot davrini tanlang yoki yangi kirim-chiqim tranzaksiyasini qoʻshing."
            />
          </div>
        ) : (
          <>
            {/* Mobile Card Rows */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06] px-2">
              {transactions.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0D1927]/70 text-slate-500 dark:text-slate-400 text-[11px] font-semibold">
                    <th className="py-3 px-4">Sana</th>
                    <th className="py-3 px-4">Turi</th>
                    <th className="py-3 px-4">Toifa</th>
                    <th className="py-3 px-4">Tavsif</th>
                    <th className="py-3 px-4">Toʻlov usuli</th>
                    <th className="py-3 px-4 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {t.date}
                      </td>
                      <td className="py-3 px-4 font-semibold whitespace-nowrap">
                        <span
                          className={
                            t.type === 'income'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {t.type === 'income' ? 'Kirim' : 'Chiqim'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {t.categoryName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {t.description}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {t.paymentMethod}
                      </td>
                      <td
                        className={[
                          'py-3 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap',
                          t.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        ].join(' ')}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {formatMoney(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
