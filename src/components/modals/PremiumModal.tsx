/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Crown,
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  CreditCard,
  Building2,
  Users,
  Bot,
  Receipt,
  TrendingUp,
  FileSpreadsheet,
  Send,
  ArrowRight,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'click' | 'payme' | 'uzum' | 'card'>('click');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isCurrentPlan = (plan: 'free' | 'pro' | 'business') => {
    if (plan === 'free' && (!user?.isPremium || user?.premiumPlan === 'free')) return true;
    return user?.isPremium && user?.premiumPlan === plan;
  };

  const handleUpgrade = async () => {
    setLoading(true);
    setSuccessMessage(null);
    try {
      const durationMonths = billingCycle === 'yearly' ? 12 : 1;
      const res = await api.upgradeToPremium(selectedPlan, durationMonths);
      
      // Trigger confetti celebration
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
      });

      if (res?.user) {
        updateUser(res.user);
      }

      setSuccessMessage(
        `Tabriklaymiz! HISOBOT AI ${selectedPlan === 'pro' ? 'PRO' : 'BUSINESS'} obunasi muvaffaqiyatli faollashtirildi.`
      );

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2200);
    } catch (err: any) {
      console.error('Upgrade failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      id: 'free' as const,
      name: 'Bepul',
      badge: 'Boshlangʻich',
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: 'Shaxsiy kundalik xarajatlarni sodda qayd etish uchun',
      features: [
        '1 ta asosiy hamyon',
        'Cheklangan kirim va chiqimlar',
        'Oddiy oylik tahliliy grafiklar',
        'Cheklangan AI Financial Brain soʻrovlari',
        'Standart veb interfeys',
      ],
      notIncluded: [
        'AI Chek skaneri (OCR)',
        '3 oylik moliyaviy prognoz',
        'Oilaviy budjet hamkorligi',
        'Telegram bot sinxronizatsiyasi',
        'Excel va PDF kengaytirilgan eksport',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Pro Tavsiya',
      badge: 'Eng Ommabop',
      popular: true,
      monthlyPrice: 39000,
      yearlyPrice: 390000, // 2 months free
      description: 'Moliyasini toʻliq nazorat qiluvchi va AI quvvatidan foydalanuvchilar uchun',
      features: [
        'Cheksiz hamyonlar va kartalar (Uzum, Click, Payme)',
        'AI Ovozli tranzaksiya kiritish (Oʻzbek, Rus, Ingliz)',
        'Cheksiz AI Chek skaneri (Fiskal QR & OCR)',
        '3 oylik AI Moliyaviy prognozlash va maslahatlar',
        'Telegram Bot toʻliq integratsiyasi & bildirishnomalar',
        'Kengaytirilgan Excel (XLSX) va PDF hisobotlar',
        'Avtomatik toʻlovlar & muntazam obunalar nazorati',
        'Markaziy Bank avtomatik valyuta kurslari',
      ],
      notIncluded: [
        '10 nafargacha oila yoki jamoa aʼzolari',
      ],
    },
    {
      id: 'business' as const,
      name: 'Business & Oila',
      badge: 'Maksimal Quvvat',
      monthlyPrice: 79000,
      yearlyPrice: 790000,
      description: 'Katta oilalar, frilanserlar va kichik biznes boshqaruvi uchun',
      features: [
        'Pro dagi barcha imkoniyatlar toʻliq hajmda',
        '10 nafargacha oila yoki jamoa aʼzolarini ulash',
        'Rollar va ruxsatlar (Owner, Admin, Member, Viewer)',
        'Guruhli umumiy va shaxsiy xarajatlar balansi',
        'Koʻp hisobli bank integratsiyalari',
        'Prioritetli 24/7 VIP mijozlarni qoʻllab-quvvatlash',
        'Kengaytirilgan xavfsizlik va PIN kod himoyasi',
      ],
      notIncluded: [],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden my-auto">
        {/* Glow ambient accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-r from-blue-500/20 via-amber-500/20 to-purple-500/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative p-6 sm:p-8 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold mb-3">
              <Crown className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>HISOBOT AI Premium xizmati</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Moliyangizni eng yuqori darajada boshqaring
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">
              Barcha AI vositalari, chek skaneri, oilaviy hisob va cheksiz tahlillardan hech qanday cheklovlarsiz foydalaning.
            </p>

            {/* Billing cycle switch */}
            <div className="mt-5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Oylik toʻlov
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Yillik toʻlov</span>
                <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                  2 oy bepul
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="mx-6 sm:mx-8 mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isUserCurrent = isCurrentPlan(plan.id);
            const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
            const periodLabel = billingCycle === 'yearly' ? '/yil' : '/oy';

            return (
              <div
                key={plan.id}
                onClick={() => {
                  if (plan.id !== 'free') setSelectedPlan(plan.id);
                }}
                className={`relative rounded-3xl p-5 sm:p-6 transition-all flex flex-col justify-between ${
                  plan.popular
                    ? 'border-2 border-blue-500 dark:border-blue-500 bg-gradient-to-b from-blue-50/50 via-white to-white dark:from-blue-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xl'
                    : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                } ${plan.id !== 'free' ? 'cursor-pointer' : 'opacity-90'}`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold tracking-wider uppercase rounded-full shadow-md flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-300" />
                    <span>Eng Tavsiya Etilgan</span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {isUserCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Joriy tarif
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4 min-h-[32px]">
                    {plan.description}
                  </p>

                  <div className="mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                        {plan.id === 'free' ? '0' : formatMoney(price).replace(' soʻm', '')}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {plan.id === 'free' ? 'soʻm' : `soʻm${periodLabel}`}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && plan.id !== 'free' && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                        Oyiga bor-yoʻgʻi {formatMoney(Math.round(price / 12))}
                      </span>
                    )}
                  </div>

                  {/* Features list */}
                  <div className="space-y-2.5 mb-6 text-xs">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Selection Action */}
                <div>
                  {plan.id === 'free' ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs font-semibold cursor-not-allowed text-center"
                    >
                      {isUserCurrent ? 'Faol reja' : 'Standart imkoniyat'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan.id);
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white'
                      }`}
                    >
                      <span>{isSelected ? 'Tanlandi' : 'Ushbu tarifni tanlash'}</span>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Methods and Final CTA */}
        <div className="px-6 sm:px-8 py-5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="w-full md:w-auto">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Toʻlov tizimini tanlang (1 bosqichli tezkor faollashtirish):
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'click' as const, name: 'Click Up', color: 'text-blue-500' },
                { id: 'payme' as const, name: 'Payme', color: 'text-teal-500' },
                { id: 'uzum' as const, name: 'Uzum Bank', color: 'text-purple-500' },
                { id: 'card' as const, name: 'Humo / UzCard / Visa', color: 'text-slate-600' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaymentMethod(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    paymentMethod === p.id
                      ? 'border-blue-500 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 opacity-70" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full md:w-auto flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 md:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors text-center"
            >
              Keyinroq
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleUpgrade}
              className="w-1/2 md:w-auto px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {selectedPlan === 'pro' ? 'Pro' : 'Business'} obunasini faollashtirish
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
