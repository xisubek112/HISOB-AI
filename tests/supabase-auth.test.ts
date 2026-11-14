/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkAuthRateLimit,
  clearAuthRateLimitForTests,
  generateSessionToken,
  hashPasswordLegacy,
  hashPasswordStrong,
  hashSessionToken,
  sanitizeUserProfile,
  SupabaseAuthService,
  verifyPasswordWithUpgradeCheck,
} from '../src/server/supabase-auth.ts';
import {
  type PostgresStorage,
  sanitizePgError,
  shouldUseSupabaseBackend,
  validateDatabaseConfiguration,
} from '../src/server/supabase-storage.ts';
import { getRepository, setRepositoryForTests } from '../src/server/async-repository.ts';

test('strong password hashing verifies and does not trigger upgrade', () => {
  const salt = '0123456789abcdef0123456789abcdef';
  const hash = hashPasswordStrong('MyStrongPass#2026', salt);
  assert.ok(hash.startsWith('pbkdf2_sha512_120k:'));

  const ok = verifyPasswordWithUpgradeCheck('MyStrongPass#2026', salt, hash);
  assert.deepEqual(ok, { valid: true, needsUpgrade: false });

  const bad = verifyPasswordWithUpgradeCheck('WrongPass', salt, hash);
  assert.deepEqual(bad, { valid: false, needsUpgrade: false });
});

test('legacy 1000-iteration hash verifies and requests transparent upgrade', () => {
  const salt = 'fedcba9876543210fedcba9876543210';
  const legacyHash = hashPasswordLegacy('legacy123', salt);
  assert.ok(!legacyHash.startsWith('pbkdf2_sha512_120k:'));

  const ok = verifyPasswordWithUpgradeCheck('legacy123', salt, legacyHash);
  assert.deepEqual(ok, { valid: true, needsUpgrade: true });

  const bad = verifyPasswordWithUpgradeCheck('wrong', salt, legacyHash);
  assert.deepEqual(bad, { valid: false, needsUpgrade: false });
});

test('session tokens are random and hashed deterministically with sha256', () => {
  const s1 = generateSessionToken();
  const s2 = generateSessionToken();
  assert.notEqual(s1.rawToken, s2.rawToken);
  assert.notEqual(s1.tokenHash, s1.rawToken);
  assert.equal(s1.tokenHash.length, 64);
  assert.equal(hashSessionToken(s1.rawToken), s1.tokenHash);
});

test('sanitizeUserProfile strips credential fields', () => {
  const clean = sanitizeUserProfile({
    id: 'usr_1',
    email: 'user@example.com',
    fullName: 'Test User',
    passwordHash: 'secret',
    passwordSalt: 'secret_salt',
    salt: 'secret_salt',
    resetToken: '123456',
  }) as unknown as Record<string, unknown>;

  assert.equal(clean.id, 'usr_1');
  assert.equal(clean.email, 'user@example.com');
  assert.equal('passwordHash' in clean, false);
  assert.equal('passwordSalt' in clean, false);
  assert.equal('salt' in clean, false);
  assert.equal('resetToken' in clean, false);
});

test('auth rate limiter blocks excessive attempts and resets cleanly', () => {
  clearAuthRateLimitForTests();
  for (let i = 0; i < 25; i++) {
    const res = checkAuthRateLimit('login', '127.0.0.1:test@example.com');
    assert.equal(res.allowed, true);
  }
  const blocked = checkAuthRateLimit('login', '127.0.0.1:test@example.com');
  assert.equal(blocked.allowed, false);
  assert.ok((blocked.retryAfterSec || 0) >= 1);
  clearAuthRateLimitForTests();
});

test('sanitizePgError redacts Postgres DSNs and Bearer tokens', () => {
  const raw = new Error(
    'Failed connecting to postgresql://postgres:SuperSecret123@db.example.supabase.co:5432/postgres with Bearer eyJhbGciOiJIUzI1NiJ9.abc.xyz'
  );
  const safe = sanitizePgError(raw);
  assert.ok(!safe.includes('SuperSecret123'));
  assert.ok(!safe.includes('eyJhbGciOiJIUzI1NiJ9'));
  assert.ok(safe.includes('postgresql://[REDACTED]'));
  assert.ok(safe.includes('Bearer [REDACTED]'));
});

test('shouldUseSupabaseBackend respects explicit DB_BACKEND flag and fails closed when DATABASE_URL is missing', () => {
  const prevBackend = process.env.DB_BACKEND;
  const prevUrl = process.env.DATABASE_URL;
  const prevSupaUrl = process.env.SUPABASE_DB_URL;
  try {
    setRepositoryForTests(null);
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/hisobot';
    process.env.DB_BACKEND = 'json';
    assert.equal(shouldUseSupabaseBackend(), false);
    assert.deepEqual(validateDatabaseConfiguration(), { backend: 'json' });

    process.env.DB_BACKEND = 'supabase';
    assert.equal(shouldUseSupabaseBackend(), true);
    assert.deepEqual(validateDatabaseConfiguration(), { backend: 'supabase' });

    // Remove DATABASE_URL & SUPABASE_DB_URL while DB_BACKEND=supabase -> MUST throw, never fall back to JSON
    delete process.env.DATABASE_URL;
    delete process.env.SUPABASE_DB_URL;
    setRepositoryForTests(null);

    assert.throws(
      () => shouldUseSupabaseBackend(),
      /DB_BACKEND=supabase.*DATABASE_URL.*fallback bloklandi/i
    );
    assert.throws(
      () => validateDatabaseConfiguration(),
      /DB_BACKEND=supabase.*DATABASE_URL.*fallback bloklandi/i
    );
    assert.throws(
      () => getRepository(),
      /DB_BACKEND=supabase.*DATABASE_URL.*fallback bloklandi/i
    );

    process.env.DB_BACKEND = 'postgres';
    assert.throws(() => shouldUseSupabaseBackend(), /fallback bloklandi/i);

    process.env.DB_BACKEND = 'invalid_engine';
    assert.throws(() => shouldUseSupabaseBackend(), /Notoʻgʻri DB_BACKEND qiymati/i);
  } finally {
    setRepositoryForTests(null);
    if (prevBackend === undefined) delete process.env.DB_BACKEND;
    else process.env.DB_BACKEND = prevBackend;
    if (prevUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevUrl;
    if (prevSupaUrl === undefined) delete process.env.SUPABASE_DB_URL;
    else process.env.SUPABASE_DB_URL = prevSupaUrl;
  }
});

test('SupabaseAuthService.registerUser creates both starter wallets matching legacy db.ts', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  const mockStorage = {
    query: async (sql: string, params: unknown[]) => {
      capturedSql = sql;
      capturedParams = params;
      return {
        rows: [{ profile: JSON.parse(String(params[4])) }],
        rowCount: 1,
      };
    },
  } as unknown as PostgresStorage;

  const auth = new SupabaseAuthService(mockStorage);
  const result = await auth.registerUser('starter@hisobot.uz', 'StrongPass#2026', 'Starter User');

  assert.equal(result.user.email, 'starter@hisobot.uz');
  assert.ok(result.token.length >= 32);
  assert.match(capturedSql, /hisobot_register_user_atomic/);
  assert.equal(capturedParams.length, 14);

  const primaryWallet = JSON.parse(String(capturedParams[6])) as Record<string, unknown>;
  const secondaryWallet = JSON.parse(String(capturedParams[8])) as Record<string, unknown>;
  assert.equal(primaryWallet.name, 'Asosiy karta');
  assert.equal(primaryWallet.type, 'card');
  assert.equal(primaryWallet.color, '#10B981');
  assert.equal(secondaryWallet.name, 'Naqd pul');
  assert.equal(secondaryWallet.type, 'cash');
  assert.equal(secondaryWallet.color, '#3B82F6');
});
