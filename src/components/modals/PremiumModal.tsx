/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Crown,
  Check,
  Sparkles,
  CreditCard,
  ArrowRight,
  Flame,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { Badge, Button, Modal, useToast } from '../../design-system/index.ts';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'business'>('pro');
  const [paymentMethod, setPaymentMethod] = useState<'click' | 'payme' | 'uzum' | 'card'>('click');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      confetti({
        particleCount: 110,
        spread: 75,
        origin: { y: 0.5 },
        colors: ['#10b981', '#06b6d4', '#f59e0b', '#3b82f6'],
      });

      if (res?.user) {
        updateUser(res.user);
      }

      const planLabel = selectedPlan === 'pro' ? 'PRO' : 'BUSINESS';
      setSuccessMessage(
        `Tabriklaymiz! HISOBOT AI ${planLabel} obunasi faollashtirildi.`
      );
      toast.success(`HISOBOT AI ${planLabel} obunasi faollashtirildi`);

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      toast.error(err?.message || 'Obunani faollashtirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      id: 'free' as const,
      name: 'Bepul',
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: 'Shaxsiy kundalik xarajatlarni sodda qayd etish uchun',
      features: [
        '1 ta asosiy hamyon',
        'Cheklangan kirim va chiqimlar',
        'Oddiy oylik tahliliy grafiklar',
        'Cheklangan AI soʻrovlari',
        'Standart veb interfeys',
      ],
    },
    {
      id: 'pro' as const,
      name: 'Pro Tavsiya',
      popular: true,
      monthlyPrice: 39000,
      yearlyPrice: 390000,
      description: 'Moliyasini toʻliq nazorat qiluvchi va AI quvvatidan foydalanuvchilar uchun',
      features: [
        'Cheksiz hamyonlar va kartalar (Uzum, Click, Payme)',
        'AI Ovozli tranzaksiya kiritish',
        'Cheksiz Chek skaneri (OCR)',
        '3 oylik AI moliyaviy prognozlash',
        'Telegram bot integratsiyasi va bildirishnomalar',
        'Excel (XLSX) va PDF hisobotlar',
        'Avtomatik toʻlovlar va obunalar nazorati',
      ],
    },
    {
      id: 'business' as const,
      name: 'Business & Oila',
      monthlyPrice: 79000,
      yearlyPrice: 790000,
      description: 'Katta oilalar, frilanserlar va kichik biznes boshqaruvi uchun',
      features: [
        'Pro dagi barcha imkoniyatlar toʻliq hajmda',
        '10 nafargacha oila yoki jamoa aʼzolarini ulash',
        'Rollar va ruxsatlar (Owner, Admin, Member, Viewer)',
        'Guruhli umumiy va shaxsiy xarajatlar balansi',
        'Koʻp hisobli bank sinxronizatsiyasi',
        '24/7 ustuvor mijozlarni qoʻllab-quvvatlash',
      ],
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="HISOBOT AI Premium"
      subtitle="Moliyangizni eng yuqori darajada boshqaring"
      size="xl"
    >
      <div className="space-y-6">
        {/* Hero Header inside modal */}
        <div className="flex flex-col items-center text-center max-w-xl mx-auto">
          <Badge tone="amber" size="md" className="mb-3">
            <Crown className="w-3.5 h-3.5" />
            <span>S+ Elite Fintech Tariflari</span>
          </Badge>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Barcha AI vositalari, chek skaneri, oilaviy hisob va cheksiz tahlillardan cheklovsiz foydalaning.
          </p>

          {/* Billing Cycle Switch */}
          <div className="mt-4 p-1 bg-slate-100 dark:bg-[#0D1927] rounded-2xl flex items-center border border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={[
                'min-h-10 px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                billingCycle === 'monthly'
                  ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              Oylik toʻlov
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={[
                'min-h-10 px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer',
                billingCycle === 'yearly'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              <span>Yillik toʻlov</span>
              <span className="text-[10px] bg-amber-400 text-slate-950 font-extrabold px-1.5 py-0.5 rounded-md">
                2 oy bepul
              </span>
            </button>
          </div>
        </div>

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
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
                className={[
                  'relative rounded-2xl p-5 transition-all flex flex-col justify-between',
                  plan.popular
                    ? 'border-2 border-emerald-500 bg-emerald-500/[0.04] dark:bg-[#0D1927]'
                    : 'border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#0D1927]/70',
                  plan.id !== 'free' ? 'cursor-pointer' : 'opacity-90',
                ].join(' ')}
              >
                {plan.popular && (
                  <div className="mb-3">
                    <Badge tone="emerald">
                      <Flame className="w-3 h-3 text-amber-500" />
                      <span>Eng tavsiya etilgan</span>
                    </Badge>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {plan.name}
                    </h3>
                    {isUserCurrent && <Badge tone="emerald">Joriy tarif</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mb-4 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                        {plan.id === 'free' ? '0' : formatMoney(price).replace(' soʻm', '')}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {plan.id === 'free' ? 'soʻm' : `soʻm${periodLabel}`}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && plan.id !== 'free' && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1 tabular-nums">
                        Oyiga {formatMoney(Math.round(price / 12))}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2.5 mb-5 text-xs">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span className="text-slate-700 dark:text-slate-300 leading-snug">
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {plan.id === 'free' ? (
                    <Button variant="outline" size="md" fullWidth disabled>
                      {isUserCurrent ? 'Faol reja' : 'Standart imkoniyat'}
                    </Button>
                  ) : (
                    <Button
                      variant={isSelected ? 'primary' : 'outline'}
                      size="md"
                      fullWidth
                      trailingIcon={isSelected ? <Check className="w-4 h-4" /> : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPlan(plan.id);
                      }}
                    >
                      {isSelected ? 'Tanlandi' : 'Tanlash'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Methods & Final Activation */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/80 dark:border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
              Toʻlov tizimini tanlang
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'click' as const, name: 'Click Up' },
                { id: 'payme' as const, name: 'Payme' },
                { id: 'uzum' as const, name: 'Uzum Bank' },
                { id: 'card' as const, name: 'Humo / UzCard / Visa' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaymentMethod(p.id)}
                  className={[
                    'min-h-10 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer',
                    paymentMethod === p.id
                      ? 'border-emerald-500 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-white/[0.10] bg-white dark:bg-[#111B27] text-slate-600 dark:text-slate-300',
                  ].join(' ')}
                >
                  <CreditCard className="w-3.5 h-3.5 opacity-80" />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button variant="ghost" size="md" onClick={onClose}>
              Keyinroq
            </Button>
            <Button
              variant="premium"
              size="md"
              loading={loading}
              leadingIcon={<Sparkles className="w-4 h-4" />}
              trailingIcon={<ArrowRight className="w-4 h-4" />}
              onClick={handleUpgrade}
            >
              {selectedPlan === 'pro' ? 'Pro' : 'Business'} faollashtirish
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
