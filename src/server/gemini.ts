/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  Type,
  ThinkingLevel,
  type FunctionDeclaration,
  type Content,
  type Part,
} from '@google/genai';
import { getRepository } from './async-repository.ts';
import {
  answerFinancialQuestionAI,
  calculateFinancialForecast,
  calculateFinancialHealth,
  parseUzbekTransactionAI,
} from './ai.ts';
import type {
  AIParsedTransaction,
  AIProposedAction,
  Category,
  ScannedReceipt,
  UserProfile,
} from '../types/finance.ts';
import { getTodayDateString } from '../utils/formatters.ts';

export const GEMINI_MODEL = 'gemini-3.8-flash';

const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const userRequestTimestamps = new Map<string, number[]>();

export interface GeminiHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantStructuredRow {
  label: string;
  value: string;
  tone?: 'emerald' | 'rose' | 'teal' | 'amber';
}

export interface AssistantTurnResult {
  reply: string;
  structuredRows?: AssistantStructuredRow[];
  proposedAction?: AIProposedAction;
  source: 'gemini' | 'fallback';
  warning?: string;
}

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim().length > 10);
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function checkUserRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const existing = (userRequestTimestamps.get(userId) || []).filter((ts) => ts > cutoff);

  if (existing.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = existing[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
    userRequestTimestamps.set(userId, existing);
    return { allowed: false, retryAfterSec };
  }

  existing.push(now);
  userRequestTimestamps.set(userId, existing);
  return { allowed: true };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function detectLanguage(text: string, hint: string = 'uz'): 'uz' | 'ru' | 'en' {
  const sample = text.trim();
  if (!sample) {
    if (hint === 'ru' || hint === 'en') return hint;
    return 'uz';
  }

  // Cyrillic characters indicate Russian (or Uzbek Cyrillic; default Russian unless clearly Uzbek Cyrillic words)
  const cyrillicMatches = sample.match(/[\u0400-\u04FF]/g)?.length || 0;
  if (cyrillicMatches >= 2) {
    const lower = sample.toLowerCase();
    const uzCyrillicMarkers = ['сўм', 'қил', 'қилиб', 'қанча', 'бугун', 'кеча', 'маош', 'харажат', 'кирим', 'чиқим'];
    if (uzCyrillicMarkers.some((m) => lower.includes(m))) {
      return 'uz';
    }
    return 'ru';
  }

  const lower = sample.toLowerCase();
  const enWords = [
    'how much',
    'what is',
    'my balance',
    'my expenses',
    'my income',
    'budget',
    'forecast',
    'spent',
    'earned',
    'hello',
    'hi ',
    'please',
    'analyze',
    'report',
    'save money',
    'goal',
  ];
  const uzWords = [
    'salom',
    'qancha',
    'bugun',
    'kecha',
    'sarfladim',
    'oldim',
    'xarajat',
    'daromad',
    'balans',
    'tahlil',
    'budjet',
    'maqsad',
    'prognoz',
    'qarz',
    'pul',
    'rahmat',
    'yordam',
    "so'm",
    'soʻm',
    'ming',
  ];

  const enScore = enWords.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
  const uzScore = uzWords.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);

  if (enScore > uzScore && enScore > 0) return 'en';
  if (uzScore > 0) return 'uz';
  if (hint === 'ru' || hint === 'en') return hint;
  return 'uz';
}

function fmtMoney(amount: number, lang: 'uz' | 'ru' | 'en'): string {
  const num = new Intl.NumberFormat('uz-UZ').format(Math.round(amount));
  if (lang === 'ru') return `${num} сум`;
  if (lang === 'en') return `${num} UZS`;
  return `${num} soʻm`;
}

function sanitizeErrorForLog(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, '[REDACTED_KEY]')
    .replace(/AQ\.[0-9A-Za-z_-]{15,}/g, '[REDACTED_KEY]')
    .slice(0, 220);
}

async function buildUserFinancialContext(userId: string) {
  const repo = getRepository();
  const [allTx, categories, wallets, goals, debts, subscriptions, rawBudgets] = await Promise.all([
    repo.getTransactions(userId),
    repo.getCategories(userId),
    repo.getWallets(userId),
    repo.getGoals(userId),
    repo.getDebts(userId),
    repo.getSubscriptions(userId),
    repo.getBudgets(userId),
  ]);

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = getTodayDateString();
  const thisMonthPrefix = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}`;

  const lifetimeIncome = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lifetimeExpense = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = lifetimeIncome - lifetimeExpense;

  const todayTx = allTx.filter((t) => t.date === todayStr);
  const todayIncome = todayTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const todayExpense = todayTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

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
      id: b.id,
      category: b.categoryName,
      limit: b.monthlyLimit,
      spent,
      remaining: Math.max(0, b.monthlyLimit - spent),
      percent: b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 100) : 0,
    };
  });

  const goalsMapped = goals.map((g) => ({
    name: g.name,
    target: g.targetAmount,
    saved: g.savedAmount,
    percent: g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0,
    deadline: g.deadline,
  }));

  const debtsSummary = {
    totalBorrowed: debts.filter((d) => d.type === 'borrowed').reduce((s, d) => s + d.remainingAmount, 0),
    totalLent: debts.filter((d) => d.type === 'lent').reduce((s, d) => s + d.remainingAmount, 0),
    items: debts.map((d) => ({
      type: d.type,
      personName: d.personName,
      remainingAmount: d.remainingAmount,
      dueDate: d.dueDate,
      status: d.status,
    })),
  };

  const recurringMonthlyExpense = subscriptions
    .filter((s) => s.status === 'active')
    .reduce((s, sub) => {
      if (sub.billingInterval === 'weekly') return s + sub.amount * 4;
      if (sub.billingInterval === 'yearly') return s + Math.round(sub.amount / 12);
      return s + sub.amount;
    }, 0);

  const budgetsExceededCount = budgets.filter((b) => b.spent > b.limit).length;
  const totalGoalsSaved = goals.reduce((s, g) => s + g.savedAmount, 0);

  const healthScore = calculateFinancialHealth({
    totalBalance,
    monthlyIncome: thisMonthIncome,
    monthlyExpense: thisMonthExpense,
    netSavings: thisMonthIncome - thisMonthExpense,
    totalDebt: debtsSummary.totalBorrowed,
    totalGoalsSaved,
    budgetsExceededCount,
    totalBudgetsCount: budgets.length,
  });

  const forecast = calculateFinancialForecast({
    currentBalance: totalBalance,
    monthlyIncome: thisMonthIncome,
    monthlyExpense: thisMonthExpense,
    recurringMonthlyExpense,
    topCategories: topExpenseCategories,
    historyMonthsCount: 3,
  });

  return {
    todayStr,
    thisMonthPrefix,
    totalBalance,
    todayIncome,
    todayExpense,
    thisMonthIncome,
    thisMonthExpense,
    lastMonthIncome,
    lastMonthExpense,
    netSavings: thisMonthIncome - thisMonthExpense,
    topExpenseCategories,
    budgets,
    goals: goalsMapped,
    debtsSummary,
    wallets: wallets.map((w) => ({ name: w.name, balance: w.balance, currency: w.currency, type: w.type })),
    subscriptions: subscriptions
      .filter((s) => s.status === 'active')
      .map((s) => ({ serviceName: s.serviceName, amount: s.amount, billingInterval: s.billingInterval, nextPaymentDate: s.nextPaymentDate })),
    recentTransactions: allTx.slice(0, 12).map((t) => ({
      type: t.type,
      amount: t.amount,
      category: t.categoryName,
      date: t.date,
      description: t.description,
      paymentMethod: t.paymentMethod,
    })),
    categories,
    healthScore,
    forecast,
  };
}

function matchCategory(categories: Category[], rawName: string, type: 'income' | 'expense'): Category | undefined {
  const q = rawName.toLowerCase().trim();
  const sameType = categories.filter((c) => c.type === type);

  const exact = sameType.find((c) => c.name.toLowerCase() === q);
  if (exact) return exact;

  const partial = sameType.find(
    (c) => c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())
  );
  if (partial) return partial;

  // Heuristic keyword mapping across UZ/RU/EN
  const aliasMap: Record<string, string[]> = {
    'Oziq-ovqat va kafe': ['oziq', 'ovqat', 'tushlik', 'nonushta', 'kechki', 'kafe', 'restoran', 'choy', 'kofe', 'food', 'eat', 'еда', 'обед', 'кафе', 'продукт'],
    'Transport va yoqilgʻi': ['taksi', 'transport', 'benzin', 'metro', 'avtobus', 'yoqilg', 'taxi', 'fuel', 'такси', 'транспорт', 'бензин'],
    'Kommunal toʻlovlar': ['kommunal', 'svet', 'elektr', 'gaz', 'suv', 'internet', 'telefon', 'utilities', 'свет', 'газ', 'интернет', 'коммунал'],
    'Xaridlar va kiyim': ['kiyim', 'xarid', 'bozor', 'shopping', 'clothes', 'одежда', 'покупк'],
    'Uy-joy va ijara': ['ijara', 'kvartira', 'uy', 'rent', 'аренда', 'квартира'],
    'Salomatlik va dori': ['dori', 'apteka', 'shifokor', 'doktor', 'salomat', 'health', 'medicine', 'лекар', 'аптек', 'врач'],
    'Taʼlim va kurslar': ['kurs', 'taʼlim', 'talim', 'kitob', 'oʻqish', 'course', 'education', 'курс', 'обучен', 'книг'],
    'Hordiq va koʻngilochar': ['kino', 'oʻyin', 'hordiq', 'sayohat', 'obuna', 'cinema', 'entertainment', 'кино', 'отдых'],
    'Oylik maosh': ['oylik', 'maosh', 'ish haqi', 'salary', 'зарплат'],
    'Frilans': ['frilans', 'loyiha', 'buyurtma', 'freelance', 'фриланс'],
    'Biznes': ['biznes', 'savdo', 'foyda', 'business', 'бизнес'],
    'Sovgʻalar': ['sovg', 'bonus', 'mukofot', 'gift', 'подарок'],
    'Investitsiyalar': ['invest', 'dividend', 'foiz', 'инвест'],
  };

  for (const [targetName, keywords] of Object.entries(aliasMap)) {
    if (keywords.some((kw) => q.includes(kw))) {
      const found = sameType.find((c) => c.name === targetName);
      if (found) return found;
    }
  }

  return sameType[sameType.length - 1];
}

async function buildReportForPeriod(
  userId: string,
  period: 'today' | 'week' | 'month' | 'year',
  focus: string | undefined,
  lang: 'uz' | 'ru' | 'en'
) {
  const [ctx, allTx] = await Promise.all([
    buildUserFinancialContext(userId),
    getRepository().getTransactions(userId),
  ]);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  let start = '';
  const end = formatYMD(now);
  if (period === 'today') {
    start = end;
  } else if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    start = formatYMD(d);
  } else if (period === 'year') {
    start = `${now.getFullYear()}-01-01`;
  } else {
    start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  }

  const filtered = allTx.filter((t) => t.date >= start && t.date <= end);
  const periodIncome = filtered.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const periodExpense = filtered.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = periodIncome - periodExpense;

  const catMap: Record<string, number> = {};
  filtered
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      catMap[t.categoryName] = (catMap[t.categoryName] || 0) + t.amount;
    });
  const topCategories = Object.entries(catMap)
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: periodExpense > 0 ? Math.round((amount / periodExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const labels = {
    uz: {
      income: 'Daromad',
      expense: 'Xarajat',
      net: 'Sof qoldiq',
      balance: 'Umumiy balans',
      health: 'Moliyaviy salomatlik',
      forecastEnd: 'Oy yakuni prognozi',
      debtBorrowed: 'Qarz (olingan)',
      debtLent: 'Berilgan qarz',
    },
    ru: {
      income: 'Доход',
      expense: 'Расход',
      net: 'Чистый остаток',
      balance: 'Общий баланс',
      health: 'Финансовое здоровье',
      forecastEnd: 'Прогноз на конец месяца',
      debtBorrowed: 'Взято в долг',
      debtLent: 'Дано в долг',
    },
    en: {
      income: 'Income',
      expense: 'Expenses',
      net: 'Net balance',
      balance: 'Total balance',
      health: 'Financial health',
      forecastEnd: 'Month-end forecast',
      debtBorrowed: 'Borrowed debt',
      debtLent: 'Lent money',
    },
  }[lang];

  const structuredRows: AssistantStructuredRow[] = [
    { label: labels.balance, value: fmtMoney(ctx.totalBalance, lang), tone: 'emerald' },
    { label: labels.income, value: `+${fmtMoney(periodIncome, lang)}`, tone: 'emerald' },
    { label: labels.expense, value: `-${fmtMoney(periodExpense, lang)}`, tone: 'rose' },
    { label: labels.net, value: fmtMoney(net, lang), tone: net >= 0 ? 'teal' : 'rose' },
  ];

  if (focus === 'forecast') {
    structuredRows.push({
      label: labels.forecastEnd,
      value: fmtMoney(ctx.forecast.monthEndExpectedBalance, lang),
      tone: 'amber',
    });
  } else if (focus === 'debts') {
    structuredRows.push({
      label: labels.debtBorrowed,
      value: fmtMoney(ctx.debtsSummary.totalBorrowed, lang),
      tone: 'rose',
    });
    structuredRows.push({
      label: labels.debtLent,
      value: fmtMoney(ctx.debtsSummary.totalLent, lang),
      tone: 'teal',
    });
  } else {
    structuredRows.push({
      label: labels.health,
      value: `${ctx.healthScore.score}/100 (${ctx.healthScore.grade})`,
      tone: ctx.healthScore.score >= 70 ? 'emerald' : 'amber',
    });
  }

  return {
    structuredRows,
    reportData: {
      period,
      startDate: start,
      endDate: end,
      totalBalance: ctx.totalBalance,
      periodIncome,
      periodExpense,
      netSavings: net,
      topCategories,
      budgets: ctx.budgets,
      goals: ctx.goals,
      debts: ctx.debtsSummary,
      healthScore: ctx.healthScore,
      forecast: ctx.forecast,
      activeSubscriptionsCount: ctx.subscriptions.length,
    },
  };
}

const assistantToolDeclarations: FunctionDeclaration[] = [
  {
    name: 'get_financial_report',
    description:
      "Retrieve an accurate period-specific report of the authenticated user's real income, expenses, budgets, goals, debts, and forecast.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "Period to analyze: 'today', 'week', 'month', or 'year'.",
        },
        focus: {
          type: Type.STRING,
          description:
            "Optional focus area: 'overview', 'categories', 'budgets', 'goals', 'debts', 'forecast', or 'savings'.",
        },
      },
      required: ['period'],
    },
  },
  {
    name: 'propose_transaction',
    description:
      'Propose adding a new income or expense transaction when the user states they spent, paid, received, or earned money. NEVER saves directly; returns a confirmation card for user approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          description: "'income' or 'expense'",
        },
        amount: {
          type: Type.NUMBER,
          description: 'Numeric amount in UZS (integer, e.g. 50000 for 50 ming).',
        },
        categoryName: {
          type: Type.STRING,
          description: 'Matching category name in Uzbek or user language.',
        },
        date: {
          type: Type.STRING,
          description: 'YYYY-MM-DD date string (defaults to today if omitted).',
        },
        description: {
          type: Type.STRING,
          description: 'Short clear description of the transaction.',
        },
        paymentMethod: {
          type: Type.STRING,
          description: "Payment method: 'card', 'cash', 'bank', or 'other'.",
        },
      },
      required: ['type', 'amount', 'categoryName', 'description'],
    },
  },
  {
    name: 'propose_budget',
    description:
      'Propose creating or updating a monthly category budget limit for user confirmation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryName: {
          type: Type.STRING,
          description: 'Expense category name.',
        },
        monthlyLimit: {
          type: Type.NUMBER,
          description: 'Monthly limit in UZS.',
        },
        alertThreshold: {
          type: Type.NUMBER,
          description: 'Alert percentage threshold between 50 and 100 (default 80).',
        },
      },
      required: ['categoryName', 'monthlyLimit'],
    },
  },
  {
    name: 'propose_goal',
    description:
      'Propose creating a new savings / financial goal for user confirmation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Goal name (e.g. Yangi noutbuk, Umra safari).',
        },
        targetAmount: {
          type: Type.NUMBER,
          description: 'Target amount in UZS.',
        },
        deadline: {
          type: Type.STRING,
          description: 'Target date YYYY-MM-DD.',
        },
      },
      required: ['name', 'targetAmount'],
    },
  },
];

function buildSystemInstruction(user: UserProfile, ctx: Awaited<ReturnType<typeof buildUserFinancialContext>>): string {
  const compactStats = {
    userName: user.fullName,
    currency: user.currency,
    today: ctx.todayStr,
    totalBalance: ctx.totalBalance,
    todayIncome: ctx.todayIncome,
    todayExpense: ctx.todayExpense,
    thisMonthIncome: ctx.thisMonthIncome,
    thisMonthExpense: ctx.thisMonthExpense,
    netSavingsThisMonth: ctx.netSavings,
    lastMonthIncome: ctx.lastMonthIncome,
    lastMonthExpense: ctx.lastMonthExpense,
    topExpenseCategories: ctx.topExpenseCategories.slice(0, 5),
    budgets: ctx.budgets,
    goals: ctx.goals,
    debtsSummary: {
      borrowed: ctx.debtsSummary.totalBorrowed,
      lent: ctx.debtsSummary.totalLent,
    },
    wallets: ctx.wallets,
    activeSubscriptions: ctx.subscriptions,
    healthScore: {
      score: ctx.healthScore.score,
      grade: ctx.healthScore.grade,
      title: ctx.healthScore.title,
    },
    forecast: {
      monthEndExpectedBalance: ctx.forecast.monthEndExpectedBalance,
      confidenceScore: ctx.forecast.confidenceScore,
    },
    availableCategories: {
      income: ctx.categories.filter((c) => c.type === 'income').map((c) => c.name),
      expense: ctx.categories.filter((c) => c.type === 'expense').map((c) => c.name),
    },
    recentTransactions: ctx.recentTransactions.slice(0, 8),
  };

  return `You are HISOBOT AI Assistant — an intelligent, warm, trustworthy, and sharp personal finance advisor inside the HISOBOT AI app.

PERSONALITY & TONE:
- Smart, sincere, respectful, natural, and concise (typically 2-6 sentences unless user requests deep breakdown).
- Understands light, friendly humor in casual conversation, while staying accurate, serious, and clear on money and numbers.
- Explain complex financial ideas simply without confusing jargon.
- Format key numbers neatly with **bold** (e.g. **150 000 soʻm**) when presenting text. Avoid long robotic walls of text.

LANGUAGE RULE:
- Always reply in the EXACT language the user is writing/speaking in:
  - Uzbek (Latin by default, e.g., soʻm; or Cyrillic if user explicitly writes in Cyrillic)
  - Russian (if user writes in Russian)
  - English (if user writes in English)
- Never switch languages unnecessarily.

DATA & SECURITY RULES:
- Use ONLY the authenticated user's verified financial snapshot provided below (or returned by get_financial_report). NEVER invent numbers, fake transactions, or mention any other user's data.
- If the user logs an income or expense in natural speech/text (e.g. "Bugun taksiga 35 ming sarfladim", "Сегодня потратил 50 тысяч на обед", "I spent 120000 on groceries"), call \`propose_transaction\` instead of pretending it was already saved!
- If the user wants to set a category spending limit/budget, call \`propose_budget\`.
- If the user wants to create a savings goal, call \`propose_goal\`.
- If the user asks for today's, weekly, monthly, or yearly financial report / breakdown / comparison / forecast, call \`get_financial_report\` when helpful or cite exact figures from the snapshot below.
- Never claim a transaction, budget, or goal has been saved until the user confirms the proposal card.

AUTHENTICATED USER FINANCIAL SNAPSHOT:
${JSON.stringify(compactStats)}`;
}

function buildConfirmationPrompt(action: AIProposedAction, lang: 'uz' | 'ru' | 'en'): string {
  if (action.actionType === 'transaction') {
    const amt = fmtMoney(action.payload.amount, lang);
    if (lang === 'ru') {
      return `Я подготовил ${action.payload.type === 'income' ? 'доход' : 'расход'} на сумму **${amt}** (${action.payload.categoryName}). Нажмите **Tasdiqlash**, чтобы сохранить.`;
    }
    if (lang === 'en') {
      return `I prepared this ${action.payload.type} of **${amt}** under **${action.payload.categoryName}**. Please confirm below to save it.`;
    }
    return `Xabaringiz asosida **${amt}** (${action.payload.categoryName}) ${
      action.payload.type === 'income' ? 'kirim' : 'chiqim'
    } operatsiyasini tayyorladim. Tasdiqlasangiz bazaga saqlayman:`;
  }

  if (action.actionType === 'budget') {
    const amt = fmtMoney(action.payload.monthlyLimit, lang);
    if (lang === 'ru') {
      return `Подготовлен месячный бюджет для **${action.payload.categoryName}**: **${amt}**. Подтвердите сохранение ниже:`;
    }
    if (lang === 'en') {
      return `Prepared a monthly budget limit of **${amt}** for **${action.payload.categoryName}**. Please confirm below to save:`;
    }
    return `**${action.payload.categoryName}** toifasi uchun oylik **${amt}** budjet limitini tayyorladim. Tasdiqlasangiz saqlayman:`;
  }

  const target = fmtMoney(action.payload.targetAmount, lang);
  if (lang === 'ru') {
    return `Подготовлена финансовая цель «**${action.payload.name}**» на сумму **${target}**. Подтвердите сохранение ниже:`;
  }
  if (lang === 'en') {
    return `Prepared a savings goal "**${action.payload.name}**" with target **${target}**. Please confirm below to save:`;
  }
  return `«**${action.payload.name}**» moliyaviy maqsadini (**${target}**) tayyorladim. Tasdiqlasangiz qoʻshib qoʻyaman:`;
}

function sanitizeActionFromCall(
  name: string,
  args: Record<string, unknown>,
  categories: Category[]
): AIProposedAction | null {
  const today = getTodayDateString();
  const currentMonth = today.slice(0, 7);

  if (name === 'propose_transaction') {
    const rawType = String(args.type || 'expense').toLowerCase();
    const type: 'income' | 'expense' = rawType === 'income' ? 'income' : 'expense';
    const amount = Math.round(Number(args.amount) || 0);
    if (amount <= 0) return null;

    const rawCat = String(args.categoryName || '');
    const matched = matchCategory(categories, rawCat, type);
    const categoryName = matched?.name || rawCat || (type === 'income' ? 'Boshqa daromadlar' : 'Boshqa xarajatlar');
    const rawMethod = String(args.paymentMethod || 'card').toLowerCase();
    const paymentMethod: 'card' | 'cash' | 'bank' | 'other' =
      rawMethod === 'cash' || rawMethod === 'bank' || rawMethod === 'other' ? rawMethod : 'card';

    const dateStr =
      typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date) ? args.date : today;
    const description = String(args.description || categoryName).trim() || categoryName;

    const parsed: AIParsedTransaction = {
      type,
      amount,
      categoryName,
      categoryId: matched?.id,
      date: dateStr,
      description,
      paymentMethod,
      confidence: 0.96,
    };

    return {
      actionType: 'transaction',
      summary: `${type === 'income' ? 'Kirim' : 'Chiqim'}: ${description} (${categoryName})`,
      payload: parsed,
    };
  }

  if (name === 'propose_budget') {
    const monthlyLimit = Math.round(Number(args.monthlyLimit) || 0);
    if (monthlyLimit <= 0) return null;
    const rawCat = String(args.categoryName || 'Oziq-ovqat va kafe');
    const matched = matchCategory(categories, rawCat, 'expense');
    const categoryName = matched?.name || rawCat;
    const alertThreshold = Math.min(100, Math.max(50, Math.round(Number(args.alertThreshold) || 80)));

    return {
      actionType: 'budget',
      summary: `${categoryName} oylik budjet limiti`,
      payload: {
        categoryName,
        categoryId: matched?.id || 'cat_custom',
        monthlyLimit,
        month: currentMonth,
        alertThreshold,
      },
    };
  }

  if (name === 'propose_goal') {
    const targetAmount = Math.round(Number(args.targetAmount) || 0);
    if (targetAmount <= 0) return null;
    const goalName = String(args.name || 'Yangi maqsad').trim();
    const defaultDeadlineDate = new Date();
    defaultDeadlineDate.setMonth(defaultDeadlineDate.getMonth() + 6);
    const defaultDeadline = defaultDeadlineDate.toISOString().split('T')[0];
    const deadline =
      typeof args.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.deadline)
        ? args.deadline
        : defaultDeadline;

    return {
      actionType: 'goal',
      summary: `Maqsad: ${goalName}`,
      payload: {
        name: goalName,
        targetAmount,
        savedAmount: 0,
        deadline,
      },
    };
  }

  return null;
}

async function runFallbackAssistantTurn(params: {
  user: UserProfile;
  message: string;
  lang: 'uz' | 'ru' | 'en';
  warning?: string;
}): Promise<AssistantTurnResult> {
  const { user, message, lang, warning } = params;
  const ctx = await buildUserFinancialContext(user.id);
  const q = message.toLowerCase().trim();

  // 1. Check casual greetings / small talk
  const greetingWords = ['salom', 'assalom', 'qalaysiz', 'yaxshimisiz', 'rahmat', 'привет', 'здравств', 'как дела', 'спасибо', 'hello', 'hi', 'hey', 'thanks', 'thank you'];
  const looksCasual = greetingWords.some((g) => q.includes(g)) && !/\d/.test(q) && q.length < 70;
  if (looksCasual) {
    const firstName = user.fullName.split(' ')[0];
    if (lang === 'ru') {
      return {
        reply: `Привет, ${firstName}! Всё отлично, ваш финансовый мозг HISOBOT AI на связи. Сейчас ваш общий баланс **${fmtMoney(ctx.totalBalance, 'ru')}**. Могу проанализировать расходы, дать совет или записать трату — просто напишите или скажите голосом!`,
        source: 'fallback',
        warning,
      };
    }
    if (lang === 'en') {
      return {
        reply: `Hello ${firstName}! Your HISOBOT AI financial brain is ready. Your current balance is **${fmtMoney(ctx.totalBalance, 'en')}**. Ask me about your spending, forecast, or tell me any expense/income to record.`,
        source: 'fallback',
        warning,
      };
    }
    return {
      reply: `Assalomu alaykum, ${firstName}! Doim xizmatingizdaman. Hozirgi balansingiz **${fmtMoney(ctx.totalBalance, 'uz')}**. Moliyangizni tahlil qilish, maslahat berish yoki yangi kirim-chiqim kiritish uchun bemalol yozing yoki gapiring!`,
      source: 'fallback',
      warning,
    };
  }

  // 2. Check if message contains an expense/income number to propose
  const hasMoneyIntent =
    /\d/.test(q) &&
    ['sarfla', 'ol', 'tush', 'ber', 'toʻla', "to'la", 'oldim', 'xarajat', 'daromad', 'oylik', 'taksi', 'ovqat', 'spent', 'earned', 'paid', 'потрат', 'купил', 'получил', 'доход', 'расход', 'ming', 'mln', 'тыс', 'k'].some(
      (kw) => q.includes(kw)
    );

  if (hasMoneyIntent) {
    const parsed = await parseUzbekTransactionAI(message, ctx.categories, lang);
    if (parsed.amount > 0) {
      const action: AIProposedAction = {
        actionType: 'transaction',
        summary: `${parsed.type === 'income' ? 'Kirim' : 'Chiqim'}: ${parsed.description}`,
        payload: parsed,
      };
      return {
        reply: buildConfirmationPrompt(action, lang),
        proposedAction: action,
        source: 'fallback',
        warning,
      };
    }
  }

  // 3. Today's spending or general financial query
  if (q.includes('bugun') || q.includes('сегодня') || q.includes('today')) {
    const rows: AssistantStructuredRow[] = [
      {
        label: lang === 'ru' ? 'Доход за сегодня' : lang === 'en' ? "Today's income" : 'Bugungi kirim',
        value: `+${fmtMoney(ctx.todayIncome, lang)}`,
        tone: 'emerald',
      },
      {
        label: lang === 'ru' ? 'Расход за сегодня' : lang === 'en' ? "Today's expense" : 'Bugungi chiqim',
        value: `-${fmtMoney(ctx.todayExpense, lang)}`,
        tone: 'rose',
      },
      {
        label: lang === 'ru' ? 'Общий баланс' : lang === 'en' ? 'Total balance' : 'Umumiy balans',
        value: fmtMoney(ctx.totalBalance, lang),
        tone: 'teal',
      },
    ];

    const reply =
      lang === 'ru'
        ? `Сегодня вы получили **${fmtMoney(ctx.todayIncome, 'ru')}** и потратили **${fmtMoney(ctx.todayExpense, 'ru')}**. Текущий общий баланс: **${fmtMoney(ctx.totalBalance, 'ru')}**.`
        : lang === 'en'
        ? `Today you earned **${fmtMoney(ctx.todayIncome, 'en')}** and spent **${fmtMoney(ctx.todayExpense, 'en')}**. Your total balance is **${fmtMoney(ctx.totalBalance, 'en')}**.`
        : `Bugun jami **${fmtMoney(ctx.todayIncome, 'uz')}** kirim va **${fmtMoney(ctx.todayExpense, 'uz')}** xarajat qildingiz. Umumiy balansingiz: **${fmtMoney(ctx.totalBalance, 'uz')}**.`;

    return { reply, structuredRows: rows, source: 'fallback', warning };
  }

  // 4. Deterministic financial Q&A
  if (lang === 'en') {
    const topCat = ctx.topExpenseCategories[0];
    const rows: AssistantStructuredRow[] = [
      { label: 'Total balance', value: fmtMoney(ctx.totalBalance, 'en'), tone: 'emerald' },
      { label: 'This month income', value: `+${fmtMoney(ctx.thisMonthIncome, 'en')}`, tone: 'emerald' },
      { label: 'This month expense', value: `-${fmtMoney(ctx.thisMonthExpense, 'en')}`, tone: 'rose' },
      { label: 'Net savings', value: fmtMoney(ctx.netSavings, 'en'), tone: ctx.netSavings >= 0 ? 'teal' : 'rose' },
    ];
    const topText = topCat
      ? ` Top spending category: **${topCat.name}** (**${fmtMoney(topCat.amount, 'en')}**, ${topCat.percentage}%).`
      : '';
    return {
      reply: `Your current total balance is **${fmtMoney(ctx.totalBalance, 'en')}**. This month you earned **${fmtMoney(ctx.thisMonthIncome, 'en')}** and spent **${fmtMoney(ctx.thisMonthExpense, 'en')}** (net savings: **${fmtMoney(ctx.netSavings, 'en')}**).${topText}`,
      structuredRows: rows,
      source: 'fallback',
      warning,
    };
  }

  if (lang === 'ru') {
    const topCat = ctx.topExpenseCategories[0];
    const rows: AssistantStructuredRow[] = [
      { label: 'Общий баланс', value: fmtMoney(ctx.totalBalance, 'ru'), tone: 'emerald' },
      { label: 'Доход за месяц', value: `+${fmtMoney(ctx.thisMonthIncome, 'ru')}`, tone: 'emerald' },
      { label: 'Расход за месяц', value: `-${fmtMoney(ctx.thisMonthExpense, 'ru')}`, tone: 'rose' },
      { label: 'Чистые накопления', value: fmtMoney(ctx.netSavings, 'ru'), tone: ctx.netSavings >= 0 ? 'teal' : 'rose' },
    ];
    const topText = topCat
      ? ` Главная категория расходов: **${topCat.name}** (**${fmtMoney(topCat.amount, 'ru')}**, ${topCat.percentage}%).`
      : '';
    return {
      reply: `Ваш текущий общий баланс: **${fmtMoney(ctx.totalBalance, 'ru')}**. В этом месяце доход составил **${fmtMoney(ctx.thisMonthIncome, 'ru')}**, а расходы — **${fmtMoney(ctx.thisMonthExpense, 'ru')}** (накопления: **${fmtMoney(ctx.netSavings, 'ru')}**).${topText}`,
      structuredRows: rows,
      source: 'fallback',
      warning,
    };
  }

  const answer = await answerFinancialQuestionAI(message, {
    fullName: user.fullName,
    currency: user.currency,
    totalBalance: ctx.totalBalance,
    thisMonthIncome: ctx.thisMonthIncome,
    thisMonthExpense: ctx.thisMonthExpense,
    lastMonthIncome: ctx.lastMonthIncome,
    lastMonthExpense: ctx.lastMonthExpense,
    netSavings: ctx.netSavings,
    topExpenseCategories: ctx.topExpenseCategories,
    budgets: ctx.budgets,
    goals: ctx.goals,
    debtsSummary: {
      totalBorrowed: ctx.debtsSummary.totalBorrowed,
      totalLent: ctx.debtsSummary.totalLent,
    },
    recentTransactions: ctx.recentTransactions,
  });

  const needsForecastRows =
    q.includes('prognoz') ||
    q.includes('kelgusi') ||
    q.includes('bashorat') ||
    q.includes('forecast') ||
    q.includes('прогноз');

  const structuredRows: AssistantStructuredRow[] | undefined = needsForecastRows
    ? [
        { label: 'Oy yakuni prognozi', value: fmtMoney(ctx.forecast.monthEndExpectedBalance, lang), tone: 'emerald' },
        { label: 'Kutilayotgan xarajatlar', value: fmtMoney(ctx.forecast.expectedMonthlyExpenses, lang), tone: 'rose' },
        { label: 'Kutilayotgan jamgʻarma', value: fmtMoney(ctx.forecast.expectedSavings, lang), tone: 'teal' },
        { label: 'Ishonchlilik', value: `${ctx.forecast.confidenceScore}%`, tone: 'amber' },
      ]
    : undefined;

  return {
    reply: answer,
    structuredRows,
    source: 'fallback',
    warning,
  };
}

export async function runGeminiAssistantTurn(params: {
  user: UserProfile;
  message: string;
  history?: GeminiHistoryItem[];
  language?: string;
}): Promise<AssistantTurnResult> {
  const { user, message, history = [], language = 'uz' } = params;
  const detectedLang = detectLanguage(message, language);
  const client = getGeminiClient();

  if (!client) {
    const missingMsg =
      detectedLang === 'ru'
        ? 'GEMINI_API_KEY не задан на сервере — включён локальный резервный режим.'
        : detectedLang === 'en'
        ? 'GEMINI_API_KEY is not set on the server — local financial fallback is active.'
        : 'GEMINI_API_KEY server muhitida sozlanmagan — lokal aqlli tahlil rejimi ishlamoqda.';

    return runFallbackAssistantTurn({
      user,
      message,
      lang: detectedLang,
      warning: missingMsg,
    });
  }

  const ctx = await buildUserFinancialContext(user.id);
  const systemInstruction = buildSystemInstruction(user, ctx);

  // Build clean multi-turn contents (limit to recent 12 turns for speed & token efficiency)
  const sanitizedHistory: Content[] = history
    .slice(-12)
    .filter((h) => h && typeof h.content === 'string' && h.content.trim().length > 0)
    .map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content.trim().slice(0, 1800) }],
    }));

  const userTurn: Content = {
    role: 'user',
    parts: [{ text: message.trim().slice(0, 2000) }],
  };

  const contents: Content[] = [...sanitizedHistory, userTurn];

  try {
    const response1 = await withTimeout(
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          tools: [{ functionDeclarations: assistantToolDeclarations }],
        },
      })
    );

    const functionCalls = response1.functionCalls || [];

    if (functionCalls.length > 0) {
      const firstCall = functionCalls[0];
      const callName = firstCall.name || '';
      const callArgs = (firstCall.args || {}) as Record<string, unknown>;

      // Read-only reporting tool: execute immediately & run 2nd Gemini turn
      if (callName === 'get_financial_report') {
        const rawPeriod = String(callArgs.period || 'month');
        const period: 'today' | 'week' | 'month' | 'year' =
          rawPeriod === 'today' || rawPeriod === 'week' || rawPeriod === 'year' ? rawPeriod : 'month';
        const focus = callArgs.focus ? String(callArgs.focus) : undefined;
        const { structuredRows, reportData } = await buildReportForPeriod(user.id, period, focus, detectedLang);

        const modelContent = response1.candidates?.[0]?.content;
        if (modelContent) {
          const functionResponsePart: Part = {
            functionResponse: {
              id: firstCall.id,
              name: callName,
              response: { report: reportData },
            },
          };

          const response2 = await withTimeout(
            client.models.generateContent({
              model: GEMINI_MODEL,
              contents: [
                ...contents,
                modelContent,
                { role: 'user', parts: [functionResponsePart] },
              ],
              config: {
                systemInstruction,
                thinkingConfig: {
                  thinkingLevel: ThinkingLevel.LOW,
                },
              },
            })
          );

          const finalText = response2.text?.trim() || response1.text?.trim() || '';
          if (finalText) {
            return {
              reply: finalText,
              structuredRows,
              source: 'gemini',
            };
          }
        }

        // If 2nd turn returned empty text, synthesize concise summary
        return {
          reply:
            detectedLang === 'ru'
              ? 'Вот ваш актуальный финансовый отчёт за выбранный период:'
              : detectedLang === 'en'
              ? 'Here is your financial report for the requested period:'
              : 'Tanlangan davr boʻyicha dolzarb moliyaviy hisobotingiz:',
          structuredRows,
          source: 'gemini',
        };
      }

      // Mutating tools MUST NOT write to DB directly — always return proposal card
      if (
        callName === 'propose_transaction' ||
        callName === 'propose_budget' ||
        callName === 'propose_goal'
      ) {
        const proposedAction = sanitizeActionFromCall(callName, callArgs, ctx.categories);
        if (proposedAction) {
          const modelText = response1.text?.trim();
          return {
            reply: modelText || buildConfirmationPrompt(proposedAction, detectedLang),
            proposedAction,
            source: 'gemini',
          };
        }
      }
    }

    const replyText = response1.text?.trim();
    if (!replyText) {
      throw new Error('EMPTY_GEMINI_RESPONSE');
    }

    return {
      reply: replyText,
      source: 'gemini',
    };
  } catch (err: unknown) {
    const safeErr = sanitizeErrorForLog(err);
    console.error('[HISOBOT AI] Gemini assistant error:', safeErr);

    const errLower = safeErr.toLowerCase();
    let friendlyWarning = '';

    if (errLower.includes('429') || errLower.includes('quota') || errLower.includes('resource_exhausted')) {
      friendlyWarning =
        detectedLang === 'ru'
          ? 'Превышен лимит запросов к Gemini AI — использован локальный режим.'
          : detectedLang === 'en'
          ? 'Gemini AI rate limit reached — using local financial fallback.'
          : 'Gemini AI soʻrovlar limiti vaqtincha toʻldi — lokal rejim orqali javob berildi.';
    } else if (errLower.includes('timeout') || errLower.includes('gemini_timeout')) {
      friendlyWarning =
        detectedLang === 'ru'
          ? 'Сервер Gemini отвечает слишком долго — использован локальный режим.'
          : detectedLang === 'en'
          ? 'Gemini response timed out — using local financial fallback.'
          : 'Gemini javobi kechikkani sababli lokal tahlildan foydalanildi.';
    } else if (errLower.includes('401') || errLower.includes('403') || errLower.includes('api_key') || errLower.includes('api key')) {
      friendlyWarning =
        detectedLang === 'ru'
          ? 'Неверный или неактивный GEMINI_API_KEY на сервере — использован локальный режим.'
          : detectedLang === 'en'
          ? 'Invalid or unauthorized GEMINI_API_KEY on server — using local fallback.'
          : 'Serverdagi GEMINI_API_KEY yaroqsiz yoki faol emas — lokal tahlil ishlamoqda.';
    } else {
      friendlyWarning =
        detectedLang === 'ru'
          ? 'Временная ошибка связи с Gemini AI — использован локальный режим.'
          : detectedLang === 'en'
          ? 'Temporary Gemini AI connection issue — using local fallback.'
          : 'Gemini AI bilan aloqada vaqtincha uzilish — lokal rejimdan javob berildi.';
    }

    return runFallbackAssistantTurn({
      user,
      message,
      lang: detectedLang,
      warning: friendlyWarning,
    });
  }
}

export async function parseTransactionWithGemini(
  userInput: string,
  categories: Category[],
  language: string = 'uz'
): Promise<AIParsedTransaction | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const today = getTodayDateString();
  const catNames = categories.map((c) => `${c.name} (${c.type})`).join(', ');

  try {
    const response = await withTimeout(
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Parse this personal finance message (${language}) into a single transaction. Today is ${today}. Available categories: ${catNames}.\nMessage: "${userInput.slice(0, 600)}"`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "Must be 'income' or 'expense'" },
              amount: { type: Type.NUMBER, description: 'Integer amount in UZS (0 if missing)' },
              categoryName: { type: Type.STRING },
              date: { type: Type.STRING, description: 'YYYY-MM-DD' },
              description: { type: Type.STRING },
              paymentMethod: { type: Type.STRING, description: "'card', 'cash', 'bank', or 'other'" },
              clarificationQuestion: { type: Type.STRING },
            },
            required: ['type', 'amount', 'categoryName', 'date', 'description', 'paymentMethod'],
          },
        },
      }),
      12_000
    );

    const raw = response.text?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type: 'income' | 'expense' = parsed.type === 'income' ? 'income' : 'expense';
    const amount = Math.max(0, Math.round(Number(parsed.amount) || 0));
    const matched = matchCategory(categories, String(parsed.categoryName || ''), type);
    const paymentMethodRaw = String(parsed.paymentMethod || 'card');
    const paymentMethod: 'card' | 'cash' | 'bank' | 'other' =
      paymentMethodRaw === 'cash' || paymentMethodRaw === 'bank' || paymentMethodRaw === 'other'
        ? paymentMethodRaw
        : 'card';
    const date =
      typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today;

    return {
      type,
      amount,
      categoryName: matched?.name || String(parsed.categoryName || 'Boshqa xarajatlar'),
      categoryId: matched?.id,
      date,
      description: String(parsed.description || userInput).trim(),
      paymentMethod,
      confidence: amount > 0 ? 0.96 : 0.45,
      missingFields: amount <= 0 ? ['amount'] : undefined,
      clarificationQuestion:
        amount <= 0
          ? String(parsed.clarificationQuestion || "Iltimos, summani koʻrsating (masalan: 150 ming so'm).")
          : undefined,
    };
  } catch (err: unknown) {
    console.error('[HISOBOT AI] parseTransactionWithGemini error:', sanitizeErrorForLog(err));
    return null;
  }
}

export async function parseReceiptWithGemini(
  imageBase64OrText: string,
  categories: Category[],
  existingReceipts: ScannedReceipt[] = []
): Promise<Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'> | null> {
  const client = getGeminiClient();
  if (!client || !imageBase64OrText) return null;

  const today = getTodayDateString();
  const expenseCats = categories.filter((c) => c.type === 'expense').map((c) => c.name).join(', ');

  try {
    const parts: Part[] = [];
    const dataUrlMatch = imageBase64OrText.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (dataUrlMatch) {
      parts.push({
        inlineData: {
          mimeType: dataUrlMatch[1],
          data: dataUrlMatch[2],
        },
      });
      parts.push({
        text: `Extract receipt details from this image. Today is ${today}. Expense categories: ${expenseCats}. Return JSON only.`,
      });
    } else {
      parts.push({
        text: `Extract receipt details from this text. Today is ${today}. Expense categories: ${expenseCats}.\nReceipt text:\n${imageBase64OrText.slice(0, 3000)}`,
      });
    }

    const response = await withTimeout(
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents: parts,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchantName: { type: Type.STRING },
              date: { type: Type.STRING, description: 'YYYY-MM-DD' },
              totalAmount: { type: Type.NUMBER },
              categorySuggested: { type: Type.STRING },
              lineItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.NUMBER },
                    price: { type: Type.NUMBER },
                  },
                  required: ['name', 'price'],
                },
              },
            },
            required: ['merchantName', 'date', 'totalAmount', 'categorySuggested', 'lineItems'],
          },
        },
      }),
      18_000
    );

    const raw = response.text?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const merchantName = String(parsed.merchantName || 'Savdo cheki').trim();
    const totalAmount = Math.max(0, Math.round(Number(parsed.totalAmount) || 0));
    if (totalAmount <= 0) return null;

    const date =
      typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : today;
    const matched = matchCategory(categories, String(parsed.categorySuggested || ''), 'expense');
    const categorySuggested = matched?.name || 'Oziq-ovqat va kafe';

    const lineItems = Array.isArray(parsed.lineItems)
      ? parsed.lineItems.slice(0, 15).map((item: any) => ({
          name: String(item?.name || 'Mahsulot'),
          quantity: item?.quantity ? Number(item.quantity) : 1,
          price: Math.max(0, Math.round(Number(item?.price) || 0)),
        }))
      : [];

    const isDuplicate = existingReceipts.some(
      (r) =>
        r.merchantName.toLowerCase() === merchantName.toLowerCase() &&
        r.date === date &&
        Math.abs(r.totalAmount - totalAmount) < 500
    );

    return {
      merchantName,
      date,
      totalAmount,
      currency: 'UZS',
      categorySuggested,
      lineItems,
      confidence: 0.95,
      isDuplicate,
    };
  } catch (err: unknown) {
    console.error('[HISOBOT AI] parseReceiptWithGemini error:', sanitizeErrorForLog(err));
    return null;
  }
}
