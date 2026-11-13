/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  Wallet,
  Plus,
  ChartNoAxesCombined,
  CircleUserRound,
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
  const isDashboard = currentTab === 'dashboard';
  const isWallets = currentTab === 'wallets';
  const isAnalytics = ['reports', 'forecast', 'budgets'].includes(currentTab);
  const isProfile = currentTab === 'settings';

  const items: {
    id: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    isAdd?: boolean;
    onClick: () => void;
  }[] = [
    {
      id: 'dashboard',
      label: 'Bosh',
      icon: Home,
      active: isDashboard,
      onClick: () => onSelectTab('dashboard'),
    },
    {
      id: 'wallets',
      label: 'Hamyon',
      icon: Wallet,
      active: isWallets,
      onClick: () => onSelectTab('wallets'),
    },
    {
      id: 'add',
      label: 'Qoʻshish',
      icon: Plus,
      active: false,
      isAdd: true,
      onClick: onOpenQuickAdd,
    },
    {
      id: 'analytics',
      label: 'Tahlil',
      icon: ChartNoAxesCombined,
      active: isAnalytics,
      onClick: () => onSelectTab('reports'),
    },
    {
      id: 'profile',
      label: 'Profil',
      icon: CircleUserRound,
      active: isProfile,
      onClick: () => onSelectTab('settings'),
    },
  ];

  return (
    <nav
      aria-label="Mobil pastki navigatsiya"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#071B18]/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-2xl"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              aria-current={item.active ? 'page' : undefined}
              className={`flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-semibold transition-colors cursor-pointer ${
                item.active
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl transition-transform active:scale-95 ${
                  item.isAdd
                    ? 'bg-emerald-500 dark:bg-emerald-400 text-[#05251D] shadow-[0_0_18px_rgba(16,185,129,0.35)]'
                    : item.active
                    ? 'bg-emerald-500/15 dark:bg-emerald-400/10'
                    : ''
                }`}
              >
                <Icon size={19} />
              </span>
              <span className="leading-none whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
