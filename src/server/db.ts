/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
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
  RecurringTransaction,
  RecurringExecutionLog,
  ScannedReceipt,
  ExchangeRate,
  BankConnection,
  BankSyncLog,
  TelegramConnection,
  CurrencyCode,
} from '../types/finance.ts';
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
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
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
        };
      } else {
        this.seedDemoUser();
        this.persist();
      }

      // Ensure demo user has initial data for the new modules if missing
      this.ensureDemoAdvancedData();
      this.data.sessions['demo_token'] = 'usr_demo_hisobot_2026';
    } catch (e) {
      console.error('Database initialization error, creating fresh state:', e);
      this.seedDemoUser();
      this.data.sessions['demo_token'] = 'usr_demo_hisobot_2026';
      this.persist();
    }
  }

  private persist() {
    try {
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
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
        color: '#8B5CF6',
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
          color: '#8B5CF6',
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
    const existing = Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error('Ushbu elektron pochta allaqachon roʻyxatdan oʻtgan');
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);

    const newUser: UserRecord = {
      id: userId,
      email,
      fullName,
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
      createdAt: new Date().toISOString(),
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
    const user = Object.values(this.data.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('Elektron pochta yoki parol notoʻgʻri');
    }

    const hash = hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      throw new Error('Elektron pochta yoki parol notoʻgʻri');
    }

    const token = crypto.randomBytes(32).toString('hex');
    this.data.sessions[token] = user.id;
    this.persist();

    return { user: this.sanitizeUser(user), token };
  }

  getUserByToken(token: string): UserProfile | null {
    const userId = this.data.sessions[token];
    if (!userId) return null;
    const user = this.data.users[userId];
    if (!user) return null;
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

    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.avatarUrl !== undefined) user.avatarUrl = updates.avatarUrl;
    if (updates.currency !== undefined) user.currency = updates.currency;
    if (updates.theme !== undefined) user.theme = updates.theme;
    if (updates.monthlyBudget !== undefined) user.monthlyBudget = updates.monthlyBudget;
    if (updates.familyGroupId !== undefined) user.familyGroupId = updates.familyGroupId;
    if (updates.notificationPrefs !== undefined) {
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, salt, resetToken, ...rest } = user;
    return rest;
  }

  // --- Transactions CRUD ---
  getTransactions(userId: string): Transaction[] {
    return (this.data.transactions[userId] || []).sort(
      (a, b) => new Date(b.date + 'T' + (b.time || '00:00')).getTime() - new Date(a.date + 'T' + (a.time || '00:00')).getTime()
    );
  }

  addTransaction(userId: string, tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>): Transaction {
    const id = `tx_${crypto.randomUUID()}`;
    const newTx: Transaction = {
      ...tx,
      id,
      userId,
      amount: Math.round(Number(tx.amount)),
      createdAt: new Date().toISOString(),
    };

    if (!this.data.transactions[userId]) {
      this.data.transactions[userId] = [];
    }
    this.data.transactions[userId].unshift(newTx);

    // Sync with wallet balance if walletId provided
    if (newTx.walletId) {
      this.updateWalletBalanceOnTx(userId, newTx.walletId, newTx.amount, newTx.type);
    }

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

    const updated: Transaction = {
      ...list[index],
      ...updates,
      amount: updates.amount !== undefined ? Math.round(Number(updates.amount)) : list[index].amount,
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

  depositToGoal(userId: string, id: string, amount: number): FinancialGoal {
    const list = this.data.goals[userId] || [];
    const goal = list.find((g) => g.id === id);
    if (!goal) throw new Error('Maqsad topilmadi');

    goal.savedAmount += Math.round(Number(amount));
    if (goal.savedAmount >= goal.targetAmount) {
      goal.isCompleted = true;
      this.addNotification(userId, {
        title: `Maqsadga erishildi!`,
        message: `Tabriklaymiz! Siz "${goal.name}" uchun koʻzlangan ${new Intl.NumberFormat('uz-UZ').format(goal.targetAmount)} soʻm mablagʻni muvaffaqiyatli toʻpladingiz!`,
        type: 'goal_reached',
        linkTab: 'goals',
      });
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

  payDebt(userId: string, id: string, payment: number): Debt {
    const list = this.data.debts[userId] || [];
    const debt = list.find((d) => d.id === id);
    if (!debt) throw new Error('Qarz topilmadi');

    const pay = Math.round(Number(payment));
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
    const newWallet: Wallet = {
      ...wallet,
      id: `wallet_${crypto.randomUUID()}`,
      userId,
      balance: Math.round(Number(wallet.balance) || 0),
      currency: wallet.currency || 'UZS',
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

    list[index] = {
      ...list[index],
      ...updates,
      balance: updates.balance !== undefined ? Math.round(Number(updates.balance)) : list[index].balance,
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
    const fromWallet = list.find((w) => w.id === fromWalletId);
    const toWallet = list.find((w) => w.id === toWalletId);

    if (!fromWallet || !toWallet) {
      throw new Error('Tanlangan hamyonlar topilmadi');
    }
    if (fromWallet.id === toWallet.id) {
      throw new Error('Bir xil hamyonlar oʻrtasida oʻtkazma qilib boʻlmaydi');
    }

    const numAmount = Math.round(Number(amount));
    if (numAmount <= 0) {
      throw new Error('Oʻtkazma summasi noldan katta boʻlishi kerak');
    }

    const destAmount = targetAmount ? Math.round(Number(targetAmount)) : numAmount;

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
    const wallet = wallets.find((w) => w.id === walletId);
    if (wallet) {
      if (type === 'income') wallet.balance += amount;
      else wallet.balance -= amount;
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
    const inviteCode = `FAM-${Math.floor(100000 + Math.random() * 900000)}`;

    const inv: FamilyInvitation = {
      id: `inv_${crypto.randomUUID()}`,
      familyId,
      email: email.trim().toLowerCase(),
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

    let matchedInv: FamilyInvitation | null = null;
    let targetFamilyId: string | null = null;

    for (const [famId, list] of Object.entries(this.data.familyInvitations)) {
      const found = list.find((i) => i.inviteCode.toUpperCase() === inviteCode.trim().toUpperCase() && i.status === 'pending');
      if (found) {
        matchedInv = found;
        targetFamilyId = famId;
        break;
      }
    }

    if (!matchedInv || !targetFamilyId) {
      throw new Error('Taklif kodi notoʻgʻri yoki muddati tugagan');
    }

    matchedInv.status = 'accepted';
    user.familyGroupId = targetFamilyId;

    this.data.familyMembers[targetFamilyId].push({
      id: `fm_${crypto.randomUUID()}`,
      familyId: targetFamilyId,
      userId,
      email: user.email,
      fullName: user.fullName,
      role: matchedInv.role,
      joinedAt: new Date().toISOString(),
    });

    this.persist();
    return this.data.familyGroups[targetFamilyId];
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
    const newSub: Subscription = {
      ...sub,
      id: `sub_${crypto.randomUUID()}`,
      userId,
      amount: Math.round(Number(sub.amount)),
      currency: sub.currency || 'UZS',
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

    list[index] = {
      ...list[index],
      ...updates,
      amount: updates.amount !== undefined ? Math.round(Number(updates.amount)) : list[index].amount,
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
    const newRec: RecurringTransaction = {
      ...rec,
      id: `rec_${crypto.randomUUID()}`,
      userId,
      amount: Math.round(Number(rec.amount)),
      currency: rec.currency || 'UZS',
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

    list[index] = {
      ...list[index],
      ...updates,
      amount: updates.amount !== undefined ? Math.round(Number(updates.amount)) : list[index].amount,
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
          categoryId: 'exp_food',
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
}

export const db = new Database();
