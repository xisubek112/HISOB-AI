import React from 'react';
import {
  TrendingUp,
  Sparkles,
  PieChart,
  LineChart,
  Target,
  ScanLine,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { FinancialHealthScore } from '../../types/finance.ts';
import { AI_CAPABILITIES, AICapabilityItem } from './types.ts';
import { Badge } from '../../design-system/index.ts';

interface AIInsightPanelProps {
  healthScore: FinancialHealthScore | null;
  onSelectCapability: (item: AICapabilityItem) => void;
  disabled?: boolean;
}

const CAP_ICONS: Record<string, React.ElementType> = {
  'cap-analysis': TrendingUp,
  'cap-recommend': Sparkles,
  'cap-budget': PieChart,
  'cap-forecast': LineChart,
  'cap-goals': Target,
  'cap-receipt': ScanLine,
};

const TONE_CLASSES: Record<AICapabilityItem['tone'], string> = {
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  teal: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  amber: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
};

export const AIInsightPanel: React.FC<AIInsightPanelProps> = ({
  healthScore,
  onSelectCapability,
  disabled = false,
}) => {
  return (
    <div className="flex flex-col h-full min-h-0 gap-3.5">
      {/* Live Financial Health Score Card */}
      {healthScore && (
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-[#081220] via-[#0B2330] to-[#0E3335] p-3.5 text-white shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Moliyaviy indeks</span>
            </span>
            <Badge tone="emerald">Baho: {healthScore.grade}</Badge>
          </div>
          <div className="flex items-baseline gap-1.5 mb-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
              {healthScore.score}
            </span>
            <span className="text-[11px] text-slate-400">/ 100 ball</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
            {healthScore.title}
          </p>
        </div>
      )}

      {/* AI Capabilities List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0">
        <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          AI imkoniyatlari
        </div>

        {AI_CAPABILITIES.map((cap) => {
          const Icon = CAP_ICONS[cap.id] || Sparkles;
          return (
            <button
              key={cap.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectCapability(cap)}
              className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#081220]/65 hover:border-emerald-500/45 hover:bg-emerald-500/[0.06] transition-all flex items-center gap-2.5 group disabled:opacity-50 cursor-pointer"
            >
              <span
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  TONE_CLASSES[cap.tone]
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {cap.title}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {cap.subtitle}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
