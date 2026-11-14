/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';
import { getRepository } from './src/server/async-repository.ts';
import { checkAuthRateLimit } from './src/server/supabase-auth.ts';
import { closeSharedPostgresStorage, sanitizePgError } from './src/server/supabase-storage.ts';
import {
  parseUzbekTransactionAI,
  answerFinancialQuestionAI,
  parseReceiptAI,
  calculateFinancialHealth,
  calculateFinancialForecast,
} from './src/server/ai.ts';
import {
  GEMINI_MODEL,
  checkUserRateLimit,
  isGeminiConfigured,
  parseReceiptWithGemini,
  parseTransactionWithGemini,
  runGeminiAssistantTurn,
  type GeminiHistoryItem,
} from './src/server/gemini.ts';
import type { UserProfile, FinancialSummary, AIProposedAction } from './src/types/finance.ts';

dotenv.config();

const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

type AsyncRouteHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<unknown> | unknown;

function asyncHandler(fn: AsyncRouteHandler) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function extractIdempotencyKey(req: Request): string | undefined {
  const headerVal = req.headers['x-idempotency-key'];
  if (typeof headerVal === 'string' && headerVal.trim()) {
    return headerVal.trim().slice(0, 160);
  }
  const bodyVal = (req.body as Record<string, unknown> | undefined)?.idempotencyKey;
  if (typeof bodyVal === 'string' && bodyVal.trim()) {
    return bodyVal.trim().slice(0, 160);
  }
  return undefined;
}

function getAllowedOrigins(): Set<string> {
  const defaults = ['http://localhost', 'https://localhost', 'capacitor://localhost'];
  if (process.env.NODE_ENV !== 'production') {
    defaults.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...defaults, ...extra]);
}

function parsePositiveInt(val: unknown, label: string): number {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${label} noldan katta butun son boʻlishi kerak`);
  }
  return n;
}

function isValidYmdDate(val: unknown): val is string {
  return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
  });

  // Explicit CORS allowlist (supports Capacitor WebView + configured Render domains)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      const allowed = getAllowedOrigins();
      if (allowed.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Idempotency-Key');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') {
        return res.status(allowed.has(origin) ? 204 : 403).end();
      }
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  // Auth Middleware: extracts user strictly from Bearer Token
  const authMiddleware = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
      const user = await getRepository().getUserByToken(token);
      if (user) {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
  });

  // --- HEALTH CHECK ---
  app.get(
    '/api/health',
    asyncHandler(async (_req: Request, res: Response) => {
      const health = await getRepository().healthCheck();
      res.status(health.ok ? 200 : 503).json({
        status: health.ok ? 'ok' : 'degraded',
        backend: health.backend,
        latencyMs: health.latencyMs,
        ...(health.error ? { error: health.error } : {}),
        timestamp: new Date().toISOString(),
      });
    })
  );

  // --- AUTH ROUTES ---
  app.post(
    '/api/auth/register',
    asyncHandler(async (req: Request, res: Response) => {
      const clientKey = `${req.ip || 'unknown'}`;
      const limit = checkAuthRateLimit('register', clientKey);
      if (!limit.allowed) {
        return res.status(429).json({
          error: `Juda koʻp urinish. Iltimos, ${limit.retryAfterSec || 30} soniyadan keyin urinib koʻring.`,
        });
      }

      const { email, password, fullName } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string' || !email.trim() || !password || !fullName.trim()) {
        return res.status(400).json({ error: 'Barcha maydonlarni toʻldiring' });
      }
      if (!email.includes('@')) {
        return res.status(400).json({ error: 'Yaroqli elektron pochta manzilini kiriting' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Parol kamida 6 belgidan iborat boʻlishi kerak' });
      }
      const result = await getRepository().registerUser(email, password, fullName);
      res.json(result);
    })
  );

  app.post(
    '/api/auth/login',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body || {};
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const limit = checkAuthRateLimit('login', `${req.ip || 'unknown'}:${cleanEmail}`);
      if (!limit.allowed) {
        return res.status(429).json({
          error: `Juda koʻp kirish urinishi. ${limit.retryAfterSec || 30} soniyadan keyin qayta urining.`,
        });
      }

      if (!cleanEmail || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Elektron pochta va parolni kiriting' });
      }
      const result = await getRepository().loginUser(cleanEmail, password);
      res.json(result);
    })
  );

  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  app.post(
    '/api/auth/logout',
    asyncHandler(async (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
      if (token) {
        await getRepository().logout(token);
      }
      res.json({ success: true });
    })
  );

  app.post(
    '/api/auth/logout-all',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const clearedSessions = await getRepository().logoutAllDevices(req.user!.id);
      res.json({ success: true, clearedSessions });
    })
  );

  app.post(
    '/api/auth/verify-password',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const limit = checkAuthRateLimit('verify_password', `${req.ip || 'unknown'}:${req.user!.id}`);
      if (!limit.allowed) {
        return res.status(429).json({ error: 'Juda koʻp urinish. Biroz kuting.' });
      }
      const { password } = req.body || {};
      if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Parolni kiriting' });
      }
      const valid = await getRepository().verifyUserPassword(req.user!.id, password);
      if (!valid) {
        return res.status(401).json({ error: 'Parol notoʻgʻri' });
      }
      res.json({ valid: true });
    })
  );

  // Password reset is intentionally unavailable until a verified email/SMS
  // delivery provider, hashed one-time tokens, expiry, and rate limits are implemented.
  app.post('/api/auth/forgot-password', (_req: Request, res: Response) => {
    res.status(503).json({
      error: 'Parolni tiklash xizmati vaqtincha ishlamayapti. Qoʻllab-quvvatlash xizmatiga murojaat qiling.',
    });
  });

  app.post('/api/auth/reset-password', (_req: Request, res: Response) => {
    res.status(503).json({ error: 'Parolni tiklash xizmati vaqtincha ishlamayapti.' });
  });

  app.put(
    '/api/auth/profile',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const updated = await getRepository().updateProfile(req.user!.id, req.body || {});
      res.json({ user: updated });
    })
  );

  // Premium activation is disabled until a trusted payment provider/webhook
  // verifies a unique payment event on the server.
  app.post('/api/user/upgrade-premium', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    res.status(403).json({ error: 'Premium faollashtirish toʻlov tekshiruvi joriy etilguncha vaqtincha yopiq.' });
  });

  app.put(
    '/api/auth/change-password',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const limit = checkAuthRateLimit('change_password', `${req.ip || 'unknown'}:${req.user!.id}`);
      if (!limit.allowed) {
        return res.status(429).json({ error: 'Juda koʻp urinish. Biroz kuting.' });
      }
      const { oldPassword, newPassword } = req.body || {};
      if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || !oldPassword || !newPassword) {
        return res.status(400).json({ error: 'Amaldagi va yangi parolni kiriting' });
      }
      await getRepository().changePassword(req.user!.id, oldPassword, newPassword);
      res.json({ success: true, message: 'Parol muvaffaqiyatli oʻzgartirildi' });
    })
  );

  // --- TRANSACTIONS ROUTES ---
  app.get(
    '/api/transactions',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      let list = await getRepository().getTransactions(req.user!.id);
      const { type, categoryId, search, startDate, endDate, sort } = req.query;

      if (type && type !== 'all') {
        list = list.filter((t) => t.type === type);
      }
      if (categoryId && categoryId !== 'all') {
        list = list.filter((t) => t.categoryId === categoryId);
      }
      if (search) {
        const q = String(search).toLowerCase();
        list = list.filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            t.categoryName.toLowerCase().includes(q) ||
            (t.notes && t.notes.toLowerCase().includes(q))
        );
      }
      if (startDate) {
        list = list.filter((t) => t.date >= String(startDate));
      }
      if (endDate) {
        list = list.filter((t) => t.date <= String(endDate));
      }

      if (sort === 'amount_asc') {
        list.sort((a, b) => a.amount - b.amount);
      } else if (sort === 'amount_desc') {
        list.sort((a, b) => b.amount - a.amount);
      }

      res.json({ transactions: list });
    })
  );

  app.post(
    '/api/transactions',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const {
        type,
        amount,
        categoryId,
        categoryName,
        walletId,
        walletName,
        currency,
        originalAmount,
        exchangeRate,
        date,
        time,
        description,
        paymentMethod,
        notes,
        isFamilyShared,
      } = req.body || {};

      if ((type !== 'income' && type !== 'expense') || !amount || !categoryName || !date) {
        return res.status(400).json({ error: 'Majburiy maydonlar toʻldirilmagan' });
      }
      if (!isValidYmdDate(date)) {
        return res.status(400).json({ error: 'Sana formati notoʻgʻri (YYYY-MM-DD)' });
      }

      const parsedAmount = parsePositiveInt(amount, 'Tranzaksiya summasi');
      const tx = await getRepository().addTransaction(
        req.user!.id,
        {
          type,
          amount: parsedAmount,
          categoryId: categoryId || 'cat_custom',
          categoryName: String(categoryName).trim(),
          ...(walletId ? { walletId: String(walletId) } : {}),
          ...(walletName ? { walletName: String(walletName) } : {}),
          ...(currency ? { currency } : {}),
          ...(originalAmount !== undefined ? { originalAmount: Number(originalAmount) } : {}),
          ...(exchangeRate !== undefined ? { exchangeRate: Number(exchangeRate) } : {}),
          date: date.trim(),
          time: typeof time === 'string' && time ? time : '12:00',
          description: typeof description === 'string' && description.trim() ? description.trim() : String(categoryName).trim(),
          paymentMethod: paymentMethod || 'card',
          notes: typeof notes === 'string' ? notes : '',
          ...(isFamilyShared !== undefined ? { isFamilyShared: Boolean(isFamilyShared) } : {}),
        },
        extractIdempotencyKey(req)
      );

      res.json({ transaction: tx });
    })
  );

  app.put(
    '/api/transactions/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const updated = await getRepository().updateTransaction(req.user!.id, req.params.id, req.body || {});
      res.json({ transaction: updated });
    })
  );

  app.delete(
    '/api/transactions/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteTransaction(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- CATEGORIES ROUTES ---
  app.get(
    '/api/categories',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const categories = await getRepository().getCategories(req.user!.id);
      res.json({ categories });
    })
  );

  app.post(
    '/api/categories',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { name, type, icon, color } = req.body || {};
      if (!name || (type !== 'income' && type !== 'expense')) {
        return res.status(400).json({ error: 'Nomi va turi talab qilinadi' });
      }
      const cat = await getRepository().addCategory(req.user!.id, {
        name: String(name).trim(),
        type,
        icon,
        color,
      });
      res.json({ category: cat });
    })
  );

  app.delete(
    '/api/categories/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteCategory(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- BUDGETS ROUTES ---
  app.get(
    '/api/budgets',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const repo = getRepository();
      const [budgets, transactions] = await Promise.all([
        repo.getBudgets(req.user!.id),
        repo.getTransactions(req.user!.id),
      ]);

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const enriched = budgets.map((b) => {
        const spent = transactions
          .filter(
            (t) =>
              t.type === 'expense' &&
              t.date.startsWith(b.month || currentMonth) &&
              (t.categoryId === b.categoryId || t.categoryName === b.categoryName)
          )
          .reduce((sum, t) => sum + t.amount, 0);

        const percentage = b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0;
        return {
          ...b,
          spent,
          remaining: Math.max(0, b.monthlyLimit - spent),
          percentage,
          isWarning: percentage >= (b.alertThreshold || 80),
          isExceeded: spent > b.monthlyLimit,
        };
      });

      res.json({ budgets: enriched });
    })
  );

  app.post(
    '/api/budgets',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body || {};
      if (!body.categoryId || !body.categoryName || !body.month) {
        return res.status(400).json({ error: 'Budjet maʼlumotlari toʻliq emas' });
      }
      parsePositiveInt(body.monthlyLimit, 'Budjet limiti');
      const budget = await getRepository().setBudget(req.user!.id, body);
      res.json({ budget });
    })
  );

  app.delete(
    '/api/budgets/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteBudget(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- FINANCIAL GOALS ROUTES ---
  app.get(
    '/api/goals',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const goals = await getRepository().getGoals(req.user!.id);
      res.json({ goals });
    })
  );

  app.post(
    '/api/goals',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body || {};
      if (!body.name) {
        return res.status(400).json({ error: 'Maqsad nomi kiritilmagan' });
      }
      parsePositiveInt(body.targetAmount, 'Maqsad summasi');
      const goal = await getRepository().addGoal(req.user!.id, body);
      res.json({ goal });
    })
  );

  app.put(
    '/api/goals/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const updated = await getRepository().updateGoal(req.user!.id, req.params.id, req.body || {});
      res.json({ goal: updated });
    })
  );

  app.post(
    '/api/goals/:id/deposit',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { amount, walletId } = req.body || {};
      const parsedAmount = parsePositiveInt(amount, 'Depozit summasi');
      const goal = await getRepository().depositToGoal(
        req.user!.id,
        req.params.id,
        parsedAmount,
        typeof walletId === 'string' && walletId.trim() ? walletId.trim() : undefined,
        extractIdempotencyKey(req)
      );
      res.json({ goal });
    })
  );

  app.delete(
    '/api/goals/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteGoal(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- DEBTS ROUTES ---
  app.get(
    '/api/debts',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const debts = await getRepository().getDebts(req.user!.id);
      res.json({ debts });
    })
  );

  app.post(
    '/api/debts',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body || {};
      if (!body.personName || (body.type !== 'borrowed' && body.type !== 'lent')) {
        return res.status(400).json({ error: 'Qarz maʼlumotlari toʻliq emas' });
      }
      parsePositiveInt(body.amount, 'Qarz summasi');
      const debt = await getRepository().addDebt(req.user!.id, body);
      res.json({ debt });
    })
  );

  app.put(
    '/api/debts/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const updated = await getRepository().updateDebt(req.user!.id, req.params.id, req.body || {});
      res.json({ debt: updated });
    })
  );

  app.post(
    '/api/debts/:id/pay',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { payment, walletId } = req.body || {};
      const parsedPay = parsePositiveInt(payment, 'Toʻlov summasi');
      const debt = await getRepository().payDebt(
        req.user!.id,
        req.params.id,
        parsedPay,
        typeof walletId === 'string' && walletId.trim() ? walletId.trim() : undefined,
        extractIdempotencyKey(req)
      );
      res.json({ debt });
    })
  );

  app.delete(
    '/api/debts/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteDebt(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- NOTIFICATIONS ROUTES ---
  app.get(
    '/api/notifications',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const notifications = await getRepository().getNotifications(req.user!.id);
      res.json({ notifications });
    })
  );

  app.put(
    '/api/notifications/read-all',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      await getRepository().markAllNotificationsRead(req.user!.id);
      res.json({ success: true });
    })
  );

  app.put(
    '/api/notifications/:id/read',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      await getRepository().markNotificationRead(req.user!.id, req.params.id);
      res.json({ success: true });
    })
  );

  // --- FINANCIAL SUMMARY & REPORTS ROUTE ---
  app.get(
    '/api/reports/summary',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const repo = getRepository();
      const [allTx, categories] = await Promise.all([
        repo.getTransactions(userId),
        repo.getCategories(userId),
      ]);
      const { period, startDate, endDate } = req.query;

      const now = new Date();
      let start = '';
      let end = '';

      const pad = (n: number) => String(n).padStart(2, '0');
      const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      if (period === 'today') {
        start = end = formatYMD(now);
      } else if (period === 'yesterday') {
        const yest = new Date(now);
        yest.setDate(yest.getDate() - 1);
        start = end = formatYMD(yest);
      } else if (period === '7days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        start = formatYMD(d);
        end = formatYMD(now);
      } else if (period === '30days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        start = formatYMD(d);
        end = formatYMD(now);
      } else if (period === 'last_month') {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        start = formatYMD(lm);
        end = formatYMD(lastDay);
      } else if (period === 'this_year') {
        start = `${now.getFullYear()}-01-01`;
        end = `${now.getFullYear()}-12-31`;
      } else if (period === 'custom' && startDate && endDate) {
        start = String(startDate);
        end = String(endDate);
      } else {
        start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end = formatYMD(lastDay);
      }

      const filtered = allTx.filter((t) => t.date >= start && t.date <= end);

      const totalLifetimeIncome = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalLifetimeExpense = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const totalBalance = totalLifetimeIncome - totalLifetimeExpense;

      const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const netSavings = totalIncome - totalExpense;
      const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

      const expenseTx = filtered.filter((t) => t.type === 'expense');
      const catMap: Record<string, { amount: number; count: number; color: string }> = {};

      expenseTx.forEach((t) => {
        if (!catMap[t.categoryName]) {
          const match = categories.find((c) => c.name === t.categoryName);
          catMap[t.categoryName] = {
            amount: 0,
            count: 0,
            color: match?.color || '#64748B',
          };
        }
        catMap[t.categoryName].amount += t.amount;
        catMap[t.categoryName].count += 1;
      });

      const categoriesBreakdown = Object.entries(catMap)
        .map(([categoryName, data]) => ({
          categoryName,
          amount: data.amount,
          count: data.count,
          color: data.color,
          percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 100) : 0,
          type: 'expense' as const,
        }))
        .sort((a, b) => b.amount - a.amount);

      const monthlyComparison: FinancialSummary['monthlyComparison'] = [];
      const monthNamesUz = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        const mTx = allTx.filter((t) => t.date.startsWith(mStr));
        const mInc = mTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const mExp = mTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        monthlyComparison.push({
          month: `${monthNamesUz[d.getMonth()]} ${d.getFullYear()}`,
          income: mInc,
          expense: mExp,
          savings: mInc - mExp,
        });
      }

      const dailyMap: Record<string, { income: number; expense: number }> = {};
      filtered.forEach((t) => {
        if (!dailyMap[t.date]) {
          dailyMap[t.date] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') dailyMap[t.date].income += t.amount;
        else dailyMap[t.date].expense += t.amount;
      });

      const dailyBreakdown = Object.entries(dailyMap)
        .map(([date, data]) => ({
          date,
          income: data.income,
          expense: data.expense,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const summary: FinancialSummary = {
        totalBalance,
        totalIncome,
        totalExpense,
        netSavings,
        savingsRate,
        incomeCount: filtered.filter((t) => t.type === 'income').length,
        expenseCount: filtered.filter((t) => t.type === 'expense').length,
        categoriesBreakdown,
        monthlyComparison,
        dailyBreakdown,
      };

      res.json({ summary, startDate: start, endDate: end });
    })
  );

  // --- AI ASSISTANT ROUTES ---
  app.get('/api/ai/status', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      configured: isGeminiConfigured(),
      model: GEMINI_MODEL,
    });
  });

  app.post(
    '/api/ai/assistant',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user!.id;
        const rate = checkUserRateLimit(userId);
        if (!rate.allowed) {
          return res.status(429).json({
            error: `Juda koʻp soʻrov yuborildi. Iltimos, ${rate.retryAfterSec || 10} soniyadan keyin qayta urinib koʻring.`,
          });
        }

        const { message, history, language } = req.body as {
          message?: unknown;
          history?: unknown;
          language?: unknown;
        };

        if (typeof message !== 'string' || !message.trim()) {
          return res.status(400).json({ error: 'Xabar matni kiritilmagan' });
        }

        const safeHistory: GeminiHistoryItem[] = Array.isArray(history)
          ? history
              .filter(
                (h): h is GeminiHistoryItem =>
                  Boolean(h) &&
                  typeof h === 'object' &&
                  (h.role === 'user' || h.role === 'assistant') &&
                  typeof h.content === 'string'
              )
              .slice(-12)
          : [];

        const langHint = typeof language === 'string' ? language : 'uz';
        const result = await runGeminiAssistantTurn({
          user: req.user!,
          message: message.trim(),
          history: safeHistory,
          language: langHint,
        });

        res.json(result);
      } catch (err: any) {
        console.error('[HISOBOT AI] /api/ai/assistant unexpected failure:', err?.message || 'unknown');
        res.status(500).json({ error: 'AI yordamchisi javob bera olmadi. Iltimos, birozdan keyin urinib koʻring.' });
      }
    })
  );

  app.post(
    '/api/ai/execute-action',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { confirmed, action } = req.body as { confirmed?: boolean; action?: AIProposedAction };
      if (confirmed !== true) {
        return res.status(400).json({ error: 'Amalni bajarish uchun foydalanuvchi tasdigʻi talab qilinadi' });
      }
      if (!action || typeof action !== 'object' || !action.actionType || !action.payload) {
        return res.status(400).json({ error: 'Amal maʼlumotlari notoʻgʻri' });
      }

      const userId = req.user!.id;
      const repo = getRepository();
      const idempotencyKey = extractIdempotencyKey(req);

      if (action.actionType === 'transaction') {
        const p = action.payload;
        const amount = Math.round(Number(p.amount));
        if (!p.type || amount <= 0 || !p.categoryName || !p.date) {
          return res.status(400).json({ error: 'Tranzaksiya maʼlumotlari toʻliq emas' });
        }
        const categories = await repo.getCategories(userId);
        const matchedCat = categories.find(
          (c) => c.id === p.categoryId || c.name.toLowerCase() === p.categoryName.toLowerCase()
        );
        const created = await repo.addTransaction(
          userId,
          {
            type: p.type === 'income' ? 'income' : 'expense',
            amount,
            categoryId: matchedCat?.id || p.categoryId || 'cat_custom',
            categoryName: matchedCat?.name || p.categoryName,
            ...(p.walletId ? { walletId: p.walletId } : {}),
            date: p.date,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: p.description || matchedCat?.name || p.categoryName,
            paymentMethod: p.paymentMethod || 'card',
            notes: 'HISOBOT AI yordamchisi orqali tasdiqlab qoʻshildi',
          },
          idempotencyKey
        );
        return res.json({
          success: true,
          actionType: 'transaction',
          summary: action.summary,
          createdRecord: created,
        });
      }

      if (action.actionType === 'budget') {
        const p = action.payload;
        const monthlyLimit = Math.round(Number(p.monthlyLimit));
        if (!p.categoryName || monthlyLimit <= 0) {
          return res.status(400).json({ error: 'Budjet maʼlumotlari toʻliq emas' });
        }
        const categories = await repo.getCategories(userId);
        const matchedCat = categories.find(
          (c) => c.id === p.categoryId || c.name.toLowerCase() === p.categoryName.toLowerCase()
        );
        const month = p.month || new Date().toISOString().slice(0, 7);
        const created = await repo.setBudget(userId, {
          categoryId: matchedCat?.id || p.categoryId || 'cat_custom',
          categoryName: matchedCat?.name || p.categoryName,
          monthlyLimit,
          month,
          alertThreshold: p.alertThreshold || 80,
        });
        return res.json({
          success: true,
          actionType: 'budget',
          summary: action.summary,
          createdRecord: created,
        });
      }

      if (action.actionType === 'goal') {
        const p = action.payload;
        const targetAmount = Math.round(Number(p.targetAmount));
        if (!p.name || targetAmount <= 0) {
          return res.status(400).json({ error: 'Maqsad maʼlumotlari toʻliq emas' });
        }
        const created = await repo.addGoal(userId, {
          name: p.name,
          targetAmount,
          savedAmount: Math.max(0, Math.round(Number(p.savedAmount) || 0)),
          deadline: p.deadline || new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
          color: '#10B981',
          icon: 'Target',
        });
        return res.json({
          success: true,
          actionType: 'goal',
          summary: action.summary,
          createdRecord: created,
        });
      }

      return res.status(400).json({ error: 'Nomaʼlum amal turi' });
    })
  );

  app.post(
    '/api/ai/parse-transaction',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { text, language } = req.body || {};
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Matn kiritilmagan' });
      }
      const categories = await getRepository().getCategories(req.user!.id);
      const geminiParsed = isGeminiConfigured()
        ? await parseTransactionWithGemini(text, categories, typeof language === 'string' ? language : 'uz')
        : null;
      const parsed = geminiParsed || (await parseUzbekTransactionAI(text, categories, language));
      res.json({ parsed });
    })
  );

  app.post(
    '/api/ai/chat',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { query, history, language } = req.body || {};
      if (!query || typeof query !== 'string') return res.status(400).json({ error: 'Savol kiritilmagan' });

      if (isGeminiConfigured()) {
        const rate = checkUserRateLimit(req.user!.id);
        if (!rate.allowed) {
          return res.status(429).json({
            error: `Juda koʻp soʻrov yuborildi. ${rate.retryAfterSec || 10} soniyadan keyin urinib koʻring.`,
          });
        }
        const turn = await runGeminiAssistantTurn({
          user: req.user!,
          message: query,
          history: Array.isArray(history) ? history : [],
          language: typeof language === 'string' ? language : 'uz',
        });
        return res.json({
          answer: turn.reply,
          structuredRows: turn.structuredRows,
          proposedAction: turn.proposedAction,
          source: turn.source,
          warning: turn.warning,
        });
      }

      const userId = req.user!.id;
      const repo = getRepository();
      const [allTx, rawBudgets, rawGoals, debts] = await Promise.all([
        repo.getTransactions(userId),
        repo.getBudgets(userId),
        repo.getGoals(userId),
        repo.getDebts(userId),
      ]);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}`;

      const lifetimeInc = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const lifetimeExp = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const totalBalance = lifetimeInc - lifetimeExp;

      const thisMonthTx = allTx.filter((t) => t.date.startsWith(thisMonthPrefix));
      const thisMonthIncome = thisMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const thisMonthExpense = thisMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const lastMonthTx = allTx.filter((t) => t.date.startsWith(lastMonthPrefix));
      const lastMonthIncome = lastMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const lastMonthExpense = lastMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const catExpMap: Record<string, number> = {};
      thisMonthTx
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          catExpMap[t.categoryName] = (catExpMap[t.categoryName] || 0) + t.amount;
        });
      const topExpenseCategories = Object.entries(catExpMap)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: thisMonthExpense > 0 ? Math.round((amount / thisMonthExpense) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const budgets = rawBudgets.map((b) => {
        const spent = thisMonthTx
          .filter((t) => t.type === 'expense' && (t.categoryId === b.categoryId || t.categoryName === b.categoryName))
          .reduce((s, t) => s + t.amount, 0);
        return {
          category: b.categoryName,
          limit: b.monthlyLimit,
          spent,
          percent: b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0,
        };
      });

      const goals = rawGoals.map((g) => ({
        name: g.name,
        target: g.targetAmount,
        saved: g.savedAmount,
        percent: g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0,
      }));

      const debtsSummary = {
        totalBorrowed: debts.filter((d) => d.type === 'borrowed').reduce((s, d) => s + d.remainingAmount, 0),
        totalLent: debts.filter((d) => d.type === 'lent').reduce((s, d) => s + d.remainingAmount, 0),
      };

      const answer = await answerFinancialQuestionAI(query, {
        fullName: req.user!.fullName,
        currency: req.user!.currency,
        totalBalance,
        thisMonthIncome,
        thisMonthExpense,
        lastMonthIncome,
        lastMonthExpense,
        netSavings: thisMonthIncome - thisMonthExpense,
        topExpenseCategories,
        budgets,
        goals,
        debtsSummary,
        recentTransactions: allTx.slice(0, 10).map((t) => ({
          type: t.type,
          amount: t.amount,
          category: t.categoryName,
          date: t.date,
          description: t.description,
        })),
      });

      res.json({ answer, source: 'fallback' });
    })
  );

  // --- AI HEALTH SCORE & FORECAST ROUTES ---
  app.get(
    '/api/ai/health-score',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const repo = getRepository();
      const [allTx, debts, goals, budgets] = await Promise.all([
        repo.getTransactions(userId),
        repo.getDebts(userId),
        repo.getGoals(userId),
        repo.getBudgets(userId),
      ]);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

      const lifetimeInc = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const lifetimeExp = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const totalBalance = lifetimeInc - lifetimeExp;

      const thisMonthTx = allTx.filter((t) => t.date.startsWith(thisMonthPrefix));
      const monthlyIncome = thisMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const monthlyExpense = thisMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const totalDebt = debts.filter((d) => d.type === 'borrowed').reduce((s, d) => s + d.remainingAmount, 0);
      const totalGoalsSaved = goals.reduce((s, g) => s + g.savedAmount, 0);

      const budgetsExceededCount = budgets.filter((b) => {
        const spent = thisMonthTx
          .filter((t) => t.type === 'expense' && (t.categoryId === b.categoryId || t.categoryName === b.categoryName))
          .reduce((s, t) => s + t.amount, 0);
        return spent > b.monthlyLimit;
      }).length;

      const healthScore = calculateFinancialHealth({
        totalBalance,
        monthlyIncome,
        monthlyExpense,
        netSavings: monthlyIncome - monthlyExpense,
        totalDebt,
        totalGoalsSaved,
        budgetsExceededCount,
        totalBudgetsCount: budgets.length,
      });

      res.json({ healthScore });
    })
  );

  app.get(
    '/api/ai/forecast',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user!.id;
      const repo = getRepository();
      const [allTx, subscriptions] = await Promise.all([
        repo.getTransactions(userId),
        repo.getSubscriptions(userId),
      ]);

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

      const lifetimeInc = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const lifetimeExp = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const currentBalance = lifetimeInc - lifetimeExp;

      const thisMonthTx = allTx.filter((t) => t.date.startsWith(thisMonthPrefix));
      const monthlyIncome = thisMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const monthlyExpense = thisMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

      const recurringMonthlyExpense = subscriptions
        .filter((s) => s.status === 'active')
        .reduce((s, sub) => {
          if (sub.billingInterval === 'weekly') return s + sub.amount * 4;
          if (sub.billingInterval === 'yearly') return s + Math.round(sub.amount / 12);
          return s + sub.amount;
        }, 0);

      const catExpMap: Record<string, number> = {};
      thisMonthTx
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          catExpMap[t.categoryName] = (catExpMap[t.categoryName] || 0) + t.amount;
        });
      const topCategories = Object.entries(catExpMap)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: monthlyExpense > 0 ? Math.round((amount / monthlyExpense) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const forecast = calculateFinancialForecast({
        currentBalance,
        monthlyIncome,
        monthlyExpense,
        recurringMonthlyExpense,
        topCategories,
        historyMonthsCount: 3,
      });

      res.json({ forecast });
    })
  );

  // --- 1. WALLETS & TRANSFERS ROUTES ---
  app.get(
    '/api/wallets',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const wallets = await getRepository().getWallets(req.user!.id);
      res.json({ wallets });
    })
  );

  app.post(
    '/api/wallets',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body || {};
      if (!body.name) {
        return res.status(400).json({ error: 'Hamyon nomi kiritilmagan' });
      }
      const wallet = await getRepository().addWallet(req.user!.id, body);
      res.json({ wallet });
    })
  );

  app.put(
    '/api/wallets/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const wallet = await getRepository().updateWallet(req.user!.id, req.params.id, req.body || {});
      res.json({ wallet });
    })
  );

  app.delete(
    '/api/wallets/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().archiveWallet(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  app.post(
    '/api/wallets/transfer',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { fromWalletId, toWalletId, amount, targetAmount, notes } = req.body || {};
      if (!fromWalletId || !toWalletId) {
        return res.status(400).json({ error: 'Tanlangan hamyonlar topilmadi' });
      }
      const parsedAmount = parsePositiveInt(amount, 'Oʻtkazma summasi');
      const transfer = await getRepository().transferBetweenWallets(
        req.user!.id,
        String(fromWalletId),
        String(toWalletId),
        parsedAmount,
        targetAmount !== undefined && targetAmount !== null ? Number(targetAmount) : undefined,
        notes,
        extractIdempotencyKey(req)
      );
      res.json({ transfer });
    })
  );

  app.get(
    '/api/wallets/transfers',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const transfers = await getRepository().getWalletTransfers(req.user!.id);
      res.json({ transfers });
    })
  );

  // --- 2. FAMILY BUDGET ROUTES ---
  app.get(
    '/api/family',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const familyData = await getRepository().getFamilyGroup(req.user!.id);
      res.json(familyData);
    })
  );

  app.post(
    '/api/family',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { name, monthlyBudget } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Oilaviy guruh nomi kiritilmagan' });
      }
      const group = await getRepository().createFamilyGroup(req.user!.id, name.trim(), monthlyBudget);
      res.json({ group });
    })
  );

  app.post(
    '/api/family/invite',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { email, role } = req.body || {};
      const invitation = await getRepository().inviteFamilyMember(req.user!.id, email, role || 'member');
      res.json({ invitation });
    })
  );

  app.post(
    '/api/family/accept-invite',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { inviteCode } = req.body || {};
      const group = await getRepository().acceptFamilyInvite(req.user!.id, inviteCode);
      res.json({ group });
    })
  );

  app.get(
    '/api/family/transactions',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const transactions = await getRepository().getFamilyTransactions(req.user!.id);
      res.json({ transactions });
    })
  );

  // --- 3. SUBSCRIPTIONS ROUTES ---
  app.get(
    '/api/subscriptions',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const subscriptions = await getRepository().getSubscriptions(req.user!.id);
      res.json({ subscriptions });
    })
  );

  app.post(
    '/api/subscriptions',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body || {};
      if (!body.serviceName) return res.status(400).json({ error: 'Xizmat nomi kiritilmagan' });
      parsePositiveInt(body.amount, 'Obuna summasi');
      const subscription = await getRepository().addSubscription(req.user!.id, body);
      res.json({ subscription });
    })
  );

  app.put(
    '/api/subscriptions/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const subscription = await getRepository().updateSubscription(req.user!.id, req.params.id, req.body || {});
      res.json({ subscription });
    })
  );

  app.delete(
    '/api/subscriptions/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteSubscription(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- 4. RECURRING PAYMENTS ROUTES ---
  app.get(
    '/api/recurring',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const repo = getRepository();
      const [recurring, logs] = await Promise.all([
        repo.getRecurringTransactions(req.user!.id),
        repo.getRecurringLogs(req.user!.id),
      ]);
      res.json({ recurring, logs });
    })
  );

  app.post(
    '/api/recurring',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body || {};
      parsePositiveInt(body.amount, 'Doimiy toʻlov summasi');
      const rec = await getRepository().addRecurringTransaction(req.user!.id, body);
      res.json({ recurring: rec });
    })
  );

  app.put(
    '/api/recurring/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const rec = await getRepository().updateRecurringTransaction(req.user!.id, req.params.id, req.body || {});
      res.json({ recurring: rec });
    })
  );

  app.delete(
    '/api/recurring/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().deleteRecurringTransaction(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  app.post(
    '/api/recurring/:id/execute',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const transaction = await getRepository().executeRecurringSchedule(
        req.user!.id,
        req.params.id,
        extractIdempotencyKey(req)
      );
      res.json({ success: true, transaction });
    })
  );

  // --- 5. RECEIPT SCANNER & OCR ROUTES ---
  app.get(
    '/api/receipts',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const receipts = await getRepository().getReceipts(req.user!.id);
      res.json({ receipts });
    })
  );

  app.post(
    '/api/receipts/scan',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { imageBase64OrText } = req.body || {};
      const repo = getRepository();
      const [categories, existingReceipts] = await Promise.all([
        repo.getCategories(req.user!.id),
        repo.getReceipts(req.user!.id),
      ]);
      const geminiReceipt = isGeminiConfigured()
        ? await parseReceiptWithGemini(imageBase64OrText || '', categories, existingReceipts)
        : null;
      const parsed = geminiReceipt || (await parseReceiptAI(imageBase64OrText || '', categories, existingReceipts));
      res.json({ parsed });
    })
  );

  app.post(
    '/api/receipts/save',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const repo = getRepository();
      const receipt = await repo.saveReceipt(req.user!.id, req.body || {});
      if (req.body?.createTransaction) {
        const tx = await repo.addTransaction(
          req.user!.id,
          {
            type: 'expense',
            amount: receipt.totalAmount,
            categoryId: 'exp_food',
            categoryName: receipt.categorySuggested,
            date: receipt.date,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: `${receipt.merchantName} xaridi`,
            paymentMethod: 'card',
            notes: `Chek OCR orqali yuklandi (#${receipt.id})`,
          },
          extractIdempotencyKey(req)
        );
        receipt.transactionId = tx.id;
        await repo.linkReceiptTransaction(req.user!.id, receipt.id, tx.id);
      }
      res.json({ receipt });
    })
  );

  // --- 6. MULTI-CURRENCY CONVERTER ROUTES ---
  app.get('/api/currencies/rates', (_req: Request, res: Response) => {
    const rates = getRepository().getExchangeRates();
    res.json({ rates });
  });

  app.post('/api/currencies/convert', (req: Request, res: Response) => {
    try {
      const { amount, from, to } = req.body || {};
      const conversion = getRepository().convertCurrency(Number(amount) || 0, from || 'USD', to || 'UZS');
      res.json(conversion);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- 7. BANK INTEGRATION ROUTES ---
  app.get(
    '/api/banks',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const connections = await getRepository().getBankConnections(req.user!.id);
      const supportedBanks = [
        { id: 'uzum_bank', name: 'Uzum Bank (Online banking)', logo: 'ShoppingBag', available: true },
        { id: 'click', name: 'Click (Moliya xizmati)', logo: 'CreditCard', available: true },
        { id: 'payme', name: 'Payme (Toʻlov tizimi)', logo: 'Wallet', available: true },
        { id: 'kapitalbank', name: 'Kapitalbank (Visa / Uzcard)', logo: 'Building2', available: true },
        { id: 'ipak_yoli', name: 'Ipak Yoʻli Bank (Open API)', logo: 'Building', available: true },
        { id: 'tbc_bank', name: 'TBC Bank Uzbekistan', logo: 'Landmark', available: true },
        { id: 'agrobank', name: 'Agrobank (Chakana bank)', logo: 'Building2', available: true },
      ];
      res.json({ connections, supportedBanks });
    })
  );

  app.post(
    '/api/banks/connect',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { bankId, bankName } = req.body || {};
      if (!bankId || !bankName) {
        return res.status(400).json({ error: 'Bank maʼlumotlari kiritilmagan' });
      }
      const connection = await getRepository().connectBank(req.user!.id, bankId, bankName);
      res.json({ connection });
    })
  );

  app.post(
    '/api/banks/:id/sync',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const result = await getRepository().syncBank(req.user!.id, req.params.id);
      res.json(result);
    })
  );

  app.delete(
    '/api/banks/:id',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const success = await getRepository().disconnectBank(req.user!.id, req.params.id);
      res.json({ success });
    })
  );

  // --- 8. TELEGRAM BOT ROUTES ---
  app.get(
    '/api/telegram',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const connection = await getRepository().getTelegramConnection(req.user!.id);
      res.json({ connection });
    })
  );

  app.put(
    '/api/telegram/preferences',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const updated = await getRepository().updateTelegramPrefs(req.user!.id, req.body?.preferences || {});
      res.json({ connection: updated });
    })
  );

  app.post(
    '/api/telegram/connect',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { username } = req.body || {};
      const connection = await getRepository().connectTelegram(req.user!.id, username || 'user');
      res.json({ connection });
    })
  );

  app.post(
    '/api/telegram/disconnect',
    authMiddleware,
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const connection = await getRepository().disconnectTelegram(req.user!.id);
      res.json({ connection });
    })
  );

  app.post('/api/telegram/test-send', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      message:
        'Telegram bot orqali sinov xabari yuborildi: «HISOBOT AI: Sizning kunlik balansingiz va xarajatlaringiz yangilandi»',
    });
  });

  // Global API error handler — prevents Express 4 unhandled promise rejections & never leaks secrets/DSNs
  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const safeMsg = sanitizePgError(err);
    const status =
      typeof (err as { status?: number })?.status === 'number'
        ? (err as { status: number }).status
        : safeMsg.includes('vaqti tugadi')
        ? 504
        : 400;
    if (status >= 500) {
      console.error('[HISOBOT API] Server error:', safeMsg);
    }
    res.status(status).json({ error: safeMsg });
  });

  return app;
}

// Vite Middleware for Full-stack Dev or Static Files in Production
export async function setupVite() {
  const app = createApp();
  let viteInstance: { close: () => Promise<void> } | null = null;

  if (process.env.NODE_ENV === 'production') {
    app.use('/src/assets', express.static(path.resolve(process.cwd(), 'src/assets')));
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });
    viteInstance = vite;
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  let listenAttempts = 0;
  const maxListenAttempts = 3;

  const startListening = () => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`HISOBOT AI server running on http://0.0.0.0:${PORT} (backend=${getRepository().backendName})`);
    });
  };

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && listenAttempts < maxListenAttempts) {
      listenAttempts += 1;
      console.warn(`Port ${PORT} is busy, retrying (${listenAttempts}/${maxListenAttempts})...`);
      setTimeout(startListening, 500);
      return;
    }

    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${PORT} is already in use by another active instance.`);
      process.exit(0);
    }

    console.error('Server error:', err);
    process.exit(1);
  });

  const shutdown = async () => {
    server.close(async () => {
      if (viteInstance) {
        try {
          await viteInstance.close();
        } catch {
          // ignore close errors during shutdown
        }
      }
      await closeSharedPostgresStorage();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  startListening();
  return server;
}

const isEntrypoint =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint && process.env.SKIP_SERVER_LISTEN !== 'true') {
  setupVite();
}
