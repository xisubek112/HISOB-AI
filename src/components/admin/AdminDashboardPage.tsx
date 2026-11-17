/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  Crown,
  Database,
  DollarSign,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../design-system/index.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import type { NavTab } from '../layout/Sidebar.tsx';
import type {
  AdminAiAnalyticsData,
  AdminAuditLog,
  AdminOverviewData,
  AdminRevenueData,
  AdminSubscriptionsData,
  AdminSystemHealthData,
  AdminUserSummary,
  AppRuntimeConfig,
} from '../../types/finance.ts';
import { AdminDualBarChart, AdminSingleBarChart } from './AdminCharts.tsx';
import { AdminConfirmModal } from './AdminConfirmModal.tsx';

type AdminSection =
  | 'overview'
  | 'users'
  | 'subscriptions'
  | 'revenue'
  | 'ai'
  | 'health'
  | 'audit'
  | 'config';

interface AdminDashboardPageProps {
  onNavigateTab?: (tab: NavTab) => void;
  onOpenAuthModal?: () => void;
}

interface PendingConfirmAction {
  title: string;
  description: string;
  targetSummary?: string;
  confirmLabel?: string;
  danger?: boolean;
  execute: (reason: string) => Promise<void>;
}

const SECTIONS: { id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Umumiy koʻrinish', icon: Activity },
  { id: 'users', label: 'Foydalanuvchilar', icon: Users },
  { id: 'subscriptions', label: 'Obunalar', icon: Crown },
  { id: 'revenue', label: 'Daromad tahlili', icon: DollarSign },
  { id: 'ai', label: 'AI tahlili', icon: Bot },
  { id: 'health', label: 'Tizim holati', icon: Server },
  { id: 'audit', label: 'Xavfsizlik va Audit', icon: FileText },
  { id: 'config', label: 'Ilova sozlamalari', icon: Settings2 },
];

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hrs = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}k ${hrs}s ${mins}d`;
  if (hrs > 0) return `${hrs}s ${mins}d`;
  return `${mins}d ${s % 60}son`;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onNavigateTab,
  onOpenAuthModal,
}) => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [section, setSection] = useState<AdminSection>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data per section
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);

  const [usersData, setUsersData] = useState<{
    users: AdminUserSummary[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [planDrafts, setPlanDrafts] = useState<
    Record<string, { plan: 'free' | 'pro' | 'business'; months: number }>
  >({});

  const [subscriptionsData, setSubscriptionsData] = useState<AdminSubscriptionsData | null>(null);
  const [subPage, setSubPage] = useState(1);

  const [revenueData, setRevenueData] = useState<AdminRevenueData | null>(null);
  const [aiData, setAiData] = useState<AdminAiAnalyticsData | null>(null);
  const [healthData, setHealthData] = useState<AdminSystemHealthData | null>(null);

  const [auditData, setAuditData] = useState<{
    logs: AdminAuditLog[];
    total: number;
    page: number;
    limit: number;
  } | null>(null);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  const [configState, setConfigState] = useState<AppRuntimeConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<AppRuntimeConfig | null>(null);

  // Confirm modal state
  const [pendingAction, setPendingAction] = useState<PendingConfirmAction | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  // Separate Admin Access Code gate state
  const [accessChecked, setAccessChecked] = useState(false);
  const [adminCodeConfigured, setAdminCodeConfigured] = useState(true);
  const [panelUnlocked, setPanelUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const isSuperAdmin = user?.isSuperAdmin === true;

  const clearAdminCachedData = useCallback(() => {
    setOverview(null);
    setUsersData(null);
    setSubscriptionsData(null);
    setRevenueData(null);
    setAiData(null);
    setHealthData(null);
    setAuditData(null);
    setConfigState(null);
    setConfigDraft(null);
    setError(null);
  }, []);

  const verifyAdminAccessStatus = useCallback(async () => {
    if (!isSuperAdmin) {
      setAccessChecked(false);
      setPanelUnlocked(false);
      clearAdminCachedData();
      return;
    }
    try {
      const status = await api.getAdminAccessStatus();
      setAdminCodeConfigured(status.adminCodeConfigured);
      const nextUnlocked = Boolean(status.adminCodeConfigured && status.unlocked);
      setPanelUnlocked(nextUnlocked);
      if (!nextUnlocked) {
        clearAdminCachedData();
      }
      setUnlockError(null);
    } catch (err: any) {
      setPanelUnlocked(false);
      clearAdminCachedData();
      setUnlockError(err?.message || 'Kirish holatini tekshirib boʻlmadi');
    } finally {
      setAccessChecked(true);
    }
  }, [isSuperAdmin, clearAdminCachedData]);

  useEffect(() => {
    verifyAdminAccessStatus();
  }, [verifyAdminAccessStatus]);

  const loadSectionData = useCallback(async () => {
    if (!isSuperAdmin || !panelUnlocked) return;
    setLoading(true);
    setError(null);
    try {
      if (section === 'overview') {
        const res = await api.getAdminOverview();
        setOverview(res);
      } else if (section === 'users') {
        const res = await api.getAdminUsers({
          search: userSearch.trim() || undefined,
          plan: userPlanFilter,
          status: userStatusFilter,
          page: userPage,
          limit: 15,
        });
        setUsersData(res);
      } else if (section === 'subscriptions') {
        const res = await api.getAdminSubscriptions({ page: subPage, limit: 15 });
        setSubscriptionsData(res);
      } else if (section === 'revenue') {
        const res = await api.getAdminRevenue();
        setRevenueData(res);
      } else if (section === 'ai') {
        const res = await api.getAdminAiAnalytics();
        setAiData(res);
      } else if (section === 'health') {
        const res = await api.getAdminSystemHealth();
        setHealthData(res);
      } else if (section === 'audit') {
        const res = await api.getAdminAuditLogs({
          action: auditActionFilter,
          search: auditSearch.trim() || undefined,
          page: auditPage,
          limit: 20,
        });
        setAuditData(res);
      } else if (section === 'config') {
        const res = await api.getAdminConfig();
        setConfigState(res.config);
        setConfigDraft(res.config);
      }
    } catch (err: any) {
      if (err?.code === 'ADMIN_CODE_REQUIRED' || err?.code === 'ADMIN_CODE_NOT_CONFIGURED') {
        setPanelUnlocked(false);
        setUnlockError(err?.message || 'Admin kirish kodi talab qilinadi');
      } else {
        setError(err?.message || 'Admin maʼlumotlarini yuklashda xatolik yuz berdi');
      }
    } finally {
      setLoading(false);
    }
  }, [
    isSuperAdmin,
    panelUnlocked,
    section,
    userSearch,
    userPlanFilter,
    userStatusFilter,
    userPage,
    subPage,
    auditActionFilter,
    auditSearch,
    auditPage,
  ]);

  useEffect(() => {
    if (isSuperAdmin && panelUnlocked) {
      loadSectionData();
    }
  }, [isSuperAdmin, panelUnlocked, loadSectionData]);

  // Guard 1: Unauthenticated
  if (!user) {
    return (
      <div className="max-w-lg mx-auto my-12 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Avtorizatsiya talab qilinadi
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
          HISOBOT AI Super Admin boshqaruv paneliga kirish uchun tasdiqlangan administrator hisobingiz bilan tizimga kiring.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="min-h-[44px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#05251D] text-xs font-bold cursor-pointer"
            >
              Hisobga kirish
            </button>
          )}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="min-h-[44px] px-5 rounded-xl border border-slate-200 dark:border-white/[0.10] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer"
            >
              Bosh sahifaga qaytish
            </button>
          )}
        </div>
      </div>
    );
  }

  // Guard 2: Non-admin (strict backend-issued flag)
  if (!isSuperAdmin) {
    return (
      <div className="max-w-lg mx-auto my-12 rounded-xl border border-rose-500/30 bg-white dark:bg-[#0B1D20] p-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          403 — Kirish rad etildi
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
          Super Admin huquqi mavjud emas
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
          Ushbu boʻlim faqat server tomonidan tasdiqlangan rasmiy Super Admin hisobi uchun ochiq. Barcha ruxsatsiz kirish urinishlari server jurnalida qayd etiladi.
        </p>
        {onNavigateTab && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white/10 text-white text-xs font-semibold hover:opacity-90 cursor-pointer"
            >
              Bosh sahifaga qaytish
            </button>
          </div>
        )}
      </div>
    );
  }

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setUnlockError('Admin panel kirish kodini kiriting');
      return;
    }
    setUnlocking(true);
    setUnlockError(null);
    try {
      await api.unlockAdminPanel(trimmed);
      setCodeInput('');
      setPanelUnlocked(true);
      toast.success('Admin paneli ochildi');
    } catch (err: any) {
      setUnlockError(err?.message || 'Maxfiy kirish kodi notoʻgʻri');
    } finally {
      setUnlocking(false);
    }
  };

  const handleLockPanel = async () => {
    try {
      await api.lockAdminPanel();
    } finally {
      setPanelUnlocked(false);
      clearAdminCachedData();
      toast.success('Admin paneli qulflandi');
    }
  };

  // Guard 3: Checking access status
  if (!accessChecked) {
    return (
      <div className="max-w-md mx-auto my-12 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-6 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-3" />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Admin xavfsizlik holati tekshirilmoqda...
        </p>
      </div>
    );
  }

  // Guard 4: Separate Admin Access Code required
  if (!panelUnlocked) {
    return (
      <div className="max-w-md mx-auto my-10 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-6">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Admin Panel — Maxfiy Kirish Kodi
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          <span className="font-mono text-slate-700 dark:text-slate-200">{user.email}</span> hisobi tasdiqlandi. Boshqaruv panelini ochish uchun serverda belgilangan alohida maxfiy kodni kiriting.
        </p>

        {!adminCodeConfigured ? (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            Server muhitida <span className="font-mono font-bold">ADMIN_ACCESS_CODE</span> sozlanmagan. Xavfsizlik siyosatiga koʻra admin paneli yopiq.
          </div>
        ) : (
          <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-3.5">
            <div>
              <label
                htmlFor="admin-access-code-input"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Alohida admin kodi *
              </label>
              <div className="relative">
                <input
                  id="admin-access-code-input"
                  type={showCode ? 'text' : 'password'}
                  autoComplete="off"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Maxfiy kodni kiriting..."
                  className="w-full min-h-[44px] pl-3.5 pr-11 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#071B18] text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCode((s) => !s)}
                  aria-label={showCode ? 'Kodni yashirish' : 'Kodni koʻrsatish'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {unlockError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
                {unlockError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={unlocking}
                className="flex-1 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#05251D] text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {unlocking ? 'Tekshirilmoqda...' : 'Admin panelini ochish'}
              </button>
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('dashboard')}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/[0.10] text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Orqaga
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    );
  }

  const runConfirmedAction = async (reason: string) => {
    if (!pendingAction) return;
    setSubmittingAction(true);
    try {
      await pendingAction.execute(reason);
      setPendingAction(null);
      await loadSectionData();
    } finally {
      setSubmittingAction(false);
    }
  };

  const openPlanChangeModal = (targetUser: AdminUserSummary) => {
    const draft = planDrafts[targetUser.id] || {
      plan: targetUser.premiumPlan,
      months: 1,
    };
    setPendingAction({
      title: 'Obuna tarifini oʻzgartirish',
      description: `${targetUser.fullName} (${targetUser.email}) hisobining tarifini "${draft.plan.toUpperCase()}" rejasiga (${
        draft.plan === 'free' ? 'bepul' : `${draft.months} oy`
      }) oʻzgartirmoqchisiz.`,
      targetSummary: `${targetUser.email} · ${targetUser.id}`,
      confirmLabel: 'Tarifni yangilash',
      danger: draft.plan === 'free',
      execute: async (reason) => {
        await api.adminUpdateUserSubscription(targetUser.id, {
          plan: draft.plan,
          durationMonths: draft.plan === 'free' ? 0 : draft.months,
          reason,
          confirm: true,
        });
        if (targetUser.id === user.id) {
          await refreshUser();
        }
        toast.success(`${targetUser.fullName} tarifi yangilandi`);
      },
    });
  };

  const openStatusModal = (targetUser: AdminUserSummary) => {
    const nextSuspended = !targetUser.isSuspended;
    setPendingAction({
      title: nextSuspended ? 'Foydalanuvchini bloklash' : 'Blokdan chiqarish',
      description: nextSuspended
        ? `${targetUser.fullName} (${targetUser.email}) hisobi vaqtincha bloklanadi va barcha faol sessiyalari darhol bekor qilinadi.`
        : `${targetUser.fullName} (${targetUser.email}) hisobiga kirish qayta tiklanadi.`,
      targetSummary: `${targetUser.email} · ${targetUser.id}`,
      confirmLabel: nextSuspended ? 'Hisobni bloklash' : 'Hisobni faollashtirish',
      danger: nextSuspended,
      execute: async (reason) => {
        await api.adminSetUserStatus(targetUser.id, {
          suspended: nextSuspended,
          reason,
          confirm: true,
        });
        toast.success(nextSuspended ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi faollashtirildi');
      },
    });
  };

  const openRevokeSessionsModal = (targetUser: AdminUserSummary) => {
    setPendingAction({
      title: 'Barcha sessiyalarni bekor qilish',
      description: `${targetUser.fullName} (${targetUser.email}) foydalanuvchisining barcha qurilmalardagi faol sessiyalari yopiladi.`,
      targetSummary: `${targetUser.email} · ${targetUser.activeSessionsCount} ta faol sessiya`,
      confirmLabel: 'Sessiyalarni yopish',
      danger: true,
      execute: async (reason) => {
        const res = await api.adminRevokeUserSessions(targetUser.id, {
          reason,
          confirm: true,
        });
        toast.success(`${res.clearedSessions} ta sessiya yopildi`);
      },
    });
  };

  const openSaveConfigModal = () => {
    if (!configDraft) return;
    setPendingAction({
      title: 'Tizim konfiguratsiyasini saqlash',
      description:
        'Kiritilgan ilova sozlamalari (texnik xizmat rejimi, roʻyxatdan oʻtish, AI modeli va tarif narxlari) barcha server soʻrovlariga darhol qoʻllanadi.',
      targetSummary: `Model: ${configDraft.aiFastModel} · Rate limit: ${configDraft.aiRateLimitPerMin}/min`,
      confirmLabel: 'Sozlamalarni saqlash',
      danger: configDraft.maintenanceMode || !configDraft.registrationEnabled,
      execute: async (reason) => {
        const res = await api.updateAdminConfig({
          config: configDraft,
          reason,
          confirm: true,
        });
        setConfigState(res.config);
        setConfigDraft(res.config);
        toast.success('Ilova konfiguratsiyasi yangilandi');
      },
    });
  };

  const kpiCardClass =
    'rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4';
  const tableHeaderClass =
    'text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/[0.08]';

  return (
    <div className="space-y-5 pb-10">
      {/* Admin Top Header */}
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                HISOBOT AI — Super Admin Konsoli
              </h1>
              <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-md">
                {user.email}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              XISU Team · Haqiqiy maʼlumotlar bazasi telemetriyasi, obunalar va xavfsizlik nazorati
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="min-h-[44px] inline-flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ilovaga qaytish</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleLockPanel}
            className="min-h-[44px] inline-flex items-center gap-2 px-3.5 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <Lock className="w-4 h-4" />
            <span>Qulflash</span>
          </button>
          <button
            type="button"
            onClick={loadSectionData}
            disabled={loading}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yangilash</span>
          </button>
        </div>
      </div>

      {/* 8-Section Navigation Bar */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`min-h-[42px] inline-flex items-center justify-center sm:justify-start gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                active
                  ? 'bg-emerald-500 text-[#05251D] border-emerald-500 font-bold shadow-[0_6px_18px_rgba(16,185,129,0.24)]'
                  : 'bg-white dark:bg-[#0B1D20] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.08] hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadSectionData}
            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold shrink-0 cursor-pointer"
          >
            Qayta yuklash
          </button>
        </div>
      )}

      {/* ==================== 1. OVERVIEW ==================== */}
      {section === 'overview' && overview && (
        <div className="space-y-5">
          {/* Quick Admin Action Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {SECTIONS.filter((s) => s.id !== 'overview').map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] hover:border-emerald-500/40 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* 6 Headline KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div className={kpiCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Jami foydalanuvchilar
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {overview.metrics.totalUsers}
                </span>
                <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{overview.metrics.newUsers7d} (7 kun)
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Bugun: {overview.metrics.newUsersToday} · 30 kunda: {overview.metrics.newUsers30d}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Faol foydalanuvchilar
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {overview.metrics.activeUsers24h}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  24 soat ichida
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                7 kunlik faollar: {overview.metrics.activeUsers7d} · Bloklangan: {overview.metrics.suspendedUsers}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Premium foydalanuvchilar
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {overview.metrics.premiumUsers}
                </span>
                <span className="text-xs font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  {overview.metrics.premiumConversionRate}% konversiya
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                Pro: {overview.metrics.proUsers} · Business: {overview.metrics.businessUsers}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Daromad va Tranzaksiyalar
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatMoney(overview.metrics.totalRevenueUzs)}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                MRR: {formatMoney(overview.metrics.mrrEstimateUzs)} · Tranzaksiyalar: {overview.metrics.totalTransactions}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                AI soʻrovlari va Tezlik
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                  {overview.metrics.aiRequestsTotal}
                </span>
                <span className="text-xs font-mono tabular-nums text-cyan-600 dark:text-cyan-400">
                  {overview.metrics.aiAvgLatencyMs} ms oʻrtacha
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                24 soatda: {overview.metrics.aiRequests24h} · Fallback: {overview.metrics.aiFallbackRate}%
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                API Xatolari (24 soat)
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span
                  className={`text-2xl font-extrabold font-mono tabular-nums ${
                    overview.metrics.apiErrors5xx24h > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {overview.metrics.apiErrors24h}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  5xx: {overview.metrics.apiErrors5xx24h}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                DB holati: {overview.health.databaseStatus === 'healthy' ? 'Sogʻlom' : 'Sekinlashgan'} ({overview.health.databaseLatencyMs} ms)
              </div>
            </div>
          </div>

          {/* 14-day Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AdminDualBarChart
              title="Soʻnggi 14 kun: Roʻyxatdan oʻtish va AI soʻrovlari"
              subtitle="Haqiqiy maʼlumotlar bazasi hodisalari asosida"
              primaryLabel="Yangi foydalanuvchi"
              secondaryLabel="AI soʻrovlari"
              primaryColor="#10B981"
              secondaryColor="#0EA5E9"
              data={overview.series.map((d) => ({
                label: d.date.slice(5),
                primary: d.signups,
                secondary: d.aiRequests,
              }))}
            />

            <AdminDualBarChart
              title="Soʻnggi 14 kun: Obuna daromadi (ming soʻm) va API xatolar"
              subtitle="Kirim hodisalari va server xatolar dinamikasi"
              primaryLabel="Daromad (ming soʻm)"
              secondaryLabel="API xatolar"
              primaryColor="#14B8A6"
              secondaryColor="#F43F5E"
              data={overview.series.map((d) => ({
                label: d.date.slice(5),
                primary: Math.round(d.revenueUzs / 1000),
                secondary: d.apiErrors,
              }))}
            />
          </div>

          {/* Server / DB Status Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Server holati</div>
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 uppercase">
                {overview.health.serverStatus}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Maʼlumotlar bazasi</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {overview.health.databaseBackend.toUpperCase()} ({overview.health.databaseLatencyMs} ms)
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Ishlash vaqti</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {formatDuration(overview.health.uptimeSeconds)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Xotira (RSS / Heap)</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {overview.health.memoryRssMb} / {overview.health.heapUsedMb} MB
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Gemini & Admin himoyasi</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                AI: {overview.health.geminiConfigured ? 'ON' : 'OFF'} · ADM: {overview.health.adminEmailConfigured ? 'OK' : 'MISSING'}
              </div>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Soʻnggi administrator audit yozuvlari
              </h3>
              <button
                type="button"
                onClick={() => setSection('audit')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Barchasini koʻrish
              </button>
            </div>
            {overview.recentAuditLogs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Hali audit yozuvlari qayd etilmagan.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-white/[0.08]">
                {overview.recentAuditLogs.map((log) => (
                  <div key={log.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {log.action}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          {log.targetId}
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-0.5">{log.reason}</div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <div>{log.adminEmail}</div>
                      <div>{formatDateTime(log.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 2. USER MANAGEMENT ==================== */}
      {section === 'users' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                placeholder="Ism, email yoki user ID boʻyicha qidirish..."
                className="w-full min-h-[42px] pl-9 pr-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={userPlanFilter}
              onChange={(e) => {
                setUserPlanFilter(e.target.value);
                setUserPage(1);
              }}
              aria-label="Tarif boʻyicha filtr"
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Barcha tariflar</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>

            <select
              value={userStatusFilter}
              onChange={(e) => {
                setUserStatusFilter(e.target.value);
                setUserPage(1);
              }}
              aria-label="Holat boʻyicha filtr"
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Barcha holatlar</option>
              <option value="active">Faol</option>
              <option value="suspended">Bloklangan</option>
              <option value="admin">Super Admin</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className={tableHeaderClass}>
                    <th className="py-3 px-4">Foydalanuvchi</th>
                    <th className="py-3 px-4">Tarif / Muddat</th>
                    <th className="py-3 px-4">Faollik</th>
                    <th className="py-3 px-4">Holat</th>
                    <th className="py-3 px-4 text-right">Boshqaruv amallari</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                  {!usersData || usersData.users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        {loading ? 'Yuklanmoqda...' : 'Foydalanuvchilar topilmadi.'}
                      </td>
                    </tr>
                  ) : (
                    usersData.users.map((u) => {
                      const draft = planDrafts[u.id] || {
                        plan: u.premiumPlan,
                        months: 1,
                      };
                      const isSelfOrAdmin = u.isSuperAdmin || u.id === user.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.fullName}</span>
                              {u.isSuperAdmin && (
                                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                  [ADMIN]
                                </span>
                              )}
                            </div>
                            <div className="text-slate-500 dark:text-slate-400">{u.email}</div>
                            <div className="text-[10px] font-mono text-slate-400 mt-0.5">{u.id}</div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-mono font-bold uppercase text-slate-900 dark:text-white">
                              {u.premiumPlan}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {u.premiumExpiresAt
                                ? `Tugash: ${formatDateTime(u.premiumExpiresAt)}`
                                : 'Muddatsiz'}
                            </div>
                          </td>

                          <td className="py-3 px-4 tabular-nums">
                            <div className="text-slate-900 dark:text-white">
                              {u.transactionCount} ta tranzaksiya
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              Sessiyalar: {u.activeSessionsCount} · Oxirgi:{' '}
                              {formatDateTime(u.lastActiveAt || u.createdAt)}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            {u.isSuspended ? (
                              <span className="font-mono text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                BLOKLANGAN
                              </span>
                            ) : (
                              <span className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                FAOL
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <select
                                aria-label={`${u.fullName} uchun tarif`}
                                value={draft.plan}
                                onChange={(e) =>
                                  setPlanDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: {
                                      ...draft,
                                      plan: e.target.value as 'free' | 'pro' | 'business',
                                    },
                                  }))
                                }
                                className="min-h-[34px] px-2 rounded-md border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#071B18] text-[11px]"
                              >
                                <option value="free">Free</option>
                                <option value="pro">Pro</option>
                                <option value="business">Business</option>
                              </select>

                              {draft.plan !== 'free' && (
                                <select
                                  aria-label="Muddat oylari"
                                  value={draft.months}
                                  onChange={(e) =>
                                    setPlanDrafts((prev) => ({
                                      ...prev,
                                      [u.id]: { ...draft, months: Number(e.target.value) },
                                    }))
                                  }
                                  className="min-h-[34px] px-2 rounded-md border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#071B18] text-[11px]"
                                >
                                  <option value={1}>1 oy</option>
                                  <option value={3}>3 oy</option>
                                  <option value={6}>6 oy</option>
                                  <option value={12}>12 oy</option>
                                </select>
                              )}

                              <button
                                type="button"
                                onClick={() => openPlanChangeModal(u)}
                                className="min-h-[34px] px-2.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-[#05251D] text-[11px] font-bold cursor-pointer"
                              >
                                Qoʻllash
                              </button>

                              <button
                                type="button"
                                disabled={isSelfOrAdmin}
                                onClick={() => openStatusModal(u)}
                                title={
                                  isSelfOrAdmin
                                    ? 'Super Admin hisobini bloklab boʻlmaydi'
                                    : u.isSuspended
                                    ? 'Faollashtirish'
                                    : 'Bloklash'
                                }
                                className={`min-h-[34px] px-2.5 rounded-md border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                  u.isSuspended
                                    ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                                    : 'border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                                }`}
                              >
                                {u.isSuspended ? (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Tiklash</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Bloklash</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={u.activeSessionsCount === 0}
                                onClick={() => openRevokeSessionsModal(u)}
                                className="min-h-[34px] px-2.5 rounded-md border border-slate-200 dark:border-white/[0.12] text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Sessiya yopish
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {usersData && usersData.total > usersData.limit && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  Jami: {usersData.total} · Sahifa {usersData.page}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] disabled:opacity-40 cursor-pointer"
                  >
                    Oldingi
                  </button>
                  <button
                    type="button"
                    disabled={userPage * usersData.limit >= usersData.total}
                    onClick={() => setUserPage((p) => p + 1)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] disabled:opacity-40 cursor-pointer"
                  >
                    Keyingi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 3. PREMIUM SUBSCRIPTIONS ==================== */}
      {section === 'subscriptions' && subscriptionsData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Free foydalanuvchilar</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
                {subscriptionsData.summary.freeUsers}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Pro obunachilar</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                {subscriptionsData.summary.proUsers}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Business obunachilar</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-cyan-600 dark:text-cyan-400">
                {subscriptionsData.summary.businessUsers}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Konversiya darajasi</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
                {subscriptionsData.summary.conversionRate}%
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Faol Premium obunachilar ({subscriptionsData.subscribers.length})
              </h3>
            </div>
            {subscriptionsData.subscribers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Hozircha faol pullik obunachilar yoʻq.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className={tableHeaderClass}>
                      <th className="py-2.5 px-4">Foydalanuvchi</th>
                      <th className="py-2.5 px-4">Tarif</th>
                      <th className="py-2.5 px-4">Tugash muddati</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                    {subscriptionsData.subscribers.map((sub) => (
                      <tr key={sub.id}>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{sub.fullName}</div>
                          <div className="text-slate-500 dark:text-slate-400">{sub.email}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">
                          {sub.premiumPlan}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          {formatDateTime(sub.premiumExpiresAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Obuna oʻzgarishlari jurnali ({subscriptionsData.totalEvents})
              </h3>
            </div>
            {subscriptionsData.events.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Obuna hodisalari qayd etilmagan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr className={tableHeaderClass}>
                      <th className="py-2.5 px-4">Sana</th>
                      <th className="py-2.5 px-4">Foydalanuvchi</th>
                      <th className="py-2.5 px-4">Oʻzgarish</th>
                      <th className="py-2.5 px-4">Summa</th>
                      <th className="py-2.5 px-4">Sabab</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                    {subscriptionsData.events.map((ev) => (
                      <tr key={ev.id}>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTime(ev.createdAt)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {ev.userFullName || ev.userId}
                          </div>
                          {ev.userEmail && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">{ev.userEmail}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {ev.previousPlan.toUpperCase()} →{' '}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {ev.plan.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums">
                          {formatMoney(ev.amountUzs)}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                          {ev.reason || ev.source}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {subscriptionsData.totalEvents > subscriptionsData.limit && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Sahifa {subscriptionsData.page}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={subPage <= 1}
                    onClick={() => setSubPage((p) => Math.max(1, p - 1))}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] disabled:opacity-40 cursor-pointer"
                  >
                    Oldingi
                  </button>
                  <button
                    type="button"
                    disabled={subPage * subscriptionsData.limit >= subscriptionsData.totalEvents}
                    onClick={() => setSubPage((p) => p + 1)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] disabled:opacity-40 cursor-pointer"
                  >
                    Keyingi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 4. REVENUE ANALYTICS ==================== */}
      {section === 'revenue' && revenueData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Jami tushum</div>
              <div className="text-xl font-extrabold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
                {formatMoney(revenueData.summary.totalRevenueUzs)}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Soʻnggi 30 kun tushumi</div>
              <div className="text-xl font-extrabold font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                {formatMoney(revenueData.summary.revenue30dUzs)}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Taxminiy oylik MRR</div>
              <div className="text-xl font-extrabold font-mono tabular-nums mt-1 text-cyan-600 dark:text-cyan-400">
                {formatMoney(revenueData.summary.mrrEstimateUzs)}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Faol pullik hisoblar</div>
              <div className="text-xl font-extrabold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
                {revenueData.summary.activePaidUsers} (Pro: {revenueData.summary.proActiveCount} / Biz:{' '}
                {revenueData.summary.businessActiveCount})
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AdminSingleBarChart
                title="6 oylik daromad dinamikasi (UZS)"
                subtitle="Haqiqiy obuna hodisalari asosida"
                data={revenueData.monthlySeries.map((m) => ({
                  label: m.month,
                  value: m.revenueUzs,
                }))}
                formatValue={(v) => formatMoney(v)}
              />
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tariflar boʻyicha tushum</h3>
              <div className="divide-y divide-slate-200 dark:divide-white/[0.08]">
                {revenueData.byPlan.map((row) => (
                  <div key={row.plan} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono font-bold uppercase text-slate-900 dark:text-white">
                        {row.plan}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">{row.subscribers} ta foydalanuvchi</div>
                    </div>
                    <div className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(row.revenueUzs)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 5. AI USAGE ANALYTICS ==================== */}
      {section === 'ai' && aiData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Jami AI soʻrovlari</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-slate-900 dark:text-white">
                {aiData.summary.totalRequests}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                24 soatda: {aiData.summary.requests24h}
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Gemini / Fallback</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">
                {aiData.summary.geminiCount} / {aiData.summary.fallbackCount}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Fallback: {aiData.summary.fallbackRate}%
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Oʻrtacha / P95 tezlik</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-cyan-600 dark:text-cyan-400">
                {aiData.summary.avgLatencyMs} / {aiData.summary.p95LatencyMs} ms
              </div>
            </div>
            <div className={kpiCardClass}>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">AI xatolar soni</div>
              <div className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-rose-600 dark:text-rose-400">
                {aiData.summary.errorCount}
              </div>
            </div>
          </div>

          <AdminDualBarChart
            title="14 kunlik AI soʻrovlar taqsimoti: Gemini vs Fallback"
            primaryLabel="Gemini"
            secondaryLabel="Fallback"
            primaryColor="#10B981"
            secondaryColor="#F59E0B"
            data={aiData.dailySeries.map((d) => ({
              label: d.date.slice(5),
              primary: d.gemini,
              secondary: d.fallback,
            }))}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Modellar kesimi</h3>
              {aiData.byModel.length === 0 ? (
                <div className="text-xs text-slate-500">Hozircha soʻrovlar yoʻq.</div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                  {aiData.byModel.map((m) => (
                    <div key={m.model} className="py-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-800 dark:text-slate-200">{m.model}</span>
                      <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {m.count} ({m.avgLatencyMs} ms)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Tillar kesimi</h3>
              {aiData.byLanguage.length === 0 ? (
                <div className="text-xs text-slate-500">Maʼlumot yoʻq.</div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                  {aiData.byLanguage.map((l) => (
                    <div key={l.language} className="py-2.5 flex items-center justify-between">
                      <span className="font-mono uppercase font-semibold text-slate-800 dark:text-slate-200">
                        {l.language}
                      </span>
                      <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {l.count} ta
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Endpointlar kesimi</h3>
              {aiData.byEndpoint.length === 0 ? (
                <div className="text-xs text-slate-500">Maʼlumot yoʻq.</div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                  {aiData.byEndpoint.map((ep) => (
                    <div key={ep.endpoint} className="py-2.5 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] truncate text-slate-800 dark:text-slate-200">
                        {ep.endpoint}
                      </span>
                      <span className="font-mono tabular-nums shrink-0 text-slate-500 dark:text-slate-400">
                        {ep.count} (fb: {ep.fallbackCount})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 6. SYSTEM HEALTH ==================== */}
      {section === 'health' && healthData && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={kpiCardClass}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white mb-3">
                <Server className="w-4 h-4 text-emerald-500" />
                <span>Server koʻrsatkichlari</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Holat</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                    {healthData.serverStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Ishlash vaqti</span>
                  <span className="font-mono tabular-nums">{formatDuration(healthData.uptimeSeconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Xotira (RSS / Heap)</span>
                  <span className="font-mono tabular-nums">
                    {healthData.memoryRssMb} / {healthData.heapUsedMb} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Muhit / Node</span>
                  <span className="font-mono">
                    {healthData.environment} · {healthData.nodeVersion}
                  </span>
                </div>
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white mb-3">
                <Database className="w-4 h-4 text-cyan-500" />
                <span>Maʼlumotlar bazasi</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Backend</span>
                  <span className="font-mono font-bold uppercase">{healthData.database.backend}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Holat</span>
                  <span
                    className={`font-mono font-bold uppercase ${
                      healthData.database.status === 'healthy'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {healthData.database.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Ping kechikishi</span>
                  <span className="font-mono tabular-nums">{healthData.database.latencyMs} ms</span>
                </div>
                {healthData.database.error && (
                  <div className="text-[11px] text-rose-500 break-all">{healthData.database.error}</div>
                )}
              </div>
            </div>

            <div className={kpiCardClass}>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white mb-3">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Xavfsizlik tekshiruvlari</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">ADMIN_EMAIL</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {healthData.securityChecks.adminEmailConfigured ? 'FAOL' : 'SOZLANMAGAN'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">ADMIN_ACCESS_CODE</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {healthData.securityChecks.adminCodeConfigured ? 'FAOL' : 'SOZLANMAGAN'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">GEMINI_API_KEY</span>
                  <span className="font-mono font-bold">
                    {healthData.securityChecks.geminiConfigured ? 'ULANGAN' : 'MAVJUD EMAS'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Rate Limiting</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {healthData.securityChecks.rateLimitingActive ? 'FAOL' : 'OʻCHIQ'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Audit jurnali</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {healthData.securityChecks.auditLoggingActive ? 'FAOL' : 'OʻCHIQ'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Soʻnggi API xatolari ({healthData.recentApiErrors.length})
              </h3>
            </div>
            {healthData.recentApiErrors.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                API xatolari qayd etilmagan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className={tableHeaderClass}>
                      <th className="py-2.5 px-4">Vaqt</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Soʻrov</th>
                      <th className="py-2.5 px-4">Xabar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                    {healthData.recentApiErrors.map((err) => (
                      <tr key={err.id}>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTime(err.createdAt)}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                          {err.statusCode}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          {err.method} {err.path}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">{err.errorMessage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 7. SECURITY & AUDIT LOGS ==================== */}
      {section === 'audit' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => {
                  setAuditSearch(e.target.value);
                  setAuditPage(1);
                }}
                placeholder="Sabab, target ID yoki admin email boʻyicha qidirish..."
                className="w-full min-h-[42px] pl-9 pr-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={auditActionFilter}
              onChange={(e) => {
                setAuditActionFilter(e.target.value);
                setAuditPage(1);
              }}
              aria-label="Amal turi boʻyicha filtr"
              className="min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] text-xs text-slate-900 dark:text-white"
            >
              <option value="all">Barcha amallar</option>
              <option value="admin.unlock">Admin panel ochilishi</option>
              <option value="admin.unlock_failed">Notoʻgʻri admin kodi</option>
              <option value="admin.lock">Admin panel qulflanishi</option>
              <option value="subscription.update">Obuna oʻzgartirish</option>
              <option value="user.suspend">Hisobni bloklash</option>
              <option value="user.reactivate">Hisobni tiklash</option>
              <option value="user.revoke_sessions">Sessiyalarni yopish</option>
              <option value="config.update">Konfiguratsiya saqlash</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className={tableHeaderClass}>
                    <th className="py-3 px-4">Vaqt</th>
                    <th className="py-3 px-4">Administrator</th>
                    <th className="py-3 px-4">Amal</th>
                    <th className="py-3 px-4">Nishon (Target)</th>
                    <th className="py-3 px-4">Sabab</th>
                    <th className="py-3 px-4">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/[0.08] text-xs">
                  {!auditData || auditData.logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        Audit yozuvlari topilmadi.
                      </td>
                    </tr>
                  ) : (
                    auditData.logs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">{log.adminEmail}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">{log.targetId}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">{log.reason}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {log.ipAddress || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {auditData && auditData.total > auditData.limit && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                  Jami: {auditData.total} · Sahifa {auditData.page}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] disabled:opacity-40 cursor-pointer"
                  >
                    Oldingi
                  </button>
                  <button
                    type="button"
                    disabled={auditPage * auditData.limit >= auditData.total}
                    onClick={() => setAuditPage((p) => p + 1)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] disabled:opacity-40 cursor-pointer"
                  >
                    Keyingi
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 8. APP CONFIGURATION ==================== */}
      {section === 'config' && configDraft && (
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tizim va Ilova Konfiguratsiyasi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Oxirgi yangilanish: {formatDateTime(configState?.updatedAt)} ({configState?.updatedBy || 'system'})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] cursor-pointer">
              <input
                type="checkbox"
                checked={configDraft.maintenanceMode}
                onChange={(e) =>
                  setConfigDraft((prev) => (prev ? { ...prev, maintenanceMode: e.target.checked } : prev))
                }
                className="mt-0.5 h-4 w-4 accent-rose-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Texnik xizmat rejimi</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Yoqilganda oddiy foydalanuvchilar API soʻrovlari vaqtincha toʻxtatiladi (503).
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] cursor-pointer">
              <input
                type="checkbox"
                checked={configDraft.registrationEnabled}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, registrationEnabled: e.target.checked } : prev
                  )
                }
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">Yangi roʻyxatdan oʻtish</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Oʻchirilsa yangi foydalanuvchilar hisob yarata olmaydi.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] cursor-pointer">
              <input
                type="checkbox"
                checked={configDraft.aiAssistantEnabled}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, aiAssistantEnabled: e.target.checked } : prev
                  )
                }
                className="mt-0.5 h-4 w-4 accent-emerald-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">AI Yordamchi xizmati</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  HISOBOT AI chat, skaner va tahlil funksiyalarini yoqish/oʻchirish.
                </div>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tezkor AI modeli
              </label>
              <select
                value={configDraft.aiFastModel}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          aiFastModel: e.target.value as 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen',
                        }
                      : prev
                  )
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18]"
              >
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Tez)</option>
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Zaxira/Yuqori)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                AI soʻrov limiti (/daq)
              </label>
              <input
                type="number"
                min={5}
                max={240}
                value={configDraft.aiRateLimitPerMin}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, aiRateLimitPerMin: Number(e.target.value) } : prev
                  )
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Pro oylik narxi (UZS)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={configDraft.proMonthlyPriceUzs}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, proMonthlyPriceUzs: Number(e.target.value) } : prev
                  )
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Business oylik narxi (UZS)
              </label>
              <input
                type="number"
                min={0}
                step={1000}
                value={configDraft.businessMonthlyPriceUzs}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, businessMonthlyPriceUzs: Number(e.target.value) } : prev
                  )
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Sinov muddati (kun)
              </label>
              <input
                type="number"
                min={0}
                max={90}
                value={configDraft.freeTrialDays}
                onChange={(e) =>
                  setConfigDraft((prev) =>
                    prev ? { ...prev, freeTrialDays: Number(e.target.value) } : prev
                  )
                }
                className="w-full min-h-[42px] px-3 rounded-lg border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-[#071B18] font-mono"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => configState && setConfigDraft(configState)}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-white/[0.10] text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={openSaveConfigModal}
              className="min-h-[42px] px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#05251D] text-xs font-bold cursor-pointer"
            >
              Konfiguratsiyani saqlash
            </button>
          </div>
        </div>
      )}

      {/* Confirmation + Audit Reason Modal */}
      <AdminConfirmModal
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.title || ''}
        description={pendingAction?.description || ''}
        targetSummary={pendingAction?.targetSummary}
        confirmLabel={pendingAction?.confirmLabel}
        danger={pendingAction?.danger}
        submitting={submittingAction}
        onClose={() => !submittingAction && setPendingAction(null)}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
};
