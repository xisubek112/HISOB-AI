/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  Shield,
  Bell,
  Palette,
  DollarSign,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Crown,
  Sparkles,
  ArrowRight,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';

import { CurrencyCode } from '../../types/finance.ts';

interface SettingsViewProps {
  onOpenPremiumModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenPremiumModal }) => {
  const { user, updateUser, theme, toggleTheme } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [currency, setCurrency] = useState<CurrencyCode>(user?.currency || 'UZS');
  const [monthlyBudget, setMonthlyBudget] = useState(
    user ? new Intl.NumberFormat('uz-UZ').format(user.monthlyBudget).replace(/,/g, ' ') : ''
  );

  // Notification toggles
  const [budgetAlerts, setBudgetAlerts] = useState(user?.notificationPrefs?.budgetAlerts ?? true);
  const [debtReminders, setDebtReminders] = useState(user?.notificationPrefs?.debtReminders ?? true);
  const [goalMilestones, setGoalMilestones] = useState(user?.notificationPrefs?.goalMilestones ?? true);
  const [weeklySummary, setWeeklySummary] = useState(user?.notificationPrefs?.weeklySummary ?? true);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [passNotice, setPassNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    setSavingProfile(true);

    try {
      const budgetNum = parseInt(monthlyBudget.replace(/\D/g, ''), 10) || 5000000;
      await updateUser({
        fullName: fullName.trim(),
        currency,
        monthlyBudget: budgetNum,
        notificationPrefs: {
          budgetAlerts,
          debtReminders,
          goalMilestones,
          weeklySummary,
        },
      });
      setProfileNotice({ type: 'success', msg: 'Sozlamalar muvaffaqiyatli saqlandi!' });
    } catch (err: any) {
      setProfileNotice({ type: 'error', msg: err.message || 'Xatolik yuz berdi' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassNotice(null);

    if (newPassword.length < 6) {
      setPassNotice({ type: 'error', msg: 'Yangi parol kamida 6 belgidan iborat boʻlishi kerak' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassNotice({ type: 'error', msg: 'Yangi parollar mos kelmadi' });
      return;
    }

    setChangingPass(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPassNotice({ type: 'success', msg: 'Parol muvaffaqiyatli yangilandi!' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassNotice({ type: 'error', msg: err.message || 'Parolni oʻzgartirishda xatolik' });
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* HISOBOT AI Premium Subscription Card */}
      <div className={`p-6 rounded-2xl border transition-all relative overflow-hidden shadow-xs ${
        user?.isPremium
          ? 'bg-gradient-to-br from-amber-500/10 via-yellow-500/10 to-amber-600/15 border-amber-400/50 dark:bg-amber-950/20'
          : 'bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/15 border-blue-500/30 dark:bg-slate-900'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
              user?.isPremium
                ? 'bg-gradient-to-tr from-amber-400 to-yellow-500 text-amber-950'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
            }`}>
              <Crown className="w-6 h-6 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  HISOBOT AI {user?.isPremium ? (user.premiumPlan?.toUpperCase() || 'PRO') : 'Standart (Bepul)'}
                </h2>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  user?.isPremium
                    ? 'bg-amber-400 text-amber-950'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}>
                  {user?.isPremium ? 'Faol Obuna' : 'Asosiy Reja'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {user?.isPremium
                  ? `Amal qilish muddati: ${user.premiumExpiresAt ? new Date(user.premiumExpiresAt).toLocaleDateString('uz-UZ') : 'Cheksiz'} gacha`
                  : 'Barcha AI funksiyalari, chek skaner va cheksiz hamyonlarni ochish uchun Pro ga oʻting'}
              </p>
            </div>
          </div>

          {onOpenPremiumModal && (
            <button
              onClick={onOpenPremiumModal}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 shadow-sm ${
                user?.isPremium
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/25'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{user?.isPremium ? 'Tarifni boshqarish' : 'Premiumga oʻtish'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Benefits breakdown */}
        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>AI Brain & Ovozli kiritish</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Fiskal Chek Skaneri (OCR)</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Telegram Bot & 3 oylik Prognoz</span>
          </div>
        </div>
      </div>

      {/* Profile & Main Preferences Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Shaxsiy profil va parametrlar
          </h2>
        </div>

        {profileNotice && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              profileNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
            }`}
          >
            {profileNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{profileNotice.msg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <img
              src={user?.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
              alt={user?.fullName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-xs"
            />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {user?.fullName || 'Foydalanuvchi'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mt-1 inline-block">
                HISOBOT AI Premium hisobi
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                F.I.SH (Ism va familiya)
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Asosiy valyuta
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="UZS">Oʻzbek soʻmi (UZS)</option>
                <option value="USD">AQSH dollari (USD)</option>
                <option value="EUR">Yevro (EUR)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Oylik umumiy reja budjeti (soʻmda)
              </label>
              <input
                type="text"
                value={monthlyBudget}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setMonthlyBudget(
                    val ? new Intl.NumberFormat('uz-UZ').format(parseInt(val, 10)).replace(/,/g, ' ') : ''
                  );
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tizim interfeys tili
              </label>
              <input
                type="text"
                disabled
                value="Oʻzbek tili (Lotin alifbosi)"
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500"
              />
            </div>
          </div>

          {/* Theme Mode Switch */}
          <div className="pt-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
              Interfeys mavzusi (Light / Dark)
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  if (theme === 'dark') toggleTheme();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Yorugʻ rejim (Light)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (theme === 'light') toggleTheme();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-slate-800 text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <Moon className="w-4 h-4 text-blue-400" />
                <span>Tungi rejim (Dark)</span>
              </button>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-slate-500" />
              <span>Bildirishnoma sozlamalari</span>
            </h3>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Budjet limitlaridan ogohlantirish
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Toifalar xarajati belgilangan chegara (80%) ga yetganda xabar berish
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={budgetAlerts}
                  onChange={(e) => setBudgetAlerts(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Qarz toʻlov muddatlari eslatmasi
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Qarz qaytarish vaqti yaqinlashganda eslatma chiqarish
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={debtReminders}
                  onChange={(e) => setDebtReminders(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Jamgʻarma maqsadlari yutuqlari
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Maqsadga erishilganda yoki muhim bosqich yakunlanganda xabar berish
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={goalMilestones}
                  onChange={(e) => setGoalMilestones(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Haftalik va oylik moliyaviy sarhisob
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Oy yakunida umumiy daromad va xarajat xulosasini taqdim etish
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={weeklySummary}
                  onChange={(e) => setWeeklySummary(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                />
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {savingProfile ? 'Saqlanmoqda...' : 'Profilni saqlash'}
            </button>
          </div>
        </form>
      </div>

      {/* Security & Password Change */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Xavfsizlik va parolni oʻzgartirish
          </h2>
        </div>

        {passNotice && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              passNotice.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
            }`}
          >
            {passNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{passNotice.msg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Amaldagi joriy parol
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Yangi parol
            </label>
            <input
              type="password"
              required
              placeholder="Kamida 6 belgi"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Yangi parolni tasdiqlang
            </label>
            <input
              type="password"
              required
              placeholder="Yangi parolni qayta kiriting"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changingPass}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              {changingPass ? 'Yangilanmoqda...' : 'Parolni yangilash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
