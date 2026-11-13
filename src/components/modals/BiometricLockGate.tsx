/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Fingerprint, KeyRound, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../design-system/index.ts';
import { verifyBiometricIdentity } from '../../services/permissions.ts';

interface BiometricLockGateProps {
  userName?: string;
  onUnlock: () => void;
  onUsePassword: () => void;
}

export const BiometricLockGate: React.FC<BiometricLockGateProps> = ({
  userName,
  onUnlock,
  onUsePassword,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await verifyBiometricIdentity(
        'Moliyaviy maʼlumotlaringizni ochish uchun tasdiqlang'
      );
      if (res.verified) {
        onUnlock();
      } else {
        setError(res.error || 'Tasdiqlash yakunlanmadi');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#061411] text-white flex items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-3xl border border-emerald-500/25 bg-[#0D1927]/95 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.45)] space-y-5">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 flex items-center justify-center shadow-[0_0_28px_rgba(16,185,129,0.22)]">
          <Fingerprint className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>HISOBOT AI Himoyasi</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight text-white">
            Xush kelibsiz{userName ? `, ${userName.split(' ')[0]}` : ''}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Moliyaviy maʼlumotlaringiz biometrik qulf bilan himoyalangan. Davom etish uchun barmoq izi yoki yuzni tasdiqlang.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2.5">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={verifying}
            leadingIcon={<Fingerprint className="w-4 h-4" />}
            onClick={handleVerify}
          >
            Biometrika bilan ochish
          </Button>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            leadingIcon={<KeyRound className="w-4 h-4" />}
            onClick={onUsePassword}
            className="text-slate-300 hover:text-white"
          >
            Parol bilan kirish
          </Button>
        </div>
      </div>
    </div>
  );
};
