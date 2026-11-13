/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { FinancialGoal } from '../../types/finance.ts';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  editingGoal?: FinancialGoal | null;
}

const GOAL_ICONS = [
  { id: 'Car', label: 'Avtomobil' },
  { id: 'Home', label: 'Uy-joy' },
  { id: 'Plane', label: 'Sayohat / Ziyorat' },
  { id: 'ShieldCheck', label: 'Favqulodda jamgʻarma' },
  { id: 'GraduationCap', label: 'Taʼlim' },
  { id: 'Laptop', label: 'Texnika' },
  { id: 'Heart', label: 'Toʻy / Tadbir' },
];

const GOAL_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingGoal,
}) => {
  const [name, setName] = useState(editingGoal?.name || '');
  const [targetAmount, setTargetAmount] = useState(
    editingGoal ? new Intl.NumberFormat('uz-UZ').format(editingGoal.targetAmount).replace(/,/g, ' ') : ''
  );
  const [savedAmount, setSavedAmount] = useState(
    editingGoal ? new Intl.NumberFormat('uz-UZ').format(editingGoal.savedAmount).replace(/,/g, ' ') : '0'
  );
  const [deadline, setDeadline] = useState(editingGoal?.deadline || '2027-12-31');
  const [icon, setIcon] = useState(editingGoal?.icon || 'Car');
  const [color, setColor] = useState(editingGoal?.color || GOAL_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(targetAmount.replace(/\D/g, ''), 10);
    const saved = parseInt(savedAmount.replace(/\D/g, ''), 10) || 0;

    if (!name.trim()) {
      setError('Maqsad nomini kiriting');
      return;
    }
    if (!target || target <= 0) {
      setError('Koʻzlangan maqsad summasini kiriting');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        name: name.trim(),
        targetAmount: target,
        savedAmount: saved,
        deadline,
        icon,
        color,
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
            {editingGoal ? 'Maqsadni tahrirlash' : 'Yangi jamgʻarma maqsadi'}
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
              Maqsad nomi
            </label>
            <input
              type="text"
              required
              placeholder="Masalan: Yangi avtomobil, Uy-joy boshlangʻich badali..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Koʻzlangan summa (soʻmda)
            </label>
            <input
              type="text"
              required
              placeholder="0"
              value={targetAmount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setTargetAmount(val ? new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' ') : '');
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Hozirgacha toʻplangan summa (soʻmda)
            </label>
            <input
              type="text"
              placeholder="0"
              value={savedAmount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setSavedAmount(val ? new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' ') : '0');
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Maqsadga erishish muddati
            </label>
            <input
              type="date"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Yoʻnalish belgisi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {GOAL_ICONS.map((ic) => (
                <button
                  type="button"
                  key={ic.id}
                  onClick={() => setIcon(ic.id)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-lg border text-left truncate transition-colors ${
                    icon === ic.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {ic.label}
                </button>
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
              {loading ? 'Saqlanmoqda...' : 'Maqsadni saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const GoalDepositModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  goal: FinancialGoal | null;
  onDeposit: (goalId: string, amount: number) => Promise<void>;
}> = ({ isOpen, onClose, goal, onDeposit }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !goal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const depositNum = parseInt(amount.replace(/\D/g, ''), 10);
    if (!depositNum || depositNum <= 0) {
      setError('Qoʻshilayotgan summani kiriting');
      return;
    }

    try {
      setLoading(true);
      await onDeposit(goal.id, depositNum);
      setAmount('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Jamgʻarmaga mablagʻ qoʻshish
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            <strong className="text-slate-900 dark:text-slate-100">{goal.name}</strong> maqsadi uchun qoʻshimcha pul qoʻshish.
          </p>

          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Qoʻshilayotgan summa (soʻmda)
            </label>
            <input
              type="text"
              required
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setAmount(val ? new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' ') : '');
              }}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Qoʻshilmoqda...' : 'Mablagʻni qoʻshish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
