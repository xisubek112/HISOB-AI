/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Plus, AlertCircle } from 'lucide-react';
import { Category, PaymentMethod, Transaction, TransactionType } from '../../types/finance.ts';
import { getTodayDateString, getCurrentTimeString } from '../../utils/formatters.ts';
import { Modal, Button, Input, Select } from '../../design-system/index.ts';

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
    setError('');
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(
        new Intl.NumberFormat('uz-UZ').format(editingTransaction.amount).replace(/,/g, ' ')
      );
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

      const firstCat = categories.find((c) => c.type === initialType);
      if (firstCat) {
        setCategoryId(firstCat.id);
        setCategoryName(firstCat.name);
      }
    }
  }, [editingTransaction, initialType, isOpen, categories]);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleCategorySelect = (id: string) => {
    setCategoryId(id);
    const cat = categories.find((c) => c.id === id);
    if (cat) setCategoryName(cat.name);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        editingTransaction
          ? 'Tranzaksiyani tahrirlash'
          : type === 'income'
          ? 'Yangi kirim qoʻshish'
          : 'Yangi chiqim qoʻshish'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Type Switcher */}
        {!editingTransaction && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-[#0D1927] rounded-xl border border-slate-200/70 dark:border-white/[0.08]">
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
              className={`min-h-10 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                type === 'income'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
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
              className={`min-h-10 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              - Chiqim (Xarajat)
            </button>
          </div>
        )}

        {/* Amount */}
        <Input
          label="Summa (soʻmda)"
          type="text"
          inputMode="numeric"
          required
          monospace
          placeholder="0"
          trailingAddon="soʻm"
          value={amount}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setAmount(
              val ? new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' ') : ''
            );
          }}
          className="text-lg font-extrabold"
        />

        {/* Category */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Toifa <span className="text-rose-500">*</span>
            </span>
            {onOpenCategoryModal && (
              <button
                type="button"
                onClick={onOpenCategoryModal}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yangi toifa</span>
              </button>
            )}
          </div>
          <Select
            aria-label="Toifa"
            value={categoryId}
            onChange={(e) => handleCategorySelect(e.target.value)}
          >
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <Input
          label="Tavsif (nomi)"
          type="text"
          placeholder={
            type === 'income' ? 'Masalan: Noyabr maoshi' : 'Masalan: Bozorlik yoki Tushlik'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Sana"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Input
            label="Vaqt"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
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
                className={`min-h-10 px-2.5 text-xs font-semibold rounded-xl border text-center transition-colors cursor-pointer ${
                  paymentMethod === m.id
                    ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Qoʻshimcha izoh (ixtiyoriy)
          </label>
          <textarea
            rows={2}
            placeholder="Qoʻshimcha tafsilotlar..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.12] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            loading={loading}
            variant={type === 'income' ? 'primary' : 'danger'}
          >
            {editingTransaction ? 'Oʻzgarishlarni saqlash' : 'Tranzaksiyani saqlash'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
