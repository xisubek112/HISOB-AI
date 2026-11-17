/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AdminAiAnalyticsData,
  AdminAuditLog,
  AdminDailyPoint,
  AdminOverviewData,
  AdminRevenueData,
  AdminSubscriptionsData,
  AdminSystemHealthData,
  AdminUserSummary,
  AiUsageEvent,
  ApiErrorEvent,
  AppRuntimeConfig,
  SubscriptionEvent,
} from '../types/finance.ts';
import { getConfiguredAdminCode, getConfiguredAdminEmail } from './admin-policy.ts';

export const DEFAULT_APP_RUNTIME_CONFIG: AppRuntimeConfig = {
  maintenanceMode: false,
  registrationEnabled: true,
  aiAssistantEnabled: true,
  aiFastModel: 'gemini-3.1-flash-lite',
  aiRateLimitPerMin: 30,
  freeTrialDays: 0,
  proMonthlyPriceUzs: 39000,
  businessMonthlyPriceUzs: 79000,
};

export function sanitizeRuntimeConfigUpdate(
  current: AppRuntimeConfig,
  updates: Partial<AppRuntimeConfig>,
  updatedBy: string
): AppRuntimeConfig {
  const next: AppRuntimeConfig = { ...current };

  if (typeof updates.maintenanceMode === 'boolean') {
    next.maintenanceMode = updates.maintenanceMode;
  }
  if (typeof updates.registrationEnabled === 'boolean') {
    next.registrationEnabled = updates.registrationEnabled;
  }
  if (typeof updates.aiAssistantEnabled === 'boolean') {
    next.aiAssistantEnabled = updates.aiAssistantEnabled;
  }
  if (updates.aiFastModel === 'gemini-3.1-flash-lite' || updates.aiFastModel === 'gemini-4-hydrogen') {
    next.aiFastModel = updates.aiFastModel;
  }
  if (updates.aiRateLimitPerMin !== undefined) {
    const val = Math.round(Number(updates.aiRateLimitPerMin));
    if (!Number.isFinite(val) || val < 5 || val > 240) {
      throw new Error('AI soʻrov limiti 5 dan 240 gacha boʻlishi kerak');
    }
    next.aiRateLimitPerMin = val;
  }
  if (updates.freeTrialDays !== undefined) {
    const val = Math.round(Number(updates.freeTrialDays));
    if (!Number.isFinite(val) || val < 0 || val > 90) {
      throw new Error('Sinov muddati 0 dan 90 kungacha boʻlishi kerak');
    }
    next.freeTrialDays = val;
  }
  if (updates.proMonthlyPriceUzs !== undefined) {
    const val = Math.round(Number(updates.proMonthlyPriceUzs));
    if (!Number.isFinite(val) || val < 0 || val > 100_000_000) {
      throw new Error('Pro tarif narxi notoʻgʻri');
    }
    next.proMonthlyPriceUzs = val;
  }
  if (updates.businessMonthlyPriceUzs !== undefined) {
    const val = Math.round(Number(updates.businessMonthlyPriceUzs));
    if (!Number.isFinite(val) || val < 0 || val > 100_000_000) {
      throw new Error('Business tarif narxi notoʻgʻri');
    }
    next.businessMonthlyPriceUzs = val;
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = updatedBy;
  return next;
}

function isGeminiKeyPresent(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 10);
}

function getLastNDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function buildAdminOverviewData(params: {
  users: AdminUserSummary[];
  totalTransactions: number;
  aiEvents: AiUsageEvent[];
  apiErrors: ApiErrorEvent[];
  subscriptionEvents: SubscriptionEvent[];
  auditLogs: AdminAuditLog[];
  config: AppRuntimeConfig;
  health: { ok: boolean; backend: 'json' | 'supabase'; latencyMs: number; error?: string };
}): AdminOverviewData {
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;
  const todayStr = new Date().toISOString().slice(0, 10);

  let activeUsers24h = 0;
  let activeUsers7d = 0;
  let newUsersToday = 0;
  let newUsers7d = 0;
  let newUsers30d = 0;
  let premiumUsers = 0;
  let proUsers = 0;
  let businessUsers = 0;
  let suspendedUsers = 0;

  for (const u of params.users) {
    const createdMs = Date.parse(u.createdAt || '');
    const activeMs = Date.parse(u.lastActiveAt || u.createdAt || '');

    if (Number.isFinite(activeMs)) {
      if (nowMs - activeMs <= dayMs) activeUsers24h += 1;
      if (nowMs - activeMs <= weekMs) activeUsers7d += 1;
    }
    if ((u.createdAt || '').startsWith(todayStr)) newUsersToday += 1;
    if (Number.isFinite(createdMs)) {
      if (nowMs - createdMs <= weekMs) newUsers7d += 1;
      if (nowMs - createdMs <= monthMs) newUsers30d += 1;
    }
    if (u.isSuspended) suspendedUsers += 1;
    if (u.isPremium && (u.premiumPlan === 'pro' || u.premiumPlan === 'business')) {
      premiumUsers += 1;
      if (u.premiumPlan === 'business') businessUsers += 1;
      else proUsers += 1;
    }
  }

  const totalUsers = params.users.length;
  const premiumConversionRate = totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 1000) / 10 : 0;

  const totalRevenueUzs = params.subscriptionEvents.reduce((sum, e) => sum + (Number(e.amountUzs) || 0), 0);
  const revenue30dUzs = params.subscriptionEvents
    .filter((e) => {
      const ts = Date.parse(e.createdAt || '');
      return Number.isFinite(ts) && nowMs - ts <= monthMs;
    })
    .reduce((sum, e) => sum + (Number(e.amountUzs) || 0), 0);

  const mrrEstimateUzs =
    proUsers * (params.config.proMonthlyPriceUzs || 39000) +
    businessUsers * (params.config.businessMonthlyPriceUzs || 79000);

  const aiRequestsTotal = params.aiEvents.length;
  const aiRequests24h = params.aiEvents.filter((e) => {
    const ts = Date.parse(e.createdAt || '');
    return Number.isFinite(ts) && nowMs - ts <= dayMs;
  }).length;
  const fallbackCount = params.aiEvents.filter((e) => e.source === 'fallback').length;
  const aiFallbackRate = aiRequestsTotal > 0 ? Math.round((fallbackCount / aiRequestsTotal) * 1000) / 10 : 0;
  const aiAvgLatencyMs =
    aiRequestsTotal > 0
      ? Math.round(params.aiEvents.reduce((sum, e) => sum + (Number(e.latencyMs) || 0), 0) / aiRequestsTotal)
      : 0;

  const errors24h = params.apiErrors.filter((e) => {
    const ts = Date.parse(e.createdAt || '');
    return Number.isFinite(ts) && nowMs - ts <= dayMs;
  });
  const apiErrors24h = errors24h.length;
  const apiErrors5xx24h = errors24h.filter((e) => e.statusCode >= 500).length;

  const days = getLastNDays(14);
  const dayMap = new Map<string, AdminDailyPoint>();
  for (const d of days) {
    dayMap.set(d, { date: d, signups: 0, aiRequests: 0, revenueUzs: 0, apiErrors: 0 });
  }

  for (const u of params.users) {
    const d = (u.createdAt || '').slice(0, 10);
    const point = dayMap.get(d);
    if (point) point.signups += 1;
  }
  for (const e of params.aiEvents) {
    const d = (e.createdAt || '').slice(0, 10);
    const point = dayMap.get(d);
    if (point) point.aiRequests += 1;
  }
  for (const e of params.subscriptionEvents) {
    const d = (e.createdAt || '').slice(0, 10);
    const point = dayMap.get(d);
    if (point) point.revenueUzs += Number(e.amountUzs) || 0;
  }
  for (const e of params.apiErrors) {
    const d = (e.createdAt || '').slice(0, 10);
    const point = dayMap.get(d);
    if (point) point.apiErrors += 1;
  }

  const mem = process.memoryUsage();

  return {
    metrics: {
      totalUsers,
      activeUsers24h,
      activeUsers7d,
      newUsersToday,
      newUsers7d,
      newUsers30d,
      premiumUsers,
      proUsers,
      businessUsers,
      suspendedUsers,
      premiumConversionRate,
      totalTransactions: params.totalTransactions,
      totalRevenueUzs,
      revenue30dUzs,
      mrrEstimateUzs,
      aiRequestsTotal,
      aiRequests24h,
      aiFallbackRate,
      aiAvgLatencyMs,
      apiErrors24h,
      apiErrors5xx24h,
    },
    health: {
      serverStatus: 'online',
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      nodeVersion: process.version,
      databaseStatus: params.health.ok ? 'healthy' : 'degraded',
      databaseBackend: params.health.backend,
      databaseLatencyMs: params.health.latencyMs,
      databaseError: params.health.error,
      adminEmailConfigured: Boolean(getConfiguredAdminEmail()),
      geminiConfigured: isGeminiKeyPresent(),
    },
    series: Array.from(dayMap.values()),
    recentAuditLogs: params.auditLogs.slice(0, 8),
  };
}

export function buildAdminAiAnalyticsData(aiEvents: AiUsageEvent[]): AdminAiAnalyticsData {
  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sortedLatencies = aiEvents
    .map((e) => Math.max(0, Number(e.latencyMs) || 0))
    .sort((a, b) => a - b);

  const totalRequests = aiEvents.length;
  const requests24h = aiEvents.filter((e) => {
    const ts = Date.parse(e.createdAt || '');
    return Number.isFinite(ts) && nowMs - ts <= dayMs;
  }).length;
  const geminiCount = aiEvents.filter((e) => e.source === 'gemini').length;
  const fallbackCount = aiEvents.filter((e) => e.source === 'fallback').length;
  const errorCount = aiEvents.filter((e) => e.status === 'error').length;
  const fallbackRate = totalRequests > 0 ? Math.round((fallbackCount / totalRequests) * 1000) / 10 : 0;
  const avgLatencyMs =
    totalRequests > 0
      ? Math.round(aiEvents.reduce((sum, e) => sum + (Number(e.latencyMs) || 0), 0) / totalRequests)
      : 0;
  const p95Idx = sortedLatencies.length > 0 ? Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.95)) : 0;
  const p95LatencyMs = sortedLatencies.length > 0 ? sortedLatencies[p95Idx] : 0;

  const modelMap = new Map<string, { count: number; totalLatency: number }>();
  const langMap = new Map<string, number>();
  const endpointMap = new Map<string, { count: number; fallbackCount: number }>();

  for (const ev of aiEvents) {
    const m = ev.model || 'unknown';
    const curM = modelMap.get(m) || { count: 0, totalLatency: 0 };
    curM.count += 1;
    curM.totalLatency += Number(ev.latencyMs) || 0;
    modelMap.set(m, curM);

    const lang = ev.language || 'uz';
    langMap.set(lang, (langMap.get(lang) || 0) + 1);

    const ep = ev.endpoint || '/api/ai/assistant';
    const curE = endpointMap.get(ep) || { count: 0, fallbackCount: 0 };
    curE.count += 1;
    if (ev.source === 'fallback') curE.fallbackCount += 1;
    endpointMap.set(ep, curE);
  }

  const days = getLastNDays(14);
  const dailyMap = new Map<
    string,
    { date: string; gemini: number; fallback: number; errors: number; totalLatency: number; count: number }
  >();
  for (const d of days) {
    dailyMap.set(d, { date: d, gemini: 0, fallback: 0, errors: 0, totalLatency: 0, count: 0 });
  }
  for (const ev of aiEvents) {
    const d = (ev.createdAt || '').slice(0, 10);
    const bucket = dailyMap.get(d);
    if (bucket) {
      if (ev.source === 'gemini') bucket.gemini += 1;
      else bucket.fallback += 1;
      if (ev.status === 'error') bucket.errors += 1;
      bucket.totalLatency += Number(ev.latencyMs) || 0;
      bucket.count += 1;
    }
  }

  return {
    summary: {
      totalRequests,
      requests24h,
      geminiCount,
      fallbackCount,
      errorCount,
      fallbackRate,
      avgLatencyMs,
      p95LatencyMs,
    },
    byModel: Array.from(modelMap.entries())
      .map(([model, v]) => ({
        model,
        count: v.count,
        avgLatencyMs: v.count > 0 ? Math.round(v.totalLatency / v.count) : 0,
      }))
      .sort((a, b) => b.count - a.count),
    byLanguage: Array.from(langMap.entries())
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count),
    byEndpoint: Array.from(endpointMap.entries())
      .map(([endpoint, v]) => ({ endpoint, count: v.count, fallbackCount: v.fallbackCount }))
      .sort((a, b) => b.count - a.count),
    dailySeries: Array.from(dailyMap.values()).map((d) => ({
      date: d.date,
      gemini: d.gemini,
      fallback: d.fallback,
      errors: d.errors,
      avgLatencyMs: d.count > 0 ? Math.round(d.totalLatency / d.count) : 0,
    })),
    recentErrors: aiEvents.filter((e) => e.status === 'error' || Boolean(e.errorCode)).slice(0, 20),
  };
}

export function buildAdminRevenueData(params: {
  users: AdminUserSummary[];
  subscriptionEvents: SubscriptionEvent[];
  config: AppRuntimeConfig;
}): AdminRevenueData {
  const nowMs = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  let freeCount = 0;
  let proActiveCount = 0;
  let businessActiveCount = 0;
  for (const u of params.users) {
    if (u.isPremium && u.premiumPlan === 'business') businessActiveCount += 1;
    else if (u.isPremium && u.premiumPlan === 'pro') proActiveCount += 1;
    else freeCount += 1;
  }

  const totalRevenueUzs = params.subscriptionEvents.reduce((s, e) => s + (Number(e.amountUzs) || 0), 0);
  const revenue30dUzs = params.subscriptionEvents
    .filter((e) => {
      const ts = Date.parse(e.createdAt || '');
      return Number.isFinite(ts) && nowMs - ts <= monthMs;
    })
    .reduce((s, e) => s + (Number(e.amountUzs) || 0), 0);

  const mrrEstimateUzs =
    proActiveCount * (params.config.proMonthlyPriceUzs || 39000) +
    businessActiveCount * (params.config.businessMonthlyPriceUzs || 79000);

  const revByPlan: Record<'free' | 'pro' | 'business', number> = { free: 0, pro: 0, business: 0 };
  for (const ev of params.subscriptionEvents) {
    if (ev.plan === 'pro' || ev.plan === 'business' || ev.plan === 'free') {
      revByPlan[ev.plan] += Number(ev.amountUzs) || 0;
    }
  }

  // Last 6 months buckets
  const now = new Date();
  const monthlyMap = new Map<string, { month: string; revenueUzs: number; eventsCount: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    monthlyMap.set(key, { month: key, revenueUzs: 0, eventsCount: 0 });
  }
  for (const ev of params.subscriptionEvents) {
    const key = (ev.createdAt || '').slice(0, 7);
    const bucket = monthlyMap.get(key);
    if (bucket) {
      bucket.revenueUzs += Number(ev.amountUzs) || 0;
      bucket.eventsCount += 1;
    }
  }

  return {
    summary: {
      totalRevenueUzs,
      revenue30dUzs,
      mrrEstimateUzs,
      paidEventsCount: params.subscriptionEvents.filter((e) => (e.amountUzs || 0) > 0).length,
      activePaidUsers: proActiveCount + businessActiveCount,
      proActiveCount,
      businessActiveCount,
    },
    byPlan: [
      { plan: 'free', subscribers: freeCount, revenueUzs: revByPlan.free },
      { plan: 'pro', subscribers: proActiveCount, revenueUzs: revByPlan.pro },
      { plan: 'business', subscribers: businessActiveCount, revenueUzs: revByPlan.business },
    ],
    monthlySeries: Array.from(monthlyMap.values()),
    recentEvents: params.subscriptionEvents.slice(0, 25),
  };
}

export function buildAdminSubscriptionsData(params: {
  users: AdminUserSummary[];
  subscriptionEvents: SubscriptionEvent[];
  page: number;
  limit: number;
}): AdminSubscriptionsData {
  let freeUsers = 0;
  let proUsers = 0;
  let businessUsers = 0;
  const activeSubscribers: AdminUserSummary[] = [];

  for (const u of params.users) {
    if (u.isPremium && u.premiumPlan === 'business') {
      businessUsers += 1;
      activeSubscribers.push(u);
    } else if (u.isPremium && u.premiumPlan === 'pro') {
      proUsers += 1;
      activeSubscribers.push(u);
    } else {
      freeUsers += 1;
    }
  }

  const totalUsers = params.users.length;
  const activePremiumUsers = proUsers + businessUsers;
  const conversionRate = totalUsers > 0 ? Math.round((activePremiumUsers / totalUsers) * 1000) / 10 : 0;

  const safeLimit = Math.min(50, Math.max(1, params.limit));
  const safePage = Math.max(1, params.page);
  const start = (safePage - 1) * safeLimit;

  return {
    summary: {
      freeUsers,
      proUsers,
      businessUsers,
      activePremiumUsers,
      conversionRate,
      totalEventsCount: params.subscriptionEvents.length,
    },
    subscribers: activeSubscribers.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    events: params.subscriptionEvents.slice(start, start + safeLimit),
    totalEvents: params.subscriptionEvents.length,
    page: safePage,
    limit: safeLimit,
  };
}

export function buildAdminSystemHealthData(params: {
  apiErrors: ApiErrorEvent[];
  health: { ok: boolean; backend: 'json' | 'supabase'; latencyMs: number; error?: string };
}): AdminSystemHealthData {
  const mem = process.memoryUsage();
  return {
    serverStatus: 'online',
    uptimeSeconds: Math.round(process.uptime()),
    memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: params.health.ok ? 'healthy' : 'degraded',
      backend: params.health.backend,
      latencyMs: params.health.latencyMs,
      error: params.health.error,
    },
    securityChecks: {
      adminEmailConfigured: Boolean(getConfiguredAdminEmail()),
      adminCodeConfigured: Boolean(getConfiguredAdminCode()),
      geminiConfigured: isGeminiKeyPresent(),
      rateLimitingActive: true,
      auditLoggingActive: true,
    },
    recentApiErrors: params.apiErrors.slice(0, 30),
  };
}
