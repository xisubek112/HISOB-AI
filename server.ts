/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import dotenv from 'dotenv';
import { db } from './src/server/db.ts';
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

const app = express();
const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '6mb' }));

// Auth Middleware: extracts user from Bearer Token or demo fallback
interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    const user = db.getUserByToken(token);
    if (user) {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Barcha maydonlarni toʻldiring' });
    }
    const result = db.registerUser(email, password, fullName);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Roʻyxatdan oʻtishda xatolik yuz berdi' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Elektron pochta va parolni kiriting' });
    }
    const result = db.loginUser(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Kirishda xatolik yuz berdi' });
  }
});

app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (token) {
    db.logout(token);
  }
  res.json({ success: true });
});

app.post('/api/auth/logout-all', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const clearedSessions = db.logoutAllDevices(req.user!.id);
  res.json({ success: true, clearedSessions });
});

app.post('/api/auth/verify-password', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Parolni kiriting' });
  }
  const valid = db.verifyUserPassword(req.user!.id, password);
  if (!valid) {
    return res.status(401).json({ error: 'Parol notoʻgʻri' });
  }
  res.json({ valid: true });
});

app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Elektron pochtani kiriting' });
  const message = db.forgotPassword(email);
  res.json({ message });
});

app.post('/api/auth/reset-password', (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Barcha maydonlarni kiriting' });
  }
  try {
    db.resetPasswordWithCode(email, code, newPassword);
    res.json({ success: true, message: 'Parol muvaffaqiyatli yangilandi' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/auth/profile', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateProfile(req.user!.id, req.body);
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/user/upgrade-premium', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { plan, durationMonths } = req.body;
    const user = db.upgradeToPremium(req.user!.id, plan || 'pro', Number(durationMonths) || 1);
    res.json({ user, message: 'HISOBOT AI Premium muvaffaqiyatli faollashtirildi!' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/auth/change-password', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { oldPassword, newPassword } = req.body;
    db.changePassword(req.user!.id, oldPassword, newPassword);
    res.json({ success: true, message: 'Parol muvaffaqiyatli oʻzgartirildi' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- TRANSACTIONS ROUTES ---
app.get('/api/transactions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  let list = db.getTransactions(req.user!.id);
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
});

app.post('/api/transactions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, amount, categoryId, categoryName, date, time, description, paymentMethod, notes } = req.body;
    if (!type || !amount || !categoryName || !date) {
      return res.status(400).json({ error: 'Majburiy maydonlar toʻldirilmagan' });
    }

    const tx = db.addTransaction(req.user!.id, {
      type,
      amount: Math.round(Number(amount)),
      categoryId: categoryId || 'cat_custom',
      categoryName,
      date,
      time: time || '12:00',
      description: description || categoryName,
      paymentMethod: paymentMethod || 'card',
      notes: notes || '',
    });

    res.json({ transaction: tx });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/transactions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateTransaction(req.user!.id, req.params.id, req.body);
    res.json({ transaction: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteTransaction(req.user!.id, req.params.id);
  res.json({ success });
});

// --- CATEGORIES ROUTES ---
app.get('/api/categories', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const categories = db.getCategories(req.user!.id);
  res.json({ categories });
});

app.post('/api/categories', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, icon, color } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'Nomi va turi talab qilinadi' });
    const cat = db.addCategory(req.user!.id, { name, type, icon, color });
    res.json({ category: cat });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteCategory(req.user!.id, req.params.id);
  res.json({ success });
});

// --- BUDGETS ROUTES ---
app.get('/api/budgets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const budgets = db.getBudgets(req.user!.id);
  // Calculate current month's spent for each budget
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const transactions = db.getTransactions(req.user!.id);

  const enriched = budgets.map((b) => {
    const spent = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.date.startsWith(b.month || currentMonth) &&
          (t.categoryId === b.categoryId || t.categoryName === b.categoryName)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const percentage = Math.round((spent / b.monthlyLimit) * 100);
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
});

app.post('/api/budgets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const budget = db.setBudget(req.user!.id, req.body);
    res.json({ budget });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/budgets/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteBudget(req.user!.id, req.params.id);
  res.json({ success });
});

// --- FINANCIAL GOALS ROUTES ---
app.get('/api/goals', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const goals = db.getGoals(req.user!.id);
  res.json({ goals });
});

app.post('/api/goals', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const goal = db.addGoal(req.user!.id, req.body);
    res.json({ goal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/goals/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateGoal(req.user!.id, req.params.id, req.body);
    res.json({ goal: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/goals/:id/deposit', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amount } = req.body;
    const goal = db.depositToGoal(req.user!.id, req.params.id, amount);
    res.json({ goal });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/goals/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteGoal(req.user!.id, req.params.id);
  res.json({ success });
});

// --- DEBTS ROUTES ---
app.get('/api/debts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const debts = db.getDebts(req.user!.id);
  res.json({ debts });
});

app.post('/api/debts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const debt = db.addDebt(req.user!.id, req.body);
    res.json({ debt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/debts/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = db.updateDebt(req.user!.id, req.params.id, req.body);
    res.json({ debt: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/debts/:id/pay', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { payment } = req.body;
    const debt = db.payDebt(req.user!.id, req.params.id, payment);
    res.json({ debt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/debts/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteDebt(req.user!.id, req.params.id);
  res.json({ success });
});

// --- NOTIFICATIONS ROUTES ---
app.get('/api/notifications', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const notifications = db.getNotifications(req.user!.id);
  res.json({ notifications });
});

app.put('/api/notifications/:id/read', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  db.markNotificationRead(req.user!.id, req.params.id);
  res.json({ success: true });
});

app.put('/api/notifications/read-all', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  db.markAllNotificationsRead(req.user!.id);
  res.json({ success: true });
});

// --- FINANCIAL SUMMARY & REPORTS ROUTE ---
app.get('/api/reports/summary', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const allTx = db.getTransactions(userId);
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
    // Default: this month
    start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end = formatYMD(lastDay);
  }

  // Filter transactions
  const filtered = allTx.filter((t) => t.date >= start && t.date <= end);

  // Overall totals across entire history for Total Balance
  const totalLifetimeIncome = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalLifetimeExpense = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = totalLifetimeIncome - totalLifetimeExpense;

  // Period specific totals
  const totalIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Category breakdown for period expenses
  const expenseTx = filtered.filter((t) => t.type === 'expense');
  const catMap: Record<string, { amount: number; count: number; color: string }> = {};

  const categories = db.getCategories(userId);
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

  // Monthly comparison (last 6 months)
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

  // Daily breakdown within the period
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
});

// --- AI ASSISTANT ROUTES ---
app.get('/api/ai/status', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    configured: isGeminiConfigured(),
    model: GEMINI_MODEL,
  });
});

app.post('/api/ai/assistant', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
});

app.post('/api/ai/execute-action', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirmed, action } = req.body as { confirmed?: boolean; action?: AIProposedAction };
    if (confirmed !== true) {
      return res.status(400).json({ error: 'Amalni bajarish uchun foydalanuvchi tasdigʻi talab qilinadi' });
    }
    if (!action || typeof action !== 'object' || !action.actionType || !action.payload) {
      return res.status(400).json({ error: 'Amal maʼlumotlari notoʻgʻri' });
    }

    const userId = req.user!.id;

    if (action.actionType === 'transaction') {
      const p = action.payload;
      const amount = Math.round(Number(p.amount));
      if (!p.type || amount <= 0 || !p.categoryName || !p.date) {
        return res.status(400).json({ error: 'Tranzaksiya maʼlumotlari toʻliq emas' });
      }
      const categories = db.getCategories(userId);
      const matchedCat = categories.find(
        (c) => c.id === p.categoryId || c.name.toLowerCase() === p.categoryName.toLowerCase()
      );
      const created = db.addTransaction(userId, {
        type: p.type === 'income' ? 'income' : 'expense',
        amount,
        categoryId: matchedCat?.id || p.categoryId || 'cat_custom',
        categoryName: matchedCat?.name || p.categoryName,
        date: p.date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        description: p.description || matchedCat?.name || p.categoryName,
        paymentMethod: p.paymentMethod || 'card',
        notes: 'HISOBOT AI yordamchisi orqali tasdiqlab qoʻshildi',
      });
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
      const categories = db.getCategories(userId);
      const matchedCat = categories.find(
        (c) => c.id === p.categoryId || c.name.toLowerCase() === p.categoryName.toLowerCase()
      );
      const month = p.month || new Date().toISOString().slice(0, 7);
      const created = db.setBudget(userId, {
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
      const created = db.addGoal(userId, {
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
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Amalni bajarishda xatolik yuz berdi' });
  }
});

app.post('/api/ai/parse-transaction', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, language } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Matn kiritilmagan' });
    }
    const categories = db.getCategories(req.user!.id);
    const geminiParsed = isGeminiConfigured()
      ? await parseTransactionWithGemini(text, categories, typeof language === 'string' ? language : 'uz')
      : null;
    const parsed = geminiParsed || (await parseUzbekTransactionAI(text, categories, language));
    res.json({ parsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI tahlilida xatolik yuz berdi' });
  }
});

app.post('/api/ai/chat', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { query, history, language } = req.body;
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
    const allTx = db.getTransactions(userId);
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
    thisMonthTx.filter((t) => t.type === 'expense').forEach((t) => {
      catExpMap[t.categoryName] = (catExpMap[t.categoryName] || 0) + t.amount;
    });
    const topExpenseCategories = Object.entries(catExpMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: thisMonthExpense > 0 ? Math.round((amount / thisMonthExpense) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const budgets = db.getBudgets(userId).map((b) => {
      const spent = thisMonthTx
        .filter((t) => t.type === 'expense' && (t.categoryId === b.categoryId || t.categoryName === b.categoryName))
        .reduce((s, t) => s + t.amount, 0);
      return {
        category: b.categoryName,
        limit: b.monthlyLimit,
        spent,
        percent: Math.round((spent / b.monthlyLimit) * 100),
      };
    });

    const goals = db.getGoals(userId).map((g) => ({
      name: g.name,
      target: g.targetAmount,
      saved: g.savedAmount,
      percent: Math.round((g.savedAmount / g.targetAmount) * 100),
    }));

    const debts = db.getDebts(userId);
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Xatolik yuz berdi' });
  }
});

// --- AI HEALTH SCORE & FORECAST ROUTES ---
app.get('/api/ai/health-score', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const allTx = db.getTransactions(userId);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const lifetimeInc = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lifetimeExp = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = lifetimeInc - lifetimeExp;

  const thisMonthTx = allTx.filter((t) => t.date.startsWith(thisMonthPrefix));
  const monthlyIncome = thisMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = thisMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const debts = db.getDebts(userId);
  const totalDebt = debts.filter((d) => d.type === 'borrowed').reduce((s, d) => s + d.remainingAmount, 0);

  const goals = db.getGoals(userId);
  const totalGoalsSaved = goals.reduce((s, g) => s + g.savedAmount, 0);

  const budgets = db.getBudgets(userId);
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
});

app.get('/api/ai/forecast', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const allTx = db.getTransactions(userId);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const lifetimeInc = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lifetimeExp = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const currentBalance = lifetimeInc - lifetimeExp;

  const thisMonthTx = allTx.filter((t) => t.date.startsWith(thisMonthPrefix));
  const monthlyIncome = thisMonthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthlyExpense = thisMonthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const subscriptions = db.getSubscriptions(userId);
  const recurringMonthlyExpense = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((s, sub) => {
      if (sub.billingInterval === 'weekly') return s + sub.amount * 4;
      if (sub.billingInterval === 'yearly') return s + Math.round(sub.amount / 12);
      return s + sub.amount;
    }, 0);

  const catExpMap: Record<string, number> = {};
  thisMonthTx.filter((t) => t.type === 'expense').forEach((t) => {
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
});

// --- 1. WALLETS & TRANSFERS ROUTES ---
app.get('/api/wallets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const wallets = db.getWallets(req.user!.id);
  res.json({ wallets });
});

app.post('/api/wallets', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const wallet = db.addWallet(req.user!.id, req.body);
    res.json({ wallet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/wallets/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const wallet = db.updateWallet(req.user!.id, req.params.id, req.body);
    res.json({ wallet });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/wallets/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.archiveWallet(req.user!.id, req.params.id);
  res.json({ success });
});

app.post('/api/wallets/transfer', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fromWalletId, toWalletId, amount, targetAmount, notes } = req.body;
    const transfer = db.transferBetweenWallets(
      req.user!.id,
      fromWalletId,
      toWalletId,
      amount,
      targetAmount,
      notes
    );
    res.json({ transfer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/wallets/transfers', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const transfers = db.getWalletTransfers(req.user!.id);
  res.json({ transfers });
});

// --- 2. FAMILY BUDGET ROUTES ---
app.get('/api/family', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const familyData = db.getFamilyGroup(req.user!.id);
  res.json(familyData);
});

app.post('/api/family', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, monthlyBudget } = req.body;
    const group = db.createFamilyGroup(req.user!.id, name, monthlyBudget);
    res.json({ group });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/family/invite', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, role } = req.body;
    const invitation = db.inviteFamilyMember(req.user!.id, email, role || 'member');
    res.json({ invitation });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/family/accept-invite', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const group = db.acceptFamilyInvite(req.user!.id, inviteCode);
    res.json({ group });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/family/transactions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const transactions = db.getFamilyTransactions(req.user!.id);
  res.json({ transactions });
});

// --- 3. SUBSCRIPTIONS ROUTES ---
app.get('/api/subscriptions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const subscriptions = db.getSubscriptions(req.user!.id);
  res.json({ subscriptions });
});

app.post('/api/subscriptions', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscription = db.addSubscription(req.user!.id, req.body);
    res.json({ subscription });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/subscriptions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const subscription = db.updateSubscription(req.user!.id, req.params.id, req.body);
    res.json({ subscription });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/subscriptions/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteSubscription(req.user!.id, req.params.id);
  res.json({ success });
});

// --- 4. RECURRING PAYMENTS ROUTES ---
app.get('/api/recurring', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const recurring = db.getRecurringTransactions(req.user!.id);
  const logs = db.getRecurringLogs(req.user!.id);
  res.json({ recurring, logs });
});

app.post('/api/recurring', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rec = db.addRecurringTransaction(req.user!.id, req.body);
    res.json({ recurring: rec });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/recurring/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const rec = db.updateRecurringTransaction(req.user!.id, req.params.id, req.body);
    res.json({ recurring: rec });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/recurring/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteRecurringTransaction(req.user!.id, req.params.id);
  res.json({ success });
});

app.post('/api/recurring/:id/execute', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const transaction = db.executeRecurringSchedule(req.user!.id, req.params.id);
    res.json({ success: true, transaction });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- 5. RECEIPT SCANNER & OCR ROUTES ---
app.get('/api/receipts', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const receipts = db.getReceipts(req.user!.id);
  res.json({ receipts });
});

app.post('/api/receipts/scan', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { imageBase64OrText } = req.body;
    const categories = db.getCategories(req.user!.id);
    const existingReceipts = db.getReceipts(req.user!.id);
    const geminiReceipt = isGeminiConfigured()
      ? await parseReceiptWithGemini(imageBase64OrText || '', categories, existingReceipts)
      : null;
    const parsed = geminiReceipt || (await parseReceiptAI(imageBase64OrText || '', categories, existingReceipts));
    res.json({ parsed });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chekni skanerlashda xatolik' });
  }
});

app.post('/api/receipts/save', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const receipt = db.saveReceipt(req.user!.id, req.body);
    // Optionally create transaction if requested
    if (req.body.createTransaction) {
      const tx = db.addTransaction(req.user!.id, {
        type: 'expense',
        amount: receipt.totalAmount,
        categoryId: 'exp_food',
        categoryName: receipt.categorySuggested,
        date: receipt.date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        description: `${receipt.merchantName} xaridi`,
        paymentMethod: 'card',
        notes: `Chek OCR orqali yuklandi (#${receipt.id})`,
      });
      receipt.transactionId = tx.id;
    }
    res.json({ receipt });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- 6. MULTI-CURRENCY CONVERTER ROUTES ---
app.get('/api/currencies/rates', (_req: Request, res: Response) => {
  const rates = db.getExchangeRates();
  res.json({ rates });
});

app.post('/api/currencies/convert', (req: Request, res: Response) => {
  try {
    const { amount, from, to } = req.body;
    const conversion = db.convertCurrency(Number(amount) || 0, from || 'USD', to || 'UZS');
    res.json(conversion);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- 7. BANK INTEGRATION ROUTES ---
app.get('/api/banks', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const connections = db.getBankConnections(req.user!.id);
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
});

app.post('/api/banks/connect', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bankId, bankName } = req.body;
    const connection = db.connectBank(req.user!.id, bankId, bankName);
    res.json({ connection });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/banks/:id/sync', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = db.syncBank(req.user!.id, req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/banks/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const success = db.disconnectBank(req.user!.id, req.params.id);
  res.json({ success });
});

// --- 8. TELEGRAM BOT ROUTES ---
app.get('/api/telegram', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const connection = db.getTelegramConnection(req.user!.id);
  res.json({ connection });
});

app.put('/api/telegram/preferences', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateTelegramPrefs(req.user!.id, req.body.preferences);
  res.json({ connection: updated });
});

app.post('/api/telegram/connect', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username } = req.body;
    const connection = db.connectTelegram(req.user!.id, username || 'user');
    res.json({ connection });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/telegram/disconnect', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  const connection = db.disconnectTelegram(req.user!.id);
  res.json({ connection });
});

app.post('/api/telegram/test-send', authMiddleware, (_req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Telegram bot orqali sinov xabari yuborildi: «HISOBOT AI: Sizning kunlik balansingiz va xarajatlaringiz yangilandi»',
  });
});

// Vite Middleware for Full-stack Dev or Static Files in Production
async function setupVite() {
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
      console.log(`HISOBOT AI server running on http://0.0.0.0:${PORT}`);
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
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  startListening();
}

setupVite();
