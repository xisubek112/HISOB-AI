/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Copy,
  Check,
  Bell,
} from 'lucide-react';
import { TelegramConnection } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  useToast,
} from '../../design-system/index.ts';

export const TelegramView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [connection, setConnection] = useState<TelegramConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [connecting, setConnecting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getTelegram();
      setConnection(res.connection);
    } catch (e) {
      console.error('Failed to load telegram info:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyCode = () => {
    if (!connection) return;
    navigator.clipboard.writeText(connection.connectCode);
    setCopiedCode(true);
    toast.success('Bogʻlanish kodi nusxalandi');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleTogglePref = async (key: keyof TelegramConnection['preferences']) => {
    if (!connection) return;
    const updated = {
      ...connection.preferences,
      [key]: !connection.preferences[key],
    };
    try {
      const res = await api.updateTelegramPreferences(updated);
      setConnection(res.connection);
      toast.success('Bildirishnoma sozlamasi yangilandi');
    } catch (e) {
      console.error('Failed to update preferences:', e);
      toast.error('Sozlamani saqlashda xatolik');
    }
  };

  const handleTestSend = async () => {
    try {
      setTestSending(true);
      await api.testSendTelegram();
      toast.success('Sinov xabari Telegram bot simulyatoriga yuborildi');
    } catch (e: any) {
      toast.error(e?.message || 'Sinov xabari yuborilmadi');
    } finally {
      setTestSending(false);
    }
  };

  const handleConnectSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    try {
      setConnecting(true);
      const res = await api.connectTelegram(usernameInput.trim().replace(/^@/, ''));
      setConnection(res.connection);
      setUsernameInput('');
      toast.success('Telegram hisob ulandi');
    } catch (e: any) {
      toast.error(e?.message || 'Ulashda xatolik yuz berdi');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const confirmed = await toast.confirm({
      title: 'Telegram ulanishini uzish',
      message: 'Telegram bot ulanishini bekor qilmoqchimisiz?',
      confirmLabel: 'Uzish',
      danger: true,
    });
    if (!confirmed) return;

    try {
      const res = await api.disconnectTelegram();
      setConnection(res.connection);
      toast.info('Telegram ulanishi bekor qilindi');
    } catch (e: any) {
      toast.error(e?.message || 'Xatolik yuz berdi');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Telegram bot integratsiyasi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Xarajatlar, obunalar va kunlik hisobotlarni Telegram orqali boshqaring
          </p>
        </div>

        {connection?.isConnected && (
          <Button
            variant="primary"
            size="sm"
            loading={testSending}
            leadingIcon={<Send className="w-3.5 h-3.5" />}
            onClick={handleTestSend}
          >
            {testSending ? 'Yuborilmoqda...' : 'Sinov xabari yuborish'}
          </Button>
        )}
      </div>

      {/* Main Connection Card — Deep Navy + Emerald/Teal */}
      <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#081220] via-[#0B2D36] to-[#0D4A43] text-white border border-emerald-500/25 shadow-[0_12px_32px_rgba(6,182,212,0.14)] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone="teal">Telegram Bot</Badge>
            <span className="text-xs text-cyan-200 font-semibold font-mono">@HisobotAIBot</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-balance">
            Telegram orqali moliyangiz doim qoʻl ostida
          </h3>
          <p className="text-xs text-slate-200 mt-1.5 max-w-lg leading-relaxed">
            Xarid chekini yuborish, kunlik sarhisob va budjet ogohlantirishlarini qabul qilish uchun botni hisobingizga bogʻlang.
          </p>
        </div>

        {connection?.isConnected ? (
          <div className="bg-white/[0.08] rounded-2xl p-4 border border-white/[0.14] text-xs shrink-0 md:min-w-[250px] space-y-2.5">
            <div className="text-emerald-300 font-bold">
              Ulangan: @{connection.telegramUsername}
            </div>
            <div className="text-[11px] text-slate-300">
              Hisobingiz bot bilan bogʻlangan
            </div>
            <Button
              variant="danger"
              size="sm"
              fullWidth
              onClick={handleDisconnect}
            >
              Ulanishni uzish
            </Button>
          </div>
        ) : (
          <div className="bg-white/[0.08] rounded-2xl p-4 border border-white/[0.14] text-xs shrink-0 md:min-w-[260px]">
            <span className="text-[11px] text-cyan-200 block mb-1.5">Bogʻlanish kodi:</span>
            <div className="flex items-center justify-between bg-black/25 px-3 py-2 rounded-xl mb-2">
              <code className="text-base font-mono font-extrabold tracking-wider text-emerald-300">
                {connection?.connectCode || 'HISOBOT-2026'}
              </code>
              <button
                type="button"
                aria-label="Kodni nusxalash"
                onClick={handleCopyCode}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="text-[11px] text-slate-300">
              Botga <code className="font-mono text-white">/start {connection?.connectCode}</code> buyrugʻini yuboring.
            </div>
          </div>
        )}
      </section>

      {/* Manual Fast Link for Demo */}
      {!connection?.isConnected && (
        <Card padding="lg">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-2">
            Tezkor sinov ulanishi: Telegram foydalanuvchi nomingizni kiriting
          </h3>
          <form onSubmit={handleConnectSimulate} className="flex flex-col sm:flex-row gap-2.5 max-w-md">
            <div className="flex-1">
              <Input
                type="text"
                required
                placeholder="Masalan: alisher_uz"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="primary" size="md" loading={connecting}>
              Ulash
            </Button>
          </form>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card padding="lg">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-white/[0.08] mb-2">
          <Bell className="w-5 h-5 text-emerald-500" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Bildirishnomalar sozlamalari
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {[
            {
              key: 'dailyReport' as const,
              title: 'Kunlik yakuniy hisobot',
              desc: 'Har kuni soat 21:00 da kun davomidagi xarajatlar va daromadlar xulosasi',
            },
            {
              key: 'weeklyReport' as const,
              title: 'Haftalik moliyaviy tahlil',
              desc: 'Har yakshanba kechqurun haftalik sarf va tejamkorlik tahlili',
            },
            {
              key: 'budgetAlerts' as const,
              title: 'Budjet chegarasidan oshish xavfi',
              desc: 'Kategoriya budjeti 80% va 100% ga yetganda ogohlantirish',
            },
            {
              key: 'subscriptionAlerts' as const,
              title: 'Yaqinlashayotgan obuna toʻlovlari',
              desc: 'Obuna muddati tugashiga 3 kun va 1 kun qolganda eslatma',
            },
          ].map((item) => {
            const isChecked = connection?.preferences[item.key] ?? false;
            return (
              <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold text-xs text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.desc}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-11 px-1">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleTogglePref(item.key)}
                    aria-label={item.title}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 dark:bg-white/[0.14] peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-1/2 after:-translate-y-1/2 after:left-[6px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:bg-emerald-500" />
                </label>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
