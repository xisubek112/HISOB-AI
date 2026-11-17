/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  AdminAiAnalyticsData,
  AdminAuditLog,
  AdminOverviewData,
  AdminRevenueData,
  AdminSubscriptionsData,
  AdminSystemHealthData,
  AdminUserSummary,
  AiUsageEvent,
  ApiErrorEvent,
  AppRuntimeConfig,
  UserProfile,
  Transaction,
  Category,
  Budget,
  FinancialGoal,
  Debt,
  NotificationItem,
  Wallet,
  WalletTransfer,
  FamilyGroup,
  FamilyMember,
  FamilyInvitation,
  Subscription,
  SubscriptionEvent,
  RecurringTransaction,
  RecurringExecutionLog,
  ScannedReceipt,
  ExchangeRate,
  BankConnection,
  BankSyncLog,
  TelegramConnection,
  CurrencyCode,
} from '../types/finance.ts';
import { isVerifiedSuperAdminUser } from './admin-policy.ts';
import {
  DEFAULT_APP_RUNTIME_CONFIG,
  buildAdminAiAnalyticsData,
  buildAdminOverviewData,
  buildAdminRevenueData,
  buildAdminSubscriptionsData,
  buildAdminSystemHealthData,
  sanitizeRuntimeConfigUpdate,
} from './admin-analytics.ts';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXCHANGE_RATES,
  getTodayDateString,
  getCurrentTimeString,
} from '../utils/formatters.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface UserRecord extends UserProfile {
  passwordHash: string;
  salt: string;
  resetToken?: string;
}

interface DatabaseSchema {
  users: Record<string, UserRecord>;
  sessions: Record<string, string>; // token -> userId
  transactions: Record<string, Transaction[]>; // userId -> transactions
  categories: Record<string, Category[]>; // userId -> custom categories
  budgets: Record<string, Budget[]>; // userId -> budgets
  goals: Record<string, FinancialGoal[]>; // userId -> goals
  debts: Record<string, Debt[]>; // userId -> debts
  notifications: Record<string, NotificationItem[]>; // userId -> notifications

  // New modules
  wallets: Record<string, Wallet[]>; // userId -> wallets
  walletTransfers: Record<string, WalletTransfer[]>; // userId -> transfers
  familyGroups: Record<string, FamilyGroup>; // familyId -> FamilyGroup
  familyMembers: Record<string, FamilyMember[]>; // familyId -> FamilyMember[]
  familyInvitations: Record<string, FamilyInvitation[]>; // familyId -> FamilyInvitation[]
  subscriptions: Record<string, Subscription[]>; // userId -> subscriptions
  recurringTransactions: Record<string, RecurringTransaction[]>; // userId -> recurring
  recurringLogs: Record<string, RecurringExecutionLog[]>; // userId -> logs
  receipts: Record<string, ScannedReceipt[]>; // userId -> receipts
  bankConnections: Record<string, BankConnection[]>; // userId -> banks
  bankSyncLogs: Record<string, BankSyncLog[]>; // userId -> sync logs
  telegramConnections: Record<string, TelegramConnection>; // userId -> telegram

  // Super Admin & Telemetry
  adminAuditLogs: AdminAuditLog[];
  aiUsageEvents: AiUsageEvent[];
  apiErrorEvents: ApiErrorEvent[];
  subscriptionEvents: SubscriptionEvent[];
  appConfig: AppRuntimeConfig;
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

class Database {
  private data: DatabaseSchema = {
    users: {},
    sessions: {},
    transactions: {},
    categories: {},
    budgets: {},
    goals: {},
    debts: {},
    notifications: {},
    wallets: {},
    walletTransfers: {},
    familyGroups: {},
    familyMembers: {},
    familyInvitations: {},
    subscriptions: {},
    recurringTransactions: {},
    recurringLogs: {},
    receipts: {},
    bankConnections: {},
    bankSyncLogs: {},
    telegramConnections: {},
    adminAuditLogs: [],
    aiUsageEvents: [],
    apiErrorEvents: [],
    subscriptionEvents: [],
    appConfig: { ...DEFAULT_APP_RUNTIME_CONFIG },
  };

  private readonly dbFile: string;
  private readonly dataDir: string;

  constructor(options?: { dbFilePath?: string; skipDemoSeed?: boolean }) {
    this.dbFile = options?.dbFilePath ? path.resolve(options.dbFilePath) : DB_FILE;
    this.dataDir = path.dirname(this.dbFile);
    this.init(options?.skipDemoSeed === true);
  }

  private init(skipDemoSeed = false) {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...parsed,
          wallets: parsed.wallets || {},
          walletTransfers: parsed.walletTransfers || {},
          familyGroups: parsed.familyGroups || {},
          familyMembers: parsed.familyMembers || {},
          familyInvitations: parsed.familyInvitations || {},
          subscriptions: parsed.subscriptions || {},
          recurringTransactions: parsed.recurringTransactions || {},
          recurringLogs: parsed.recurringLogs || {},
          receipts: parsed.receipts || {},
          bankConnections: parsed.bankConnections || {},
          bankSyncLogs: parsed.bankSyncLogs || {},
          telegramConnections: parsed.telegramConnections || {},
          adminAuditLogs: Array.isArray(parsed.adminAuditLogs) ? parsed.adminAuditLogs : [],
          aiUsageEvents: Array.isArray(parsed.aiUsageEvents) ? parsed.aiUsageEvents : [],
          apiErrorEvents: Array.isArray(parsed.apiErrorEvents) ? parsed.apiErrorEvents : [],
          subscriptionEvents: Array.isArray(parsed.subscriptionEvents) ? parsed.subscriptionEvents : [],
          appConfig: {
            ...DEFAULT_APP_RUNTIME_CONFIG,
            ...(parsed.appConfig && typeof parsed.appConfig === 'object' ? parsed.appConfig : {}),
          },
        };
      } else if (
        !skipDemoSeed &&
        process.env.NODE_ENV !== 'production' &&
        process.env.ENABLE_DEMO_SEED === 'true'
      ) {
        // Demo data is opt-in for local development; disabled by default.
        this.seedDemoUser();
        this.persist();
      } else {
        // Production starts with an empty store; never create demo identities.
        this.persist();
      }

      if (
        !skipDemoSeed &&
        process.env.NODE_ENV !== 'production' &&
        process.env.ENABLE_DEMO_SEED === 'true'
      ) {
        // Ensure demo user has initial data only when explicitly enabled locally.
        this.ensureDemoAdvancedData();
        this.data.sessions['demo_token'] = 'usr_demo_hisobot_2026';
      } else {
        // Remove any legacy demo credential loaded from an existing JSON file.
        // Preserve any existing records for export/migration, but revoke the
        // known demo bearer token. Demo credentials are also rejected at login.
        delete this.data.sessions['demo_token'];
      }

      if (!skipDemoSeed && process.env.NODE_ENV !== 'production') {
        this.ensureDefaultGamerAccount();
      }
      this.persist();
    } catch (e) {
      console.error('Database initialization error:', e);
      if (
        !skipDemoSeed &&
        process.env.NODE_ENV !== 'production' &&
        process.env.ENABLE_DEMO_SEED === 'true'
      ) {
        this.seedDemoUser();
        this.data.sessions['demo_token'] = 'usr_demo_hisobot_2026';
      }
      if (!skipDemoSeed && process.env.NODE_ENV !== 'production') {
        this.ensureDefaultGamerAccount();
      }
      this.persist();
    }
  }

  private ensureDefaultGamerAccount() {
    const targetEmail = 'xisugamer@gmail.com';
    const existing = Object.values(this.data.users).find(
      (u) => u.email.trim().toLowerCase() === targetEmail
    );
    if (!existing) {
      const { token } = this.registerUser(targetEmail, 'Admin123', 'Xisu Gamer');
      delete this.data.sessions[token];
      return;
    }

    if (this.verifyUserPassword(existing.id, 'Xisu2026!')) {
      const salt = crypto.randomBytes(16).toString('hex');
      existing.passwordHash = hashPassword('Admin123', salt);
      existing.salt = salt;
      this.logoutAllDevices(existing.id);
    }
  }

  private persist() {
    try {
      const tempPath = `${this.dbFile}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.dbFile);
    } catch (e) {
      console.error('Failed to persist database:', e);
    }
  }

  private seedDemoUser() {
    const demoId = 'usr_demo_hisobot_2026';
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword('hisobot123', salt);

    const demoUser: UserRecord = {
      id: demoId,
      email: 'demo@hisobot.uz',
      fullName: 'Anvar Qodirov',
      avatarUrl: '/src/assets/images/avatar_user_profile_1794280921902.jpg',
      currency: 'UZS',
      language: 'uz',
      theme: 'light',
      monthlyBudget: 8500000,
      notificationPrefs: {
        budgetAlerts: true,
        debtReminders: true,
        goalMilestones: true,
        weeklySummary: true,
        subscriptionAlerts: true,
        telegramSync: true,
      },
      createdAt: '2026-10-01T08:00:00.000Z',
      passwordHash,
      salt,
    };

    this.data.users[demoId] = demoUser;

    const today = getTodayDateString();
    const [y, m] = today.split('-');
    const currentMonthPrefix = `${y}-${m}`;

    // Seed Transactions
    this.data.transactions[demoId] = [
      {
        id: 'tx_seed_1',
        userId: demoId,
        type: 'income',
        amount: 15000000,
        categoryId: 'inc_salary',
        categoryName: 'Oylik maosh',
        walletName: 'Asosiy karta (Uzcard)',
        date: `${currentMonthPrefix}-01`,
        time: '09:30',
        description: 'Kompaniyadan oylik maosh',
        paymentMethod: 'card',
        notes: 'Noyabr oyi asosiy maoshi',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx_seed_2',
        userId: demoId,
        type: 'income',
        amount: 3200000,
        categoryId: 'inc_freelance',
        categoryName: 'Frilans',
        walletName: 'Humo karta',
        date: `${currentMonthPrefix}-04`,
        time: '17:45',
        description: 'Veb-sayt dizayni loyihasi uchun toʻlov',
        paymentMethod: 'card',
        notes: 'Frontend loyihasi yakunlandi',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx_seed_3',
        userId: demoId,
        type: 'expense',
        amount: 2800000,
        categoryId: 'exp_food',
        categoryName: 'Oziq-ovqat va kafe',
        walletName: 'Asosiy karta (Uzcard)',
        date: `${currentMonthPrefix}-05`,
        time: '19:15',
        description: 'Korzinka supermarketidan oylik mahsulotlar',
        paymentMethod: 'card',
        notes: 'Goʻsht, sut, meva va non mahsulotlari',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx_seed_4',
        userId: demoId,
        type: 'expense',
        amount: 650000,
        categoryId: 'exp_transport',
        categoryName: 'Transport va yoqilgʻi',
        walletName: 'Humo karta',
        date: `${currentMonthPrefix}-06`,
        time: '08:40',
        description: 'Yoqilgʻi quyish shoxobchasi (Benzin Ai-95)',
        paymentMethod: 'card',
        notes: 'Avtomobil baki toʻldirildi',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx_seed_5',
        userId: demoId,
        type: 'expense',
        amount: 350000,
        categoryId: 'exp_bills',
        categoryName: 'Kommunal toʻlovlar',
        walletName: 'Asosiy karta (Uzcard)',
        date: `${currentMonthPrefix}-07`,
        time: '11:20',
        description: 'Uy interneti va elektr energiyasi toʻlovi',
        paymentMethod: 'card',
        notes: 'Noyabr oyi uchun toʻliq toʻlandi',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx_seed_6',
        userId: demoId,
        type: 'expense',
        amount: 850000,
        categoryId: 'exp_shopping',
        categoryName: 'Xaridlar va kiyim',
        walletName: 'Humo karta',
        date: `${currentMonthPrefix}-08`,
        time: '16:00',
        description: 'Qishki mavsum uchun kiyim-kechak xaridi',
        paymentMethod: 'card',
        notes: 'Savdo markazidan',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx_seed_7',
        userId: demoId,
        type: 'expense',
        amount: 150000,
        categoryId: 'exp_food',
        categoryName: 'Oziq-ovqat va kafe',
        walletName: 'Naqd pul hamyoni',
        date: today,
        time: '13:00',
        description: 'Kollektiv bilan tushlik (Milliy taomlar)',
        paymentMethod: 'cash',
        notes: 'Choyxona tushligi',
        createdAt: new Date().toISOString(),
      },
    ];

    // Seed Budgets
    this.data.budgets[demoId] = [
      {
        id: 'bdg_1',
        userId: demoId,
        categoryId: 'exp_food',
        categoryName: 'Oziq-ovqat va kafe',
        monthlyLimit: 3500000,
        month: currentMonthPrefix,
        alertThreshold: 80,
      },
      {
        id: 'bdg_2',
        userId: demoId,
        categoryId: 'exp_transport',
        categoryName: 'Transport va yoqilgʻi',
        monthlyLimit: 1200000,
        month: currentMonthPrefix,
        alertThreshold: 80,
      },
      {
        id: 'bdg_3',
        userId: demoId,
        categoryId: 'exp_shopping',
        categoryName: 'Xaridlar va kiyim',
        monthlyLimit: 2000000,
        month: currentMonthPrefix,
        alertThreshold: 80,
      },
    ];

    // Seed Financial Goals
    this.data.goals[demoId] = [
      {
        id: 'goal_1',
        userId: demoId,
        name: 'Avtomobil xaridi (Chevrolet Tracker)',
        targetAmount: 200000000,
        savedAmount: 75000000,
        deadline: '2027-06-30',
        color: '#3B82F6',
        icon: 'Car',
        createdAt: '2026-01-15T10:00:00.000Z',
      },
      {
        id: 'goal_2',
        userId: demoId,
        name: 'Umra safari ziyorati',
        targetAmount: 25000000,
        savedAmount: 18500000,
        deadline: '2027-03-20',
        color: '#10B981',
        icon: 'Plane',
        createdAt: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'goal_3',
        userId: demoId,
        name: 'Favqulodda xavfsizlik jamgʻarmasi',
        targetAmount: 20000000,
        savedAmount: 13450000,
        deadline: '2026-12-31',
        color: '#06B6D4',
        icon: 'ShieldCheck',
        createdAt: '2026-05-10T10:00:00.000Z',
      },
    ];

    // Seed Debts
    this.data.debts[demoId] = [
      {
        id: 'debt_1',
        userId: demoId,
        type: 'borrowed',
        personName: 'Sardor Qosimov (Aka)',
        amount: 2500000,
        paidAmount: 1000000,
        remainingAmount: 1500000,
        startDate: `${currentMonthPrefix}-02`,
        dueDate: `${currentMonthPrefix}-25`,
        status: 'partial',
        phone: '+998 90 123 45 67',
        notes: 'Avtomobil taʼmiri uchun qarz olingan',
      },
      {
        id: 'debt_2',
        userId: demoId,
        type: 'lent',
        personName: 'Jamshid Alimov (Doʻstim)',
        amount: 4000000,
        paidAmount: 2000000,
        remainingAmount: 2000000,
        startDate: '2026-10-15',
        dueDate: `${currentMonthPrefix}-30`,
        status: 'partial',
        phone: '+998 97 987 65 43',
        notes: 'Oʻquv kursi toʻlovi uchun berilgan',
      },
    ];

    // Seed Notifications
    this.data.notifications[demoId] = [
      {
        id: 'notif_1',
        userId: demoId,
        title: 'Budjet ogohlantirishi: Oziq-ovqat va kafe',
        message: 'Oziq-ovqat toifasidagi xarajatlaringiz 84% ga yetdi (2 950 000 / 3 500 000 soʻm). Meʼyordan oshib ketmaslikka eʼtibor bering.',
        type: 'budget_warning',
        date: today,
        isRead: false,
        linkTab: 'budgets',
      },
    ];
  }

  private ensureDemoAdvancedData() {
    const demoId = 'usr_demo_hisobot_2026';
    if (!this.data.users[demoId]) return;

    // 1. Wallets
    if (!this.data.wallets[demoId] || this.data.wallets[demoId].length === 0) {
      this.data.wallets[demoId] = [
        {
          id: 'w_1',
          userId: demoId,
          name: 'Asosiy karta (Uzcard)',
          type: 'card',
          balance: 8400000,
          currency: 'UZS',
          color: '#10B981',
          icon: 'CreditCard',
          accountNumber: '*8824',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'w_2',
          userId: demoId,
          name: 'Humo karta',
          type: 'card',
          balance: 3200000,
          currency: 'UZS',
          color: '#F59E0B',
          icon: 'CreditCard',
          accountNumber: '*1042',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'w_3',
          userId: demoId,
          name: 'Naqd pul hamyoni',
          type: 'cash',
          balance: 1800000,
          currency: 'UZS',
          color: '#3B82F6',
          icon: 'Banknote',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'w_4',
          userId: demoId,
          name: 'AQSH Dollari (Visa)',
          type: 'card',
          balance: 450,
          currency: 'USD',
          color: '#06B6D4',
          icon: 'CreditCard',
          accountNumber: '*9901',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    // 2. Subscriptions
    if (!this.data.subscriptions[demoId] || this.data.subscriptions[demoId].length === 0) {
      this.data.subscriptions[demoId] = [
        {
          id: 'sub_1',
          userId: demoId,
          serviceName: 'YouTube Premium',
          amount: 45000,
          currency: 'UZS',
          billingInterval: 'monthly',
          nextPaymentDate: '2026-11-20',
          walletName: 'Asosiy karta (Uzcard)',
          status: 'active',
          categoryName: 'Hordiq va koʻngilochar',
          icon: 'Youtube',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'sub_2',
          userId: demoId,
          serviceName: 'Uy interneti (Uztelecom)',
          amount: 180000,
          currency: 'UZS',
          billingInterval: 'monthly',
          nextPaymentDate: '2026-11-25',
          walletName: 'Asosiy karta (Uzcard)',
          status: 'active',
          categoryName: 'Kommunal toʻlovlar',
          icon: 'Wifi',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'sub_3',
          userId: demoId,
          serviceName: 'Telegram Premium',
          amount: 35000,
          currency: 'UZS',
          billingInterval: 'monthly',
          nextPaymentDate: '2026-11-18',
          walletName: 'Humo karta',
          status: 'active',
          categoryName: 'Hordiq va koʻngilochar',
          icon: 'Send',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'sub_4',
          userId: demoId,
          serviceName: 'Sport zal oylik abonementi',
          amount: 400000,
          currency: 'UZS',
          billingInterval: 'monthly',
          nextPaymentDate: '2026-12-01',
          walletName: 'Asosiy karta (Uzcard)',
          status: 'active',
          categoryName: 'Salomatlik va dori',
          icon: 'Dumbbell',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    // 3. Recurring Transactions
    if (!this.data.recurringTransactions[demoId] || this.data.recurringTransactions[demoId].length === 0) {
      this.data.recurringTransactions[demoId] = [
        {
          id: 'rec_1',
          userId: demoId,
          type: 'income',
          amount: 15000000,
          currency: 'UZS',
          categoryId: 'inc_salary',
          categoryName: 'Oylik maosh',
          description: 'Oylik ish haqi',
          paymentMethod: 'card',
          frequency: 'monthly',
          nextExecutionDate: '2026-12-01',
          status: 'active',
          idempotencyKeyPrefix: 'salary_monthly',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'rec_2',
          userId: demoId,
          type: 'expense',
          amount: 800000,
          currency: 'UZS',
          categoryId: 'exp_housing',
          categoryName: 'Uy-joy va ijara',
          description: 'Uy kommunal xizmatlari',
          paymentMethod: 'bank',
          frequency: 'monthly',
          nextExecutionDate: '2026-12-05',
          status: 'active',
          idempotencyKeyPrefix: 'housing_monthly',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    // 4. Family Group
    const famId = 'fam_qodirovlar_2026';
    if (!this.data.familyGroups[famId]) {
      this.data.familyGroups[famId] = {
        id: famId,
        name: 'Qodirovlar oilasi budjeti',
        ownerId: demoId,
        currency: 'UZS',
        monthlyBudget: 14000000,
        createdAt: new Date().toISOString(),
      };
      this.data.familyMembers[famId] = [
        {
          id: 'fm_1',
          familyId: famId,
          userId: demoId,
          email: 'demo@hisobot.uz',
          fullName: 'Anvar Qodirov',
          role: 'owner',
          joinedAt: new Date().toISOString(),
        },
        {
          id: 'fm_2',
          familyId: famId,
          userId: 'usr_malika_qodirova',
          email: 'malika@hisobot.uz',
          fullName: 'Malika Qodirova',
          role: 'admin',
          joinedAt: new Date().toISOString(),
        },
        {
          id: 'fm_3',
          familyId: famId,
          userId: 'usr_jasur_qodirov',
          email: 'jasur@hisobot.uz',
          fullName: 'Jasur Qodirov (Farzand)',
          role: 'member',
          joinedAt: new Date().toISOString(),
        },
      ];
      this.data.users[demoId].familyGroupId = famId;
    }

    // 5. Bank Connections
    if (!this.data.bankConnections[demoId] || this.data.bankConnections[demoId].length === 0) {
      this.data.bankConnections[demoId] = [
        {
          id: 'bank_uzum_1',
          userId: demoId,
          bankId: 'uzum_bank',
          bankName: 'Uzum Bank (Online banking)',
          logo: 'ShoppingBag',
          status: 'connected',
          lastSyncAt: getTodayDateString(),
          accounts: [
            {
              id: 'acc_uzum_1',
              name: 'Uzum Karta (Virtual Humo)',
              type: 'Humo',
              balance: 3200000,
              currency: 'UZS',
              mask: '*1042',
            },
          ],
        },
        {
          id: 'bank_kapital_1',
          userId: demoId,
          bankId: 'kapitalbank',
          bankName: 'Kapitalbank (Visa / Uzcard)',
          logo: 'Building2',
          status: 'connected',
          lastSyncAt: getTodayDateString(),
          accounts: [
            {
              id: 'acc_kapital_1',
              name: 'Oylik kartasi (Uzcard)',
              type: 'Uzcard',
              balance: 8400000,
              currency: 'UZS',
              mask: '*8824',
            },
            {
              id: 'acc_kapital_2',
              name: 'Xalqaro valyuta kartasi',
              type: 'Visa Classic',
              balance: 450,
              currency: 'USD',
              mask: '*9901',
            },
          ],
        },
      ];
    }

    // 6. Telegram Connection
    if (!this.data.telegramConnections[demoId]) {
      this.data.telegramConnections[demoId] = {
        userId: demoId,
        isConnected: true,
        telegramUsername: '@anvar_qodirov',
        chatId: '89472619',
        connectCode: 'HISOBOT-7842',
        preferences: {
          dailyReport: true,
          weeklyReport: true,
          budgetAlerts: true,
          subscriptionAlerts: true,
        },
        connectedAt: '2026-10-15T12:00:00.000Z',
      };
    }

    this.persist();
  }

  // Auth Operations
  registerUser(email: string, password: string, fullName: string): { user: UserProfile; token: string } {
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    if (!cleanEmail || !password || !cleanName) {
      throw new Error('Barcha maydonlarni toʻldiring');
    }
    if (password.length < 6) {
      throw new Error('Parol kamida 6 belgidan iborat boʻlishi kerak');
    }
    const existing = Object.values(this.data.users).find(
      (u) => u.email.trim().toLowerCase() === cleanEmail.toLowerCase()
    );
    if (existing) {
      throw new Error('Ushbu elektron pochta allaqachon roʻyxatdan oʻtgan');
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const nowIso = new Date().toISOString();
    const newUser: UserRecord = {
      id: userId,
      email: cleanEmail,
      fullName: cleanName,
      currency: 'UZS',
      language: 'uz',
      theme: 'light',
      monthlyBudget: 5000000,
      notificationPrefs: {
        budgetAlerts: true,
        debtReminders: true,
        goalMilestones: true,
        weeklySummary: true,
        subscriptionAlerts: true,
        telegramSync: false,
      },
      lastActiveAt: nowIso,
      createdAt: nowIso,
      passwordHash,
      salt,
    };

    this.data.users[userId] = newUser;
    this.data.transactions[userId] = [];
    this.data.categories[userId] = [];
    this.data.budgets[userId] = [];
    this.data.goals[userId] = [];
    this.data.debts[userId] = [];
    this.data.wallets[userId] = [
      {
        id: `w_${crypto.randomUUID()}`,
        userId,
        name: 'Asosiy karta',
        type: 'card',
        balance: 0,
        currency: 'UZS',
        color: '#10B981',
        createdAt: new Date().toISOString(),
      },
      {
        id: `w_${crypto.randomUUID()}`,
        userId,
        name: 'Naqd pul',
        type: 'cash',
        balance: 0,
        currency: 'UZS',
        color: '#3B82F6',
        createdAt: new Date().toISOString(),
      },
    ];
    this.data.subscriptions[userId] = [];
    this.data.recurringTransactions[userId] = [];
    this.data.receipts[userId] = [];
    this.data.bankConnections[userId] = [];
    this.data.telegramConnections[userId] = {
      userId,
      isConnected: false,
      connectCode: `HISOBOT-${Math.floor(1000 + Math.random() * 9000)}`,
      preferences: {
        dailyReport: true,
        weeklyReport: true,
        budgetAlerts: true,
        subscriptionAlerts: true,
      },
    };

    this.data.notifications[userId] = [
      {
        id: `notif_${crypto.randomUUID()}`,
        userId,
        title: 'HISOBOT AI ga xush kelibsiz!',
        message: 'Shaxsiy moliyangizni aqlli boshqarishni bugunoq boshlang. Birinchi kirim yoki chiqimingizni qoʻshing!',
        type: 'monthly_summary',
        date: getTodayDateString(),
        isRead: false,
        linkTab: 'dashboard',
      },
    ];

    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions[token] = userId;
    this.persist();

    return { user: this.sanitizeUser(newUser), token };
  }

  loginUser(email: string, password: string): { user: UserProfile; token: string } {
    const cleanEmail = email.trim().toLowerCase();
    const user = Object.values(this.data.users).find((u) => u.email.trim().toLowerCase() === cleanEmail);
    if (!user || (process.env.NODE_ENV === 'production' && user.id === 'usr_demo_hisobot_2026')) {
      throw new Error('Elektron pochta yoki parol notoʻgʻri');
    }

    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error('Elektron pochta yoki parol notoʻgʻri');
    }

    if (user.isSuspended) {
      throw new Error('Hisobingiz vaqtincha bloklangan. Administrator bilan bogʻlaning.');
    }

    user.lastActiveAt = new Date().toISOString();
    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions[token] = user.id;
    this.persist();

    return { user: this.sanitizeUser(user), token };
  }

  getUserByToken(token: string): UserProfile | null {
    const userId = this.data.sessions[token];
    if (!userId) return null;
    const user = this.data.users[userId];
    if (!user || user.isSuspended) return null;

    const nowMs = Date.now();
    const prevMs = user.lastActiveAt ? Date.parse(user.lastActiveAt) : 0;
    if (!Number.isFinite(prevMs) || nowMs - prevMs >= 60_000) {
      user.lastActiveAt = new Date(nowMs).toISOString();
      this.persist();
    }

    return this.sanitizeUser(user);
  }

  getUserById(userId: string): UserProfile | null {
    const user = this.data.users[userId];
    if (!user) return null;
    return this.sanitizeUser(user);
  }

  logout(token: string) {
    delete this.data.sessions[token];
    this.persist();
  }

  logoutAllDevices(userId: string): number {
    let cleared = 0;
    for (const [token, uid] of Object.entries(this.data.sessions)) {
      if (uid === userId) {
        delete this.data.sessions[token];
        cleared += 1;
      }
    }
    if (cleared > 0) {
      this.persist();
    }
    return cleared;
  }

  verifyUserPassword(userId: string, password: string): boolean {
    const user = this.data.users[userId];
    if (!user || !password) return false;
    return hashPassword(password, user.salt) === user.passwordHash;
  }

  forgotPassword(email: string): string {
    const user = Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return 'Agar elektron pochta mavjud boʻlsa, parolni tiklash yoʻriqnomasi yuborildi.';
    }
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetToken = resetCode;
    this.persist();
    return `Parolni tiklash kodi: ${resetCode} (Tizimda parolni yangilashingiz mumkin)`;
  }

  resetPasswordWithCode(email: string, code: string, newPass: string) {
    const user = Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.resetToken !== code) {
      throw new Error('Tiklash kodi yaroqsiz yoki eskirgan');
    }
    const salt = crypto.randomBytes(16).toString('hex');
    user.passwordHash = hashPassword(newPass, salt);
    user.salt = salt;
    delete user.resetToken;
    this.persist();
  }

  updateProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    const user = this.data.users[userId];
    if (!user) throw new Error('Foydalanuvchi topilmadi');

    // Whitelist ONLY user-editable fields; NEVER allow tampering with id, email, isPremium, familyGroupId!
    if (typeof updates.fullName === 'string' && updates.fullName.trim()) {
      user.fullName = updates.fullName.trim();
    }
    if (typeof updates.avatarUrl === 'string') {
      const nextAvatar = updates.avatarUrl.trim();
      const isSafeAvatar =
        nextAvatar === '' ||
        (nextAvatar.length <= 450_000 &&
          (nextAvatar.startsWith('/assets/') ||
            nextAvatar.startsWith('/src/assets/') ||
            /^https?:\/\//i.test(nextAvatar) ||
            /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(nextAvatar)));
      if (!isSafeAvatar) {
        throw new Error('Profil rasmi formati notoʻgʻri yoki hajmi juda katta');
      }
      user.avatarUrl = nextAvatar || '/src/assets/images/avatar_user_profile_1794280921902.jpg';
    }
    if (updates.currency !== undefined) user.currency = updates.currency;
    if (updates.theme === 'light' || updates.theme === 'dark') user.theme = updates.theme;
    if (updates.monthlyBudget !== undefined) {
      const budget = Math.round(Number(updates.monthlyBudget));
      if (!Number.isFinite(budget) || budget < 0) {
        throw new Error('Oylik budjet notoʻgʻri kiritildi');
      }
      user.monthlyBudget = budget;
    }
    if (updates.notificationPrefs !== undefined && typeof updates.notificationPrefs === 'object') {
      user.notificationPrefs = { ...user.notificationPrefs, ...updates.notificationPrefs };
    }

    this.persist();
    return this.sanitizeUser(user);
  }

  upgradeToPremium(userId: string, plan: 'pro' | 'business', durationMonths: number = 1): UserProfile {
    const user = this.data.users[userId];
    if (!user) throw new Error('Foydalanuvchi topilmadi');

    user.isPremium = true;
    user.premiumPlan = plan;

    const expiresDate = new Date();
    expiresDate.setMonth(expiresDate.getMonth() + durationMonths);
    user.premiumExpiresAt = expiresDate.toISOString().split('T')[0];

    if (!this.data.notifications[userId]) {
      this.data.notifications[userId] = [];
    }
    this.data.notifications[userId].unshift({
      id: `notif_prem_${Date.now()}`,
      userId,
      title: 'Tabriklaymiz! HISOBOT AI Premium faollashtirildi',
      message: `Siz muvaffaqiyatli ${plan === 'business' ? 'Business' : 'Pro'} tarifiga obuna boʻldingiz. Barcha cheklovlar olib tashlandi!`,
      type: 'monthly_summary',
      date: getTodayDateString(),
      isRead: false,
      linkTab: 'settings',
    });

    this.persist();
    return this.sanitizeUser(user);
  }

  changePassword(userId: string, oldPass: string, newPass: string) {
    const user = this.data.users[userId];
    if (!user) throw new Error('Foydalanuvchi topilmadi');

    const oldHash = hashPassword(oldPass, user.salt);
    if (oldHash !== user.passwordHash) {
      throw new Error('Amaldagi parol notoʻgʻri');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    user.passwordHash = hashPassword(newPass, salt);
    user.salt = salt;
    this.persist();
  }

  private sanitizeUser(user: UserRecord): UserProfile {
    // Strip secrets and any persisted client-side role field so server re-evaluates it dynamically
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, salt, resetToken, isSuperAdmin: _stripAdmin, ...rest } = user;
    return rest;
  }

  // --- Transactions CRUD ---
  getTransactions(userId: string): Transaction[] {
    return (this.data.transactions[userId] || []).sort(
      (a, b) => new Date(b.date + 'T' + (b.time || '00:00')).getTime() - new Date(a.date + 'T' + (a.time || '00:00')).getTime()
    );
  }

  addTransaction(userId: string, tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>): Transaction {
    const amount = Math.round(Number(tx.amount));
    if (tx.type !== 'income' && tx.type !== 'expense') {
      throw new Error('Tranzaksiya turi notoʻgʻri');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Tranzaksiya summasi noldan katta boʻlishi kerak');
    }

    // Validate & sync wallet balance BEFORE mutating transactions array
    if (tx.walletId) {
      this.updateWalletBalanceOnTx(userId, tx.walletId, amount, tx.type);
    }

    const id = `tx_${crypto.randomUUID()}`;
    const newTx: Transaction = {
      ...tx,
      id,
      userId,
      amount,
      createdAt: new Date().toISOString(),
    };

    if (!this.data.transactions[userId]) {
      this.data.transactions[userId] = [];
    }
    this.data.transactions[userId].unshift(newTx);

    // Check budget alert threshold
    if (newTx.type === 'expense') {
      this.checkBudgetThreshold(userId, newTx);
    }

    this.persist();
    return newTx;
  }

  updateTransaction(userId: string, id: string, updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>): Transaction {
    const list = this.data.transactions[userId] || [];
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) throw new Error('Tranzaksiya topilmadi');

    const oldTx = list[index];
    const nextType = updates.type !== undefined ? updates.type : oldTx.type;
    if (nextType !== 'income' && nextType !== 'expense') {
      throw new Error('Tranzaksiya turi notoʻgʻri');
    }
    const nextAmount = updates.amount !== undefined ? Math.round(Number(updates.amount)) : oldTx.amount;
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new Error('Tranzaksiya summasi noldan katta boʻlishi kerak');
    }

    const oldWalletId = oldTx.walletId || undefined;
    const nextWalletId = updates.walletId !== undefined ? updates.walletId || undefined : oldWalletId;

    // Synchronize wallet balance atomically with validation before writing
    const wallets = this.data.wallets[userId] || [];
    if (oldWalletId && oldWalletId === nextWalletId) {
      const w = wallets.find((item) => item.id === oldWalletId);
      if (w) {
        const delta =
          (oldTx.type === 'income' ? -oldTx.amount : oldTx.amount) +
          (nextType === 'income' ? nextAmount : -nextAmount);
        if (w.balance + delta < 0) {
          throw new Error('Hamyonda yetarli mablagʻ mavjud emas');
        }
        w.balance += delta;
      }
    } else {
      if (oldWalletId) {
        const oldW = wallets.find((item) => item.id === oldWalletId);
        if (oldW) {
          const reverseDelta = oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
          if (oldW.balance + reverseDelta < 0) {
            throw new Error('Oldingi hamyon balansini tuzatib boʻlmadi');
          }
          oldW.balance += reverseDelta;
        }
      }
      if (nextWalletId) {
        const newW = wallets.find((item) => item.id === nextWalletId && !item.isArchived);
        if (!newW) {
          // Rollback oldW if we already adjusted it
          if (oldWalletId) {
            const oldW = wallets.find((item) => item.id === oldWalletId);
            if (oldW) {
              oldW.balance -= oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
            }
          }
          throw new Error('Tanlangan hamyon topilmadi');
        }
        const applyDelta = nextType === 'income' ? nextAmount : -nextAmount;
        if (newW.balance + applyDelta < 0) {
          if (oldWalletId) {
            const oldW = wallets.find((item) => item.id === oldWalletId);
            if (oldW) {
              oldW.balance -= oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
            }
          }
          throw new Error('Hamyonda yetarli mablagʻ mavjud emas');
        }
        newW.balance += applyDelta;
      }
    }

    const { id: _ignoreId, userId: _ignoreUser, createdAt: _ignoreCreated, ...safeUpdates } = updates as Partial<Transaction>;
    const updated: Transaction = {
      ...oldTx,
      ...safeUpdates,
      type: nextType,
      amount: nextAmount,
      walletId: nextWalletId,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    this.persist();
    return updated;
  }

  deleteTransaction(userId: string, id: string): boolean {
    const list = this.data.transactions[userId] || [];
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) return false;
    const oldTx = list[index];
    if (oldTx.walletId) {
      const wallets = this.data.wallets[userId] || [];
      const w = wallets.find((item) => item.id === oldTx.walletId);
      if (w) {
        w.balance += oldTx.type === 'income' ? -oldTx.amount : oldTx.amount;
      }
    }
    list.splice(index, 1);
    this.persist();
    return true;
  }

  // --- Categories CRUD ---
  getCategories(userId: string): Category[] {
    const custom = this.data.categories[userId] || [];
    const defaults = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES].map((c) => ({
      ...c,
      userId,
    }));
    return [...defaults, ...custom];
  }

  addCategory(userId: string, cat: { name: string; type: 'income' | 'expense'; icon: string; color: string }): Category {
    const id = `cat_custom_${crypto.randomUUID()}`;
    const newCat: Category = {
      id,
      name: cat.name,
      type: cat.type,
      icon: cat.icon || 'Tag',
      color: cat.color || '#3B82F6',
      isCustom: true,
      userId,
    };
    if (!this.data.categories[userId]) this.data.categories[userId] = [];
    this.data.categories[userId].push(newCat);
    this.persist();
    return newCat;
  }

  deleteCategory(userId: string, id: string): boolean {
    const list = this.data.categories[userId] || [];
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  // --- Budgets CRUD ---
  getBudgets(userId: string): Budget[] {
    return this.data.budgets[userId] || [];
  }

  setBudget(userId: string, budgetData: Omit<Budget, 'id' | 'userId'>): Budget {
    if (!this.data.budgets[userId]) this.data.budgets[userId] = [];
    const list = this.data.budgets[userId];
    const existingIndex = list.findIndex(
      (b) => b.categoryId === budgetData.categoryId && b.month === budgetData.month
    );

    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        monthlyLimit: Math.round(Number(budgetData.monthlyLimit)),
        alertThreshold: budgetData.alertThreshold || 80,
      };
      this.persist();
      return list[existingIndex];
    } else {
      const newBudget: Budget = {
        ...budgetData,
        id: `bdg_${crypto.randomUUID()}`,
        userId,
        monthlyLimit: Math.round(Number(budgetData.monthlyLimit)),
        alertThreshold: budgetData.alertThreshold || 80,
      };
      list.push(newBudget);
      this.persist();
      return newBudget;
    }
  }

  deleteBudget(userId: string, id: string): boolean {
    const list = this.data.budgets[userId] || [];
    const index = list.findIndex((b) => b.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  private checkBudgetThreshold(userId: string, tx: Transaction) {
    const currentMonth = tx.date.substring(0, 7);
    const budgets = this.getBudgets(userId).filter(
      (b) => (b.categoryId === tx.categoryId || b.categoryName === tx.categoryName) && b.month === currentMonth
    );

    if (budgets.length === 0) return;

    const allTx = this.getTransactions(userId).filter(
      (t) =>
        t.type === 'expense' &&
        t.date.startsWith(currentMonth) &&
        (t.categoryId === tx.categoryId || t.categoryName === tx.categoryName)
    );
    const totalSpent = allTx.reduce((sum, t) => sum + t.amount, 0);

    for (const b of budgets) {
      const percentage = Math.round((totalSpent / b.monthlyLimit) * 100);
      if (percentage >= b.alertThreshold) {
        this.addNotification(userId, {
          title: `Budjet ogohlantirishi: ${b.categoryName}`,
          message: `${b.categoryName} boʻyicha sarf-xarajatingiz belgilangan budjetning ${percentage}% qismiga yetdi (${new Intl.NumberFormat('uz-UZ').format(totalSpent)} / ${new Intl.NumberFormat('uz-UZ').format(b.monthlyLimit)} soʻm).`,
          type: 'budget_warning',
          linkTab: 'budgets',
        });
      }
    }
  }

  // --- Financial Goals CRUD ---
  getGoals(userId: string): FinancialGoal[] {
    return this.data.goals[userId] || [];
  }

  addGoal(userId: string, goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>): FinancialGoal {
    const id = `goal_${crypto.randomUUID()}`;
    const newGoal: FinancialGoal = {
      ...goal,
      id,
      userId,
      targetAmount: Math.round(Number(goal.targetAmount)),
      savedAmount: Math.round(Number(goal.savedAmount || 0)),
      createdAt: new Date().toISOString(),
      isCompleted: (goal.savedAmount || 0) >= goal.targetAmount,
    };
    if (!this.data.goals[userId]) this.data.goals[userId] = [];
    this.data.goals[userId].push(newGoal);
    this.persist();
    return newGoal;
  }

  updateGoal(userId: string, id: string, updates: Partial<FinancialGoal>): FinancialGoal {
    const list = this.data.goals[userId] || [];
    const index = list.findIndex((g) => g.id === id);
    if (index === -1) throw new Error('Maqsad topilmadi');

    const updated = {
      ...list[index],
      ...updates,
      isCompleted:
        (updates.savedAmount !== undefined ? updates.savedAmount : list[index].savedAmount) >=
        (updates.targetAmount !== undefined ? updates.targetAmount : list[index].targetAmount),
    };
    list[index] = updated;
    this.persist();
    return updated;
  }

  depositToGoal(userId: string, id: string, amount: number, walletId?: string): FinancialGoal {
    const numAmount = Math.round(Number(amount));
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Depozit summasi noldan katta boʻlishi kerak');
    }

    const list = this.data.goals[userId] || [];
    const goal = list.find((g) => g.id === id);
    if (!goal) throw new Error('Maqsad topilmadi');

    if (walletId) {
      const wallet = (this.data.wallets[userId] || []).find((w) => w.id === walletId && !w.isArchived);
      if (!wallet) throw new Error('Tanlangan hamyon topilmadi');
      if (wallet.balance < numAmount) throw new Error('Hamyonda yetarli mablagʻ mavjud emas');
      wallet.balance -= numAmount;
    }

    const wasCompleted = Boolean(goal.isCompleted);
    goal.savedAmount += numAmount;
    if (goal.savedAmount >= goal.targetAmount) {
      goal.isCompleted = true;
      if (!wasCompleted) {
        this.addNotification(userId, {
          title: `Maqsadga erishildi!`,
          message: `Tabriklaymiz! Siz "${goal.name}" uchun koʻzlangan ${new Intl.NumberFormat('uz-UZ').format(goal.targetAmount)} soʻm mablagʻni muvaffaqiyatli toʻpladingiz!`,
          type: 'goal_reached',
          linkTab: 'goals',
        });
      }
    }
    this.persist();
    return goal;
  }

  deleteGoal(userId: string, id: string): boolean {
    const list = this.data.goals[userId] || [];
    const index = list.findIndex((g) => g.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  // --- Debts CRUD ---
  getDebts(userId: string): Debt[] {
    return this.data.debts[userId] || [];
  }

  addDebt(userId: string, debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>): Debt {
    const id = `debt_${crypto.randomUUID()}`;
    const amount = Math.round(Number(debt.amount));
    const paidAmount = Math.round(Number(debt.paidAmount || 0));
    const remainingAmount = Math.max(0, amount - paidAmount);

    let status: Debt['status'] = debt.status || 'active';
    if (remainingAmount === 0) status = 'paid';
    else if (paidAmount > 0) status = 'partial';

    const newDebt: Debt = {
      ...debt,
      id,
      userId,
      amount,
      paidAmount,
      remainingAmount,
      status,
    };
    if (!this.data.debts[userId]) this.data.debts[userId] = [];
    this.data.debts[userId].push(newDebt);
    this.persist();
    return newDebt;
  }

  updateDebt(userId: string, id: string, updates: Partial<Debt>): Debt {
    const list = this.data.debts[userId] || [];
    const index = list.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Qarz yozuvi topilmadi');

    const item = list[index];
    const amount = updates.amount !== undefined ? Math.round(Number(updates.amount)) : item.amount;
    const paidAmount = updates.paidAmount !== undefined ? Math.round(Number(updates.paidAmount)) : item.paidAmount;
    const remainingAmount = Math.max(0, amount - paidAmount);

    let status = updates.status || item.status;
    if (remainingAmount === 0) status = 'paid';
    else if (paidAmount > 0) status = 'partial';

    const updated: Debt = {
      ...item,
      ...updates,
      amount,
      paidAmount,
      remainingAmount,
      status,
    };

    list[index] = updated;
    this.persist();
    return updated;
  }

  payDebt(userId: string, id: string, payment: number, walletId?: string): Debt {
    const pay = Math.round(Number(payment));
    if (!Number.isFinite(pay) || pay <= 0) {
      throw new Error('Toʻlov summasi noldan katta boʻlishi kerak');
    }

    const list = this.data.debts[userId] || [];
    const debt = list.find((d) => d.id === id);
    if (!debt) throw new Error('Qarz topilmadi');
    if (debt.remainingAmount <= 0) {
      throw new Error('Ushbu qarz allaqachon toʻliq yopilgan');
    }
    if (pay > debt.remainingAmount) {
      throw new Error('Toʻlov summasi qolgan qarzdan oshmasligi kerak');
    }

    if (walletId) {
      const wallet = (this.data.wallets[userId] || []).find((w) => w.id === walletId && !w.isArchived);
      if (!wallet) throw new Error('Tanlangan hamyon topilmadi');
      if (debt.type === 'borrowed' && wallet.balance < pay) {
        throw new Error('Hamyonda yetarli mablagʻ mavjud emas');
      }
      wallet.balance += debt.type === 'borrowed' ? -pay : pay;
    }

    debt.paidAmount += pay;
    debt.remainingAmount = Math.max(0, debt.amount - debt.paidAmount);
    debt.status = debt.remainingAmount === 0 ? 'paid' : 'partial';

    this.persist();
    return debt;
  }

  deleteDebt(userId: string, id: string): boolean {
    const list = this.data.debts[userId] || [];
    const index = list.findIndex((d) => d.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  // --- Notifications ---
  getNotifications(userId: string): NotificationItem[] {
    return (this.data.notifications[userId] || []).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  addNotification(userId: string, notif: Omit<NotificationItem, 'id' | 'userId' | 'date' | 'isRead'>): NotificationItem {
    const newNotif: NotificationItem = {
      id: `notif_${crypto.randomUUID()}`,
      userId,
      ...notif,
      date: getTodayDateString(),
      isRead: false,
    };
    if (!this.data.notifications[userId]) this.data.notifications[userId] = [];
    this.data.notifications[userId].unshift(newNotif);
    this.persist();
    return newNotif;
  }

  markNotificationRead(userId: string, id: string) {
    const list = this.data.notifications[userId] || [];
    const item = list.find((n) => n.id === id);
    if (item) item.isRead = true;
    this.persist();
  }

  markAllNotificationsRead(userId: string) {
    const list = this.data.notifications[userId] || [];
    list.forEach((n) => (n.isRead = true));
    this.persist();
  }

  // ==========================================
  // --- 1. WALLETS & CARDS MANAGEMENT ---
  // ==========================================
  getWallets(userId: string): Wallet[] {
    return (this.data.wallets[userId] || []).filter((w) => !w.isArchived);
  }

  addWallet(userId: string, wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt'>): Wallet {
    const balance = Math.round(Number(wallet.balance ?? 0));
    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error('Hamyon balansi manfiy boʻlishi yoki notoʻgʻri boʻlishi mumkin emas');
    }
    const newWallet: Wallet = {
      id: `wallet_${crypto.randomUUID()}`,
      userId,
      name: String(wallet.name || 'Yangi hamyon').trim(),
      type: wallet.type || 'card',
      currency: wallet.currency || 'UZS',
      balance,
      color: wallet.color || '#10B981',
      icon: wallet.icon,
      accountNumber: wallet.accountNumber,
      isArchived: Boolean(wallet.isArchived),
      createdAt: new Date().toISOString(),
    };
    if (!this.data.wallets[userId]) this.data.wallets[userId] = [];
    this.data.wallets[userId].push(newWallet);
    this.persist();
    return newWallet;
  }

  updateWallet(userId: string, id: string, updates: Partial<Wallet>): Wallet {
    const list = this.data.wallets[userId] || [];
    const index = list.findIndex((w) => w.id === id);
    if (index === -1) throw new Error('Hamyon topilmadi');

    const cur = list[index];
    const nextBalance = updates.balance !== undefined ? Math.round(Number(updates.balance)) : cur.balance;
    if (!Number.isFinite(nextBalance) || nextBalance < 0) {
      throw new Error('Hamyon balansi manfiy boʻlishi yoki notoʻgʻri boʻlishi mumkin emas');
    }

    list[index] = {
      ...cur,
      ...(typeof updates.name === 'string' && updates.name.trim() ? { name: updates.name.trim() } : {}),
      ...(updates.type !== undefined ? { type: updates.type } : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
      ...(updates.color !== undefined ? { color: updates.color } : {}),
      ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
      ...(updates.accountNumber !== undefined ? { accountNumber: updates.accountNumber } : {}),
      ...(updates.isArchived !== undefined ? { isArchived: Boolean(updates.isArchived) } : {}),
      balance: nextBalance,
    };
    this.persist();
    return list[index];
  }

  archiveWallet(userId: string, id: string): boolean {
    const list = this.data.wallets[userId] || [];
    const item = list.find((w) => w.id === id);
    if (!item) return false;
    item.isArchived = true;
    this.persist();
    return true;
  }

  // CRITICAL TRANSFER LOGIC: Deduct from source, add to dest, record transfer, DO NOT add income/expense
  transferBetweenWallets(
    userId: string,
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    targetAmount?: number,
    notes?: string
  ): WalletTransfer {
    const list = this.data.wallets[userId] || [];
    const fromWallet = list.find((w) => w.id === fromWalletId && !w.isArchived);
    const toWallet = list.find((w) => w.id === toWalletId && !w.isArchived);

    if (!fromWallet || !toWallet) {
      throw new Error('Tanlangan hamyonlar topilmadi');
    }
    if (fromWallet.id === toWallet.id) {
      throw new Error('Bir xil hamyonlar oʻrtasida oʻtkazma qilib boʻlmaydi');
    }

    const numAmount = Math.round(Number(amount));
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Oʻtkazma summasi noldan katta boʻlishi kerak');
    }

    let destAmount: number;
    if (targetAmount !== undefined && targetAmount !== null) {
      destAmount = Math.round(Number(targetAmount));
    } else if (fromWallet.currency !== toWallet.currency) {
      const fromRate = DEFAULT_EXCHANGE_RATES[fromWallet.currency] || 1;
      const toRate = DEFAULT_EXCHANGE_RATES[toWallet.currency] || 1;
      destAmount = Math.max(1, Math.round((numAmount * fromRate) / toRate));
    } else {
      destAmount = numAmount;
    }

    if (!Number.isFinite(destAmount) || destAmount <= 0) {
      throw new Error('Qabul qiluvchi summa noldan katta boʻlishi kerak');
    }

    if (fromWallet.balance < numAmount) {
      throw new Error('Manba hamyonda yetarli mablagʻ mavjud emas');
    }

    fromWallet.balance -= numAmount;
    toWallet.balance += destAmount;

    const transfer: WalletTransfer = {
      id: `tr_${crypto.randomUUID()}`,
      userId,
      fromWalletId,
      fromWalletName: fromWallet.name,
      toWalletId,
      toWalletName: toWallet.name,
      amount: numAmount,
      targetAmount: destAmount,
      date: getTodayDateString(),
      notes: notes || 'Hamyonlararo ichki oʻtkazma',
      createdAt: new Date().toISOString(),
    };

    if (!this.data.walletTransfers[userId]) this.data.walletTransfers[userId] = [];
    this.data.walletTransfers[userId].unshift(transfer);

    this.persist();
    return transfer;
  }

  getWalletTransfers(userId: string): WalletTransfer[] {
    return this.data.walletTransfers[userId] || [];
  }

  private updateWalletBalanceOnTx(userId: string, walletId: string, amount: number, type: 'income' | 'expense') {
    const wallets = this.data.wallets[userId] || [];
    const wallet = wallets.find((w) => w.id === walletId && !w.isArchived);
    if (!wallet) {
      throw new Error('Tanlangan hamyon topilmadi');
    }
    if (type === 'income') {
      wallet.balance += amount;
    } else {
      if (wallet.balance < amount) {
        throw new Error('Hamyonda yetarli mablagʻ mavjud emas');
      }
      wallet.balance -= amount;
    }
  }

  // ==========================================
  // --- 2. FAMILY BUDGET MANAGEMENT ---
  // ==========================================
  getFamilyGroup(userId: string): { group: FamilyGroup | null; members: FamilyMember[]; invitations: FamilyInvitation[] } {
    const user = this.data.users[userId];
    if (!user || !user.familyGroupId) {
      return { group: null, members: [], invitations: [] };
    }
    const group = this.data.familyGroups[user.familyGroupId] || null;
    const members = this.data.familyMembers[user.familyGroupId] || [];
    const invitations = this.data.familyInvitations[user.familyGroupId] || [];
    return { group, members, invitations };
  }

  createFamilyGroup(userId: string, name: string, monthlyBudget: number): FamilyGroup {
    const familyId = `fam_${crypto.randomUUID()}`;
    const group: FamilyGroup = {
      id: familyId,
      name,
      ownerId: userId,
      currency: 'UZS',
      monthlyBudget: Math.round(Number(monthlyBudget) || 10000000),
      createdAt: new Date().toISOString(),
    };

    this.data.familyGroups[familyId] = group;
    const user = this.data.users[userId];
    user.familyGroupId = familyId;

    this.data.familyMembers[familyId] = [
      {
        id: `fm_${crypto.randomUUID()}`,
        familyId,
        userId,
        email: user.email,
        fullName: user.fullName,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      },
    ];

    this.data.familyInvitations[familyId] = [];
    this.persist();
    return group;
  }

  inviteFamilyMember(userId: string, email: string, role: 'admin' | 'member' | 'viewer'): FamilyInvitation {
    const user = this.data.users[userId];
    if (!user?.familyGroupId) throw new Error('Siz hali oilaviy guruhga aʼzo emassiz');

    const familyId = user.familyGroupId;
    const members = this.data.familyMembers[familyId] || [];
    const currentMember = members.find((m) => m.userId === userId);
    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'admin')) {
      throw new Error('Faqat oila egasi yoki admin yangi aʼzo taklif qila oladi');
    }

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Yaroqli elektron pochta manzilini kiriting');
    }

    const inviteCode = `FAM-${Math.floor(100000 + Math.random() * 900000)}`;

    const inv: FamilyInvitation = {
      id: `inv_${crypto.randomUUID()}`,
      familyId,
      email: cleanEmail,
      role,
      inviteCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (!this.data.familyInvitations[familyId]) this.data.familyInvitations[familyId] = [];
    this.data.familyInvitations[familyId].push(inv);
    this.persist();
    return inv;
  }

  acceptFamilyInvite(userId: string, inviteCode: string): FamilyGroup {
    const user = this.data.users[userId];
    if (!user) throw new Error('Foydalanuvchi topilmadi');

    const cleanCode = String(inviteCode || '').trim().toUpperCase();
    let matchedInv: FamilyInvitation | null = null;
    let targetFamilyId: string | null = null;

    for (const [famId, list] of Object.entries(this.data.familyInvitations)) {
      const found = list.find((i) => i.inviteCode.toUpperCase() === cleanCode && i.status === 'pending');
      if (found) {
        matchedInv = found;
        targetFamilyId = famId;
        break;
      }
    }

    if (!matchedInv || !targetFamilyId) {
      throw new Error('Taklif kodi notoʻgʻri yoki muddati tugagan');
    }

    if (matchedInv.expiresAt && new Date(matchedInv.expiresAt).getTime() <= Date.now()) {
      matchedInv.status = 'declined';
      this.persist();
      throw new Error('Taklif kodining amal qilish muddati tugagan');
    }

    if (matchedInv.email && matchedInv.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      throw new Error('Ushbu taklif kodi boshqa elektron pochta uchun yaratilgan');
    }

    const group = this.data.familyGroups[targetFamilyId];
    if (!group) {
      throw new Error('Oilaviy guruh topilmadi');
    }

    matchedInv.status = 'accepted';
    user.familyGroupId = targetFamilyId;

    if (!this.data.familyMembers[targetFamilyId]) {
      this.data.familyMembers[targetFamilyId] = [];
    }
    const alreadyMember = this.data.familyMembers[targetFamilyId].some((m) => m.userId === userId);
    if (!alreadyMember) {
      this.data.familyMembers[targetFamilyId].push({
        id: `fm_${crypto.randomUUID()}`,
        familyId: targetFamilyId,
        userId,
        email: user.email,
        fullName: user.fullName,
        role: matchedInv.role,
        joinedAt: new Date().toISOString(),
      });
    }

    this.persist();
    return group;
  }

  getFamilyTransactions(userId: string): Transaction[] {
    const user = this.data.users[userId];
    if (!user?.familyGroupId) return [];
    const members = this.data.familyMembers[user.familyGroupId] || [];
    const allFamTx: Transaction[] = [];

    for (const m of members) {
      const userTx = (this.data.transactions[m.userId] || []).filter((t) => t.isFamilyShared !== false);
      allFamTx.push(...userTx);
    }

    return allFamTx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // ==========================================
  // --- 3. SUBSCRIPTIONS MANAGEMENT ---
  // ==========================================
  getSubscriptions(userId: string): Subscription[] {
    return this.data.subscriptions[userId] || [];
  }

  addSubscription(userId: string, sub: Omit<Subscription, 'id' | 'userId' | 'createdAt'>): Subscription {
    const amount = Math.round(Number(sub.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Obuna summasi noldan katta boʻlishi kerak');
    }
    const newSub: Subscription = {
      id: `sub_${crypto.randomUUID()}`,
      userId,
      serviceName: String(sub.serviceName || '').trim(),
      amount,
      currency: sub.currency || 'UZS',
      billingInterval: sub.billingInterval || 'monthly',
      nextPaymentDate: sub.nextPaymentDate,
      categoryName: sub.categoryName || 'Obunalar va xizmatlar',
      status: sub.status || 'active',
      notes: sub.notes,
      createdAt: new Date().toISOString(),
    };
    if (!this.data.subscriptions[userId]) this.data.subscriptions[userId] = [];
    this.data.subscriptions[userId].push(newSub);
    this.persist();
    return newSub;
  }

  updateSubscription(userId: string, id: string, updates: Partial<Subscription>): Subscription {
    const list = this.data.subscriptions[userId] || [];
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) throw new Error('Obuna topilmadi');

    const cur = list[index];
    const nextAmount = updates.amount !== undefined ? Math.round(Number(updates.amount)) : cur.amount;
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new Error('Obuna summasi noldan katta boʻlishi kerak');
    }

    list[index] = {
      ...cur,
      ...(typeof updates.serviceName === 'string' && updates.serviceName.trim()
        ? { serviceName: updates.serviceName.trim() }
        : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
      ...(updates.billingInterval !== undefined ? { billingInterval: updates.billingInterval } : {}),
      ...(updates.nextPaymentDate !== undefined ? { nextPaymentDate: updates.nextPaymentDate } : {}),
      ...(updates.categoryName !== undefined ? { categoryName: updates.categoryName } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      amount: nextAmount,
    };
    this.persist();
    return list[index];
  }

  deleteSubscription(userId: string, id: string): boolean {
    const list = this.data.subscriptions[userId] || [];
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  // ==========================================
  // --- 4. RECURRING PAYMENTS ---
  // ==========================================
  getRecurringTransactions(userId: string): RecurringTransaction[] {
    return this.data.recurringTransactions[userId] || [];
  }

  addRecurringTransaction(userId: string, rec: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>): RecurringTransaction {
    const amount = Math.round(Number(rec.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Doimiy toʻlov summasi noldan katta boʻlishi kerak');
    }
    const newRec: RecurringTransaction = {
      id: `rec_${crypto.randomUUID()}`,
      userId,
      description: String(rec.description || '').trim(),
      amount,
      type: rec.type,
      currency: rec.currency || 'UZS',
      frequency: rec.frequency,
      categoryId: rec.categoryId,
      categoryName: rec.categoryName,
      walletId: rec.walletId,
      paymentMethod: rec.paymentMethod,
      nextExecutionDate: rec.nextExecutionDate,
      status: rec.status || 'active',
      notes: rec.notes,
      idempotencyKeyPrefix: rec.idempotencyKeyPrefix || `rec_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    if (!this.data.recurringTransactions[userId]) this.data.recurringTransactions[userId] = [];
    this.data.recurringTransactions[userId].push(newRec);
    this.persist();
    return newRec;
  }

  updateRecurringTransaction(userId: string, id: string, updates: Partial<RecurringTransaction>): RecurringTransaction {
    const list = this.data.recurringTransactions[userId] || [];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) throw new Error('Doimiy toʻlov topilmadi');

    const cur = list[index];
    const nextAmount = updates.amount !== undefined ? Math.round(Number(updates.amount)) : cur.amount;
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      throw new Error('Doimiy toʻlov summasi noldan katta boʻlishi kerak');
    }

    list[index] = {
      ...cur,
      ...(typeof updates.description === 'string' && updates.description.trim()
        ? { description: updates.description.trim() }
        : {}),
      ...(updates.type !== undefined ? { type: updates.type } : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
      ...(updates.frequency !== undefined ? { frequency: updates.frequency } : {}),
      ...(updates.categoryId !== undefined ? { categoryId: updates.categoryId } : {}),
      ...(updates.categoryName !== undefined ? { categoryName: updates.categoryName } : {}),
      ...(updates.walletId !== undefined ? { walletId: updates.walletId } : {}),
      ...(updates.paymentMethod !== undefined ? { paymentMethod: updates.paymentMethod } : {}),
      ...(updates.nextExecutionDate !== undefined ? { nextExecutionDate: updates.nextExecutionDate } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      amount: nextAmount,
    };
    this.persist();
    return list[index];
  }

  deleteRecurringTransaction(userId: string, id: string): boolean {
    const list = this.data.recurringTransactions[userId] || [];
    const index = list.findIndex((r) => r.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  executeRecurringSchedule(userId: string, recId: string): Transaction {
    const list = this.data.recurringTransactions[userId] || [];
    const rec = list.find((r) => r.id === recId);
    if (!rec) throw new Error('Doimiy toʻlov topilmadi');

    // Create transaction
    const tx = this.addTransaction(userId, {
      type: rec.type,
      amount: rec.amount,
      categoryId: rec.categoryId,
      categoryName: rec.categoryName,
      walletId: rec.walletId,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      description: `${rec.description} (Avtomatik qayd)`,
      paymentMethod: rec.paymentMethod,
      notes: `Rejalashtirilgan toʻlov jadvallari orqali avtomatik kiritildi`,
    });

    // Advance nextExecutionDate
    const d = new Date();
    if (rec.frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (rec.frequency === 'monthly') d.setMonth(d.getMonth() + 1);
    else if (rec.frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (rec.frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);

    rec.nextExecutionDate = d.toISOString().split('T')[0];
    rec.lastExecutedAt = new Date().toISOString();

    // Log
    if (!this.data.recurringLogs[userId]) this.data.recurringLogs[userId] = [];
    this.data.recurringLogs[userId].unshift({
      id: `log_${crypto.randomUUID()}`,
      userId,
      recurringId: rec.id,
      description: rec.description,
      amount: rec.amount,
      type: rec.type,
      executedAt: new Date().toISOString(),
      status: 'success',
      message: 'Muvaffaqiyatli tranzaksiya yaratildi',
    });

    this.persist();
    return tx;
  }

  getRecurringLogs(userId: string): RecurringExecutionLog[] {
    return this.data.recurringLogs[userId] || [];
  }

  // ==========================================
  // --- 5. RECEIPT SCANNER WITH OCR ---
  // ==========================================
  getReceipts(userId: string): ScannedReceipt[] {
    return (this.data.receipts[userId] || []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  saveReceipt(userId: string, receipt: Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'>): ScannedReceipt {
    const newReceipt: ScannedReceipt = {
      ...receipt,
      id: `rcp_${crypto.randomUUID()}`,
      userId,
      createdAt: new Date().toISOString(),
    };
    if (!this.data.receipts[userId]) this.data.receipts[userId] = [];
    this.data.receipts[userId].unshift(newReceipt);
    this.persist();
    return newReceipt;
  }

  linkReceiptTransaction(userId: string, receiptId: string, transactionId: string): ScannedReceipt | null {
    const list = this.data.receipts[userId] || [];
    const item = list.find((r) => r.id === receiptId);
    if (!item) return null;
    item.transactionId = transactionId;
    this.persist();
    return item;
  }

  // ==========================================
  // --- 6. BANK INTEGRATION ---
  // ==========================================
  getBankConnections(userId: string): BankConnection[] {
    return this.data.bankConnections[userId] || [];
  }

  connectBank(userId: string, bankId: string, bankName: string): BankConnection {
    const connection: BankConnection = {
      id: `bank_conn_${crypto.randomUUID()}`,
      userId,
      bankId,
      bankName,
      logo: 'Building',
      status: 'connected',
      lastSyncAt: getTodayDateString(),
      accounts: [
        {
          id: `acc_${crypto.randomUUID()}`,
          name: `${bankName} Asosiy hisob`,
          type: 'Debet karta',
          balance: 2500000,
          currency: 'UZS',
          mask: `*${Math.floor(1000 + Math.random() * 9000)}`,
        },
      ],
    };

    if (!this.data.bankConnections[userId]) this.data.bankConnections[userId] = [];
    this.data.bankConnections[userId].push(connection);
    this.persist();
    return connection;
  }

  disconnectBank(userId: string, id: string): boolean {
    const list = this.data.bankConnections[userId] || [];
    const index = list.findIndex((b) => b.id === id);
    if (index === -1) return false;
    list.splice(index, 1);
    this.persist();
    return true;
  }

  syncBank(userId: string, id: string): { importedCount: number; message: string } {
    const list = this.data.bankConnections[userId] || [];
    const bank = list.find((b) => b.id === id);
    if (!bank) throw new Error('Bank aloqasi topilmadi');

    bank.lastSyncAt = getTodayDateString();

    // Create sample synced transactions with duplicate prevention
    const sampleTxs = [
      {
        type: 'expense' as const,
        amount: 85000,
        categoryName: 'Oziq-ovqat va kafe',
        description: `${bank.bankName} orqali toʻlov: Supermarket`,
        paymentMethod: 'card' as const,
        date: getTodayDateString(),
      },
      {
        type: 'expense' as const,
        amount: 45000,
        categoryName: 'Transport va yoqilgʻi',
        description: `${bank.bankName} orqali toʻlov: Yandex Taxi`,
        paymentMethod: 'card' as const,
        date: getTodayDateString(),
      },
    ];

    let imported = 0;
    const existing = this.getTransactions(userId);
    for (const t of sampleTxs) {
      const isDup = existing.some(
        (ex) => ex.date === t.date && ex.amount === t.amount && ex.description === t.description
      );
      if (!isDup) {
        this.addTransaction(userId, {
          ...t,
          categoryId: t.categoryName.includes('Transport') ? 'exp_transport' : 'exp_food',
          time: getCurrentTimeString(),
          notes: `${bank.bankName} sinxronizatsiyasi orqali import qilindi`,
        });
        imported++;
      }
    }

    if (!this.data.bankSyncLogs[userId]) this.data.bankSyncLogs[userId] = [];
    this.data.bankSyncLogs[userId].unshift({
      id: `sync_${crypto.randomUUID()}`,
      userId,
      bankName: bank.bankName,
      syncedAt: new Date().toISOString(),
      importedCount: imported,
      status: 'success',
    });

    this.persist();
    return { importedCount: imported, message: `${imported} ta yangi tranzaksiya yuklandi` };
  }

  // ==========================================
  // --- 7. TELEGRAM BOT INTEGRATION ---
  // ==========================================
  getTelegramConnection(userId: string): TelegramConnection {
    if (!this.data.telegramConnections[userId]) {
      this.data.telegramConnections[userId] = {
        userId,
        isConnected: false,
        connectCode: `HISOBOT-${Math.floor(1000 + Math.random() * 9000)}`,
        preferences: {
          dailyReport: true,
          weeklyReport: true,
          budgetAlerts: true,
          subscriptionAlerts: true,
        },
      };
      this.persist();
    }
    return this.data.telegramConnections[userId];
  }

  updateTelegramPrefs(userId: string, prefs: TelegramConnection['preferences']): TelegramConnection {
    const conn = this.getTelegramConnection(userId);
    conn.preferences = { ...conn.preferences, ...prefs };
    this.persist();
    return conn;
  }

  connectTelegram(userId: string, username: string): TelegramConnection {
    const conn = this.getTelegramConnection(userId);
    conn.isConnected = true;
    conn.telegramUsername = username.startsWith('@') ? username : `@${username}`;
    conn.chatId = String(Math.floor(10000000 + Math.random() * 90000000));
    conn.connectedAt = new Date().toISOString();
    this.persist();
    return conn;
  }

  disconnectTelegram(userId: string): TelegramConnection {
    const conn = this.getTelegramConnection(userId);
    conn.isConnected = false;
    delete conn.telegramUsername;
    delete conn.chatId;
    conn.connectCode = `HISOBOT-${Math.floor(1000 + Math.random() * 9000)}`;
    this.persist();
    return conn;
  }

  // ==========================================
  // --- 8. MULTI-CURRENCY CONVERTER ---
  // ==========================================
  getExchangeRates(): ExchangeRate[] {
    const today = getTodayDateString();
    return [
      { code: 'USD', name: 'AQSH dollari', rate: 12850, diff: +15, date: today },
      { code: 'EUR', name: 'Yevro', rate: 13920, diff: -25, date: today },
      { code: 'RUB', name: 'Rossiya rubli', rate: 132, diff: +0.4, date: today },
      { code: 'GBP', name: 'Angliya funt sterlingi', rate: 16650, diff: +40, date: today },
      { code: 'TRY', name: 'Turkiya lirasi', rate: 375, diff: -1.2, date: today },
      { code: 'KZT', name: 'Qozogʻiston tengesi', rate: 26.5, diff: +0.1, date: today },
      { code: 'UZS', name: 'Oʻzbek soʻmi', rate: 1, diff: 0, date: today },
    ];
  }

  convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): { result: number; rate: number } {
    const rates = DEFAULT_EXCHANGE_RATES;
    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;

    // Convert from source to UZS, then from UZS to destination
    const inUZS = amount * fromRate;
    const result = inUZS / toRate;
    const directRate = fromRate / toRate;

    return {
      result: Math.round(result * 100) / 100,
      rate: Math.round(directRate * 10000) / 10000,
    };
  }

  // ==========================================
  // --- 9. SUPER ADMIN, TELEMETRY & CONFIG ---
  // ==========================================
  recordAiUsageEvent(event: Omit<AiUsageEvent, 'id' | 'createdAt'>): AiUsageEvent {
    const entry: AiUsageEvent = {
      ...event,
      id: `ai_ev_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.aiUsageEvents.unshift(entry);
    if (this.data.aiUsageEvents.length > 5000) {
      this.data.aiUsageEvents.length = 5000;
    }
    this.persist();
    return entry;
  }

  recordApiErrorEvent(event: Omit<ApiErrorEvent, 'id' | 'createdAt'>): ApiErrorEvent {
    const entry: ApiErrorEvent = {
      ...event,
      id: `err_ev_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.apiErrorEvents.unshift(entry);
    if (this.data.apiErrorEvents.length > 2000) {
      this.data.apiErrorEvents.length = 2000;
    }
    this.persist();
    return entry;
  }

  getAppConfig(): AppRuntimeConfig {
    return {
      ...DEFAULT_APP_RUNTIME_CONFIG,
      ...(this.data.appConfig || {}),
    };
  }

  updateAppConfig(updates: Partial<AppRuntimeConfig>, updatedBy: string): AppRuntimeConfig {
    const next = sanitizeRuntimeConfigUpdate(this.getAppConfig(), updates, updatedBy);
    this.data.appConfig = next;
    this.persist();
    return next;
  }

  addAdminAuditLog(entry: Omit<AdminAuditLog, 'id' | 'createdAt'>): AdminAuditLog {
    const log: AdminAuditLog = {
      ...entry,
      id: `aud_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    this.data.adminAuditLogs.unshift(log);
    if (this.data.adminAuditLogs.length > 5000) {
      this.data.adminAuditLogs.length = 5000;
    }
    this.persist();
    return log;
  }

  listAdminAuditLogs(params: {
    action?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): { logs: AdminAuditLog[]; total: number; page: number; limit: number } {
    const safeLimit = Math.min(50, Math.max(1, Math.round(Number(params.limit) || 20)));
    const safePage = Math.max(1, Math.round(Number(params.page) || 1));
    let filtered = [...this.data.adminAuditLogs];

    if (params.action && params.action !== 'all') {
      filtered = filtered.filter((l) => l.action === params.action);
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.adminEmail.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.targetId.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q)
      );
    }

    const start = (safePage - 1) * safeLimit;
    return {
      logs: filtered.slice(start, start + safeLimit),
      total: filtered.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  private buildAllUserSummaries(): AdminUserSummary[] {
    const sessionCounts = new Map<string, number>();
    for (const uid of Object.values(this.data.sessions)) {
      sessionCounts.set(uid, (sessionCounts.get(uid) || 0) + 1);
    }

    return Object.values(this.data.users).map((u) => {
      const sanitized = this.sanitizeUser(u);
      const isPrem = Boolean(sanitized.isPremium);
      const plan: 'free' | 'pro' | 'business' =
        isPrem && (sanitized.premiumPlan === 'pro' || sanitized.premiumPlan === 'business')
          ? sanitized.premiumPlan
          : 'free';

      return {
        id: sanitized.id,
        email: sanitized.email,
        fullName: sanitized.fullName,
        avatarUrl: sanitized.avatarUrl,
        currency: sanitized.currency,
        isPremium: isPrem,
        premiumPlan: plan,
        premiumExpiresAt: sanitized.premiumExpiresAt,
        isSuspended: Boolean(sanitized.isSuspended),
        isSuperAdmin: isVerifiedSuperAdminUser(sanitized),
        createdAt: sanitized.createdAt,
        lastActiveAt: sanitized.lastActiveAt || sanitized.createdAt,
        transactionCount: (this.data.transactions[sanitized.id] || []).length,
        activeSessionsCount: sessionCounts.get(sanitized.id) || 0,
      };
    });
  }

  listAdminUsers(params: {
    search?: string;
    plan?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): { users: AdminUserSummary[]; total: number; page: number; limit: number } {
    const safeLimit = Math.min(50, Math.max(1, Math.round(Number(params.limit) || 20)));
    const safePage = Math.max(1, Math.round(Number(params.page) || 1));

    let list = this.buildAllUserSummaries().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }
    if (params.plan && params.plan !== 'all') {
      list = list.filter((u) => u.premiumPlan === params.plan);
    }
    if (params.status === 'active') {
      list = list.filter((u) => !u.isSuspended);
    } else if (params.status === 'suspended') {
      list = list.filter((u) => u.isSuspended);
    } else if (params.status === 'admin') {
      list = list.filter((u) => u.isSuperAdmin);
    }

    const start = (safePage - 1) * safeLimit;
    return {
      users: list.slice(start, start + safeLimit),
      total: list.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  adminUpdateUserSubscription(params: {
    adminUser: UserProfile;
    targetUserId: string;
    plan: 'free' | 'pro' | 'business';
    durationMonths: number;
    reason: string;
    ipAddress?: string;
  }): { user: AdminUserSummary; subscriptionEvent: SubscriptionEvent; auditLog: AdminAuditLog } {
    const target = this.data.users[params.targetUserId];
    if (!target) {
      throw new Error('Foydalanuvchi topilmadi');
    }

    const previousPlan: 'free' | 'pro' | 'business' =
      target.isPremium && (target.premiumPlan === 'pro' || target.premiumPlan === 'business')
        ? target.premiumPlan
        : 'free';

    const cfg = this.getAppConfig();
    const safeMonths = params.plan === 'free' ? 0 : Math.min(36, Math.max(1, Math.round(params.durationMonths || 1)));
    let expiresAt: string | undefined;

    if (params.plan === 'free') {
      target.isPremium = false;
      target.premiumPlan = 'free';
      delete target.premiumExpiresAt;
    } else {
      const d = new Date();
      d.setMonth(d.getMonth() + safeMonths);
      expiresAt = d.toISOString().split('T')[0];
      target.isPremium = true;
      target.premiumPlan = params.plan;
      target.premiumExpiresAt = expiresAt;
    }

    const unitPrice =
      params.plan === 'business' ? cfg.businessMonthlyPriceUzs : params.plan === 'pro' ? cfg.proMonthlyPriceUzs : 0;
    const amountUzs = unitPrice * safeMonths;

    const subscriptionEvent: SubscriptionEvent = {
      id: `sub_ev_${crypto.randomUUID()}`,
      userId: target.id,
      userEmail: target.email,
      userFullName: target.fullName,
      plan: params.plan,
      previousPlan,
      amountUzs,
      currency: 'UZS',
      source: 'admin_grant',
      actorUserId: params.adminUser.id,
      durationMonths: safeMonths,
      expiresAt,
      reason: params.reason,
      createdAt: new Date().toISOString(),
    };
    this.data.subscriptionEvents.unshift(subscriptionEvent);

    const auditLog = this.addAdminAuditLog({
      adminUserId: params.adminUser.id,
      adminEmail: params.adminUser.email,
      action: 'subscription.update',
      targetType: 'user',
      targetId: target.id,
      reason: params.reason,
      metadata: {
        targetEmail: target.email,
        previousPlan,
        nextPlan: params.plan,
        durationMonths: safeMonths,
        amountUzs,
      },
      ipAddress: params.ipAddress,
    });

    this.persist();
    const updatedSummary = this.buildAllUserSummaries().find((u) => u.id === target.id)!;
    return { user: updatedSummary, subscriptionEvent, auditLog };
  }

  adminSetUserSuspended(params: {
    adminUser: UserProfile;
    targetUserId: string;
    suspended: boolean;
    reason: string;
    ipAddress?: string;
  }): { user: AdminUserSummary; clearedSessions: number; auditLog: AdminAuditLog } {
    const target = this.data.users[params.targetUserId];
    if (!target) {
      throw new Error('Foydalanuvchi topilmadi');
    }
    if (target.id === params.adminUser.id || isVerifiedSuperAdminUser(target)) {
      throw new Error('Super Admin hisobini bloklab boʻlmaydi');
    }

    target.isSuspended = params.suspended;
    let clearedSessions = 0;
    if (params.suspended) {
      clearedSessions = this.logoutAllDevices(target.id);
    }

    const auditLog = this.addAdminAuditLog({
      adminUserId: params.adminUser.id,
      adminEmail: params.adminUser.email,
      action: params.suspended ? 'user.suspend' : 'user.reactivate',
      targetType: 'user',
      targetId: target.id,
      reason: params.reason,
      metadata: {
        targetEmail: target.email,
        suspended: params.suspended,
        clearedSessions,
      },
      ipAddress: params.ipAddress,
    });

    this.persist();
    const updatedSummary = this.buildAllUserSummaries().find((u) => u.id === target.id)!;
    return { user: updatedSummary, clearedSessions, auditLog };
  }

  adminRevokeUserSessions(params: {
    adminUser: UserProfile;
    targetUserId: string;
    reason: string;
    ipAddress?: string;
  }): { clearedSessions: number; auditLog: AdminAuditLog } {
    const target = this.data.users[params.targetUserId];
    if (!target) {
      throw new Error('Foydalanuvchi topilmadi');
    }
    const clearedSessions = this.logoutAllDevices(target.id);
    const auditLog = this.addAdminAuditLog({
      adminUserId: params.adminUser.id,
      adminEmail: params.adminUser.email,
      action: 'user.revoke_sessions',
      targetType: 'user',
      targetId: target.id,
      reason: params.reason,
      metadata: {
        targetEmail: target.email,
        clearedSessions,
      },
      ipAddress: params.ipAddress,
    });
    return { clearedSessions, auditLog };
  }

  getAdminOverviewData(health: {
    ok: boolean;
    backend: 'json' | 'supabase';
    latencyMs: number;
    error?: string;
  }): AdminOverviewData {
    const totalTransactions = Object.values(this.data.transactions).reduce((s, list) => s + list.length, 0);
    return buildAdminOverviewData({
      users: this.buildAllUserSummaries(),
      totalTransactions,
      aiEvents: this.data.aiUsageEvents,
      apiErrors: this.data.apiErrorEvents,
      subscriptionEvents: this.data.subscriptionEvents,
      auditLogs: this.data.adminAuditLogs,
      config: this.getAppConfig(),
      health,
    });
  }

  getAdminSubscriptionsData(params: { page?: number; limit?: number }): AdminSubscriptionsData {
    return buildAdminSubscriptionsData({
      users: this.buildAllUserSummaries(),
      subscriptionEvents: this.data.subscriptionEvents,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
    });
  }

  getAdminRevenueData(): AdminRevenueData {
    return buildAdminRevenueData({
      users: this.buildAllUserSummaries(),
      subscriptionEvents: this.data.subscriptionEvents,
      config: this.getAppConfig(),
    });
  }

  getAdminAiAnalyticsData(): AdminAiAnalyticsData {
    return buildAdminAiAnalyticsData(this.data.aiUsageEvents);
  }

  getAdminSystemHealthData(health: {
    ok: boolean;
    backend: 'json' | 'supabase';
    latencyMs: number;
    error?: string;
  }): AdminSystemHealthData {
    return buildAdminSystemHealthData({
      apiErrors: this.data.apiErrorEvents,
      health,
    });
  }
}

export { Database };
export const db = new Database();
