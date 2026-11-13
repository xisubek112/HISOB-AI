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
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  IconButton,
  EmptyState,
  TransactionRow,
} from '../../design-system/index.ts';

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

  const expenseTransactions = useMemo(
    () => transactions.filter((t) => t.type === 'expense'),
    [transactions]
  );

  const filtered = useMemo(() => {
    const result = expenseTransactions.filter((t) => {
      const q = search.toLowerCase();
      const matchSearch =
        t.description.toLowerCase().includes(q) ||
        t.categoryName.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q));

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
    <div className="space-y-5 sm:space-y-6 hai-fade-up">
      {/* Top summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Jami xarajatlar</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400 tracking-tight">
            -{formatMoney(totalExpense)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {expenseTransactions.length} ta chiqim operatsiyasi
          </span>
        </Card>

        <Card padding="md" className="flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Oʻrtacha chiqim</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white tracking-tight">
            {formatMoney(averageExpense)}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Har bir xarajat boʻyicha oʻrtacha qiymat
          </span>
        </Card>

        <Card padding="md" className="flex items-center justify-between gap-3 border-rose-500/25">
          <div className="min-w-0">
            <span className="text-sm font-bold text-slate-900 dark:text-white block">
              Yangi xarajat kiritish
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
              Kundalik xarajat yoki yangi toifa qoʻshing
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              label="Yangi toifa qoʻshish"
              onClick={onOpenCategoryModal}
            >
              <FolderPlus className="w-4 h-4" />
            </IconButton>
            <Button
              variant="danger"
              size="md"
              onClick={onAddExpense}
              leadingIcon={<Plus className="w-4 h-4" />}
            >
              Chiqim
            </Button>
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-6">
            <Input
              type="text"
              placeholder="Xarajat tavsifi, toifa yoki izoh boʻyicha qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="md:col-span-3">
            <Select
              aria-label="Chiqim toifasi boʻyicha filtrlash"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Barcha chiqim toifalari</option>
              {categories
                .filter((c) => c.type === 'expense')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </div>

          <div className="md:col-span-3">
            <Select
              aria-label="Saralash tartibi"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
            >
              <option value="date_desc">Eng yangi sanalar</option>
              <option value="amount_desc">Summa: Katta dan kichikka</option>
              <option value="amount_asc">Summa: Kichik dan kattaga</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Mobile Cards View (< md) */}
      <Card padding="sm" className="md:hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowUpRight className="w-5 h-5" />}
            title="Chiqimlar topilmadi"
            description="Qidiruv shartlarini oʻzgartiring yoki yangi xarajat yozing."
            action={
              <Button variant="danger" size="sm" onClick={onAddExpense} leadingIcon={<Plus className="w-4 h-4" />}>
                Chiqim qoʻshish
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {filtered.map((tx) => (
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

      {/* Desktop Table View (>= md) */}
      <Card padding="none" className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#0D1927] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3.5 px-4">Sana va vaqt</th>
                <th className="py-3.5 px-4">Toifa</th>
                <th className="py-3.5 px-4">Tavsif va Izoh</th>
                <th className="py-3.5 px-4">Toʻlov usuli</th>
                <th className="py-3.5 px-4 text-right">Summa</th>
                <th className="py-3.5 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6">
                    <EmptyState
                      icon={<ArrowUpRight className="w-5 h-5" />}
                      title="Chiqimlar topilmadi"
                      description="Qidiruv parametrlarini oʻzgartiring yoki yangi chiqim qoʻshing."
                      action={
                        <Button variant="danger" size="sm" onClick={onAddExpense} leadingIcon={<Plus className="w-4 h-4" />}>
                          Chiqim qoʻshish
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {formatDateUz(tx.date)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                        {tx.time || '12:00'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <Badge tone="rose">
                        <ArrowUpRight className="w-3 h-3" />
                        <span>{tx.categoryName}</span>
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {tx.description}
                      </div>
                      {tx.notes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {tx.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                      <Badge tone="neutral">
                        {PAYMENT_METHODS_MAP[tx.paymentMethod]?.label || tx.paymentMethod}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-mono font-bold tabular-nums text-sm text-rose-600 dark:text-rose-400">
                        -{formatMoney(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="inline-flex items-center justify-center gap-1">
                        <IconButton
                          label="Chiqimni tahrirlash"
                          size="sm"
                          onClick={() => onEditTransaction(tx)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          label="Chiqimni oʻchirish"
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteTransaction(tx.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
