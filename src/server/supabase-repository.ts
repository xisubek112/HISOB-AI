/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  BankConnection,
  BankSyncLog,
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
  SubscriptionEvent,
  TelegramConnection,
  Transaction,
  UserProfile,
  Wallet,
  WalletTransfer,
} from '../types/finance.ts';
import {
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/formatters.ts';
import {
  DEFAULT_APP_RUNTIME_CONFIG,
  buildAdminAiAnalyticsData,
  buildAdminOverviewData,
  buildAdminRevenueData,
  buildAdminSubscriptionsData,
  buildAdminSystemHealthData,
  sanitizeRuntimeConfigUpdate,
} from './admin-analytics.ts';
import { isVerifiedSuperAdminUser } from './admin-policy.ts';
import type { AsyncFinanceRepository, RepositoryHealth } from './async-repository.ts';
import { SupabaseAuthService } from './supabase-auth.ts';
import type { PostgresStorage } from './supabase-storage.ts';

type CollectionName =
  | 'transactions'
  | 'categories'
  | 'budgets'
  | 'goals'
  | 'debts'
  | 'notifications'
  | 'wallets'
  | 'walletTransfers'
  | 'familyGroups'
  | 'familyMembers'
  | 'familyInvitations'
  | 'subscriptions'
  | 'recurringTransactions'
  | 'recurringLogs'
  | 'receipts'
  | 'bankConnections'
  | 'bankSyncLogs'
  | 'telegramConnections';

export class SupabaseRepository implements AsyncFinanceRepository {
  readonly backendName = 'supabase' as const;
  private readonly auth: SupabaseAuthService;

  constructor(private readonly storage: PostgresStorage) {
    this.auth = new SupabaseAuthService(storage);
  }

  async healthCheck(): Promise<RepositoryHealth> {
    const check = await this.storage.healthCheck();
    return {
      ok: check.ok,
      backend: 'supabase',
      latencyMs: check.latencyMs,
      error: check.error,
    };
  }

  // --- Generic scoped app_data helpers ---
  private async listUserRecords<T>(userId: string, collection: CollectionName): Promise<T[]> {
    const res = await this.storage.query<{ payload: T }>(
      `SELECT payload
         FROM public.app_data
        WHERE owner_user_id = $1
          AND collection = $2
          AND scope_key = $1
        ORDER BY created_at DESC`,
      [userId, collection],
      { retryable: true, label: `list_${collection}` }
    );
    return res.rows.map((r) => r.payload);
  }

  private async upsertUserRecord<T>(
    ownerUserId: string,
    collection: CollectionName,
    scopeKey: string,
    recordKey: string,
    payload: T
  ): Promise<T> {
    await this.storage.query(
      `INSERT INTO public.app_data (
         owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
       ON CONFLICT (owner_user_id, collection, scope_key, record_key)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [ownerUserId, collection, scopeKey, recordKey, JSON.stringify(payload)],
      { label: `upsert_${collection}` }
    );
    return payload;
  }

  private async deleteUserRecord(userId: string, collection: CollectionName, recordKey: string): Promise<boolean> {
    const res = await this.storage.query(
      `DELETE FROM public.app_data
        WHERE owner_user_id = $1
          AND collection = $2
          AND scope_key = $1
          AND record_key = $3`,
      [userId, collection, recordKey],
      { label: `delete_${collection}` }
    );
    return (res.rowCount || 0) > 0;
  }

  // ==========================================
  // --- AUTH & PROFILE ---
  // ==========================================
  registerUser(email: string, password: string, fullName: string) {
    return this.auth.registerUser(email, password, fullName);
  }
  loginUser(email: string, password: string) {
    return this.auth.loginUser(email, password);
  }
  getUserByToken(token: string) {
    return this.auth.getUserByToken(token);
  }
  getUserById(userId: string) {
    return this.auth.getUserById(userId);
  }
  logout(token: string) {
    return this.auth.logout(token);
  }
  logoutAllDevices(userId: string) {
    return this.auth.logoutAllDevices(userId);
  }
  verifyUserPassword(userId: string, password: string) {
    return this.auth.verifyUserPassword(userId, password);
  }
  updateProfile(userId: string, updates: Partial<UserProfile>) {
    return this.auth.updateProfile(userId, updates);
  }
  changePassword(userId: string, oldPass: string, newPass: string) {
    return this.auth.changePassword(userId, oldPass, newPass);
  }

  // ==========================================
  // --- TRANSACTIONS ---
  // ==========================================
  async getTransactions(userId: string): Promise<Transaction[]> {
    const list = await this.listUserRecords<Transaction>(userId, 'transactions');
    return list.sort(
      (a, b) =>
        new Date(b.date + 'T' + (b.time || '00:00')).getTime() -
        new Date(a.date + 'T' + (a.time || '00:00')).getTime()
    );
  }

  async addTransaction(
    userId: string,
    tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>,
    idempotencyKey?: string
  ): Promise<Transaction> {
    const amount = Math.round(Number(tx.amount));
    if (tx.type !== 'income' && tx.type !== 'expense') {
      throw new Error('Tranzaksiya turi notoʻgʻri');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Tranzaksiya summasi noldan katta boʻlishi kerak');
    }

    const payload = {
      ...tx,
      amount,
      createdAt: new Date().toISOString(),
    };

    const res = await this.storage.query<{ tx: Transaction }>(
      `SELECT public.hisobot_add_transaction($1, $2::jsonb, $3) AS tx`,
      [userId, JSON.stringify(payload), idempotencyKey || null],
      { label: 'rpc_add_transaction' }
    );
    return res.rows[0].tx;
  }

  async addTransactionsBatch(
    userId: string,
    txs: Omit<Transaction, 'id' | 'userId' | 'createdAt'>[]
  ): Promise<Transaction[]> {
    if (txs.length === 0) return [];
    return this.storage.withTransaction(async (client) => {
      const created: Transaction[] = [];
      for (const tx of txs) {
        const amount = Math.round(Number(tx.amount));
        if (tx.type !== 'income' && tx.type !== 'expense') {
          throw new Error('Tranzaksiya turi notoʻgʻri');
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error('Tranzaksiya summasi noldan katta boʻlishi kerak');
        }
        const res = await client.query<{ tx: Transaction }>(
          `SELECT public.hisobot_add_transaction($1, $2::jsonb, null) AS tx`,
          [userId, JSON.stringify({ ...tx, amount, createdAt: new Date().toISOString() })]
        );
        created.push(res.rows[0].tx);
      }
      return created;
    });
  }

  async updateTransaction(
    userId: string,
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'userId' | 'createdAt'>>
  ): Promise<Transaction> {
    const cleanUpdates: Record<string, unknown> = { ...updates };
    if (updates.type !== undefined && updates.type !== 'income' && updates.type !== 'expense') {
      throw new Error('Tranzaksiya turi notoʻgʻri');
    }
    if (updates.amount !== undefined) {
      const amount = Math.round(Number(updates.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Tranzaksiya summasi noldan katta boʻlishi kerak');
      }
      cleanUpdates.amount = amount;
    }

    const res = await this.storage.query<{ tx: Transaction }>(
      `SELECT public.hisobot_update_transaction($1, $2, $3::jsonb) AS tx`,
      [userId, id, JSON.stringify(cleanUpdates)],
      { label: 'rpc_update_transaction' }
    );
    return res.rows[0].tx;
  }

  async deleteTransaction(userId: string, id: string): Promise<boolean> {
    const res = await this.storage.query<{ deleted: boolean }>(
      `SELECT public.hisobot_delete_transaction($1, $2) AS deleted`,
      [userId, id],
      { label: 'rpc_delete_transaction' }
    );
    return Boolean(res.rows[0]?.deleted);
  }

  // ==========================================
  // --- CATEGORIES ---
  // ==========================================
  async getCategories(userId: string): Promise<Category[]> {
    const custom = await this.listUserRecords<Category>(userId, 'categories');
    const defaults = [...DEFAULT_INCOME_CATEGORIES, ...DEFAULT_EXPENSE_CATEGORIES].map((c) => ({
      ...c,
      userId,
    }));
    return [...defaults, ...custom];
  }

  async addCategory(
    userId: string,
    cat: { name: string; type: 'income' | 'expense'; icon: string; color: string }
  ): Promise<Category> {
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
    return this.upsertUserRecord(userId, 'categories', userId, id, newCat);
  }

  deleteCategory(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'categories', id);
  }

  // ==========================================
  // --- BUDGETS ---
  // ==========================================
  getBudgets(userId: string): Promise<Budget[]> {
    return this.listUserRecords<Budget>(userId, 'budgets');
  }

  async setBudget(userId: string, budgetData: Omit<Budget, 'id' | 'userId'>): Promise<Budget> {
    const monthlyLimit = Math.round(Number(budgetData.monthlyLimit));
    if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
      throw new Error('Budjet limiti noldan katta boʻlishi kerak');
    }

    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ record_key: string; payload: Budget }>(
        `SELECT record_key, payload
           FROM public.app_data
          WHERE owner_user_id = $1
            AND collection = 'budgets'
            AND scope_key = $1
            AND payload->>'categoryId' = $2
            AND payload->>'month' = $3
          LIMIT 1
          FOR UPDATE`,
        [userId, budgetData.categoryId, budgetData.month]
      );

      if (existing.rows[0]) {
        const current = existing.rows[0].payload;
        const updated: Budget = {
          ...current,
          monthlyLimit,
          alertThreshold: budgetData.alertThreshold || 80,
        };
        await client.query(
          `UPDATE public.app_data
              SET payload = $1::jsonb, updated_at = now()
            WHERE owner_user_id = $2
              AND collection = 'budgets'
              AND scope_key = $2
              AND record_key = $3`,
          [JSON.stringify(updated), userId, existing.rows[0].record_key]
        );
        return updated;
      }

      const id = `bdg_${crypto.randomUUID()}`;
      const newBudget: Budget = {
        ...budgetData,
        id,
        userId,
        monthlyLimit,
        alertThreshold: budgetData.alertThreshold || 80,
      };
      await client.query(
        `INSERT INTO public.app_data (
           owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
         ) VALUES ($1, 'budgets', $1, $2, $3::jsonb, now(), now())`,
        [userId, id, JSON.stringify(newBudget)]
      );
      return newBudget;
    });
  }

  deleteBudget(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'budgets', id);
  }

  // ==========================================
  // --- FINANCIAL GOALS ---
  // ==========================================
  getGoals(userId: string): Promise<FinancialGoal[]> {
    return this.listUserRecords<FinancialGoal>(userId, 'goals');
  }

  async addGoal(userId: string, goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>): Promise<FinancialGoal> {
    const id = `goal_${crypto.randomUUID()}`;
    const targetAmount = Math.round(Number(goal.targetAmount));
    const savedAmount = Math.round(Number(goal.savedAmount || 0));
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      throw new Error('Maqsad summasi noldan katta boʻlishi kerak');
    }
    if (!Number.isFinite(savedAmount) || savedAmount < 0) {
      throw new Error('Jamgʻarilgan summa manfiy boʻlishi mumkin emas');
    }
    const newGoal: FinancialGoal = {
      ...goal,
      id,
      userId,
      targetAmount,
      savedAmount,
      createdAt: new Date().toISOString(),
      isCompleted: savedAmount >= targetAmount,
    };
    return this.upsertUserRecord(userId, 'goals', userId, id, newGoal);
  }

  async updateGoal(userId: string, id: string, updates: Partial<FinancialGoal>): Promise<FinancialGoal> {
    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ payload: FinancialGoal }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'goals' AND scope_key = $1 AND record_key = $2
          FOR UPDATE`,
        [userId, id]
      );
      if (!existing.rows[0]) throw new Error('Maqsad topilmadi');
      const cur = existing.rows[0].payload;
      const savedAmount = updates.savedAmount !== undefined ? Math.round(Number(updates.savedAmount)) : cur.savedAmount;
      const targetAmount = updates.targetAmount !== undefined ? Math.round(Number(updates.targetAmount)) : cur.targetAmount;
      if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        throw new Error('Maqsad summasi noldan katta boʻlishi kerak');
      }
      if (!Number.isFinite(savedAmount) || savedAmount < 0) {
        throw new Error('Jamgʻarilgan summa manfiy boʻlishi mumkin emas');
      }
      const { id: _i, userId: _u, createdAt: _c, ...safeUpdates } = updates;
      const updated: FinancialGoal = {
        ...cur,
        ...safeUpdates,
        savedAmount,
        targetAmount,
        isCompleted: savedAmount >= targetAmount,
      };
      await client.query(
        `UPDATE public.app_data SET payload = $1::jsonb, updated_at = now()
          WHERE owner_user_id = $2 AND collection = 'goals' AND scope_key = $2 AND record_key = $3`,
        [JSON.stringify(updated), userId, id]
      );
      return updated;
    });
  }

  async depositToGoal(
    userId: string,
    id: string,
    amount: number,
    walletId?: string,
    idempotencyKey?: string
  ): Promise<FinancialGoal> {
    const numAmount = Math.round(Number(amount));
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Depozit summasi noldan katta boʻlishi kerak');
    }
    const res = await this.storage.query<{ goal: FinancialGoal }>(
      `SELECT public.hisobot_deposit_to_goal($1, $2, $3, $4, $5) AS goal`,
      [userId, id, numAmount, walletId || null, idempotencyKey || null],
      { label: 'rpc_deposit_to_goal' }
    );
    return res.rows[0].goal;
  }

  deleteGoal(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'goals', id);
  }

  // ==========================================
  // --- DEBTS ---
  // ==========================================
  getDebts(userId: string): Promise<Debt[]> {
    return this.listUserRecords<Debt>(userId, 'debts');
  }

  async addDebt(userId: string, debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>): Promise<Debt> {
    const id = `debt_${crypto.randomUUID()}`;
    const amount = Math.round(Number(debt.amount));
    const paidAmount = Math.round(Number(debt.paidAmount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Qarz summasi noldan katta boʻlishi kerak');
    }
    if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > amount) {
      throw new Error('Toʻlangan summa notoʻgʻri kiritildi');
    }
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
    return this.upsertUserRecord(userId, 'debts', userId, id, newDebt);
  }

  async updateDebt(userId: string, id: string, updates: Partial<Debt>): Promise<Debt> {
    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ payload: Debt }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'debts' AND scope_key = $1 AND record_key = $2
          FOR UPDATE`,
        [userId, id]
      );
      if (!existing.rows[0]) throw new Error('Qarz yozuvi topilmadi');
      const item = existing.rows[0].payload;
      const amount = updates.amount !== undefined ? Math.round(Number(updates.amount)) : item.amount;
      const paidAmount = updates.paidAmount !== undefined ? Math.round(Number(updates.paidAmount)) : item.paidAmount;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Qarz summasi noldan katta boʻlishi kerak');
      }
      if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > amount) {
        throw new Error('Toʻlangan summa notoʻgʻri kiritildi');
      }
      const remainingAmount = Math.max(0, amount - paidAmount);
      let status = updates.status || item.status;
      if (remainingAmount === 0) status = 'paid';
      else if (paidAmount > 0) status = 'partial';

      const { id: _i, userId: _u, ...safeUpdates } = updates;
      const updated: Debt = {
        ...item,
        ...safeUpdates,
        amount,
        paidAmount,
        remainingAmount,
        status,
      };
      await client.query(
        `UPDATE public.app_data SET payload = $1::jsonb, updated_at = now()
          WHERE owner_user_id = $2 AND collection = 'debts' AND scope_key = $2 AND record_key = $3`,
        [JSON.stringify(updated), userId, id]
      );
      return updated;
    });
  }

  async payDebt(
    userId: string,
    id: string,
    payment: number,
    walletId?: string,
    idempotencyKey?: string
  ): Promise<Debt> {
    const pay = Math.round(Number(payment));
    if (!Number.isFinite(pay) || pay <= 0) {
      throw new Error('Toʻlov summasi noldan katta boʻlishi kerak');
    }
    const res = await this.storage.query<{ debt: Debt }>(
      `SELECT public.hisobot_pay_debt($1, $2, $3, $4, $5) AS debt`,
      [userId, id, pay, walletId || null, idempotencyKey || null],
      { label: 'rpc_pay_debt' }
    );
    return res.rows[0].debt;
  }

  deleteDebt(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'debts', id);
  }

  // ==========================================
  // --- NOTIFICATIONS ---
  // ==========================================
  async getNotifications(userId: string): Promise<NotificationItem[]> {
    const list = await this.listUserRecords<NotificationItem>(userId, 'notifications');
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async addNotification(
    userId: string,
    notif: Omit<NotificationItem, 'id' | 'userId' | 'date' | 'isRead'>
  ): Promise<NotificationItem> {
    const id = `notif_${crypto.randomUUID()}`;
    const newNotif: NotificationItem = {
      id,
      userId,
      ...notif,
      date: getTodayDateString(),
      isRead: false,
    };
    return this.upsertUserRecord(userId, 'notifications', userId, id, newNotif);
  }

  async markNotificationRead(userId: string, id: string): Promise<void> {
    await this.storage.query(
      `UPDATE public.app_data
          SET payload = jsonb_set(payload, '{isRead}', 'true'::jsonb, true),
              updated_at = now()
        WHERE owner_user_id = $1
          AND collection = 'notifications'
          AND scope_key = $1
          AND record_key = $2`,
      [userId, id],
      { label: 'mark_notification_read' }
    );
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.storage.query(
      `UPDATE public.app_data
          SET payload = jsonb_set(payload, '{isRead}', 'true'::jsonb, true),
              updated_at = now()
        WHERE owner_user_id = $1
          AND collection = 'notifications'
          AND scope_key = $1`,
      [userId],
      { label: 'mark_all_notifications_read' }
    );
  }

  // ==========================================
  // --- 1. WALLETS & TRANSFERS ---
  // ==========================================
  async getWallets(userId: string): Promise<Wallet[]> {
    const list = await this.listUserRecords<Wallet>(userId, 'wallets');
    return list.filter((w) => !w.isArchived);
  }

  async addWallet(userId: string, wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt'>): Promise<Wallet> {
    const balance = Math.round(Number(wallet.balance ?? 0));
    if (!Number.isFinite(balance) || balance < 0) {
      throw new Error('Hamyon balansi manfiy boʻlishi yoki notoʻgʻri boʻlishi mumkin emas');
    }
    const id = `wallet_${crypto.randomUUID()}`;
    const newWallet: Wallet = {
      id,
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
    return this.upsertUserRecord(userId, 'wallets', userId, id, newWallet);
  }

  async updateWallet(userId: string, id: string, updates: Partial<Wallet>): Promise<Wallet> {
    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ payload: Wallet }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'wallets' AND scope_key = $1 AND record_key = $2
          FOR UPDATE`,
        [userId, id]
      );
      if (!existing.rows[0]) throw new Error('Hamyon topilmadi');
      const cur = existing.rows[0].payload;
      const nextBalance = updates.balance !== undefined ? Math.round(Number(updates.balance)) : cur.balance;
      if (!Number.isFinite(nextBalance) || nextBalance < 0) {
        throw new Error('Hamyon balansi manfiy boʻlishi mumkin emas');
      }
      const updated: Wallet = {
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
      await client.query(
        `UPDATE public.app_data SET payload = $1::jsonb, updated_at = now()
          WHERE owner_user_id = $2 AND collection = 'wallets' AND scope_key = $2 AND record_key = $3`,
        [JSON.stringify(updated), userId, id]
      );
      return updated;
    });
  }

  async archiveWallet(userId: string, id: string): Promise<boolean> {
    const res = await this.storage.query(
      `UPDATE public.app_data
          SET payload = jsonb_set(payload, '{isArchived}', 'true'::jsonb, true),
              updated_at = now()
        WHERE owner_user_id = $1
          AND collection = 'wallets'
          AND scope_key = $1
          AND record_key = $2`,
      [userId, id],
      { label: 'archive_wallet' }
    );
    return (res.rowCount || 0) > 0;
  }

  async transferBetweenWallets(
    userId: string,
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    targetAmount?: number,
    notes?: string,
    idempotencyKey?: string
  ): Promise<WalletTransfer> {
    const numAmount = Math.round(Number(amount));
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new Error('Oʻtkazma summasi noldan katta boʻlishi kerak');
    }
    const destAmount =
      targetAmount !== undefined && targetAmount !== null ? Math.round(Number(targetAmount)) : null;
    if (destAmount !== null && (!Number.isFinite(destAmount) || destAmount <= 0)) {
      throw new Error('Qabul qiluvchi summa noldan katta boʻlishi kerak');
    }

    const res = await this.storage.query<{ transfer: WalletTransfer }>(
      `SELECT public.hisobot_transfer_between_wallets($1, $2, $3, $4, $5, $6, $7, $8) AS transfer`,
      [
        userId,
        fromWalletId,
        toWalletId,
        numAmount,
        destAmount,
        notes || null,
        idempotencyKey || null,
        getTodayDateString(),
      ],
      { label: 'rpc_transfer_between_wallets' }
    );
    return res.rows[0].transfer;
  }

  getWalletTransfers(userId: string): Promise<WalletTransfer[]> {
    return this.listUserRecords<WalletTransfer>(userId, 'walletTransfers');
  }

  // ==========================================
  // --- 2. FAMILY BUDGET ---
  // ==========================================
  async getFamilyGroup(
    userId: string
  ): Promise<{ group: FamilyGroup | null; members: FamilyMember[]; invitations: FamilyInvitation[] }> {
    const memberLookup = await this.storage.query<{ scope_key: string }>(
      `SELECT scope_key
         FROM public.app_data
        WHERE collection = 'familyMembers'
          AND payload->>'userId' = $1
        LIMIT 1`,
      [userId],
      { retryable: true, label: 'lookup_family_membership' }
    );

    let familyId: string | undefined = memberLookup.rows[0]?.scope_key;
    if (!familyId) {
      const user = await this.getUserById(userId);
      familyId = user?.familyGroupId;
    }
    if (!familyId) {
      return { group: null, members: [], invitations: [] };
    }

    const [groupRes, membersRes, invitesRes] = await Promise.all([
      this.storage.query<{ payload: FamilyGroup }>(
        `SELECT payload FROM public.app_data
          WHERE collection = 'familyGroups' AND scope_key = $1 LIMIT 1`,
        [familyId],
        { retryable: true, label: 'get_family_group' }
      ),
      this.storage.query<{ payload: FamilyMember }>(
        `SELECT payload FROM public.app_data
          WHERE collection = 'familyMembers' AND scope_key = $1 ORDER BY created_at ASC`,
        [familyId],
        { retryable: true, label: 'get_family_members' }
      ),
      this.storage.query<{ payload: FamilyInvitation }>(
        `SELECT payload FROM public.app_data
          WHERE collection = 'familyInvitations' AND scope_key = $1 ORDER BY created_at DESC`,
        [familyId],
        { retryable: true, label: 'get_family_invitations' }
      ),
    ]);

    const group = groupRes.rows[0]?.payload || null;
    if (!group) return { group: null, members: [], invitations: [] };

    const members = membersRes.rows.map((r) => r.payload);
    const isMemberOrOwner = group.ownerId === userId || members.some((m) => m.userId === userId);
    if (!isMemberOrOwner) {
      return { group: null, members: [], invitations: [] };
    }

    return {
      group,
      members,
      invitations: invitesRes.rows.map((r) => r.payload),
    };
  }

  async createFamilyGroup(userId: string, name: string, monthlyBudget: number): Promise<FamilyGroup> {
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new Error('Oilaviy guruh nomini kiriting');

    return this.storage.withTransaction(async (client) => {
      const userRes = await client.query<{ email: string; profile: UserProfile }>(
        `SELECT email, profile FROM public.app_users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      const uRow = userRes.rows[0];
      if (!uRow) throw new Error('Foydalanuvchi topilmadi');

      const familyId = `fam_${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const group: FamilyGroup = {
        id: familyId,
        name: cleanName,
        ownerId: userId,
        currency: 'UZS',
        monthlyBudget: Math.round(Number(monthlyBudget) || 10000000),
        createdAt: nowIso,
      };

      const ownerMember: FamilyMember = {
        id: `fm_${crypto.randomUUID()}`,
        familyId,
        userId,
        email: uRow.email,
        fullName: uRow.profile.fullName || uRow.email,
        role: 'owner',
        joinedAt: nowIso,
      };

      await client.query(
        `INSERT INTO public.app_data (
           owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
         ) VALUES
           ($1, 'familyGroups', $2, $2, $3::jsonb, now(), now()),
           ($1, 'familyMembers', $2, $4, $5::jsonb, now(), now())`,
        [userId, familyId, JSON.stringify(group), ownerMember.id, JSON.stringify(ownerMember)]
      );

      await client.query(
        `UPDATE public.app_users
            SET profile = jsonb_set(profile, '{familyGroupId}', to_jsonb($1::text), true),
                updated_at = now()
          WHERE id = $2`,
        [familyId, userId]
      );

      return group;
    });
  }

  async inviteFamilyMember(
    userId: string,
    email: string,
    role: 'admin' | 'member' | 'viewer'
  ): Promise<FamilyInvitation> {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Yaroqli elektron pochta manzilini kiriting');
    }

    return this.storage.withTransaction(async (client) => {
      const memRes = await client.query<{ owner_user_id: string; scope_key: string; payload: FamilyMember }>(
        `SELECT owner_user_id, scope_key, payload
           FROM public.app_data
          WHERE collection = 'familyMembers'
            AND payload->>'userId' = $1
          LIMIT 1
          FOR UPDATE`,
        [userId]
      );
      const membership = memRes.rows[0];
      if (!membership) {
        throw new Error('Siz hali oilaviy guruhga aʼzo emassiz');
      }
      if (membership.payload.role !== 'owner' && membership.payload.role !== 'admin') {
        throw new Error('Faqat oila egasi yoki admin yangi aʼzo taklif qila oladi');
      }

      const familyId = membership.scope_key;
      const groupOwnerId = membership.owner_user_id;
      const inv: FamilyInvitation = {
        id: `inv_${crypto.randomUUID()}`,
        familyId,
        email: cleanEmail,
        role,
        inviteCode: `FAM-${Math.floor(100000 + Math.random() * 900000)}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      await client.query(
        `INSERT INTO public.app_data (
           owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
         ) VALUES ($1, 'familyInvitations', $2, $3, $4::jsonb, now(), now())`,
        [groupOwnerId, familyId, inv.id, JSON.stringify(inv)]
      );

      return inv;
    });
  }

  async acceptFamilyInvite(userId: string, inviteCode: string): Promise<FamilyGroup> {
    const cleanCode = String(inviteCode || '').trim().toUpperCase();
    if (!cleanCode) throw new Error('Taklif kodi notoʻgʻri yoki muddati tugagan');

    return this.storage.withTransaction(async (client) => {
      const userRes = await client.query<{ email: string; profile: UserProfile }>(
        `SELECT email, profile FROM public.app_users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      const uRow = userRes.rows[0];
      if (!uRow) throw new Error('Foydalanuvchi topilmadi');

      const invRes = await client.query<{
        owner_user_id: string;
        scope_key: string;
        record_key: string;
        payload: FamilyInvitation;
      }>(
        `SELECT owner_user_id, scope_key, record_key, payload
           FROM public.app_data
          WHERE collection = 'familyInvitations'
            AND upper(payload->>'inviteCode') = $1
            AND payload->>'status' = 'pending'
          LIMIT 1
          FOR UPDATE`,
        [cleanCode]
      );

      const invRow = invRes.rows[0];
      if (!invRow) {
        throw new Error('Taklif kodi notoʻgʻri yoki muddati tugagan');
      }

      const inv = invRow.payload;
      if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= Date.now()) {
        await client.query(
          `UPDATE public.app_data
              SET payload = jsonb_set(payload, '{status}', '"declined"'::jsonb, true), updated_at = now()
            WHERE owner_user_id = $1 AND collection = 'familyInvitations' AND scope_key = $2 AND record_key = $3`,
          [invRow.owner_user_id, invRow.scope_key, invRow.record_key]
        );
        throw new Error('Taklif kodining amal qilish muddati tugagan');
      }

      if (inv.email && inv.email.trim().toLowerCase() !== uRow.email.trim().toLowerCase()) {
        throw new Error('Ushbu taklif kodi boshqa elektron pochta uchun yaratilgan');
      }

      const groupRes = await client.query<{ payload: FamilyGroup }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'familyGroups' AND scope_key = $2 AND record_key = $2
          LIMIT 1`,
        [invRow.owner_user_id, invRow.scope_key]
      );
      const group = groupRes.rows[0]?.payload;
      if (!group) throw new Error('Oilaviy guruh topilmadi');

      await client.query(
        `UPDATE public.app_data
            SET payload = jsonb_set(payload, '{status}', '"accepted"'::jsonb, true), updated_at = now()
          WHERE owner_user_id = $1 AND collection = 'familyInvitations' AND scope_key = $2 AND record_key = $3`,
        [invRow.owner_user_id, invRow.scope_key, invRow.record_key]
      );

      const existingMem = await client.query(
        `SELECT 1 FROM public.app_data
          WHERE collection = 'familyMembers' AND scope_key = $1 AND payload->>'userId' = $2 LIMIT 1`,
        [invRow.scope_key, userId]
      );

      if ((existingMem.rowCount || 0) === 0) {
        const member: FamilyMember = {
          id: `fm_${crypto.randomUUID()}`,
          familyId: invRow.scope_key,
          userId,
          email: uRow.email,
          fullName: uRow.profile.fullName || uRow.email,
          role: inv.role,
          joinedAt: new Date().toISOString(),
        };
        await client.query(
          `INSERT INTO public.app_data (
             owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
           ) VALUES ($1, 'familyMembers', $2, $3, $4::jsonb, now(), now())`,
          [invRow.owner_user_id, invRow.scope_key, member.id, JSON.stringify(member)]
        );
      }

      await client.query(
        `UPDATE public.app_users
            SET profile = jsonb_set(profile, '{familyGroupId}', to_jsonb($1::text), true),
                updated_at = now()
          WHERE id = $2`,
        [invRow.scope_key, userId]
      );

      return group;
    });
  }

  async getFamilyTransactions(userId: string): Promise<Transaction[]> {
    const { group, members } = await this.getFamilyGroup(userId);
    if (!group || members.length === 0) return [];
    const memberIds = members.map((m) => m.userId);

    const res = await this.storage.query<{ payload: Transaction }>(
      `SELECT payload
         FROM public.app_data
        WHERE collection = 'transactions'
          AND owner_user_id = ANY($1::text[])
          AND coalesce((payload->>'isFamilyShared')::boolean, true) = true`,
      [memberIds],
      { retryable: true, label: 'get_family_transactions' }
    );

    return res.rows
      .map((r) => r.payload)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // ==========================================
  // --- 3. SUBSCRIPTIONS ---
  // ==========================================
  getSubscriptions(userId: string): Promise<Subscription[]> {
    return this.listUserRecords<Subscription>(userId, 'subscriptions');
  }

  async addSubscription(userId: string, sub: Omit<Subscription, 'id' | 'userId' | 'createdAt'>): Promise<Subscription> {
    const id = `sub_${crypto.randomUUID()}`;
    const newSub: Subscription = {
      ...sub,
      id,
      userId,
      amount: Math.round(Number(sub.amount)),
      currency: sub.currency || 'UZS',
      createdAt: new Date().toISOString(),
    };
    return this.upsertUserRecord(userId, 'subscriptions', userId, id, newSub);
  }

  async updateSubscription(userId: string, id: string, updates: Partial<Subscription>): Promise<Subscription> {
    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ payload: Subscription }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'subscriptions' AND scope_key = $1 AND record_key = $2
          FOR UPDATE`,
        [userId, id]
      );
      if (!existing.rows[0]) throw new Error('Obuna topilmadi');
      const cur = existing.rows[0].payload;
      const nextAmount = updates.amount !== undefined ? Math.round(Number(updates.amount)) : cur.amount;
      if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
        throw new Error('Obuna summasi noldan katta boʻlishi kerak');
      }
      const updated: Subscription = {
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
      await client.query(
        `UPDATE public.app_data SET payload = $1::jsonb, updated_at = now()
          WHERE owner_user_id = $2 AND collection = 'subscriptions' AND scope_key = $2 AND record_key = $3`,
        [JSON.stringify(updated), userId, id]
      );
      return updated;
    });
  }

  deleteSubscription(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'subscriptions', id);
  }

  // ==========================================
  // --- 4. RECURRING PAYMENTS ---
  // ==========================================
  getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    return this.listUserRecords<RecurringTransaction>(userId, 'recurringTransactions');
  }

  async addRecurringTransaction(
    userId: string,
    rec: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>
  ): Promise<RecurringTransaction> {
    const amount = Math.round(Number(rec.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Doimiy toʻlov summasi noldan katta boʻlishi kerak');
    }
    const id = `rec_${crypto.randomUUID()}`;
    const newRec: RecurringTransaction = {
      ...rec,
      id,
      userId,
      amount,
      currency: rec.currency || 'UZS',
      idempotencyKeyPrefix: rec.idempotencyKeyPrefix || `rec_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    return this.upsertUserRecord(userId, 'recurringTransactions', userId, id, newRec);
  }

  async updateRecurringTransaction(
    userId: string,
    id: string,
    updates: Partial<RecurringTransaction>
  ): Promise<RecurringTransaction> {
    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ payload: RecurringTransaction }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'recurringTransactions' AND scope_key = $1 AND record_key = $2
          FOR UPDATE`,
        [userId, id]
      );
      if (!existing.rows[0]) throw new Error('Doimiy toʻlov topilmadi');
      const cur = existing.rows[0].payload;
      const { id: _i, userId: _u, createdAt: _c, ...safeUpdates } = updates;
      const amount = Math.round(updates.amount !== undefined ? Number(updates.amount) : Number(cur.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Doimiy toʻlov summasi noldan katta boʻlishi kerak');
      }
      const updated: RecurringTransaction = {
        ...cur,
        ...safeUpdates,
        amount,
      };
      await client.query(
        `UPDATE public.app_data SET payload = $1::jsonb, updated_at = now()
          WHERE owner_user_id = $2 AND collection = 'recurringTransactions' AND scope_key = $2 AND record_key = $3`,
        [JSON.stringify(updated), userId, id]
      );
      return updated;
    });
  }

  deleteRecurringTransaction(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'recurringTransactions', id);
  }

  async executeRecurringSchedule(userId: string, recId: string, idempotencyKey?: string): Promise<Transaction> {
    const res = await this.storage.query<{ tx: Transaction }>(
      `SELECT public.hisobot_execute_recurring_schedule($1, $2, $3, $4, $5) AS tx`,
      [userId, recId, idempotencyKey || null, getTodayDateString(), getCurrentTimeString()],
      { label: 'rpc_execute_recurring' }
    );
    return res.rows[0].tx;
  }

  getRecurringLogs(userId: string): Promise<RecurringExecutionLog[]> {
    return this.listUserRecords<RecurringExecutionLog>(userId, 'recurringLogs');
  }

  // ==========================================
  // --- 5. RECEIPTS ---
  // ==========================================
  async getReceipts(userId: string): Promise<ScannedReceipt[]> {
    const list = await this.listUserRecords<ScannedReceipt>(userId, 'receipts');
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async saveReceipt(userId: string, receipt: Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'>): Promise<ScannedReceipt> {
    const id = `rcp_${crypto.randomUUID()}`;
    const newReceipt: ScannedReceipt = {
      ...receipt,
      id,
      userId,
      createdAt: new Date().toISOString(),
    };
    return this.upsertUserRecord(userId, 'receipts', userId, id, newReceipt);
  }

  async linkReceiptTransaction(userId: string, receiptId: string, transactionId: string): Promise<ScannedReceipt | null> {
    const res = await this.storage.query<{ payload: ScannedReceipt }>(
      `UPDATE public.app_data
          SET payload = jsonb_set(payload, '{transactionId}', to_jsonb($3::text), true),
              updated_at = now()
        WHERE owner_user_id = $1
          AND collection = 'receipts'
          AND scope_key = $1
          AND record_key = $2
      RETURNING payload`,
      [userId, receiptId, transactionId],
      { label: 'link_receipt_transaction' }
    );
    return res.rows[0]?.payload || null;
  }

  // ==========================================
  // --- 6. BANK CONNECTIONS ---
  // ==========================================
  getBankConnections(userId: string): Promise<BankConnection[]> {
    return this.listUserRecords<BankConnection>(userId, 'bankConnections');
  }

  async connectBank(userId: string, bankId: string, bankName: string): Promise<BankConnection> {
    const id = `bank_conn_${crypto.randomUUID()}`;
    const connection: BankConnection = {
      id,
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
    return this.upsertUserRecord(userId, 'bankConnections', userId, id, connection);
  }

  disconnectBank(userId: string, id: string): Promise<boolean> {
    return this.deleteUserRecord(userId, 'bankConnections', id);
  }

  async syncBank(userId: string, id: string): Promise<{ importedCount: number; message: string }> {
    return this.storage.withTransaction(async (client) => {
      const bankRes = await client.query<{ payload: BankConnection }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'bankConnections' AND scope_key = $1 AND record_key = $2
          FOR UPDATE`,
        [userId, id]
      );
      const bank = bankRes.rows[0]?.payload;
      if (!bank) throw new Error('Bank aloqasi topilmadi');

      const today = getTodayDateString();
      const updatedBank: BankConnection = { ...bank, lastSyncAt: today };
      await client.query(
        `UPDATE public.app_data SET payload = $1::jsonb, updated_at = now()
          WHERE owner_user_id = $2 AND collection = 'bankConnections' AND scope_key = $2 AND record_key = $3`,
        [JSON.stringify(updatedBank), userId, id]
      );

      const existingRes = await client.query<{ payload: Transaction }>(
        `SELECT payload FROM public.app_data
          WHERE owner_user_id = $1 AND collection = 'transactions' AND scope_key = $1`,
        [userId]
      );
      const existing = existingRes.rows.map((r) => r.payload);

      const sampleTxs = [
        {
          type: 'expense' as const,
          amount: 85000,
          categoryName: 'Oziq-ovqat va kafe',
          description: `${bank.bankName} orqali toʻlov: Supermarket`,
          paymentMethod: 'card' as const,
          date: today,
        },
        {
          type: 'expense' as const,
          amount: 45000,
          categoryName: 'Transport va yoqilgʻi',
          description: `${bank.bankName} orqali toʻlov: Yandex Taxi`,
          paymentMethod: 'card' as const,
          date: today,
        },
      ];

      let imported = 0;
      for (const t of sampleTxs) {
        const isDup = existing.some(
          (ex) => ex.date === t.date && ex.amount === t.amount && ex.description === t.description
        );
        if (!isDup) {
          await client.query(
            `SELECT public.hisobot_add_transaction($1, $2::jsonb, null)`,
            [
              userId,
              JSON.stringify({
                ...t,
                categoryId: t.categoryName.includes('Transport') ? 'exp_transport' : 'exp_food',
                time: getCurrentTimeString(),
                notes: `${bank.bankName} sinxronizatsiyasi orqali import qilindi`,
                createdAt: new Date().toISOString(),
              }),
            ]
          );
          imported++;
        }
      }

      const logId = `sync_${crypto.randomUUID()}`;
      const syncLog: BankSyncLog = {
        id: logId,
        userId,
        bankName: bank.bankName,
        syncedAt: new Date().toISOString(),
        importedCount: imported,
        status: 'success',
      };
      await client.query(
        `INSERT INTO public.app_data (
           owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
         ) VALUES ($1, 'bankSyncLogs', $1, $2, $3::jsonb, now(), now())`,
        [userId, logId, JSON.stringify(syncLog)]
      );

      return { importedCount: imported, message: `${imported} ta yangi tranzaksiya yuklandi` };
    });
  }

  // ==========================================
  // --- 7. TELEGRAM BOT ---
  // ==========================================
  async getTelegramConnection(userId: string): Promise<TelegramConnection> {
    const res = await this.storage.query<{ payload: TelegramConnection }>(
      `SELECT payload FROM public.app_data
        WHERE owner_user_id = $1 AND collection = 'telegramConnections' AND scope_key = $1
        LIMIT 1`,
      [userId],
      { retryable: true, label: 'get_telegram' }
    );

    if (res.rows[0]) return res.rows[0].payload;

    const fresh: TelegramConnection = {
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
    return this.upsertUserRecord(userId, 'telegramConnections', userId, 'default', fresh);
  }

  async updateTelegramPrefs(userId: string, prefs: TelegramConnection['preferences']): Promise<TelegramConnection> {
    const conn = await this.getTelegramConnection(userId);
    const updated: TelegramConnection = {
      ...conn,
      preferences: { ...conn.preferences, ...prefs },
    };
    return this.upsertUserRecord(userId, 'telegramConnections', userId, 'default', updated);
  }

  async connectTelegram(userId: string, username: string): Promise<TelegramConnection> {
    const conn = await this.getTelegramConnection(userId);
    const updated: TelegramConnection = {
      ...conn,
      isConnected: true,
      telegramUsername: username.startsWith('@') ? username : `@${username}`,
      chatId: String(Math.floor(10000000 + Math.random() * 90000000)),
      connectedAt: new Date().toISOString(),
    };
    return this.upsertUserRecord(userId, 'telegramConnections', userId, 'default', updated);
  }

  async disconnectTelegram(userId: string): Promise<TelegramConnection> {
    const conn = await this.getTelegramConnection(userId);
    const updated: TelegramConnection = {
      userId: conn.userId,
      isConnected: false,
      connectCode: `HISOBOT-${Math.floor(1000 + Math.random() * 9000)}`,
      preferences: conn.preferences,
    };
    return this.upsertUserRecord(userId, 'telegramConnections', userId, 'default', updated);
  }

  // ==========================================
  // --- 8. MULTI-CURRENCY ---
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
  async recordAiUsageEvent(event: Omit<AiUsageEvent, 'id' | 'createdAt'>): Promise<AiUsageEvent> {
    const id = `ai_ev_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    await this.storage.query(
      `INSERT INTO public.ai_usage_events (
         id, user_id, endpoint, model, source, status, latency_ms, prompt_chars, completion_chars, language, error_code, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz)`,
      [
        id,
        event.userId || null,
        event.endpoint,
        event.model,
        event.source,
        event.status,
        Math.max(0, Math.round(Number(event.latencyMs) || 0)),
        Math.max(0, Math.round(Number(event.promptChars) || 0)),
        Math.max(0, Math.round(Number(event.completionChars) || 0)),
        event.language || 'uz',
        event.errorCode || null,
        createdAt,
      ],
      { label: 'record_ai_usage_event' }
    );
    return { ...event, id, createdAt };
  }

  async recordApiErrorEvent(event: Omit<ApiErrorEvent, 'id' | 'createdAt'>): Promise<ApiErrorEvent> {
    const id = `err_ev_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    await this.storage.query(
      `INSERT INTO public.api_error_events (
         id, method, path, status_code, error_message, user_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)`,
      [
        id,
        event.method,
        event.path,
        Math.round(Number(event.statusCode) || 500),
        String(event.errorMessage || 'Unknown error').slice(0, 300),
        event.userId || null,
        createdAt,
      ],
      { label: 'record_api_error_event' }
    );
    return { ...event, id, createdAt };
  }

  async getAppConfig(): Promise<AppRuntimeConfig> {
    const res = await this.storage.query<{ config_value: AppRuntimeConfig }>(
      `SELECT config_value FROM public.app_runtime_config WHERE config_key = 'runtime' LIMIT 1`,
      [],
      { retryable: true, label: 'get_app_config' }
    );
    return {
      ...DEFAULT_APP_RUNTIME_CONFIG,
      ...(res.rows[0]?.config_value || {}),
    };
  }

  async updateAppConfig(updates: Partial<AppRuntimeConfig>, updatedBy: string): Promise<AppRuntimeConfig> {
    return this.storage.withTransaction(async (client) => {
      const existing = await client.query<{ config_value: AppRuntimeConfig }>(
        `SELECT config_value FROM public.app_runtime_config WHERE config_key = 'runtime' FOR UPDATE`
      );
      const current: AppRuntimeConfig = {
        ...DEFAULT_APP_RUNTIME_CONFIG,
        ...(existing.rows[0]?.config_value || {}),
      };
      const next = sanitizeRuntimeConfigUpdate(current, updates, updatedBy);
      await client.query(
        `INSERT INTO public.app_runtime_config (config_key, config_value, updated_by, updated_at)
         VALUES ('runtime', $1::jsonb, $2, now())
         ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [JSON.stringify(next), updatedBy]
      );
      return next;
    });
  }

  async addAdminAuditLog(entry: Omit<AdminAuditLog, 'id' | 'createdAt'>): Promise<AdminAuditLog> {
    const id = `aud_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    await this.storage.query(
      `INSERT INTO public.admin_audit_logs (
         id, admin_user_id, admin_email, action, target_type, target_id, reason, metadata, ip_address, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::timestamptz)`,
      [
        id,
        entry.adminUserId,
        entry.adminEmail,
        entry.action,
        entry.targetType,
        entry.targetId,
        entry.reason,
        JSON.stringify(entry.metadata || {}),
        entry.ipAddress || null,
        createdAt,
      ],
      { label: 'add_admin_audit_log' }
    );
    return { ...entry, id, createdAt };
  }

  async listAdminAuditLogs(params: {
    action?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ logs: AdminAuditLog[]; total: number; page: number; limit: number }> {
    const safeLimit = Math.min(50, Math.max(1, Math.round(Number(params.limit) || 20)));
    const safePage = Math.max(1, Math.round(Number(params.page) || 1));
    const offset = (safePage - 1) * safeLimit;

    const whereParts: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.action && params.action !== 'all') {
      whereParts.push(`action = $${idx++}`);
      values.push(params.action);
    }
    if (params.search && params.search.trim()) {
      whereParts.push(
        `(admin_email ILIKE $${idx} OR action ILIKE $${idx} OR target_id ILIKE $${idx} OR reason ILIKE $${idx})`
      );
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const countRes = await this.storage.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM public.admin_audit_logs ${whereSql}`,
      values,
      { retryable: true, label: 'count_admin_audit_logs' }
    );
    const total = Number(countRes.rows[0]?.total || 0);

    const rowsRes = await this.storage.query<{
      id: string;
      admin_user_id: string;
      admin_email: string;
      action: string;
      target_type: AdminAuditLog['targetType'];
      target_id: string;
      reason: string;
      metadata: Record<string, unknown> | null;
      ip_address: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, admin_user_id, admin_email, action, target_type, target_id, reason, metadata, ip_address, created_at
         FROM public.admin_audit_logs
         ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, safeLimit, offset],
      { retryable: true, label: 'list_admin_audit_logs' }
    );

    const logs: AdminAuditLog[] = rowsRes.rows.map((r) => ({
      id: r.id,
      adminUserId: r.admin_user_id,
      adminEmail: r.admin_email,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      metadata: r.metadata || undefined,
      ipAddress: r.ip_address || undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));

    return { logs, total, page: safePage, limit: safeLimit };
  }

  private async loadAllAdminUserSummaries(): Promise<AdminUserSummary[]> {
    const res = await this.storage.query<{
      id: string;
      email: string;
      profile: UserProfile;
      created_at: Date | string;
      tx_count: string;
      sessions_count: string;
    }>(
      `SELECT u.id,
              u.email,
              u.profile,
              u.created_at,
              coalesce(tx.cnt, 0)::text AS tx_count,
              coalesce(sess.cnt, 0)::text AS sessions_count
         FROM public.app_users u
         LEFT JOIN (
           SELECT owner_user_id, count(*) AS cnt
             FROM public.app_data
            WHERE collection = 'transactions'
            GROUP BY owner_user_id
         ) tx ON tx.owner_user_id = u.id
         LEFT JOIN (
           SELECT user_id, count(*) AS cnt
             FROM public.app_sessions
            WHERE expires_at > now()
            GROUP BY user_id
         ) sess ON sess.user_id = u.id
        ORDER BY u.created_at DESC`,
      [],
      { retryable: true, label: 'load_all_admin_users' }
    );

    return res.rows.map((r) => {
      const p = r.profile || ({} as UserProfile);
      const isPrem = Boolean(p.isPremium);
      const plan: 'free' | 'pro' | 'business' =
        isPrem && (p.premiumPlan === 'pro' || p.premiumPlan === 'business') ? p.premiumPlan : 'free';
      const createdAt =
        p.createdAt || (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at));
      return {
        id: r.id,
        email: r.email,
        fullName: p.fullName || r.email,
        avatarUrl: p.avatarUrl,
        currency: p.currency || 'UZS',
        isPremium: isPrem,
        premiumPlan: plan,
        premiumExpiresAt: p.premiumExpiresAt,
        isSuspended: Boolean(p.isSuspended),
        isSuperAdmin: isVerifiedSuperAdminUser({ id: r.id, email: r.email }),
        createdAt,
        lastActiveAt: p.lastActiveAt || createdAt,
        transactionCount: Number(r.tx_count || 0),
        activeSessionsCount: Number(r.sessions_count || 0),
      };
    });
  }

  async listAdminUsers(params: {
    search?: string;
    plan?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: AdminUserSummary[]; total: number; page: number; limit: number }> {
    const safeLimit = Math.min(50, Math.max(1, Math.round(Number(params.limit) || 20)));
    const safePage = Math.max(1, Math.round(Number(params.page) || 1));

    let list = await this.loadAllAdminUserSummaries();

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

  async adminUpdateUserSubscription(params: {
    adminUser: UserProfile;
    targetUserId: string;
    plan: 'free' | 'pro' | 'business';
    durationMonths: number;
    reason: string;
    ipAddress?: string;
  }): Promise<{ user: AdminUserSummary; subscriptionEvent: SubscriptionEvent; auditLog: AdminAuditLog }> {
    const cfg = await this.getAppConfig();
    const safeMonths = params.plan === 'free' ? 0 : Math.min(36, Math.max(1, Math.round(params.durationMonths || 1)));

    const subEventId = `sub_ev_${crypto.randomUUID()}`;
    const audId = `aud_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const { subscriptionEvent, auditLog } = await this.storage.withTransaction(async (client) => {
      const userRes = await client.query<{ id: string; email: string; profile: UserProfile }>(
        `SELECT id, email, profile FROM public.app_users WHERE id = $1 FOR UPDATE`,
        [params.targetUserId]
      );
      const targetRow = userRes.rows[0];
      if (!targetRow) throw new Error('Foydalanuvchi topilmadi');

      const curProfile = { ...(targetRow.profile || {}) } as UserProfile;
      const previousPlan: 'free' | 'pro' | 'business' =
        curProfile.isPremium && (curProfile.premiumPlan === 'pro' || curProfile.premiumPlan === 'business')
          ? curProfile.premiumPlan
          : 'free';

      let expiresAt: string | undefined;
      if (params.plan === 'free') {
        curProfile.isPremium = false;
        curProfile.premiumPlan = 'free';
        delete curProfile.premiumExpiresAt;
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + safeMonths);
        expiresAt = d.toISOString().split('T')[0];
        curProfile.isPremium = true;
        curProfile.premiumPlan = params.plan;
        curProfile.premiumExpiresAt = expiresAt;
      }

      await client.query(
        `UPDATE public.app_users SET profile = $1::jsonb, updated_at = now() WHERE id = $2`,
        [JSON.stringify(curProfile), targetRow.id]
      );

      const unitPrice =
        params.plan === 'business'
          ? cfg.businessMonthlyPriceUzs
          : params.plan === 'pro'
          ? cfg.proMonthlyPriceUzs
          : 0;
      const amountUzs = unitPrice * safeMonths;

      const subEv: SubscriptionEvent = {
        id: subEventId,
        userId: targetRow.id,
        userEmail: targetRow.email,
        userFullName: curProfile.fullName || targetRow.email,
        plan: params.plan,
        previousPlan,
        amountUzs,
        currency: 'UZS',
        source: 'admin_grant',
        actorUserId: params.adminUser.id,
        durationMonths: safeMonths,
        expiresAt,
        reason: params.reason,
        createdAt: nowIso,
      };

      await client.query(
        `INSERT INTO public.subscription_events (
           id, user_id, plan, previous_plan, amount_uzs, currency, source, actor_user_id, duration_months, expires_at, reason, created_at
         ) VALUES ($1, $2, $3, $4, $5, 'UZS', 'admin_grant', $6, $7, $8, $9, $10::timestamptz)`,
        [
          subEv.id,
          subEv.userId,
          subEv.plan,
          subEv.previousPlan,
          subEv.amountUzs,
          subEv.actorUserId,
          subEv.durationMonths,
          subEv.expiresAt || null,
          subEv.reason || null,
          nowIso,
        ]
      );

      const aud: AdminAuditLog = {
        id: audId,
        adminUserId: params.adminUser.id,
        adminEmail: params.adminUser.email,
        action: 'subscription.update',
        targetType: 'user',
        targetId: targetRow.id,
        reason: params.reason,
        metadata: {
          targetEmail: targetRow.email,
          previousPlan,
          nextPlan: params.plan,
          durationMonths: safeMonths,
          amountUzs,
        },
        ipAddress: params.ipAddress,
        createdAt: nowIso,
      };

      await client.query(
        `INSERT INTO public.admin_audit_logs (
           id, admin_user_id, admin_email, action, target_type, target_id, reason, metadata, ip_address, created_at
         ) VALUES ($1, $2, $3, $4, 'user', $5, $6, $7::jsonb, $8, $9::timestamptz)`,
        [
          aud.id,
          aud.adminUserId,
          aud.adminEmail,
          aud.action,
          aud.targetId,
          aud.reason,
          JSON.stringify(aud.metadata || {}),
          aud.ipAddress || null,
          nowIso,
        ]
      );

      return { subscriptionEvent: subEv, auditLog: aud };
    });

    const summaries = await this.loadAllAdminUserSummaries();
    const user = summaries.find((u) => u.id === params.targetUserId)!;
    return { user, subscriptionEvent, auditLog };
  }

  async adminSetUserSuspended(params: {
    adminUser: UserProfile;
    targetUserId: string;
    suspended: boolean;
    reason: string;
    ipAddress?: string;
  }): Promise<{ user: AdminUserSummary; clearedSessions: number; auditLog: AdminAuditLog }> {
    const audId = `aud_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const { clearedSessions, auditLog } = await this.storage.withTransaction(async (client) => {
      const userRes = await client.query<{ id: string; email: string; profile: UserProfile }>(
        `SELECT id, email, profile FROM public.app_users WHERE id = $1 FOR UPDATE`,
        [params.targetUserId]
      );
      const targetRow = userRes.rows[0];
      if (!targetRow) throw new Error('Foydalanuvchi topilmadi');
      if (targetRow.id === params.adminUser.id || isVerifiedSuperAdminUser({ id: targetRow.id, email: targetRow.email })) {
        throw new Error('Super Admin hisobini bloklab boʻlmaydi');
      }

      const curProfile = { ...(targetRow.profile || {}) } as UserProfile;
      curProfile.isSuspended = params.suspended;

      await client.query(
        `UPDATE public.app_users SET profile = $1::jsonb, updated_at = now() WHERE id = $2`,
        [JSON.stringify(curProfile), targetRow.id]
      );

      let cleared = 0;
      if (params.suspended) {
        const del = await client.query(`DELETE FROM public.app_sessions WHERE user_id = $1`, [targetRow.id]);
        cleared = del.rowCount || 0;
      }

      const aud: AdminAuditLog = {
        id: audId,
        adminUserId: params.adminUser.id,
        adminEmail: params.adminUser.email,
        action: params.suspended ? 'user.suspend' : 'user.reactivate',
        targetType: 'user',
        targetId: targetRow.id,
        reason: params.reason,
        metadata: {
          targetEmail: targetRow.email,
          suspended: params.suspended,
          clearedSessions: cleared,
        },
        ipAddress: params.ipAddress,
        createdAt: nowIso,
      };

      await client.query(
        `INSERT INTO public.admin_audit_logs (
           id, admin_user_id, admin_email, action, target_type, target_id, reason, metadata, ip_address, created_at
         ) VALUES ($1, $2, $3, $4, 'user', $5, $6, $7::jsonb, $8, $9::timestamptz)`,
        [
          aud.id,
          aud.adminUserId,
          aud.adminEmail,
          aud.action,
          aud.targetId,
          aud.reason,
          JSON.stringify(aud.metadata || {}),
          aud.ipAddress || null,
          nowIso,
        ]
      );

      return { clearedSessions: cleared, auditLog: aud };
    });

    const summaries = await this.loadAllAdminUserSummaries();
    const user = summaries.find((u) => u.id === params.targetUserId)!;
    return { user, clearedSessions, auditLog };
  }

  async adminRevokeUserSessions(params: {
    adminUser: UserProfile;
    targetUserId: string;
    reason: string;
    ipAddress?: string;
  }): Promise<{ clearedSessions: number; auditLog: AdminAuditLog }> {
    const audId = `aud_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    return this.storage.withTransaction(async (client) => {
      const userRes = await client.query<{ id: string; email: string }>(
        `SELECT id, email FROM public.app_users WHERE id = $1`,
        [params.targetUserId]
      );
      const targetRow = userRes.rows[0];
      if (!targetRow) throw new Error('Foydalanuvchi topilmadi');

      const del = await client.query(`DELETE FROM public.app_sessions WHERE user_id = $1`, [targetRow.id]);
      const clearedSessions = del.rowCount || 0;

      const auditLog: AdminAuditLog = {
        id: audId,
        adminUserId: params.adminUser.id,
        adminEmail: params.adminUser.email,
        action: 'user.revoke_sessions',
        targetType: 'user',
        targetId: targetRow.id,
        reason: params.reason,
        metadata: {
          targetEmail: targetRow.email,
          clearedSessions,
        },
        ipAddress: params.ipAddress,
        createdAt: nowIso,
      };

      await client.query(
        `INSERT INTO public.admin_audit_logs (
           id, admin_user_id, admin_email, action, target_type, target_id, reason, metadata, ip_address, created_at
         ) VALUES ($1, $2, $3, $4, 'user', $5, $6, $7::jsonb, $8, $9::timestamptz)`,
        [
          auditLog.id,
          auditLog.adminUserId,
          auditLog.adminEmail,
          auditLog.action,
          auditLog.targetId,
          auditLog.reason,
          JSON.stringify(auditLog.metadata || {}),
          auditLog.ipAddress || null,
          nowIso,
        ]
      );

      return { clearedSessions, auditLog };
    });
  }

  private async loadRecentAiEvents(limit: number = 5000): Promise<AiUsageEvent[]> {
    const res = await this.storage.query<{
      id: string;
      user_id: string | null;
      endpoint: string;
      model: string;
      source: 'gemini' | 'fallback';
      status: 'success' | 'fallback' | 'error';
      latency_ms: number;
      prompt_chars: number;
      completion_chars: number;
      language: string;
      error_code: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, user_id, endpoint, model, source, status, latency_ms, prompt_chars, completion_chars, language, error_code, created_at
         FROM public.ai_usage_events
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
      { retryable: true, label: 'load_ai_usage_events' }
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id || undefined,
      endpoint: r.endpoint,
      model: r.model,
      source: r.source,
      status: r.status,
      latencyMs: Number(r.latency_ms) || 0,
      promptChars: Number(r.prompt_chars) || 0,
      completionChars: Number(r.completion_chars) || 0,
      language: r.language || 'uz',
      errorCode: r.error_code || undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  private async loadRecentApiErrors(limit: number = 2000): Promise<ApiErrorEvent[]> {
    const res = await this.storage.query<{
      id: string;
      method: string;
      path: string;
      status_code: number;
      error_message: string;
      user_id: string | null;
      created_at: Date | string;
    }>(
      `SELECT id, method, path, status_code, error_message, user_id, created_at
         FROM public.api_error_events
        ORDER BY created_at DESC
        LIMIT $1`,
      [limit],
      { retryable: true, label: 'load_api_error_events' }
    );
    return res.rows.map((r) => ({
      id: r.id,
      method: r.method,
      path: r.path,
      statusCode: Number(r.status_code) || 500,
      errorMessage: r.error_message,
      userId: r.user_id || undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  private async loadRecentSubscriptionEvents(limit: number = 2000): Promise<SubscriptionEvent[]> {
    const res = await this.storage.query<{
      id: string;
      user_id: string;
      user_email: string | null;
      user_full_name: string | null;
      plan: 'free' | 'pro' | 'business';
      previous_plan: 'free' | 'pro' | 'business';
      amount_uzs: number | string;
      currency: string;
      source: SubscriptionEvent['source'];
      actor_user_id: string;
      duration_months: number;
      expires_at: string | null;
      reason: string | null;
      created_at: Date | string;
    }>(
      `SELECT s.id,
              s.user_id,
              u.email AS user_email,
              u.profile->>'fullName' AS user_full_name,
              s.plan,
              s.previous_plan,
              s.amount_uzs,
              s.currency,
              s.source,
              s.actor_user_id,
              s.duration_months,
              s.expires_at,
              s.reason,
              s.created_at
         FROM public.subscription_events s
         LEFT JOIN public.app_users u ON u.id = s.user_id
        ORDER BY s.created_at DESC
        LIMIT $1`,
      [limit],
      { retryable: true, label: 'load_subscription_events' }
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email || undefined,
      userFullName: r.user_full_name || undefined,
      plan: r.plan,
      previousPlan: r.previous_plan || 'free',
      amountUzs: Number(r.amount_uzs) || 0,
      currency: 'UZS',
      source: r.source,
      actorUserId: r.actor_user_id,
      durationMonths: Number(r.duration_months) || 0,
      expiresAt: r.expires_at || undefined,
      reason: r.reason || undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  async getAdminOverviewData(): Promise<AdminOverviewData> {
    const [users, txCountRes, aiEvents, apiErrors, subscriptionEvents, auditRes, config, health] = await Promise.all([
      this.loadAllAdminUserSummaries(),
      this.storage.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM public.app_data WHERE collection = 'transactions'`,
        [],
        { retryable: true, label: 'count_all_transactions' }
      ),
      this.loadRecentAiEvents(),
      this.loadRecentApiErrors(),
      this.loadRecentSubscriptionEvents(),
      this.listAdminAuditLogs({ page: 1, limit: 8 }),
      this.getAppConfig(),
      this.healthCheck(),
    ]);

    return buildAdminOverviewData({
      users,
      totalTransactions: Number(txCountRes.rows[0]?.cnt || 0),
      aiEvents,
      apiErrors,
      subscriptionEvents,
      auditLogs: auditRes.logs,
      config,
      health,
    });
  }

  async getAdminSubscriptionsData(params: { page?: number; limit?: number }): Promise<AdminSubscriptionsData> {
    const [users, subscriptionEvents] = await Promise.all([
      this.loadAllAdminUserSummaries(),
      this.loadRecentSubscriptionEvents(),
    ]);
    return buildAdminSubscriptionsData({
      users,
      subscriptionEvents,
      page: Number(params.page) || 1,
      limit: Number(params.limit) || 20,
    });
  }

  async getAdminRevenueData(): Promise<AdminRevenueData> {
    const [users, subscriptionEvents, config] = await Promise.all([
      this.loadAllAdminUserSummaries(),
      this.loadRecentSubscriptionEvents(),
      this.getAppConfig(),
    ]);
    return buildAdminRevenueData({ users, subscriptionEvents, config });
  }

  async getAdminAiAnalyticsData(): Promise<AdminAiAnalyticsData> {
    const aiEvents = await this.loadRecentAiEvents();
    return buildAdminAiAnalyticsData(aiEvents);
  }

  async getAdminSystemHealthData(): Promise<AdminSystemHealthData> {
    const [apiErrors, health] = await Promise.all([this.loadRecentApiErrors(), this.healthCheck()]);
    return buildAdminSystemHealthData({ apiErrors, health });
  }
}
