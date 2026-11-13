/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  Plus,
  ArrowRightLeft,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { Wallet, WalletTransfer, WalletType, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Card,
  WalletCard,
  Button,
  Input,
  Select,
  Modal,
  Skeleton,
  EmptyState,
  useToast,
} from '../../design-system/index.ts';

const WALLET_COLORS = ['#10B981', '#06B6D4', '#3B82F6', '#F59E0B', '#EF4444', '#14B8A6', '#475569'];

export const WalletsView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletForm, setWalletForm] = useState({
    name: '',
    type: 'card' as WalletType,
    balance: 0,
    currency: 'UZS' as CurrencyCode,
    color: '#10B981',
    accountNumber: '',
  });

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromWalletId: '',
    toWalletId: '',
    amount: '',
    notes: '',
  });
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState('');

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [wRes, tRes] = await Promise.all([api.getWallets(), api.getWalletTransfers()]);
      setWallets(wRes.wallets);
      setTransfers(tRes.transfers);
    } catch (e: any) {
      toast.error(e?.message || 'Hamyonlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleOpenAddModal = () => {
    setEditingWallet(null);
    setWalletForm({
      name: '',
      type: 'card',
      balance: 0,
      currency: 'UZS',
      color: '#10B981',
      accountNumber: '',
    });
    setIsWalletModalOpen(true);
  };

  const handleOpenEditModal = (w: Wallet) => {
    setEditingWallet(w);
    setWalletForm({
      name: w.name,
      type: w.type,
      balance: w.balance,
      currency: w.currency,
      color: w.color && !/^#(8b5cf6|7c3aed|6366f1)/i.test(w.color) ? w.color : '#10B981',
      accountNumber: w.accountNumber || '',
    });
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletForm.name.trim()) return;

    try {
      setWalletSaving(true);
      const payload = {
        name: walletForm.name.trim(),
        type: walletForm.type,
        balance: Number(walletForm.balance) || 0,
        currency: walletForm.currency,
        color: walletForm.color,
        accountNumber: walletForm.accountNumber.trim(),
      };

      if (editingWallet) {
        await api.updateWallet(editingWallet.id, payload);
        toast.success('Hamyon yangilandi');
      } else {
        await api.addWallet(payload);
        toast.success('Yangi hamyon qoʻshildi');
      }
      setIsWalletModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Hamyonni saqlashda xatolik');
    } finally {
      setWalletSaving(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    if (wallets.length <= 1) {
      toast.warning('Kamida bitta faol hamyon qolishi kerak');
      return;
    }
    const ok = await toast.confirm({
      title: 'Hamyonni oʻchirish',
      message: 'Haqiqatan ham ushbu hamyonni oʻchirmoqchimisiz?',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!ok) return;

    try {
      await api.deleteWallet(id);
      toast.success('Hamyon oʻchirildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Hamyonni oʻchirishda xatolik');
    }
  };

  const handleOpenTransferModal = (sourceWallet?: Wallet) => {
    setTransferError('');
    if (wallets.length < 2) {
      toast.warning('Oʻtkazma qilish uchun kamida 2 ta hamyon kerak');
      return;
    }
    const fromId = sourceWallet?.id || wallets[0].id;
    const toId = wallets.find((w) => w.id !== fromId)?.id || '';
    setTransferForm({
      fromWalletId: fromId,
      toWalletId: toId,
      amount: '',
      notes: '',
    });
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');

    const amt = parseFloat(transferForm.amount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Iltimos, toʻgʻri summa kiriting.');
      return;
    }
    if (transferForm.fromWalletId === transferForm.toWalletId) {
      setTransferError('Chiqish va qabul qiluvchi hamyonlar har xil boʻlishi kerak.');
      return;
    }

    const sourceWallet = wallets.find((w) => w.id === transferForm.fromWalletId);
    if (sourceWallet && sourceWallet.balance < amt) {
      setTransferError(
        `Mablagʻ yetarli emas. Joriy balans: ${formatMoney(sourceWallet.balance, sourceWallet.currency)}`
      );
      return;
    }

    try {
      setTransferSubmitting(true);
      await api.transferWallets(
        transferForm.fromWalletId,
        transferForm.toWalletId,
        amt,
        undefined,
        transferForm.notes
      );
      setIsTransferModalOpen(false);
      toast.success('Hamyonlararo oʻtkazma bajarildi');
      await loadData();
    } catch (err: any) {
      setTransferError(err?.message || 'Oʻtkazmada xatolik yuz berdi');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const totalBalanceUZS = wallets.reduce((acc, w) => {
    if (w.currency === 'UZS') return acc + w.balance;
    if (w.currency === 'USD') return acc + w.balance * 12850;
    if (w.currency === 'EUR') return acc + w.balance * 13920;
    if (w.currency === 'RUB') return acc + w.balance * 132;
    return acc + w.balance;
  }, 0);

  return (
    <div className="space-y-5 sm:space-y-6 hai-fade-up">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Hamyonlar va bank kartalari
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mablagʻlarni alohida hisoblar, kartalar va naqd pul boʻyicha taqsimlang
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="md"
            onClick={() => handleOpenTransferModal()}
            leadingIcon={<ArrowRightLeft className="w-4 h-4 text-emerald-500" />}
          >
            Oʻtkazma qilish
          </Button>

          <Button
            size="md"
            onClick={handleOpenAddModal}
            leadingIcon={<Plus className="w-4 h-4" />}
          >
            Hamyon qoʻshish
          </Button>
        </div>
      </div>

      {/* Overview Banner */}
      <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#081220] via-[#0D1927] to-[#073B35] border border-emerald-500/25 text-white shadow-[0_14px_36px_rgba(8,18,32,0.28)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-emerald-300 mb-1">
            Barcha hamyonlardagi umumiy qoldiq (UZS ekvivalentida)
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono tabular-nums">
            {formatMoney(totalBalanceUZS, 'UZS')}
          </div>
          <div className="text-xs text-slate-300 mt-2 flex items-center gap-2 flex-wrap">
            <span>{wallets.length} ta faol hamyon</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Hisoblararo balans himoyalangan</span>
            </span>
          </div>
        </div>

        <div className="bg-white/[0.06] rounded-xl p-3.5 border border-white/10 text-xs text-slate-200 max-w-md leading-relaxed">
          <span className="font-bold text-white block mb-0.5">Eslatma:</span>
          Hamyonlararo oʻtkazmalar umumiy daromad yoki xarajat sifatida hisoblanmaydi — faqat hisoblar orasidagi balansni yangilaydi.
        </div>
      </section>

      {/* Wallets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : wallets.length === 0 ? (
        <EmptyState
          icon={<WalletIcon className="w-5 h-5" />}
          title="Hamyonlar mavjud emas"
          description="Birinchi bank kartasi yoki naqd pul hamyoningizni yarating."
          action={
            <Button size="sm" onClick={handleOpenAddModal} leadingIcon={<Plus className="w-4 h-4" />}>
              Hamyon qoʻshish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              onEdit={handleOpenEditModal}
              onArchive={handleDeleteWallet}
              onQuickTransfer={handleOpenTransferModal}
            />
          ))}
        </div>
      )}

      {/* Transfers History Section */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Hamyonlararo oʻtkazmalar tarixi
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Hisoblar orasidagi ichki almashinuvlar
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums font-medium">
            {transfers.length} ta
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hozircha hamyonlararo oʻtkazmalar amalga oshirilmagan.
          </div>
        ) : (
          <>
            {/* Mobile Transfer Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
              {transfers.map((tx) => (
                <div key={tx.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {tx.fromWalletName} → {tx.toWalletName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {tx.date}
                      {tx.notes ? ` · ${tx.notes}` : ''}
                    </div>
                  </div>
                  <div className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                    {formatMoney(tx.amount, 'UZS')}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Transfer Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 dark:bg-[#0D1927] text-slate-500 dark:text-slate-400 font-semibold text-[11px] border-b border-slate-100 dark:border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Sana</th>
                    <th className="py-3 px-4">Chiqish hamyoni</th>
                    <th className="py-3 px-4">Qabul qiluvchi</th>
                    <th className="py-3 px-4">Summa</th>
                    <th className="py-3 px-4">Izoh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
                  {transfers.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500 tabular-nums">
                        {tx.date}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {tx.fromWalletName}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {tx.toWalletName}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatMoney(tx.amount, 'UZS')}
                      </td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                        {tx.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Add / Edit Wallet Modal */}
      <Modal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        title={editingWallet ? 'Hamyonni tahrirlash' : 'Yangi hamyon qoʻshish'}
      >
        <form onSubmit={handleSaveWallet} className="space-y-4">
          <Input
            label="Hamyon yoki karta nomi"
            type="text"
            required
            placeholder="Masalan: Uzum Bank, Kapital Humo, Naqd pul"
            value={walletForm.name}
            onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Turi"
              value={walletForm.type}
              onChange={(e) => setWalletForm({ ...walletForm, type: e.target.value as WalletType })}
            >
              <option value="card">Bank kartasi</option>
              <option value="bank_account">Bank hisobi</option>
              <option value="cash">Naqd pul</option>
              <option value="savings">Jamgʻarma</option>
              <option value="digital_wallet">Elektron hamyon</option>
            </Select>

            <Select
              label="Valyuta"
              value={walletForm.currency}
              onChange={(e) =>
                setWalletForm({ ...walletForm, currency: e.target.value as CurrencyCode })
              }
            >
              <option value="UZS">UZS (Soʻm)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="RUB">RUB (₽)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Boshlangʻich balans"
              type="number"
              step="any"
              monospace
              value={walletForm.balance}
              onChange={(e) =>
                setWalletForm({ ...walletForm, balance: parseFloat(e.target.value) || 0 })
              }
            />

            <Input
              label="Karta/Hisob maskasi"
              type="text"
              maxLength={10}
              placeholder="*1234"
              monospace
              value={walletForm.accountNumber}
              onChange={(e) => setWalletForm({ ...walletForm, accountNumber: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Rang belgisi
            </label>
            <div className="flex items-center gap-2.5 flex-wrap">
              {WALLET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Rang ${c}`}
                  onClick={() => setWalletForm({ ...walletForm, color: c })}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                    walletForm.color === c
                      ? 'scale-110 ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-[#111B27]'
                      : ''
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {walletForm.color === c && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsWalletModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={walletSaving}>
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transfer Between Wallets Modal */}
      <Modal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        title="Hamyonlararo oʻtkazma"
        subtitle="Hisoblar orasida mablagʻ koʻchirish"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          {transferError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300">
              {transferError}
            </div>
          )}

          <Select
            label="Chiqish hamyoni (Mablagʻ yechiladi)"
            value={transferForm.fromWalletId}
            onChange={(e) => setTransferForm({ ...transferForm, fromWalletId: e.target.value })}
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({formatMoney(w.balance, w.currency)})
              </option>
            ))}
          </Select>

          <Select
            label="Qabul qiluvchi hamyon (Mablagʻ qoʻshiladi)"
            value={transferForm.toWalletId}
            onChange={(e) => setTransferForm({ ...transferForm, toWalletId: e.target.value })}
          >
            {wallets
              .filter((w) => w.id !== transferForm.fromWalletId)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatMoney(w.balance, w.currency)})
                </option>
              ))}
          </Select>

          <Input
            label="Oʻtkaziladigan summa"
            type="number"
            step="any"
            required
            monospace
            placeholder="0"
            value={transferForm.amount}
            onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
          />

          <Input
            label="Izoh (ixtiyoriy)"
            type="text"
            placeholder="Masalan: Kartadan naqd pulga yechish"
            value={transferForm.notes}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
          />

          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-200">
            Ushbu oʻtkazma faqat ikki hamyon balansini oʻzgartiradi va oylik xarajat statistikasiga taʼsir qilmaydi.
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setIsTransferModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={transferSubmitting}>
              Oʻtkazmani tasdiqlash
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
