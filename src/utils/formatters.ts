/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Category, CurrencyCode, PaymentMethod } from '../types/finance.ts';

export const DEFAULT_INCOME_CATEGORIES: Omit<Category, 'userId'>[] = [
  { id: 'inc_salary', name: 'Oylik maosh', type: 'income', icon: 'Briefcase', color: '#10B981' },
  { id: 'inc_business', name: 'Biznes', type: 'income', icon: 'Building2', color: '#059669' },
  { id: 'inc_freelance', name: 'Frilans', type: 'income', icon: 'Laptop', color: '#34D399' },
  { id: 'inc_investment', name: 'Investitsiyalar', type: 'income', icon: 'TrendingUp', color: '#047857' },
  { id: 'inc_gifts', name: 'Sovgʻalar', type: 'income', icon: 'Gift', color: '#6EE7B7' },
  { id: 'inc_other', name: 'Boshqa daromadlar', type: 'income', icon: 'Coins', color: '#14B8A6' },
];

export const DEFAULT_EXPENSE_CATEGORIES: Omit<Category, 'userId'>[] = [
  { id: 'exp_food', name: 'Oziq-ovqat va kafe', type: 'expense', icon: 'Utensils', color: '#EF4444' },
  { id: 'exp_transport', name: 'Transport va yoqilgʻi', type: 'expense', icon: 'Car', color: '#F97316' },
  { id: 'exp_shopping', name: 'Xaridlar va kiyim', type: 'expense', icon: 'ShoppingBag', color: '#F59E0B' },
  { id: 'exp_housing', name: 'Uy-joy va ijara', type: 'expense', icon: 'Home', color: '#DC2626' },
  { id: 'exp_bills', name: 'Kommunal toʻlovlar', type: 'expense', icon: 'Receipt', color: '#EA580C' },
  { id: 'exp_health', name: 'Salomatlik va dori', type: 'expense', icon: 'HeartPulse', color: '#E11D48' },
  { id: 'exp_education', name: 'Taʼlim va kurslar', type: 'expense', icon: 'GraduationCap', color: '#06B6D4' },
  { id: 'exp_entertainment', name: 'Hordiq va koʻngilochar', type: 'expense', icon: 'Film', color: '#F59E0B' },
  { id: 'exp_travel', name: 'Sayohat', type: 'expense', icon: 'Plane', color: '#3B82F6' },
  { id: 'exp_other', name: 'Boshqa xarajatlar', type: 'expense', icon: 'CreditCard', color: '#64748B' },
];

export const PAYMENT_METHODS_MAP: Record<PaymentMethod, { label: string; icon: string }> = {
  card: { label: 'Bank kartasi (Humo/Uzcard/Visa)', icon: 'CreditCard' },
  cash: { label: 'Naqd pul', icon: 'Banknote' },
  bank: { label: 'Bank oʻtkazmasi', icon: 'Building' },
  other: { label: 'Boshqa', icon: 'Wallet' },
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  UZS: 'soʻm',
  USD: '$',
  EUR: '€',
  RUB: '₽',
  GBP: '£',
  TRY: '₺',
  KZT: '₸',
};

// Standard live Central Bank of Uzbekistan (CBU) rates
export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  UZS: 1,
  USD: 12850,
  EUR: 13920,
  RUB: 132,
  GBP: 16650,
  TRY: 375,
  KZT: 26.5,
};

export function formatMoney(amount: number, currency: CurrencyCode = 'UZS'): string {
  const safeAmount = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('uz-UZ').format(safeAmount).replace(/,/g, ' ');

  switch (currency) {
    case 'USD':
      return `$${formatted}`;
    case 'EUR':
      return `€${formatted}`;
    case 'RUB':
      return `${formatted} ₽`;
    case 'GBP':
      return `£${formatted}`;
    case 'TRY':
      return `${formatted} ₺`;
    case 'KZT':
      return `${formatted} ₸`;
    case 'UZS':
    default:
      return `${formatted} soʻm`;
  }
}

export function formatDateUz(dateString: string): string {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.getTime() === today.getTime()) return 'Bugun';
    if (date.getTime() === yesterday.getTime()) return 'Kecha';

    const monthsUz = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
    ];

    return `${day}-${monthsUz[month - 1]}, ${year}`;
  } catch {
    return dateString;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
