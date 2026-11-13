/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Coins,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  Calculator,
  ShieldCheck,
} from 'lucide-react';
import { ExchangeRate, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';

export const CurrenciesView: React.FC = () => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  // Converter state
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>('USD');
  const [toCurrency, setToCurrency] = useState<CurrencyCode>('UZS');
  const [convertedResult, setConvertedResult] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);

  const loadRates = async () => {
    try {
      setLoading(true);
      const res = await api.getExchangeRates();
      setRates(res.rates || []);
    } catch (e) {
      console.error('Failed to load rates:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  const handleConvert = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;
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

  useEffect(() => {
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
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Valyuta Kurslari va Konvertor
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Oʻzbekiston Respublikasi Markaziy Banki (CBU) rasmiy kurslari va tezkor valyuta kalkulyatori
          </p>
        </div>

        <button
          onClick={loadRates}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Kurslarni yangilash</span>
        </button>
      </div>

      {/* Converter Section */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 text-white shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-blue-400" />
          <h3 className="font-extrabold text-sm text-white">
            Tezkor Valyuta Konvertori
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[11px] font-semibold text-blue-200 uppercase">
              Summa va Manba valyutasi
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-hidden focus:ring-2 focus:ring-blue-400 font-mono font-bold text-base"
                placeholder="100"
              />
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
                className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-hidden focus:ring-2 focus:ring-blue-400 font-bold text-xs"
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
              onClick={handleSwap}
              className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-transform hover:scale-110"
              title="Valyutalarni almashtirish"
            >
              <ArrowRightLeft className="w-5 h-5" />
            </button>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-[11px] font-semibold text-blue-200 uppercase">
              Konvertatsiya natijasi
            </label>
            <div className="flex gap-2">
              <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-emerald-300 font-mono font-bold text-base flex items-center overflow-hidden">
                {convertedResult !== null ? formatMoney(convertedResult, toCurrency) : '—'}
              </div>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
                className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-hidden focus:ring-2 focus:ring-blue-400 font-bold text-xs"
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
      </div>

      {/* Official CBU Rates Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Oʻzbekiston Markaziy Banki (CBU) Rasmiy Kurslari
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Sana: {new Date().toISOString().split('T')[0]}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Valyuta</th>
                <th className="py-2.5 px-4">Nomi</th>
                <th className="py-2.5 px-4">1 Birlik kursi (UZS)</th>
                <th className="py-2.5 px-4">Oʻzgarish (Diff)</th>
                <th className="py-2.5 px-4 text-right">Amal qilish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {rates.map((rate) => {
                const isPositive = rate.diff >= 0;
                return (
                  <tr key={rate.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {rate.code}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {rate.name}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatMoney(rate.rate, 'UZS')}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-semibold text-[11px] ${
                          isPositive ? 'text-emerald-600' : 'text-rose-600'
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
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400 text-right">
                      {rate.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
