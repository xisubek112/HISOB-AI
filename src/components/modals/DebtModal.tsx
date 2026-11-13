/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Debt } from '../../types/finance.ts';
import { getTodayDateString, formatMoney } from '../../utils/formatters.ts';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>) => Promise<void>;
  editingDebt?: Debt | null;
  defaultType?: 'borrowed' | 'lent';
}

export const DebtModal: React.FC<DebtModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDebt,
  defaultType = 'borrowed',
}) => {
  const [type, setType] = useState<'borrowed' | 'lent'>(editingDebt?.type || defaultType);
  const [personName, setPersonName] = useState(editingDebt?.personName || '');
  const [phone, setPhone] = useState(editingDebt?.phone || '');
  const [amount, setAmount] = useState(
    editingDebt ? new Intl.NumberFormat('uz-UZ').format(editingDebt.amount).replace(/,/g, ' ') : ''
  );
  const [paidAmount, setPaidAmount] = useState(
    editingDebt ? new Intl.NumberFormat('uz-UZ').format(editingDebt.paidAmount).replace(/,/g, ' ') : '0'
  );
  const [startDate, setStartDate] = useState(editingDebt?.startDate || getTodayDateString());
  const [dueDate, setDueDate] = useState(editingDebt?.dueDate || getTodayDateString());
  const [notes, setNotes] = useState(editingDebt?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseInt(amount.replace(/\D/g, ''), 10);
    const parsedPaid = parseInt(paidAmount.replace(/\D/g, ''), 10) || 0;

    if (!personName.trim()) {
      setError('Shaxs ismini kiriting');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Qarz summasini kiriting');
      return;
    }

    try {
      setLoading(true);
      await onSave({
        type,
        personName: personName.trim(),
        phone: phone.trim(),
        amount: parsedAmount,
        paidAmount: parsedPaid,
        startDate,
        dueDate,
        status: parsedPaid >= parsedAmount ? 'paid' : parsedPaid > 0 ? 'partial' : 'active',
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
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 overflow-y-auto max-h-[92vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {editingDebt ? 'Qarzni tahrirlash' : 'Yangi qarz qaydnomasi'}
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
              Qarz turi
            </label>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setType('borrowed')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                  type === 'borrowed'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Men qarz oldim (Majburiyat)
              </button>
              <button
                type="button"
                onClick={() => setType('lent')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg ${
                  type === 'lent'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Men qarz berdim (Talab)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              {type === 'borrowed' ? 'Qarz beruvchi shaxs' : 'Qarz oluvchi shaxs'} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Masalan: Sardor Akam yoki Jamshid"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Telefon raqami (ixtiyoriy)
            </label>
            <input
              type="text"
              placeholder="+998 90 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Jami qarz summasi (soʻmda) <span className="text-rose-500">*</span>
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
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Berilgan sana
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Qaytarish muddati
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Izoh (sababi yoki eslatma)
            </label>
            <textarea
              rows={2}
              placeholder="Qarz nima maqsadda berilgan yoki olingan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {loading ? 'Saqlanmoqda...' : 'Qarzni saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const DebtPayModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  debt: Debt | null;
  onPay: (debtId: string, amount: number) => Promise<void>;
}> = ({ isOpen, onClose, debt, onPay }) => {
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !debt) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payNum = parseInt(paymentAmount.replace(/\D/g, ''), 10);
    if (!payNum || payNum <= 0) {
      setError('Toʻlov summasini kiriting');
      return;
    }
    if (payNum > debt.remainingAmount) {
      setError(`Toʻlov qoldiq qarz summasidan (${formatMoney(debt.remainingAmount)}) oshmasligi kerak`);
      return;
    }

    try {
      setLoading(true);
      await onPay(debt.id, payNum);
      setPaymentAmount('');
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
            Qarz toʻlovini qayd etish
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Shaxs:</span>
              <strong className="text-slate-900 dark:text-slate-100">{debt.personName}</strong>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Qoldiq qarz:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatMoney(debt.remainingAmount)}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Toʻlov summasi (soʻmda)
              </label>
              <button
                type="button"
                onClick={() => setPaymentAmount(new Intl.NumberFormat('uz-UZ').format(debt.remainingAmount).replace(/,/g, ' '))}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Toʻliq toʻlash
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="0"
              value={paymentAmount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setPaymentAmount(val ? new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' ') : '');
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
              {loading ? 'Toʻlanmoqda...' : 'Toʻlovni saqlash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
