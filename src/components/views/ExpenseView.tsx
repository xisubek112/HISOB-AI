/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  ArrowUpRight,
  Filter,
  Edit2,
  Trash2,
  FolderPlus,
} from 'lucide-react';
import { Category, Transaction } from '../../types/finance.ts';
import { formatMoney, formatDateUz, PAYMENT_METHODS_MAP } from '../../utils/formatters.ts';

interface ExpenseViewProps {
  transactions: Transaction[];
  categories: Category[];
  onAddExpense: () => void;
  onOpenCategoryModal: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
}

export const ExpenseView: React.FC<ExpenseViewProps> = ({
  transactions,
  categories,
  onAddExpense,
  onOpenCategoryModal,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'amount_desc' | 'amount_asc'>('date_desc');

  const expenseTransactions = useMemo(() => {
    return transactions.filter((t) => t.type === 'expense');
  }, [transactions]);

  const filtered = useMemo(() => {
    let result = expenseTransactions.filter((t) => {
      const matchSearch =
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.categoryName.toLowerCase().includes(search.toLowerCase()) ||
        (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()));

      const matchCat =
        selectedCategory === 'all' ||
        t.categoryId === selectedCategory ||
        t.categoryName === selectedCategory;

      return matchSearch && matchCat;
    });

    if (sortOrder === 'amount_desc') {
      result.sort((a, b) => b.amount - a.amount);
    } else if (sortOrder === 'amount_asc') {
      result.sort((a, b) => a.amount - b.amount);
    } else {
      result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return result;
  }, [expenseTransactions, search, selectedCategory, sortOrder]);

  const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  const averageExpense =
    expenseTransactions.length > 0 ? Math.round(totalExpense / expenseTransactions.length) : 0;

  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/15 pointer-events-none" />
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Jami xarajatlar</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-tight">
            -{formatMoney(totalExpense)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            Jami {expenseTransactions.length} ta operatsiya qayd etilgan
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/15 pointer-events-none" />
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Oʻrtacha chiqim</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100 tracking-tight">
            {formatMoney(averageExpense)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
            Bir martalik oʻrtacha xarajat miqdori
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-md flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-rose-100">Yangi xarajat kiritish</span>
            <div className="text-xs text-white/90 mt-0.5 leading-snug">
              Kundalik xarajat yoki toʻlovlarni qayd qiling
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenCategoryModal}
              title="Yangi toifa qoʻshish"
              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold transition-all backdrop-blur-xs"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button
              onClick={onAddExpense}
              className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-800 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Chiqim qoʻshish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Xarajat tavsifi boʻyicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
          >
            <option value="all">Barcha chiqim toifalari</option>
            {categories
              .filter((c) => c.type === 'expense')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
          >
            <option value="date_desc">Eng yangi sanalar</option>
            <option value="amount_desc">Summa: Katta dan kichikka</option>
            <option value="amount_asc">Summa: Kichik dan kattaga</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Sana va vaqt</th>
                <th className="py-3.5 px-4">Toifa</th>
                <th className="py-3.5 px-4">Tavsif va Izoh</th>
                <th className="py-3.5 px-4">Toʻlov usuli</th>
                <th className="py-3.5 px-4 text-right">Summa</th>
                <th className="py-3.5 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ArrowUpRight className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <span>Chiqimlar topilmadi</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{formatDateUz(tx.date)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tx.time || '12:00'}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                        <ArrowUpRight className="w-3 h-3 text-rose-600" />
                        <span>{tx.categoryName}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{tx.description}</div>
                      {tx.notes && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{tx.notes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px]">
                        {PAYMENT_METHODS_MAP[tx.paymentMethod]?.label || tx.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                        -{formatMoney(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          title="Tahrirlash"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Oʻchirish"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
