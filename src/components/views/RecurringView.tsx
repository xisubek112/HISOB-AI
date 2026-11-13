/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Repeat,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  X,
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

export const RecurringView: React.FC = () => {
  const { user } = useAuth();
  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([]);
  const [logs, setLogs] = useState<RecurringExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);
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

  const loadData = async () => {
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
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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
    if (!form.description || !form.amount) return;

    try {
      if (editingItem) {
        await api.updateRecurring(editingItem.id, {
          description: form.description,
          amount: parseFloat(form.amount) || 0,
          type: form.type,
          currency: form.currency,
          frequency: form.frequency,
          categoryName: form.categoryName,
          paymentMethod: form.paymentMethod,
          nextExecutionDate: form.nextExecutionDate,
          notes: form.notes,
        });
      } else {
        await api.addRecurring({
          description: form.description,
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
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save recurring item:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Ushbu avtomatik toʻlov jadvalini oʻchirmoqchimisiz?')) {
      await api.deleteRecurring(id);
      await loadData();
    }
  };

  const handleExecuteNow = async (id: string) => {
    try {
      setExecutingId(id);
      const res = await api.executeRecurring(id);
      if (res.success) {
        alert('Toʻlov muvaffaqiyatli amalga oshirildi va tranzaksiyalarga yozildi!');
      }
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Bajarishda xatolik yuz berdi');
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
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Avtomatik va Takroriy Toʻlovlar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Ish haqi, ijara toʻlovi, kommunal xizmatlar va takroriy kirim-chiqimlar jadvali
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Yangi jadval qoʻshish</span>
        </button>
      </div>

      {/* Feature Guarantee Banner */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">
              Idempotentlik va Takrorlanishdan Himoya
            </div>
            <div className="text-[11px] text-slate-400">
              Har bir reja unikal kalit bilan himoyalangan, bir xil toʻlov bir kunda ikki marta tasodifan yechilmaydi.
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-300 font-mono shrink-0">
          Faol jadvallar: {recurringList.filter((r) => r.status === 'active').length} ta
        </div>
      </div>

      {/* Recurring Schedules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recurringList.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                      item.type === 'income' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    {item.type === 'income' ? (
                      <ArrowDownLeft className="w-5 h-5" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {item.description}
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {getFrequencyText(item.frequency)} • {item.categoryName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(item)}
                    title="Tahrirlash"
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Oʻchirish"
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">
                    Rejalashtirilgan summa
                  </div>
                  <div
                    className={`text-lg font-extrabold font-mono mt-0.5 ${
                      item.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'}
                    {formatMoney(item.amount, item.currency)}
                  </div>
                </div>

                <button
                  onClick={() => handleExecuteNow(item.id)}
                  disabled={executingId === item.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl transition-colors border border-blue-200 dark:border-blue-900/50 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{executingId === item.id ? 'Bajarilmoqda...' : 'Hozir bajarish'}</span>
                </button>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Navbatdagi: {formatDateUz(item.nextExecutionDate)}</span>
              </span>
              {item.lastExecutedAt && (
                <span>Oxirgi ijro: {formatDateUz(item.lastExecutedAt)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Execution Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Avtomatik toʻlovlar ijro jurnali
            </h3>
            <p className="text-[11px] text-slate-400">
              Tizim tomonidan avtomatik qayd etilgan amaliyotlar hisoboti
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {logs.length} ta yozuv
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hozircha ijro jurnali boʻsh.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Vaqt</th>
                  <th className="py-2.5 px-4">Tavsif</th>
                  <th className="py-2.5 px-4">Turi</th>
                  <th className="py-2.5 px-4">Holat</th>
                  <th className="py-2.5 px-4 text-right">Summa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {formatDateUz(log.executedAt)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {log.description}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.type === 'income'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {log.type === 'income' ? 'Kirim' : 'Chiqim'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Bajarildi
                      </span>
                    </td>
                    <td
                      className={`py-3 px-4 font-mono font-bold text-right ${
                        log.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {formatMoney(log.amount, 'UZS')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                {editingItem ? 'Jadvalni tahrirlash' : 'Yangi takroriy toʻlov'}
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
                  Operatsiya nomi / Tavsif
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Uy ijarasi, Ish haqi, Elektr energiyasi"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Operatsiya turi
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as TransactionType })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="expense">Chiqim (Xarajat)</option>
                    <option value="income">Kirim (Daromad)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Summa
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Takrorlanish davri
                  </label>
                  <select
                    value={form.frequency}
                    onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurrenceFrequency })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="monthly">Har oy</option>
                    <option value="weekly">Har hafta</option>
                    <option value="quarterly">Har 3 oyda</option>
                    <option value="yearly">Har yil</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Boshlanish / Keyingi ijro sanasi
                  </label>
                  <input
                    type="date"
                    required
                    value={form.nextExecutionDate}
                    onChange={(e) => setForm({ ...form, nextExecutionDate: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
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
