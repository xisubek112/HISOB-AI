/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  Wallet,
  Plus,
  BarChart3,
  User,
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';

interface MobileBottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQuickAdd: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ElementType; matchTabs?: NavTab[] }[] = [
    { id: 'dashboard', label: 'Bosh', icon: Home },
    { id: 'wallets', label: 'Hamyon', icon: Wallet },
    { id: 'reports', label: 'Tahlil', icon: BarChart3, matchTabs: ['reports', 'forecast', 'budgets'] },
    { id: 'settings', label: 'Profil', icon: User },
  ];

  const isTabActive = (item: (typeof navItems)[number]) =>
    currentTab === item.id || (item.matchTabs?.includes(currentTab) ?? false);

  return (
    <nav
      aria-label="Mobil pastki navigatsiya"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/92 dark:bg-[#0D1927]/94 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[0.08] pb-safe"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto h-14 px-2">
        {navItems.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = isTabActive(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-11 rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold leading-none whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}

        {/* Central Elevated Quick-Add CTA */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenQuickAdd}
            aria-label="Tezkor operatsiya qoʻshish"
            className="w-11 h-11 -mt-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-[0_8px_22px_rgba(16,185,129,0.34)] ring-4 ring-[#F4F7F8] dark:ring-[#081220] transition-transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {navItems.slice(2).map((item) => {
          const Icon = item.icon;
          const active = isTabActive(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-11 rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-semibold leading-none whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
