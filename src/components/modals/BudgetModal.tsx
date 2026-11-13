/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Budget, Category } from '../../types/finance.ts';
import { Button, Input, Modal, Select } from '../../design-system/index.ts';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (budget: Omit<Budget, 'id' | 'userId'>) => Promise<void>;
  categories: Category[];
  editingBudget?: Budget | null;
}

const formatUzNumber = (num: number) =>
  new Intl.NumberFormat('uz-UZ').format(num).replace(/,/g, ' ');

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
    editingBudget ? formatUzNumber(editingBudget.monthlyLimit) : ''
  );
  const [alertThreshold, setAlertThreshold] = useState<number>(editingBudget?.alertThreshold || 80);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setCategoryId(editingBudget?.categoryId || expenseCategories[0]?.id || '');
    setMonthlyLimit(editingBudget ? formatUzNumber(editingBudget.monthlyLimit) : '');
    setAlertThreshold(editingBudget?.alertThreshold || 80);
  }, [isOpen, editingBudget, categories]);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingBudget ? 'Budjetni tahrirlash' : 'Oylik toifa budjeti belgilash'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Select
          label="Chiqim toifasi"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Input
          label="Oylik limit (soʻmda)"
          type="text"
          inputMode="numeric"
          required
          monospace
          placeholder="0"
          trailingAddon="soʻm"
          value={monthlyLimit}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setMonthlyLimit(val ? formatUzNumber(parseInt(val, 10)) : '');
          }}
        />

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor="budget-alert-threshold"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Ogohlantirish chegarasi
            </label>
            <span className="font-mono tabular-nums text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {alertThreshold}%
            </span>
          </div>
          <input
            id="budget-alert-threshold"
            type="range"
            min="50"
            max="100"
            step="5"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Xarajat limitning {alertThreshold}% qismiga yetganda tizim sizni ogohlantiradi.
          </p>
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            {loading ? 'Saqlanmoqda...' : 'Budjetni oʻrnatish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
