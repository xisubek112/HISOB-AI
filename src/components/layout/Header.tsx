/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Mic,
  CheckCheck,
  ArrowDownLeft,
  ArrowUpRight,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { NavTab } from './Sidebar.tsx';
import { NotificationItem } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatDateUz } from '../../utils/formatters.ts';
import { IconButton, GlassPanel } from '../../design-system/index.ts';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileMenu: () => void;
  onOpenTransactionModal: (type: 'income' | 'expense') => void;
  onOpenVoiceModal?: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  onOpenTransactionModal,
  onOpenVoiceModal,
  onNavigateTab,
  onOpenAuthModal,
}) => {
  const { user, theme, toggleTheme } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const tabTitles: Record<NavTab, { title: string; group: string }> = {
    dashboard: { title: 'Bosh sahifa', group: 'Boshqaruv' },
    income: { title: 'Kirimlar', group: 'Boshqaruv' },
    expense: { title: 'Chiqimlar', group: 'Boshqaruv' },
    ai: { title: 'AI Yordamchi', group: 'Aqlli tahlil' },
    wallets: { title: 'Hamyonlar', group: 'Boshqaruv' },
    family: { title: 'Oilaviy budjet', group: 'Reja va Moliya' },
    subscriptions: { title: 'Obunalar', group: 'Reja va Moliya' },
    recurring: { title: 'Avtomatik toʻlovlar', group: 'Reja va Moliya' },
    receipts: { title: 'Chek skaneri', group: 'Tahlil va Tizim' },
    forecast: { title: 'AI Prognoz', group: 'Aqlli tahlil' },
    currencies: { title: 'Valyuta kurslari', group: 'Tahlil va Tizim' },
    banks: { title: 'Banklar va Import', group: 'Tahlil va Tizim' },
    reports: { title: 'Hisobotlar', group: 'Tahlil va Tizim' },
    telegram: { title: 'Telegram Bot', group: 'Tahlil va Tizim' },
    settings: { title: 'Sozlamalar', group: 'Tahlil va Tizim' },
    budgets: { title: 'Budjet limitlari', group: 'Reja va Moliya' },
    goals: { title: 'Maqsadlar', group: 'Reja va Moliya' },
    debts: { title: 'Qarzlar daftari', group: 'Reja va Moliya' },
  };

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
    } catch {
      // ignore transient poll failure
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNotifMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleMarkOneRead = async (id: string, linkTab?: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (linkTab) {
      onNavigateTab(linkTab as NavTab);
      setShowNotifMenu(false);
    }
  };

  const activeMeta = tabTitles[currentTab] || { title: 'HISOBOT AI', group: 'Boshqaruv' };

  return (
    <header className="h-13 sm:h-16 px-3.5 sm:px-6 bg-white/88 dark:bg-[#0D1927]/88 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-3 sticky top-0 z-30 min-w-0">
      {/* Zone 1: Menu Trigger (Mobile) + Breadcrumb Screen Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <IconButton
          label="Navigatsiya menyusini ochish"
          onClick={onOpenMobileMenu}
          size="sm"
          className="lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </IconButton>

        <div className="min-w-0 flex items-center gap-2 text-sm">
          <span className="hidden md:inline text-xs font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {activeMeta.group}
          </span>
          <span aria-hidden="true" className="hidden md:inline text-slate-300 dark:text-slate-600">
            /
          </span>
          <h1 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white tracking-tight truncate">
            {activeMeta.title}
          </h1>
        </div>
      </div>

      {/* Zone 2: Cleanly Grouped Primary Actions & Utilities */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Desktop / Tablet Primary Action Group */}
        <div className="hidden sm:flex items-center gap-1.5 bg-slate-100/80 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/70 dark:border-white/[0.07]">
          <button
            type="button"
            onClick={() => onOpenTransactionModal('income')}
            aria-label="Yangi kirim qoʻshish"
            className="inline-flex items-center gap-1.5 min-h-8 px-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-white dark:hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Kirim</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenTransactionModal('expense')}
            aria-label="Yangi chiqim qoʻshish"
            className="inline-flex items-center gap-1.5 min-h-8 px-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-white dark:hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Chiqim</span>
          </button>

          {onOpenVoiceModal && (
            <button
              type="button"
              onClick={onOpenVoiceModal}
              aria-label="Ovozli tranzaksiya kiritish"
              title="Ovozli kiritish"
              className="inline-flex items-center justify-center w-8 h-8 text-cyan-700 dark:text-cyan-300 hover:bg-white dark:hover:bg-white/[0.08] rounded-lg transition-colors cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-white/[0.10] hidden sm:block" />

        {/* Utility Group */}
        <div className="flex items-center gap-1">
          {onOpenVoiceModal && (
            <IconButton
              label="Ovozli tranzaksiya kiritish"
              onClick={onOpenVoiceModal}
              size="sm"
              className="sm:hidden text-cyan-600 dark:text-cyan-400"
            >
              <Mic className="w-4 h-4" />
            </IconButton>
          )}

          <IconButton
            label={theme === 'dark' ? 'Yorugʻ rejimga oʻtish' : 'Tungi rejimga oʻtish'}
            onClick={toggleTheme}
            size="sm"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </IconButton>

          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <IconButton
              label="Bildirishnomalar"
              aria-expanded={showNotifMenu}
              onClick={() => setShowNotifMenu((prev) => !prev)}
              size="sm"
              className="relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span
                  aria-label={`${unreadCount} ta oʻqilmagan bildirishnoma`}
                  className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-[#0D1927]"
                />
              )}
            </IconButton>

            {showNotifMenu && (
              <GlassPanel
                intensity="medium"
                className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-sm overflow-hidden z-50 hai-scale-in"
              >
                <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      Bildirishnomalar
                    </span>
                    {unreadCount > 0 && (
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                        {unreadCount} yangi
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Barchasini oʻqish</span>
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Bildirishnomalar mavjud emas
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => handleMarkOneRead(n.id, n.linkTab)}
                        className={`w-full text-left p-3.5 text-xs hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer ${
                          !n.isRead ? 'bg-emerald-500/[0.05]' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap tabular-nums">
                            {formatDateUz(n.date)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {n.message}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </GlassPanel>
            )}
          </div>

          {/* Account Avatar / Auth */}
          {user ? (
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              aria-label="Profil va sozlamalar"
              className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200/80 dark:border-white/[0.10] overflow-hidden bg-slate-100 dark:bg-white/[0.05] hover:border-emerald-500/40 transition-colors cursor-pointer ml-1"
            >
              {!avatarFailed ? (
                <img
                  src={user.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                  alt={user.fullName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="min-h-9 px-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-colors shrink-0 cursor-pointer ml-1"
            >
              Kirish
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
