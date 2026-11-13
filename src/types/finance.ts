/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'card' | 'bank' | 'other';

export type CurrencyCode = 'UZS' | 'USD' | 'EUR' | 'RUB' | 'GBP' | 'TRY' | 'KZT';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  currency: CurrencyCode;
  language: 'uz';
  theme: 'light' | 'dark';
  monthlyBudget: number;
  familyGroupId?: string;
  notificationPrefs: {
    budgetAlerts: boolean;
    debtReminders: boolean;
    goalMilestones: boolean;
    weeklySummary: boolean;
    subscriptionAlerts?: boolean;
    telegramSync?: boolean;
  };
  isPremium?: boolean;
  premiumPlan?: 'free' | 'pro' | 'business';
  premiumExpiresAt?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  isCustom?: boolean;
  userId?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number; // in UZS (integer safe)
  currency?: CurrencyCode;
  originalAmount?: number;
  exchangeRate?: number;
  categoryId: string;
  categoryName: string;
  walletId?: string;
  walletName?: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  description: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  receiptId?: string;
  isFamilyShared?: boolean;
  createdByMemberName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  categoryName: string;
  monthlyLimit: number;
  month: string; // YYYY-MM
  alertThreshold: number; // default 80 (%)
}

export interface FinancialGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string; // YYYY-MM-DD
  color: string;
  icon: string;
  isFamilyShared?: boolean;
  createdAt: string;
  isCompleted?: boolean;
}

export interface Debt {
  id: string;
  userId: string;
  type: 'borrowed' | 'lent'; // borrowed: men qarz oldim, lent: men qarz berdim
  personName: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  startDate: string;
  dueDate: string;
  status: 'active' | 'partial' | 'paid' | 'overdue';
  notes?: string;
  phone?: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'budget_warning' | 'unusual_spending' | 'debt_due' | 'goal_reached' | 'monthly_summary' | 'subscription' | 'recurring';
  date: string;
  isRead: boolean;
  linkTab?: string;
}

export interface AIParsedTransaction {
  type: TransactionType;
  amount: number;
  currency?: CurrencyCode;
  categoryName: string;
  categoryId?: string;
  walletId?: string;
  date: string;
  description: string;
  paymentMethod: PaymentMethod;
  confidence: number;
  missingFields?: string[];
  clarificationQuestion?: string;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedTransaction?: AIParsedTransaction;
  confirmationState?: 'pending' | 'confirmed' | 'cancelled';
  scannedReceipt?: Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'>;
  receiptSaved?: boolean;
  structuredRows?: { label: string; value: string; tone?: 'emerald' | 'rose' | 'teal' | 'amber' }[];
  isError?: boolean;
  retryQuery?: string;
}

export interface FinancialSummary {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  netSavings: number;
  savingsRate: number; // percentage
  incomeCount: number;
  expenseCount: number;
  categoriesBreakdown: {
    categoryName: string;
    amount: number;
    percentage: number;
    color: string;
    count: number;
    type: TransactionType;
  }[];
  monthlyComparison: {
    month: string;
    income: number;
    expense: number;
    savings: number;
  }[];
  dailyBreakdown: {
    date: string;
    income: number;
    expense: number;
  }[];
}

// --- 1. Wallets & Cards ---
export type WalletType = 'cash' | 'card' | 'bank_account' | 'savings' | 'digital_wallet' | 'other';

export interface Wallet {
  id: string;
  userId: string;
  name: string;
  type: WalletType;
  balance: number;
  currency: CurrencyCode;
  color: string;
  icon?: string;
  accountNumber?: string; // last 4 digits e.g. *8892
  isArchived?: boolean;
  createdAt: string;
}

export interface WalletTransfer {
  id: string;
  userId: string;
  fromWalletId: string;
  fromWalletName: string;
  toWalletId: string;
  toWalletName: string;
  amount: number;
  targetAmount: number;
  date: string;
  notes?: string;
  createdAt: string;
}

// --- 2. Family Budget ---
export type FamilyRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface FamilyGroup {
  id: string;
  name: string;
  ownerId: string;
  currency: CurrencyCode;
  monthlyBudget: number;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: FamilyRole;
  joinedAt: string;
}

export interface FamilyInvitation {
  id: string;
  familyId: string;
  email: string;
  role: FamilyRole;
  inviteCode: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

// --- 3. Subscriptions ---
export type BillingInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string;
  userId: string;
  serviceName: string;
  amount: number;
  currency: CurrencyCode;
  billingInterval: BillingInterval;
  nextPaymentDate: string;
  walletId?: string;
  walletName?: string;
  status: SubscriptionStatus;
  categoryName: string;
  icon?: string;
  notes?: string;
  createdAt: string;
}

// --- 4. Automatic Recurring Payments ---
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  categoryId: string;
  categoryName: string;
  walletId?: string;
  description: string;
  paymentMethod: PaymentMethod;
  frequency: RecurrenceFrequency;
  nextExecutionDate: string;
  status: 'active' | 'paused';
  lastExecutedAt?: string;
  idempotencyKeyPrefix: string;
  notes?: string;
  createdAt: string;
}

export interface RecurringExecutionLog {
  id: string;
  userId: string;
  recurringId: string;
  description: string;
  amount: number;
  type: TransactionType;
  executedAt: string;
  status: 'success' | 'failed';
  message?: string;
}

// --- 5. Receipt Scanner with OCR ---
export interface ReceiptLineItem {
  name: string;
  quantity?: number;
  price: number;
}

export interface ScannedReceipt {
  id: string;
  userId: string;
  merchantName: string;
  date: string;
  totalAmount: number;
  currency: CurrencyCode;
  categorySuggested: string;
  lineItems: ReceiptLineItem[];
  rawOcrText?: string;
  imageUrl?: string;
  confidence: number;
  isDuplicate?: boolean;
  transactionId?: string;
  createdAt: string;
}

// --- 6. Exchange Rates ---
export interface ExchangeRate {
  code: CurrencyCode;
  name: string;
  rate: number; // 1 unit in UZS
  diff: number; // +/- change
  date: string;
}

// --- 7. Bank Integration ---
export type BankStatus = 'connected' | 'disconnected' | 'error';

export interface BankAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: CurrencyCode;
  mask: string;
}

export interface BankConnection {
  id: string;
  userId: string;
  bankId: string;
  bankName: string;
  logo: string;
  status: BankStatus;
  lastSyncAt: string;
  accounts: BankAccount[];
}

export interface BankSyncLog {
  id: string;
  userId: string;
  bankName: string;
  syncedAt: string;
  importedCount: number;
  status: 'success' | 'partial' | 'failed';
  notes?: string;
}

// --- 8. Telegram Bot Connection ---
export interface TelegramConnection {
  userId: string;
  isConnected: boolean;
  telegramUsername?: string;
  chatId?: string;
  connectCode: string;
  preferences: {
    dailyReport: boolean;
    weeklyReport: boolean;
    budgetAlerts: boolean;
    subscriptionAlerts: boolean;
  };
  connectedAt?: string;
}

// --- 9. Financial Health Score & Forecasting ---
export interface FinancialHealthScore {
  score: number; // 0 to 100
  grade: 'A' | 'B' | 'C' | 'D';
  title: string;
  summary: string;
  breakdown: {
    factor: string;
    score: number;
    maxScore: number;
    feedback: string;
  }[];
}

export interface FinancialForecast {
  monthEndExpectedBalance: number;
  expectedMonthlyExpenses: number;
  expectedSavings: number;
  confidenceScore: number; // percentage e.g. 85%
  budgetOverrunRisk: {
    category: string;
    riskLevel: 'low' | 'medium' | 'high';
    explanation: string;
  }[];
  scenarios: {
    realistic: { month1: number; month2: number; month3: number };
    optimistic: { month1: number; month2: number; month3: number };
    conservative: { month1: number; month2: number; month3: number };
  };
  assumptions: string[];
  warning?: string;
}
