/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  ChevronRight,
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
  Sparkles,
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

  // The 15 core requested navigation items
  const navSections: {
    title: string;
    items: { id: NavTab; label: string; icon: React.ElementType; badge?: string }[];
  }[] = [
    {
      title: 'Asosiy',
      items: [
        { id: 'dashboard', label: 'Bosh sahifa', icon: LayoutDashboard },
        { id: 'income', label: 'Kirimlar', icon: ArrowDownLeft },
        { id: 'expense', label: 'Chiqimlar', icon: ArrowUpRight },
        { id: 'ai', label: 'AI Financial Brain', icon: Bot, badge: 'Aqlli' },
        { id: 'wallets', label: 'Hamyonlar va Kartalar', icon: Wallet },
      ],
    },
    {
      title: 'Moliya va Rejalashtirish',
      items: [
        { id: 'family', label: 'Oilaviy budjet', icon: Users },
        { id: 'subscriptions', label: 'Muntazam obunalar', icon: Clock },
        { id: 'recurring', label: 'Avtomatik toʻlovlar', icon: Repeat },
        { id: 'receipts', label: 'Chek skaneri (OCR)', icon: Receipt, badge: 'Yangi' },
        { id: 'forecast', label: 'AI Prognozlash', icon: TrendingUp },
      ],
    },
    {
      title: 'Integratsiyalar va Tahlil',
      items: [
        { id: 'currencies', label: 'Valyuta kurslari', icon: Coins },
        { id: 'banks', label: 'Banklar va Import', icon: Building2 },
        { id: 'reports', label: 'Hisobotlar va Eksport', icon: BarChart3 },
        { id: 'telegram', label: 'Telegram Bot', icon: Send },
        { id: 'settings', label: 'Sozlamalar', icon: Settings },
      ],
    },
    {
      title: 'Boshqa boʻlimlar',
      items: [
        { id: 'budgets', label: 'Budjet limitlari', icon: PieChart },
        { id: 'goals', label: 'Jamgʻarma maqsadlari', icon: Target },
        { id: 'debts', label: 'Qarzlar daftari', icon: HandCoins },
      ],
    },
  ];

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top: Brand Header */}
        <div className="flex flex-col h-full min-h-0">
          <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-base shadow-sm">
                H
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white block leading-tight">
                  HISOBOT AI
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-tight">
                  Moliyangizni aqlli boshqaring
                </span>
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links scrollable viewport */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-4">
            {navSections.map((sec, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {sec.title}
                </div>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  const isAi = item.id === 'ai';

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                        isActive
                          ? isAi
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                            isActive
                              ? 'text-current'
                              : isAi
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && !isActive && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 shrink-0">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-70 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Premium Plan Card */}
          {onOpenPremiumModal && (
            <div className="px-3 pb-2 shrink-0">
              <div
                onClick={onOpenPremiumModal}
                className={`p-3 rounded-2xl cursor-pointer transition-all duration-200 border relative overflow-hidden group ${
                  user?.isPremium
                    ? 'bg-gradient-to-br from-amber-500/10 via-yellow-500/10 to-amber-600/15 border-amber-400/40 hover:border-amber-400/70 dark:bg-amber-950/20'
                    : 'bg-gradient-to-br from-blue-600/10 via-indigo-600/10 to-purple-600/10 border-blue-500/20 hover:border-blue-500/50 dark:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 ${
                      user?.isPremium ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'
                    }`}>
                      <Crown className="w-3 h-3 fill-current" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {user?.isPremium ? `HISOBOT ${user.premiumPlan?.toUpperCase() || 'PRO'}` : 'HISOBOT AI Pro'}
                    </span>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider ${
                    user?.isPremium
                      ? 'bg-amber-400 text-amber-950'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {user?.isPremium ? 'Faol' : 'Tariflar'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mb-2">
                  {user?.isPremium
                    ? 'Barcha AI va kengaytirilgan vositalar ochiq.'
                    : 'Cheksiz AI tahlil, OCR skaner va 10 ta hamyon.'}
                </p>
                <div className="flex items-center justify-between text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                  <span>{user?.isPremium ? 'Obuna holatini koʻrish' : '39 000 soʻm/oydan'}</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          )}

          {/* Bottom: User Profile / Auth */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
            {user ? (
              <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
                <button
                  onClick={() => handleNavClick('settings')}
                  className="flex items-center gap-2.5 text-left overflow-hidden flex-1 group"
                >
                  <img
                    src={user.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                    alt={user.fullName}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                  />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {user.fullName}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                      {user.email}
                    </div>
                  </div>
                </button>
                <button
                  onClick={logout}
                  title="Tizimdan chiqish"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuthModal}
                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
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
