/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface DualSeriesChartProps {
  title: string;
  subtitle?: string;
  data: Array<{
    label: string;
    primary: number;
    secondary: number;
  }>;
  primaryLabel: string;
  secondaryLabel: string;
  primaryColor?: string;
  secondaryColor?: string;
  formatValue?: (v: number) => string;
}

export const AdminDualBarChart: React.FC<DualSeriesChartProps> = ({
  title,
  subtitle,
  data,
  primaryLabel,
  secondaryLabel,
  primaryColor = '#10B981',
  secondaryColor = '#0EA5E9',
  formatValue = (v) => String(v),
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.primary, d.secondary))
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: primaryColor }} />
            <span>{primaryLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: secondaryColor }} />
            <span>{secondaryLabel}</span>
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-400">
          Maʼlumotlar mavjud emas
        </div>
      ) : (
        <div className="relative">
          <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-6 pb-1 border-b border-slate-200 dark:border-white/[0.08]">
            {data.map((item, idx) => {
              const pPct = Math.max(item.primary > 0 ? 6 : 2, Math.round((item.primary / maxVal) * 100));
              const sPct = Math.max(item.secondary > 0 ? 6 : 2, Math.round((item.secondary / maxVal) * 100));
              const isHovered = hoveredIdx === idx;
              return (
                <div
                  key={item.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="flex-1 min-w-0 h-full flex flex-col justify-end items-center relative group cursor-pointer"
                >
                  {isHovered && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg border border-slate-200 dark:border-white/15 bg-slate-900 dark:bg-[#071B18] px-2.5 py-1.5 text-[11px] text-white shadow-sm pointer-events-none">
                      <div className="font-mono text-[10px] text-slate-300 mb-0.5">{item.label}</div>
                      <div className="tabular-nums">
                        {primaryLabel}: <span className="font-bold">{formatValue(item.primary)}</span>
                      </div>
                      <div className="tabular-nums">
                        {secondaryLabel}: <span className="font-bold">{formatValue(item.secondary)}</span>
                      </div>
                    </div>
                  )}
                  <div className="w-full h-full flex items-end justify-center gap-0.5 sm:gap-1 px-0.5">
                    <div
                      className="flex-1 max-w-[12px] rounded-t-xs transition-opacity"
                      style={{
                        height: `${pPct}%`,
                        backgroundColor: primaryColor,
                        opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1,
                      }}
                    />
                    <div
                      className="flex-1 max-w-[12px] rounded-t-xs transition-opacity"
                      style={{
                        height: `${sPct}%`,
                        backgroundColor: secondaryColor,
                        opacity: hoveredIdx !== null && !isHovered ? 0.5 : 0.85,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-1 mt-2 text-[10px] font-mono text-slate-400">
            <span>{data[0]?.label}</span>
            {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
            <span>{data[data.length - 1]?.label}</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface SingleBarChartProps {
  title: string;
  subtitle?: string;
  data: Array<{ label: string; value: number }>;
  color?: string;
  formatValue?: (v: number) => string;
}

export const AdminSingleBarChart: React.FC<SingleBarChartProps> = ({
  title,
  subtitle,
  data,
  color = '#10B981',
  formatValue = (v) => String(v),
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0B1D20] p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      {data.length === 0 ? (
        <div className="h-44 flex items-center justify-center text-xs text-slate-400">
          Maʼlumotlar mavjud emas
        </div>
      ) : (
        <div>
          <div className="h-44 flex items-end gap-2 pt-6 pb-1 border-b border-slate-200 dark:border-white/[0.08]">
            {data.map((item, idx) => {
              const pct = Math.max(item.value > 0 ? 8 : 3, Math.round((item.value / maxVal) * 100));
              const isHovered = hoveredIdx === idx;
              return (
                <div
                  key={item.label}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="flex-1 min-w-0 h-full flex flex-col justify-end items-center relative cursor-pointer"
                >
                  {isHovered && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg border border-slate-200 dark:border-white/15 bg-slate-900 dark:bg-[#071B18] px-2.5 py-1 text-[11px] text-white shadow-sm pointer-events-none">
                      <span className="font-mono text-slate-300 mr-1.5">{item.label}:</span>
                      <span className="font-bold tabular-nums">{formatValue(item.value)}</span>
                    </div>
                  )}
                  <div
                    className="w-full max-w-[32px] rounded-t-sm transition-opacity"
                    style={{
                      height: `${pct}%`,
                      backgroundColor: color,
                      opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1,
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-1 mt-2 text-[10px] font-mono text-slate-400">
            {data.map((d) => (
              <span key={d.label} className="truncate text-center flex-1">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
