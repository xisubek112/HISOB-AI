/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId } from 'react';
import { formatMoney } from '../../utils/formatters.ts';
import { BarChart3, PieChart as PieIcon, Sparkles } from 'lucide-react';
import { designTokens } from '../../design-system/tokens.ts';

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

// Locked S+ Emerald Elite Fintech Palette sourced from designTokens
export const CHART_PALETTE = {
  income: {
    from: designTokens.semantic.income,
    to: designTokens.brand.teal,
    css: 'from-emerald-500 to-cyan-400',
    hoverCss: 'group-hover:from-emerald-400 group-hover:to-cyan-300',
    glow: 'rgba(16, 185, 129, 0.35)',
  },
  expense: {
    from: designTokens.semantic.expense,
    to: '#F87171',
    css: 'from-rose-600 to-rose-400',
    hoverCss: 'group-hover:from-rose-500 group-hover:to-rose-300',
    glow: 'rgba(239, 68, 68, 0.35)',
  },
  savings: {
    from: designTokens.brand.emerald,
    to: designTokens.semantic.info,
    css: 'from-emerald-500 to-blue-500',
    hoverCss: 'group-hover:from-emerald-400 group-hover:to-blue-400',
    glow: 'rgba(59, 130, 246, 0.35)',
  },
  categories: [
    designTokens.brand.emerald,
    designTokens.brand.teal,
    designTokens.semantic.info,
    designTokens.semantic.premium,
    designTokens.semantic.expense,
    '#14B8A6',
    '#0EA5E9',
    designTokens.brand.mutedText,
  ],
};

// ==========================================
// 1. ADVANCED BAR CHART (Oylik Taqqoslash)
// ==========================================
export const IncomeExpenseBarChart: React.FC<{
  data: MonthlyData[];
  height?: number;
}> = ({ data, height = 250 }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartMode, setChartMode] = useState<'both' | 'net'>('both');

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-xs text-slate-400">
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
      {/* Legend & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-500 to-cyan-400 inline-block" />
            <span>Daromad</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-rose-600 to-rose-400 inline-block" />
            <span>Xarajat</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-500 to-blue-500 inline-block" />
            <span>Sof tejash</span>
          </span>
        </div>

        <div className="flex items-center p-1 bg-slate-100 dark:bg-white/[0.06] rounded-xl text-[11px] font-semibold border border-slate-200/70 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => setChartMode('both')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              chartMode === 'both'
                ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Kirim va Chiqim
          </button>
          <button
            type="button"
            onClick={() => setChartMode('net')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              chartMode === 'net'
                ? 'bg-white dark:bg-[#111B27] text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sof jamgʻarma
          </button>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div
        className="relative flex items-end justify-between gap-2 sm:gap-4 pt-10 pb-8 border-b border-slate-200/80 dark:border-white/[0.08]"
        style={{ height: `${height}px` }}
      >
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
          <div className="border-b border-dashed border-slate-300 dark:border-slate-700 w-full" />
          <div className="border-b border-dashed border-slate-300 dark:border-slate-700 w-full" />
          <div className="border-b border-dashed border-slate-300 dark:border-slate-700 w-full" />
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
              tabIndex={0}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              onFocus={() => setHoveredIndex(idx)}
              onBlur={() => setHoveredIndex(null)}
              onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
              className="relative flex-1 flex flex-col items-center h-full justify-end group cursor-pointer focus-visible:outline-none"
            >
              {/* Floating Tooltip */}
              {isHovered && (
                <div className="absolute bottom-full mb-2.5 z-30 bg-[#081220]/95 text-white rounded-xl p-3.5 shadow-2xl text-xs whitespace-nowrap min-w-[185px] pointer-events-none border border-white/15 hai-scale-in">
                  <div className="font-bold pb-1.5 mb-1.5 border-b border-white/10 text-slate-100 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{item.month}</span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center gap-4 text-emerald-300">
                      <span className="text-[11px]">Daromad:</span>
                      <span className="font-mono font-bold tabular-nums">+{formatMoney(item.income)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 text-rose-300">
                      <span className="text-[11px]">Xarajat:</span>
                      <span className="font-mono font-bold tabular-nums">-{formatMoney(item.expense)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4 text-cyan-300 pt-1 mt-1 border-t border-white/10 font-bold">
                      <span className="text-[11px]">Sof tejash:</span>
                      <span className="font-mono tabular-nums">
                        {item.savings >= 0 ? '+' : ''}
                        {formatMoney(item.savings)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {chartMode === 'both' ? (
                <div className="w-full flex items-end justify-center gap-1.5 sm:gap-2 max-w-[64px]">
                  <div
                    className="w-1/2 rounded-t-lg bg-gradient-to-t from-emerald-500 to-cyan-400 group-hover:from-emerald-400 group-hover:to-cyan-300 transition-[height,transform] duration-300 ease-out"
                    style={{
                      height: `${incHeight}px`,
                      transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  />
                  <div
                    className="w-1/2 rounded-t-lg bg-gradient-to-t from-rose-600 to-rose-400 group-hover:from-rose-500 group-hover:to-rose-300 transition-[height,transform] duration-300 ease-out"
                    style={{
                      height: `${expHeight}px`,
                      transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  />
                </div>
              ) : (
                <div className="w-full flex items-end justify-center max-w-[40px]">
                  <div
                    className={`w-full rounded-t-lg transition-[height,transform] duration-300 ease-out ${
                      item.savings >= 0
                        ? 'bg-gradient-to-t from-emerald-500 to-blue-500'
                        : 'bg-gradient-to-t from-rose-600 to-amber-500'
                    }`}
                    style={{
                      height: `${netHeight}px`,
                      transform: isHovered ? 'scaleY(1.03)' : 'scaleY(1)',
                      transformOrigin: 'bottom',
                    }}
                  />
                </div>
              )}

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
  const filterId = useId();

  if (!categories || categories.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400">
        <PieIcon className="w-8 h-8 opacity-40 mb-2" />
        <span>Toifalar boʻyicha maʼlumot mavjud emas</span>
      </div>
    );
  }

  const computedTotal = totalAmount ?? categories.reduce((sum, c) => sum + c.amount, 0);

  const size = 200;
  const strokeWidth = 28;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercentage = 0;
  const slices = categories.slice(0, 7).map((cat, idx) => {
    const pct = cat.percentage / 100;
    const strokeDasharray = `${Math.max(0, pct * circumference - 2)} ${circumference}`;
    const strokeDashoffset = -cumulativePercentage * circumference;
    cumulativePercentage += pct;

    const rawColor = cat.color || '';
    const isForbiddenPurple =
      /^#(8b5cf6|7c3aed|6366f1|a855f7|9333ea|ec4899)/i.test(rawColor);
    const assignedColor = isForbiddenPurple
      ? CHART_PALETTE.categories[idx % CHART_PALETTE.categories.length]
      : rawColor || CHART_PALETTE.categories[idx % CHART_PALETTE.categories.length];

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
    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-5">
      {/* Donut Graphic */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90 overflow-visible"
        >
          <defs>
            <filter id={`pie-glow-${filterId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10B981" floodOpacity="0.35" />
            </filter>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-white/[0.06]"
            strokeWidth={strokeWidth}
          />

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
                strokeWidth={isHovered ? strokeWidth + 5 : strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                strokeLinecap="round"
                filter={isHovered ? `url(#pie-glow-${filterId})` : undefined}
                className="transition-all duration-200 ease-out cursor-pointer"
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === slice.idx ? null : slice.idx)}
              />
            );
          })}
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-5">
          <div className="w-28 h-28 rounded-full bg-white/95 dark:bg-[#0D1927]/95 border border-slate-200/70 dark:border-white/[0.10] shadow-md flex flex-col items-center justify-center text-center p-2">
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[92px]">
              {activeCategory ? activeCategory.categoryName : 'Jami xarajat'}
            </span>
            <span className="text-xs font-extrabold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 truncate max-w-[100px]">
              {activeCategory ? formatMoney(activeCategory.amount) : formatMoney(computedTotal)}
            </span>
            {activeCategory ? (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                {activeCategory.percentage}%
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400 tabular-nums mt-0.5">
                {categories.length} ta toifa
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legend items list */}
      <div className="flex-1 w-full space-y-2 min-w-0">
        {slices.slice(0, 6).map((cat, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <button
              type="button"
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
              className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer border ${
                isHovered
                  ? 'bg-emerald-500/[0.06] dark:bg-white/[0.06] border-emerald-500/40'
                  : 'bg-slate-50/70 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {cat.categoryName}
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                  ({cat.count})
                </span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatMoney(cat.amount)}
                </span>
                <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 min-w-[32px] text-right tabular-nums">
                  {cat.percentage}%
                </span>
              </div>
            </button>
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
}> = ({ data, height = 240 }) => {
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

  const firstPt = getCoordinates(0, 0);
  const lastPt = getCoordinates(0, data.length - 1);
  const incomeArea = `${incomeLine} L ${lastPt.x},${height - paddingY} L ${firstPt.x},${height - paddingY} Z`;
  const expenseArea = `${expenseLine} L ${lastPt.x},${height - paddingY} L ${firstPt.x},${height - paddingY} Z`;

  const hoveredPoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="w-full select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-3.5 h-1.5 bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full inline-block" />
            <span>Kirim dinamikasi</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium text-rose-600 dark:text-rose-400">
            <span className="w-3.5 h-1.5 bg-gradient-to-r from-rose-500 to-rose-400 rounded-full inline-block" />
            <span>Chiqim dinamikasi</span>
          </span>
        </div>

        {hoveredPoint ? (
          <div className="flex items-center gap-2.5 font-mono text-xs px-3 py-1.5 rounded-xl bg-[#081220] text-white border border-white/15 shadow-md tabular-nums">
            <span className="text-slate-300 font-sans font-medium text-[11px]">{hoveredPoint.date}:</span>
            <span className="text-emerald-400 font-bold">+{formatMoney(hoveredPoint.income)}</span>
            <span className="text-rose-400 font-bold">-{formatMoney(hoveredPoint.expense)}</span>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">Nuqtalar ustiga olib boring</span>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id={`lineGradInc-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id={`lineGradExp-${chartId}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#F87171" />
            </linearGradient>

            <linearGradient id={`gradInc-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`gradExp-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

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
            className="text-slate-200 dark:text-slate-800 opacity-50"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          <path d={incomeArea} fill={`url(#gradInc-${chartId})`} />
          <path d={expenseArea} fill={`url(#gradExp-${chartId})`} />

          <path
            d={incomeLine}
            fill="none"
            stroke={`url(#lineGradInc-${chartId})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={expenseLine}
            fill="none"
            stroke={`url(#lineGradExp-${chartId})`}
            strokeWidth="3"
            strokeLinecap="round"
          />

          {hoveredIdx !== null && (
            <line
              x1={getCoordinates(0, hoveredIdx).x}
              y1={paddingY}
              x2={getCoordinates(0, hoveredIdx).x}
              y2={height - paddingY}
              stroke="currentColor"
              className="text-emerald-500 opacity-75"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
          )}

          {data.map((d, i) => {
            const incPt = getCoordinates(d.income, i);
            const expPt = getCoordinates(d.expense, i);
            const isHovered = hoveredIdx === i;

            return (
              <g key={i}>
                <rect
                  x={incPt.x - width / data.length / 2}
                  y={0}
                  width={width / data.length}
                  height={height}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setHoveredIdx(i)}
                />

                {d.income > 0 && (
                  <circle
                    cx={incPt.x}
                    cy={incPt.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#10B981"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all duration-150 pointer-events-none"
                  />
                )}
                {d.expense > 0 && (
                  <circle
                    cx={expPt.x}
                    cy={expPt.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#EF4444"
                    stroke="#ffffff"
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all duration-150 pointer-events-none"
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
  const size = 152;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const maxAngle = 0.75;
  const arcLength = circumference * maxAngle;
  const fillRatio = Math.min(1, Math.max(0, percentage / 100));
  const strokeDashoffset = arcLength * (1 - fillRatio);

  const getColor = () => {
    if (percentage > 100) return '#EF4444';
    if (percentage >= 80) return '#F59E0B';
    return '#10B981';
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
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            className="text-slate-100 dark:text-white/[0.08]"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
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
            className="transition-all duration-500 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold font-mono tabular-nums tracking-tight text-slate-900 dark:text-white">
            {percentage}%
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Bajarilgan
          </span>
        </div>
      </div>

      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
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
      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
        Bu muddatda xarajatlar mavjud emas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.slice(0, 6).map((cat, i) => {
        const rawColor = cat.color || '';
        const isForbiddenPurple =
          /^#(8b5cf6|7c3aed|6366f1|a855f7|9333ea|ec4899)/i.test(rawColor);
        const catColor = isForbiddenPurple
          ? CHART_PALETTE.categories[i % CHART_PALETTE.categories.length]
          : rawColor || CHART_PALETTE.categories[i % CHART_PALETTE.categories.length];

        return (
          <div
            key={i}
            className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-2 text-xs mb-1.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: catColor }}
                />
                <span className="truncate">{cat.categoryName}</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                  ({cat.count} ta)
                </span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatMoney(cat.amount)}
                </span>
                <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 min-w-[32px] text-right font-semibold tabular-nums">
                  {cat.percentage}%
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-200/70 dark:bg-white/[0.08] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
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
