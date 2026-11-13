/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Modal, Button } from '../../design-system/index.ts';
import { PinPadView } from './PinPadView.tsx';
import {
  PinLength,
  changeUserPin,
  disableUserPin,
  getAppLockConfig,
  getLockoutRemainingSeconds,
  setupUserPin,
  verifyUserPin,
} from '../../services/appLock.ts';

export type PinSetupMode = 'create' | 'change' | 'disable';

interface PinSetupModalProps {
  isOpen: boolean;
  mode: PinSetupMode;
  userId: string;
  onClose: () => void;
  onComplete: (message: string) => void;
}

type Step = 'verify_current' | 'enter_new' | 'confirm_new';

export const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  mode,
  userId,
  onClose,
  onComplete,
}) => {
  const existingConfig = getAppLockConfig(userId);
  const [step, setStep] = useState<Step>('enter_new');
  const [pinLength, setPinLength] = useState<PinLength>(existingConfig.pinLength);
  const [currentPinVerified, setCurrentPinVerified] = useState<string>('');
  const [firstNewPin, setFirstNewPin] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number>(0);
  const [busy, setBusy] = useState<boolean>(false);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    const cfg = getAppLockConfig(userId);
    setPinLength(cfg.pinLength);
    setStep(mode === 'create' ? 'enter_new' : 'verify_current');
    setCurrentPinVerified('');
    setFirstNewPin('');
    setPin('');
    setErrorMessage(null);
    setShakeKey(0);
    setBusy(false);
    setLockoutRemainingSec(getLockoutRemainingSeconds(cfg));
  }, [isOpen, mode, userId]);

  useEffect(() => {
    if (!isOpen || lockoutRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      const cfg = getAppLockConfig(userId);
      const rem = getLockoutRemainingSeconds(cfg);
      setLockoutRemainingSec(rem);
      if (rem === 0) {
        setErrorMessage(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, lockoutRemainingSec, userId]);

  const activeTargetLength: PinLength =
    step === 'verify_current' ? existingConfig.pinLength : pinLength;

  const handleDigit = useCallback(
    (d: string) => {
      if (busy || lockoutRemainingSec > 0) return;
      setErrorMessage(null);
      setPin((prev) => (prev.length < activeTargetLength ? prev + d : prev));
    },
    [activeTargetLength, busy, lockoutRemainingSec]
  );

  const handleBackspace = useCallback(() => {
    if (busy || lockoutRemainingSec > 0) return;
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  }, [busy, lockoutRemainingSec]);

  useEffect(() => {
    if (!isOpen || pin.length !== activeTargetLength || busy) return;

    const processCompletePin = async () => {
      setBusy(true);
      try {
        if (step === 'verify_current') {
          const res = await verifyUserPin(userId, pin);
          if (!res.success) {
            setLockoutRemainingSec(res.lockoutRemainingSec);
            setErrorMessage(res.error || 'Joriy PIN-kod notoʻgʻri');
            setShakeKey((k) => k + 1);
            setPin('');
            return;
          }

          if (mode === 'disable') {
            await disableUserPin(userId);
            onComplete('PIN-kod himoyasi oʻchirildi');
            onClose();
            return;
          }

          setCurrentPinVerified(pin);
          setPin('');
          setErrorMessage(null);
          setStep('enter_new');
          return;
        }

        if (step === 'enter_new') {
          setFirstNewPin(pin);
          setPin('');
          setErrorMessage(null);
          setStep('confirm_new');
          return;
        }

        if (step === 'confirm_new') {
          if (pin !== firstNewPin) {
            setErrorMessage('PIN-kodlar mos kelmadi. Qaytadan tasdiqlang.');
            setShakeKey((k) => k + 1);
            setPin('');
            return;
          }

          if (mode === 'change') {
            await changeUserPin(userId, currentPinVerified, pin, pinLength);
            onComplete('PIN-kod muvaffaqiyatli yangilandi');
          } else {
            await setupUserPin(userId, pin, pinLength);
            onComplete('PIN-kod himoyasi faollashtirildi');
          }
          onClose();
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'PIN-kodni saqlashda xatolik');
        setShakeKey((k) => k + 1);
        setPin('');
      } finally {
        setBusy(false);
      }
    };

    const timer = window.setTimeout(processCompletePin, 110);
    return () => window.clearTimeout(timer);
  }, [
    isOpen,
    pin,
    activeTargetLength,
    busy,
    step,
    mode,
    userId,
    firstNewPin,
    currentPinVerified,
    pinLength,
    onComplete,
    onClose,
  ]);

  const title =
    step === 'verify_current'
      ? mode === 'disable'
        ? 'PIN-kodni oʻchirish'
        : 'Joriy PIN-kod'
      : step === 'enter_new'
      ? mode === 'change'
        ? 'Yangi PIN-kod'
        : 'PIN-kod yarating'
      : 'PIN-kodni tasdiqlang';

  const subtitle =
    step === 'verify_current'
      ? mode === 'disable'
        ? 'Oʻchirishni tasdiqlash uchun joriy PIN-kodni kiriting'
        : 'Davom etish uchun amaldagi PIN-kodni kiriting'
      : step === 'enter_new'
      ? `Ilovani himoyalash uchun ${pinLength} xonali PIN-kod kiriting`
      : 'Tasdiqlash uchun yangi PIN-kodni qayta kiriting';

  const lengthSelector =
    step === 'enter_new' ? (
      <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/[0.10]">
        {([4, 6] as PinLength[]).map((len) => {
          const active = pinLength === len;
          return (
            <button
              key={len}
              type="button"
              onClick={() => {
                setPinLength(len);
                setPin('');
                setErrorMessage(null);
              }}
              className={[
                'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer min-h-[34px]',
                active
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
              ].join(' ')}
            >
              {len} xonali
            </button>
          );
        })}
      </div>
    ) : null;

  const stepBackFooter =
    step === 'confirm_new' ? (
      <div className="flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          onClick={() => {
            setStep('enter_new');
            setFirstNewPin('');
            setPin('');
            setErrorMessage(null);
          }}
        >
          Orqaga qaytish
        </Button>
      </div>
    ) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="py-1">
        <PinPadView
          compact
          pin={pin}
          pinLength={activeTargetLength}
          title={title}
          subtitle={subtitle}
          errorMessage={errorMessage}
          shakeKey={shakeKey}
          disabled={busy}
          lockoutRemainingSec={lockoutRemainingSec}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          topSlot={lengthSelector}
          bottomSlot={stepBackFooter}
        />
      </div>
    </Modal>
  );
};
