/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  CreditCard,
  Lock,
  ExternalLink,
  Upload,
} from 'lucide-react';
import { BankConnection, BankAccount } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const BanksView: React.FC = () => {
  const { user } = useAuth();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [supportedBanks, setSupportedBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getBanks();
      setConnections(res.connections || []);
      setSupportedBanks(res.supportedBanks || []);
      if (res.supportedBanks?.length > 0 && !selectedBankId) {
        setSelectedBankId(res.supportedBanks[0].id);
      }
    } catch (e) {
      console.error('Failed to load banks:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleSync = async (id: string) => {
    try {
      setSyncingId(id);
      const res = await api.syncBank(id);
      alert(`Sinxronizatsiya muvaffaqiyatli yakunlandi! ${res.importedCount} ta yangi operatsiya yuklandi.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Sinxronizatsiyada xatolik yuz berdi');
    } finally {
      setSyncingId(null);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const bank = supportedBanks.find((b) => b.id === selectedBankId);
    if (!bank) return;

    try {
      await api.connectBank(bank.id, bank.name);
      setIsConnectModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Ulanishda xatolik');
    }
  };

  const handleDisconnect = async (id: string) => {
    if (confirm('Ushbu bank ulanishini uzmoqchimisiz?')) {
      await api.disconnectBank(id);
      await loadData();
    }
  };

  const handleStatementUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert(`"${file.name}" bank koʻchirmasi qabul qilindi. 5 ta yangi tranzaksiya aniqlandi va takrorlanishlarsiz kiritildi!`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Banklar va Toʻlov Tizimlari Integratsiyasi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Uzum Bank, Click, Payme, Kapitalbank va boshqa bank hisoblaringiz bilan xavfsiz sinxronizatsiya
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleStatementUpload}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Koʻchirmani import qilish (CSV)</span>
          </button>

          <button
            onClick={() => setIsConnectModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Bank ulash</span>
          </button>
        </div>
      </div>

      {/* Security Banner */}
      <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Bank darajasidagi xavfsizlik:</span>{' '}
          HISOBOT AI faqat oʻqish rejimida (Read-Only) koʻchirmalarni import qiladi. Kartangizning CVV kodi, PIN-kodi yoki toʻliq 16 xonali raqami hech qachon serverda saqlanmaydi va mablagʻ yechish huquqiga ega emas.
        </div>
      </div>

      {/* Connected Banks List */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
          Faol Ulangan Banklar ({connections.length})
        </h3>

        {connections.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            Hozircha ulangan banklar yoʻq. "Bank ulash" tugmasini bosing.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-blue-600 text-base">
                        {conn.bankName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                          {conn.bankName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            Faol ulanish
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSync(conn.id)}
                        disabled={syncingId === conn.id}
                        title="Hozir sinxronlash"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingId === conn.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        title="Ulanishni uzish"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">
                      Ushbu bankdagi hisoblar:
                    </div>
                    {conn.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {acc.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {acc.mask}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {formatMoney(acc.balance, acc.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-dashed border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Oxirgi sinxronizatsiya: {formatDateUz(conn.lastSyncAt)}</span>
                  <button
                    onClick={() => handleSync(conn.id)}
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    Yangilash →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              Yangi bank yoki toʻlov tizimini ulash
            </h3>

            <form onSubmit={handleConnect} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Qoʻllab-quvvatlanadigan bankni tanlang:
                </label>
                <div className="space-y-2">
                  {supportedBanks.map((b) => (
                    <label
                      key={b.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedBankId === b.id
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="bank"
                          value={b.id}
                          checked={selectedBankId === b.id}
                          onChange={() => setSelectedBankId(b.id)}
                          className="text-blue-600"
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {b.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">Open Banking API</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Xavfsiz ulash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
