/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Search,
  Calendar,
  ChevronDown,
  CheckCheck,
  ChartNoAxesCombined,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { NavTab } from './Sidebar.tsx';
import { NotificationItem, Transaction } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatDateUz, formatMoney } from '../../utils/formatters.ts';
import { GlassPanel } from '../../design-system/index.ts';

export type DashboardPeriod = 'this_month' | 'last_month' | '7days' | '30days' | 'this_year';

interface HeaderProps {
  currentTab: NavTab;
  selectedPeriod: DashboardPeriod;
  onSelectPeriod: (period: DashboardPeriod) => void;
  transactions: Transaction[];
  onEditTransaction: (tx: Transaction) => void;
  onOpenMobileMenu: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  selectedPeriod,
  onSelectPeriod,
  transactions,
  onEditTransaction,
  onOpenMobileMenu,
  onNavigateTab,
  onOpenAuthModal,
}) => {
  const { user, theme, toggleTheme } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showSearchMenu, setShowSearchMenu] = useState(false);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const periodRef = useRef<HTMLDivElement>(null);

  const tabTitles: Record<NavTab, string> = {
    dashboard: 'Bosh sahifa',
    income: 'Kirimlar',
    expense: 'Chiqimlar',
    ai: 'AI Yordamchi',
    wallets: 'Hamyonlar',
    family: 'Oilaviy budjet',
    subscriptions: 'Obunalar',
    recurring: 'Avto-toʻlovlar',
    receipts: 'Chek skaneri',
    forecast: 'AI Prognoz',
    currencies: 'Valyutalar',
    banks: 'Banklar',
    reports: 'Hisobotlar',
    telegram: 'Telegram Bot',
    settings: 'Sozlamalar',
    budgets: 'Budjetlar',
    goals: 'Maqsadlar',
    debts: 'Qarzlar daftari',
  };

  const now = new Date();
  const monthNamesUz = [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ];
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const periodOptions: { id: DashboardPeriod; label: string }[] = [
    { id: 'this_month', label: `${monthNamesUz[now.getMonth()]}, ${now.getFullYear()}` },
    {
      id: 'last_month',
      label: `${monthNamesUz[prevMonthDate.getMonth()]}, ${prevMonthDate.getFullYear()}`,
    },
    { id: '7days', label: 'Soʻnggi 7 kun' },
    { id: '30days', label: 'Soʻnggi 30 kun' },
    { id: 'this_year', label: `${now.getFullYear()} yil` },
  ];

  const activePeriodLabel =
    periodOptions.find((p) => p.id === selectedPeriod)?.label || periodOptions[0].label;

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
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) setShowNotifMenu(false);
      if (searchRef.current && !searchRef.current.contains(target)) setShowSearchMenu(false);
      if (periodRef.current && !periodRef.current.contains(target)) setShowPeriodMenu(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifMenu(false);
        setShowSearchMenu(false);
        setShowPeriodMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return transactions.slice(0, 5);
    return transactions
      .filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.categoryName.toLowerCase().includes(q) ||
          (t.walletName && t.walletName.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [transactions, searchQuery]);

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

  const displayName = user?.fullName || 'Foydalanuvchi';

  return (
    <header className="mb-4 sm:mb-5 flex min-w-0 items-center justify-between gap-2 sm:gap-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-[#0B1D20]/80 px-3 py-2.5 sm:px-5 sm:py-3 backdrop-blur-xl sticky top-2 z-30 shadow-xs dark:shadow-none">
      {/* Left: Hamburger + Icon + HISOBOT AI PREMIUM + Assalomu alaykum */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Navigatsiya menyusini ochish"
          className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 lg:hidden cursor-pointer"
        >
          <Menu size={20} />
        </button>

        <button
          type="button"
          onClick={() => (user ? onNavigateTab('dashboard') : onOpenAuthModal())}
          className="flex items-center gap-3 text-left min-w-0 cursor-pointer"
        >
          <div className="hidden h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 sm:flex shrink-0">
            <ChartNoAxesCombined size={20} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{currentTab === 'dashboard' ? 'HISOBOT AI' : tabTitles[currentTab]}</span>
              <span className="rounded-md border border-emerald-500/40 dark:border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                {user?.isPremium ? 'PREMIUM' : 'PRO'}
              </span>
            </div>
            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {user ? `Assalomu alaykum, ${displayName} 👋` : 'Tizimga kiring'}
            </div>
          </div>
        </button>
      </div>

      {/* Right Controls: Search, Bell, Theme Toggle, Period Selector */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Search Popover */}
        <div className="relative" ref={searchRef}>
          <button
            type="button"
            aria-label="Qidiruv"
            aria-expanded={showSearchMenu}
            onClick={() => {
              setShowSearchMenu((prev) => !prev);
              setShowNotifMenu(false);
              setShowPeriodMenu(false);
            }}
            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Search size={18} />
          </button>

          {showSearchMenu && (
            <GlassPanel
              intensity="medium"
              className="absolute right-0 mt-2 w-[calc(100vw-24px)] max-w-sm overflow-hidden z-50 hai-scale-in p-3 space-y-2.5"
            >
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Operatsiya yoki toifa qidirish..."
                  className="w-full min-h-10 pl-9 pr-8 rounded-xl bg-slate-100 dark:bg-[#071B18] border border-slate-200 dark:border-white/[0.10] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Qidiruvni tozalash"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                {searchResults.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Mos tranzaksiya topilmadi
                  </div>
                ) : (
                  searchResults.map((tx) => (
                    <button
                      type="button"
                      key={tx.id}
                      onClick={() => {
                        onEditTransaction(tx);
                        setShowSearchMenu(false);
                      }}
                      className="w-full py-2.5 px-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {tx.categoryName} · {formatDateUz(tx.date)}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-bold tabular-nums shrink-0 ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatMoney(tx.amount)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </GlassPanel>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label="Bildirishnomalar"
            aria-expanded={showNotifMenu}
            onClick={() => {
              setShowNotifMenu((prev) => !prev);
              setShowSearchMenu(false);
              setShowPeriodMenu(false);
            }}
            className="relative rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} ta oʻqilmagan bildirishnoma`}
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-400"
              />
            )}
          </button>

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

        {/* Theme Switcher */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Mavzuni almashtirish"
          title={theme === 'dark' ? 'Yorugʻ rejim' : 'Qorongʻi rejim'}
          className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.05] p-2 text-emerald-600 dark:text-emerald-300 hover:border-emerald-500/40 transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Period Dropdown ("Noyabr, 2026 v") */}
        <div className="relative hidden sm:block" ref={periodRef}>
          <button
            type="button"
            onClick={() => {
              setShowPeriodMenu((prev) => !prev);
              setShowNotifMenu(false);
              setShowSearchMenu(false);
            }}
            aria-expanded={showPeriodMenu}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-emerald-500/40 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Calendar size={14} className="text-emerald-500 shrink-0" />
            <span>{activePeriodLabel}</span>
            <ChevronDown size={14} className="text-slate-400 shrink-0" />
          </button>

          {showPeriodMenu && (
            <GlassPanel
              intensity="medium"
              className="absolute right-0 mt-2 w-48 p-1.5 z-50 hai-scale-in"
            >
              {periodOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => {
                    onSelectPeriod(opt.id);
                    setShowPeriodMenu(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-left text-xs font-semibold transition-colors cursor-pointer ${
                    selectedPeriod === opt.id
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </GlassPanel>
          )}
        </div>
      </div>
    </header>
  );
};
