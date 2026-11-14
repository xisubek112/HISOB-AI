/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import type {
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
    const id = `wallet_${crypto.randomUUID()}`;
    const newWallet: Wallet = {
      ...wallet,
      id,
      userId,
      balance: Math.round(Number(wallet.balance) || 0),
      currency: wallet.currency || 'UZS',
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
      const { id: _i, userId: _u, createdAt: _c, ...safeUpdates } = updates;
      const updated: Wallet = {
        ...cur,
        ...safeUpdates,
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
      const { id: _i, userId: _u, createdAt: _c, ...safeUpdates } = updates;
      const updated: Subscription = {
        ...cur,
        ...safeUpdates,
        amount: updates.amount !== undefined ? Math.round(Number(updates.amount)) : cur.amount,
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
      const updated: RecurringTransaction = {
        ...cur,
        ...safeUpdates,
        amount: updates.amount !== undefined ? Math.round(Number(updates.amount)) : cur.amount,
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
                categoryId: 'exp_food',
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
}
