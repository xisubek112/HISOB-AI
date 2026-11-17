/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Shield,
  ShieldCheck,
  Bell,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Crown,
  Sparkles,
  ArrowRight,
  Check,
  Lock,
  Fingerprint,
  KeyRound,
  Timer,
  LogOut,
  Eye,
  EyeOff,
  Wallet,
  Globe,
  Camera,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { CurrencyCode } from '../../types/finance.ts';
import { DEFAULT_AVATAR_URL, isDefaultAvatar, resolveAvatarUrl } from '../../utils/assets.ts';
import {
  Badge,
  Button,
  Card,
  Input,
  Modal,
  Select,
  useToast,
} from '../../design-system/index.ts';
import { PrivacyPermissionsSection } from '../settings/PrivacyPermissionsSection.tsx';
import { PermissionPromptModal } from '../modals/PermissionPromptModal.tsx';
import { PinSetupModal, PinSetupMode } from '../security/PinSetupModal.tsx';
import {
  AppPermissionStatus,
  checkPermission,
  getPrivacyControls,
  markNotificationPromptDismissed,
  requestPermission,
  scheduleLocalReminder,
  setPrivacyControl,
  wasNotificationPromptDismissed,
} from '../../services/permissions.ts';
import {
  AppLockConfig,
  AutoLockSeconds,
  BiometricCapability,
  checkBiometricCapability,
  getAppLockConfig,
  lockAppNow,
  setAutoLockTimeout,
  setBiometricUnlockEnabled,
} from '../../services/appLock.ts';

interface SettingsViewProps {
  onOpenPremiumModal?: () => void;
  onRequireAuth?: () => void;
  onOpenAdminPanel?: () => void;
}

type SettingsTab = 'general' | 'notifications' | 'security' | 'privacy';

const formatUzNumber = (num: number) =>
  new Intl.NumberFormat('uz-UZ').format(num).replace(/,/g, ' ');

const AUTO_LOCK_OPTIONS: { label: string; value: AutoLockSeconds }[] = [
  { label: 'Darhol', value: 0 },
  { label: '30 soniya', value: 30 },
  { label: '1 daqiqa', value: 60 },
  { label: '5 daqiqa', value: 300 },
];

const BUDGET_PRESETS: { label: string; value: number }[] = [
  { label: '3 mln', value: 3_000_000 },
  { label: '5 mln', value: 5_000_000 },
  { label: '10 mln', value: 10_000_000 },
  { label: '20 mln', value: 20_000_000 },
];

const compressAvatarImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Faqat rasm faylini tanlang (JPG, PNG, WEBP)'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Rasm hajmi 12 MB dan oshmasligi kerak'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Rasmni qayta ishlab boʻlmadi'));
          return;
        }

        const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const sx = ((img.naturalWidth || img.width) - minSide) / 2;
        const sy = ((img.naturalHeight || img.height) - minSide) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        if (dataUrl.length > 450_000) {
          reject(new Error('Rasm hajmi juda katta. Boshqa rasm tanlang.'));
          return;
        }
        resolve(dataUrl);
      } catch {
        reject(new Error('Rasmni siqishda xatolik yuz berdi'));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Rasm faylini oʻqib boʻlmadi'));
    };

    img.src = objectUrl;
  });

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenPremiumModal,
  onRequireAuth,
  onOpenAdminPanel,
}) => {
  const { user, updateUser, logout, logoutAll, theme, toggleTheme } = useAuth();
  const toast = useToast();
  const [avatarError, setAvatarError] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

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
  const [showPasswords, setShowPasswords] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifKey, setSavingNotifKey] = useState<string | null>(null);
  const [changingPass, setChangingPass] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [passNotice, setPassNotice] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [notifPromptOpen, setNotifPromptOpen] = useState(false);
  const [notifStatus, setNotifStatus] = useState<AppPermissionStatus>('prompt');

  // App Lock (PIN & Biometrics) state
  const [appLockConfig, setAppLockConfig] = useState<AppLockConfig | null>(() =>
    user?.id ? getAppLockConfig(user.id) : null
  );
  const [biometricCap, setBiometricCap] = useState<BiometricCapability | null>(null);
  const [biometricToggling, setBiometricToggling] = useState(false);
  const [pinModalState, setPinModalState] = useState<{ open: boolean; mode: PinSetupMode }>({
    open: false,
    mode: 'create',
  });

  const reloadAppLock = () => {
    if (!user?.id) return;
    setAppLockConfig(getAppLockConfig(user.id));
  };

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setCurrency(user.currency || 'UZS');
    setMonthlyBudget(user.monthlyBudget ? formatUzNumber(user.monthlyBudget) : '');
    setBudgetAlerts(user.notificationPrefs?.budgetAlerts ?? true);
    setDebtReminders(user.notificationPrefs?.debtReminders ?? true);
    setGoalMilestones(user.notificationPrefs?.goalMilestones ?? true);
    setWeeklySummary(user.notificationPrefs?.weeklySummary ?? true);
    setAppLockConfig(getAppLockConfig(user.id));
  }, [user]);

  useEffect(() => {
    let mounted = true;
    checkBiometricCapability().then((cap) => {
      if (mounted) setBiometricCap(cap);
    });
    const onLockChange = () => reloadAppLock();
    window.addEventListener('hisobot:applock-changed', onLockChange);
    return () => {
      mounted = false;
      window.removeEventListener('hisobot:applock-changed', onLockChange);
    };
  }, [user?.id]);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarUrl]);

  const notifyLockUpdated = () => {
    reloadAppLock();
    window.dispatchEvent(new CustomEvent('hisobot:applock-changed'));
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setAvatarSaving(true);
    try {
      const dataUrl = await compressAvatarImage(file);
      await updateUser({ avatarUrl: dataUrl });
      setAvatarError(false);
      setAvatarModalOpen(false);
      toast.success('Profil rasmi yangilandi');
    } catch (err: any) {
      toast.error(err?.message || 'Profil rasmini yuklashda xatolik');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleResetAvatar = async () => {
    setAvatarSaving(true);
    try {
      await updateUser({ avatarUrl: '' });
      setAvatarError(false);
      setAvatarModalOpen(false);
      toast.success('Standart rasm qaytarildi');
    } catch (err: any) {
      toast.error(err?.message || 'Rasmni qaytarishda xatolik');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (!user?.id || !appLockConfig) return;
    if (!appLockConfig.pinEnabled) {
      toast.info('Avval PIN-kod himoyasini yoqing');
      setPinModalState({ open: true, mode: 'create' });
      return;
    }

    setBiometricToggling(true);
    try {
      const next = !appLockConfig.biometricEnabled;
      const res = await setBiometricUnlockEnabled(user.id, next);
      setAppLockConfig(res.config);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(next ? 'Biometrik kirish yoqildi' : 'Biometrik kirish oʻchirildi');
        notifyLockUpdated();
      }
    } finally {
      setBiometricToggling(false);
    }
  };

  const handleAutoLockChange = (seconds: AutoLockSeconds) => {
    if (!user?.id) return;
    const updated = setAutoLockTimeout(user.id, seconds);
    setAppLockConfig(updated);
    notifyLockUpdated();
    const label = AUTO_LOCK_OPTIONS.find((o) => o.value === seconds)?.label || '';
    toast.success(`Avtomatik bloklash: ${label}`);
  };

  const handleLogoutCurrent = async () => {
    const confirmed = await toast.confirm({
      title: 'Hisobdan chiqish',
      message: 'Joriy qurilmadagi HISOBOT AI hisobingizdan chiqmoqchimisiz?',
      confirmLabel: 'Chiqish',
      danger: true,
    });
    if (!confirmed) return;

    setLoggingOut(true);
    try {
      await logout();
      toast.success('Hisobdan chiqildi');
      onRequireAuth?.();
    } catch (err: any) {
      toast.error(err?.message || 'Chiqishda xatolik yuz berdi');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogoutAllDevices = async () => {
    const confirmed = await toast.confirm({
      title: 'Barcha qurilmalardan chiqish',
      message:
        'Barcha faol qurilma va brauzerlardagi sessiyalar yopiladi. Davom etish uchun qayta kirish talab qilinadi.',
      confirmLabel: 'Barchasidan chiqish',
      danger: true,
    });
    if (!confirmed) return;

    setLoggingOutAll(true);
    try {
      await logoutAll();
      toast.success('Barcha qurilmalardan muvaffaqiyatli chiqildi');
      onRequireAuth?.();
    } catch (err: any) {
      toast.error(err?.message || 'Chiqishda xatolik yuz berdi');
    } finally {
      setLoggingOutAll(false);
    }
  };

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

  const handleToggleNotificationPref = async (
    key: 'budgetAlerts' | 'debtReminders' | 'goalMilestones' | 'weeklySummary',
    nextVal: boolean
  ) => {
    const nextPrefs = {
      budgetAlerts,
      debtReminders,
      goalMilestones,
      weeklySummary,
      [key]: nextVal,
    };

    if (key === 'budgetAlerts') setBudgetAlerts(nextVal);
    if (key === 'debtReminders') setDebtReminders(nextVal);
    if (key === 'goalMilestones') setGoalMilestones(nextVal);
    if (key === 'weeklySummary') setWeeklySummary(nextVal);

    setSavingNotifKey(key);
    try {
      await updateUser({ notificationPrefs: nextPrefs });
      toast.success(nextVal ? 'Bildirishnoma yoqildi' : 'Bildirishnoma oʻchirildi');
    } catch (err: any) {
      // Revert on failure
      if (key === 'budgetAlerts') setBudgetAlerts(!nextVal);
      if (key === 'debtReminders') setDebtReminders(!nextVal);
      if (key === 'goalMilestones') setGoalMilestones(!nextVal);
      if (key === 'weeklySummary') setWeeklySummary(!nextVal);
      toast.error(err?.message || 'Sozlamani saqlab boʻlmadi');
      return;
    } finally {
      setSavingNotifKey(null);
    }

    if (nextVal && !wasNotificationPromptDismissed()) {
      const summary = await checkPermission('notifications');
      if (summary.status !== 'granted' && summary.status !== 'unavailable') {
        setNotifStatus(summary.status);
        setNotifPromptOpen(true);
      }
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

  const numericBudget = parseInt(monthlyBudget.replace(/\D/g, ''), 10) || 0;
  const hasUnsavedGeneralChanges =
    Boolean(user) &&
    (fullName.trim() !== (user?.fullName || '').trim() ||
      currency !== (user?.currency || 'UZS') ||
      numericBudget !== (user?.monthlyBudget || 0));

  const enabledNotifsCount = [budgetAlerts, debtReminders, goalMilestones, weeklySummary].filter(Boolean).length;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'general', label: 'Profil', icon: <User className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: 'Xabarlar',
      icon: <Bell className="w-4 h-4" />,
      badge: `${enabledNotifsCount}/4`,
    },
    {
      id: 'security',
      label: 'Xavfsizlik',
      icon: <Shield className="w-4 h-4" />,
      badge: appLockConfig?.pinEnabled ? 'PIN' : undefined,
    },
    { id: 'privacy', label: 'Ruxsatlar', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-4xl space-y-4 sm:space-y-5 pb-4 hai-fade-up">
      {/* Translucent Emerald Glass Profile Hero Card */}
      <section
        aria-label="Foydalanuvchi profili"
        className={[
          'relative overflow-hidden rounded-[22px] p-5 sm:p-6',
          'text-emerald-950 dark:text-white',
          'bg-gradient-to-br from-emerald-400/24 via-emerald-500/14 to-teal-400/20',
          'dark:from-emerald-500/22 dark:via-emerald-700/16 dark:to-teal-900/24',
          'backdrop-blur-xl',
          'border border-emerald-500/30 dark:border-emerald-400/25',
          'shadow-[0_14px_38px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(255,255,255,0.45)]',
          'dark:shadow-[0_16px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.12)]',
        ].join(' ')}
      >
        {/* Specular highlight & ambient emerald glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent dark:from-white/[0.07]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-14 h-52 w-52 rounded-full bg-emerald-400/25 dark:bg-emerald-400/15 blur-2xl"
        />

        <div className="relative space-y-5">
          {/* Top Identity + Plan / Sign-Out Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                aria-label="Profil rasmini almashtirish"
                className="group relative shrink-0 rounded-2xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950"
              >
                {!avatarError ? (
                  <img
                    key={user?.avatarUrl || 'default-hero-avatar'}
                    src={resolveAvatarUrl(user?.avatarUrl)}
                    alt={user?.fullName || 'Profil'}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.src !== DEFAULT_AVATAR_URL) {
                        e.currentTarget.src = DEFAULT_AVATAR_URL;
                      } else {
                        setAvatarError(true);
                      }
                    }}
                    className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl object-cover border-2 border-emerald-500/45 shadow-[0_8px_20px_rgba(16,185,129,0.20)] transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-2 border-emerald-500/40 flex items-center justify-center font-black text-2xl">
                    {(user?.fullName || 'H').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center"
                >
                  <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                </span>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl flex items-center justify-center border-2 border-white dark:border-[#08241C] shadow-sm bg-emerald-500 text-[#032018] group-hover:bg-emerald-400 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </span>
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black tracking-tight text-emerald-950 dark:text-white truncate">
                    {user?.fullName || 'Foydalanuvchi'}
                  </h2>
                  <Badge tone={user?.isPremium ? 'amber' : 'emerald'} size="sm">
                    {user?.isPremium ? `HISOBOT AI ${user.premiumPlan?.toUpperCase() || 'PRO'}` : 'Standart'}
                  </Badge>
                </div>
                <p className="text-xs text-emerald-950/75 dark:text-emerald-50/80 truncate mt-0.5">
                  {user?.email}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAvatarModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/55 hover:bg-white/80 dark:bg-white/10 dark:hover:bg-white/15 border border-emerald-600/20 dark:border-white/15 text-[11px] font-bold text-emerald-950 dark:text-emerald-100 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />
                    <span>Rasmni almashtirish</span>
                  </button>
                  {user?.isPremium && user.premiumExpiresAt && (
                    <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                      Obuna: {new Date(user.premiumExpiresAt).toLocaleDateString('uz-UZ')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {user?.isSuperAdmin === true && onOpenAdminPanel && (
                <button
                  type="button"
                  onClick={onOpenAdminPanel}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-900 dark:text-emerald-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-300" />
                  <span>Admin Panel</span>
                </button>
              )}

              {onOpenPremiumModal && (
                <button
                  type="button"
                  onClick={onOpenPremiumModal}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 dark:bg-emerald-400 dark:hover:bg-emerald-300 text-[#042118] text-xs font-bold shadow-[0_6px_18px_rgba(16,185,129,0.26)] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{user?.isPremium ? 'Tarif' : 'Premiumga oʻtish'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={loggingOut}
                onClick={handleLogoutCurrent}
                className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-600/25 dark:border-white/15 bg-white/55 hover:bg-rose-500/15 hover:border-rose-500/35 hover:text-rose-700 dark:bg-white/10 dark:hover:bg-rose-500/20 dark:hover:text-rose-200 text-emerald-950 dark:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{loggingOut ? 'Chiqilmoqda...' : 'Chiqish'}</span>
              </button>
            </div>
          </div>

          {/* 3 Quick Overview Chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/25 dark:border-emerald-300/15 bg-white/50 dark:bg-black/20 backdrop-blur-md px-3.5 py-2.5 text-left hover:bg-white/70 dark:hover:bg-black/30 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-emerald-900/70 dark:text-emerald-100/70 block">
                  Asosiy valyuta
                </span>
                <span className="text-xs font-bold text-emerald-950 dark:text-white tabular-nums">
                  {currency} ({currency === 'UZS' ? 'soʻm' : currency === 'USD' ? '$' : '€'})
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/25 dark:border-emerald-300/15 bg-white/50 dark:bg-black/20 backdrop-blur-md px-3.5 py-2.5 text-left hover:bg-white/70 dark:hover:bg-black/30 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-emerald-900/70 dark:text-emerald-100/70 block">
                  Oylik reja budjeti
                </span>
                <span className="text-xs font-bold text-emerald-950 dark:text-white tabular-nums truncate block">
                  {monthlyBudget || '5 000 000'} soʻm
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="flex items-center gap-3 rounded-xl border border-emerald-500/25 dark:border-emerald-300/15 bg-white/50 dark:bg-black/20 backdrop-blur-md px-3.5 py-2.5 text-left hover:bg-white/70 dark:hover:bg-black/30 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-medium text-emerald-900/70 dark:text-emerald-100/70 block">
                  Ilova himoyasi
                </span>
                <span className="text-xs font-bold text-emerald-950 dark:text-white truncate block">
                  {appLockConfig?.pinEnabled
                    ? `PIN faol (${appLockConfig.pinLength} xonali)`
                    : 'PIN oʻrnatilmagan'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Segmented Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Profil boʻlimlari"
        className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-[#0D1927]/90 border border-slate-200/80 dark:border-white/[0.08] shadow-xs"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'min-h-[44px] px-3 py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer',
                isActive
                  ? 'bg-emerald-500 text-[#04231A] shadow-[0_6px_16px_rgba(16,185,129,0.26)]'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={[
                    'px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-none tabular-nums',
                    isActive
                      ? 'bg-[#04231A]/15 text-[#04231A]'
                      : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
                  ].join(' ')}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: PROFIL VA ASOSIY PARAMETRLAR */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Shaxsiy maʼlumotlar va reja
                </h2>
              </div>
              {hasUnsavedGeneralChanges && (
                <Badge tone="amber" size="sm">Saqlanmagan oʻzgarishlar</Badge>
              )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
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
                  {/* Quick 1-tap Budget Presets */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {BUDGET_PRESETS.map((preset) => {
                      const active = numericBudget === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setMonthlyBudget(formatUzNumber(preset.value))}
                          className={[
                            'px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer',
                            active
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 hover:border-emerald-500/40',
                          ].join(' ')}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

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
                  Interfeys mavzusi
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (theme === 'dark') toggleTheme();
                    }}
                    className={[
                      'min-h-12 py-2.5 px-4 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold transition-all cursor-pointer',
                      theme === 'light'
                        ? 'border-emerald-500 bg-emerald-500/12 text-emerald-800 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                        : 'border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:border-emerald-500/35',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Yorugʻ rejim</span>
                    </span>
                    {theme === 'light' && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (theme === 'light') toggleTheme();
                    }}
                    className={[
                      'min-h-12 py-2.5 px-4 rounded-xl border flex items-center justify-between gap-2 text-xs font-bold transition-all cursor-pointer',
                      theme === 'dark'
                        ? 'border-emerald-500 bg-[#0D1927] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                        : 'border-slate-200 dark:border-white/[0.10] text-slate-600 dark:text-slate-400 hover:border-emerald-500/35',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-cyan-400" />
                      <span>Qorongʻi rejim</span>
                    </span>
                    {theme === 'dark' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="md" loading={savingProfile}>
                  {savingProfile ? 'Saqlanmoqda...' : 'Profilni saqlash'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Compact Subscription Features Card */}
          <Card padding="lg" className="border-emerald-500/20 dark:border-emerald-500/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Crown className={`w-4 h-4 ${user?.isPremium ? 'text-amber-500' : 'text-emerald-500'}`} />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {user?.isPremium ? 'PRO imkoniyatlaringiz faol' : 'HISOBOT AI PRO imkoniyatlari'}
                  </h3>
                </div>
                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>AI Yordamchi & Ovozli kiritish</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Chek Skaneri (OCR)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Telegram Bot & Prognoz</span>
                  </div>
                </div>
              </div>

              {onOpenPremiumModal && (
                <Button
                  type="button"
                  variant={user?.isPremium ? 'outline' : 'premium'}
                  size="sm"
                  trailingIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  onClick={onOpenPremiumModal}
                  className="shrink-0"
                >
                  {user?.isPremium ? 'Tarifni boshqarish' : 'Tariflarni koʻrish'}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: BILDIRISHNOMALAR (INSTANT TOGGLE SWITCHES) */}
      {activeTab === 'notifications' && (
        <Card padding="lg">
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-emerald-500" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Bildirishnoma sozlamalari
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Har bir oʻzgartirish darhol avtomatik saqlanadi
                </p>
              </div>
            </div>
            <Badge tone="emerald" size="sm">{enabledNotifsCount} ta faol</Badge>
          </div>

          <div className="space-y-3">
            {[
              {
                key: 'budgetAlerts' as const,
                label: 'Budjet limitlaridan ogohlantirish',
                desc: 'Toifalar xarajati belgilangan chegara (80%) ga yetganda xabar berish',
                checked: budgetAlerts,
              },
              {
                key: 'debtReminders' as const,
                label: 'Qarz toʻlov muddatlari eslatmasi',
                desc: 'Qarz qaytarish vaqti yaqinlashganda eslatma chiqarish',
                checked: debtReminders,
              },
              {
                key: 'goalMilestones' as const,
                label: 'Jamgʻarma maqsadlari yutuqlari',
                desc: 'Maqsadga erishilganda yoki muhim bosqich yakunlanganda xabar berish',
                checked: goalMilestones,
              },
              {
                key: 'weeklySummary' as const,
                label: 'Haftalik va oylik moliyaviy sarhisob',
                desc: 'Oy yakunida umumiy daromad va xarajat xulosasini taqdim etish',
                checked: weeklySummary,
              },
            ].map((item) => {
              const isBusy = savingNotifKey === item.key;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] rounded-2xl"
                >
                  <div className="min-w-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                      {item.label}
                    </span>
                    <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 block">
                      {item.desc}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.checked}
                    aria-label={item.label}
                    disabled={isBusy}
                    onClick={() => handleToggleNotificationPref(item.key, !item.checked)}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-60 ${
                      item.checked
                        ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        item.checked ? 'translate-x-[24px]' : 'translate-x-[4px]'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB 3: XAVFSIZLIK — PIN-KOD, BIOMETRIKA, PAROL VA SESSIYALAR */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    PIN-kod va biometrik himoya
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    4 yoki 6 xonali PIN-kod, Android barmoq izi/yuz hamda avtomatik bloklashni sozlang
                  </p>
                </div>
              </div>
              {appLockConfig?.pinEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leadingIcon={<Lock className="w-3.5 h-3.5" />}
                  onClick={() => {
                    if (!user?.id) return;
                    lockAppNow(user.id);
                    notifyLockUpdated();
                  }}
                >
                  Hozir qulflash
                </Button>
              )}
            </div>

            <div className="space-y-3.5">
              {/* PIN Code Row */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        PIN-kod himoyasi
                      </h3>
                      <Badge tone={appLockConfig?.pinEnabled ? 'emerald' : 'neutral'}>
                        {appLockConfig?.pinEnabled
                          ? `Yoqilgan (${appLockConfig.pinLength} xonali)`
                          : 'Oʻchirilgan'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ketma-ket 5 marta xato kiritilsa ilova vaqtinchalik bloklanadi.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {appLockConfig?.pinEnabled && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPinModalState({ open: true, mode: 'change' })}
                    >
                      Oʻzgartirish
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={appLockConfig?.pinEnabled ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() =>
                      setPinModalState({
                        open: true,
                        mode: appLockConfig?.pinEnabled ? 'disable' : 'create',
                      })
                    }
                  >
                    {appLockConfig?.pinEnabled ? 'Oʻchirish' : 'PIN-kod oʻrnatish'}
                  </Button>
                </div>
              </div>

              {/* Biometric Unlock Row */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/12 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Biometrik kirish ({biometricCap?.label || 'Barmoq izi / Yuz'})
                      </h3>
                      <Badge
                        tone={
                          appLockConfig?.biometricEnabled
                            ? 'emerald'
                            : biometricCap?.available
                            ? 'teal'
                            : 'neutral'
                        }
                      >
                        {appLockConfig?.biometricEnabled
                          ? 'Yoqilgan'
                          : biometricCap?.available
                          ? 'Tayyor'
                          : 'Android ilovada'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {biometricCap?.available
                        ? 'Android BiometricPrompt orqali tezkor ochish. PIN-kod zaxirada qoladi.'
                        : biometricCap?.reason ||
                          'Haqiqiy barmoq izi va yuz tanish faqat Android qurilmada ishlaydi.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <Button
                    type="button"
                    variant={appLockConfig?.biometricEnabled ? 'secondary' : 'outline'}
                    size="sm"
                    loading={biometricToggling}
                    disabled={!biometricCap?.available && !appLockConfig?.biometricEnabled}
                    onClick={handleToggleBiometric}
                  >
                    {appLockConfig?.biometricEnabled ? 'Oʻchirish' : 'Yoqish'}
                  </Button>
                </div>
              </div>

              {/* Auto-Lock Timeout Selector */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Timer className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Avtomatik bloklash vaqti
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ilova fonga oʻtganda qancha vaqtdan keyin PIN soʻralishini tanlang
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AUTO_LOCK_OPTIONS.map((opt) => {
                    const active = (appLockConfig?.autoLockSeconds ?? 0) === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleAutoLockChange(opt.value)}
                        className={[
                          'min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer',
                          active
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]'
                            : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#081220] text-slate-600 dark:text-slate-300 hover:border-emerald-500/40',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Password Change & Active Sessions */}
          <Card padding="lg">
            <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Hisob paroli va sessiyalar
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowPasswords((p) => !p)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-300 cursor-pointer"
              >
                {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showPasswords ? 'Yashirish' : 'Koʻrsatish'}</span>
              </button>
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
                type={showPasswords ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />

              <Input
                label="Yangi parol"
                type={showPasswords ? 'text' : 'password'}
                required
                placeholder="Kamida 6 belgi"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <Input
                label="Yangi parolni tasdiqlang"
                type={showPasswords ? 'text' : 'password'}
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

            {/* Logout All Devices Row */}
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/[0.08]">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-500/[0.05] dark:bg-rose-500/[0.06] border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/12 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Barcha qurilmalardan chiqish
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Boshqa telefon yoki brauzerlardagi barcha faol sessiyalarni darhol bekor qiladi
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={loggingOutAll}
                  leadingIcon={<LogOut className="w-3.5 h-3.5" />}
                  onClick={handleLogoutAllDevices}
                >
                  Barchasidan chiqish
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: MAXFIYLIK VA TIZIM RUXSATLARI */}
      {activeTab === 'privacy' && <PrivacyPermissionsSection />}

      <PermissionPromptModal
        isOpen={notifPromptOpen}
        permissionKey="notifications"
        status={notifStatus}
        featureDisabled={!getPrivacyControls().notifications}
        onEnableInPrivacy={() => {
          setPrivacyControl('notifications', true);
          setNotifPromptOpen(false);
        }}
        onAllow={async () => {
          const res = await requestPermission('notifications');
          setNotifStatus(res.status);
          if (res.status === 'granted') {
            setNotifPromptOpen(false);
            toast.success('Bildirishnomalar yoqildi');
            await scheduleLocalReminder({
              id: 1001,
              title: 'HISOBOT AI eslatmalari faollashdi',
              body: 'Budjet limiti va qarz muddatlari boʻyicha ogohlantirishlar yoqildi.',
            });
          } else {
            markNotificationPromptDismissed();
          }
        }}
        onDismiss={() => {
          markNotificationPromptDismissed();
          setNotifPromptOpen(false);
        }}
      />

      {user?.id && (
        <PinSetupModal
          isOpen={pinModalState.open}
          mode={pinModalState.mode}
          userId={user.id}
          onClose={() => setPinModalState((prev) => ({ ...prev, open: false }))}
          onComplete={(msg) => {
            notifyLockUpdated();
            toast.success(msg);
          }}
        />
      )}

      <input
        ref={avatarFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      <Modal
        isOpen={avatarModalOpen}
        onClose={() => {
          if (!avatarSaving) setAvatarModalOpen(false);
        }}
        title="Profil rasmini almashtirish"
        subtitle="Galereyadan rasm tanlang — avtomatik kvadratga moslab saqlanadi"
        size="sm"
      >
        <div className="flex flex-col items-center text-center space-y-5">
          <div className="relative">
            {!avatarError ? (
              <img
                key={`modal-${user?.avatarUrl || 'default-avatar'}`}
                src={resolveAvatarUrl(user?.avatarUrl)}
                alt={user?.fullName || 'Profil rasmi'}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== DEFAULT_AVATAR_URL) {
                    e.currentTarget.src = DEFAULT_AVATAR_URL;
                  } else {
                    setAvatarError(true);
                  }
                }}
                className="w-28 h-28 rounded-2xl object-cover border-2 border-emerald-500/45 shadow-[0_10px_28px_rgba(16,185,129,0.22)]"
              />
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-500/40 flex items-center justify-center font-black text-4xl">
                {(user?.fullName || 'H').slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            JPG, PNG yoki WEBP formatidagi rasm yuklang.
          </p>

          <div className="w-full space-y-2.5">
            <Button
              type="button"
              variant="primary"
              size="md"
              fullWidth
              loading={avatarSaving}
              leadingIcon={<Upload className="w-4 h-4" />}
              onClick={() => avatarFileRef.current?.click()}
            >
              {avatarSaving ? 'Yuklanmoqda...' : 'Galereyadan rasm tanlash'}
            </Button>

            {user?.avatarUrl && !isDefaultAvatar(user.avatarUrl) && (
              <Button
                type="button"
                variant="outline"
                size="md"
                fullWidth
                disabled={avatarSaving}
                leadingIcon={<RotateCcw className="w-4 h-4" />}
                onClick={handleResetAvatar}
              >
                Standart rasmga qaytarish
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
