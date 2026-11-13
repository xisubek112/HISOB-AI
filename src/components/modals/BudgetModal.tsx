/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Budget, Category } from '../../types/finance.ts';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budget: Omit<Budget, 'id' | 'userId'>) => Promise<void>;
  categories: Category[];
  editingBudget?: Budget | null;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  editingBudget,
}) => {
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [categoryId, setCategoryId] = useState(editingBudget?.categoryId || expenseCategories[0]?.id || '');
  const [monthlyLimit, setMonthlyLimit] = useState(
    editingBudget ? new Intl.NumberFormat('uz-UZ').format(editingBudget.monthlyLimit).replace(/,/g, ' ') : ''
  );
  const [alertThreshold, setAlertThreshold] = useState<number>(editingBudget?.alertThreshold || 80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseInt(monthlyLimit.replace(/\D/g, ''), 10);
    if (!limitNum || limitNum <= 0) {
      setError('Iltimos, limit summasini kiriting');
      return;
    }

    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) {
      setError('Toifani tanlang');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        categoryId: cat.id,
        categoryName: cat.name,
        monthlyLimit: limitNum,
        month: currentMonth,
        alertThreshold: alertThreshold || 80,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {editingBudget ? 'Budjetni tahrirlash' : 'Oylik toifa budjeti belgilash'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Chiqim toifasi
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Oylik limit (soʻmda)
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="0"
                value={monthlyLimit}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val) {
                    setMonthlyLimit(new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' '));
                  } else {
                    setMonthlyLimit('');
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-4 top-3 text-xs font-medium text-slate-400 pointer-events-none">
                soʻm
              </span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Ogohlantirish chegarasi
              </label>
              <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400">
                {alertThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Xarajat limitning {alertThreshold}% qismiga yetganda tizim sizni ogohlantiradi.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Saqlanmoqda...' : 'Budjetni oʻrnatish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
