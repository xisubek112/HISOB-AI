/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  Bell,
} from 'lucide-react';
import { Subscription, BillingInterval, SubscriptionStatus, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
} from '../../design-system/index.ts';

export const SubscriptionsView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);
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

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getSubscriptions();
      setSubscriptions(res.subscriptions || []);
    } catch (e) {
      console.error('Failed to load subscriptions:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    if (!form.serviceName.trim() || !form.amount) return;

    try {
      setSaving(true);
      const payload = {
        serviceName: form.serviceName.trim(),
        amount: parseFloat(form.amount) || 0,
        currency: form.currency,
        billingInterval: form.billingInterval,
        nextPaymentDate: form.nextPaymentDate,
        categoryName: form.categoryName,
        status: form.status,
        notes: form.notes,
      };

      if (editingSub) {
        await api.updateSubscription(editingSub.id, payload);
        toast.success('Obuna yangilandi');
      } else {
        await api.addSubscription(payload);
        toast.success('Yangi obuna qoʻshildi');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Obunani saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await toast.confirm({
      title: 'Obunani oʻchirish',
      message: 'Haqiqatan ham ushbu obunani oʻchirmoqchimisiz?',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.deleteSubscription(id);
      toast.success('Obuna oʻchirildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Oʻchirishda xatolik');
    }
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const nextStatus: SubscriptionStatus = sub.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateSubscription(sub.id, { status: nextStatus });
      toast.info(nextStatus === 'active' ? 'Obuna faollashtirildi' : 'Obuna pauzaga qoʻyildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Holatni oʻzgartirishda xatolik');
    }
  };

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
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Muntazam obunalar nazorati
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Raqamli xizmatlar, internet va oylik toʻlovlarni kuzatib boring
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leadingIcon={<Plus className="w-4 h-4" />}
          onClick={handleOpenAdd}
        >
          Obuna qoʻshish
        </Button>
      </div>

      {/* Aggregate KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card interactive padding="lg">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Oylik obunalar xarajati
          </span>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-1.5">
            {formatMoney(monthlyTotalUZS, 'UZS')}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block tabular-nums">
            {activeSubs.length} ta faol xizmat
          </span>
        </Card>

        <Card interactive padding="lg">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Yillik umumiy sarf
          </span>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1.5">
            {formatMoney(annualTotalUZS, 'UZS')}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
            Rejalashtirilgan yillik sarf
          </span>
        </Card>

        <Card interactive padding="lg" className="flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Eslatmalar tizimi
            </span>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Faol (3 kun va 1 kun oldin)</span>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
              Ilova va Telegram orqali
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Subscriptions Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-6 h-6" />}
          title="Hali obunalar qoʻshilmagan"
          description="Oylik va yillik obunalaringizni qoʻshing — tizim yaqinlashayotgan toʻlovlarni oldindan eslatadi."
          action={
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAdd}
            >
              Birinchi obunani qoʻshish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions.map((sub) => {
            const daysLeft = getDaysUntil(sub.nextPaymentDate);
            const isUrgent = daysLeft >= 0 && daysLeft <= 3;
            const isOverdue = daysLeft < 0;

            return (
              <Card
                key={sub.id}
                interactive
                padding="lg"
                className={[
                  'flex flex-col justify-between',
                  sub.status === 'paused'
                    ? 'opacity-70'
                    : isUrgent
                    ? 'border-amber-500/40'
                    : '',
                ].join(' ')}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {sub.serviceName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {sub.serviceName}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                          {sub.categoryName} ·{' '}
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

                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton
                        label={sub.status === 'active' ? 'Toʻxtatib turish' : 'Faollashtirish'}
                        size="sm"
                        onClick={() => handleToggleStatus(sub)}
                      >
                        {sub.status === 'active' ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </IconButton>
                      <IconButton label="Obunani tahrirlash" size="sm" onClick={() => handleOpenEdit(sub)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </IconButton>
                      <IconButton
                        label="Obunani oʻchirish"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(sub.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </IconButton>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.08] flex items-baseline justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Toʻlov summasi:</span>
                    <span className="text-lg font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatMoney(sub.amount, sub.currency)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-dashed border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDateUz(sub.nextPaymentDate)}</span>
                  </span>

                  {sub.status === 'paused' ? (
                    <Badge tone="neutral">Toʻxtatilgan</Badge>
                  ) : isUrgent ? (
                    <Badge tone="amber" className="tabular-nums">
                      {daysLeft === 0 ? 'Bugun toʻlov kuni' : `${daysLeft} kundan soʻng`}
                    </Badge>
                  ) : isOverdue ? (
                    <Badge tone="rose">Muddati oʻtgan</Badge>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                      {daysLeft} kun qoldi
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Subscription Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSub ? 'Obunani tahrirlash' : 'Yangi obuna qoʻshish'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Xizmat nomi"
            type="text"
            required
            placeholder="Masalan: Netflix, YouTube Premium, TPS Internet"
            value={form.serviceName}
            onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Toʻlov summasi"
              type="number"
              step="any"
              required
              monospace
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />

            <Select
              label="Valyuta"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value as CurrencyCode })}
            >
              <option value="UZS">UZS (Soʻm)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="RUB">RUB (₽)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Toʻlov davriyligi"
              value={form.billingInterval}
              onChange={(e) =>
                setForm({ ...form, billingInterval: e.target.value as BillingInterval })
              }
            >
              <option value="monthly">Har oy</option>
              <option value="yearly">Har yil</option>
              <option value="quarterly">Har 3 oyda</option>
              <option value="weekly">Har hafta</option>
            </Select>

            <Input
              label="Keyingi toʻlov sanasi"
              type="date"
              required
              value={form.nextPaymentDate}
              onChange={(e) => setForm({ ...form, nextPaymentDate: e.target.value })}
            />
          </div>

          <Input
            label="Izoh (ixtiyoriy)"
            type="text"
            placeholder="Karta raqami yoki tarif rejasi"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="pt-2 flex justify-end gap-2.5">
            <Button variant="ghost" size="md" onClick={() => setIsModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
              Saqlash
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
