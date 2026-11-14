/**
 * Async Supabase authentication service.
 *
 * This is a staged server-only implementation. It is not wired into Express
 * until the auth middleware and every dependent route are migrated to async.
 */
import crypto from 'node:crypto';
import type { UserProfile } from '../types/finance';
import {
  deleteAllUserSessions,
  deleteSession,
  findSession,
  findUserByEmail,
  findUserById,
  saveSession,
  saveUser,
  type StoredUser,
} from './supabase-storage';

const PBKDF2_ITERATIONS = 1000;
const PBKDF2_KEY_LENGTH = 64;
const PBKDF2_DIGEST = 'sha512';

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST).toString('hex');
}

function safeHashEquals(actual: string, expected: string): boolean {
  const left = Buffer.from(actual, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function toProfile(user: StoredUser): UserProfile {
  return user.profile as unknown as UserProfile;
}

function createToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function validateCredentials(email: string, password: string): void {
  if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
    throw new Error('Elektron pochta va parolni kiriting');
  }
}

export async function registerUserInSupabase(
  email: string,
  password: string,
  fullName: string,
): Promise<{ user: UserProfile; token: string }> {
  validateCredentials(email, password);
  if (typeof fullName !== 'string' || !fullName.trim()) {
    throw new Error('Ism-familiyani kiriting');
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (await findUserByEmail(normalizedEmail)) {
    throw new Error('Ushbu elektron pochta allaqachon roʻyxatdan oʻtgan');
  }

  const userId = `usr_${crypto.randomUUID()}`;
  const salt = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const profile: UserProfile = {
    id: userId,
    email: email.trim(),
    fullName: fullName.trim(),
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
    createdAt: now,
  };

  const user: StoredUser = {
    id: userId,
    email: email.trim(),
    password_hash: hashPassword(password, salt),
    password_salt: salt,
    profile: profile as unknown as Record<string, unknown>,
  };

  // The database's normalized-email unique constraint is the final guard
  // against concurrent registrations racing past the lookup above.
  await saveUser(user);

  const token = createToken();
  await saveSession({ token_hash: hashToken(token), user_id: userId });
  return { user: profile, token };
}

export async function loginUserInSupabase(
  email: string,
  password: string,
): Promise<{ user: UserProfile; token: string }> {
  validateCredentials(email, password);
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user || !safeHashEquals(hashPassword(password, user.password_salt), user.password_hash)) {
    throw new Error('Elektron pochta yoki parol notoʻgʻri');
  }

  const token = createToken();
  await saveSession({ token_hash: hashToken(token), user_id: user.id });
  return { user: toProfile(user), token };
}

export async function getUserBySupabaseToken(token: string): Promise<UserProfile | null> {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return null;
  const session = await findSession(hashToken(token));
  if (!session) return null;
  if (session.expires_at && Date.parse(session.expires_at) <= Date.now()) {
    await deleteSession(session.token_hash);
    return null;
  }
  const user = await findUserById(session.user_id);
  return user ? toProfile(user) : null;
}

export async function logoutFromSupabase(token: string): Promise<void> {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) return;
  await deleteSession(hashToken(token));
}

export async function logoutAllSupabaseSessions(userId: string): Promise<void> {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('userId is required');
  await deleteAllUserSessions(userId);
}
