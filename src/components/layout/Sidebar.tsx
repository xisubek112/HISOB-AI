/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Bot,
  BarChart3,
  PieChart,
  Target,
  HandCoins,
  Settings,
  LogOut,
  X,
  Wallet,
  Users,
  CalendarClock,
  Repeat,
  ScanLine,
  TrendingUp,
  Coins,
  Building2,
  Send,
  Crown,
  ChartNoAxesCombined,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

export type NavTab =
  | 'dashboard'
  | 'income'
  | 'expense'
  | 'ai'
  | 'wallets'
  | 'family'
  | 'subscriptions'
  | 'recurring'
  | 'receipts'
  | 'forecast'
  | 'currencies'
  | 'banks'
  | 'reports'
  | 'telegram'
  | 'settings'
  | 'budgets'
  | 'goals'
  | 'debts';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenAuthModal: () => void;
  onOpenPremiumModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  onOpenAuthModal,
  onOpenPremiumModal,
}) => {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!isOpenMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseMobile();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  const primaryItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
    { id: 'income', label: 'Kirimlar', icon: ArrowDownLeft },
    { id: 'expense', label: 'Chiqimlar', icon: ArrowUpRight },
    { id: 'wallets', label: 'Hamyonlar', icon: Wallet },
    { id: 'reports', label: 'Analitika', icon: ChartNoAxesCombined },
    { id: 'ai', label: 'AI yordamchi', icon: Bot },
    { id: 'family', label: 'Oilaviy budjet', icon: Users },
    { id: 'subscriptions', label: 'Obunalar', icon: CalendarClock },
    { id: 'receipts', label: 'Chek skaneri', icon: ScanLine },
    { id: 'goals', label: 'Maqsadlar', icon: Target },
  ];

  const secondaryItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'budgets', label: 'Budjetlar', icon: PieChart },
    { id: 'debts', label: 'Qarzlar', icon: HandCoins },
    { id: 'forecast', label: 'AI Prognoz', icon: TrendingUp },
    { id: 'recurring', label: 'Avto-toʻlovlar', icon: Repeat },
    { id: 'currencies', label: 'Valyutalar', icon: Coins },
    { id: 'banks', label: 'Banklar', icon: Building2 },
    { id: 'telegram', label: 'Telegram Bot', icon: Send },
    { id: 'settings', label: 'Sozlamalar', icon: Settings },
  ];

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  const renderNavItem = (item: { id: NavTab; label: string; icon: React.ElementType }) => {
    const Icon = item.icon;
    const isActive = currentTab === item.id;

    return (
      <button
        type="button"
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-all cursor-pointer ${
          isActive
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 font-bold text-[#03251C] shadow-[0_5px_22px_rgba(16,185,129,0.22)]'
            : 'text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <Icon className="w-[17px] h-[17px] shrink-0" />
        <span className="truncate whitespace-nowrap">{item.label}</span>
        {isActive && (
          <span
            aria-hidden="true"
            className="ml-auto h-1.5 w-1.5 rounded-full bg-[#064B38] shrink-0"
          />
        )}
      </button>
    );
  };

  return (
    <>
      {isOpenMobile && (
        <div
          aria-hidden="true"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#061411]/75 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        aria-label="Asosiy navigatsiya"
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-20 w-[256px] lg:w-[244px] bg-white dark:bg-[#071B18]/90 backdrop-blur-xl border-r border-slate-200/80 dark:border-white/[0.08] flex flex-col justify-between transition-transform duration-200 ease-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full min-h-0 px-4 py-5">
          {/* Brand Header matching DashboardElite */}
          <div className="mb-7 flex items-center justify-between gap-2 px-1 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl cursor-pointer min-w-0"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-emerald-600 shadow-[0_0_28px_rgba(16,185,129,0.35)]">
                <BarChart3 className="h-6 w-6 text-[#05251D]" />
              </div>
              <div className="min-w-0">
                <div className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white leading-none whitespace-nowrap">
                  HISOBOT AI
                </div>
                <div className="text-[10px] text-emerald-700/75 dark:text-emerald-200/65 mt-1 truncate">
                  Smart money. Clear future.
                </div>
              </div>
            </button>

            <button
              type="button"
              aria-label="Menyuni yopish"
              onClick={onCloseMobile}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-2.5 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 shrink-0">
            Asosiy menyu
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 overflow-y-auto space-y-3 pr-0.5">
            <div className="space-y-1">{primaryItems.map(renderNavItem)}</div>

            <div className="border-t border-slate-200/80 dark:border-white/[0.08] pt-3 space-y-1">
              {secondaryItems.map(renderNavItem)}
            </div>
          </nav>

          {/* Bottom HISOBOT PREMIUM Card + Profile */}
          <div className="pt-4 space-y-3 shrink-0 pb-safe lg:pb-0">
            {onOpenPremiumModal && (
              <div className="rounded-2xl border border-emerald-500/25 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-500/12 to-teal-500/[0.04] p-3.5">
                <div className="mb-1.5 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <Crown size={16} />
                  <span className="text-xs font-bold">
                    {user?.isPremium ? 'HISOBOT PRO FAOL' : 'HISOBOT PREMIUM'}
                  </span>
                </div>
                <p className="mb-2.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  {user?.isPremium
                    ? 'Barcha cheksiz AI tahlil imkoniyatlari yoqilgan.'
                    : 'Moliyaviy imkoniyatlaringizni kengaytiring.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenPremiumModal();
                    onCloseMobile();
                  }}
                  className="w-full rounded-lg bg-emerald-500 dark:bg-emerald-400 hover:bg-emerald-400 dark:hover:bg-emerald-300 px-3 py-2 text-xs font-bold text-[#05251D] transition-colors cursor-pointer"
                >
                  Batafsil
                </button>
              </div>
            )}

            {user ? (
              <div className="flex items-center justify-between gap-2 px-1 pt-1 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleNavClick('settings')}
                  className="flex items-center gap-2.5 text-left min-w-0 flex-1 group cursor-pointer"
                >
                  <img
                    src={user.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                    alt={user.fullName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-emerald-500/30"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-emerald-500">
                      {user.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  aria-label="Tizimdan chiqish"
                  title="Tizimdan chiqish"
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors shrink-0 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onOpenAuthModal();
                  onCloseMobile();
                }}
                className="w-full min-h-10 px-3 bg-emerald-500 hover:bg-emerald-400 text-[#05251D] rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Kirish / Roʻyxatdan oʻtish
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
