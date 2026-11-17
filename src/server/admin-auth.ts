/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../server.ts';
import { getRepository } from './async-repository.ts';
import {
  attachServerAdminFlag,
  getConfiguredAdminCode,
  getConfiguredAdminEmail,
  isVerifiedSuperAdminUser,
  verifyAdminAccessCode,
} from './admin-policy.ts';

export {
  attachServerAdminFlag,
  getConfiguredAdminCode,
  getConfiguredAdminEmail,
  isVerifiedSuperAdminUser,
  verifyAdminAccessCode,
};

const ADMIN_RATE_WINDOW_MS = 60_000;
const ADMIN_RATE_MAX_REQUESTS = 90;
const adminRateBuckets = new Map<string, number[]>();

const UNLOCK_RATE_WINDOW_MS = 10 * 60_000;
const UNLOCK_RATE_MAX_FAILURES = 5;
const adminUnlockFailureBuckets = new Map<string, number[]>();

const ADMIN_UNLOCK_TTL_MS = 4 * 60 * 60 * 1000;
interface AdminUnlockSessionEntry {
  userId: string;
  sessionHash: string;
  expiresAtMs: number;
}
const adminUnlockTokens = new Map<string, AdminUnlockSessionEntry>();

function hashSessionBearer(req: AuthenticatedRequest): string {
  const authHeader = req.headers.authorization || '';
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function checkAdminRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - ADMIN_RATE_WINDOW_MS;
  const recent = (adminRateBuckets.get(key) || []).filter((ts) => ts > cutoff);

  if (recent.length >= ADMIN_RATE_MAX_REQUESTS) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + ADMIN_RATE_WINDOW_MS - now) / 1000));
    adminRateBuckets.set(key, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  adminRateBuckets.set(key, recent);
  return { allowed: true };
}

export function checkAdminUnlockRateLimit(key: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - UNLOCK_RATE_WINDOW_MS;
  const recent = (adminUnlockFailureBuckets.get(key) || []).filter((ts) => ts > cutoff);
  adminUnlockFailureBuckets.set(key, recent);
  if (recent.length >= UNLOCK_RATE_MAX_FAILURES) {
    const retryAfterSec = Math.max(1, Math.ceil((recent[0] + UNLOCK_RATE_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  return { allowed: true };
}

export function recordAdminUnlockFailure(key: string): void {
  const now = Date.now();
  const cutoff = now - UNLOCK_RATE_WINDOW_MS;
  const recent = (adminUnlockFailureBuckets.get(key) || []).filter((ts) => ts > cutoff);
  recent.push(now);
  adminUnlockFailureBuckets.set(key, recent);
}

export function clearAdminUnlockFailures(key: string): void {
  adminUnlockFailureBuckets.delete(key);
}

export function issueAdminUnlockToken(req: AuthenticatedRequest, userId: string): { token: string; expiresAt: string } {
  const now = Date.now();
  for (const [k, entry] of adminUnlockTokens.entries()) {
    if (entry.expiresAtMs <= now) {
      adminUnlockTokens.delete(k);
    }
  }
  const token = `adm_${crypto.randomBytes(32).toString('hex')}`;
  const expiresAtMs = now + ADMIN_UNLOCK_TTL_MS;
  adminUnlockTokens.set(token, {
    userId,
    sessionHash: hashSessionBearer(req),
    expiresAtMs,
  });
  return { token, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function getVerifiedAdminUnlockEntry(
  req: AuthenticatedRequest,
  userId: string
): { unlocked: boolean; expiresAt?: string } {
  const rawHeader = req.headers['x-admin-code-token'];
  const unlockToken = typeof rawHeader === 'string' ? rawHeader.trim() : '';
  if (!unlockToken) {
    return { unlocked: false };
  }
  const entry = adminUnlockTokens.get(unlockToken);
  if (!entry) {
    return { unlocked: false };
  }
  if (entry.expiresAtMs <= Date.now()) {
    adminUnlockTokens.delete(unlockToken);
    return { unlocked: false };
  }
  if (entry.userId !== userId || entry.sessionHash !== hashSessionBearer(req)) {
    return { unlocked: false };
  }
  return { unlocked: true, expiresAt: new Date(entry.expiresAtMs).toISOString() };
}

export function revokeAdminUnlockToken(req: AuthenticatedRequest): void {
  const rawHeader = req.headers['x-admin-code-token'];
  const unlockToken = typeof rawHeader === 'string' ? rawHeader.trim() : '';
  if (unlockToken) {
    adminUnlockTokens.delete(unlockToken);
  }
  const sessionHash = hashSessionBearer(req);
  for (const [k, entry] of adminUnlockTokens.entries()) {
    if (entry.sessionHash === sessionHash) {
      adminUnlockTokens.delete(k);
    }
  }
}

export function clearAdminRateLimitForTests(): void {
  adminRateBuckets.clear();
  adminUnlockFailureBuckets.clear();
  adminUnlockTokens.clear();
}

export function extractSanitizedClientIp(req: AuthenticatedRequest): string {
  const rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(rawIp).slice(0, 64);
}

/**
 * Backend-only Super Admin authorization guard.
 * 1. Confirms req.user exists from verified session token.
 * 2. Fails closed if ADMIN_EMAIL is missing/invalid.
 * 3. Re-verifies account exists in persistent DB storage and matches ADMIN_EMAIL.
 * 4. Enforces dedicated admin rate limit.
 * 5. When requireCodeUnlock !== false, requires ADMIN_ACCESS_CODE configured + valid X-Admin-Code-Token.
 */
export function createRequireSuperAdminMiddleware(options?: { requireCodeUnlock?: boolean }) {
  const requireCodeUnlock = options?.requireCodeUnlock !== false;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
      }

      const configuredEmail = getConfiguredAdminEmail();
      if (!configuredEmail) {
        return res.status(403).json({
          error: 'Super Admin konfiguratsiyasi serverda sozlanmagan (kirish rad etildi)',
        });
      }

      const dbUser = await getRepository().getUserById(req.user.id);
      if (!dbUser || dbUser.isSuspended) {
        return res.status(403).json({ error: 'Admin ruxsati tasdiqlanmadi' });
      }

      if (dbUser.email.trim().toLowerCase() !== configuredEmail) {
        return res.status(403).json({
          error: 'Ushbu boʻlimga faqat Super Admin kira oladi',
        });
      }

      const limit = checkAdminRateLimit(`${dbUser.id}:${extractSanitizedClientIp(req)}`);
      if (!limit.allowed) {
        return res.status(429).json({
          error: `Admin soʻrov limiti oshdi. ${limit.retryAfterSec || 10} soniyadan keyin urining.`,
        });
      }

      if (requireCodeUnlock) {
        if (!getConfiguredAdminCode()) {
          return res.status(403).json({
            error: 'Admin panel maxfiy kodi serverda sozlanmagan (kirish rad etildi)',
            code: 'ADMIN_CODE_NOT_CONFIGURED',
          });
        }
        const unlock = getVerifiedAdminUnlockEntry(req, dbUser.id);
        if (!unlock.unlocked) {
          return res.status(403).json({
            error: 'Admin panelini ochish uchun maxfiy kirish kodini kiriting',
            code: 'ADMIN_CODE_REQUIRED',
          });
        }
      }

      req.user = attachServerAdminFlag(dbUser);
      return next();
    } catch {
      return res.status(403).json({ error: 'Admin tekshiruvida xatolik' });
    }
  };
}
