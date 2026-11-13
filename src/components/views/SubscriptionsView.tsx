/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CreditCard,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Bell,
  Sparkles,
  X,
} from 'lucide-react';
import { Subscription, BillingInterval, SubscriptionStatus, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const SubscriptionsView: React.FC = () => {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [form, setForm] = useState({
    serviceName: '',
    amount: '',
    currency: 'UZS' as CurrencyCode,
    billingInterval: 'monthly' as BillingInterval,
    nextPaymentDate: new Date().toISOString().split('T')[0],
    categoryName: 'Obunalar',
    status: 'active' as SubscriptionStatus,
    notes: '',
  });

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getSubscriptions();
      setSubscriptions(res.subscriptions);
    } catch (e) {
      console.error('Failed to load subscriptions:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleOpenAdd = () => {
    setEditingSub(null);
    setForm({
      serviceName: '',
      amount: '',
      currency: 'UZS',
      billingInterval: 'monthly',
      nextPaymentDate: new Date().toISOString().split('T')[0],
      categoryName: 'Obunalar',
      status: 'active',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setForm({
      serviceName: sub.serviceName,
      amount: sub.amount.toString(),
      currency: sub.currency,
      billingInterval: sub.billingInterval,
      nextPaymentDate: sub.nextPaymentDate,
      categoryName: sub.categoryName,
      status: sub.status,
      notes: sub.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.serviceName || !form.amount) return;

    try {
      if (editingSub) {
        await api.updateSubscription(editingSub.id, {
          serviceName: form.serviceName,
          amount: parseFloat(form.amount) || 0,
          currency: form.currency,
          billingInterval: form.billingInterval,
          nextPaymentDate: form.nextPaymentDate,
          categoryName: form.categoryName,
          status: form.status,
          notes: form.notes,
        });
      } else {
        await api.addSubscription({
          serviceName: form.serviceName,
          amount: parseFloat(form.amount) || 0,
          currency: form.currency,
          billingInterval: form.billingInterval,
          nextPaymentDate: form.nextPaymentDate,
          categoryName: form.categoryName,
          status: form.status,
          notes: form.notes,
        });
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save subscription:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Ushbu obunani oʻchirmoqchimisiz?')) {
      await api.deleteSubscription(id);
      await loadData();
    }
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const nextStatus: SubscriptionStatus = sub.status === 'active' ? 'paused' : 'active';
    await api.updateSubscription(sub.id, { status: nextStatus });
    await loadData();
  };

  // Calculations
  const activeSubs = subscriptions.filter((s) => s.status === 'active');

  const monthlyTotalUZS = activeSubs.reduce((acc, s) => {
    let monthlyAmount = s.amount;
    if (s.billingInterval === 'yearly') monthlyAmount = s.amount / 12;
    if (s.billingInterval === 'quarterly') monthlyAmount = s.amount / 3;
    if (s.billingInterval === 'weekly') monthlyAmount = s.amount * 4.33;

    if (s.currency === 'USD') return acc + monthlyAmount * 12850;
    if (s.currency === 'EUR') return acc + monthlyAmount * 13950;
    if (s.currency === 'RUB') return acc + monthlyAmount * 138;
    return acc + monthlyAmount;
  }, 0);

  const annualTotalUZS = monthlyTotalUZS * 12;

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Muntazam Obunalar Nazorati
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Netflix, YouTube, internet, sunʼiy intellekt va boshqa oylik toʻlovlarni kuzatib boring
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Obuna qoʻshish</span>
        </button>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Oylik obunalar xarajati
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatMoney(monthlyTotalUZS, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {activeSubs.length} ta faol xizmat
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Yillik umumiy sarf
          </div>
          <div className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatMoney(annualTotalUZS, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Rejalashtirilgan yillik byudjet
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Eslatmalar tizimi
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Faol (3 kun va 1 kun oldin)
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Telegram va brauzer orqali
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {subscriptions.map((sub) => {
          const daysLeft = getDaysUntil(sub.nextPaymentDate);
          const isUrgent = daysLeft >= 0 && daysLeft <= 3;
          const isOverdue = daysLeft < 0;

          return (
            <div
              key={sub.id}
              className={`rounded-2xl border bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between transition-all ${
                sub.status === 'paused'
                  ? 'opacity-60 border-slate-200 dark:border-slate-800'
                  : isUrgent
                  ? 'border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-300/50'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-sm">
                      {sub.serviceName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {sub.serviceName}
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {sub.categoryName} •{' '}
                        {sub.billingInterval === 'monthly'
                          ? 'Oylik'
                          : sub.billingInterval === 'yearly'
                          ? 'Yillik'
                          : sub.billingInterval === 'quarterly'
                          ? 'Har 3 oyda'
                          : 'Haftalik'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(sub)}
                      title={sub.status === 'active' ? 'Toʻxtatib turish' : 'Faollashtirish'}
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {sub.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(sub)}
                      title="Tahrirlash"
                      className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      title="Oʻchirish"
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-400">Toʻlov summasi:</span>
                  <span className="text-lg font-extrabold font-mono text-slate-900 dark:text-slate-100">
                    {formatMoney(sub.amount, sub.currency)}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatDateUz(sub.nextPaymentDate)}</span>
                </span>

                {sub.status === 'paused' ? (
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    Toʻxtatilgan
                  </span>
                ) : isUrgent ? (
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md animate-pulse">
                    {daysLeft === 0 ? 'Bugun toʻlov kuni' : `${daysLeft} kundan soʻng`}
                  </span>
                ) : isOverdue ? (
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 px-2 py-0.5 rounded-md">
                    Toʻlov vaqti oʻtgan
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-500">
                    {daysLeft} kun qoldi
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Subscription Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                {editingSub ? 'Obunani tahrirlash' : 'Yangi obuna qoʻshish'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Xizmat nomi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Netflix, YouTube Premium, TPS Internet"
                  value={form.serviceName}
                  onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Toʻlov summasi
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valyuta
                  </label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}
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
                    Toʻlov davriyligi
                  </label>
                  <select
                    value={form.billingInterval}
                    onChange={(e) => setForm({ ...form, billingInterval: e.target.value as BillingInterval })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="monthly">Har oy</option>
                    <option value="yearly">Har yil</option>
                    <option value="quarterly">Har 3 oyda</option>
                    <option value="weekly">Har hafta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Keyingi toʻlov sanasi
                  </label>
                  <input
                    type="date"
                    required
                    value={form.nextPaymentDate}
                    onChange={(e) => setForm({ ...form, nextPaymentDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Izoh (ixtiyoriy)
                </label>
                <input
                  type="text"
                  placeholder="Karta raqami yoki tarif rejasi"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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
    </div>
  );
};
