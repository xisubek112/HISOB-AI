/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import type { UserProfile } from '../types/finance.ts';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_ADMIN_CODE_LENGTH = 6;

/**
 * Reads the server-side configured Super Admin email from process.env.ADMIN_EMAIL.
 * Fails closed (returns null) if missing, blank, or invalid email format.
 */
export function getConfiguredAdminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!raw || !EMAIL_PATTERN.test(raw)) {
    return null;
  }
  return raw;
}

/**
 * Reads the server-side configured Admin Panel separate access code from process.env.ADMIN_ACCESS_CODE.
 * Fails closed (returns null) if missing or shorter than 6 characters.
 */
export function getConfiguredAdminCode(): string | null {
  const raw = process.env.ADMIN_ACCESS_CODE?.trim();
  if (!raw || raw.length < MIN_ADMIN_CODE_LENGTH) {
    return null;
  }
  return raw;
}

/**
 * Constant-time verification of the separate Admin Panel access code.
 */
export function verifyAdminAccessCode(candidate: string): boolean {
  const configured = getConfiguredAdminCode();
  if (!configured || typeof candidate !== 'string') {
    return false;
  }
  const cleanCandidate = candidate.trim();
  if (!cleanCandidate) {
    return false;
  }
  const expectedDigest = crypto.createHash('sha256').update(configured, 'utf8').digest();
  const actualDigest = crypto.createHash('sha256').update(cleanCandidate, 'utf8').digest();
  return crypto.timingSafeEqual(expectedDigest, actualDigest);
}

/**
 * Strictly compares an authenticated user's verified email against ADMIN_EMAIL.
 * Never trusts frontend flags, user-submitted profile fields, or fallback defaults.
 */
export function isVerifiedSuperAdminUser(
  user: Pick<UserProfile, 'id' | 'email' | 'isSuspended'> | null | undefined
): boolean {
  const configuredEmail = getConfiguredAdminEmail();
  if (!configuredEmail || !user || !user.id || !user.email) {
    return false;
  }
  if (user.isSuspended) {
    return false;
  }
  return user.email.trim().toLowerCase() === configuredEmail;
}

/**
 * Strips any client-spoofed privilege fields and attaches the freshly evaluated server flag.
 */
export function attachServerAdminFlag(user: UserProfile): UserProfile {
  return {
    ...user,
    isSuperAdmin: isVerifiedSuperAdminUser(user),
  };
}
