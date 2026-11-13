/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';

export type PermissionKey =
  | 'microphone'
  | 'camera'
  | 'photos'
  | 'location'
  | 'notifications'
  | 'biometric';

export type AppPermissionStatus =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'permanently_denied'
  | 'unavailable';

export interface PermissionCopy {
  key: PermissionKey;
  title: string;
  subtitle: string;
  rationale: string;
  privacyNote: string;
  deniedHint: string;
  permanentlyDeniedHint: string;
  androidPermissionName: string;
}

export interface PermissionSummary {
  key: PermissionKey;
  status: AppPermissionStatus;
  featureEnabled: boolean;
  hardwareAvailable: boolean;
  detail?: string;
}

export interface PrivacyFeatureControls {
  microphone: boolean;
  camera: boolean;
  photos: boolean;
  location: boolean;
  notifications: boolean;
  biometric: boolean;
}

interface HisobotPermissionsNativePlugin {
  checkMicrophone(): Promise<{
    status: AppPermissionStatus;
    androidSdk: number;
    permanentlyDenied: boolean;
  }>;
  requestMicrophone(): Promise<{
    status: AppPermissionStatus;
    androidSdk: number;
    permanentlyDenied: boolean;
  }>;
  getPermissionDiagnostics(): Promise<{
    androidSdk: number;
    hasMicrophoneHardware: boolean;
    hasCameraHardware: boolean;
    hasLocationHardware: boolean;
    notificationsEnabled: boolean;
  }>;
}

const HisobotPermissionsNative = registerPlugin<HisobotPermissionsNativePlugin>('HisobotPermissions');

const PRIVACY_CONTROLS_KEY = 'hisobot_privacy_controls_v1';
const DENIAL_COUNTS_KEY = 'hisobot_permission_denials_v1';
const BIOMETRIC_LOCK_KEY = 'hisobot_biometric_lock_enabled_v1';
const NOTIFICATION_NAG_KEY = 'hisobot_notif_prompt_dismissed_v1';

const DEFAULT_PRIVACY_CONTROLS: PrivacyFeatureControls = {
  microphone: true,
  camera: true,
  photos: true,
  location: true,
  notifications: true,
  biometric: true,
};

export const PERMISSION_COPY: Record<PermissionKey, PermissionCopy> = {
  microphone: {
    key: 'microphone',
    title: 'Mikrofon — Ovozli AI kiritish',
    subtitle: 'Tranzaksiyalarni ovoz orqali tez yozish va HISOBOT AI bilan suhbatlashish',
    rationale:
      'Ovozli AI faqat siz mikrofon tugmasini bosganingizdagina tinglaydi. Fon rejimida hech qachon yozuv olinmaydi.',
    privacyNote: 'Ovoz faqat nutqni matnga aylantirish paytida ishlatiladi va audio fayl saqlanmaydi.',
    deniedHint:
      'Mikrofon ruxsati berilmadi. Xarajat va daromadlarni matn koʻrinishida ham kiritishingiz mumkin.',
    permanentlyDeniedHint:
      'Mikrofon ruxsati tizimda butunlay bloklangan. Ovozli AI dan foydalanish uchun Android ilova sozlamalaridan ruxsat bering.',
    androidPermissionName: 'RECORD_AUDIO',
  },
  camera: {
    key: 'camera',
    title: 'Kamera — Chek skaneri (OCR)',
    subtitle: 'Xarid cheklarini toʻgʻridan-toʻgʻri rasmga olib avtomatik oʻqish',
    rationale:
      'Kamera faqat siz «Suratga olish» tugmasini bosganingizda ochiladi va chekdagi doʻkon nomi hamda summani aniqlashga yordam beradi.',
    privacyNote: 'Kamera yashirincha yoqilmaydi; galereyangizdagi boshqa rasmlarga kirilmaydi.',
    deniedHint:
      'Kamera ruxsati rad etildi. Chekni galereyadan tanlash yoki namunani sinab koʻrishingiz mumkin.',
    permanentlyDeniedHint:
      'Kamera ruxsati tizim sozlamalarida oʻchirilgan. Suratga olish uchun ilova sozlamalaridan kamerani yoqing.',
    androidPermissionName: 'CAMERA',
  },
  photos: {
    key: 'photos',
    title: 'Rasmlar — Tizim Photo Picker',
    subtitle: 'Galereyadagi chek rasmini xavfsiz tanlash',
    rationale:
      'HISOBOT AI Android tizimining xavfsiz rasm tanlagichidan (Photo Picker) foydalanadi — butun xotiraga ruxsat talab qilinmaydi.',
    privacyNote: 'Ilova faqat siz tanlagan bitta rasmni oʻqiydi; boshqa fayllarga kirish imkoni yoʻq.',
    deniedHint: 'Rasm tanlash bekor qilindi.',
    permanentlyDeniedHint: 'Rasm tanlash uchun qurilma sozlamalarini tekshiring.',
    androidPermissionName: 'Android Photo Picker (xotira ruxsasisiz)',
  },
  location: {
    key: 'location',
    title: 'Joylashuv — Taxminiy hudud (ixtiyoriy)',
    subtitle: 'Tranzaksiyaga doʻkon yoki shahar hududini ixtiyoriy biriktirish',
    rationale:
      'Siz tranzaksiya qoʻshishda «Hududni biriktirish» tugmasini bosganingizdagina taxminiy hudud aniqlanadi.',
    privacyNote:
      'Fon rejimida GPS kuzatilmaydi va joylashuv siz tasdiqlamasangiz hech qayerga yuborilmaydi.',
    deniedHint:
      'Joylashuv ruxsati berilmadi. Tranzaksiyalarni joylashuvsiz ham bemalol saqlashingiz mumkin.',
    permanentlyDeniedHint:
      'Joylashuv tizimda bloklangan. Hududni biriktirish uchun Android ilova sozlamalaridan ruxsat bering.',
    androidPermissionName: 'ACCESS_COARSE_LOCATION',
  },
  notifications: {
    key: 'notifications',
    title: 'Bildirishnomalar — Budjet va qarz eslatmalari',
    subtitle: 'Budjet limiti 80% ga yetganda va qarz muddati yaqinlashganda xabar berish',
    rationale:
      'Bildirishnomalar sizga ortiqcha xarajatdan saqlanish va qarz toʻlovlarini oʻz vaqtida eslashda yordam beradi.',
    privacyNote: 'Reklama yoki spam yuborilmaydi; barcha turlarini Sozlamalardan oʻchirib qoʻyish mumkin.',
    deniedHint:
      'Bildirishnomalar yoqilmadi. Muhim ogohlantirishlarni ilova ichidagi qoʻngʻiroqcha menyusidan koʻrishingiz mumkin.',
    permanentlyDeniedHint:
      'Bildirishnomalar Android tizimida oʻchirilgan. Eslatmalar olish uchun ilova sozlamalaridan ruxsat bering.',
    androidPermissionName: 'POST_NOTIFICATIONS (Android 13+)',
  },
  biometric: {
    key: 'biometric',
    title: 'Biometrik himoya — Barmoq izi / Yuz',
    subtitle: 'Moliyaviy maʼlumotlarni tez va xavfsiz qulfdan ochish',
    rationale:
      'Qurilmangizning Android BiometricPrompt tizimi orqali ilovani himoya qiladi. Parol orqali kirish har doim zaxirada qoladi.',
    privacyNote: 'Barmoq izi yoki yuz maʼlumotlari hech qachon ilova ichida yoki serverda saqlanmaydi.',
    deniedHint: 'Biometrik tasdiqlash bekor qilindi. Parol orqali davom etishingiz mumkin.',
    permanentlyDeniedHint:
      'Qurilmada biometrik himoya sozlanmagan yoki oʻchirilgan. Android Xavfsizlik sozlamalarini tekshiring.',
    androidPermissionName: 'USE_BIOMETRIC',
  },
};

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function getPrivacyControls(): PrivacyFeatureControls {
  try {
    const raw = localStorage.getItem(PRIVACY_CONTROLS_KEY);
    if (!raw) return { ...DEFAULT_PRIVACY_CONTROLS };
    return { ...DEFAULT_PRIVACY_CONTROLS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRIVACY_CONTROLS };
  }
}

export function setPrivacyControl(key: PermissionKey, enabled: boolean): PrivacyFeatureControls {
  const current = getPrivacyControls();
  const next = { ...current, [key]: enabled };
  try {
    localStorage.setItem(PRIVACY_CONTROLS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage limits
  }
  if (key === 'biometric' && !enabled) {
    setBiometricLockEnabled(false);
  }
  return next;
}

export function isBiometricLockEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_LOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBiometricLockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export function wasNotificationPromptDismissed(): boolean {
  try {
    return localStorage.getItem(NOTIFICATION_NAG_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markNotificationPromptDismissed(): void {
  try {
    localStorage.setItem(NOTIFICATION_NAG_KEY, 'true');
  } catch {
    // ignore
  }
}

function getDenialCount(key: PermissionKey): number {
  try {
    const raw = localStorage.getItem(DENIAL_COUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return Number(parsed[key] || 0);
  } catch {
    return 0;
  }
}

function recordDenial(key: PermissionKey): number {
  const count = getDenialCount(key) + 1;
  try {
    const raw = localStorage.getItem(DENIAL_COUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[key] = count;
    localStorage.setItem(DENIAL_COUNTS_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
  return count;
}

function clearDenial(key: PermissionKey): void {
  try {
    const raw = localStorage.getItem(DENIAL_COUNTS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed[key]) {
      delete parsed[key];
      localStorage.setItem(DENIAL_COUNTS_KEY, JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

function mapPluginState(
  state: string | undefined,
  key: PermissionKey
): AppPermissionStatus {
  if (state === 'granted' || state === 'limited') {
    clearDenial(key);
    return 'granted';
  }
  if (state === 'denied') {
    return getDenialCount(key) >= 2 ? 'permanently_denied' : 'denied';
  }
  if (state === 'prompt-with-rationale') {
    return 'denied';
  }
  return 'prompt';
}

async function queryWebPermission(name: string): Promise<AppPermissionStatus> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return 'prompt';
    }
    const res = await navigator.permissions.query({ name: name as PermissionName });
    if (res.state === 'granted') return 'granted';
    if (res.state === 'denied') return 'permanently_denied';
    return 'prompt';
  } catch {
    return 'prompt';
  }
}

export async function checkPermission(key: PermissionKey): Promise<PermissionSummary> {
  const controls = getPrivacyControls();
  const featureEnabled = controls[key];

  if (key === 'microphone') {
    if (isNativeAndroid()) {
      try {
        const res = await HisobotPermissionsNative.checkMicrophone();
        if (res.status === 'granted') clearDenial('microphone');
        return {
          key,
          status: res.status,
          featureEnabled,
          hardwareAvailable: res.status !== 'unavailable',
          detail: `Android SDK ${res.androidSdk}`,
        };
      } catch {
        // fallback below
      }
    }
    const hasSpeechOrMedia =
      typeof window !== 'undefined' &&
      (Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ||
        Boolean(navigator.mediaDevices?.getUserMedia));
    if (!hasSpeechOrMedia) {
      return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
    }
    const status = await queryWebPermission('microphone');
    return { key, status, featureEnabled, hardwareAvailable: true };
  }

  if (key === 'camera') {
    if (isNativeApp()) {
      try {
        const perms = await Camera.checkPermissions();
        const status = mapPluginState(perms.camera, 'camera');
        return { key, status, featureEnabled, hardwareAvailable: true };
      } catch {
        return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
      }
    }
    const hasCamera =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    if (!hasCamera) {
      return { key, status: 'prompt', featureEnabled, hardwareAvailable: true, detail: 'Fayl/kamera tanlash' };
    }
    const status = await queryWebPermission('camera');
    return { key, status, featureEnabled, hardwareAvailable: true };
  }

  if (key === 'photos') {
    if (isNativeApp()) {
      return {
        key,
        status: 'granted',
        featureEnabled,
        hardwareAvailable: true,
        detail: 'Android Photo Picker',
      };
    }
    return {
      key,
      status: 'granted',
      featureEnabled,
      hardwareAvailable: true,
      detail: 'Tizim fayl tanlagichi',
    };
  }

  if (key === 'location') {
    if (isNativeApp()) {
      try {
        const perms = await Geolocation.checkPermissions();
        const rawState = perms.coarseLocation === 'granted' ? 'granted' : perms.location;
        const status = mapPluginState(rawState, 'location');
        return { key, status, featureEnabled, hardwareAvailable: true };
      } catch {
        return {
          key,
          status: 'unavailable',
          featureEnabled,
          hardwareAvailable: false,
          detail: 'Qurilmada joylashuv xizmati oʻchirilgan',
        };
      }
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
    }
    const status = await queryWebPermission('geolocation');
    return { key, status, featureEnabled, hardwareAvailable: true };
  }

  if (key === 'notifications') {
    if (isNativeApp()) {
      try {
        const perms = await LocalNotifications.checkPermissions();
        const status = mapPluginState(perms.display, 'notifications');
        return { key, status, featureEnabled, hardwareAvailable: true };
      } catch {
        return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
      }
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
    }
    const p = window.Notification.permission;
    const status: AppPermissionStatus =
      p === 'granted' ? 'granted' : p === 'denied' ? 'permanently_denied' : 'prompt';
    return { key, status, featureEnabled, hardwareAvailable: true };
  }

  // biometric
  if (isNativeApp()) {
    try {
      const avail = await NativeBiometric.isAvailable({ useFallback: false });
      if (!avail.isAvailable) {
        return {
          key,
          status: 'unavailable',
          featureEnabled,
          hardwareAvailable: false,
          detail: avail.deviceIsSecure
            ? 'Qurilma PIN kodiga ega, lekin biometrika kiritilmagan'
            : 'Biometrik sensor topilmadi',
        };
      }
      const typeLabel =
        avail.biometryType === BiometryType.FINGERPRINT
          ? 'Barmoq izi'
          : avail.biometryType === BiometryType.FACE_AUTHENTICATION ||
            avail.biometryType === BiometryType.FACE_ID
          ? 'Yuz orqali tanish'
          : avail.biometryType === BiometryType.MULTIPLE
          ? 'Barmoq izi / Yuz'
          : 'Biometrik himoya';
      return {
        key,
        status: 'granted',
        featureEnabled,
        hardwareAvailable: true,
        detail: typeLabel,
      };
    } catch {
      return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
    }
  }

  return {
    key,
    status: 'unavailable',
    featureEnabled,
    hardwareAvailable: false,
    detail: 'Faqat Android ilovasida mavjud',
  };
}

export async function requestPermission(key: PermissionKey): Promise<PermissionSummary> {
  const controls = getPrivacyControls();
  const featureEnabled = controls[key];

  if (key === 'microphone') {
    if (isNativeAndroid()) {
      try {
        const res = await HisobotPermissionsNative.requestMicrophone();
        if (res.status === 'granted') {
          clearDenial('microphone');
        } else if (res.status === 'denied' || res.status === 'permanently_denied') {
          recordDenial('microphone');
        }
        return {
          key,
          status: res.status,
          featureEnabled,
          hardwareAvailable: res.status !== 'unavailable',
        };
      } catch {
        return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
      }
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        clearDenial('microphone');
        return { key, status: 'granted', featureEnabled, hardwareAvailable: true };
      } catch (err: any) {
        const count = recordDenial('microphone');
        const name = err?.name || '';
        const status: AppPermissionStatus =
          name === 'NotFoundError' || name === 'DevicesNotFoundError'
            ? 'unavailable'
            : name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? count >= 2
              ? 'permanently_denied'
              : 'denied'
            : 'denied';
        return { key, status, featureEnabled, hardwareAvailable: status !== 'unavailable' };
      }
    }
    const SpeechRec =
      typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    return {
      key,
      status: SpeechRec ? 'prompt' : 'unavailable',
      featureEnabled,
      hardwareAvailable: Boolean(SpeechRec),
    };
  }

  if (key === 'camera') {
    if (isNativeApp()) {
      try {
        const res = await Camera.requestPermissions({ permissions: ['camera'] });
        if (res.camera === 'granted' || res.camera === 'limited') {
          clearDenial('camera');
          return { key, status: 'granted', featureEnabled, hardwareAvailable: true };
        }
        const denials = recordDenial('camera');
        return {
          key,
          status: denials >= 2 ? 'permanently_denied' : 'denied',
          featureEnabled,
          hardwareAvailable: true,
        };
      } catch {
        return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
      }
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        clearDenial('camera');
        return { key, status: 'granted', featureEnabled, hardwareAvailable: true };
      } catch (err: any) {
        const count = recordDenial('camera');
        const isNotFound = err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError';
        return {
          key,
          status: isNotFound ? 'unavailable' : count >= 2 ? 'permanently_denied' : 'denied',
          featureEnabled,
          hardwareAvailable: !isNotFound,
        };
      }
    }
    return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
  }

  if (key === 'photos') {
    return {
      key,
      status: 'granted',
      featureEnabled,
      hardwareAvailable: true,
      detail: isNativeApp() ? 'Android Photo Picker' : 'Tizim fayl tanlagichi',
    };
  }

  if (key === 'location') {
    if (isNativeApp()) {
      try {
        const res = await Geolocation.requestPermissions({ permissions: ['coarseLocation'] });
        if (res.coarseLocation === 'granted' || res.location === 'granted') {
          clearDenial('location');
          return { key, status: 'granted', featureEnabled, hardwareAvailable: true };
        }
        const denials = recordDenial('location');
        return {
          key,
          status: denials >= 2 ? 'permanently_denied' : 'denied',
          featureEnabled,
          hardwareAvailable: true,
        };
      } catch {
        return {
          key,
          status: 'unavailable',
          featureEnabled,
          hardwareAvailable: false,
          detail: 'Qurilmada GPS/Joylashuv oʻchirilgan',
        };
      }
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            clearDenial('location');
            resolve({ key, status: 'granted', featureEnabled, hardwareAvailable: true });
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              const denials = recordDenial('location');
              resolve({
                key,
                status: denials >= 2 ? 'permanently_denied' : 'denied',
                featureEnabled,
                hardwareAvailable: true,
              });
            } else {
              resolve({
                key,
                status: 'unavailable',
                featureEnabled,
                hardwareAvailable: false,
                detail: 'Joylashuvni aniqlab boʻlmadi',
              });
            }
          },
          { enableHighAccuracy: false, timeout: 8000 }
        );
      });
    }
    return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
  }

  if (key === 'notifications') {
    if (isNativeApp()) {
      try {
        const res = await LocalNotifications.requestPermissions();
        if (res.display === 'granted') {
          clearDenial('notifications');
          return { key, status: 'granted', featureEnabled, hardwareAvailable: true };
        }
        markNotificationPromptDismissed();
        const denials = recordDenial('notifications');
        return {
          key,
          status: denials >= 2 ? 'permanently_denied' : 'denied',
          featureEnabled,
          hardwareAvailable: true,
        };
      } catch {
        return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
      }
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await window.Notification.requestPermission();
        if (res === 'granted') {
          clearDenial('notifications');
          return { key, status: 'granted', featureEnabled, hardwareAvailable: true };
        }
        markNotificationPromptDismissed();
        return {
          key,
          status: res === 'denied' ? 'permanently_denied' : 'denied',
          featureEnabled,
          hardwareAvailable: true,
        };
      } catch {
        return { key, status: 'denied', featureEnabled, hardwareAvailable: true };
      }
    }
    return { key, status: 'unavailable', featureEnabled, hardwareAvailable: false };
  }

  // biometric
  return checkPermission('biometric');
}

export async function getAllPermissionSummaries(): Promise<PermissionSummary[]> {
  const keys: PermissionKey[] = [
    'microphone',
    'camera',
    'photos',
    'location',
    'notifications',
    'biometric',
  ];
  return Promise.all(keys.map((k) => checkPermission(k)));
}

export async function openAppSettings(): Promise<{ opened: boolean; message: string }> {
  if (isNativeApp()) {
    try {
      const platform = Capacitor.getPlatform();
      if (platform === 'android') {
        const res = await NativeSettings.openAndroid({
          option: AndroidSettings.ApplicationDetails,
        });
        return {
          opened: res.status,
          message: res.status
            ? 'Android ilova sozlamalari ochildi'
            : 'Ilova sozlamalarini ochib boʻlmadi',
        };
      }
      if (platform === 'ios') {
        const res = await NativeSettings.openIOS({ option: IOSSettings.App });
        return { opened: res.status, message: 'Sozlamalar ochildi' };
      }
    } catch {
      return {
        opened: false,
        message: 'Sozlamalarni ochishda xatolik yuz berdi. Qurilma sozlamalaridan ruxsat bering.',
      };
    }
  }

  return {
    opened: false,
    message:
      'Brauzerda manzil satri yonidagi qulf/sozlama belgisi orqali sayt ruxsatlarini boshqarishingiz mumkin.',
  };
}

export async function captureReceiptWithCamera(): Promise<{
  dataUrl: string;
}> {
  const photo = await Camera.getPhoto({
    quality: 88,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    saveToGallery: false,
    correctOrientation: true,
    webUseInput: true,
  });

  if (!photo.dataUrl) {
    throw new Error('Kameradan rasm olinmadi');
  }
  return { dataUrl: photo.dataUrl };
}

export async function pickReceiptFromPhotos(): Promise<{
  dataUrl: string;
}> {
  const photo = await Camera.getPhoto({
    quality: 88,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    saveToGallery: false,
    correctOrientation: true,
    webUseInput: true,
  });

  if (!photo.dataUrl) {
    throw new Error('Galereyadan rasm tanlanmadi');
  }
  return { dataUrl: photo.dataUrl };
}

export async function getApproximateLocationTag(): Promise<{
  label: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}> {
  if (isNativeApp()) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });
    const lat = Number(pos.coords.latitude.toFixed(2));
    const lng = Number(pos.coords.longitude.toFixed(2));
    return {
      latitude: lat,
      longitude: lng,
      accuracyMeters: Math.round(pos.coords.accuracy || 0),
      label: `Hudud: ${lat}°, ${lng}° (taxminiy)`,
    };
  }

  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Brauzer joylashuvni qoʻllab-quvvatlamaydi'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(2));
        const lng = Number(pos.coords.longitude.toFixed(2));
        resolve({
          latitude: lat,
          longitude: lng,
          accuracyMeters: Math.round(pos.coords.accuracy || 0),
          label: `Hudud: ${lat}°, ${lng}° (taxminiy)`,
        });
      },
      (err) => {
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Joylashuv ruxsati berilmadi'
              : 'GPS yoki joylashuv xizmatidan maʼlumot olinmadi'
          )
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

export async function verifyBiometricIdentity(
  subtitle = 'Moliyaviy maʼlumotlaringizga kirishni tasdiqlang'
): Promise<{ verified: boolean; error?: string }> {
  if (!isNativeApp()) {
    return {
      verified: false,
      error: 'Biometrik tasdiqlash faqat Android qurilmalarida ishlaydi.',
    };
  }

  try {
    const avail = await NativeBiometric.isAvailable({ useFallback: false });
    if (!avail.isAvailable) {
      return {
        verified: false,
        error: 'Qurilmada barmoq izi yoki yuz orqali ochish sozlanmagan.',
      };
    }

    await NativeBiometric.verifyIdentity({
      title: 'HISOBOT AI himoyasi',
      subtitle,
      description: 'Barmoq izi yoki yuzni skanerlang',
      negativeButtonText: 'Parol bilan kirish',
      maxAttempts: 3,
    });
    return { verified: true };
  } catch (err: any) {
    return {
      verified: false,
      error: err?.message || 'Biometrik tasdiqlash bekor qilindi',
    };
  }
}

export async function scheduleLocalReminder(options: {
  id: number;
  title: string;
  body: string;
}): Promise<boolean> {
  const controls = getPrivacyControls();
  if (!controls.notifications) return false;

  if (isNativeApp()) {
    try {
      const perms = await LocalNotifications.checkPermissions();
      if (perms.display !== 'granted') return false;

      if (isNativeAndroid()) {
        await LocalNotifications.createChannel({
          id: 'hisobot_reminders',
          name: 'Moliyaviy eslatmalar',
          description: 'Budjet limitlari, qarz muddatlari va maqsad eslatmalari',
          importance: 4,
          visibility: 1,
        });
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: options.id,
            title: options.title,
            body: options.body,
            channelId: isNativeAndroid() ? 'hisobot_reminders' : undefined,
            schedule: { at: new Date(Date.now() + 1200) },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }

  if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
    try {
      new window.Notification(options.title, { body: options.body });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
