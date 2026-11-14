import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectDatabaseConflicts,
  type ImportPlan,
  type StorageQueryAdapter,
} from '../scripts/import-json-to-supabase.ts';
import { SupabaseRepository } from '../src/server/supabase-repository.ts';
import type { PostgresStorage } from '../src/server/supabase-storage.ts';

test('importer rejects an incoming ID and email that belong to two different existing users', async () => {
  const plan = {
    users: [{
      id: 'user-a',
      email: 'b@example.com',
      passwordHash: 'incoming-hash',
      passwordSalt: 'salt',
      profile: { id: 'user-a', email: 'b@example.com' },
    }],
    dataRows: [{
      ownerUserId: 'user-a',
      collection: 'wallets',
      scopeKey: 'user-a',
      recordKey: 'wallet-1',
      payload: { id: 'wallet-1', balance: 100 },
    }],
    report: {
      counts: {
        usersSkippedExisting: 0,
        usersExactMatch: 0,
        conflictsDetected: 0,
        dataRecordsSkippedExisting: 0,
        dataExactMatch: 0,
      },
      conflicts: [],
      dbConflictCheck: 'skipped_no_database_url',
    },
  } as unknown as ImportPlan;

  const storage = {
    query: async () => ({
      rows: [
        {
          id: 'user-a',
          email: 'a@example.com',
          email_normalized: 'a@example.com',
          password_hash: 'hash-a',
          profile: { id: 'user-a', email: 'a@example.com' },
        },
        {
          id: 'user-b',
          email: 'b@example.com',
          email_normalized: 'b@example.com',
          password_hash: 'hash-b',
          profile: { id: 'user-b', email: 'b@example.com' },
        },
      ],
      rowCount: 2,
    }),
  } as unknown as StorageQueryAdapter;

  const result = await inspectDatabaseConflicts(plan, storage);
  assert.equal(result.emailConflictUserIds.has('user-a'), true);
  assert.equal(plan.report.counts.conflictsDetected, 1);
  assert.equal(plan.report.conflicts[0].reason, 'email_conflict');
  assert.equal(plan.report.conflicts[0].resolution, 'skipped_no_overwrite');
});

test('wallet creation rejects negative and non-finite balances before database access', async () => {
  const repo = new SupabaseRepository({} as PostgresStorage);
  await assert.rejects(
    repo.addWallet('user-a', { name: 'Test', type: 'cash', balance: -1 } as never),
    /Hamyon balansi/
  );
  await assert.rejects(
    repo.addWallet('user-a', { name: 'Test', type: 'cash', balance: Number.NaN } as never),
    /Hamyon balansi/
  );
});

test('recurring payment creation rejects non-positive amounts before database access', async () => {
  const repo = new SupabaseRepository({} as PostgresStorage);
  await assert.rejects(
    repo.addRecurringTransaction('user-a', { amount: 0 } as never),
    /Doimiy toʻlov summasi/
  );
});

test('recurring payment updates reject non-positive amounts', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (sql.includes('SELECT payload')) {
        return { rows: [{ payload: { id: 'rec-1', amount: 500, userId: 'user-a' } }], rowCount: 1 };
      }
      throw new Error('UPDATE should not run for invalid amount');
    },
  };
  const fakeStorage = {
    withTransaction: async (callback: (client: typeof fakeClient) => Promise<unknown>) => callback(fakeClient),
  } as unknown as PostgresStorage;
  const repo = new SupabaseRepository(fakeStorage);
  await assert.rejects(
    repo.updateRecurringTransaction('user-a', 'rec-1', { amount: -10 }),
    /Doimiy toʻlov summasi/
  );
});
