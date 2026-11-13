/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Mic,
  Camera,
  Image,
  MapPin,
  Bell,
  Fingerprint,
  ShieldCheck,
  Settings,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Modal, Button } from '../../design-system/index.ts';
import {
  AppPermissionStatus,
  PERMISSION_COPY,
  PermissionKey,
  openAppSettings,
} from '../../services/permissions.ts';

interface PermissionPromptModalProps {
  isOpen: boolean;
  permissionKey: PermissionKey;
  status: AppPermissionStatus;
  featureDisabled?: boolean;
  onAllow: () => Promise<void> | void;
  onDismiss: () => void;
  onEnableInPrivacy?: () => void;
}

const ICONS: Record<PermissionKey, React.ReactNode> = {
  microphone: <Mic className="w-6 h-6" />,
  camera: <Camera className="w-6 h-6" />,
  photos: <Image className="w-6 h-6" />,
  location: <MapPin className="w-6 h-6" />,
  notifications: <Bell className="w-6 h-6" />,
  biometric: <Fingerprint className="w-6 h-6" />,
};

export const PermissionPromptModal: React.FC<PermissionPromptModalProps> = ({
  isOpen,
  permissionKey,
  status,
  featureDisabled = false,
  onAllow,
  onDismiss,
  onEnableInPrivacy,
}) => {
  const [busy, setBusy] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const copy = PERMISSION_COPY[permissionKey];

  const isPermanent = status === 'permanently_denied';
  const isUnavailable = status === 'unavailable';
  const isDenied = status === 'denied';

  const handlePrimaryAction = async () => {
    if (featureDisabled && onEnableInPrivacy) {
      onEnableInPrivacy();
      return;
    }

    if (isPermanent) {
      setBusy(true);
      try {
        const res = await openAppSettings();
        if (!res.opened) {
          setSettingsFeedback(res.message);
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    setSettingsFeedback(null);
    try {
      await onAllow();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onDismiss}
      size="md"
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <div className="space-y-4">
        {/* Icon Hero Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/12 via-cyan-500/8 to-transparent border border-emerald-500/25 flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
            {ICONS[permissionKey]}
          </div>
          <div className="min-w-0 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            <p className="font-semibold text-slate-900 dark:text-white mb-1">
              Nima uchun ruxsat kerak?
            </p>
            <p>{copy.rationale}</p>
          </div>
        </div>

        {/* Privacy Assurance */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-900 dark:text-white block">
              Maxfiylik kafolati
            </span>
            <p>{copy.privacyNote}</p>
          </div>
        </div>

        {/* State Specific Alerts */}
        {featureDisabled && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              Bu funksiya Maxfiylik sozlamalarida oʻchirib qoʻyilgan. Ishlatish uchun uni qayta yoqing.
            </div>
          </div>
        )}

        {!featureDisabled && isDenied && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>{copy.deniedHint}</div>
          </div>
        )}

        {!featureDisabled && isPermanent && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div>{copy.permanentlyDeniedHint}</div>
          </div>
        )}

        {!featureDisabled && isUnavailable && (
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.10] flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
            <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              Bu qurilma yoki brauzerda ushbu apparat imkoniyati hozircha mavjud emas. Qoʻlda kiritish usulidan foydalanishingiz mumkin.
            </div>
          </div>
        )}

        {settingsFeedback && (
          <p className="text-xs text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 rounded-xl p-3">
            {settingsFeedback}
          </p>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-white/[0.08] flex flex-wrap items-center justify-end gap-2.5">
          <Button variant="ghost" size="md" onClick={onDismiss}>
            Hozir emas
          </Button>

          {!isUnavailable && (
            <Button
              variant="primary"
              size="md"
              loading={busy}
              leadingIcon={isPermanent ? <Settings className="w-4 h-4" /> : undefined}
              onClick={handlePrimaryAction}
            >
              {featureDisabled
                ? 'Funksiyani yoqish'
                : isPermanent
                ? 'Ilova sozlamalarini ochish'
                : isDenied
                ? 'Qayta ruxsat berish'
                : 'Ruxsat berish'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
