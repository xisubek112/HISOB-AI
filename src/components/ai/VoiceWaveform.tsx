import React from 'react';

interface VoiceWaveformProps {
  active?: boolean;
  paused?: boolean;
  mode?: 'listening' | 'speaking' | 'thinking';
  barsCount?: number;
  className?: string;
}

const BAR_HEIGHTS = [35, 65, 90, 55, 100, 72, 48, 88, 60, 95, 52, 78, 42, 68, 38];

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  active = false,
  paused = false,
  mode = 'listening',
  barsCount = 15,
  className = '',
}) => {
  const bars = BAR_HEIGHTS.slice(0, barsCount);

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-1.5 h-10 ${className}`}
    >
      {bars.map((pct, idx) => (
        <span
          key={idx}
          className={`w-1 rounded-full transition-all duration-200 ${
            active && !paused
              ? mode === 'speaking'
                ? 'bg-gradient-to-t from-emerald-400 to-teal-300 hai-wave-bar'
                : 'bg-gradient-to-t from-emerald-500 to-cyan-400 hai-wave-bar'
              : paused
              ? 'bg-amber-400/65 h-2'
              : 'bg-slate-400/40 dark:bg-white/20 h-2'
          }`}
          style={
            active && !paused
              ? {
                  height: `${pct}%`,
                  animationDelay: `${(idx % 6) * 0.11}s`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
};
