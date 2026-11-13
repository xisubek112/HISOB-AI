/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { Category, PaymentMethod, Transaction, TransactionType } from '../../types/finance.ts';
import { getTodayDateString, getCurrentTimeString } from '../../utils/formatters.ts';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  categories: Category[];
  initialType?: TransactionType;
  editingTransaction?: Transaction | null;
  onOpenCategoryModal?: () => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  initialType = 'expense',
  editingTransaction,
  onOpenCategoryModal,
}) => {
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [time, setTime] = useState<string>(getCurrentTimeString());
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(String(editingTransaction.amount));
      setCategoryId(editingTransaction.categoryId);
      setCategoryName(editingTransaction.categoryName);
      setDate(editingTransaction.date);
      setTime(editingTransaction.time || getCurrentTimeString());
      setDescription(editingTransaction.description);
      setPaymentMethod(editingTransaction.paymentMethod || 'card');
      setNotes(editingTransaction.notes || '');
    } else {
      setType(initialType);
      setAmount('');
      setDate(getTodayDateString());
      setTime(getCurrentTimeString());
      setDescription('');
      setPaymentMethod('card');
      setNotes('');

      // Auto select first category of matching type
      const firstCat = categories.find((c) => c.type === initialType);
      if (firstCat) {
        setCategoryId(firstCat.id);
        setCategoryName(firstCat.name);
      }
    }
  }, [editingTransaction, initialType, isOpen, categories]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleCategorySelect = (id: string) => {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (cat) {
      setCategoryName(cat.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Iltimos, toʻgʻri summani kiriting');
      return;
    }

    if (!categoryName) {
      setError('Iltimos, toifani tanlang');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        type,
        amount: parsedAmount,
        categoryId: categoryId || 'cat_custom',
        categoryName,
        date,
        time,
        description: description.trim() || categoryName,
        paymentMethod,
        notes: notes.trim(),
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
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {editingTransaction
              ? 'Tranzaksiyani tahrirlash'
              : type === 'income'
              ? 'Yangi kirim qoʻshish'
              : 'Yangi chiqim qoʻshish'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Switcher */}
          {!editingTransaction && (
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  const firstCat = categories.find((c) => c.type === 'income');
                  if (firstCat) {
                    setCategoryId(firstCat.id);
                    setCategoryName(firstCat.name);
                  }
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                + Kirim (Daromad)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  const firstCat = categories.find((c) => c.type === 'expense');
                  if (firstCat) {
                    setCategoryId(firstCat.id);
                    setCategoryName(firstCat.name);
                  }
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                - Chiqim (Xarajat)
              </button>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Summa (soʻmda) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="0"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val) {
                    setAmount(new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' '));
                  } else {
                    setAmount('');
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-4 top-3 text-xs font-medium text-slate-400 pointer-events-none">
                soʻm
              </span>
            </div>
          </div>

          {/* Category selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Toifa <span className="text-rose-500">*</span>
              </label>
              {onOpenCategoryModal && (
                <button
                  type="button"
                  onClick={onOpenCategoryModal}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Yangi toifa
                </button>
              )}
            </div>
            <select
              value={categoryId}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tavsif (nomi)
            </label>
            <input
              type="text"
              placeholder={type === 'income' ? 'Masalan: Noyabr maoshi' : 'Masalan: Bozorlik yoki Tushlik'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date and Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sana
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Vaqt
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Toʻlov usuli
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'card', label: 'Bank kartasi' },
                { id: 'cash', label: 'Naqd pul' },
                { id: 'bank', label: 'Oʻtkazma' },
                { id: 'other', label: 'Boshqa' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
                    paymentMethod === m.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Qoʻshimcha izoh (ixtiyoriy)
            </label>
            <textarea
              rows={2}
              placeholder="Qoʻshimcha tafsilotlar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow-sm transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              } disabled:opacity-50`}
            >
              {loading ? 'Saqlanmoqda...' : editingTransaction ? 'Oʻzgarishlarni saqlash' : 'Tranzaksiyani saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
