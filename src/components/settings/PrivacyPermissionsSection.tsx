/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Mic,
  Camera,
  Image,
  MapPin,
  Bell,
  Fingerprint,
  ShieldCheck,
  RefreshCw,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Badge, Button, Card, useToast } from '../../design-system/index.ts';
import {
  AppPermissionStatus,
  PERMISSION_COPY,
  PermissionKey,
  PermissionSummary,
  getAllPermissionSummaries,
  openAppSettings,
  requestPermission,
  setPrivacyControl,
} from '../../services/permissions.ts';

const ICONS: Record<PermissionKey, React.ReactNode> = {
  microphone: <Mic className="w-4 h-4" />,
  camera: <Camera className="w-4 h-4" />,
  photos: <Image className="w-4 h-4" />,
  location: <MapPin className="w-4 h-4" />,
  notifications: <Bell className="w-4 h-4" />,
  biometric: <Fingerprint className="w-4 h-4" />,
};

function getStatusBadge(status: AppPermissionStatus, featureEnabled: boolean) {
  if (!featureEnabled) {
    return <Badge tone="neutral">Oʻchirilgan</Badge>;
  }
  switch (status) {
    case 'granted':
      return <Badge tone="emerald">Ruxsat berilgan</Badge>;
    case 'prompt':
      return <Badge tone="teal">Soʻralmagan</Badge>;
    case 'denied':
      return <Badge tone="amber">Rad etilgan</Badge>;
    case 'permanently_denied':
      return <Badge tone="rose">Bloklangan</Badge>;
    case 'unavailable':
      return <Badge tone="neutral">Mavjud emas</Badge>;
  }
}

export const PrivacyPermissionsSection: React.FC = () => {
  const toast = useToast();
  const [summaries, setSummaries] = useState<PermissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState<PermissionKey | null>(null);

  const loadStates = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getAllPermissionSummaries();
      setSummaries(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStates();
  }, [loadStates]);

  const handleRequest = async (key: PermissionKey) => {
    setActiveKey(key);
    try {
      const res = await requestPermission(key);
      setSummaries((prev) => prev.map((item) => (item.key === key ? res : item)));
      if (res.status === 'granted') {
        toast.success(`${PERMISSION_COPY[key].title.split(' — ')[0]} ruxsati berildi`);
      } else if (res.status === 'permanently_denied') {
        toast.info('Ruxsat tizimda bloklangan. Ilova sozlamalaridan yoqishingiz mumkin.');
      } else if (res.status === 'denied') {
        toast.info('Ruxsat berilmadi');
      }
    } finally {
      setActiveKey(null);
    }
  };

  const handleToggleFeature = (key: PermissionKey, enabled: boolean) => {
    setPrivacyControl(key, enabled);
    setSummaries((prev) =>
      prev.map((item) => (item.key === key ? { ...item, featureEnabled: enabled } : item))
    );
    toast.success(
      enabled
        ? 'Funksiya maxfiylik sozlamalarida yoqildi'
        : 'Funksiya maxfiylik sozlamalarida oʻchirildi'
    );
  };

  const handleOpenSettings = async () => {
    const res = await openAppSettings();
    if (res.opened) {
      toast.info(res.message);
    } else {
      toast.info(res.message);
    }
  };

  return (
    <Card padding="lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-white/[0.08]">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Maxfiylik va tizim ruxsatlari
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ruxsatlar faqat tegishli funksiyadan foydalanganda soʻraladi. Xohlagan payt oʻchirishingiz mumkin.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            loading={loading}
            leadingIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadStates}
          >
            Yangilash
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<SettingsIcon className="w-3.5 h-3.5" />}
            onClick={handleOpenSettings}
          >
            Ilova sozlamalari
          </Button>
        </div>
      </div>

      {/* Permission Rows */}
      <div className="space-y-3">
        {summaries.map((item) => {
          const copy = PERMISSION_COPY[item.key];
          const isBusy = activeKey === item.key;

          return (
            <div
              key={item.key}
              className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                  {ICONS[item.key]}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {copy.title}
                    </h3>
                    {getStatusBadge(item.status, item.featureEnabled)}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">
                    {copy.subtitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.06]">
                      {copy.androidPermissionName}
                    </span>
                    {item.detail && <span>· {item.detail}</span>}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end">

                {item.key !== 'biometric' &&
                  item.key !== 'photos' &&
                  item.featureEnabled &&
                  item.status !== 'granted' &&
                  item.status !== 'unavailable' && (
                    <Button
                      variant={item.status === 'permanently_denied' ? 'outline' : 'primary'}
                      size="sm"
                      loading={isBusy}
                      onClick={() =>
                        item.status === 'permanently_denied'
                          ? handleOpenSettings()
                          : handleRequest(item.key)
                      }
                    >
                      {item.status === 'permanently_denied'
                        ? 'Sozlamalarda ochish'
                        : 'Ruxsat soʻrash'}
                    </Button>
                  )}

                <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#081220] text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <span>{item.featureEnabled ? 'Faol' : 'Oʻchirilgan'}</span>
                  <input
                    type="checkbox"
                    checked={item.featureEnabled}
                    onChange={(e) => handleToggleFeature(item.key, e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparency Footer */}
      <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
        <span className="font-bold text-slate-900 dark:text-white">Minimal ruxsat tamoyili:</span>{' '}
        HISOBOT AI kontaktlar, SMS, qoʻngʻiroqlar tarixi yoki fon GPS kuzatuvidan foydalanmaydi. Galereya uchun xavfsiz tizim Photo Picker qoʻllanadi.
      </div>
    </Card>
  );
};
