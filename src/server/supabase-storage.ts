/**
 * Server-only Supabase Storage adapter.
 *
 * This module is intentionally not wired into the synchronous legacy Database
 * class yet. Route handlers must be migrated to async repository calls before
 * enabling it in production.
 */

type JsonObject = Record<string, unknown>;

export const APP_DATA_COLLECTIONS = ['transactions', 'categories', 'budgets', 'goals', 'debts', 'notifications', 'wallets', 'walletTransfers', 'familyGroups', 'familyMembers', 'familyInvitations', 'subscriptions', 'recurringTransactions', 'recurringLogs', 'receipts', 'bankConnections', 'bankSyncLogs', 'telegramConnections'] as const;
export type AppDataCollection = (typeof APP_DATA_COLLECTIONS)[number];

function requireNonEmpty(value: string, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new SupabaseStorageError(name + ' must be a non-empty string');
  return value.trim();
}

function requireCollection(value: string): AppDataCollection {
  if (!(APP_DATA_COLLECTIONS as readonly string[]).includes(value)) throw new SupabaseStorageError('Unsupported app data collection');
  return value as AppDataCollection;
}

export interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  profile: JsonObject;
  created_at?: string;
  updated_at?: string;
}

export interface StoredSession {
  token_hash: string;
  user_id: string;
  expires_at?: string | null;
  last_used_at?: string | null;
}

export interface StoredAppData {
  owner_user_id: string;
  collection: AppDataCollection;
  scope_key: string;
  record_key: string;
  payload: JsonObject;
}

export class SupabaseStorageError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SupabaseStorageError';
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new SupabaseStorageError(`Missing required server environment variable: ${name}`);
  return value;
}

function getConfig() {
  const rawUrl = requiredEnv('SUPABASE_URL');
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new SupabaseStorageError('SUPABASE_URL must use HTTPS');
  }
  return {
    baseUrl: `${url.origin}/rest/v1`,
    serviceKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getConfig();
  const response = await fetch(`${config.baseUrl}/${path}`, {
    ...init,
    headers: {
      ...init.headers,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Authentication is last so callers cannot override service credentials.
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
    },
    signal: init.signal ?? AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    // Do not include response bodies: PostgREST errors can contain submitted values.
    throw new SupabaseStorageError(
      `Supabase request failed (${response.status}) for ${path.split('?')[0]}`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/** Verify server credentials and that the expected storage schema is reachable. */
export async function checkSupabaseStorage(): Promise<boolean> {
  await request<unknown[]>(
    `app_users?${query({ select: 'id', limit: '1' })}`,
  );
  return true;
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const normalizedEmail = requireNonEmpty(email, 'email').toLowerCase();
  const rows = await request<StoredUser[]>(
    `app_users?${query({ select: '*', email_normalized: `eq.${normalizedEmail}`, limit: '1' })}`,
  );
  return rows[0] ?? null;
}

export async function findUserById(userId: string): Promise<StoredUser | null> {
  userId = requireNonEmpty(userId, 'userId');
  const rows = await request<StoredUser[]>(
    `app_users?${query({ select: '*', id: `eq.${userId}`, limit: '1' })}`,
  );
  return rows[0] ?? null;
}

export async function saveUser(user: StoredUser): Promise<void> {
  requireNonEmpty(user.id, 'user.id');
  requireNonEmpty(user.email, 'user.email');
  requireNonEmpty(user.password_hash, 'user.password_hash');
  requireNonEmpty(user.password_salt, 'user.password_salt');
  await request<StoredUser[]>(
    'app_users',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(user),
    },
  );
}

export async function saveSession(session: StoredSession): Promise<void> {
  requireNonEmpty(session.token_hash, 'session.token_hash');
  requireNonEmpty(session.user_id, 'session.user_id');
  await request<StoredSession[]>(
    'app_sessions',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(session),
    },
  );
}

export interface AtomicUserRegistrationInput {
  user: StoredUser;
  tokenHash: string;
  wallets: Record<string, unknown>[];
  telegramConnection: Record<string, unknown>;
  welcomeNotification: Record<string, unknown>;
}

/** Create the account, first session, and initial app records in one DB transaction. */
export async function registerUserAtomically(input: AtomicUserRegistrationInput): Promise<void> {
  requireNonEmpty(input.user.id, 'user.id');
  requireNonEmpty(input.user.email, 'user.email');
  requireNonEmpty(input.tokenHash, 'tokenHash');
  if (input.wallets.length !== 2) {
    throw new SupabaseStorageError('Exactly two initial wallets are required');
  }
  await request<Record<string, unknown>>(
    'rpc/hisobot_register_user',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: input.user.id,
        p_email: input.user.email,
        p_password_hash: input.user.password_hash,
        p_password_salt: input.user.password_salt,
        p_profile: input.user.profile,
        p_token_hash: input.tokenHash,
        p_wallets: input.wallets,
        p_telegram_connection: input.telegramConnection,
        p_welcome_notification: input.welcomeNotification,
      }),
    },
  );
}

export async function findSession(tokenHash: string): Promise<StoredSession | null> {
  tokenHash = requireNonEmpty(tokenHash, 'tokenHash');
  const rows = await request<StoredSession[]>(
    `app_sessions?${query({ select: '*', token_hash: `eq.${tokenHash}`, limit: '1' })}`,
  );
  return rows[0] ?? null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  tokenHash = requireNonEmpty(tokenHash, 'tokenHash');
  await request<void>(
    `app_sessions?${query({ token_hash: `eq.${tokenHash}` })}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  userId = requireNonEmpty(userId, 'userId');
  await request<void>(
    `app_sessions?${query({ user_id: `eq.${userId}` })}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
}

export async function listUserData(
  userId: string,
  collection: string,
  scopeKey?: string,
): Promise<StoredAppData[]> {
  userId = requireNonEmpty(userId, 'userId');
  const allowedCollection = requireCollection(collection);
  const filters: Record<string, string> = {
    select: '*',
    owner_user_id: `eq.${userId}`,
    collection: `eq.${allowedCollection}`,
    order: 'updated_at.asc',
  };
  if (scopeKey !== undefined) filters.scope_key = `eq.${scopeKey}`;
  return request<StoredAppData[]>(`app_data?${query(filters)}`);
}

export async function saveUserData(record: StoredAppData): Promise<void> {
  requireNonEmpty(record.owner_user_id, 'record.owner_user_id');
  requireCollection(record.collection);
  requireNonEmpty(record.scope_key, 'record.scope_key');
  requireNonEmpty(record.record_key, 'record.record_key');
  await request<StoredAppData[]>(
    'app_data',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(record),
    },
  );
}

export interface AtomicRecurringExecutionInput {
  userId: string;
  recurringId: string;
  executionId: string;
  executedAt?: string;
}

/** Execute a due recurring schedule atomically, including wallet and ledger updates. */
export async function executeRecurringTransactionAtomically(
  input: AtomicRecurringExecutionInput,
): Promise<Record<string, unknown>> {
  requireNonEmpty(input.userId, 'userId');
  requireNonEmpty(input.recurringId, 'recurringId');
  requireNonEmpty(input.executionId, 'executionId');
  if (input.executedAt && Number.isNaN(Date.parse(input.executedAt))) {
    throw new SupabaseStorageError('executedAt must be a valid timestamp');
  }
  return request<Record<string, unknown>>(
    'rpc/hisobot_execute_recurring_transaction',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: input.userId,
        p_recurring_id: input.recurringId,
        p_execution_id: input.executionId,
        p_executed_at: input.executedAt ?? new Date().toISOString(),
      }),
    },
  );
}

export interface AtomicFinancialOperationInput {
  userId: string;
  operationId: string;
  operationType: 'goal_deposit' | 'debt_payment';
  targetRecordId: string;
  amount: number;
}

/** Apply a goal deposit or debt payment atomically and idempotently. */
export async function applyFinancialOperationAtomically(
  input: AtomicFinancialOperationInput,
): Promise<Record<string, unknown>> {
  requireNonEmpty(input.userId, 'userId');
  requireNonEmpty(input.operationId, 'operationId');
  requireNonEmpty(input.targetRecordId, 'targetRecordId');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    throw new SupabaseStorageError('Amount must be a positive safe integer');
  }
  return request<Record<string, unknown>>(
    'rpc/hisobot_apply_financial_operation',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: input.userId,
        p_operation_id: input.operationId,
        p_operation_type: input.operationType,
        p_target_record_id: input.targetRecordId,
        p_amount: input.amount,
      }),
    },
  );
}

export interface AtomicWalletTransferInput {
  userId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  targetAmount: number;
  transferId: string;
  date: string;
  notes?: string;
}

/** Execute the wallet balance changes and ledger insert in one DB transaction. */
export async function transferWalletsAtomically(
  input: AtomicWalletTransferInput,
): Promise<Record<string, unknown>> {
  requireNonEmpty(input.userId, 'userId');
  requireNonEmpty(input.fromWalletId, 'fromWalletId');
  requireNonEmpty(input.toWalletId, 'toWalletId');
  requireNonEmpty(input.transferId, 'transferId');
  requireNonEmpty(input.date, 'date');
  if (input.fromWalletId === input.toWalletId) {
    throw new SupabaseStorageError('Source and destination wallets must differ');
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 ||
      !Number.isSafeInteger(input.targetAmount) || input.targetAmount <= 0) {
    throw new SupabaseStorageError('Transfer amounts must be positive safe integers');
  }
  return request<Record<string, unknown>>(
    'rpc/hisobot_transfer_between_wallets',
    {
      method: 'POST',
      body: JSON.stringify({
        p_user_id: input.userId,
        p_from_wallet_id: input.fromWalletId,
        p_to_wallet_id: input.toWalletId,
        p_amount: input.amount,
        p_target_amount: input.targetAmount,
        p_transfer_id: input.transferId,
        p_date: input.date,
        p_notes: input.notes ?? null,
      }),
    },
  );
}

/** Upsert a bounded batch in one PostgREST request. */
export async function saveManyUserData(records: StoredAppData[]): Promise<void> {
  if (records.length === 0) return;
  if (records.length > 500) {
    throw new SupabaseStorageError('A storage batch cannot exceed 500 records');
  }
  for (const record of records) {
    requireNonEmpty(record.owner_user_id, 'record.owner_user_id');
    requireCollection(record.collection);
    requireNonEmpty(record.scope_key, 'record.scope_key');
    requireNonEmpty(record.record_key, 'record.record_key');
  }
  await request<StoredAppData[]>(
    'app_data',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(records),
    },
  );
}

export async function deleteUserData(
  userId: string,
  collection: string,
  scopeKey: string,
  recordKey: string,
): Promise<void> {
  userId = requireNonEmpty(userId, 'userId');
  const allowedCollection = requireCollection(collection);
  scopeKey = requireNonEmpty(scopeKey, 'scopeKey');
  recordKey = requireNonEmpty(recordKey, 'recordKey');
  await request<void>(
    `app_data?${query({
      owner_user_id: `eq.${userId}`,
      collection: `eq.${allowedCollection}`,
      scope_key: `eq.${scopeKey}`,
      record_key: `eq.${recordKey}`,
    })}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
}
