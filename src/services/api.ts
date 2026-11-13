/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserProfile,
  Transaction,
  Category,
  Budget,
  FinancialGoal,
  Debt,
  NotificationItem,
  FinancialSummary,
  AIParsedTransaction,
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
  TelegramConnection,
  FinancialHealthScore,
  FinancialForecast,
  CurrencyCode,
} from '../types/finance.ts';

const TOKEN_KEY = 'hisobot_auth_token';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const currentToken = this.getToken();
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `Server xatosi: ${res.status}`;
      try {
        const data = await res.json();
        if (data.error) errorMsg = data.error;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // --- Auth ---
  async register(email: string, pass: string, fullName: string): Promise<{ user: UserProfile; token: string }> {
    const data = await this.request<{ user: UserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass, fullName }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, pass: string): Promise<{ user: UserProfile; token: string }> {
    const data = await this.request<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe(): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>('/api/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(email: string, code: string, newPass: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword: newPass }),
    });
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<{ user: UserProfile }> {
    return this.request<{ user: UserProfile }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async upgradeToPremium(plan: 'pro' | 'business', durationMonths: number = 1): Promise<{ user: UserProfile; message: string }> {
    return this.request<{ user: UserProfile; message: string }>('/api/user/upgrade-premium', {
      method: 'POST',
      body: JSON.stringify({ plan, durationMonths }),
    });
  }

  async changePassword(oldPass: string, newPass: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
    });
  }

  // --- Transactions ---
  async getTransactions(params?: {
    type?: string;
    categoryId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    sort?: string;
  }): Promise<{ transactions: Transaction[] }> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.search) query.set('search', params.search);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.sort) query.set('sort', params.sort);

    return this.request<{ transactions: Transaction[] }>(`/api/transactions?${query.toString()}`);
  }

  async addTransaction(tx: Omit<Transaction, 'id' | 'userId' | 'createdAt'>): Promise<{ transaction: Transaction }> {
    return this.request<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(tx),
    });
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<{ transaction: Transaction }> {
    return this.request<{ transaction: Transaction }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTransaction(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Categories ---
  async getCategories(): Promise<{ categories: Category[] }> {
    return this.request<{ categories: Category[] }>('/api/categories');
  }

  async addCategory(cat: { name: string; type: 'income' | 'expense'; icon: string; color: string }): Promise<{ category: Category }> {
    return this.request<{ category: Category }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
  }

  async deleteCategory(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Budgets ---
  async getBudgets(): Promise<{
    budgets: (Budget & {
      spent: number;
      remaining: number;
      percentage: number;
      isWarning: boolean;
      isExceeded: boolean;
    })[];
  }> {
    return this.request('/api/budgets');
  }

  async setBudget(budget: Omit<Budget, 'id' | 'userId'>): Promise<{ budget: Budget }> {
    return this.request<{ budget: Budget }>('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(budget),
    });
  }

  async deleteBudget(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/budgets/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Goals ---
  async getGoals(): Promise<{ goals: FinancialGoal[] }> {
    return this.request<{ goals: FinancialGoal[] }>('/api/goals');
  }

  async addGoal(goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>): Promise<{ goal: FinancialGoal }> {
    return this.request<{ goal: FinancialGoal }>('/api/goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    });
  }

  async updateGoal(id: string, updates: Partial<FinancialGoal>): Promise<{ goal: FinancialGoal }> {
    return this.request<{ goal: FinancialGoal }>(`/api/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async depositToGoal(id: string, amount: number): Promise<{ goal: FinancialGoal }> {
    return this.request<{ goal: FinancialGoal }>(`/api/goals/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async deleteGoal(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Debts ---
  async getDebts(): Promise<{ debts: Debt[] }> {
    return this.request<{ debts: Debt[] }>('/api/debts');
  }

  async addDebt(debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>): Promise<{ debt: Debt }> {
    return this.request<{ debt: Debt }>('/api/debts', {
      method: 'POST',
      body: JSON.stringify(debt),
    });
  }

  async updateDebt(id: string, updates: Partial<Debt>): Promise<{ debt: Debt }> {
    return this.request<{ debt: Debt }>(`/api/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async payDebt(id: string, payment: number): Promise<{ debt: Debt }> {
    return this.request<{ debt: Debt }>(`/api/debts/${id}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment }),
    });
  }

  async deleteDebt(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/debts/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Notifications ---
  async getNotifications(): Promise<{ notifications: NotificationItem[] }> {
    return this.request<{ notifications: NotificationItem[] }>('/api/notifications');
  }

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/notifications/read-all', {
      method: 'PUT',
    });
  }

  // --- Summary & Reports ---
  async getSummary(params?: {
    period?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ summary: FinancialSummary; startDate: string; endDate: string }> {
    const query = new URLSearchParams();
    if (params?.period) query.set('period', params.period);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    return this.request<{ summary: FinancialSummary; startDate: string; endDate: string }>(
      `/api/reports/summary?${query.toString()}`
    );
  }

  // --- AI Assistant & Brain ---
  async parseAITransaction(text: string, language: string = 'uz'): Promise<{ parsed: AIParsedTransaction }> {
    return this.request<{ parsed: AIParsedTransaction }>('/api/ai/parse-transaction', {
      method: 'POST',
      body: JSON.stringify({ text, language }),
    });
  }

  async askAIChat(query: string): Promise<{ answer: string }> {
    return this.request<{ answer: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }

  async getHealthScore(): Promise<{ healthScore: FinancialHealthScore }> {
    return this.request<{ healthScore: FinancialHealthScore }>('/api/ai/health-score');
  }

  async getForecast(): Promise<{ forecast: FinancialForecast }> {
    return this.request<{ forecast: FinancialForecast }>('/api/ai/forecast');
  }

  // --- 1. Wallets & Transfers ---
  async getWallets(): Promise<{ wallets: Wallet[] }> {
    return this.request<{ wallets: Wallet[] }>('/api/wallets');
  }

  async addWallet(wallet: Omit<Wallet, 'id' | 'userId' | 'createdAt'>): Promise<{ wallet: Wallet }> {
    return this.request<{ wallet: Wallet }>('/api/wallets', {
      method: 'POST',
      body: JSON.stringify(wallet),
    });
  }

  async updateWallet(id: string, updates: Partial<Wallet>): Promise<{ wallet: Wallet }> {
    return this.request<{ wallet: Wallet }>(`/api/wallets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteWallet(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/wallets/${id}`, {
      method: 'DELETE',
    });
  }

  async transferWallets(
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    targetAmount?: number,
    notes?: string
  ): Promise<{ transfer: WalletTransfer }> {
    return this.request<{ transfer: WalletTransfer }>('/api/wallets/transfer', {
      method: 'POST',
      body: JSON.stringify({ fromWalletId, toWalletId, amount, targetAmount, notes }),
    });
  }

  async getWalletTransfers(): Promise<{ transfers: WalletTransfer[] }> {
    return this.request<{ transfers: WalletTransfer[] }>('/api/wallets/transfers');
  }

  // --- 2. Family Budget ---
  async getFamily(): Promise<{ group: FamilyGroup | null; members: FamilyMember[]; invitations: FamilyInvitation[] }> {
    return this.request('/api/family');
  }

  async createFamily(name: string, monthlyBudget: number): Promise<{ group: FamilyGroup }> {
    return this.request<{ group: FamilyGroup }>('/api/family', {
      method: 'POST',
      body: JSON.stringify({ name, monthlyBudget }),
    });
  }

  async inviteFamilyMember(email: string, role: string = 'member'): Promise<{ invitation: FamilyInvitation }> {
    return this.request<{ invitation: FamilyInvitation }>('/api/family/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  async acceptFamilyInvite(inviteCode: string): Promise<{ group: FamilyGroup }> {
    return this.request<{ group: FamilyGroup }>('/api/family/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
  }

  async getFamilyTransactions(): Promise<{ transactions: Transaction[] }> {
    return this.request<{ transactions: Transaction[] }>('/api/family/transactions');
  }

  // --- 3. Subscriptions ---
  async getSubscriptions(): Promise<{ subscriptions: Subscription[] }> {
    return this.request<{ subscriptions: Subscription[] }>('/api/subscriptions');
  }

  async addSubscription(sub: Omit<Subscription, 'id' | 'userId' | 'createdAt'>): Promise<{ subscription: Subscription }> {
    return this.request<{ subscription: Subscription }>('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify(sub),
    });
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<{ subscription: Subscription }> {
    return this.request<{ subscription: Subscription }>(`/api/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteSubscription(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  // --- 4. Recurring Payments ---
  async getRecurring(): Promise<{ recurring: RecurringTransaction[]; logs: RecurringExecutionLog[] }> {
    return this.request('/api/recurring');
  }

  async addRecurring(rec: Omit<RecurringTransaction, 'id' | 'userId' | 'createdAt'>): Promise<{ recurring: RecurringTransaction }> {
    return this.request<{ recurring: RecurringTransaction }>('/api/recurring', {
      method: 'POST',
      body: JSON.stringify(rec),
    });
  }

  async updateRecurring(id: string, updates: Partial<RecurringTransaction>): Promise<{ recurring: RecurringTransaction }> {
    return this.request<{ recurring: RecurringTransaction }>(`/api/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteRecurring(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/recurring/${id}`, {
      method: 'DELETE',
    });
  }

  async executeRecurring(id: string): Promise<{ success: boolean; transaction: Transaction }> {
    return this.request(`/api/recurring/${id}/execute`, {
      method: 'POST',
    });
  }

  // --- 5. Receipts & OCR ---
  async getReceipts(): Promise<{ receipts: ScannedReceipt[] }> {
    return this.request<{ receipts: ScannedReceipt[] }>('/api/receipts');
  }

  async scanReceipt(imageBase64OrText: string): Promise<{ parsed: Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'> }> {
    return this.request('/api/receipts/scan', {
      method: 'POST',
      body: JSON.stringify({ imageBase64OrText }),
    });
  }

  async saveReceipt(receipt: any): Promise<{ receipt: ScannedReceipt }> {
    return this.request<{ receipt: ScannedReceipt }>('/api/receipts/save', {
      method: 'POST',
      body: JSON.stringify(receipt),
    });
  }

  // --- 6. Currencies ---
  async getExchangeRates(): Promise<{ rates: ExchangeRate[] }> {
    return this.request<{ rates: ExchangeRate[] }>('/api/currencies/rates');
  }

  async convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): Promise<{ result: number; rate: number }> {
    return this.request('/api/currencies/convert', {
      method: 'POST',
      body: JSON.stringify({ amount, from, to }),
    });
  }

  // --- 7. Banks ---
  async getBanks(): Promise<{ connections: BankConnection[]; supportedBanks: any[] }> {
    return this.request('/api/banks');
  }

  async connectBank(bankId: string, bankName: string): Promise<{ connection: BankConnection }> {
    return this.request<{ connection: BankConnection }>('/api/banks/connect', {
      method: 'POST',
      body: JSON.stringify({ bankId, bankName }),
    });
  }

  async syncBank(id: string): Promise<{ importedCount: number; message: string }> {
    return this.request(`/api/banks/${id}/sync`, {
      method: 'POST',
    });
  }

  async disconnectBank(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/banks/${id}`, {
      method: 'DELETE',
    });
  }

  // --- 8. Telegram ---
  async getTelegram(): Promise<{ connection: TelegramConnection }> {
    return this.request<{ connection: TelegramConnection }>('/api/telegram');
  }

  async updateTelegramPreferences(preferences: TelegramConnection['preferences']): Promise<{ connection: TelegramConnection }> {
    return this.request<{ connection: TelegramConnection }>('/api/telegram/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences }),
    });
  }

  async connectTelegram(username: string): Promise<{ connection: TelegramConnection }> {
    return this.request<{ connection: TelegramConnection }>('/api/telegram/connect', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async disconnectTelegram(): Promise<{ connection: TelegramConnection }> {
    return this.request<{ connection: TelegramConnection }>('/api/telegram/disconnect', {
      method: 'POST',
    });
  }

  async testSendTelegram(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/telegram/test-send', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
