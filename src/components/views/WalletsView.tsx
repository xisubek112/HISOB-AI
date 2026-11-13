/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Wallet as WalletIcon,
  CreditCard,
  Building,
  Plus,
  ArrowRightLeft,
  Trash2,
  Edit2,
  DollarSign,
  Banknote,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { Wallet, WalletTransfer, WalletType, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, CURRENCY_SYMBOLS } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const WalletsView: React.FC = () => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transfers, setTransfers] = useState<WalletTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit modal state
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [walletForm, setWalletForm] = useState({
    name: '',
    type: 'card' as WalletType,
    balance: 0,
    currency: 'UZS' as CurrencyCode,
    color: '#2563eb',
    accountNumber: '',
  });

  // Transfer modal state
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
      const [wRes, tRes] = await Promise.all([
        api.getWallets(),
        api.getWalletTransfers(),
      ]);
      setWallets(wRes.wallets);
      setTransfers(tRes.transfers);
    } catch (e) {
      console.error('Failed to load wallets data:', e);
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
      color: '#2563eb',
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
      color: w.color || '#2563eb',
      accountNumber: w.accountNumber || '',
    });
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletForm.name) return;

    try {
      if (editingWallet) {
        await api.updateWallet(editingWallet.id, {
          name: walletForm.name,
          type: walletForm.type,
          balance: Number(walletForm.balance) || 0,
          currency: walletForm.currency,
          color: walletForm.color,
          accountNumber: walletForm.accountNumber,
        });
      } else {
        await api.addWallet({
          name: walletForm.name,
          type: walletForm.type,
          balance: Number(walletForm.balance) || 0,
          currency: walletForm.currency,
          color: walletForm.color,
          accountNumber: walletForm.accountNumber,
        });
      }
      setIsWalletModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save wallet:', err);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    if (wallets.length <= 1) {
      alert('Kamida bitta hamyon qolishi kerak!');
      return;
    }
    if (confirm('Haqiqatan ham bu hamyonni oʻchirmoqchimisiz?')) {
      await api.deleteWallet(id);
      await loadData();
    }
  };

  const handleOpenTransferModal = () => {
    setTransferError('');
    if (wallets.length < 2) {
      alert('Oʻtkazma qilish uchun kamida 2 ta hamyon kerak.');
      return;
    }
    setTransferForm({
      fromWalletId: wallets[0].id,
      toWalletId: wallets[1].id,
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
      setTransferError(`Mablagʻ yetarli emas. Joriy balans: ${formatMoney(sourceWallet.balance, sourceWallet.currency)}`);
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
      await loadData();
    } catch (err: any) {
      setTransferError(err.message || 'Oʻtkazmada xatolik yuz berdi');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Aggregates
  const totalBalanceUZS = wallets.reduce((acc, w) => {
    if (w.currency === 'UZS') return acc + w.balance;
    if (w.currency === 'USD') return acc + w.balance * 12850;
    if (w.currency === 'EUR') return acc + w.balance * 13950;
    if (w.currency === 'RUB') return acc + w.balance * 138;
    return acc + w.balance;
  }, 0);

  const getWalletIcon = (type: WalletType) => {
    switch (type) {
      case 'card':
        return <CreditCard className="w-5 h-5" />;
      case 'bank_account':
        return <Building className="w-5 h-5" />;
      case 'cash':
        return <Banknote className="w-5 h-5" />;
      default:
        return <WalletIcon className="w-5 h-5" />;
    }
  };

  const getWalletTypeName = (type: WalletType) => {
    switch (type) {
      case 'card':
        return 'Bank kartasi';
      case 'bank_account':
        return 'Bank hisob raqami';
      case 'cash':
        return 'Naqd pul';
      case 'savings':
        return 'Jamgʻarma';
      case 'digital_wallet':
        return 'Elektron hamyon';
      default:
        return 'Boshqa';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Hamyonlar va Bank Kartalari
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mablagʻlaringizni alohida hisoblar, kartalar va naqd pullar boʻyicha taqsimlang
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenTransferModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Oʻtkazma qilish</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Hamyon qoʻshish</span>
          </button>
        </div>
      </div>

      {/* Overview Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-blue-300 font-semibold mb-1">
            Barcha hamyonlardagi umumiy qoldiq (ekvivalent UZS)
          </div>
          <div className="text-3xl font-extrabold tracking-tight font-mono">
            {formatMoney(totalBalanceUZS, 'UZS')}
          </div>
          <div className="text-xs text-slate-300 mt-1 flex items-center gap-2">
            <span>{wallets.length} ta faol hamyon/karta</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Xavfsiz hisob-kitob
            </span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-xs text-slate-200 max-w-sm">
          <span className="font-semibold text-white block mb-0.5">Muhim qoida:</span>
          Hamyonlararo oʻtkazmalar umumiy daromad yoki xarajat hisobotlariga qoʻshilmaydi, faqat hisoblararo muvozanatni taʼminlaydi.
        </div>
      </div>

      {/* Wallets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between group hover:border-slate-300 dark:hover:border-slate-700 transition-all"
          >
            {/* Top decorative bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: wallet.color || '#2563eb' }}
            />

            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                    style={{ backgroundColor: wallet.color || '#2563eb' }}
                  >
                    {getWalletIcon(wallet.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
                      {wallet.name}
                    </h3>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                      {getWalletTypeName(wallet.type)}
                      {wallet.accountNumber ? ` • ${wallet.accountNumber}` : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleOpenEditModal(wallet)}
                    title="Tahrirlash"
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteWallet(wallet.id)}
                    title="Oʻchirish"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                  Joriy qoldiq
                </div>
                <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono tracking-tight mt-0.5">
                  {formatMoney(wallet.balance, wallet.currency)}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 flex items-center justify-between text-[11px] text-slate-400 border-t border-dashed border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase">
                Valyuta: {wallet.currency}
              </span>
              <button
                onClick={() => {
                  setTransferForm({
                    fromWalletId: wallet.id,
                    toWalletId: wallets.find((w) => w.id !== wallet.id)?.id || '',
                    amount: '',
                    notes: '',
                  });
                  setIsTransferModalOpen(true);
                }}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Oʻtkazish →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Transfers History Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Hamyonlararo oʻtkazmalar tarixi
            </h3>
            <p className="text-[11px] text-slate-400">
              Faqat hisoblararo ichki almashinuvlar yozuvi
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {transfers.length} ta operatsiya
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hali hamyonlararo oʻtkazmalar mavjud emas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Sana</th>
                  <th className="py-2.5 px-4">Chiqish hamyoni</th>
                  <th className="py-2.5 px-4">Qabul qiluvchi</th>
                  <th className="py-2.5 px-4">Summa</th>
                  <th className="py-2.5 px-4">Izoh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {transfers.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {tx.fromWalletName}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {tx.toWalletName}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
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
        )}
      </div>

      {/* Add / Edit Wallet Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                {editingWallet ? 'Hamyonni tahrirlash' : 'Yangi hamyon qoʻshish'}
              </h3>
              <button
                onClick={() => setIsWalletModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWallet} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hamyon yoki karta nomi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Uzum Bank, Kapital Humo, Naqd pul"
                  value={walletForm.name}
                  onChange={(e) => setWalletForm({ ...walletForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Turi
                  </label>
                  <select
                    value={walletForm.type}
                    onChange={(e) => setWalletForm({ ...walletForm, type: e.target.value as WalletType })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="card">Bank kartasi</option>
                    <option value="bank_account">Bank hisobi</option>
                    <option value="cash">Naqd pul</option>
                    <option value="savings">Jamgʻarma</option>
                    <option value="digital_wallet">Elektron hamyon</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valyuta
                  </label>
                  <select
                    value={walletForm.currency}
                    onChange={(e) => setWalletForm({ ...walletForm, currency: e.target.value as CurrencyCode })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="UZS">UZS (Soʻm)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="RUB">RUB (₽)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Boshlangʻich balans
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={walletForm.balance}
                    onChange={(e) => setWalletForm({ ...walletForm, balance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Karta/Hisob maskasi (oxirgi 4 ta raqam)
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="*1234"
                    value={walletForm.accountNumber}
                    onChange={(e) => setWalletForm({ ...walletForm, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rang belgisi
                </label>
                <div className="flex items-center gap-2">
                  {['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#475569'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setWalletForm({ ...walletForm, color: c })}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                        walletForm.color === c ? 'scale-110 ring-2 ring-offset-2 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {walletForm.color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsWalletModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Between Wallets Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  Hamyonlararo oʻtkazma
                </h3>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {transferError}
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chiqish hamyoni (Mablagʻ yechiladi)
                </label>
                <select
                  value={transferForm.fromWalletId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromWalletId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({formatMoney(w.balance, w.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Qabul qiluvchi hamyon (Mablagʻ qoʻshiladi)
                </label>
                <select
                  value={transferForm.toWalletId}
                  onChange={(e) => setTransferForm({ ...transferForm, toWalletId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                >
                  {wallets
                    .filter((w) => w.id !== transferForm.fromWalletId)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({formatMoney(w.balance, w.currency)})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Oʻtkaziladigan summa
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Izoh (ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder="Masalan: Kartadan naqd pulga yechish"
                  value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300">
                Bu oʻtkazma faqat ushbu ikki hamyon balansini oʻzgartiradi va umumiy sof jamgʻarma statistikasiga zarar yetkazmaydi.
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {transferSubmitting ? 'Bajarilmoqda...' : 'Oʻtkazmani tasdiqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
