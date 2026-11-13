/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId } from 'react';
import { formatMoney } from '../../utils/formatters.ts';
import { BarChart3, TrendingUp, PieChart as PieIcon, ArrowDownLeft, ArrowUpRight, Sparkles } from 'lucide-react';

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

export interface CategoryBreakdownItem {
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
  count: number;
  type?: 'income' | 'expense';
}

export interface DailyData {
  date: string;
  income: number;
  expense: number;
}

// Modern vibrant gradient palette for fintech
export const CHART_PALETTE = {
  income: {
    from: '#10b981', // emerald-500
    to: '#06b6d4',   // cyan-500
    css: 'from-emerald-500 to-cyan-400',
    hoverCss: 'group-hover:from-emerald-400 group-hover:to-cyan-300',
    glow: 'rgba(6, 182, 212, 0.4)',
  },
  expense: {
    from: '#8b5cf6', // violet-500
    to: '#f43f5e',   // rose-500
    css: 'from-violet-600 via-fuchsia-500 to-rose-500',
    hoverCss: 'group-hover:from-violet-500 group-hover:via-fuchsia-400 group-hover:to-rose-400',
    glow: 'rgba(244, 63, 94, 0.4)',
  },
  savings: {
    from: '#7c3aed', // violet-600
    to: '#3b82f6',   // blue-500
    css: 'from-violet-600 to-blue-500',
    hoverCss: 'group-hover:from-violet-500 group-hover:to-blue-400',
    glow: 'rgba(59, 130, 246, 0.4)',
  },
  categories: [
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
  ],
};

// ==========================================
// 1. ADVANCED BAR CHART (Oylik Taqqoslash)
// ==========================================
export const IncomeExpenseBarChart: React.FC<{
  data: MonthlyData[];
  height?: number;
}> = ({ data, height = 260 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'both' | 'net'>('both');

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-xs text-slate-400">
        <BarChart3 className="w-8 h-8 opacity-40 mb-2" />
        <span>Taqqoslash uchun maʼlumot mavjud emas</span>
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => (chartMode === 'both' ? Math.max(d.income, d.expense) : Math.abs(d.savings))),
    1000000
  );

  return (
    <div className="w-full select-none">
      {/* Legend & Mode Switcher with Glassmorphic styling */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-md bg-gradient-to-r from-emerald-500 to-cyan-400 inline-block shadow-xs shadow-cyan-500/30 ring-1 ring-white/30" />
            <span>Kirim</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-md bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-500 inline-block shadow-xs shadow-rose-500/30 ring-1 ring-white/30" />
            <span>Chiqim</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-md bg-gradient-to-r from-violet-600 to-blue-500 inline-block shadow-xs shadow-blue-500/30 ring-1 ring-white/30" />
            <span>Sof tejash</span>
          </span>
        </div>

        <div className="flex items-center p-1 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl text-[11px] font-semibold border border-slate-200/60 dark:border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => setChartMode('both')}
            className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
              chartMode === 'both'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Kirim va Chiqim
          </button>
          <button
            type="button"
            onClick={() => setChartMode('net')}
            className={`px-3 py-1.5 rounded-lg transition-all duration-200 ${
              chartMode === 'net'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sof jamgʻarma
          </button>
        </div>
      </div>

      {/* Main Bar Chart Container */}
      <div
        className="relative flex items-end justify-between gap-2 sm:gap-4 pt-12 pb-8 border-b border-slate-200/70 dark:border-slate-800/80"
        style={{ height: `${height}px` }}
      >
        {/* Subtle Horizontal Gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-25">
          <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full" />
          <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full" />
          <div className="border-b border-dashed border-slate-400 dark:border-slate-600 w-full" />
        </div>

        {data.map((item, idx) => {
          const maxBarH = height - 64;
          const incHeight = Math.max(8, Math.round((item.income / maxVal) * maxBarH));
          const expHeight = Math.max(8, Math.round((item.expense / maxVal) * maxBarH));
          const netHeight = Math.max(8, Math.round((Math.abs(item.savings) / maxVal) * maxBarH));
          const isHovered = hoveredIndex === idx;

          return (
            <div
              key={idx}
              className="relative flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Glassmorphic Floating Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-3 z-30 backdrop-blur-2xl bg-slate-950/85 dark:bg-slate-900/90 text-white rounded-2xl p-4 shadow-2xl text-xs whitespace-nowrap min-w-[190px] pointer-events-none transition-all duration-200 border border-white/20 ring-1 ring-white/10 animate-in fade-in zoom-in-95">
                  <div className="font-bold pb-2 mb-2 border-b border-white/10 text-slate-100 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{item.month}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Hisobot</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-4 text-cyan-300">
                      <span className="font-medium text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        Kirim:
                      </span>
                      <span className="font-mono font-bold">+{formatMoney(item.income)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 text-rose-300">
                      <span className="font-medium text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        Chiqim:
                      </span>
                      <span className="font-mono font-bold">-{formatMoney(item.expense)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 text-blue-300 pt-1.5 mt-1 border-t border-white/10 font-bold">
                      <span className="text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        Sof tejash:
                      </span>
                      <span className="font-mono">
                        {item.savings >= 0 ? '+' : ''}
                        {formatMoney(item.savings)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bars Presentation with Vibrant Gradients & Smooth Height Animation */}
              {chartMode === 'both' ? (
                <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2.5 max-w-[68px]">
                  {/* Income Bar with Emerald-Cyan Gradient */}
                  <div
                    className="w-1/2 rounded-t-xl bg-gradient-to-t from-emerald-500 to-cyan-400 group-hover:from-emerald-400 group-hover:to-cyan-300 transition-all duration-500 ease-out shadow-sm shadow-cyan-500/20 group-hover:shadow-md group-hover:shadow-cyan-500/40"
                    style={{
                      height: `${incHeight}px`,
                      transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  />
                  {/* Expense Bar with Violet-Rose Gradient */}
                  <div
                    className="w-1/2 rounded-t-xl bg-gradient-to-t from-violet-600 via-fuchsia-500 to-rose-500 group-hover:from-violet-500 group-hover:via-fuchsia-400 group-hover:to-rose-400 transition-all duration-500 ease-out shadow-sm shadow-rose-500/20 group-hover:shadow-md group-hover:shadow-rose-500/40"
                    style={{
                      height: `${expHeight}px`,
                      transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  />
                </div>
              ) : (
                <div className="w-full flex items-end justify-center max-w-[44px]">
                  <div
                    className={`w-full rounded-t-xl transition-all duration-500 ease-out shadow-md ${
                      item.savings >= 0
                        ? 'bg-gradient-to-t from-violet-600 via-indigo-500 to-blue-400 group-hover:from-violet-500 group-hover:to-blue-300 shadow-blue-500/30'
                        : 'bg-gradient-to-t from-rose-600 to-amber-500 shadow-rose-500/30'
                    }`}
                    style={{
                      height: `${netHeight}px`,
                      transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  />
                </div>
              )}

              {/* Month Label */}
              <span className="absolute top-full mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-full group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {item.month.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 2. INTERACTIVE DONUT & PIE CHART (Toifalar)
// ==========================================
export const InteractivePieChart: React.FC<{
  categories: CategoryBreakdownItem[];
  totalAmount?: number;
  title?: string;
}> = ({ categories, totalAmount }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!categories || categories.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400">
        <PieIcon className="w-8 h-8 opacity-40 mb-2" />
        <span>Toifalar boʻyicha maʼlumot mavjud emas</span>
      </div>
    );
  }

  const computedTotal = totalAmount ?? categories.reduce((sum, c) => sum + c.amount, 0);

  // SVG parameters
  const size = 210;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate cumulative offsets
  let cumulativePercentage = 0;
  const slices = categories.slice(0, 7).map((cat, idx) => {
    const pct = cat.percentage / 100;
    const strokeDasharray = `${Math.max(0, pct * circumference - 2)} ${circumference}`;
    const strokeDashoffset = -cumulativePercentage * circumference;
    cumulativePercentage += pct;

    const assignedColor = cat.color || CHART_PALETTE.categories[idx % CHART_PALETTE.categories.length];

    return {
      ...cat,
      color: assignedColor,
      strokeDasharray,
      strokeDashoffset,
      idx,
    };
  });

  const activeCategory = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-6">
      {/* Donut Graphic with glassmorphic center disc */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
        >
          {/* Subtle drop shadow filter for active slice glow */}
          <defs>
            <filter id="pie-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#8b5cf6" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeWidth={strokeWidth}
          />

          {/* Slices with smooth transitions */}
          {slices.map((slice) => {
            const isHovered = hoveredIdx === slice.idx;
            return (
              <circle
                key={slice.idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                filter={isHovered ? 'url(#pie-glow)' : undefined}
                className="transition-all duration-300 ease-out cursor-pointer"
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Readout with Glassmorphic Circle Disc */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-5">
          <div className="w-28 h-28 rounded-full backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/60 dark:border-white/10 shadow-lg flex flex-col items-center justify-center text-center p-2">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate max-w-[95px]">
              {activeCategory ? activeCategory.categoryName : 'Jami'}
            </span>
            <span className="text-xs font-black font-mono text-slate-900 dark:text-white mt-0.5 tracking-tight truncate max-w-[100px]">
              {activeCategory ? formatMoney(activeCategory.amount) : formatMoney(computedTotal)}
            </span>
            {activeCategory ? (
              <span className="text-[10px] font-black text-violet-600 dark:text-violet-400 font-mono mt-0.5">
                {activeCategory.percentage}%
              </span>
            ) : (
              <span className="text-[9px] font-semibold text-slate-400 font-mono mt-0.5">
                {categories.length} toifa
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legend items list with Glassmorphic interactive cards */}
      <div className="flex-1 w-full space-y-2 min-w-0">
        {slices.slice(0, 6).map((cat, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-between text-xs cursor-pointer border ${
                isHovered
                  ? 'backdrop-blur-md bg-white dark:bg-slate-800 border-violet-500/40 shadow-md scale-[1.02]'
                  : 'backdrop-blur-xs bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/50 dark:border-white/5 hover:bg-white/80 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-3 h-3 rounded-md shrink-0 shadow-xs ring-1 ring-white/20"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {cat.categoryName}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  ({cat.count})
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatMoney(cat.amount)}
                </span>
                <span className="font-mono text-[11px] font-semibold text-violet-600 dark:text-violet-400 min-w-[34px] text-right">
                  {cat.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 3. SMOOTH BEZIER LINE & AREA GRAPH (Kunlik trend)
// ==========================================
export const DailyTrendLineChart: React.FC<{
  data: DailyData[];
  height?: number;
}> = ({ data, height = 230 }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const chartId = useId();

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-xs text-slate-400">
        Kunlik maʼlumot mavjud emas
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 100000);
  const width = 640;
  const paddingX = 24;
  const paddingY = 24;

  const getCoordinates = (val: number, idx: number) => {
    const x = paddingX + (idx / Math.max(1, data.length - 1)) * (width - paddingX * 2);
    const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
    return { x, y };
  };

  // Build smooth cubic bezier curve
  const buildSmoothPath = (values: number[]) => {
    if (values.length === 0) return '';
    const points = values.map((v, i) => getCoordinates(v, i));

    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  };

  const incomeLine = buildSmoothPath(data.map((d) => d.income));
  const expenseLine = buildSmoothPath(data.map((d) => d.expense));

  // Area paths (closed to bottom)
  const firstPt = getCoordinates(0, 0);
  const lastPt = getCoordinates(0, data.length - 1);
  const incomeArea = `${incomeLine} L ${lastPt.x},${height - paddingY} L ${firstPt.x},${height - paddingY} Z`;
  const expenseArea = `${expenseLine} L ${lastPt.x},${height - paddingY} L ${firstPt.x},${height - paddingY} Z`;

  const hoveredPoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="w-full select-none">
      {/* Legend & Glassmorphic Hover Data Callout */}
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-3.5 h-1.5 bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full inline-block shadow-xs shadow-cyan-500/40" />
            <span>Kirim dinamikasi</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-violet-600 dark:text-violet-400">
            <span className="w-3.5 h-1.5 bg-gradient-to-r from-violet-500 to-rose-500 rounded-full inline-block shadow-xs shadow-rose-500/40" />
            <span>Chiqim dinamikasi</span>
          </span>
        </div>

        {hoveredPoint ? (
          <div className="flex items-center gap-2.5 font-mono text-xs px-3 py-1.5 rounded-xl backdrop-blur-md bg-slate-900/90 text-white dark:bg-white dark:text-slate-900 border border-white/20 dark:border-slate-300 shadow-md animate-in fade-in duration-150">
            <span className="text-slate-300 dark:text-slate-600 font-sans font-medium text-[11px]">{hoveredPoint.date}:</span>
            <span className="text-cyan-400 dark:text-emerald-600 font-bold">
              +{formatMoney(hoveredPoint.income)}
            </span>
            <span className="text-rose-400 dark:text-rose-600 font-bold">
              -{formatMoney(hoveredPoint.expense)}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Grafig boʻylab sichqonchani olib boring</span>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Luminous Stroke Gradients */}
            <linearGradient id={`lineGradInc-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            <linearGradient id={`lineGradExp-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>

            {/* Area Fill Gradients */}
            <linearGradient id={`gradInc-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`gradExp-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            {/* Neon Glow Filter */}
            <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#8b5cf6" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800 opacity-40"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Smooth Fills */}
          <path d={incomeArea} fill={`url(#gradInc-${chartId})`} className="transition-all duration-500 ease-out" />
          <path d={expenseArea} fill={`url(#gradExp-${chartId})`} className="transition-all duration-500 ease-out" />

          {/* Smooth Vibrant Gradient Lines */}
          <path
            d={incomeLine}
            fill="none"
            stroke={`url(#lineGradInc-${chartId})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
          <path
            d={expenseLine}
            fill="none"
            stroke={`url(#lineGradExp-${chartId})`}
            strokeWidth="3.5"
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />

          {/* Interactive Cursor Ruler */}
          {hoveredIdx !== null && (
            <line
              x1={getCoordinates(0, hoveredIdx).x}
              y1={paddingY}
              x2={getCoordinates(0, hoveredIdx).x}
              y2={height - paddingY}
              stroke="currentColor"
              className="text-violet-500 opacity-80"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
          )}

          {/* Interactive Data Points with Pulsing Glow on Hover */}
          {data.map((d, i) => {
            const incPt = getCoordinates(d.income, i);
            const expPt = getCoordinates(d.expense, i);
            const isHovered = hoveredIdx === i;

            return (
              <g key={i}>
                {/* Touch/mouse catch target */}
                <rect
                  x={incPt.x - (width / data.length) / 2}
                  y={0}
                  width={width / data.length}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />

                {d.income > 0 && (
                  <circle
                    cx={incPt.x}
                    cy={incPt.y}
                    r={isHovered ? 7 : 4}
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 3 : 1.5}
                    className="transition-all duration-200 pointer-events-none shadow-md"
                  />
                )}
                {d.expense > 0 && (
                  <circle
                    cx={expPt.x}
                    cy={expPt.y}
                    r={isHovered ? 7 : 4}
                    fill="#f43f5e"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 3 : 1.5}
                    className="transition-all duration-200 pointer-events-none shadow-md"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// ==========================================
// 4. RADIAL BUDGET GAUGE (Budjet Sarfi)
// ==========================================
export const BudgetGaugeChart: React.FC<{
  spent: number;
  limit: number;
  percentage: number;
}> = ({ spent, limit, percentage }) => {
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // We show an arc of 240 degrees (leaving 120 deg gap at bottom)
  const maxAngle = 0.75;
  const arcLength = circumference * maxAngle;
  const fillRatio = Math.min(1, Math.max(0, percentage / 100));
  const strokeDashoffset = arcLength * (1 - fillRatio);

  const getColor = () => {
    if (percentage > 100) return '#f43f5e'; // Rose-500
    if (percentage >= 80) return '#f59e0b';  // Amber-500
    return '#10b981';                      // Emerald-500
  };

  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="relative">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-135"
        >
          {/* Background Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Active Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
            {percentage}%
          </span>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Sarflandi
          </span>
        </div>
      </div>

      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
        <span className="font-bold text-slate-900 dark:text-slate-100">{formatMoney(spent)}</span>
        {' / '}
        <span>{formatMoney(limit)}</span>
      </div>
    </div>
  );
};

// ==========================================
// 5. CATEGORY PROGRESS LIST
// ==========================================
export const CategoryProgressList: React.FC<{
  categories: CategoryBreakdownItem[];
  totalExpense: number;
}> = ({ categories }) => {
  if (!categories || categories.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
        Bu muddatda xarajatlar mavjud emas
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {categories.slice(0, 6).map((cat, i) => {
        const catColor = cat.color || CHART_PALETTE.categories[i % CHART_PALETTE.categories.length];
        return (
          <div key={i} className="group p-2.5 rounded-xl backdrop-blur-xs bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 hover:bg-white/80 dark:hover:bg-slate-800/80 transition-all duration-200">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-xs ring-1 ring-white/20"
                  style={{ backgroundColor: catColor }}
                />
                <span className="truncate max-w-[150px] sm:max-w-[200px]">{cat.categoryName}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  ({cat.count} ta)
                </span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {formatMoney(cat.amount)}
                </span>
                <span className="font-mono text-xs text-violet-600 dark:text-violet-400 min-w-[32px] text-right font-semibold">
                  {cat.percentage}%
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-200/60 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 shadow-xs"
                style={{
                  width: `${Math.min(100, Math.max(3, cat.percentage))}%`,
                  backgroundColor: catColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
