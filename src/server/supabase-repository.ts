/**
 * Async repository facade for user-owned JSONB collections.
 *
 * This module is a storage primitive for the staged migration. It is not yet
 * wired into Express routes or the legacy synchronous Database class.
 */
import {
  deleteUserData,
  listUserData,
  saveManyUserData,
  saveUserData,
  transferWalletsAtomically,
  type AtomicWalletTransferInput,
  type AppDataCollection,
  type StoredAppData,
} from './supabase-storage';

export interface IdentifiedRecord {
  id: string;
  [key: string]: unknown;
}

function requireId(value: string, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function toStoredRecord<T extends IdentifiedRecord>(
  userId: string,
  collection: AppDataCollection,
  scopeKey: string,
  record: T,
): StoredAppData {
  return {
    owner_user_id: requireId(userId, 'userId'),
    collection,
    scope_key: requireId(scopeKey, 'scopeKey'),
    record_key: requireId(record.id, 'record.id'),
    payload: record as Record<string, unknown>,
  };
}

/** Read all records for one owner and scope, preserving their JSONB payloads. */
export async function getRecords<T extends IdentifiedRecord>(
  userId: string,
  collection: AppDataCollection,
  scopeKey = userId,
): Promise<T[]> {
  const rows = await listUserData(
    requireId(userId, 'userId'),
    collection,
    requireId(scopeKey, 'scopeKey'),
  );
  return rows.map((row) => row.payload as T);
}

/** Read one record by its stable record id. */
export async function getRecord<T extends IdentifiedRecord>(
  userId: string,
  collection: AppDataCollection,
  recordId: string,
  scopeKey = userId,
): Promise<T | null> {
  const id = requireId(recordId, 'recordId');
  const rows = await getRecords<T>(userId, collection, scopeKey);
  return rows.find((row) => row.id === id) ?? null;
}

/** Insert or update a single record without replacing its collection. */
export async function putRecord<T extends IdentifiedRecord>(
  userId: string,
  collection: AppDataCollection,
  record: T,
  scopeKey = userId,
): Promise<void> {
  await saveUserData(toStoredRecord(userId, collection, scopeKey, record));
}

/** Upsert records in one bounded request; does not delete omitted records. */
export async function putRecords<T extends IdentifiedRecord>(
  userId: string,
  collection: AppDataCollection,
  records: T[],
  scopeKey = userId,
): Promise<void> {
  const ownerId = requireId(userId, 'userId');
  const scope = requireId(scopeKey, 'scopeKey');
  const seen = new Set<string>();
  const stored = records.map((record) => {
    const key = requireId(record.id, 'record.id');
    if (seen.has(key)) throw new Error(`Duplicate record id in batch: ${key}`);
    seen.add(key);
    return toStoredRecord(ownerId, collection, scope, record);
  });
  await saveManyUserData(stored);
}

/** Delete exactly one record; unrelated records remain untouched. */
export async function removeRecord(
  userId: string,
  collection: AppDataCollection,
  recordId: string,
  scopeKey = userId,
): Promise<void> {
  await deleteUserData(
    requireId(userId, 'userId'),
    collection,
    requireId(scopeKey, 'scopeKey'),
    requireId(recordId, 'recordId'),
  );
}


/** Atomically update both wallet balances and append the transfer ledger entry. */
export async function transferWallets(
  input: AtomicWalletTransferInput,
): Promise<Record<string, unknown>> {
  return transferWalletsAtomically(input);
}
