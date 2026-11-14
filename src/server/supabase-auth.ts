/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import type { UserProfile } from '../types/finance.ts';
import type { PostgresStorage } from './supabase-storage.ts';

const STRONG_HASH_PREFIX = 'pbkdf2_sha512_120k:';
const STRONG_ITERATIONS = 120_000;
const LEGACY_ITERATIONS = 1000;
const KEYLEN = 64;

const DEFAULT_SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const AUTH_RATE_WINDOW_MS = 60_000;
const AUTH_RATE_MAX_ATTEMPTS = Number(process.env.AUTH_RATE_MAX_PER_MIN || 25);

const authBuckets = new Map<string, number[]>();

export function checkAuthRateLimit(action: string, key: string): { allowed: boolean; retryAfterSec?: number } {
  const bucketKey = `${action}:${key}`;
  const now = Date.now();
  const cutoff = now - AUTH_RATE_WINDOW_MS;
  const recent = (authBuckets.get(bucketKey) || []).filter((ts) => ts > cutoff);

  if (recent.length >= AUTH_RATE_MAX_ATTEMPTS) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + AUTH_RATE_WINDOW_MS - now) / 1000));
    authBuckets.set(bucketKey, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  authBuckets.set(bucketKey, recent);
  return { allowed: true };
}

export function clearAuthRateLimitForTests(): void {
  authBuckets.clear();
}

export function hashPasswordStrong(password: string, salt: string): string {
  const derived = crypto.pbkdf2Sync(password, salt, STRONG_ITERATIONS, KEYLEN, 'sha512').toString('hex');
  return `${STRONG_HASH_PREFIX}${derived}`;
}

export function hashPasswordLegacy(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, LEGACY_ITERATIONS, KEYLEN, 'sha512').toString('hex');
}

export function verifyPasswordWithUpgradeCheck(
  password: string,
  salt: string,
  storedHash: string
): { valid: boolean; needsUpgrade: boolean } {
  if (!password || !salt || !storedHash) {
    return { valid: false, needsUpgrade: false };
  }

  if (storedHash.startsWith(STRONG_HASH_PREFIX)) {
    const expectedHex = storedHash.slice(STRONG_HASH_PREFIX.length);
    const actualHex = crypto.pbkdf2Sync(password, salt, STRONG_ITERATIONS, KEYLEN, 'sha512').toString('hex');
    const a = Buffer.from(actualHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return { valid: false, needsUpgrade: false };
    return { valid: crypto.timingSafeEqual(a, b), needsUpgrade: false };
  }

  // Backward-compatible legacy 1000-iteration hash check -> upgrades seamlessly upon login
  const legacyHex = hashPasswordLegacy(password, salt);
  const a = Buffer.from(legacyHex, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return { valid: false, needsUpgrade: false };
  const valid = crypto.timingSafeEqual(a, b);
  return { valid, needsUpgrade: valid };
}

export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashSessionToken(rawToken) };
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function getSessionExpiryIso(ttlDays = DEFAULT_SESSION_TTL_DAYS): string {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
}

export function buildDefaultUserProfile(params: {
  id: string;
  email: string;
  fullName: string;
  createdAt?: string;
}): UserProfile {
  return {
    id: params.id,
    email: params.email.trim(),
    fullName: params.fullName.trim(),
    currency: 'UZS',
    language: 'uz',
    theme: 'light',
    monthlyBudget: 5000000,
    notificationPrefs: {
      budgetAlerts: true,
      debtReminders: true,
      goalMilestones: true,
      weeklySummary: true,
      subscriptionAlerts: true,
      telegramSync: false,
    },
    createdAt: params.createdAt || new Date().toISOString(),
  };
}

export function sanitizeUserProfile(profile: Record<string, unknown>, fallback?: { id: string; email: string }): UserProfile {
  // Strip any sensitive credential keys if accidentally present in JSONB profile
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, passwordSalt, salt, resetToken, ...rest } = profile;
  return {
    ...(rest as unknown as UserProfile),
    id: String(rest.id || fallback?.id || ''),
    email: String(rest.email || fallback?.email || ''),
  };
}

export class SupabaseAuthService {
  constructor(private readonly storage: PostgresStorage) {}

  async registerUser(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ user: UserProfile; token: string }> {
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    if (!cleanEmail || !password || !cleanName) {
      throw new Error('Barcha maydonlarni toʻldiring');
    }
    if (password.length < 6) {
      throw new Error('Parol kamida 6 belgidan iborat boʻlishi kerak');
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordStrong(password, salt);
    const nowIso = new Date().toISOString();
    const today = nowIso.split('T')[0];

    const profile = buildDefaultUserProfile({
      id: userId,
      email: cleanEmail,
      fullName: cleanName,
      createdAt: nowIso,
    });

    const defaultWalletId = `w_${crypto.randomUUID()}`;
    const defaultWallet = {
      id: defaultWalletId,
      userId,
      name: 'Asosiy hamyon',
      type: 'cash',
      balance: 0,
      currency: 'UZS',
      color: '#10B981',
      icon: 'Wallet',
      createdAt: nowIso,
    };

    const telegramRecord = {
      userId,
      isConnected: false,
      connectCode: `HISOBOT-${Math.floor(1000 + Math.random() * 9000)}`,
      preferences: {
        dailyReport: true,
        weeklyReport: true,
        budgetAlerts: true,
        subscriptionAlerts: true,
      },
    };

    const welcomeNotifId = `notif_${crypto.randomUUID()}`;
    const welcomeNotif = {
      id: welcomeNotifId,
      userId,
      title: 'HISOBOT AI ga xush kelibsiz!',
      message: 'Shaxsiy moliyangizni aqlli boshqarishni bugunoq boshlang. Birinchi kirim yoki chiqimingizni qoʻshing!',
      type: 'monthly_summary',
      date: today,
      isRead: false,
      linkTab: 'dashboard',
    };

    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = getSessionExpiryIso();

    const res = await this.storage.query<{ profile: UserProfile }>(
      `SELECT public.hisobot_register_user_atomic(
        $1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11, $12::timestamptz
      ) AS profile`,
      [
        userId,
        cleanEmail,
        passwordHash,
        salt,
        JSON.stringify(profile),
        defaultWalletId,
        JSON.stringify(defaultWallet),
        JSON.stringify(telegramRecord),
        welcomeNotifId,
        JSON.stringify(welcomeNotif),
        tokenHash,
        expiresAt,
      ],
      { label: 'register_user_atomic' }
    );

    return {
      user: sanitizeUserProfile(res.rows[0].profile as unknown as Record<string, unknown>, {
        id: userId,
        email: cleanEmail,
      }),
      token: rawToken,
    };
  }

  async loginUser(email: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const res = await this.storage.query<{
      id: string;
      email: string;
      password_hash: string;
      password_salt: string;
      profile: Record<string, unknown>;
    }>(
      `SELECT id, email, password_hash, password_salt, profile
         FROM public.app_users
        WHERE email_normalized = $1
        LIMIT 1`,
      [cleanEmail],
      { retryable: true, label: 'login_lookup' }
    );

    const row = res.rows[0];
    if (!row || (process.env.NODE_ENV === 'production' && row.id === 'usr_demo_hisobot_2026')) {
      throw new Error('Elektron pochta yoki parol notoʻgʻri');
    }

    const check = verifyPasswordWithUpgradeCheck(password, row.password_salt, row.password_hash);
    if (!check.valid) {
      throw new Error('Elektron pochta yoki parol notoʻgʻri');
    }

    // Transparently upgrade legacy 1000-iteration hash to 120,000-iteration hash on login
    if (check.needsUpgrade) {
      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = hashPasswordStrong(password, newSalt);
      await this.storage.query(
        `UPDATE public.app_users
            SET password_hash = $1, password_salt = $2, updated_at = now()
          WHERE id = $3`,
        [newHash, newSalt, row.id],
        { label: 'upgrade_password_hash' }
      );
    }

    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = getSessionExpiryIso();

    await this.storage.query(
      `INSERT INTO public.app_sessions (token_hash, user_id, created_at, expires_at, last_used_at)
       VALUES ($1, $2, now(), $3::timestamptz, now())`,
      [tokenHash, row.id, expiresAt],
      { label: 'create_session' }
    );

    return {
      user: sanitizeUserProfile(row.profile, { id: row.id, email: row.email }),
      token: rawToken,
    };
  }

  async getUserByToken(rawToken: string): Promise<UserProfile | null> {
    if (!rawToken || rawToken.length < 16) return null;
    const tokenHash = hashSessionToken(rawToken);

    const res = await this.storage.query<{
      id: string;
      email: string;
      profile: Record<string, unknown>;
    }>(
      `UPDATE public.app_sessions s
          SET last_used_at = now()
         FROM public.app_users u
        WHERE s.token_hash = $1
          AND s.user_id = u.id
          AND (s.expires_at IS NULL OR s.expires_at > now())
      RETURNING u.id, u.email, u.profile`,
      [tokenHash],
      { retryable: true, label: 'validate_session' }
    );

    const row = res.rows[0];
    if (!row) return null;
    if (process.env.NODE_ENV === 'production' && row.id === 'usr_demo_hisobot_2026') {
      return null;
    }

    return sanitizeUserProfile(row.profile, { id: row.id, email: row.email });
  }

  async getUserById(userId: string): Promise<UserProfile | null> {
    const res = await this.storage.query<{
      id: string;
      email: string;
      profile: Record<string, unknown>;
    }>(
      `SELECT id, email, profile FROM public.app_users WHERE id = $1 LIMIT 1`,
      [userId],
      { retryable: true, label: 'get_user_by_id' }
    );
    const row = res.rows[0];
    if (!row) return null;
    return sanitizeUserProfile(row.profile, { id: row.id, email: row.email });
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashSessionToken(rawToken);
    await this.storage.query(
      `DELETE FROM public.app_sessions WHERE token_hash = $1`,
      [tokenHash],
      { label: 'logout_session' }
    );
  }

  async logoutAllDevices(userId: string): Promise<number> {
    const res = await this.storage.query(
      `DELETE FROM public.app_sessions WHERE user_id = $1`,
      [userId],
      { label: 'logout_all_sessions' }
    );
    return res.rowCount || 0;
  }

  async verifyUserPassword(userId: string, password: string): Promise<boolean> {
    if (!password) return false;
    const res = await this.storage.query<{
      password_hash: string;
      password_salt: string;
    }>(
      `SELECT password_hash, password_salt FROM public.app_users WHERE id = $1 LIMIT 1`,
      [userId],
      { retryable: true, label: 'verify_password' }
    );
    const row = res.rows[0];
    if (!row) return false;
    return verifyPasswordWithUpgradeCheck(password, row.password_salt, row.password_hash).valid;
  }

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    // Whitelist ONLY user-editable fields; NEVER allow tampering with id, email, isPremium, familyGroupId!
    const safePatch: Partial<UserProfile> = {};
    if (typeof updates.fullName === 'string' && updates.fullName.trim()) {
      safePatch.fullName = updates.fullName.trim();
    }
    if (typeof updates.avatarUrl === 'string') safePatch.avatarUrl = updates.avatarUrl;
    if (updates.currency) safePatch.currency = updates.currency;
    if (updates.theme === 'light' || updates.theme === 'dark') safePatch.theme = updates.theme;
    if (updates.monthlyBudget !== undefined) {
      const budget = Math.round(Number(updates.monthlyBudget));
      if (!Number.isFinite(budget) || budget < 0) {
        throw new Error('Oylik budjet notoʻgʻri kiritildi');
      }
      safePatch.monthlyBudget = budget;
    }

    const res = await this.storage.withTransaction(async (client) => {
      const current = await client.query<{ id: string; email: string; profile: Record<string, unknown> }>(
        `SELECT id, email, profile FROM public.app_users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      const row = current.rows[0];
      if (!row) throw new Error('Foydalanuvchi topilmadi');

      const mergedProfile: Record<string, unknown> = {
        ...row.profile,
        ...safePatch,
      };
      if (updates.notificationPrefs && typeof updates.notificationPrefs === 'object') {
        mergedProfile.notificationPrefs = {
          ...(typeof row.profile.notificationPrefs === 'object' && row.profile.notificationPrefs
            ? row.profile.notificationPrefs
            : {}),
          ...updates.notificationPrefs,
        };
      }

      await client.query(
        `UPDATE public.app_users SET profile = $1::jsonb, updated_at = now() WHERE id = $2`,
        [JSON.stringify(mergedProfile), userId]
      );

      return sanitizeUserProfile(mergedProfile, { id: row.id, email: row.email });
    });

    return res;
  }

  async changePassword(userId: string, oldPass: string, newPass: string): Promise<void> {
    if (!newPass || newPass.length < 6) {
      throw new Error('Yangi parol kamida 6 belgidan iborat boʻlishi kerak');
    }

    await this.storage.withTransaction(async (client) => {
      const res = await client.query<{ password_hash: string; password_salt: string }>(
        `SELECT password_hash, password_salt FROM public.app_users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      const row = res.rows[0];
      if (!row) throw new Error('Foydalanuvchi topilmadi');

      const check = verifyPasswordWithUpgradeCheck(oldPass, row.password_salt, row.password_hash);
      if (!check.valid) {
        throw new Error('Amaldagi parol notoʻgʻri');
      }

      const newSalt = crypto.randomBytes(16).toString('hex');
      const newHash = hashPasswordStrong(newPass, newSalt);

      await client.query(
        `UPDATE public.app_users
            SET password_hash = $1, password_salt = $2, updated_at = now()
          WHERE id = $3`,
        [newHash, newSalt, userId]
      );
    });
  }
}
