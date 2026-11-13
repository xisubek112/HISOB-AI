import React from 'react';
import { Bot, ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from './Badge.tsx';

export interface AIInsightCardProps {
  title?: string;
  insight: string;
  sourceLabel?: string;
  isLiveInsight?: boolean;
  ctaLabel?: string;
  onCtaClick?: () => void;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function AIInsightCard({
  title = 'AI moliyaviy tavsiyasi',
  insight,
  sourceLabel,
  isLiveInsight = true,
  ctaLabel = 'Batafsil tahlil',
  onCtaClick,
  secondaryAction,
  className = '',
}: AIInsightCardProps) {
  return (
    <section
      className={[
        'relative overflow-hidden rounded-2xl p-5',
        'bg-white dark:bg-[#111B27]',
        'border border-cyan-500/30 dark:border-cyan-400/25',
        'shadow-[0_1px_3px_rgba(15,23,42,0.03)] dark:shadow-none',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/25 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{title}</h3>
            {sourceLabel && (
              <span className="text-[11px] text-cyan-700 dark:text-cyan-300 font-medium block truncate">
                {sourceLabel}
              </span>
            )}
          </div>
        </div>

        <Badge tone={isLiveInsight ? 'teal' : 'neutral'} size="sm">
          <Sparkles className="w-3 h-3" />
          <span>{isLiveInsight ? 'Jonli tahlil' : 'Namuna'}</span>
        </Badge>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
        {insight}
      </p>

      {(onCtaClick || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          {onCtaClick && (
            <button
              type="button"
              onClick={onCtaClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>{ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </section>
  );
}
