/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Plus,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Edit2,
  Trash2,
  Coins,
} from 'lucide-react';
import { Debt } from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';

interface DebtsViewProps {
  debts: Debt[];
  onOpenDebtModal: (debt?: Debt, defaultType?: 'borrowed' | 'lent') => void;
  onOpenDebtPay: (debt: Debt) => void;
  onDeleteDebt: (id: string) => Promise<void>;
}

export const DebtsView: React.FC<DebtsViewProps> = ({
  debts,
  onOpenDebtModal,
  onOpenDebtPay,
  onDeleteDebt,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'borrowed' | 'lent'>('all');

  const borrowedDebts = debts.filter((d) => d.type === 'borrowed');
  const lentDebts = debts.filter((d) => d.type === 'lent');

  const totalBorrowedRemaining = borrowedDebts.reduce((s, d) => s + d.remainingAmount, 0);
  const totalLentRemaining = lentDebts.reduce((s, d) => s + d.remainingAmount, 0);

  const filtered = debts.filter((d) => {
    if (activeTab === 'borrowed') return d.type === 'borrowed';
    if (activeTab === 'lent') return d.type === 'lent';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* 2 Summary Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Money Borrowed */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Olingan qarzlar (Men qaytarishim kerak)</span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 tracking-tight mt-1">
              {formatMoney(totalBorrowedRemaining)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              Jami {borrowedDebts.length} ta majburiyat
            </span>
          </div>
          <button
            onClick={() => onOpenDebtModal(undefined, 'borrowed')}
            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs font-semibold hover:bg-rose-100 transition-colors shrink-0"
          >
            + Qarz olish
          </button>
        </div>

        {/* Money Lent */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Berilgan qarzlar (Menga qaytishi kerak)</span>
            </div>
            <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight mt-1">
              {formatMoney(totalLentRemaining)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block">
              Jami {lentDebts.length} ta talab
            </span>
          </div>
          <button
            onClick={() => onOpenDebtModal(undefined, 'lent')}
            className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-xs font-semibold hover:bg-emerald-100 transition-colors shrink-0"
          >
            + Qarz berish
          </button>
        </div>
      </div>

      {/* Filter Tabs & Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Tabs Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Barchasi ({debts.length})
            </button>
            <button
              onClick={() => setActiveTab('borrowed')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'borrowed'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Men olgan qarzlar ({borrowedDebts.length})
            </button>
            <button
              onClick={() => setActiveTab('lent')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'lent'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Men bergan qarzlar ({lentDebts.length})
            </button>
          </div>

          <button
            onClick={() => onOpenDebtModal()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi qarz qaydnomasi</span>
          </button>
        </div>

        {/* Debts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Shaxs / Turi</th>
                <th className="py-3 px-4">Qarz summasi</th>
                <th className="py-3 px-4">Toʻlangan summa</th>
                <th className="py-3 px-4">Qoldiq qarz</th>
                <th className="py-3 px-4">Muddat</th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4 text-center">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Qarz yozuvlari mavjud emas
                  </td>
                </tr>
              ) : (
                filtered.map((debt) => {
                  const isPaid = debt.remainingAmount === 0 || debt.status === 'paid';
                  const isOverdue =
                    !isPaid && new Date(debt.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                  return (
                    <tr key={debt.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              debt.type === 'borrowed'
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                          >
                            {debt.type === 'borrowed' ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {debt.personName}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <span>{debt.type === 'borrowed' ? 'Olingan qarz' : 'Berilgan qarz'}</span>
                              {debt.phone && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{debt.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatMoney(debt.amount)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatMoney(debt.paidAmount)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatMoney(debt.remainingAmount)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-300">
                          {formatDateUz(debt.dueDate)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Berilgan: {debt.startDate}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isPaid ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Toʻlangan
                          </span>
                        ) : isOverdue ? (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            Muddati oʻtgan
                          </span>
                        ) : debt.paidAmount > 0 ? (
                          <span className="text-blue-600 font-semibold">
                            Qisman toʻlangan
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold">
                            Kutilmoqda
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isPaid && (
                            <button
                              onClick={() => onOpenDebtPay(debt)}
                              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <Coins className="w-3 h-3" />
                              Toʻlov
                            </button>
                          )}
                          <button
                            onClick={() => onOpenDebtModal(debt)}
                            className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteDebt(debt.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                            title="Oʻchirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
