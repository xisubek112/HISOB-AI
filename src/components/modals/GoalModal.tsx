/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { FinancialGoal } from '../../types/finance.ts';
import { Button, Input, Modal } from '../../design-system/index.ts';

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

const GOAL_COLORS = ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B', '#14B8A6', '#0EA5E9'];

const formatUzNumber = (num: number) =>
  new Intl.NumberFormat('uz-UZ').format(num).replace(/,/g, ' ');

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingGoal,
}) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('0');
  const [deadline, setDeadline] = useState('2027-12-31');
  const [icon, setIcon] = useState('Car');
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setName(editingGoal?.name || '');
    setTargetAmount(editingGoal ? formatUzNumber(editingGoal.targetAmount) : '');
    setSavedAmount(editingGoal ? formatUzNumber(editingGoal.savedAmount) : '0');
    setDeadline(editingGoal?.deadline || '2027-12-31');
    setIcon(editingGoal?.icon || 'Car');
    const safeInitialColor =
      editingGoal?.color && GOAL_COLORS.includes(editingGoal.color.toUpperCase())
        ? editingGoal.color
        : GOAL_COLORS[0];
    setColor(safeInitialColor);
  }, [isOpen, editingGoal]);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingGoal ? 'Maqsadni tahrirlash' : 'Yangi jamgʻarma maqsadi'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Maqsad nomi"
          type="text"
          required
          placeholder="Masalan: Yangi avtomobil, Uy-joy boshlangʻich badali..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Koʻzlangan summa"
            type="text"
            inputMode="numeric"
            required
            monospace
            placeholder="0"
            trailingAddon="soʻm"
            value={targetAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setTargetAmount(val ? formatUzNumber(parseInt(val, 10)) : '');
            }}
          />

          <Input
            label="Toʻplangan summa"
            type="text"
            inputMode="numeric"
            monospace
            placeholder="0"
            trailingAddon="soʻm"
            value={savedAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setSavedAmount(val ? formatUzNumber(parseInt(val, 10)) : '0');
            }}
          />
        </div>

        <Input
          label="Maqsadga erishish muddati"
          type="date"
          required
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />

        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Yoʻnalish belgisi
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {GOAL_ICONS.map((ic) => (
              <button
                type="button"
                key={ic.id}
                onClick={() => setIcon(ic.id)}
                className={[
                  'min-h-10 py-2 px-2.5 text-xs font-medium rounded-xl border text-left truncate transition-colors cursor-pointer',
                  icon === ic.id
                    ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                ].join(' ')}
              >
                {ic.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Karta aksent rangi
          </span>
          <div className="flex items-center gap-2.5">
            {GOAL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Rang ${c}`}
                onClick={() => setColor(c)}
                className={[
                  'w-8 h-8 rounded-full transition-transform cursor-pointer',
                  color.toUpperCase() === c.toUpperCase()
                    ? 'scale-110 ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-[#111B27]'
                    : 'opacity-80 hover:opacity-100',
                ].join(' ')}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            {loading ? 'Saqlanmoqda...' : 'Maqsadni saqlash'}
          </Button>
        </div>
      </form>
    </Modal>
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

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setAmount('');
  }, [isOpen, goal]);

  if (!goal) return null;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Jamgʻarmaga mablagʻ qoʻshish"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <strong className="text-slate-900 dark:text-slate-100">{goal.name}</strong> maqsadi uchun qoʻshimcha mablagʻ ajratish.
        </p>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Input
          label="Qoʻshilayotgan summa (soʻmda)"
          type="text"
          inputMode="numeric"
          required
          monospace
          placeholder="0"
          trailingAddon="soʻm"
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setAmount(val ? formatUzNumber(parseInt(val, 10)) : '');
          }}
        />

        <div className="pt-2 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            {loading ? 'Qoʻshilmoqda...' : 'Mablagʻni qoʻshish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
