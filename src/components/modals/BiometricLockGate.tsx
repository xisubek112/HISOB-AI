/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KeyRound, LogOut, ArrowLeft, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { BiometryType } from '@capgo/capacitor-native-biometric';
import { Button, Input } from '../../design-system/index.ts';
import { PinPadView } from '../security/PinPadView.tsx';
import { api } from '../../services/api.ts';
import {
  checkBiometricCapability,
  getAppLockConfig,
  getLockoutRemainingSeconds,
  resetPinAfterReauth,
  unlockWithBiometrics,
  verifyUserPin,
} from '../../services/appLock.ts';

interface BiometricLockGateProps {
  userId: string;
  userName?: string;
  userEmail?: string;
  onUnlock: () => void;
  onSetupNewPin?: () => void;
  onSignOut: () => void;
}

export const BiometricLockGate: React.FC<BiometricLockGateProps> = ({
  userId,
  userName,
  userEmail,
  onUnlock,
  onSetupNewPin,
  onSignOut,
}) => {
  const initialConfig = getAppLockConfig(userId);
  const [pin, setPin] = useState('');
  const [pinLength] = useState(initialConfig.pinLength);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(() =>
    getLockoutRemainingSeconds(initialConfig)
  );

  // Biometric capability state
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.NONE);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const autoBiometricTriggeredRef = useRef(false);

  // Forgot PIN (Password Re-Authentication) state
  const [forgotMode, setForgotMode] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [reauthBusy, setReauthBusy] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthSuccess, setReauthSuccess] = useState(false);

  // Live lockout countdown ticker
  useEffect(() => {
    if (lockoutRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      const cfg = getAppLockConfig(userId);
      const rem = getLockoutRemainingSeconds(cfg);
      setLockoutRemainingSec(rem);
      if (rem === 0) {
        setErrorMessage(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutRemainingSec, userId]);

  const handleBiometricUnlock = useCallback(async () => {
    if (biometricBusy || lockoutRemainingSec > 0) return;
    setBiometricBusy(true);
    setErrorMessage(null);
    try {
      const res = await unlockWithBiometrics(userId);
      if (res.verified) {
        onUnlock();
      } else if (res.error) {
        setErrorMessage(res.error);
      }
    } finally {
      setBiometricBusy(false);
    }
  }, [biometricBusy, lockoutRemainingSec, userId, onUnlock]);

  // Check native biometric hardware & auto-trigger prompt once on lock mount
  useEffect(() => {
    let mounted = true;
    const cfg = getAppLockConfig(userId);
    if (!cfg.biometricEnabled) return;

    checkBiometricCapability().then((cap) => {
      if (!mounted) return;
      setBiometricAvailable(cap.available);
      setBiometryType(cap.biometryType);

      if (
        cap.available &&
        !autoBiometricTriggeredRef.current &&
        getLockoutRemainingSeconds(cfg) === 0
      ) {
        autoBiometricTriggeredRef.current = true;
        handleBiometricUnlock();
      }
    });

    return () => {
      mounted = false;
    };
  }, [userId, handleBiometricUnlock]);

  const handleDigit = useCallback(
    (d: string) => {
      if (verifying || lockoutRemainingSec > 0) return;
      setErrorMessage(null);
      setPin((prev) => (prev.length < pinLength ? prev + d : prev));
    },
    [verifying, lockoutRemainingSec, pinLength]
  );

  const handleBackspace = useCallback(() => {
    if (verifying || lockoutRemainingSec > 0) return;
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  }, [verifying, lockoutRemainingSec]);

  // Auto-submit when all PIN digits are entered
  useEffect(() => {
    if (pin.length !== pinLength || verifying || forgotMode) return;

    const verify = async () => {
      setVerifying(true);
      try {
        const res = await verifyUserPin(userId, pin);
        if (res.success) {
          onUnlock();
          return;
        }
        setLockoutRemainingSec(res.lockoutRemainingSec);
        setErrorMessage(res.error || 'PIN-kod notoʻgʻri');
        setShakeKey((k) => k + 1);
        setPin('');
      } finally {
        setVerifying(false);
      }
    };

    const timer = window.setTimeout(verify, 90);
    return () => window.clearTimeout(timer);
  }, [pin, pinLength, verifying, forgotMode, userId, onUnlock]);

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReauthError(null);
    setReauthBusy(true);
    try {
      await api.verifyPassword(accountPassword);
      await resetPinAfterReauth(userId);
      setReauthSuccess(true);
    } catch (err: any) {
      setReauthError(err?.message || 'Hisob paroli notoʻgʻri');
    } finally {
      setReauthBusy(false);
    }
  };

  const isDemoAccount = userEmail?.toLowerCase() === 'demo@hisobot.uz';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HISOBOT AI ilova qulfi"
      className="fixed inset-0 z-[80] overflow-y-auto bg-[#F4F7F8] dark:bg-[#061411] text-slate-900 dark:text-white flex flex-col justify-between px-4 py-6 sm:py-10 pt-safe pb-safe"
    >
      {/* Subtle Emerald Ambient Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 -top-24 -translate-x-1/2 w-[380px] h-[380px] rounded-full bg-emerald-500/10 dark:bg-emerald-500/[0.14] blur-[110px]" />
        <div className="absolute right-0 bottom-0 w-[280px] h-[280px] rounded-full bg-teal-500/[0.08] blur-[110px]" />
      </div>

      {/* Top Account Bar */}
      <div className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-[0_6px_18px_rgba(16,185,129,0.28)] shrink-0">
            H
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold tracking-tight text-slate-900 dark:text-white truncate">
              HISOBOT AI
            </div>
            {userName && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {userName}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Chiqish</span>
        </button>
      </div>

      {/* Main Centered Content */}
      <div className="relative z-10 my-auto py-6 flex items-center justify-center">
        {!forgotMode ? (
          <PinPadView
            pin={pin}
            pinLength={pinLength}
            title="PIN-kod"
            subtitle="Ilovani himoyalash uchun PIN-kodni kiriting"
            errorMessage={errorMessage}
            shakeKey={shakeKey}
            disabled={verifying}
            lockoutRemainingSec={lockoutRemainingSec}
            showBiometricButton={initialConfig.biometricEnabled && biometricAvailable}
            biometryType={biometryType}
            biometricBusy={biometricBusy}
            onDigit={handleDigit}
            onBackspace={handleBackspace}
            onBiometricClick={handleBiometricUnlock}
            onForgotPin={() => {
              setForgotMode(true);
              setReauthError(null);
              setAccountPassword('');
              setReauthSuccess(false);
            }}
          />
        ) : (
          <div className="w-full max-w-sm mx-auto rounded-3xl bg-white dark:bg-[#0B1926] border border-slate-200/80 dark:border-white/[0.10] p-6 shadow-xl">
            {!reauthSuccess ? (
              <form onSubmit={handleReauthSubmit} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                      PIN-kodni tiklash
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Xavfsizlik uchun hisob parolingizni tasdiqlang
                    </p>
                  </div>
                </div>

                {userEmail && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Faol hisob: </span>
                    <span className="font-bold text-slate-900 dark:text-white">{userEmail}</span>
                  </div>
                )}

                {isDemoAccount && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-700 dark:text-emerald-300">
                    Demo hisob uchun standart parol: <span className="font-mono font-bold">hisobot123</span>
                  </div>
                )}

                {reauthError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{reauthError}</span>
                  </div>
                )}

                <Input
                  label="Hisob paroli"
                  type="password"
                  required
                  autoFocus
                  placeholder="Parolingizni kiriting"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                />

                <div className="flex flex-col gap-2 pt-1">
                  <Button type="submit" variant="primary" size="md" fullWidth loading={reauthBusy}>
                    Tasdiqlash va PIN-kodni oʻchirish
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    fullWidth
                    leadingIcon={<ArrowLeft className="w-4 h-4" />}
                    onClick={() => setForgotMode(false)}
                  >
                    PIN-kod ekraniga qaytish
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-center py-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Shaxsingiz tasdiqlandi
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Eski PIN-kod va bloklash holati tozalandi. Yangi PIN-kod oʻrnatishingiz yoki ilovaga kirishingiz mumkin.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {onSetupNewPin && (
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      fullWidth
                      leadingIcon={<ShieldCheck className="w-4 h-4" />}
                      onClick={() => {
                        onUnlock();
                        onSetupNewPin();
                      }}
                    >
                      Yangi PIN-kod oʻrnatish
                    </Button>
                  )}
                  <Button type="button" variant="outline" size="md" fullWidth onClick={onUnlock}>
                    Ilovaga kirish
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subtle Bottom Security Footer */}
      <div className="relative z-10 text-center text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>End-to-end mahalliy PIN va biometrik himoya</span>
      </div>
    </div>
  );
};
