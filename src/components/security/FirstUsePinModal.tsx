/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { Modal, Button } from '../../design-system/index.ts';

interface FirstUsePinModalProps {
  isOpen: boolean;
  onSetupNow: () => void;
  onDismiss: () => void;
}

export const FirstUsePinModal: React.FC<FirstUsePinModalProps> = ({
  isOpen,
  onSetupNow,
  onDismiss,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onDismiss} size="sm">
      <div className="text-center space-y-4 py-1">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-slate-950 flex items-center justify-center shadow-[0_12px_28px_rgba(16,185,129,0.28)]">
          <Lock className="w-6 h-6" strokeWidth={2.3} />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Moliyangizni PIN-kod bilan himoyalang
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Har safar ilovani ochganingizda 4 yoki 6 xonali PIN-kod hamda Android barmoq izi / yuz orqali xavfsiz kirishni yoqing.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 text-left flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>
            PIN-kodingiz shifrlangan holda faqat qurilmangizda saqlanadi va xato kiritilganda vaqtinchalik bloklash ishlaydi.
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button type="button" variant="primary" size="md" fullWidth onClick={onSetupNow}>
            PIN-kod yaratish
          </Button>
          <Button type="button" variant="ghost" size="md" fullWidth onClick={onDismiss}>
            Keyinroq (Sozlamalardan yoqish)
          </Button>
        </div>
      </div>
    </Modal>
  );
};
