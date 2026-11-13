/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  RefreshCw,
  Plus,
  ShieldCheck,
  FileSpreadsheet,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { BankConnection } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  Skeleton,
  useToast,
} from '../../design-system/index.ts';

export const BanksView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [supportedBanks, setSupportedBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [connecting, setConnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
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
  }, [user, selectedBankId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async (id: string) => {
    try {
      setSyncingId(id);
      const res = await api.syncBank(id);
      toast.success(`Sinxronizatsiya yakunlandi (${res.importedCount} ta operatsiya yuklandi)`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Sinxronizatsiyada xatolik yuz berdi');
    } finally {
      setSyncingId(null);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const bank = supportedBanks.find((b) => b.id === selectedBankId);
    if (!bank) return;

    try {
      setConnecting(true);
      await api.connectBank(bank.id, bank.name);
      setIsConnectModalOpen(false);
      toast.success(`${bank.name} sinov rejimida ulandi`);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Ulanishda xatolik');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    const confirmed = await toast.confirm({
      title: 'Bank ulanishini uzish',
      message: 'Ushbu bank ulanishini bekor qilmoqchimisiz?',
      confirmLabel: 'Uzish',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.disconnectBank(id);
      toast.info('Bank ulanishi uzildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Xatolik yuz berdi');
    }
  };

  const handleStatementUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast.success(`"${file.name}" koʻchirmasi qabul qilindi (demo import tekshirildi)`);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Banklar va toʻlov tizimlari
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Bank hisoblari va koʻchirmalarni xavfsiz koʻrish va import qilish (demo Open Banking)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleStatementUpload}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Koʻchirmani import (CSV)
          </Button>

          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus className="w-4 h-4" />}
            onClick={() => setIsConnectModalOpen(true)}
          >
            Bank ulash
          </Button>
        </div>
      </div>

      {/* Security Banner */}
      <Card padding="md" className="bg-emerald-500/[0.06] border-emerald-500/25">
        <div className="flex items-start gap-3 text-xs text-slate-700 dark:text-slate-200">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-900 dark:text-white">
              Faqat oʻqish rejimi (Read-Only):
            </span>{' '}
            Kartaning CVV, PIN yoki toʻliq raqami serverda saqlanmaydi. Ushbu boʻlim sinov Open Banking sinxronizatsiyasi va koʻchirmani yuklash imkonini beradi.
          </div>
        </div>
      </Card>

      {/* Connected Banks List */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
          Ulangan banklar ({connections.length})
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-full" />
            ))}
          </div>
        ) : connections.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-6 h-6" />}
            title="Hozircha ulangan banklar yoʻq"
            description="Bank hisobingizni sinov rejimida ulang yoki CSV koʻchirmani yuklang."
            action={
              <Button
                variant="primary"
                size="md"
                leadingIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsConnectModalOpen(true)}
              >
                Bank ulash
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connections.map((conn) => (
              <Card key={conn.id} interactive padding="lg" className="flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                        {conn.bankName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {conn.bankName}
                        </h4>
                        <div className="mt-1">
                          <Badge tone="emerald">Faol ulanish</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <IconButton
                        label="Hozir sinxronlash"
                        size="sm"
                        disabled={syncingId === conn.id}
                        onClick={() => handleSync(conn.id)}
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${syncingId === conn.id ? 'animate-spin text-emerald-500' : ''}`}
                        />
                      </IconButton>
                      <IconButton
                        label="Ulanishni uzish"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDisconnect(conn.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>

                  {/* Connected Accounts */}
                  <div className="space-y-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.08]">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      Ushbu bankdagi hisoblar
                    </div>
                    {conn.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/60 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {acc.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                              {acc.mask}
                            </div>
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white shrink-0">
                          {formatMoney(acc.balance, acc.currency)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-dashed border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="tabular-nums">
                    Oxirgi sinxronizatsiya: {formatDateUz(conn.lastSyncAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSync(conn.id)}
                    className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  >
                    Yangilash
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Connect Modal */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title="Bank yoki toʻlov tizimini ulash"
        size="md"
      >
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Qoʻllab-quvvatlanadigan bankni tanlang
            </span>
            <div className="space-y-2">
              {supportedBanks.map((b) => (
                <label
                  key={b.id}
                  className={[
                    'flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors',
                    selectedBankId === b.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.04]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="bank"
                      value={b.id}
                      checked={selectedBankId === b.id}
                      onChange={() => setSelectedBankId(b.id)}
                      className="accent-emerald-500"
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {b.name}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Demo API</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <Button variant="ghost" size="md" onClick={() => setIsConnectModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" size="md" loading={connecting}>
              Xavfsiz ulash
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
