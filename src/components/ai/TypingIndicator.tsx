import React from 'react';
import { RobotMascot } from './RobotMascot.tsx';

interface TypingIndicatorProps {
  label?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  label = "Moliyaviy ma'lumotlaringiz tahlil qilinmoqda...",
}) => {
  return (
    <div className="flex items-start gap-2.5 mr-auto max-w-md hai-fade-up" role="status" aria-live="polite">
      <div className="shrink-0 mt-0.5">
        <RobotMascot state="thinking" size="avatar" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-xs bg-slate-100 dark:bg-[#0D1927]/95 border border-slate-200/80 dark:border-emerald-500/20 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-3 shadow-xs">
        <div className="flex items-center gap-1" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="font-medium">{label}</span>
      </div>
    </div>
  );
};
