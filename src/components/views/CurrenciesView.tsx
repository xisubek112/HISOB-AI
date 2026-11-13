/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  Calculator,
} from 'lucide-react';
import { ExchangeRate, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { Button, Card, Skeleton } from '../../design-system/index.ts';

export const CurrenciesView: React.FC = () => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>('USD');
  const [toCurrency, setToCurrency] = useState<CurrencyCode>('UZS');
  const [convertedResult, setConvertedResult] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);

  const loadRates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getExchangeRates();
      setRates(res.rates || []);
    } catch (e) {
      console.error('Failed to load rates:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  useEffect(() => {
    const handleConvert = async () => {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        setConvertedResult(null);
        return;
      }
      try {
        setCalculating(true);
        const res = await api.convertCurrency(num, fromCurrency, toCurrency);
        setConvertedResult(res.result);
      } catch (e) {
        console.error('Failed to convert currency:', e);
      } finally {
        setCalculating(false);
      }
    };
    handleConvert();
  }, [amount, fromCurrency, toCurrency]);

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Valyuta kurslari va konvertor
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Oʻzbekiston Markaziy Banki (CBU) kurslari va tezkor valyuta kalkulyatori
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          loading={loading}
          leadingIcon={<RefreshCw className="w-3.5 h-3.5 text-emerald-500" />}
          onClick={loadRates}
        >
          Kurslarni yangilash
        </Button>
      </div>

      {/* Converter Section — Deep Navy + Emerald Elite */}
      <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#081220] via-[#0A232D] to-[#0D3B36] text-white border border-emerald-500/25 shadow-[0_12px_32px_rgba(16,185,129,0.12)]">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm text-white">Tezkor valyuta konvertori</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2 space-y-1.5">
            <label
              htmlFor="currency-amount-input"
              className="text-xs font-semibold text-emerald-200 block"
            >
              Summa va manba valyutasi
            </label>
            <div className="flex gap-2">
              <input
                id="currency-amount-input"
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 min-w-0 min-h-11 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono tabular-nums font-bold text-base"
                placeholder="100"
              />
              <select
                aria-label="Manba valyuta"
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
                className="min-h-11 px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-bold text-xs shrink-0"
              >
                <option value="USD" className="text-slate-900">USD ($)</option>
                <option value="UZS" className="text-slate-900">UZS (soʻm)</option>
                <option value="EUR" className="text-slate-900">EUR (€)</option>
                <option value="RUB" className="text-slate-900">RUB (₽)</option>
                <option value="GBP" className="text-slate-900">GBP (£)</option>
                <option value="TRY" className="text-slate-900">TRY (₺)</option>
                <option value="KZT" className="text-slate-900">KZT (₸)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Valyutalarni almashtirish"
              className="min-h-11 min-w-11 p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-transform hover:scale-105 cursor-pointer flex items-center justify-center"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <span className="text-xs font-semibold text-emerald-200 block">
              Konvertatsiya natijasi
            </span>
            <div className="flex gap-2">
              <div className="flex-1 min-w-0 min-h-11 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-emerald-300 font-mono tabular-nums font-bold text-base flex items-center overflow-hidden truncate">
                {calculating ? '...' : convertedResult !== null ? formatMoney(convertedResult, toCurrency) : '—'}
              </div>
              <select
                aria-label="Maqsad valyuta"
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
                className="min-h-11 px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-bold text-xs shrink-0"
              >
                <option value="UZS" className="text-slate-900">UZS (soʻm)</option>
                <option value="USD" className="text-slate-900">USD ($)</option>
                <option value="EUR" className="text-slate-900">EUR (€)</option>
                <option value="RUB" className="text-slate-900">RUB (₽)</option>
                <option value="GBP" className="text-slate-900">GBP (£)</option>
                <option value="TRY" className="text-slate-900">TRY (₺)</option>
                <option value="KZT" className="text-slate-900">KZT (₸)</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Official CBU Rates */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Oʻzbekiston Markaziy Banki (CBU) rasmiy kurslari
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Sana: {new Date().toISOString().split('T')[0]}
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile Rate Cards */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
              {rates.map((rate) => {
                const isPositive = rate.diff >= 0;
                return (
                  <div key={rate.code} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                          {rate.code}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {rate.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                        {rate.date}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white">
                        {formatMoney(rate.rate, 'UZS')}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-[11px] ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {isPositive ? `+${rate.diff}` : `${rate.diff}`} soʻm
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/70 dark:bg-[#0D1927]/70 text-slate-500 dark:text-slate-400 font-semibold text-[11px] border-b border-slate-200/70 dark:border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Valyuta</th>
                    <th className="py-3 px-4">Nomi</th>
                    <th className="py-3 px-4">1 birlik kursi (UZS)</th>
                    <th className="py-3 px-4">Oʻzgarish</th>
                    <th className="py-3 px-4 text-right">Sana</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
                  {rates.map((rate) => {
                    const isPositive = rate.diff >= 0;
                    return (
                      <tr key={rate.code} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white font-mono">
                          {rate.code}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          {rate.name}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                          {formatMoney(rate.rate, 'UZS')}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-[11px] ${
                              isPositive
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="w-3.5 h-3.5" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5" />
                            )}
                            {isPositive ? `+${rate.diff}` : `${rate.diff}`} soʻm
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-400 text-right">
                          {rate.date}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
