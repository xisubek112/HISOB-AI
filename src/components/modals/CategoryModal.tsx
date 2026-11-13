/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { TransactionType } from '../../types/finance.ts';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cat: { name: string; type: TransactionType; icon: string; color: string }) => Promise<void>;
  defaultType?: TransactionType;
}

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultType = 'expense',
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<TransactionType>(defaultType);
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Toifa nomini kiriting');
      return;
    }
    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        type,
        icon: 'Tag',
        color,
      });
      setName('');
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
            Yangi maxsus toifa qoʻshish
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
              Toifa turi
            </label>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                  type === 'expense'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Chiqim
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Kirim
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Toifa nomi
            </label>
            <input
              type="text"
              required
              placeholder="Masalan: Sport zal, Kitoblar, Keshbek..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rang tanlang
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${
                    color === c ? 'border-slate-900 dark:border-white scale-110 shadow-sm' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
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
              {loading ? 'Saqlanmoqda...' : 'Toifani saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
