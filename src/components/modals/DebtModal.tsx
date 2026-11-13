/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Debt } from '../../types/finance.ts';
import { getTodayDateString, formatMoney } from '../../utils/formatters.ts';
import { Button, Input, Modal } from '../../design-system/index.ts';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>) => Promise<void>;
  editingDebt?: Debt | null;
  defaultType?: 'borrowed' | 'lent';
}

const formatUzNumber = (num: number) =>
  new Intl.NumberFormat('uz-UZ').format(num).replace(/,/g, ' ');

export const DebtModal: React.FC<DebtModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingDebt,
  defaultType = 'borrowed',
}) => {
  const [type, setType] = useState<'borrowed' | 'lent'>(defaultType);
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState(getTodayDateString());
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setType(editingDebt?.type || defaultType);
    setPersonName(editingDebt?.personName || '');
    setPhone(editingDebt?.phone || '');
    setAmount(editingDebt ? formatUzNumber(editingDebt.amount) : '');
    setPaidAmount(editingDebt ? formatUzNumber(editingDebt.paidAmount) : '0');
    setStartDate(editingDebt?.startDate || getTodayDateString());
    setDueDate(editingDebt?.dueDate || getTodayDateString());
    setNotes(editingDebt?.notes || '');
  }, [isOpen, editingDebt, defaultType]);

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingDebt ? 'Qarzni tahrirlash' : 'Yangi qarz qaydnomasi'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Qarz turi
          </span>
          <div className="flex p-1 bg-slate-100 dark:bg-[#0D1927] rounded-xl border border-slate-200/70 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setType('borrowed')}
              className={[
                'flex-1 min-h-10 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                type === 'borrowed'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400',
              ].join(' ')}
            >
              Men qarz oldim
            </button>
            <button
              type="button"
              onClick={() => setType('lent')}
              className={[
                'flex-1 min-h-10 py-1.5 px-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer',
                type === 'lent'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400',
              ].join(' ')}
            >
              Men qarz berdim
            </button>
          </div>
        </div>

        <Input
          label={type === 'borrowed' ? 'Qarz beruvchi shaxs' : 'Qarz oluvchi shaxs'}
          type="text"
          required
          placeholder="Masalan: Sardor Akam yoki Jamshid"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
        />

        <Input
          label="Telefon raqami (ixtiyoriy)"
          type="text"
          placeholder="+998 90 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <Input
          label="Jami qarz summasi (soʻmda)"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Berilgan sana"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Qaytarish muddati"
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="debt-notes"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Izoh (sababi yoki eslatma)
          </label>
          <textarea
            id="debt-notes"
            rows={2}
            placeholder="Qarz nima maqsadda berilgan yoki olingan..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/[0.12] bg-[#F8FAFC] dark:bg-[#0D1927] px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            {loading ? 'Saqlanmoqda...' : 'Qarzni saqlash'}
          </Button>
        </div>
      </form>
    </Modal>
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

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setPaymentAmount('');
  }, [isOpen, debt]);

  if (!debt) return null;

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Qarz toʻlovini qayd etish"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] rounded-xl space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Shaxs:</span>
            <strong className="text-slate-900 dark:text-slate-100">{debt.personName}</strong>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Qoldiq qarz:</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
              {formatMoney(debt.remainingAmount)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Toʻlov summasi (soʻmda)
            </label>
            <button
              type="button"
              onClick={() => setPaymentAmount(formatUzNumber(debt.remainingAmount))}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Toʻliq toʻlash
            </button>
          </div>
          <Input
            type="text"
            inputMode="numeric"
            required
            monospace
            placeholder="0"
            trailingAddon="soʻm"
            value={paymentAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setPaymentAmount(val ? formatUzNumber(parseInt(val, 10)) : '');
            }}
          />
        </div>

        <div className="pt-2 flex justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            {loading ? 'Toʻlanmoqda...' : 'Toʻlovni saqlash'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
