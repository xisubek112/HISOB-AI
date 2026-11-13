/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';
import { FinancialForecast } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '../../design-system/index.ts';

export const ForecastView: React.FC = () => {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<FinancialForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'realistic' | 'optimistic' | 'conservative'>('realistic');

  const loadForecast = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(false);
      const res = await api.getForecast();
      setForecast(res.forecast);
    } catch (e) {
      console.error('Failed to load forecast:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadForecast();
  }, [loadForecast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <EmptyState
        icon={<Sparkles className="w-6 h-6" />}
        title="Prognoz maʼlumotlarini yuklab boʻlmadi"
        description="Tarixiy moliyaviy maʼlumotlarni tahlil qilishda vaqtinchalik xatolik yuz berdi."
        action={
          <Button
            variant="primary"
            size="md"
            leadingIcon={<RefreshCw className="w-4 h-4" />}
            onClick={loadForecast}
          >
            Qayta yuklash
          </Button>
        }
      />
    );
  }

  const scenarioData = forecast.scenarios[activeScenario];
  const maxScenarioVal = Math.max(
    scenarioData.month1,
    scenarioData.month2,
    scenarioData.month3,
    forecast.monthEndExpectedBalance,
    1
  );

  const barColorClass =
    activeScenario === 'optimistic'
      ? 'bg-emerald-500'
      : activeScenario === 'conservative'
      ? 'bg-amber-500'
      : 'bg-cyan-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            AI moliyaviy prognozlash
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Keyingi 3 oy boʻyicha ehtimoliy balans, xarajatlar va budjet xatarlari tahlili
          </p>
        </div>

        <Badge tone="teal" size="md">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="tabular-nums">Ishonch darajasi: {forecast.confidenceScore}%</span>
        </Badge>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card interactive padding="lg">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Oy oxiridagi kutilayotgan balans
          </span>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1.5">
            {formatMoney(forecast.monthEndExpectedBalance, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Joriy tendensiya boʻyicha barqaror</span>
          </div>
        </Card>

        <Card interactive padding="lg">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Kutilayotgan oylik jami xarajat
          </span>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1.5">
            {formatMoney(forecast.expectedMonthlyExpenses, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Doimiy toʻlovlar va kundalik xarajatlar
          </div>
        </Card>

        <Card interactive padding="lg">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Kutilayotgan sof jamgʻarma
          </span>
          <div className="text-2xl font-extrabold font-mono tabular-nums text-cyan-600 dark:text-cyan-400 mt-1.5">
            {formatMoney(forecast.expectedSavings, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            Oy yakunigacha saqlanadigan mablagʻ
          </div>
        </Card>
      </div>

      {/* 3-Month Projection Scenarios */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.08]">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Keyingi 3 oylik ssenariy prognozi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Turli moliyaviy vaziyatlarda kutilayotgan jamgʻarma dinamikasi
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] text-xs font-semibold overflow-x-auto scrollbar-none">
            {[
              { id: 'realistic' as const, label: 'Realistik' },
              { id: 'optimistic' as const, label: 'Optimistik (+15%)' },
              { id: 'conservative' as const, label: 'Konservativ (-10%)' },
            ].map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setActiveScenario(sc.id)}
                className={[
                  'px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                  activeScenario === sc.id
                    ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visual Forecast Columns */}
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-5 pt-2">
          {[
            { label: '1-oy prognozi', val: scenarioData.month1 },
            { label: '2-oy prognozi', val: scenarioData.month2 },
            { label: '3-oy prognozi', val: scenarioData.month3 },
          ].map((col, idx) => {
            const heightPercent = Math.min(100, Math.max(24, (col.val / maxScenarioVal) * 100));

            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="h-44 w-full flex items-end justify-center bg-slate-50 dark:bg-[#0D1927] border border-slate-200/60 dark:border-white/[0.06] rounded-2xl p-3">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[76px] rounded-xl transition-[height,background-color] duration-500 flex items-start justify-center pt-2 text-slate-950 font-mono tabular-nums text-[11px] font-bold ${barColorClass}`}
                  >
                    <span>{Math.round(heightPercent)}%</span>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {col.label}
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                    {formatMoney(col.val, 'UZS')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Budget Overrun Risks */}
      <Card padding="lg">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-white/[0.08] mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-white">
            Budjet oshib ketish xatarlari tahlili
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forecast.budgetOverrunRisk.map((risk, idx) => {
            const tone =
              risk.riskLevel === 'high'
                ? 'rose'
                : risk.riskLevel === 'medium'
                ? 'amber'
                : 'emerald';

            return (
              <div
                key={idx}
                className={[
                  'p-4 rounded-2xl border flex flex-col justify-between',
                  risk.riskLevel === 'high'
                    ? 'border-rose-500/25 bg-rose-500/[0.06]'
                    : risk.riskLevel === 'medium'
                    ? 'border-amber-500/25 bg-amber-500/[0.06]'
                    : 'border-emerald-500/25 bg-emerald-500/[0.06]',
                ].join(' ')}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      {risk.category}
                    </span>
                    <Badge tone={tone}>
                      {risk.riskLevel === 'high'
                        ? 'Yuqori xavf'
                        : risk.riskLevel === 'medium'
                        ? 'Oʻrta xavf'
                        : 'Past xavf'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {risk.explanation}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {forecast.assumptions && forecast.assumptions.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-500" />
              <span>Prognoz shartlari</span>
            </div>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
              {forecast.assumptions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
};
