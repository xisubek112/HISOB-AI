/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Repeat,
  Plus,
  Play,
  CheckCircle2,
  Trash2,
  Edit2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import {
  RecurringTransaction,
  RecurringExecutionLog,
  RecurrenceFrequency,
  TransactionType,
  CurrencyCode,
  PaymentMethod,
} from '../../types/finance.ts';
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

export const RecurringView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [logs, setLogs] = useState<RecurringExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    type: 'expense' as TransactionType,
    currency: 'UZS' as CurrencyCode,
    frequency: 'monthly' as RecurrenceFrequency,
    categoryName: 'Kommunal toʻlovlar',
    paymentMethod: 'card' as PaymentMethod,
    nextExecutionDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getRecurring();
      setRecurringList(res.recurring || []);
      setLogs(res.logs || []);
    } catch (e) {
      console.error('Failed to load recurring payments:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setForm({
      description: '',
      amount: '',
      type: 'expense',
      currency: 'UZS',
      frequency: 'monthly',
      categoryName: 'Kommunal toʻlovlar',
      paymentMethod: 'card',
      nextExecutionDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: RecurringTransaction) => {
    setEditingItem(item);
    setForm({
      description: item.description,
      amount: item.amount.toString(),
      type: item.type,
      currency: item.currency,
      frequency: item.frequency,
      categoryName: item.categoryName,
      paymentMethod: item.paymentMethod,
      nextExecutionDate: item.nextExecutionDate,
      notes: item.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;

    try {
      setSaving(true);
      if (editingItem) {
        await api.updateRecurring(editingItem.id, {
          description: form.description.trim(),
          amount: parseFloat(form.amount) || 0,
          type: form.type,
          currency: form.currency,
          frequency: form.frequency,
          categoryName: form.categoryName,
          paymentMethod: form.paymentMethod,
          nextExecutionDate: form.nextExecutionDate,
          notes: form.notes,
        });
        toast.success('Takroriy jadval yangilandi');
      } else {
        await api.addRecurring({
          description: form.description.trim(),
          amount: parseFloat(form.amount) || 0,
          type: form.type,
          currency: form.currency,
          frequency: form.frequency,
          categoryId: 'cat_auto',
          categoryName: form.categoryName,
          paymentMethod: form.paymentMethod,
          nextExecutionDate: form.nextExecutionDate,
          status: 'active',
          idempotencyKeyPrefix: 'auto_rec_',
          notes: form.notes,
        });
        toast.success('Yangi takroriy jadval qoʻshildi');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Jadvalni saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await toast.confirm({
      title: 'Jadvalni oʻchirish',
      message: 'Ushbu avtomatik toʻlov jadvalini oʻchirmoqchimisiz?',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.deleteRecurring(id);
      toast.success('Jadval oʻchirildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Oʻchirishda xatolik');
    }
  };

  const handleExecuteNow = async (id: string) => {
    try {
      setExecutingId(id);
      const res = await api.executeRecurring(id);
      if (res.success) {
        toast.success('Toʻlov amalga oshirildi va tranzaksiyalarga yozildi');
      }
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Bajarishda xatolik yuz berdi');
    } finally {
      setExecutingId(null);
    }
  };

  const getFrequencyText = (freq: RecurrenceFrequency) => {
    switch (freq) {
      case 'weekly':
        return 'Har hafta';
      case 'monthly':
        return 'Har oy';
      case 'quarterly':
        return 'Har 3 oyda';
      case 'yearly':
        return 'Har yil';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Avtomatik va takroriy toʻlovlar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ish haqi, ijara, kommunal xizmatlar va takroriy kirim-chiqimlar jadvali
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leadingIcon={<Plus className="w-4 h-4" />}
          onClick={handleOpenAdd}
        >
          Yangi jadval qoʻshish
        </Button>
      </div>

      {/* Protection Banner — Deep Navy + Emerald */}
      <section className="p-4 sm:p-5 rounded-2xl bg-[#081220] text-white border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">
              Takroriy yechishdan himoya (Idempotentlik)
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              Har bir reja unikal kalit bilan himoyalangan, bir toʻlov bir kunda ikki marta yozilmaydi.
            </div>
          </div>
        </div>
        <Badge tone="emerald" size="md" className="self-start sm:self-center tabular-nums">
          Faol jadvallar: {recurringList.filter((r) => r.status === 'active').length} ta
        </Badge>
      </section>

      {/* Recurring Schedules Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : recurringList.length === 0 ? (
        <EmptyState
          icon={<Repeat className="w-6 h-6" />}
          title="Takroriy toʻlov jadvallari yoʻq"
          description="Oylik ish haqi, ijara yoki kommunal toʻlov jadvalini qoʻshing va bir tugma bilan qayd eting."
          action={
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Plus className="w-4 h-4" />}
              onClick={handleOpenAdd}
            >
              Jadval yaratish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recurringList.map((item) => (
            <Card key={item.id} interactive padding="lg" className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={[
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        item.type === 'income'
                          ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
                      ].join(' ')}
                    >
                      {item.type === 'income' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {item.description}
                      </h3>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                        {getFrequencyText(item.frequency)} · {item.categoryName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton label="Jadvalni tahrirlash" size="sm" onClick={() => handleOpenEdit(item)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </IconButton>
                    <IconButton
                      label="Jadvalni oʻchirish"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconButton>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Rejalashtirilgan summa
                    </div>
                    <div
                      className={[
                        'text-lg font-extrabold font-mono tabular-nums mt-0.5',
                        item.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400',
                      ].join(' ')}
                    >
                      {item.type === 'income' ? '+' : '-'}
                      {formatMoney(item.amount, item.currency)}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    loading={executingId === item.id}
                    leadingIcon={<Play className="w-3.5 h-3.5 text-emerald-500" />}
                    onClick={() => handleExecuteNow(item.id)}
                  >
                    {executingId === item.id ? 'Bajarilmoqda...' : 'Hozir bajarish'}
                  </Button>
                </div>
              </div>

              <div className="mt-3.5 pt-3 border-t border-dashed border-slate-200/70 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Navbatdagi: {formatDateUz(item.nextExecutionDate)}</span>
                </span>
                {item.lastExecutedAt && <span>Oxirgi ijro: {formatDateUz(item.lastExecutedAt)}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Execution Logs */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Avtomatik toʻlovlar ijro jurnali
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Tizim tomonidan qayd etilgan amaliyotlar hisoboti
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {logs.length} ta yozuv
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Hozircha ijro jurnali boʻsh.
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {log.description}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {formatDateUz(log.executedAt)} · {log.type === 'income' ? 'Kirim' : 'Chiqim'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={[
                        'font-mono tabular-nums font-bold text-xs',
                        log.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400',
                      ].join(' ')}
                    >
                      {log.type === 'income' ? '+' : '-'}
                      {formatMoney(log.amount, 'UZS')}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      Bajarildi
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/70 dark:bg-[#0D1927]/70 text-slate-500 dark:text-slate-400 font-semibold text-[11px] border-b border-slate-200/70 dark:border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Vaqt</th>
                    <th className="py-3 px-4">Tavsif</th>
                    <th className="py-3 px-4">Turi</th>
                    <th className="py-3 px-4">Holat</th>
                    <th className="py-3 px-4 text-right">Summa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                      <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                        {formatDateUz(log.executedAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {log.description}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={log.type === 'income' ? 'emerald' : 'rose'}>
                          {log.type === 'income' ? 'Kirim' : 'Chiqim'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Bajarildi</span>
                        </span>
                      </td>
                      <td
                        className={[
                          'py-3 px-4 font-mono tabular-nums font-bold text-right',
                          log.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        ].join(' ')}
                      >
                        {log.type === 'income' ? '+' : '-'}
                        {formatMoney(log.amount, 'UZS')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Jadvalni tahrirlash' : 'Yangi takroriy toʻlov'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Operatsiya nomi / Tavsif"
            type="text"
            required
            placeholder="Masalan: Uy ijarasi, Ish haqi, Elektr energiyasi"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Operatsiya turi"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType })}
            >
              <option value="expense">Chiqim (Xarajat)</option>
              <option value="income">Kirim (Daromad)</option>
            </Select>

            <Input
              label="Summa"
              type="number"
              step="any"
              required
              monospace
              placeholder="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Takrorlanish davri"
              value={form.frequency}
              onChange={(e) =>
                setForm({ ...form, frequency: e.target.value as RecurrenceFrequency })
              }
            >
              <option value="monthly">Har oy</option>
              <option value="weekly">Har hafta</option>
              <option value="quarterly">Har 3 oyda</option>
              <option value="yearly">Har yil</option>
            </Select>

            <Input
              label="Boshlanish / Keyingi ijro sanasi"
              type="date"
              required
              value={form.nextExecutionDate}
              onChange={(e) => setForm({ ...form, nextExecutionDate: e.target.value })}
            />
          </div>

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
