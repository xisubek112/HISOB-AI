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
  verifyPasswordWithUpgradeCheck,
} from '../src/server/supabase-auth.ts';
import { sanitizePgError, shouldUseSupabaseBackend } from '../src/server/supabase-storage.ts';

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

test('shouldUseSupabaseBackend respects explicit DB_BACKEND flag', () => {
  const prevBackend = process.env.DB_BACKEND;
  const prevUrl = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/hisobot';
    process.env.DB_BACKEND = 'json';
    assert.equal(shouldUseSupabaseBackend(), false);

    process.env.DB_BACKEND = 'supabase';
    assert.equal(shouldUseSupabaseBackend(), true);
  } finally {
    if (prevBackend === undefined) delete process.env.DB_BACKEND;
    else process.env.DB_BACKEND = prevBackend;
    if (prevUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevUrl;
  }
});
