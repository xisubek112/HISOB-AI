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
  Clock,
  Repeat,
  Receipt,
  TrendingUp,
  Coins,
  Building2,
  Send,
  Crown,
  ChevronRight,
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

  const navSections: {
    title: string;
    items: { id: NavTab; label: string; icon: React.ElementType; isAi?: boolean }[];
  }[] = [
    {
      title: 'Boshqaruv',
      items: [
        { id: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
        { id: 'income', label: 'Kirimlar', icon: ArrowDownLeft },
        { id: 'expense', label: 'Chiqimlar', icon: ArrowUpRight },
        { id: 'wallets', label: 'Hamyonlar', icon: Wallet },
        { id: 'ai', label: 'AI Yordamchi', icon: Bot, isAi: true },
      ],
    },
    {
      title: 'Reja va Moliya',
      items: [
        { id: 'budgets', label: 'Budjet limitlari', icon: PieChart },
        { id: 'goals', label: 'Maqsadlar', icon: Target },
        { id: 'debts', label: 'Qarzlar daftari', icon: HandCoins },
        { id: 'family', label: 'Oilaviy budjet', icon: Users },
        { id: 'subscriptions', label: 'Obunalar', icon: Clock },
        { id: 'recurring', label: 'Avtomatik toʻlovlar', icon: Repeat },
      ],
    },
    {
      title: 'Tahlil va Tizim',
      items: [
        { id: 'reports', label: 'Hisobotlar', icon: BarChart3 },
        { id: 'forecast', label: 'AI Prognoz', icon: TrendingUp, isAi: true },
        { id: 'receipts', label: 'Chek skaneri', icon: Receipt },
        { id: 'currencies', label: 'Valyuta kurslari', icon: Coins },
        { id: 'banks', label: 'Banklar va Import', icon: Building2 },
        { id: 'telegram', label: 'Telegram Bot', icon: Send },
        { id: 'settings', label: 'Sozlamalar', icon: Settings },
      ],
    },
  ];

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          aria-hidden="true"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-[#081220]/65 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        aria-label="Asosiy navigatsiya"
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 lg:z-20 w-[272px] lg:w-64 bg-white dark:bg-[#0D1927] border-r border-slate-200/85 dark:border-white/[0.08] flex flex-col justify-between transition-transform duration-200 ease-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl p-1 -ml-1 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-[#081220] border border-emerald-500/35 flex items-center justify-center shrink-0">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="13" width="3.5" height="7" rx="1.2" fill="#10B981" opacity="0.75" />
                  <rect x="8.5" y="9" width="3.5" height="11" rx="1.2" fill="#10B981" />
                  <rect x="14" y="5" width="3.5" height="15" rx="1.2" fill="#06B6D4" />
                  <path
                    d="M3.5 10.5L9.5 6.5L15 3.5L20 2.5"
                    stroke="#34D399"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="font-extrabold text-[15px] tracking-tight text-slate-900 dark:text-white block leading-none whitespace-nowrap">
                  HISOBOT AI
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1 truncate">
                  Smart money. Clear future.
                </span>
              </div>
            </button>

            <button
              type="button"
              aria-label="Menyuni yopish"
              onClick={onCloseMobile}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sections */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
            {navSections.map((sec) => (
              <div key={sec.title} className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
                  {sec.title}
                </div>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full min-h-10 flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors duration-150 cursor-pointer relative ${
                        isActive
                          ? item.isAi
                            ? 'bg-cyan-500/12 text-cyan-800 dark:text-cyan-300 font-semibold'
                            : 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 font-semibold'
                          : 'text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100/80 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full ${
                            item.isAi ? 'bg-cyan-500' : 'bg-emerald-500'
                          }`}
                        />
                      )}

                      <Icon
                        className={`w-[18px] h-[18px] shrink-0 ${
                          isActive
                            ? item.isAi
                              ? 'text-cyan-600 dark:text-cyan-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                            : item.isAi
                            ? 'text-cyan-600/80 dark:text-cyan-400/80'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Calm Bottom Dock: Subscription Link + User Account */}
          <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.07] space-y-2 shrink-0 pb-safe lg:pb-3">
            {onOpenPremiumModal && (
              <button
                type="button"
                onClick={() => {
                  onOpenPremiumModal();
                  onCloseMobile();
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200/85 dark:border-white/[0.08] bg-slate-50/75 dark:bg-white/[0.03] hover:border-amber-500/40 transition-colors flex items-center justify-between gap-2 text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      user?.isPremium
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                        : 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                      {user?.isPremium
                        ? `HISOBOT ${user.premiumPlan?.toUpperCase() || 'PRO'}`
                        : 'HISOBOT Pro'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {user?.isPremium ? 'Obuna faol' : 'Tariflarni koʻrish'}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            )}

            {user ? (
              <div className="p-2 rounded-xl bg-slate-50/75 dark:bg-white/[0.03] border border-slate-200/75 dark:border-white/[0.07] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleNavClick('settings')}
                  className="flex items-center gap-2.5 text-left overflow-hidden flex-1 group cursor-pointer"
                >
                  <img
                    src={user.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                    alt={user.fullName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-white/15"
                  />
                  <div className="overflow-hidden min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
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
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer"
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
                className="w-full min-h-10 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
