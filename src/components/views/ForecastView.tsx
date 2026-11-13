/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { FinancialForecast } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const ForecastView: React.FC = () => {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<FinancialForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeScenario, setActiveScenario] = useState<'realistic' | 'optimistic' | 'conservative'>('realistic');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await api.getForecast();
        setForecast(res.forecast);
      } catch (e) {
        console.error('Failed to load forecast:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Sparkles className="w-10 h-10 text-blue-600 animate-pulse mx-auto mb-3" />
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Moliyaviy prognoz hisoblanmoqda...
        </div>
        <div className="text-xs text-slate-400 mt-1">
          Tarixiy kirim-chiqimlar, obunalar va sarf-xarajatlar tahlil qilinmoqda
        </div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        Prognoz maʼlumotlarini yuklab boʻlmadi.
      </div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            AI Moliyaviy Prognozlash
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Keyingi 3 oy boʻyicha ehtimoliy balans, xarajatlar va budjet oshib ketish xatarlari tahlili
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center gap-1.5 text-xs text-blue-700 dark:text-blue-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Ishonch darajasi: {forecast.confidenceScore}%</span>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Oy oxiridagi kutilayotgan balans
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(forecast.monthEndExpectedBalance, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Joriy tendensiya boʻyicha barqaror</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Kutilayotgan oylik jami xarajat
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatMoney(forecast.expectedMonthlyExpenses, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Doimiy toʻlovlar va kundalik xarajatlar
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Kutilayotgan sof jamgʻarma
          </div>
          <div className="text-2xl font-extrabold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {formatMoney(forecast.expectedSavings, 'UZS')}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Oy yakuniga qadar saqlab qolinadigan mablagʻ
          </div>
        </div>
      </div>

      {/* 3-Month Projection Scenarios */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Keyingi 3 oylik ssenariy prognozi
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Turli moliyaviy vaziyatlarda kutilayotgan yakuniy jamgʻarma dinamikasi
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveScenario('realistic')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeScenario === 'realistic'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Realistik
            </button>
            <button
              onClick={() => setActiveScenario('optimistic')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeScenario === 'optimistic'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Optimistik (+15%)
            </button>
            <button
              onClick={() => setActiveScenario('conservative')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeScenario === 'conservative'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Konservativ (-10%)
            </button>
          </div>
        </div>

        {/* Dynamic Visual Forecast Chart */}
        <div className="mt-6 grid grid-cols-3 gap-4 pt-6">
          {[
            { label: 'Keyingi oy (1-oy)', val: scenarioData.month1 },
            { label: '2-oy prognozi', val: scenarioData.month2 },
            { label: '3-oy prognozi', val: scenarioData.month3 },
          ].map((col, idx) => {
            const heightPercent = Math.min(100, Math.max(25, (col.val / maxScenarioVal) * 100));

            return (
              <div key={idx} className="flex flex-col items-center">
                <div className="h-44 w-full flex items-end justify-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3 relative group">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[80px] rounded-xl transition-all duration-500 flex items-center justify-center text-white font-mono text-xs font-bold ${
                      activeScenario === 'optimistic'
                        ? 'bg-emerald-600'
                        : activeScenario === 'conservative'
                        ? 'bg-amber-600'
                        : 'bg-blue-600'
                    }`}
                  >
                    <span className="hidden group-hover:block transition-all">
                      {Math.round(heightPercent)}%
                    </span>
                  </div>
                </div>
                <div className="text-center mt-3">
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {col.label}
                  </div>
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatMoney(col.val, 'UZS')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Overrun Risks */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
            Budjet oshib ketish xatarlari tahlili
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {forecast.budgetOverrunRisk.map((risk, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                risk.riskLevel === 'high'
                  ? 'border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20'
                  : risk.riskLevel === 'medium'
                  ? 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                    {risk.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      risk.riskLevel === 'high'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                        : risk.riskLevel === 'medium'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                    }`}
                  >
                    {risk.riskLevel === 'high' ? 'Yuqori xavf' : risk.riskLevel === 'medium' ? 'Oʻrta xavf' : 'Past xavf'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {risk.explanation}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Assumptions */}
        {forecast.assumptions && forecast.assumptions.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>Prognoz qabul qilingan asosiy shartlar (Assumptions):</span>
            </div>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
              {forecast.assumptions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
