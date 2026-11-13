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
  CheckCircle2,
  Edit2,
  Trash2,
  Coins,
} from 'lucide-react';
import { Debt } from '../../types/finance.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
} from '../../design-system/index.ts';

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

  const renderStatusBadge = (debt: Debt, isPaid: boolean, isOverdue: boolean) => {
    if (isPaid) {
      return (
        <Badge tone="emerald">
          <CheckCircle2 className="w-3 h-3" />
          <span>Toʻlangan</span>
        </Badge>
      );
    }
    if (isOverdue) {
      return <Badge tone="rose">Muddati oʻtgan</Badge>;
    }
    if (debt.paidAmount > 0) {
      return <Badge tone="teal">Qisman toʻlangan</Badge>;
    }
    return <Badge tone="amber">Kutilmoqda</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 2 Summary Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card interactive padding="lg" className="flex flex-col xs:flex-row xs:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <ArrowDownLeft className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Olingan qarzlar (Majburiyat)</span>
            </div>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400 tracking-tight mt-1.5">
              {formatMoney(totalBorrowedRemaining)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block tabular-nums">
              Jami {borrowedDebts.length} ta yozuv
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDebtModal(undefined, 'borrowed')}
            className="border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 shrink-0"
          >
            + Qarz olish
          </Button>
        </Card>

        <Card interactive padding="lg" className="flex flex-col xs:flex-row xs:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Berilgan qarzlar (Qaytishi kerak)</span>
            </div>
            <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tight mt-1.5">
              {formatMoney(totalLentRemaining)}
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 block tabular-nums">
              Jami {lentDebts.length} ta yozuv
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenDebtModal(undefined, 'lent')}
            className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 shrink-0"
          >
            + Qarz berish
          </Button>
        </Card>
      </div>

      {/* Filter Tabs & List */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-slate-200/70 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0D1927] p-1 rounded-xl overflow-x-auto scrollbar-none border border-slate-200/60 dark:border-white/[0.06]">
            {[
              { id: 'all' as const, label: `Barchasi (${debts.length})` },
              { id: 'borrowed' as const, label: `Olganlarim (${borrowedDebts.length})` },
              { id: 'lent' as const, label: `Berganlarim (${lentDebts.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => onOpenDebtModal()}
          >
            Yangi qarz qaydnomasi
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<HandCoins className="w-6 h-6" />}
              title="Qarz yozuvlari mavjud emas"
              description="Olingan yoki berilgan qarzlarni va toʻlov muddatlarini shu yerdan nazorat qiling."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  leadingIcon={<Plus className="w-4 h-4" />}
                  onClick={() => onOpenDebtModal()}
                >
                  Qarz qoʻshish
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
              {filtered.map((debt) => {
                const isPaid = debt.remainingAmount === 0 || debt.status === 'paid';
                const isOverdue =
                  !isPaid && new Date(debt.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);
                const paidPct = debt.amount > 0 ? Math.round((debt.paidAmount / debt.amount) * 100) : 0;

                return (
                  <div key={debt.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={[
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                            debt.type === 'borrowed'
                              ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                          ].join(' ')}
                        >
                          {debt.type === 'borrowed' ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {debt.personName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {debt.type === 'borrowed' ? 'Olingan qarz' : 'Berilgan qarz'}
                            {debt.phone ? ` · ${debt.phone}` : ''}
                          </div>
                        </div>
                      </div>

                      {renderStatusBadge(debt, isPaid, isOverdue)}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Qoldiq qarz</span>
                        <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatMoney(debt.remainingAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 block text-[11px]">Qaytarish muddati</span>
                        <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                          {formatDateUz(debt.dueDate)}
                        </span>
                      </div>
                    </div>

                    <ProgressBar
                      value={paidPct}
                      tone={isPaid ? 'emerald' : isOverdue ? 'rose' : 'teal'}
                      size="sm"
                      label={`${debt.personName} toʻlov jarayoni`}
                    />

                    <div className="flex items-center justify-between gap-2 pt-1">
                      {!isPaid ? (
                        <Button
                          variant="outline"
                          size="sm"
                          leadingIcon={<Coins className="w-3.5 h-3.5 text-emerald-500" />}
                          onClick={() => onOpenDebtPay(debt)}
                        >
                          Toʻlov kiritish
                        </Button>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          Toʻliq yopilgan
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <IconButton label="Qarzni tahrirlash" size="sm" onClick={() => onOpenDebtModal(debt)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </IconButton>
                        <IconButton
                          label="Qarzni oʻchirish"
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteDebt(debt.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0D1927]/70 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Shaxs / Turi</th>
                    <th className="py-3 px-4">Qarz summasi</th>
                    <th className="py-3 px-4">Toʻlangan</th>
                    <th className="py-3 px-4">Qoldiq</th>
                    <th className="py-3 px-4">Muddat</th>
                    <th className="py-3 px-4">Holat</th>
                    <th className="py-3 px-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {filtered.map((debt) => {
                    const isPaid = debt.remainingAmount === 0 || debt.status === 'paid';
                    const isOverdue =
                      !isPaid && new Date(debt.dueDate).getTime() < new Date().setHours(0, 0, 0, 0);

                    return (
                      <tr key={debt.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={[
                                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
                                debt.type === 'borrowed'
                                  ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                                  : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                              ].join(' ')}
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
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <span>{debt.type === 'borrowed' ? 'Olingan qarz' : 'Berilgan qarz'}</span>
                                {debt.phone && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{debt.phone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {formatMoney(debt.amount)}
                        </td>

                        <td className="py-3.5 px-4 font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatMoney(debt.paidAmount)}
                        </td>

                        <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatMoney(debt.remainingAmount)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                          <div className="text-slate-700 dark:text-slate-300">
                            {formatDateUz(debt.dueDate)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Berilgan: {debt.startDate}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {renderStatusBadge(debt, isPaid, isOverdue)}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid && (
                              <Button
                                variant="outline"
                                size="sm"
                                leadingIcon={<Coins className="w-3.5 h-3.5 text-emerald-500" />}
                                onClick={() => onOpenDebtPay(debt)}
                              >
                                Toʻlov
                              </Button>
                            )}
                            <IconButton
                              label="Qarzni tahrirlash"
                              size="sm"
                              onClick={() => onOpenDebtModal(debt)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </IconButton>
                            <IconButton
                              label="Qarzni oʻchirish"
                              variant="danger"
                              size="sm"
                              onClick={() => onDeleteDebt(debt.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
