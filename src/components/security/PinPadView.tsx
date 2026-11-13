/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useCallback } from 'react';
import { Lock, Fingerprint, ScanFace, Delete, ShieldAlert } from 'lucide-react';
import { BiometryType } from '@capgo/capacitor-native-biometric';
import type { PinLength } from '../../services/appLock.ts';

interface PinPadViewProps {
  pin: string;
  pinLength: PinLength;
  title?: string;
  subtitle?: string;
  errorMessage?: string | null;
  shakeKey?: number;
  disabled?: boolean;
  lockoutRemainingSec?: number;
  showBiometricButton?: boolean;
  biometryType?: BiometryType;
  biometricBusy?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onBiometricClick?: () => void;
  onForgotPin?: () => void;
  topSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
  compact?: boolean;
}

const KEYPAD_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const PinPadView: React.FC<PinPadViewProps> = ({
  pin,
  pinLength,
  title = 'PIN-kod',
  subtitle = 'Ilovani himoyalash uchun PIN-kodni kiriting',
  errorMessage,
  shakeKey = 0,
  disabled = false,
  lockoutRemainingSec = 0,
  showBiometricButton = false,
  biometryType = BiometryType.NONE,
  biometricBusy = false,
  onDigit,
  onBackspace,
  onBiometricClick,
  onForgotPin,
  topSlot,
  bottomSlot,
  compact = false,
}) => {
  const isLockedOut = lockoutRemainingSec > 0;
  const inputBlocked = disabled || isLockedOut;

  const triggerHaptic = useCallback((pattern: number | number[]) => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore if vibration API unavailable
    }
  }, []);

  useEffect(() => {
    if (shakeKey > 0) {
      triggerHaptic([45, 35, 65]);
    }
  }, [shakeKey, triggerHaptic]);

  // Physical keyboard support for desktop & hardware keyboards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (inputBlocked) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        triggerHaptic(8);
        onDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        triggerHaptic(8);
        onBackspace();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputBlocked, onDigit, onBackspace, triggerHaptic]);

  const handleDigitPress = (d: string) => {
    if (inputBlocked || pin.length >= pinLength) return;
    triggerHaptic(8);
    onDigit(d);
  };

  const handleBackspacePress = () => {
    if (inputBlocked || pin.length === 0) return;
    triggerHaptic(8);
    onBackspace();
  };

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${secs} soniya`;
  };

  const isFace =
    biometryType === BiometryType.FACE_AUTHENTICATION ||
    biometryType === BiometryType.FACE_ID;

  const buttonSizeClass = compact
    ? 'w-14 h-14 sm:w-16 sm:h-16 text-xl'
    : 'w-[68px] h-[68px] sm:w-[74px] sm:h-[74px] text-2xl';

  return (
    <div className="w-full max-w-[340px] mx-auto flex flex-col items-center text-center select-none">
      {/* Centered Emerald Gradient Lock Icon */}
      <div className={compact ? 'mb-3' : 'mb-5'}>
        <div
          className={[
            'mx-auto rounded-[22px] bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-slate-950 flex items-center justify-center shadow-[0_14px_34px_rgba(16,185,129,0.32)]',
            compact ? 'w-12 h-12 rounded-2xl' : 'w-16 h-16',
          ].join(' ')}
        >
          {isLockedOut ? (
            <ShieldAlert className={compact ? 'w-6 h-6 text-rose-950' : 'w-7 h-7 text-rose-950'} />
          ) : (
            <Lock className={compact ? 'w-5 h-5' : 'w-7 h-7'} strokeWidth={2.3} />
          )}
        </div>
      </div>

      {/* Heading & Subtitle */}
      <h2
        className={[
          'font-extrabold tracking-tight text-slate-900 dark:text-white',
          compact ? 'text-xl' : 'text-2xl',
        ].join(' ')}
      >
        {title}
      </h2>
      <p className="mt-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed">
        {subtitle}
      </p>

      {topSlot && <div className="mt-3 w-full">{topSlot}</div>}

      {/* Animated PIN Dots */}
      <div
        key={shakeKey}
        aria-label={`${pin.length} / ${pinLength} raqam kiritildi`}
        className={[
          'flex items-center justify-center gap-3.5 sm:gap-4',
          compact ? 'my-5' : 'my-7',
          shakeKey > 0 ? 'hai-shake' : '',
        ].join(' ')}
      >
        {Array.from({ length: pinLength }).map((_, idx) => {
          const filled = idx < pin.length;
          const isError = shakeKey > 0 && Boolean(errorMessage);
          return (
            <span
              key={idx}
              className={[
                'w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-150',
                filled ? 'hai-pin-pop' : '',
                isError
                  ? 'bg-rose-500 ring-4 ring-rose-500/20'
                  : filled
                  ? 'bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_0_14px_rgba(16,185,129,0.55)] scale-110'
                  : 'bg-slate-200 dark:bg-white/[0.14] border border-slate-300/80 dark:border-white/[0.18]',
              ].join(' ')}
            />
          );
        })}
      </div>

      {/* Feedback / Lockout Area */}
      <div className="min-h-[2.25rem] mb-2 flex items-center justify-center px-2">
        {isLockedOut ? (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-rose-500/12 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-semibold tabular-nums">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Vaqtinchalik bloklandi: {formatCountdown(lockoutRemainingSec)}</span>
          </div>
        ) : errorMessage ? (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 leading-snug">
            {errorMessage}
          </p>
        ) : null}
      </div>

      {/* Round 0–9 Numeric Keypad */}
      <div
        className={[
          'grid grid-cols-3 place-items-center',
          compact ? 'gap-x-5 gap-y-3' : 'gap-x-6 gap-y-3.5 sm:gap-x-7 sm:gap-y-4',
        ].join(' ')}
      >
        {KEYPAD_DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={inputBlocked}
            onClick={() => handleDigitPress(digit)}
            aria-label={`Raqam ${digit}`}
            className={[
              buttonSizeClass,
              'rounded-full font-bold tabular-nums transition-all duration-100 flex items-center justify-center cursor-pointer',
              'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white',
              'border border-slate-200/90 dark:border-white/[0.10]',
              'shadow-[0_2px_10px_rgba(15,23,42,0.05)] dark:shadow-none',
              'hover:bg-emerald-50 hover:border-emerald-500/40 dark:hover:bg-white/[0.12] dark:hover:border-emerald-400/40',
              'active:scale-95 active:bg-emerald-500/15 dark:active:bg-emerald-500/20',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
            ].join(' ')}
          >
            {digit}
          </button>
        ))}

        {/* Bottom Left: Biometric Button or Symmetry Spacer */}
        <div className="flex items-center justify-center">
          {showBiometricButton && onBiometricClick ? (
            <button
              type="button"
              disabled={isLockedOut || biometricBusy}
              onClick={() => {
                triggerHaptic(12);
                onBiometricClick();
              }}
              aria-label="Biometrik kirish"
              title="Biometrik kirish"
              className={[
                buttonSizeClass,
                'rounded-full transition-all duration-100 flex items-center justify-center cursor-pointer',
                'bg-emerald-500/10 dark:bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                'border border-emerald-500/25 hover:bg-emerald-500/20 active:scale-95',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {isFace ? (
                <ScanFace className="w-6 h-6" />
              ) : (
                <Fingerprint className="w-6 h-6" />
              )}
            </button>
          ) : (
            <span className={buttonSizeClass} aria-hidden="true" />
          )}
        </div>

        {/* Bottom Center: 0 */}
        <button
          type="button"
          disabled={inputBlocked}
          onClick={() => handleDigitPress('0')}
          aria-label="Raqam 0"
          className={[
            buttonSizeClass,
            'rounded-full font-bold tabular-nums transition-all duration-100 flex items-center justify-center cursor-pointer',
            'bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white',
            'border border-slate-200/90 dark:border-white/[0.10]',
            'shadow-[0_2px_10px_rgba(15,23,42,0.05)] dark:shadow-none',
            'hover:bg-emerald-50 hover:border-emerald-500/40 dark:hover:bg-white/[0.12] dark:hover:border-emerald-400/40',
            'active:scale-95 active:bg-emerald-500/15 dark:active:bg-emerald-500/20',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
          ].join(' ')}
        >
          0
        </button>

        {/* Bottom Right: Backspace / Delete */}
        <button
          type="button"
          disabled={inputBlocked || pin.length === 0}
          onClick={handleBackspacePress}
          aria-label="Oxirgi raqamni oʻchirish"
          title="Oʻchirish"
          className={[
            buttonSizeClass,
            'rounded-full transition-all duration-100 flex items-center justify-center cursor-pointer',
            'bg-slate-100/80 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300',
            'border border-slate-200/80 dark:border-white/[0.08]',
            'hover:bg-slate-200/80 dark:hover:bg-white/[0.10] active:scale-95',
            'disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100',
          ].join(' ')}
        >
          <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      {/* Forgot PIN Link */}
      {onForgotPin && (
        <button
          type="button"
          onClick={onForgotPin}
          className="mt-5 py-2 px-3 min-h-[44px] text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors cursor-pointer"
        >
          PIN-kodingizni unutdingizmi?
        </button>
      )}

      {bottomSlot && <div className="mt-3 w-full">{bottomSlot}</div>}
    </div>
  );
};
