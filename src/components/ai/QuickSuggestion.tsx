import React from 'react';
import { Sparkles } from 'lucide-react';
import { QuickSuggestionItem } from './types.ts';

interface QuickSuggestionProps {
  items: QuickSuggestionItem[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  variant?: 'chips' | 'grid';
}

export const QuickSuggestion: React.FC<QuickSuggestionProps> = ({
  items,
  onSelect,
  disabled = false,
  variant = 'chips',
}) => {
  if (variant === 'grid') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item.prompt)}
            className="min-h-10 px-3.5 py-2 rounded-xl border border-slate-200/85 dark:border-emerald-500/25 bg-white/85 dark:bg-[#0D1927]/85 hover:border-emerald-500/60 hover:bg-emerald-500/[0.08] text-xs font-medium text-slate-800 dark:text-slate-100 transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer text-left"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(item.prompt)}
          className="min-h-8 px-3 py-1.5 rounded-xl border border-slate-200/85 dark:border-white/[0.10] bg-white dark:bg-[#0D1927] hover:border-emerald-500/50 text-[11px] sm:text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
        >
          <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
