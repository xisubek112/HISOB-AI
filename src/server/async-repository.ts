/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  BankConnection,
  Budget,
  Category,
  CurrencyCode,
  Debt,
  ExchangeRate,
  FamilyGroup,
  FamilyInvitation,
  FamilyMember,
  FinancialGoal,
  NotificationItem,
  RecurringExecutionLog,
  RecurringTransaction,
  ScannedReceipt,
  Subscription,
  TelegramConnection,
  Transaction,
  UserProfile,
  Wallet,
  WalletTransfer,
} from '../types/finance.ts';
import { Database, db as defaultJsonDb } from './db.ts';
import { getPostgresStorage, shouldUseSupabaseBackend } from './supabase-storage.ts';
import { SupabaseRepository } from './supabase-repository.ts';

export interface RepositoryHealth {
  ok: boolean;
  backend: 'json' | 'supabase';
  latencyMs: number;
  error?: string;
}

export interface AsyncFinanceRepository {
  readonly backendName: 'json' | 'supabase';
  healthCheck(): Promise<RepositoryHealth>;

  // Auth & Profile
  registerUser(email: string, password: string, fullName: string): Promise<{ user: UserProfile; token: string }>;
  loginUser(email: string, password: string): Promise<{ user: UserProfile; token: string }>;
  getUserByToken(token: string): Promise<UserProfile | null>;
  getUserById(userId: string): Promise<UserProfile | null>;
  logout(token: string): Promise<void>;
  logoutAllDevices(userId: string): Promise<number>;
  verifyUserPassword(userId: string, password: string): Promise<boolean>;
  updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile>;
  changePassword(userId: string, oldPass: string, newPass: string): Promise<void>;

  // Transactions
  getTransactions(userId: string): Promise<Transaction[]>;
  addTransaction(
    userId: string,
    tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>,
    idempotencyKey?: string
  ): Promise<Transaction>;
  addTransactionsBatch(
    userId: string,
    txs: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]
  ): Promise<Transaction[]>;
  updateTransaction(
    userId: string,
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>
  ): Promise<Transaction>;
  deleteTransaction(userId: string, id: string): Promise<boolean>;

  // Categories
  getCategories(userId: string): Promise<Category[]>;
  addCategory(userId: string, cat: { name: string; type: 'income' | 'expense'; icon: string; color: string }): Promise<Category>;
  deleteCategory(userId: string, id: string): Promise<boolean>;

  // Budgets
  getBudgets(userId: string): Promise<Budget[]>;
  setBudget(userId: string, budgetData: Omit<Budget, 'id' | 'userId'>): Promise<Budget>;
  deleteBudget(userId: string, id: string): Promise<boolean>;

  // Goals
  getGoals(userId: string): Promise<FinancialGoal[]>;
  addGoal(userId: string, goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>): Promise<FinancialGoal>;
  updateGoal(userId: string, id: string, updates: Partial<FinancialGoal>): Promise<FinancialGoal>;
  depositToGoal(
    userId: string,
    id: string,
    amount: number,
    walletId?: string,
    idempotencyKey?: string
  ): Promise<FinancialGoal>;
  deleteGoal(userId: string, id: string): Promise<boolean>;

  // Debts
  getDebts(userId: string): Promise<Debt[]>;
  addDebt(userId: string, debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>): Promise<Debt>;
  updateDebt(userId: string, id: string, updates: Partial<Debt>): Promise<Debt>;
  payDebt(
    userId: string,
    id: string,
    payment: number,
    walletId?: string,
    idempotencyKey?: string
  ): Promise<Debt>;
  deleteDebt(userId: string, id: string): Promise<boolean>;

  // Notifications
  getNotifications(userId: string): Promise<NotificationItem[]>;
  addNotification(userId: string, notif: Omit<NotificationItem, 'id' | 'userId' | 'date' | 'isRead'>): Promise<NotificationItem>;
  markNotificationRead(userId: string, id: string): Promise<void>;
  markAllNotificationsRead(userId: string): Promise<void>;

  // Wallets & Transfers
  getWallets(userId: string): Promise<Wallet[]>;
  addWallet(userId: string, wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt'>): Promise<Wallet>;
  updateWallet(userId: string, id: string, updates: Partial<Wallet>): Promise<Wallet>;
  archiveWallet(userId: string, id: string): Promise<boolean>;
  transferBetweenWallets(
    userId: string,
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    targetAmount?: number,
    notes?: string,
    idempotencyKey?: string
  ): Promise<WalletTransfer>;
  getWalletTransfers(userId: string): Promise<WalletTransfer[]>;

  // Family Budget
  getFamilyGroup(userId: string): Promise<{ group: FamilyGroup | null; members: FamilyMember[]; invitations: FamilyInvitation[] }>;
  createFamilyGroup(userId: string, name: string, monthlyBudget: number): Promise<FamilyGroup>;
  inviteFamilyMember(userId: string, email: string, role: 'admin' | 'member' | 'viewer'): Promise<FamilyInvitation>;
  acceptFamilyInvite(userId: string, inviteCode: string): Promise<FamilyGroup>;
  getFamilyTransactions(userId: string): Promise<Transaction[]>;

  // Subscriptions
  getSubscriptions(userId: string): Promise<Subscription[]>;
  addSubscription(userId: string, sub: Omit<Subscription, 'id' | 'userId' | 'createdAt'>): Promise<Subscription>;
  updateSubscription(userId: string, id: string, updates: Partial<Subscription>): Promise<Subscription>;
  deleteSubscription(userId: string, id: string): Promise<boolean>;

  // Recurring Payments
  getRecurringTransactions(userId: string): Promise<RecurringTransaction[]>;
  addRecurringTransaction(userId: string, rec: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>): Promise<RecurringTransaction>;
  updateRecurringTransaction(userId: string, id: string, updates: Partial<RecurringTransaction>): Promise<RecurringTransaction>;
  deleteRecurringTransaction(userId: string, id: string): Promise<boolean>;
  executeRecurringSchedule(userId: string, recId: string, idempotencyKey?: string): Promise<Transaction>;
  getRecurringLogs(userId: string): Promise<RecurringExecutionLog[]>;

  // Receipts
  getReceipts(userId: string): Promise<ScannedReceipt[]>;
  saveReceipt(userId: string, receipt: Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'>): Promise<ScannedReceipt>;
  linkReceiptTransaction(userId: string, receiptId: string, transactionId: string): Promise<ScannedReceipt | null>;

  // Bank Connections
  getBankConnections(userId: string): Promise<BankConnection[]>;
  connectBank(userId: string, bankId: string, bankName: string): Promise<BankConnection>;
  disconnectBank(userId: string, id: string): Promise<boolean>;
  syncBank(userId: string, id: string): Promise<{ importedCount: number; message: string }>;

  // Telegram Connections
  getTelegramConnection(userId: string): Promise<TelegramConnection>;
  updateTelegramPrefs(userId: string, prefs: TelegramConnection['preferences']): Promise<TelegramConnection>;
  connectTelegram(userId: string, username: string): Promise<TelegramConnection>;
  disconnectTelegram(userId: string): Promise<TelegramConnection>;

  // Multi-currency
  getExchangeRates(): ExchangeRate[];
  convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): { result: number; rate: number };
}

export class JsonAsyncRepository implements AsyncFinanceRepository {
  readonly backendName = 'json' as const;
  private readonly idempotencyCache = new Map<string, unknown>();

  constructor(private readonly jsonDb: Database = defaultJsonDb) {}

  private withIdempotency<T>(userId: string, operation: string, key: string | undefined, fn: () => T): T {
    const cleanKey = key?.trim();
    if (!cleanKey) return fn();
    const cacheKey = `${userId}:${operation}:${cleanKey}`;
    if (this.idempotencyCache.has(cacheKey)) {
      return this.idempotencyCache.get(cacheKey) as T;
    }
    const result = fn();
    this.idempotencyCache.set(cacheKey, result);
    if (this.idempotencyCache.size > 5000) {
      const firstKey = this.idempotencyCache.keys().next().value;
      if (firstKey) this.idempotencyCache.delete(firstKey);
    }
    return result;
  }

  async healthCheck(): Promise<RepositoryHealth> {
    const started = Date.now();
    return {
      ok: true,
      backend: 'json',
      latencyMs: Date.now() - started,
    };
  }

  async registerUser(email: string, password: string, fullName: string) {
    return this.jsonDb.registerUser(email, password, fullName);
  }
  async loginUser(email: string, password: string) {
    return this.jsonDb.loginUser(email, password);
  }
  async getUserByToken(token: string) {
    return this.jsonDb.getUserByToken(token);
  }
  async getUserById(userId: string) {
    return this.jsonDb.getUserById(userId);
  }
  async logout(token: string) {
    this.jsonDb.logout(token);
  }
  async logoutAllDevices(userId: string) {
    return this.jsonDb.logoutAllDevices(userId);
  }
  async verifyUserPassword(userId: string, password: string) {
    return this.jsonDb.verifyUserPassword(userId, password);
  }
  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    return this.jsonDb.updateProfile(userId, updates);
  }
  async changePassword(userId: string, oldPass: string, newPass: string) {
    this.jsonDb.changePassword(userId, oldPass, newPass);
  }

  async getTransactions(userId: string) {
    return this.jsonDb.getTransactions(userId);
  }
  async addTransaction(
    userId: string,
    tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>,
    idempotencyKey?: string
  ) {
    return this.withIdempotency(userId, 'add_transaction', idempotencyKey, () =>
      this.jsonDb.addTransaction(userId, tx)
    );
  }
  async addTransactionsBatch(userId: string, txs: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]) {
    const created: Transaction[] = [];
    for (const tx of txs) {
      created.push(this.jsonDb.addTransaction(userId, tx));
    }
    return created;
  }
  async updateTransaction(
    userId: string,
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>
  ) {
    return this.jsonDb.updateTransaction(userId, id, updates);
  }
  async deleteTransaction(userId: string, id: string) {
    return this.jsonDb.deleteTransaction(userId, id);
  }

  async getCategories(userId: string) {
    return this.jsonDb.getCategories(userId);
  }
  async addCategory(userId: string, cat: { name: string; type: 'income' | 'expense'; icon: string; color: string }) {
    return this.jsonDb.addCategory(userId, cat);
  }
  async deleteCategory(userId: string, id: string) {
    return this.jsonDb.deleteCategory(userId, id);
  }

  async getBudgets(userId: string) {
    return this.jsonDb.getBudgets(userId);
  }
  async setBudget(userId: string, budgetData: Omit<Budget, 'id' | 'userId'>) {
    return this.jsonDb.setBudget(userId, budgetData);
  }
  async deleteBudget(userId: string, id: string) {
    return this.jsonDb.deleteBudget(userId, id);
  }

  async getGoals(userId: string) {
    return this.jsonDb.getGoals(userId);
  }
  async addGoal(userId: string, goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>) {
    return this.jsonDb.addGoal(userId, goal);
  }
  async updateGoal(userId: string, id: string, updates: Partial<FinancialGoal>) {
    return this.jsonDb.updateGoal(userId, id, updates);
  }
  async depositToGoal(userId: string, id: string, amount: number, walletId?: string, idempotencyKey?: string) {
    return this.withIdempotency(userId, 'goal_deposit', idempotencyKey, () =>
      this.jsonDb.depositToGoal(userId, id, amount, walletId)
    );
  }
  async deleteGoal(userId: string, id: string) {
    return this.jsonDb.deleteGoal(userId, id);
  }

  async getDebts(userId: string) {
    return this.jsonDb.getDebts(userId);
  }
  async addDebt(userId: string, debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>) {
    return this.jsonDb.addDebt(userId, debt);
  }
  async updateDebt(userId: string, id: string, updates: Partial<Debt>) {
    return this.jsonDb.updateDebt(userId, id, updates);
  }
  async payDebt(userId: string, id: string, payment: number, walletId?: string, idempotencyKey?: string) {
    return this.withIdempotency(userId, 'debt_pay', idempotencyKey, () =>
      this.jsonDb.payDebt(userId, id, payment, walletId)
    );
  }
  async deleteDebt(userId: string, id: string) {
    return this.jsonDb.deleteDebt(userId, id);
  }

  async getNotifications(userId: string) {
    return this.jsonDb.getNotifications(userId);
  }
  async addNotification(userId: string, notif: Omit<NotificationItem, 'id' | 'userId' | 'date' | 'isRead'>) {
    return this.jsonDb.addNotification(userId, notif);
  }
  async markNotificationRead(userId: string, id: string) {
    this.jsonDb.markNotificationRead(userId, id);
  }
  async markAllNotificationsRead(userId: string) {
    this.jsonDb.markAllNotificationsRead(userId);
  }

  async getWallets(userId: string) {
    return this.jsonDb.getWallets(userId);
  }
  async addWallet(userId: string, wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt'>) {
    return this.jsonDb.addWallet(userId, wallet);
  }
  async updateWallet(userId: string, id: string, updates: Partial<Wallet>) {
    return this.jsonDb.updateWallet(userId, id, updates);
  }
  async archiveWallet(userId: string, id: string) {
    return this.jsonDb.archiveWallet(userId, id);
  }
  async transferBetweenWallets(
    userId: string,
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    targetAmount?: number,
    notes?: string,
    idempotencyKey?: string
  ) {
    return this.withIdempotency(userId, 'wallet_transfer', idempotencyKey, () =>
      this.jsonDb.transferBetweenWallets(userId, fromWalletId, toWalletId, amount, targetAmount, notes)
    );
  }
  async getWalletTransfers(userId: string) {
    return this.jsonDb.getWalletTransfers(userId);
  }

  async getFamilyGroup(userId: string) {
    return this.jsonDb.getFamilyGroup(userId);
  }
  async createFamilyGroup(userId: string, name: string, monthlyBudget: number) {
    return this.jsonDb.createFamilyGroup(userId, name, monthlyBudget);
  }
  async inviteFamilyMember(userId: string, email: string, role: 'admin' | 'member' | 'viewer') {
    return this.jsonDb.inviteFamilyMember(userId, email, role);
  }
  async acceptFamilyInvite(userId: string, inviteCode: string) {
    return this.jsonDb.acceptFamilyInvite(userId, inviteCode);
  }
  async getFamilyTransactions(userId: string) {
    return this.jsonDb.getFamilyTransactions(userId);
  }

  async getSubscriptions(userId: string) {
    return this.jsonDb.getSubscriptions(userId);
  }
  async addSubscription(userId: string, sub: Omit<Subscription, 'id' | 'userId' | 'createdAt'>) {
    return this.jsonDb.addSubscription(userId, sub);
  }
  async updateSubscription(userId: string, id: string, updates: Partial<Subscription>) {
    return this.jsonDb.updateSubscription(userId, id, updates);
  }
  async deleteSubscription(userId: string, id: string) {
    return this.jsonDb.deleteSubscription(userId, id);
  }

  async getRecurringTransactions(userId: string) {
    return this.jsonDb.getRecurringTransactions(userId);
  }
  async addRecurringTransaction(userId: string, rec: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>) {
    return this.jsonDb.addRecurringTransaction(userId, rec);
  }
  async updateRecurringTransaction(userId: string, id: string, updates: Partial<RecurringTransaction>) {
    return this.jsonDb.updateRecurringTransaction(userId, id, updates);
  }
  async deleteRecurringTransaction(userId: string, id: string) {
    return this.jsonDb.deleteRecurringTransaction(userId, id);
  }
  async executeRecurringSchedule(userId: string, recId: string, idempotencyKey?: string) {
    return this.withIdempotency(userId, 'execute_recurring', idempotencyKey, () =>
      this.jsonDb.executeRecurringSchedule(userId, recId)
    );
  }
  async getRecurringLogs(userId: string) {
    return this.jsonDb.getRecurringLogs(userId);
  }

  async getReceipts(userId: string) {
    return this.jsonDb.getReceipts(userId);
  }
  async saveReceipt(userId: string, receipt: Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'>) {
    return this.jsonDb.saveReceipt(userId, receipt);
  }
  async linkReceiptTransaction(userId: string, receiptId: string, transactionId: string) {
    return this.jsonDb.linkReceiptTransaction(userId, receiptId, transactionId);
  }

  async getBankConnections(userId: string) {
    return this.jsonDb.getBankConnections(userId);
  }
  async connectBank(userId: string, bankId: string, bankName: string) {
    return this.jsonDb.connectBank(userId, bankId, bankName);
  }
  async disconnectBank(userId: string, id: string) {
    return this.jsonDb.disconnectBank(userId, id);
  }
  async syncBank(userId: string, id: string) {
    return this.jsonDb.syncBank(userId, id);
  }

  async getTelegramConnection(userId: string) {
    return this.jsonDb.getTelegramConnection(userId);
  }
  async updateTelegramPrefs(userId: string, prefs: TelegramConnection['preferences']) {
    return this.jsonDb.updateTelegramPrefs(userId, prefs);
  }
  async connectTelegram(userId: string, username: string) {
    return this.jsonDb.connectTelegram(userId, username);
  }
  async disconnectTelegram(userId: string) {
    return this.jsonDb.disconnectTelegram(userId);
  }

  getExchangeRates() {
    return this.jsonDb.getExchangeRates();
  }
  convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode) {
    return this.jsonDb.convertCurrency(amount, from, to);
  }
}

let cachedRepository: AsyncFinanceRepository | null = null;
let overrideRepository: AsyncFinanceRepository | null = null;

export function getRepository(): AsyncFinanceRepository {
  if (overrideRepository) return overrideRepository;
  if (!cachedRepository) {
    if (shouldUseSupabaseBackend()) {
      cachedRepository = new SupabaseRepository(getPostgresStorage());
    } else {
      cachedRepository = new JsonAsyncRepository(defaultJsonDb);
    }
  }
  return cachedRepository;
}

export function setRepositoryForTests(repo: AsyncFinanceRepository | null): void {
  overrideRepository = repo;
  if (!repo) {
    cachedRepository = null;
  }
}
