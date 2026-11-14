/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { PostgresStorage } from '../../src/server/supabase-storage.ts';
import { SupabaseRepository } from '../../src/server/supabase-repository.ts';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');
const EXPECTED_MIGRATIONS = [
  '202611130001_initial_app_storage.sql',
  '202611130002_atomic_wallet_transfers.sql',
  '202611130003_atomic_financial_operations.sql',
  '202611130004_recurring_transactions.sql',
  '202611130005_atomic_user_registration.sql',
];

const ALL_COLLECTIONS = [
  'transactions',
  'categories',
  'budgets',
  'goals',
  'debts',
  'notifications',
  'wallets',
  'walletTransfers',
  'familyGroups',
  'familyMembers',
  'familyInvitations',
  'subscriptions',
  'recurringTransactions',
  'recurringLogs',
  'receipts',
  'bankConnections',
  'bankSyncLogs',
  'telegramConnections',
];

test('SQL migrations #001-#005 exist, enforce RLS, search_path, row locks, and least-privilege grants', () => {
  for (const file of EXPECTED_MIGRATIONS) {
    const full = path.join(MIGRATIONS_DIR, file);
    assert.ok(fs.existsSync(full), `Missing migration file: ${file}`);
    const sql = fs.readFileSync(full, 'utf-8');
    assert.match(sql, /\bbegin\s*;/i, `${file} must wrap changes in begin/commit`);
    assert.match(sql, /\bcommit\s*;/i, `${file} must end with commit`);
  }

  const m1 = fs.readFileSync(path.join(MIGRATIONS_DIR, EXPECTED_MIGRATIONS[0]), 'utf-8');
  for (const col of ALL_COLLECTIONS) {
    assert.ok(m1.includes(`'${col}'`), `Migration 001 CHECK constraint missing collection ${col}`);
  }
  assert.match(m1, /alter table public\.app_users enable row level security/i);
  assert.match(m1, /alter table public\.app_sessions enable row level security/i);
  assert.match(m1, /alter table public\.app_data enable row level security/i);
  assert.match(m1, /revoke all on table public\.app_users from anon, authenticated/i);
  assert.match(m1, /grant all on table public\.app_data to service_role/i);

  const m2 = fs.readFileSync(path.join(MIGRATIONS_DIR, EXPECTED_MIGRATIONS[1]), 'utf-8');
  assert.match(m2, /alter table public\.app_idempotency_keys enable row level security/i);
  assert.match(m2, /alter table public\.app_audit_logs enable row level security/i);
  assert.match(m2, /security definer\s+set search_path = public, pg_temp/i);
  assert.match(m2, /for update/i);
  assert.match(m2, /revoke all on function public\.hisobot_transfer_between_wallets.*from public, anon, authenticated/i);

  const m3 = fs.readFileSync(path.join(MIGRATIONS_DIR, EXPECTED_MIGRATIONS[2]), 'utf-8');
  for (const fn of [
    'hisobot_add_transaction',
    'hisobot_update_transaction',
    'hisobot_delete_transaction',
    'hisobot_deposit_to_goal',
    'hisobot_pay_debt',
  ]) {
    assert.ok(m3.includes(fn), `Migration 003 missing RPC ${fn}`);
    assert.match(m3, new RegExp(`grant execute on function public\\.${fn}.*to service_role`, 'i'));
  }

  const m4 = fs.readFileSync(path.join(MIGRATIONS_DIR, EXPECTED_MIGRATIONS[3]), 'utf-8');
  assert.match(m4, /hisobot_execute_recurring_schedule/i);
  assert.match(m4, /security definer\s+set search_path = public, pg_temp/i);

  const m5 = fs.readFileSync(path.join(MIGRATIONS_DIR, EXPECTED_MIGRATIONS[4]), 'utf-8');
  assert.match(m5, /hisobot_register_user_atomic/i);
  assert.match(m5, /when unique_violation then/i);
});

const LIVE_DB_URL = process.env.TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

test(
  'Live PostgreSQL integration: concurrent wallet transfers, idempotency, ownership isolation, and atomic rollback',
  { skip: !LIVE_DB_URL ? 'TEST_DATABASE_URL / DATABASE_URL muhit oʻzgaruvchisi berilmagan' : false },
  async () => {
    const storage = new PostgresStorage(LIVE_DB_URL!);
    const repo = new SupabaseRepository(storage);
    let userAId = '';
    let userBId = '';

    try {
      // Ensure migrations are applied idempotently in test database
      for (const file of EXPECTED_MIGRATIONS) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
        await storage.query(sql, [], { label: `apply_${file}` });
      }

      const emailA = `pg_test_a_${Date.now()}@hisobot.uz`;
      const emailB = `pg_test_b_${Date.now()}@hisobot.uz`;
      const a = await repo.registerUser(emailA, 'StrongPass#1', 'PG User A');
      const b = await repo.registerUser(emailB, 'StrongPass#2', 'PG User B');
      userAId = a.user.id;
      userBId = b.user.id;

      const w1 = await repo.addWallet(userAId, {
        name: 'Source Card',
        type: 'card',
        balance: 1_000_000,
        currency: 'UZS',
        color: '#10B981',
      });
      const w2 = await repo.addWallet(userAId, {
        name: 'Dest Cash',
        type: 'cash',
        balance: 0,
        currency: 'UZS',
        color: '#3B82F6',
      });

      // Parallel transfers racing against 1,000,000 balance (5 x 300,000 -> at most 3 succeed)
      const attempts = Array.from({ length: 5 }, (_, idx) =>
        repo.transferBetweenWallets(userAId, w1.id, w2.id, 300_000, undefined, `Race #${idx}`)
      );
      const settled = await Promise.allSettled(attempts);
      const succeeded = settled.filter((r) => r.status === 'fulfilled').length;
      assert.equal(succeeded, 3);

      const wallets = await repo.getWallets(userAId);
      const w1After = wallets.find((w) => w.id === w1.id)!;
      const w2After = wallets.find((w) => w.id === w2.id)!;
      assert.equal(w1After.balance, 100_000);
      assert.equal(w2After.balance, 900_000);

      // Idempotent double-submit returns exact same transfer without deducting twice
      const idem1 = await repo.transferBetweenWallets(userAId, w1.id, w2.id, 50_000, undefined, 'Idem', 'pg-idem-1');
      const idem2 = await repo.transferBetweenWallets(userAId, w1.id, w2.id, 50_000, undefined, 'Idem', 'pg-idem-1');
      assert.equal(idem1.id, idem2.id);

      // Ownership isolation check
      assert.equal((await repo.getWallets(userBId)).length, 1);
      await assert.rejects(() => repo.transferBetweenWallets(userBId, w1.id, w2.id, 10_000));
    } finally {
      if (userAId) await storage.query('DELETE FROM public.app_users WHERE id = $1', [userAId]);
      if (userBId) await storage.query('DELETE FROM public.app_users WHERE id = $1', [userBId]);
      await storage.close();
    }
  }
);
