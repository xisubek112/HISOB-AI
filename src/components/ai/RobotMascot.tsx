import React, { useId } from 'react';
import { RobotState } from './types.ts';

interface RobotMascotProps {
  state?: RobotState;
  size?: 'avatar' | 'compact' | 'medium' | 'hero';
  className?: string;
}

const SIZE_MAP = {
  avatar: 'w-9 h-9',
  compact: 'w-14 h-14',
  medium: 'w-28 h-28 sm:w-32 sm:h-32',
  hero: 'w-40 h-40 sm:w-48 sm:h-48',
};

export const RobotMascot: React.FC<RobotMascotProps> = ({
  state = 'idle',
  size = 'hero',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const isCompact = size === 'avatar' || size === 'compact';

  const glowColor =
    state === 'error'
      ? 'rgba(239, 68, 68, 0.34)'
      : state === 'listening'
      ? 'rgba(6, 182, 212, 0.42)'
      : state === 'thinking'
      ? 'rgba(16, 185, 129, 0.36)'
      : 'rgba(16, 185, 129, 0.30)';

  const accentStroke =
    state === 'error'
      ? '#EF4444'
      : state === 'listening'
      ? '#06B6D4'
      : state === 'success'
      ? '#34D399'
      : '#10B981';

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${SIZE_MAP[size]} ${className}`}
      aria-hidden="true"
    >
      {/* Ambient Halo & Voice Pulse Rings */}
      {!isCompact && (
        <>
          <div
            className="pointer-events-none absolute inset-1 rounded-full blur-2xl transition-colors duration-300"
            style={{ backgroundColor: glowColor }}
          />
          {state === 'listening' && (
            <>
              <span className="hai-voice-ring pointer-events-none absolute inset-2 rounded-full border-2 border-cyan-400/60" />
              <span
                className="hai-voice-ring pointer-events-none absolute inset-2 rounded-full border border-emerald-400/50"
                style={{ animationDelay: '0.55s' }}
              />
            </>
          )}
          {state === 'thinking' && (
            <span className="pointer-events-none absolute inset-2 rounded-full border border-dashed border-emerald-400/55 animate-spin [animation-duration:7s]" />
          )}
          {state === 'success' && (
            <span className="pointer-events-none absolute inset-2 rounded-full border-2 border-emerald-400/70 animate-pulse" />
          )}
        </>
      )}

      {/* Main 3D-shaded SVG Mascot */}
      <svg
        viewBox="0 0 220 220"
        className={`relative z-10 w-full h-full drop-shadow-[0_14px_26px_rgba(6,20,17,0.45)] ${
          state === 'idle' || state === 'speaking' ? 'hai-robot-float' : ''
        }`}
      >
        <defs>
          {/* 3D Pearlescent White Shell Gradient */}
          <radialGradient id={`shell-${uid}`} cx="36%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="58%" stopColor="#E6F4F1" />
            <stop offset="100%" stopColor="#B8D4CD" />
          </radialGradient>

          {/* Emerald Accent Gradient */}
          <linearGradient id={`emerald-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="55%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Dark Glossy Visor */}
          <linearGradient id={`visor-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0F2933" />
            <stop offset="55%" stopColor="#081220" />
            <stop offset="100%" stopColor="#051314" />
          </linearGradient>

          {/* Visor Eye Glow */}
          <radialGradient id={`eye-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="50%" stopColor={accentStroke} />
            <stop offset="100%" stopColor="#06B6D4" />
          </radialGradient>
        </defs>

        {/* Ground Ambient Shadow */}
        {!isCompact && (
          <ellipse cx="110" cy="204" rx="46" ry="8" fill="#04120F" opacity="0.55" />
        )}

        {/* Antenna */}
        <line
          x1="110"
          y1="22"
          x2="110"
          y2="40"
          stroke={`url(#emerald-${uid})`}
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="110" cy="18" r="7" fill={accentStroke} />
        <circle cx="108" cy="16" r="2.2" fill="#FFFFFF" opacity="0.85" />

        {/* Left & Right Floating Rounded Arms */}
        <rect
          x="28"
          y="128"
          width="20"
          height="42"
          rx="10"
          transform={state === 'speaking' || state === 'success' ? 'rotate(-14 38 148)' : 'rotate(-6 38 148)'}
          fill={`url(#shell-${uid})`}
          stroke="#9FC6BE"
          strokeWidth="1.5"
        />
        <rect
          x="172"
          y="128"
          width="20"
          height="42"
          rx="10"
          transform={state === 'speaking' || state === 'success' ? 'rotate(14 182 148)' : 'rotate(6 182 148)'}
          fill={`url(#shell-${uid})`}
          stroke="#9FC6BE"
          strokeWidth="1.5"
        />

        {/* Smooth Rounded Torso */}
        <rect
          x="54"
          y="122"
          width="112"
          height="70"
          rx="34"
          fill={`url(#shell-${uid})`}
          stroke="#A7CBC2"
          strokeWidth="1.5"
        />
        {/* Torso emerald collar rim */}
        <path
          d="M 72 124 Q 110 134 148 124"
          fill="none"
          stroke={`url(#emerald-${uid})`}
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Chest HISOBOT AI Emblem */}
        <rect
          x="84"
          y="142"
          width="52"
          height="32"
          rx="11"
          fill="#081220"
          stroke={accentStroke}
          strokeWidth="1.8"
        />
        {/* Mini emerald chart bars emblem inside chest */}
        <rect x="97" y="159" width="5" height="9" rx="1.5" fill="#10B981" />
        <rect x="106" y="154" width="5" height="14" rx="1.5" fill="#34D399" />
        <rect x="115" y="149" width="5" height="19" rx="1.5" fill="#06B6D4" />

        {/* Sleek Headset Band & Ear Cups */}
        <path
          d="M 46 86 C 46 38 174 38 174 86"
          fill="none"
          stroke={`url(#emerald-${uid})`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <rect
          x="33"
          y="69"
          width="16"
          height="34"
          rx="8"
          fill="#081220"
          stroke={accentStroke}
          strokeWidth="2.5"
        />
        <rect
          x="171"
          y="69"
          width="16"
          height="34"
          rx="8"
          fill="#081220"
          stroke={accentStroke}
          strokeWidth="2.5"
        />
        {/* Headset mic boom (glows cyan when listening) */}
        <path
          d="M 42 98 Q 48 112 72 110"
          fill="none"
          stroke={state === 'listening' ? '#06B6D4' : '#34D399'}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx="74"
          cy="110"
          r="4"
          fill={state === 'listening' ? '#06B6D4' : '#10B981'}
        />

        {/* 3D Rounded Head */}
        <rect
          x="48"
          y="38"
          width="124"
          height="88"
          rx="38"
          fill={`url(#shell-${uid})`}
          stroke="#A7CBC2"
          strokeWidth="1.6"
        />
        {/* Top specular highlight on head */}
        <ellipse cx="94" cy="50" rx="28" ry="6" fill="#FFFFFF" opacity="0.65" />

        {/* Glossy Dark Glass Visor */}
        <rect
          x="60"
          y="56"
          width="100"
          height="54"
          rx="22"
          fill={`url(#visor-${uid})`}
          stroke={accentStroke}
          strokeWidth="2"
        />
        {/* Visor glass reflection */}
        <path
          d="M 72 62 Q 110 58 142 66"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.18"
        />

        {/* Expressive Eyes based on RobotState */}
        {state === 'error' ? (
          <>
            <path d="M 80 78 L 94 86 M 94 78 L 80 86" stroke="#EF4444" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 126 78 L 140 86 M 140 78 L 126 86" stroke="#EF4444" strokeWidth="3.2" strokeLinecap="round" />
          </>
        ) : state === 'success' ? (
          <>
            <path d="M 79 84 Q 87 74 95 84" fill="none" stroke="#34D399" strokeWidth="3.8" strokeLinecap="round" />
            <path d="M 125 84 Q 133 74 141 84" fill="none" stroke="#34D399" strokeWidth="3.8" strokeLinecap="round" />
          </>
        ) : state === 'thinking' ? (
          <>
            <circle cx="87" cy="82" r="8" fill={`url(#eye-${uid})`} className="animate-pulse" />
            <circle cx="133" cy="82" r="8" fill={`url(#eye-${uid})`} className="animate-pulse" />
            <circle cx="85" cy="79" r="2.5" fill="#FFFFFF" />
            <circle cx="131" cy="79" r="2.5" fill="#FFFFFF" />
          </>
        ) : (
          <g className="hai-robot-blink">
            <rect
              x="79"
              y="72"
              width="16"
              height="18"
              rx="8"
              fill={`url(#eye-${uid})`}
            />
            <rect
              x="125"
              y="72"
              width="16"
              height="18"
              rx="8"
              fill={`url(#eye-${uid})`}
            />
            <circle cx="84" cy="77" r="2.6" fill="#FFFFFF" />
            <circle cx="130" cy="77" r="2.6" fill="#FFFFFF" />
          </g>
        )}

        {/* Expressive Mouth / Equalizer */}
        {state === 'speaking' ? (
          <g>
            <rect x="96" y="95" width="4" height="8" rx="2" fill="#34D399" className="hai-wave-bar" />
            <rect x="103" y="93" width="4" height="11" rx="2" fill="#06B6D4" className="hai-wave-bar" style={{ animationDelay: '0.15s' }} />
            <rect x="110" y="93" width="4" height="11" rx="2" fill="#34D399" className="hai-wave-bar" style={{ animationDelay: '0.3s' }} />
            <rect x="117" y="95" width="4" height="8" rx="2" fill="#06B6D4" className="hai-wave-bar" style={{ animationDelay: '0.45s' }} />
          </g>
        ) : state === 'listening' ? (
          <circle cx="110" cy="99" r="4.5" fill="#06B6D4" className="animate-ping" />
        ) : state === 'error' ? (
          <path d="M 100 101 Q 110 95 120 101" fill="none" stroke="#EF4444" strokeWidth="2.8" strokeLinecap="round" />
        ) : (
          <path d="M 99 97 Q 110 104 121 97" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
};
