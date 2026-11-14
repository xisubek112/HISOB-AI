/**
 * Stable async data-access contract for the HISOBOT API migration.
 *
 * This contract is deliberately separate from the legacy synchronous Database.
 * It makes ownership explicit and keeps the storage implementation replaceable.
 * Do not wire it into Express until every route in a cutover group is migrated.
 */
import {
  getRecords,
  getRecord,
  putRecord,
  putRecords,
  removeRecord,
  transferWallets,
  depositToGoalAtomically,
  payDebtAtomically,
  executeRecurringScheduleAtomically,
  type IdentifiedRecord,
} from './supabase-repository';
import type {
  AppDataCollection,
  AtomicFinancialOperationInput,
  AtomicRecurringExecutionInput,
  AtomicWalletTransferInput,
} from './supabase-storage';

export interface AsyncUserDataRepository {
  list<T extends IdentifiedRecord>(
    ownerUserId: string,
    collection: AppDataCollection,
    scopeKey?: string,
  ): Promise<T[]>;

  get<T extends IdentifiedRecord>(
    ownerUserId: string,
    collection: AppDataCollection,
    recordId: string,
    scopeKey?: string,
  ): Promise<T | null>;

  put<T extends IdentifiedRecord>(
    ownerUserId: string,
    collection: AppDataCollection,
    record: T,
    scopeKey?: string,
  ): Promise<void>;

  putMany<T extends IdentifiedRecord>(
    ownerUserId: string,
    collection: AppDataCollection,
    records: T[],
    scopeKey?: string,
  ): Promise<void>;

  remove(
    ownerUserId: string,
    collection: AppDataCollection,
    recordId: string,
    scopeKey?: string,
  ): Promise<void>;

  transferWallets(input: AtomicWalletTransferInput): Promise<Record<string, unknown>>;
  depositToGoal(input: Omit<AtomicFinancialOperationInput, 'operationType'>): Promise<Record<string, unknown>>;
  payDebt(input: Omit<AtomicFinancialOperationInput, 'operationType'>): Promise<Record<string, unknown>>;
  executeRecurring(input: AtomicRecurringExecutionInput): Promise<Record<string, unknown>>;
}

/**
 * Supabase-backed implementation. Every generic data operation requires an
 * explicit owner id; callers must derive it from the authenticated session,
 * never from an untrusted request body.
 */
export const supabaseUserDataRepository: AsyncUserDataRepository = {
  list: getRecords,
  get: getRecord,
  put: putRecord,
  putMany: putRecords,
  remove: removeRecord,
  transferWallets,
  depositToGoal: depositToGoalAtomically,
  payDebt: payDebtAtomically,
  executeRecurring: executeRecurringScheduleAtomically,
};
