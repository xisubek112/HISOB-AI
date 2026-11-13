/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { TransactionType } from '../../types/finance.ts';
import { Modal, Button, Input } from '../../design-system/index.ts';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cat: { name: string; type: TransactionType; icon: string; color: string }) => Promise<void>;
  defaultType?: TransactionType;
}

const COLORS = [
  '#10B981',
  '#06B6D4',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#F97316',
  '#14B8A6',
  '#64748B',
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
    <Modal isOpen={isOpen} onClose={onClose} title="Yangi maxsus toifa qoʻshish" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Toifa turi
          </label>
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#0D1927] rounded-xl border border-slate-200/70 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`min-h-10 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
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
              className={`min-h-10 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                type === 'income'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Kirim
            </button>
          </div>
        </div>

        <Input
          label="Toifa nomi"
          type="text"
          required
          placeholder="Masalan: Sport zal, Kitoblar, Keshbek..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Rang tanlang
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                aria-label={`Rang ${c}`}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                  color === c
                    ? 'scale-110 ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-[#111B27]'
                    : ''
                }`}
                style={{ backgroundColor: c }}
              >
                {color === c && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={loading}>
            Toifani saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
};
