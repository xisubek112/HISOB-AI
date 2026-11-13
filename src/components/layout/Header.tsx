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
  Plus,
  Bot,
  Mic,
  Crown,
  Sparkles,
  Check,
  CheckCheck,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { NavTab } from './Sidebar.tsx';
import { NotificationItem } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatDateUz } from '../../utils/formatters.ts';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileMenu: () => void;
  onOpenTransactionModal: (type: 'income' | 'expense') => void;
  onOpenVoiceModal?: () => void;
  onOpenAI: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onOpenAuthModal: () => void;
  onOpenPremiumModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileMenu,
  onOpenTransactionModal,
  onOpenVoiceModal,
  onOpenAI,
  onNavigateTab,
  onOpenAuthModal,
  onOpenPremiumModal,
}) => {
  const { user, theme, toggleTheme } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Bosh sahifa', subtitle: 'Umumiy moliyaviy koʻrsatkichlar va tahlil' },
    income: { title: 'Kirimlar', subtitle: 'Barcha daromadlar va tushumlar hisobi' },
    expense: { title: 'Chiqimlar', subtitle: 'Barcha xarajatlar va toʻlovlar monitoringi' },
    ai: { title: 'AI Financial Brain', subtitle: 'Oʻzbek tilidagi tabiiy aqlli moliyaviy maslahatchi' },
    wallets: { title: 'Hamyonlar va Kartalar', subtitle: 'Mablagʻlarni kartalar, hisoblar va naqd pullar boʻyicha taqsimlash' },
    family: { title: 'Oilaviy budjet', subtitle: 'Oila aʼzolari bilan birgalikda moliyaviy rejalashtirish' },
    subscriptions: { title: 'Muntazam obunalar', subtitle: 'Oylik va yillik servis toʻlovlari nazorati' },
    recurring: { title: 'Avtomatik toʻlovlar', subtitle: 'Takroriy ijara, maosh va toʻlovlar jadvali' },
    receipts: { title: 'AI Chek skaneri (OCR)', subtitle: 'Fiskal cheklarni rasm orqali bir zumda kiritish' },
    forecast: { title: 'AI Moliyaviy Prognozlash', subtitle: '3 oylik moliyaviy ssenariylar va ehtimoliy qoldiq tahlili' },
    currencies: { title: 'Valyuta kurslari', subtitle: 'Markaziy Bank rasmiy kurslari va valyuta kalkulyatori' },
    banks: { title: 'Banklar va Import', subtitle: 'Uzum, Click, Payme va milliy bank hisoblarini ulash' },
    reports: { title: 'Hisobotlar va Eksport', subtitle: 'Davriy moliyaviy tahlil, taqqoslash va Excel/PDF eksport' },
    telegram: { title: 'Telegram Bot', subtitle: 'Xabarnomalar va Telegram orqali moliyaviy boshqaruv' },
    settings: { title: 'Sozlamalar', subtitle: 'Profil, xavfsizlik va tizim parametrlari' },
    budgets: { title: 'Budjet', subtitle: 'Oylik xarajatlar limiti va nazorati' },
    goals: { title: 'Jamgʻarma maqsadlari', subtitle: 'Orzularingiz uchun maqsadli jamgʻarma' },
    debts: { title: 'Qarzlar va majburiyatlar', subtitle: 'Olingan va berilgan qarzlar hisob-kitobi' },
  };

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
    } catch {
      // ignore
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  return (
    <header className="h-16 px-3 sm:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 min-w-0">
      {/* Zone 1: Section Title and Mobile Menu */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="truncate">
          <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
            {tabTitles[currentTab]?.title || 'HISOBOT AI'}
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block truncate">
            {tabTitles[currentTab]?.subtitle}
          </p>
        </div>
      </div>

      {/* Zone 2: Fast Action Shortcuts */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {onOpenVoiceModal && (
          <button
            onClick={onOpenVoiceModal}
            title="Ovozli tranzaksiya kiritish"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ovoz bilan</span>
          </button>
        )}

        <button
          onClick={onOpenAI}
          title="AI yordamchiga yozish"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors whitespace-nowrap shrink-0"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>AI orqali qoʻshish</span>
        </button>

        <button
          onClick={() => onOpenTransactionModal('income')}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden sm:inline">Kirim</span>
        </button>

        <button
          onClick={() => onOpenTransactionModal('expense')}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
          <span className="hidden sm:inline">Chiqim</span>
        </button>

        {/* Premium Upgrade / Badge Button */}
        {onOpenPremiumModal && (
          <button
            onClick={onOpenPremiumModal}
            title={user?.isPremium ? `HISOBOT AI ${user.premiumPlan?.toUpperCase()} hisobi` : "Premium tarifiga oʻtish"}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shrink-0 shadow-xs ${
              user?.isPremium
                ? 'bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border border-amber-400/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25'
                : 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white shadow-amber-500/20 hover:shadow-md'
            }`}
          >
            <Crown className={`w-3.5 h-3.5 ${user?.isPremium ? 'text-amber-500 fill-amber-500' : 'fill-white text-white'}`} />
            <span className="font-extrabold uppercase tracking-wider text-[11px]">
              {user?.isPremium ? (user.premiumPlan?.toUpperCase() || 'PRO') : 'Premium'}
            </span>
          </button>
        )}

        <div className="h-4 w-px bg-slate-200 dark:border-slate-800 mx-1 hidden sm:block" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Yorugʻ rejim' : 'Tungi rejim'}
          className="p-2 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            title="Bildirishnomalar"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative shrink-0"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    Bildirishnomalar
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 font-mono">
                      {unreadCount} yangi
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Hammasini oʻqilgan qilish
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Bildirishnomalar mavjud emas
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkOneRead(n.id, n.linkTab)}
                      className={`p-3.5 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        !n.isRead ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                          {formatDateUz(n.date)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile button */}
        {!user && (
          <button
            onClick={onOpenAuthModal}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors shrink-0"
          >
            Kirish
          </button>
        )}
      </div>
    </header>
  );
};
