/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  Copy,
  Check,
  Bell,
  ShieldCheck,
  ExternalLink,
  MessageSquare,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { TelegramConnection } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const TelegramView: React.FC = () => {
  const { user } = useAuth();
  const [connection, setConnection] = useState<TelegramConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const loadData = async () => {
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
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleCopyCode = () => {
    if (!connection) return;
    navigator.clipboard.writeText(connection.connectCode);
    setCopiedCode(true);
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
    } catch (e) {
      console.error('Failed to update preferences:', e);
    }
  };

  const handleTestSend = async () => {
    try {
      setTestSending(true);
      setTestSuccess(false);
      await api.testSendTelegram();
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 4000);
    } catch (e: any) {
      alert(e.message || 'Sinov xabari yuborilmadi');
    } finally {
      setTestSending(false);
    }
  };

  const handleConnectSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput) return;
    try {
      const res = await api.connectTelegram(usernameInput);
      setConnection(res.connection);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Telegram bot ulanishini bekor qilmoqchimisiz?')) {
      const res = await api.disconnectTelegram();
      setConnection(res.connection);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Telegram Bot Integratsiyasi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Xarajatlar, obunalar va kunlik hisobotlarni Telegram orqali qabul qiling va boshqaring
          </p>
        </div>

        {connection?.isConnected && (
          <button
            onClick={handleTestSend}
            disabled={testSending}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition-colors shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testSending ? 'Yuborilmoqda...' : 'Sinov xabari yuborish'}</span>
          </button>
        )}
      </div>

      {testSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sinov xabari Telegram orqali muvaffaqiyatli joʻnatildi!</span>
        </div>
      )}

      {/* Main Connection Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
              Rasmiy Bot
            </span>
            <span className="text-xs text-blue-100 font-semibold font-mono">
              @HisobotAIBot
            </span>
          </div>

          <h3 className="text-2xl font-extrabold tracking-tight">
            Telegram orqali moliyangiz doim qoʻl ostida
          </h3>
          <p className="text-xs text-blue-100 mt-1 max-w-lg leading-relaxed">
            Har safar xarid qilganingizda chek rasmini botga yuborishingiz yoki ovozli xabar qoldirishingiz mumkin.
          </p>
        </div>

        {connection?.isConnected ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-xs shrink-0 min-w-[240px]">
            <div className="flex items-center gap-2 text-emerald-300 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ulangan: @{connection.telegramUsername}</span>
            </div>
            <div className="text-[11px] text-blue-100 mb-3">
              Hisobingiz muvaffaqiyatli bogʻlangan
            </div>
            <button
              onClick={handleDisconnect}
              className="w-full py-1.5 px-3 bg-white/20 hover:bg-rose-500/80 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Ulanishni uzish
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-xs shrink-0 min-w-[260px]">
            <span className="text-[11px] text-blue-200 block mb-1">Bogʻlanish kodi:</span>
            <div className="flex items-center justify-between bg-black/20 p-2 rounded-xl mb-2">
              <code className="text-base font-mono font-extrabold tracking-wider">
                {connection?.connectCode || 'HISOBOT-2026'}
              </code>
              <button
                onClick={handleCopyCode}
                className="p-1 rounded text-blue-200 hover:text-white"
                title="Nusxalash"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="text-[10px] text-blue-200">
              Botga kirib <code>/start {connection?.connectCode}</code> buyrugʻini yuboring.
            </div>
          </div>
        )}
      </div>

      {/* Manual fast link for demo */}
      {!connection?.isConnected && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-2">
            Tezkor simulyatsiya: Telegram profilingizni kiriting
          </h3>
          <form onSubmit={handleConnectSimulate} className="flex gap-2 max-w-md">
            <input
              type="text"
              required
              placeholder="Masalan: alisher_uz"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
            >
              Ulash
            </button>
          </form>
        </div>
      )}

      {/* Notification Preferences */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <Bell className="w-5 h-5 text-blue-600" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
            Bildirishnomalar Sozlamalari
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {[
            {
              key: 'dailyReport' as const,
              title: 'Kunlik yakuniy hisobot',
              desc: 'Har kuni soat 21:00 da kun davomidagi xarajatlar va daromadlar umumiy xulosasi',
            },
            {
              key: 'weeklyReport' as const,
              title: 'Haftalik moliyaviy tahlil',
              desc: 'Har yakshanba kechqurun hafta davomida tejab qolingan mablagʻ va toifalar kesimi',
            },
            {
              key: 'budgetAlerts' as const,
              title: 'Budjet chegarasidan oshish xavfi',
              desc: 'Kategoriya budjeti 80% va 100% ga yetganda darhol ogohlantirish xabari',
            },
            {
              key: 'subscriptionAlerts' as const,
              title: 'Yaqinlashayotgan obuna toʻlovlari',
              desc: 'Obuna muddati tugashiga 3 kun va 1 kun qolganda eslatma yuborish',
            },
          ].map((item) => {
            const isChecked = connection?.preferences[item.key] ?? false;
            return (
              <div key={item.key} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {item.desc}
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleTogglePref(item.key)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600" />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
