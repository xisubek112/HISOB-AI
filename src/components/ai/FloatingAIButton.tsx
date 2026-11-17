/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface FloatingAIButtonProps {
  onClick: () => void;
}

export const FloatingAIButton: React.FC<FloatingAIButtonProps> = ({ onClick }) => {
  return (
    <div className="fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),8px)+68px)] lg:right-6 lg:bottom-6 z-40">
      {/* Ambient emerald outer aura */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1.5 rounded-full bg-emerald-400/40 blur-md motion-safe:animate-pulse"
      />

      <button
        type="button"
        onClick={onClick}
        aria-label="HISOBOT AI ga kirish"
        title="HISOBOT AI ga kirish"
        className="group relative flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-emerald-400/90 bg-gradient-to-b from-[#0E4333] via-[#06271E] to-[#031712] shadow-[0_0_24px_rgba(16,185,129,0.58),0_10px_24px_rgba(0,0,0,0.36)] transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 cursor-pointer select-none"
      >
        {/* Inner glossy highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[2px] rounded-full bg-gradient-to-b from-white/15 via-transparent to-transparent"
        />

        {/* Smiling Robot Head + Sparkle */}
        <svg
          viewBox="0 0 44 34"
          className="relative z-10 h-[31px] w-[40px] -mt-0.5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
          fill="none"
          aria-hidden="true"
        >
          {/* Antenna */}
          <line
            x1="22"
            y1="5.2"
            x2="22"
            y2="9.2"
            stroke="#FFFFFF"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="22" cy="3.8" r="2.2" fill="#FFFFFF" />

          {/* Top-right 4-point sparkle */}
          <path
            d="M37.5 3.5L38.35 6.15L41 7L38.35 7.85L37.5 10.5L36.65 7.85L34 7L36.65 6.15L37.5 3.5Z"
            fill="#ECFDF5"
          />

          {/* Left & Right Ear Cups */}
          <rect x="6.5" y="15.5" width="3.2" height="9.2" rx="1.6" fill="#FFFFFF" />
          <rect x="34.3" y="15.5" width="3.2" height="9.2" rx="1.6" fill="#FFFFFF" />

          {/* Robot Head Shell */}
          <rect x="10.2" y="9.2" width="23.6" height="20.6" rx="7.2" fill="#FFFFFF" />

          {/* Dark Face Screen */}
          <rect x="12.9" y="12.3" width="18.2" height="14.4" rx="4.8" fill="#05261D" />

          {/* Happy Curved Eyes (^ ^) */}
          <path
            d="M16 18.8C16.45 17.05 18.75 17.05 19.2 18.8"
            stroke="#ECFFF6"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M24.8 18.8C25.25 17.05 27.55 17.05 28 18.8"
            stroke="#ECFFF6"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Happy Smile */}
          <path
            d="M19.3 22.1C20.2 23.65 23.8 23.65 24.7 22.1"
            stroke="#ECFFF6"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>

        {/* Compact AI Pill Badge */}
        <span className="relative z-10 -mt-0.5 inline-flex items-center justify-center rounded-[5px] bg-[#1EE68A] px-2 py-[2px] text-[9.5px] font-black leading-none tracking-wider text-[#032018] shadow-[0_1px_4px_rgba(16,185,129,0.5)]">
          AI
        </span>
      </button>
    </div>
  );
};
