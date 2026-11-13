/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import {
  isNativeApp,
  isNativeAndroid,
  setBiometricLockEnabled as setLegacyBiometricFlag,
  setPrivacyControl,
} from './permissions.ts';

export type PinLength = 4 | 6;
export type AutoLockSeconds = 0 | 30 | 60 | 300;

export const MAX_PIN_ATTEMPTS = 5;
export const PBKDF2_ITERATIONS = 120_000;

export interface AppLockConfig {
  pinEnabled: boolean;
  pinLength: PinLength;
  pinSalt: string;
  pinHash: string;
  biometricEnabled: boolean;
  autoLockSeconds: AutoLockSeconds;
  failedAttempts: number;
  lockoutLevel: number;
  lockoutUntil: number | null;
  isLocked: boolean;
  lastUnlockedAt: number | null;
  lastHiddenAt: number | null;
  hasKeystoreBinding: boolean;
  updatedAt: number;
}

export interface BiometricCapability {
  available: boolean;
  isNative: boolean;
  biometryType: BiometryType;
  label: string;
  reason?: string;
}

export interface VerifyPinResult {
  success: boolean;
  lockedOut: boolean;
  lockoutRemainingSec: number;
  failedAttempts: number;
  remainingAttempts: number;
  error?: string;
}

const STORAGE_PREFIX = 'hisobot_app_lock_v1:';
const SESSION_UNLOCK_PREFIX = 'hisobot_app_unlocked_session_v1:';
const FIRST_PROMPT_PREFIX = 'hisobot_pin_first_prompt_seen_v1:';
const KEYSTORE_SERVER_PREFIX = 'uz.hisobotai.app.applock.';

function defaultConfig(): AppLockConfig {
  return {
    pinEnabled: false,
    pinLength: 4,
    pinSalt: '',
    pinHash: '',
    biometricEnabled: false,
    autoLockSeconds: 0,
    failedAttempts: 0,
    lockoutLevel: 0,
    lockoutUntil: null,
    isLocked: false,
    lastUnlockedAt: null,
    lastHiddenAt: null,
    hasKeystoreBinding: false,
    updatedAt: Date.now(),
  };
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function getSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const buffer = new ArrayBuffer(clean.length / 2);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Pure-JS SHA-256 + PBKDF2-HMAC-SHA256 fallback for environments without WebCrypto subtle
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  const bitLen = msg.length * 8;
  const padLen = ((msg.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[msg.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const block = new Uint8Array(64);
  if (key.length > 64) {
    block.set(sha256Bytes(key));
  } else {
    block.set(key);
  }
  const oPad = new Uint8Array(64 + 32);
  const iPad = new Uint8Array(64 + msg.length);
  for (let i = 0; i < 64; i++) {
    oPad[i] = block[i] ^ 0x5c;
    iPad[i] = block[i] ^ 0x36;
  }
  iPad.set(msg, 64);
  oPad.set(sha256Bytes(iPad), 64);
  return sha256Bytes(oPad);
}

function pbkdf2Fallback(secret: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const saltPlusIndex = new Uint8Array(salt.length + 4);
  saltPlusIndex.set(salt);
  saltPlusIndex[salt.length + 3] = 1;
  let u = hmacSha256(secret, saltPlusIndex);
  const result = new Uint8Array(u);
  for (let i = 1; i < iterations; i++) {
    u = hmacSha256(secret, u);
    for (let j = 0; j < 32; j++) {
      result[j] ^= u[j];
    }
  }
  return result;
}

export function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export async function hashPin(pin: string, saltHex: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterialBytes = encoder.encode(`HISOBOT_AI_PIN_V1:${userId}:${pin}`);
  const saltBytes = hexToBytes(saltHex);

  const subtle = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto.subtle : undefined;
  if (subtle) {
    try {
      const baseKey = await subtle.importKey('raw', keyMaterialBytes, 'PBKDF2', false, ['deriveBits']);
      const derived = await subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        baseKey,
        256
      );
      return `pbkdf2_v1:${bytesToHex(new Uint8Array(derived))}`;
    } catch {
      // Fallback below if WebCrypto PBKDF2 fails in restricted context
    }
  }

  // Fallback uses 20_000 rounds in pure JS so UI stays snappy on older environments
  const derivedFallback = pbkdf2Fallback(keyMaterialBytes, saltBytes, 20_000);
  return `pbkdf2_js_v1:${bytesToHex(derivedFallback)}`;
}

async function verifyHashVersion(pin: string, saltHex: string, userId: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !saltHex) return false;
  const encoder = new TextEncoder();
  const keyMaterialBytes = encoder.encode(`HISOBOT_AI_PIN_V1:${userId}:${pin}`);
  const saltBytes = hexToBytes(saltHex);

  if (storedHash.startsWith('pbkdf2_js_v1:')) {
    const candidate = `pbkdf2_js_v1:${bytesToHex(pbkdf2Fallback(keyMaterialBytes, saltBytes, 20_000))}`;
    return constantTimeEqual(candidate, storedHash);
  }

  const computed = await hashPin(pin, saltHex, userId);
  return constantTimeEqual(computed, storedHash);
}

export function getAppLockConfig(userId: string): AppLockConfig {
  const storage = getStorage();
  if (!storage || !userId) return defaultConfig();

  try {
    const raw = storage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return defaultConfig();
    const parsed = JSON.parse(raw) as Partial<AppLockConfig>;
    return {
      ...defaultConfig(),
      ...parsed,
      pinLength: parsed.pinLength === 6 ? 6 : 4,
      autoLockSeconds:
        parsed.autoLockSeconds === 30 ||
        parsed.autoLockSeconds === 60 ||
        parsed.autoLockSeconds === 300
          ? parsed.autoLockSeconds
          : 0,
    };
  } catch {
    return defaultConfig();
  }
}

function saveAppLockConfig(userId: string, config: AppLockConfig): AppLockConfig {
  const next = { ...config, updatedAt: Date.now() };
  const storage = getStorage();
  if (storage && userId) {
    try {
      storage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
  }
  return next;
}

export function markSessionUnlocked(userId: string): void {
  const sess = getSessionStorage();
  if (sess && userId) {
    try {
      sess.setItem(`${SESSION_UNLOCK_PREFIX}${userId}`, String(Date.now()));
    } catch {
      // Ignore
    }
  }
}

export function clearSessionUnlocked(userId: string): void {
  const sess = getSessionStorage();
  if (sess && userId) {
    try {
      sess.removeItem(`${SESSION_UNLOCK_PREFIX}${userId}`);
    } catch {
      // Ignore
    }
  }
}

export function isSessionMarkerUnlocked(userId: string): boolean {
  const sess = getSessionStorage();
  if (!sess || !userId) return false;
  try {
    return Boolean(sess.getItem(`${SESSION_UNLOCK_PREFIX}${userId}`));
  } catch {
    return false;
  }
}

export function hasSeenFirstUsePinPrompt(userId: string): boolean {
  const storage = getStorage();
  if (!storage || !userId) return true;
  try {
    return storage.getItem(`${FIRST_PROMPT_PREFIX}${userId}`) === 'true';
  } catch {
    return false;
  }
}

export function markFirstUsePinPromptSeen(userId: string): void {
  const storage = getStorage();
  if (!storage || !userId) return;
  try {
    storage.setItem(`${FIRST_PROMPT_PREFIX}${userId}`, 'true');
  } catch {
    // Ignore
  }
}

export function getLockoutRemainingSeconds(config: AppLockConfig, now = Date.now()): number {
  if (!config.lockoutUntil || config.lockoutUntil <= now) return 0;
  return Math.ceil((config.lockoutUntil - now) / 1000);
}

export function validatePinFormat(pin: string, length: PinLength): string | null {
  if (!/^\d+$/.test(pin)) {
    return 'PIN-kod faqat raqamlardan iborat boʻlishi kerak';
  }
  if (pin.length !== length) {
    return `PIN-kod ${length} xonali boʻlishi kerak`;
  }
  return null;
}

async function bindAndroidKeystoreVault(userId: string): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const avail = await NativeBiometric.isAvailable({ useFallback: false });
    if (!avail.isAvailable) return false;
    const vaultSecret = generateSaltHex(32);
    await NativeBiometric.setCredentials({
      server: `${KEYSTORE_SERVER_PREFIX}${userId}`,
      username: userId,
      password: vaultSecret,
    });
    return true;
  } catch {
    return false;
  }
}

async function clearAndroidKeystoreVault(userId: string): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await NativeBiometric.deleteCredentials({
      server: `${KEYSTORE_SERVER_PREFIX}${userId}`,
    });
  } catch {
    // Ignore if credential does not exist
  }
}

export async function setupUserPin(
  userId: string,
  pin: string,
  pinLength: PinLength,
  options?: { enableBiometric?: boolean; autoLockSeconds?: AutoLockSeconds }
): Promise<AppLockConfig> {
  const formatErr = validatePinFormat(pin, pinLength);
  if (formatErr) throw new Error(formatErr);

  const salt = generateSaltHex(16);
  const hash = await hashPin(pin, salt, userId);
  const current = getAppLockConfig(userId);
  const hasKeystore = await bindAndroidKeystoreVault(userId);
  const bioEnabled = options?.enableBiometric ?? current.biometricEnabled;

  if (bioEnabled) {
    setPrivacyControl('biometric', true);
    setLegacyBiometricFlag(true);
  }

  markFirstUsePinPromptSeen(userId);
  markSessionUnlocked(userId);

  return saveAppLockConfig(userId, {
    ...current,
    pinEnabled: true,
    pinLength,
    pinSalt: salt,
    pinHash: hash,
    biometricEnabled: bioEnabled,
    autoLockSeconds: options?.autoLockSeconds ?? current.autoLockSeconds,
    failedAttempts: 0,
    lockoutLevel: 0,
    lockoutUntil: null,
    isLocked: false,
    lastUnlockedAt: Date.now(),
    lastHiddenAt: null,
    hasKeystoreBinding: hasKeystore,
  });
}

export async function verifyUserPin(
  userId: string,
  candidatePin: string,
  now = Date.now()
): Promise<VerifyPinResult> {
  const config = getAppLockConfig(userId);
  if (!config.pinEnabled || !config.pinHash) {
    return {
      success: true,
      lockedOut: false,
      lockoutRemainingSec: 0,
      failedAttempts: 0,
      remainingAttempts: MAX_PIN_ATTEMPTS,
    };
  }

  const existingLockout = getLockoutRemainingSeconds(config, now);
  if (existingLockout > 0) {
    return {
      success: false,
      lockedOut: true,
      lockoutRemainingSec: existingLockout,
      failedAttempts: config.failedAttempts,
      remainingAttempts: 0,
      error: `Juda koʻp xato urinish. ${existingLockout} soniyadan keyin qayta urinib koʻring.`,
    };
  }

  // Expired lockout resets counter cleanly for fresh 5-attempt window
  let currentFailures = config.lockoutUntil && config.lockoutUntil <= now ? 0 : config.failedAttempts;

  const isMatch = await verifyHashVersion(candidatePin, config.pinSalt, userId, config.pinHash);
  if (isMatch) {
    saveAppLockConfig(userId, {
      ...config,
      failedAttempts: 0,
      lockoutLevel: 0,
      lockoutUntil: null,
      isLocked: false,
      lastUnlockedAt: now,
      lastHiddenAt: null,
    });
    markSessionUnlocked(userId);
    return {
      success: true,
      lockedOut: false,
      lockoutRemainingSec: 0,
      failedAttempts: 0,
      remainingAttempts: MAX_PIN_ATTEMPTS,
    };
  }

  currentFailures += 1;
  if (currentFailures >= MAX_PIN_ATTEMPTS) {
    const nextLevel = config.lockoutLevel + 1;
    // Progressive backoff: 30s -> 60s -> 120s -> max 300s
    const durationSec = Math.min(30 * Math.pow(2, nextLevel - 1), 300);
    const lockoutUntil = now + durationSec * 1000;
    saveAppLockConfig(userId, {
      ...config,
      failedAttempts: currentFailures,
      lockoutLevel: nextLevel,
      lockoutUntil,
      isLocked: true,
    });
    return {
      success: false,
      lockedOut: true,
      lockoutRemainingSec: durationSec,
      failedAttempts: currentFailures,
      remainingAttempts: 0,
      error: `Ketma-ket 5 marta notoʻgʻri PIN. Ilova ${durationSec} soniyaga bloklandi.`,
    };
  }

  saveAppLockConfig(userId, {
    ...config,
    failedAttempts: currentFailures,
    lockoutUntil: null,
    isLocked: true,
  });

  const remaining = MAX_PIN_ATTEMPTS - currentFailures;
  return {
    success: false,
    lockedOut: false,
    lockoutRemainingSec: 0,
    failedAttempts: currentFailures,
    remainingAttempts: remaining,
    error: `PIN-kod notoʻgʻri. Yana ${remaining} ta urinish qoldi.`,
  };
}

export async function changeUserPin(
  userId: string,
  currentPin: string,
  newPin: string,
  newLength: PinLength
): Promise<AppLockConfig> {
  const verifyRes = await verifyUserPin(userId, currentPin);
  if (!verifyRes.success) {
    throw new Error(verifyRes.error || 'Joriy PIN-kod notoʻgʻri');
  }
  return setupUserPin(userId, newPin, newLength);
}

export async function disableUserPin(userId: string, currentPin?: string): Promise<AppLockConfig> {
  const config = getAppLockConfig(userId);
  if (config.pinEnabled && currentPin !== undefined) {
    const verifyRes = await verifyUserPin(userId, currentPin);
    if (!verifyRes.success) {
      throw new Error(verifyRes.error || 'Joriy PIN-kod notoʻgʻri');
    }
  }
  await clearAndroidKeystoreVault(userId);
  setLegacyBiometricFlag(false);
  clearSessionUnlocked(userId);
  return saveAppLockConfig(userId, {
    ...defaultConfig(),
    autoLockSeconds: config.autoLockSeconds,
  });
}

export async function resetPinAfterReauth(userId: string): Promise<AppLockConfig> {
  await clearAndroidKeystoreVault(userId);
  setLegacyBiometricFlag(false);
  markSessionUnlocked(userId);
  const current = getAppLockConfig(userId);
  return saveAppLockConfig(userId, {
    ...defaultConfig(),
    autoLockSeconds: current.autoLockSeconds,
  });
}

export function setAutoLockTimeout(userId: string, seconds: AutoLockSeconds): AppLockConfig {
  const current = getAppLockConfig(userId);
  return saveAppLockConfig(userId, {
    ...current,
    autoLockSeconds: seconds,
  });
}

export function lockAppNow(userId: string): AppLockConfig {
  const current = getAppLockConfig(userId);
  if (!current.pinEnabled) return current;
  clearSessionUnlocked(userId);
  return saveAppLockConfig(userId, {
    ...current,
    isLocked: true,
  });
}

export function markAppHidden(userId: string, now = Date.now()): AppLockConfig {
  const current = getAppLockConfig(userId);
  if (!current.pinEnabled) return current;
  return saveAppLockConfig(userId, {
    ...current,
    lastHiddenAt: now,
    isLocked: current.autoLockSeconds === 0 ? true : current.isLocked,
  });
}

export function evaluateShouldLock(
  userId: string,
  options?: { isAppLaunch?: boolean; now?: number; lastActivityAt?: number }
): boolean {
  const config = getAppLockConfig(userId);
  if (!config.pinEnabled || !config.pinHash) return false;

  const now = options?.now ?? Date.now();
  if (getLockoutRemainingSeconds(config, now) > 0) {
    return true;
  }

  if (config.isLocked) {
    return true;
  }

  // Fresh WebView / App cold start (sessionStorage cleared across app restarts)
  if (options?.isAppLaunch && !isSessionMarkerUnlocked(userId)) {
    saveAppLockConfig(userId, { ...config, isLocked: true });
    return true;
  }

  if (config.lastHiddenAt !== null) {
    const hiddenElapsedSec = (now - config.lastHiddenAt) / 1000;
    if (hiddenElapsedSec >= config.autoLockSeconds) {
      saveAppLockConfig(userId, { ...config, isLocked: true });
      clearSessionUnlocked(userId);
      return true;
    }
  }

  if (options?.lastActivityAt && config.autoLockSeconds > 0) {
    const idleSec = (now - options.lastActivityAt) / 1000;
    if (idleSec >= config.autoLockSeconds) {
      saveAppLockConfig(userId, { ...config, isLocked: true });
      clearSessionUnlocked(userId);
      return true;
    }
  }

  return false;
}

export function clearHiddenTimestamp(userId: string): void {
  const current = getAppLockConfig(userId);
  if (!current.pinEnabled || current.lastHiddenAt === null) return;
  saveAppLockConfig(userId, { ...current, lastHiddenAt: null });
}

export async function checkBiometricCapability(): Promise<BiometricCapability> {
  if (!isNativeApp()) {
    return {
      available: false,
      isNative: false,
      biometryType: BiometryType.NONE,
      label: 'Barmoq izi / Yuz (faqat Android ilovada)',
      reason: 'Brauzerda biometrik sensor mavjud emas; PIN-kod orqali himoya ishlaydi.',
    };
  }

  try {
    const res = await NativeBiometric.isAvailable({ useFallback: false });
    if (!res.isAvailable) {
      return {
        available: false,
        isNative: true,
        biometryType: res.biometryType ?? BiometryType.NONE,
        label: 'Biometrik sensor sozlanmagan',
        reason: isNativeAndroid()
          ? 'Qurilma sozlamalarida barmoq izi yoki yuz orqali qulfni yoqing.'
          : 'Qurilmada biometrik autentifikatsiya mavjud emas.',
      };
    }

    let label = 'Barmoq izi / Yuz';
    if (res.biometryType === BiometryType.FINGERPRINT || res.biometryType === BiometryType.TOUCH_ID) {
      label = 'Barmoq izi';
    } else if (
      res.biometryType === BiometryType.FACE_AUTHENTICATION ||
      res.biometryType === BiometryType.FACE_ID
    ) {
      label = 'Yuz orqali tanish';
    }

    return {
      available: true,
      isNative: true,
      biometryType: res.biometryType,
      label,
    };
  } catch (err: any) {
    return {
      available: false,
      isNative: true,
      biometryType: BiometryType.NONE,
      label: 'Biometrik sensor mavjud emas',
      reason: err?.message || 'Biometrik holatni tekshirib boʻlmadi.',
    };
  }
}

export async function setBiometricUnlockEnabled(
  userId: string,
  enabled: boolean
): Promise<{ config: AppLockConfig; error?: string }> {
  const current = getAppLockConfig(userId);
  if (!current.pinEnabled) {
    return {
      config: current,
      error: 'Biometrik himoyani yoqishdan oldin avval PIN-kod oʻrnating.',
    };
  }

  if (!enabled) {
    setLegacyBiometricFlag(false);
    const updated = saveAppLockConfig(userId, { ...current, biometricEnabled: false });
    return { config: updated };
  }

  const cap = await checkBiometricCapability();
  if (!cap.available) {
    return {
      config: current,
      error: cap.reason || 'Qurilmada biometrik autentifikatsiya mavjud emas.',
    };
  }

  try {
    await NativeBiometric.verifyIdentity({
      title: 'HISOBOT AI himoyasi',
      subtitle: 'Biometrik kirishni faollashtirish',
      description: `${cap.label} orqali tasdiqlang`,
      negativeButtonText: 'Bekor qilish',
      maxAttempts: 3,
    });
    const hasKeystore = await bindAndroidKeystoreVault(userId);
    setPrivacyControl('biometric', true);
    setLegacyBiometricFlag(true);
    const updated = saveAppLockConfig(userId, {
      ...current,
      biometricEnabled: true,
      hasKeystoreBinding: hasKeystore || current.hasKeystoreBinding,
    });
    return { config: updated };
  } catch (err: any) {
    return {
      config: current,
      error: err?.message || 'Biometrik tasdiqlash bekor qilindi.',
    };
  }
}

export async function unlockWithBiometrics(
  userId: string,
  now = Date.now()
): Promise<{ verified: boolean; error?: string }> {
  const config = getAppLockConfig(userId);
  if (!config.pinEnabled || !config.biometricEnabled) {
    return { verified: false, error: 'Biometrik kirish yoqilmagan.' };
  }

  const lockoutSec = getLockoutRemainingSeconds(config, now);
  if (lockoutSec > 0) {
    return {
      verified: false,
      error: `PIN bloklangan (${lockoutSec} s). Biroz kuting.`,
    };
  }

  const cap = await checkBiometricCapability();
  if (!cap.available) {
    return { verified: false, error: cap.reason || 'Biometrik sensor tayyor emas.' };
  }

  try {
    await NativeBiometric.verifyIdentity({
      title: 'HISOBOT AI',
      subtitle: 'Ilovani qulfdan ochish',
      description: `${cap.label} orqali tasdiqlang`,
      negativeButtonText: 'PIN-kod kiritish',
      maxAttempts: 3,
    });

    // Attempt reading Android Keystore bound credential if present (soft check so key invalidation doesn't brick access)
    if (config.hasKeystoreBinding) {
      try {
        await NativeBiometric.getCredentials({
          server: `${KEYSTORE_SERVER_PREFIX}${userId}`,
        });
      } catch {
        // Re-bind seamlessly if user updated device biometrics
        await bindAndroidKeystoreVault(userId);
      }
    }

    saveAppLockConfig(userId, {
      ...config,
      failedAttempts: 0,
      lockoutLevel: 0,
      lockoutUntil: null,
      isLocked: false,
      lastUnlockedAt: now,
      lastHiddenAt: null,
    });
    markSessionUnlocked(userId);
    return { verified: true };
  } catch (err: any) {
    return {
      verified: false,
      error: err?.message || 'Biometrik tasdiqlash bajarilmadi. PIN-kod kiriting.',
    };
  }
}
