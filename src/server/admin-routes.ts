/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { NextFunction, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../../server.ts';
import type { AppRuntimeConfig } from '../types/finance.ts';
import {
  clearAdminUnlockFailures,
  checkAdminUnlockRateLimit,
  createRequireSuperAdminMiddleware,
  extractSanitizedClientIp,
  getConfiguredAdminCode,
  getVerifiedAdminUnlockEntry,
  issueAdminUnlockToken,
  recordAdminUnlockFailure,
  revokeAdminUnlockToken,
  verifyAdminAccessCode,
} from './admin-auth.ts';
import { getRepository } from './async-repository.ts';

type AsyncHandlerFn = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown> | unknown;

function wrapAsync(fn: AsyncHandlerFn) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function validateConfirmedReason(body: Record<string, unknown> | undefined): { ok: true; reason: string } | { ok: false; error: string } {
  if (!body || body.confirm !== true) {
    return { ok: false, error: 'Ushbu administrator amali uchun tasdiqlash (confirm: true) majburiy' };
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length < 3 || reason.length > 300) {
    return { ok: false, error: 'Amal sababi (reason) kamida 3 ta belgidan iborat boʻlishi kerak' };
  }
  return { ok: true, reason };
}

function clampPageLimit(query: Record<string, unknown>): { page: number; limit: number } {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(50, Math.floor(rawLimit)) : 20;
  return { page, limit };
}

export function createAdminRouter(authMiddleware: RequestHandler) {
  const router = express.Router();

  // Super Admin session + email verified (before separate code unlock)
  const requireSuperAdminEmailOnly = createRequireSuperAdminMiddleware({ requireCodeUnlock: false });

  router.get(
    '/access-status',
    authMiddleware,
    requireSuperAdminEmailOnly,
    wrapAsync(async (req, res) => {
      const configured = Boolean(getConfiguredAdminCode());
      const entry = configured ? getVerifiedAdminUnlockEntry(req, req.user!.id) : { unlocked: false };
      res.json({
        adminCodeConfigured: configured,
        unlocked: configured && entry.unlocked,
        expiresAt: entry.expiresAt,
      });
    })
  );

  router.post(
    '/unlock',
    authMiddleware,
    requireSuperAdminEmailOnly,
    wrapAsync(async (req, res) => {
      if (!getConfiguredAdminCode()) {
        return res.status(403).json({
          error: 'Admin panel maxfiy kodi serverda sozlanmagan (kirish rad etildi)',
          code: 'ADMIN_CODE_NOT_CONFIGURED',
        });
      }

      const ip = extractSanitizedClientIp(req);
      const limitKey = `${req.user!.id}:${ip}`;
      const limit = checkAdminUnlockRateLimit(limitKey);
      if (!limit.allowed) {
        return res.status(429).json({
          error: `Juda koʻp notoʻgʻri kod urinishi. ${limit.retryAfterSec || 60} soniyadan keyin qayta urining.`,
        });
      }

      const rawCode = typeof req.body?.code === 'string' ? req.body.code : '';
      if (!rawCode.trim()) {
        return res.status(400).json({ error: 'Maxfiy kirish kodini kiriting' });
      }

      if (!verifyAdminAccessCode(rawCode)) {
        recordAdminUnlockFailure(limitKey);
        await getRepository()
          .addAdminAuditLog({
            adminUserId: req.user!.id,
            adminEmail: req.user!.email,
            action: 'admin.unlock_failed',
            targetType: 'system',
            targetId: 'admin_panel',
            reason: 'Notoʻgʻri admin maxfiy kodi kiritildi',
            ipAddress: ip,
          })
          .catch(() => {});
        return res.status(403).json({
          error: 'Maxfiy kirish kodi notoʻgʻri',
          code: 'INVALID_ADMIN_CODE',
        });
      }

      clearAdminUnlockFailures(limitKey);
      const issued = issueAdminUnlockToken(req, req.user!.id);
      await getRepository().addAdminAuditLog({
        adminUserId: req.user!.id,
        adminEmail: req.user!.email,
        action: 'admin.unlock',
        targetType: 'system',
        targetId: 'admin_panel',
        reason: 'Admin panel alohida maxfiy kod bilan ochildi',
        ipAddress: ip,
      });

      res.json({
        unlocked: true,
        unlockToken: issued.token,
        expiresAt: issued.expiresAt,
      });
    })
  );

  router.post(
    '/lock',
    authMiddleware,
    requireSuperAdminEmailOnly,
    wrapAsync(async (req, res) => {
      revokeAdminUnlockToken(req);
      await getRepository()
        .addAdminAuditLog({
          adminUserId: req.user!.id,
          adminEmail: req.user!.email,
          action: 'admin.lock',
          targetType: 'system',
          targetId: 'admin_panel',
          reason: 'Admin panel qoʻlda qulflandi',
          ipAddress: extractSanitizedClientIp(req),
        })
        .catch(() => {});
      res.json({ locked: true });
    })
  );

  // Every route below requires verified session token + Super Admin email + unlocked separate Admin Code
  router.use(authMiddleware, createRequireSuperAdminMiddleware({ requireCodeUnlock: true }));

  router.get(
    '/overview',
    wrapAsync(async (_req, res) => {
      const overview = await getRepository().getAdminOverviewData();
      res.json(overview);
    })
  );

  router.get(
    '/users',
    wrapAsync(async (req, res) => {
      const { page, limit } = clampPageLimit(req.query as Record<string, unknown>);
      const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 120) : undefined;
      const plan = typeof req.query.plan === 'string' ? req.query.plan.slice(0, 24) : 'all';
      const status = typeof req.query.status === 'string' ? req.query.status.slice(0, 24) : 'all';

      const data = await getRepository().listAdminUsers({ search, plan, status, page, limit });
      res.json(data);
    })
  );

  router.post(
    '/users/:id/subscription',
    wrapAsync(async (req, res) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const check = validateConfirmedReason(body);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const plan = body.plan;
      if (plan !== 'free' && plan !== 'pro' && plan !== 'business') {
        return res.status(400).json({ error: 'Tarif rejasi notoʻgʻri (free, pro, business)' });
      }

      const rawMonths = Number(body.durationMonths ?? 1);
      const durationMonths = plan === 'free' ? 0 : Math.min(36, Math.max(1, Math.round(Number.isFinite(rawMonths) ? rawMonths : 1)));

      const result = await getRepository().adminUpdateUserSubscription({
        adminUser: req.user!,
        targetUserId: String(req.params.id || '').trim(),
        plan,
        durationMonths,
        reason: check.reason,
        ipAddress: extractSanitizedClientIp(req),
      });

      res.json(result);
    })
  );

  router.post(
    '/users/:id/status',
    wrapAsync(async (req, res) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const check = validateConfirmedReason(body);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      if (typeof body.suspended !== 'boolean') {
        return res.status(400).json({ error: 'suspended qiymati boolean boʻlishi kerak' });
      }

      const result = await getRepository().adminSetUserSuspended({
        adminUser: req.user!,
        targetUserId: String(req.params.id || '').trim(),
        suspended: body.suspended,
        reason: check.reason,
        ipAddress: extractSanitizedClientIp(req),
      });

      res.json(result);
    })
  );

  router.post(
    '/users/:id/revoke-sessions',
    wrapAsync(async (req, res) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const check = validateConfirmedReason(body);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }

      const result = await getRepository().adminRevokeUserSessions({
        adminUser: req.user!,
        targetUserId: String(req.params.id || '').trim(),
        reason: check.reason,
        ipAddress: extractSanitizedClientIp(req),
      });

      res.json(result);
    })
  );

  router.get(
    '/subscriptions',
    wrapAsync(async (req, res) => {
      const { page, limit } = clampPageLimit(req.query as Record<string, unknown>);
      const data = await getRepository().getAdminSubscriptionsData({ page, limit });
      res.json(data);
    })
  );

  router.get(
    '/revenue',
    wrapAsync(async (_req, res) => {
      const data = await getRepository().getAdminRevenueData();
      res.json(data);
    })
  );

  router.get(
    '/ai-analytics',
    wrapAsync(async (_req, res) => {
      const data = await getRepository().getAdminAiAnalyticsData();
      res.json(data);
    })
  );

  router.get(
    '/system-health',
    wrapAsync(async (_req, res) => {
      const data = await getRepository().getAdminSystemHealthData();
      res.json(data);
    })
  );

  router.get(
    '/audit-logs',
    wrapAsync(async (req, res) => {
      const { page, limit } = clampPageLimit(req.query as Record<string, unknown>);
      const action = typeof req.query.action === 'string' ? req.query.action.slice(0, 64) : 'all';
      const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 120) : undefined;
      const data = await getRepository().listAdminAuditLogs({ action, search, page, limit });
      res.json(data);
    })
  );

  router.get(
    '/config',
    wrapAsync(async (_req, res) => {
      const config = await getRepository().getAppConfig();
      res.json({ config });
    })
  );

  router.put(
    '/config',
    wrapAsync(async (req, res) => {
      const body = (req.body || {}) as Record<string, unknown>;
      const check = validateConfirmedReason(body);
      if (!check.ok) {
        return res.status(400).json({ error: check.error });
      }
      const updates = body.config as Partial<AppRuntimeConfig> | undefined;
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Konfiguratsiya maydonlari kiritilmagan' });
      }

      const repo = getRepository();
      const next = await repo.updateAppConfig(updates, req.user!.email);
      const auditLog = await repo.addAdminAuditLog({
        adminUserId: req.user!.id,
        adminEmail: req.user!.email,
        action: 'config.update',
        targetType: 'config',
        targetId: 'runtime_config',
        reason: check.reason,
        metadata: {
          maintenanceMode: next.maintenanceMode,
          registrationEnabled: next.registrationEnabled,
          aiAssistantEnabled: next.aiAssistantEnabled,
          aiFastModel: next.aiFastModel,
          aiRateLimitPerMin: next.aiRateLimitPerMin,
          proMonthlyPriceUzs: next.proMonthlyPriceUzs,
          businessMonthlyPriceUzs: next.businessMonthlyPriceUzs,
        },
        ipAddress: extractSanitizedClientIp(req),
      });

      res.json({ config: next, auditLog });
    })
  );

  return router;
}
