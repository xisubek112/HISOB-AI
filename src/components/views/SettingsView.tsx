/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Bell,
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
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  useToast,
} from '../../design-system/index.ts';

interface SettingsViewProps {
  onOpenPremiumModal?: () => void;
}

const formatUzNumber = (num: number) =>
  new Intl.NumberFormat('uz-UZ').format(num).replace(/,/g, ' ');

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenPremiumModal }) => {
  const { user, updateUser, theme, toggleTheme } = useAuth();
  const toast = useToast();
  const [avatarError, setAvatarError] = useState(false);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [currency, setCurrency] = useState<CurrencyCode>(user?.currency || 'UZS');
  const [monthlyBudget, setMonthlyBudget] = useState(
    user ? formatUzNumber(user.monthlyBudget) : ''
  );

  const [budgetAlerts, setBudgetAlerts] = useState(user?.notificationPrefs?.budgetAlerts ?? true);
  const [debtReminders, setDebtReminders] = useState(user?.notificationPrefs?.debtReminders ?? true);
  const [goalMilestones, setGoalMilestones] = useState(user?.notificationPrefs?.goalMilestones ?? true);
  const [weeklySummary, setWeeklySummary] = useState(user?.notificationPrefs?.weeklySummary ?? true);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [passNotice, setPassNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setCurrency(user.currency || 'UZS');
    setMonthlyBudget(user.monthlyBudget ? formatUzNumber(user.monthlyBudget) : '');
    setBudgetAlerts(user.notificationPrefs?.budgetAlerts ?? true);
    setDebtReminders(user.notificationPrefs?.debtReminders ?? true);
    setGoalMilestones(user.notificationPrefs?.goalMilestones ?? true);
    setWeeklySummary(user.notificationPrefs?.weeklySummary ?? true);
  }, [user]);

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
      toast.success('Profil sozlamalari saqlandi');
    } catch (err: any) {
      const msg = err?.message || 'Xatolik yuz berdi';
      setProfileNotice({ type: 'error', msg });
      toast.error(msg);
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
      toast.success('Parol yangilandi');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPassNotice({ type: 'error', msg: err?.message || 'Parolni oʻzgartirishda xatolik' });
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* HISOBOT AI Premium Subscription Card — Dark Emerald/Teal & Amber */}
      <section
        className={[
          'p-5 sm:p-6 rounded-2xl border relative overflow-hidden text-white',
          user?.isPremium
            ? 'bg-gradient-to-br from-[#081220] via-[#1C1A10] to-[#2B200B] border-amber-500/35'
            : 'bg-gradient-to-br from-[#081220] via-[#0A2524] to-[#0D3C36] border-emerald-500/30',
        ].join(' ')}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={[
                'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
                user?.isPremium
                  ? 'bg-amber-400 text-slate-950 shadow-[0_8px_22px_rgba(245,158,11,0.30)]'
                  : 'bg-emerald-500 text-slate-950 shadow-[0_8px_22px_rgba(16,185,129,0.28)]',
              ].join(' ')}
            >
              <Crown className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-extrabold text-white">
                  HISOBOT AI {user?.isPremium ? user.premiumPlan?.toUpperCase() || 'PRO' : 'Standart'}
                </h2>
                <Badge tone={user?.isPremium ? 'amber' : 'emerald'}>
                  {user?.isPremium ? 'Faol obuna' : 'Asosiy reja'}
                </Badge>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {user?.isPremium
                  ? `Amal qilish muddati: ${
                      user.premiumExpiresAt
                        ? new Date(user.premiumExpiresAt).toLocaleDateString('uz-UZ')
                        : 'Cheksiz'
                    }`
                  : 'Barcha AI vositalari, chek skaneri va cheksiz hamyonlarni ochish uchun Pro ga oʻting'}
              </p>
            </div>
          </div>

          {onOpenPremiumModal && (
            <Button
              variant={user?.isPremium ? 'outline' : 'premium'}
              size="md"
              leadingIcon={<Sparkles className="w-4 h-4" />}
              trailingIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={onOpenPremiumModal}
              className={user?.isPremium ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : ''}
            >
              {user?.isPremium ? 'Tarifni boshqarish' : 'Premiumga oʻtish'}
            </Button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/[0.10] grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>AI Yordamchi & Ovozli kiritish</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Chek Skaneri (OCR)</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Telegram Bot & 3 oylik Prognoz</span>
          </div>
        </div>
      </section>

      {/* Profile & Preferences Form */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
          <User className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Shaxsiy profil va parametrlar
          </h2>
        </div>

        {profileNotice && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              profileNotice.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
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
          <div className="flex items-center gap-4 mb-2">
            {!avatarError ? (
              <img
                src={user?.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                alt={user?.fullName || 'Profil'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/30 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-extrabold text-xl shrink-0">
                {(user?.fullName || 'H').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {user?.fullName || 'Foydalanuvchi'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 inline-block">
                HISOBOT AI hisobi
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="F.I.SH (Ism va familiya)"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Select
              label="Asosiy valyuta"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              <option value="UZS">Oʻzbek soʻmi (UZS)</option>
              <option value="USD">AQSH dollari (USD)</option>
              <option value="EUR">Yevro (EUR)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Oylik umumiy reja budjeti (soʻmda)"
              type="text"
              inputMode="numeric"
              monospace
              trailingAddon="soʻm"
              value={monthlyBudget}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setMonthlyBudget(val ? formatUzNumber(parseInt(val, 10)) : '');
              }}
            />

            <Input
              label="Tizim interfeys tili"
              type="text"
              disabled
              value="Oʻzbek tili (Lotin alifbosi)"
            />
          </div>

          {/* Theme Mode Switch */}
          <div className="pt-2">
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Interfeys mavzusi (Yorugʻ / Qorongʻi)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (theme === 'dark') toggleTheme();
                }}
                className={[
                  'min-h-11 py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer',
                  theme === 'light'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700'
                    : 'border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-slate-400',
                ].join(' ')}
              >
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Yorugʻ rejim</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (theme === 'light') toggleTheme();
                }}
                className={[
                  'min-h-11 py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer',
                  theme === 'dark'
                    ? 'border-emerald-500 bg-[#0D1927] text-emerald-300'
                    : 'border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-slate-400',
                ].join(' ')}
              >
                <Moon className="w-4 h-4 text-cyan-400" />
                <span>Qorongʻi rejim</span>
              </button>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08]">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-emerald-500" />
              <span>Bildirishnoma sozlamalari</span>
            </h3>
            <div className="space-y-2.5">
              {[
                {
                  label: 'Budjet limitlaridan ogohlantirish',
                  desc: 'Toifalar xarajati belgilangan chegara (80%) ga yetganda xabar berish',
                  checked: budgetAlerts,
                  onChange: setBudgetAlerts,
                },
                {
                  label: 'Qarz toʻlov muddatlari eslatmasi',
                  desc: 'Qarz qaytarish vaqti yaqinlashganda eslatma chiqarish',
                  checked: debtReminders,
                  onChange: setDebtReminders,
                },
                {
                  label: 'Jamgʻarma maqsadlari yutuqlari',
                  desc: 'Maqsadga erishilganda yoki muhim bosqich yakunlanganda xabar berish',
                  checked: goalMilestones,
                  onChange: setGoalMilestones,
                },
                {
                  label: 'Haftalik va oylik moliyaviy sarhisob',
                  desc: 'Oy yakunida umumiy daromad va xarajat xulosasini taqdim etish',
                  checked: weeklySummary,
                  onChange: setWeeklySummary,
                },
              ].map((item, idx) => (
                <label
                  key={idx}
                  className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 dark:bg-[#0D1927] border border-slate-200/60 dark:border-white/[0.06] rounded-xl cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {item.desc}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.onChange(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-500 shrink-0 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" size="md" loading={savingProfile}>
              {savingProfile ? 'Saqlanmoqda...' : 'Profilni saqlash'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Security & Password Change */}
      <Card padding="lg">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
          <Shield className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Xavfsizlik va parolni oʻzgartirish
          </h2>
        </div>

        {passNotice && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 border ${
              passNotice.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25'
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
          <Input
            label="Amaldagi joriy parol"
            type="password"
            required
            placeholder="••••••••"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />

          <Input
            label="Yangi parol"
            type="password"
            required
            placeholder="Kamida 6 belgi"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <Input
            label="Yangi parolni tasdiqlang"
            type="password"
            required
            placeholder="Yangi parolni qayta kiriting"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="pt-1">
            <Button type="submit" variant="secondary" size="md" loading={changingPass}>
              {changingPass ? 'Yangilanmoqda...' : 'Parolni yangilash'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
