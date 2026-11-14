/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PostgresStorage } from '../../src/server/supabase-storage.ts';
import { SupabaseRepository } from '../../src/server/supabase-repository.ts';
import { runJsonImport } from '../../scripts/import-json-to-supabase.ts';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');
const EXPECTED_MIGRATIONS = [
  '202611130001_initial_app_storage.sql',
  '202611130002_atomic_wallet_transfers.sql',
  '202611130003_atomic_financial_operations.sql',
  '202611130004_recurring_transactions.sql',
  '202611130005_atomic_user_registration.sql',
  '202611130006_dual_starter_wallets_and_idempotency_locks.sql',
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

function extractRpcSignatureArgs(sql: string, fnName: string): number {
  const regex = new RegExp(
    `create or replace function public\\.${fnName}\\s*\\(([\\s\\S]*?)\\)\\s*returns`,
    'gi'
  );
  const matches = Array.from(sql.matchAll(regex));
  assert.ok(matches.length > 0, `RPC ${fnName} definition not found in SQL migrations`);
  const lastMatch = matches[matches.length - 1][1];
  const params = lastMatch
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return params.length;
}

test('SQL migrations #001-#006 exist, enforce RLS, search_path, advisory locks, least-privilege grants, and match TS RPC callers', () => {
  const combinedSqlParts: string[] = [];
  for (const file of EXPECTED_MIGRATIONS) {
    const full = path.join(MIGRATIONS_DIR, file);
    assert.ok(fs.existsSync(full), `Missing migration file: ${file}`);
    const sql = fs.readFileSync(full, 'utf-8');
    assert.match(sql, /\bbegin\s*;/i, `${file} must wrap changes in begin/commit`);
    assert.match(sql, /\bcommit\s*;/i, `${file} must end with commit`);
    combinedSqlParts.push(sql);
  }
  const combinedSql = combinedSqlParts.join('\n');

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

  const m6 = fs.readFileSync(path.join(MIGRATIONS_DIR, EXPECTED_MIGRATIONS[5]), 'utf-8');
  assert.match(m6, /drop function if exists public\.hisobot_register_user_atomic/i);
  assert.match(m6, /p_primary_wallet_id/i);
  assert.match(m6, /p_secondary_wallet_id/i);
  assert.match(m6, /pg_advisory_xact_lock/i);
  for (const fn of [
    'hisobot_register_user_atomic',
    'hisobot_transfer_between_wallets',
    'hisobot_add_transaction',
    'hisobot_deposit_to_goal',
    'hisobot_pay_debt',
    'hisobot_execute_recurring_schedule',
  ]) {
    assert.match(m6, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from public, anon, authenticated`, 'i'));
    assert.match(m6, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`, 'i'));
  }

  // Verify exact RPC parameter counts match TS callers in supabase-repository.ts & supabase-auth.ts
  const expectedRpcArgCounts: Record<string, number> = {
    hisobot_register_user_atomic: 14,
    hisobot_transfer_between_wallets: 8,
    hisobot_add_transaction: 3,
    hisobot_update_transaction: 3,
    hisobot_delete_transaction: 2,
    hisobot_deposit_to_goal: 5,
    hisobot_pay_debt: 5,
    hisobot_execute_recurring_schedule: 5,
  };
  for (const [fn, expectedCount] of Object.entries(expectedRpcArgCounts)) {
    assert.equal(
      extractRpcSignatureArgs(combinedSql, fn),
      expectedCount,
      `SQL RPC ${fn} parameter count mismatch`
    );
  }

  const repoSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/server/supabase-repository.ts'), 'utf-8');
  const authSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/server/supabase-auth.ts'), 'utf-8');
  assert.match(authSrc, /hisobot_register_user_atomic\(\s*\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5::jsonb,\s*\$6,\s*\$7::jsonb,\s*\$8,\s*\$9::jsonb,\s*\$10::jsonb,\s*\$11,\s*\$12::jsonb,\s*\$13,\s*\$14::timestamptz/s);
  assert.match(repoSrc, /hisobot_transfer_between_wallets\(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8\)/);
  assert.match(repoSrc, /hisobot_add_transaction\(\$1, \$2::jsonb, \$3\)/);
  assert.match(repoSrc, /hisobot_update_transaction\(\$1, \$2, \$3::jsonb\)/);
  assert.match(repoSrc, /hisobot_delete_transaction\(\$1, \$2\)/);
  assert.match(repoSrc, /hisobot_deposit_to_goal\(\$1, \$2, \$3, \$4, \$5\)/);
  assert.match(repoSrc, /hisobot_pay_debt\(\$1, \$2, \$3, \$4, \$5\)/);
  assert.match(repoSrc, /hisobot_execute_recurring_schedule\(\$1, \$2, \$3, \$4, \$5\)/);
});

const TEST_DB_URL = process.env.TEST_DATABASE_URL?.trim();
const TEST_ADMIN_DB_URL = process.env.TEST_ADMIN_DATABASE_URL?.trim();
const HAS_DISPOSABLE_TEST_DB = Boolean(TEST_DB_URL || TEST_ADMIN_DB_URL);

function buildDisposableDbUrl(adminUrl: string, dbName: string): string {
  const parsed = new URL(adminUrl);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

test(
  'Live PostgreSQL integration (disposable test database only): dual starter wallets, concurrent transfers, idempotency, ownership isolation, and importer conflict detection',
  {
    skip: !HAS_DISPOSABLE_TEST_DB
      ? 'SKIP: TEST_DATABASE_URL (yoki TEST_ADMIN_DATABASE_URL) berilmagan — alohida disposable test bazasi talab qilinadi (DATABASE_URL ga fallback oʻchirilgan)'
      : false,
  },
  async () => {
    const prodUrl = process.env.DATABASE_URL?.trim();
    if (TEST_DB_URL && prodUrl && TEST_DB_URL === prodUrl && process.env.ALLOW_SHARED_TEST_DB !== 'true') {
      throw new Error(
        'XAVFSIZLIK XATOLIGI: TEST_DATABASE_URL asosiy DATABASE_URL bilan bir xil. Alohida disposable test bazasidan foydalaning.'
      );
    }

    let adminStorage: PostgresStorage | null = null;
    let disposableDbName = '';
    let targetDbUrl = TEST_DB_URL || '';

    if (TEST_ADMIN_DB_URL) {
      disposableDbName = `hisobot_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      adminStorage = new PostgresStorage(TEST_ADMIN_DB_URL);
      await adminStorage.query(`CREATE DATABASE "${disposableDbName}"`, [], { label: 'create_disposable_db' });
      targetDbUrl = buildDisposableDbUrl(TEST_ADMIN_DB_URL, disposableDbName);
    }

    const storage = new PostgresStorage(targetDbUrl);
    const repo = new SupabaseRepository(storage);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisobot-pg-import-'));
    let userAId = '';
    let userBId = '';

    try {
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

      // Dual starter wallets match legacy db.ts ('Asosiy karta' + 'Naqd pul')
      const starterWalletsB = await repo.getWallets(userBId);
      assert.equal(starterWalletsB.length, 2);
      assert.ok(starterWalletsB.some((w) => w.name === 'Asosiy karta' && w.type === 'card'));
      assert.ok(starterWalletsB.some((w) => w.name === 'Naqd pul' && w.type === 'cash'));

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

      // Concurrent identical idempotency keys execute transfer only once
      const [idem1, idem2] = await Promise.all([
        repo.transferBetweenWallets(userAId, w1.id, w2.id, 50_000, undefined, 'Idem', 'pg-idem-concurrent'),
        repo.transferBetweenWallets(userAId, w1.id, w2.id, 50_000, undefined, 'Idem', 'pg-idem-concurrent'),
      ]);
      assert.equal(idem1.id, idem2.id);

      // Ownership isolation check
      await assert.rejects(() => repo.transferBetweenWallets(userBId, w1.id, w2.id, 10_000));

      // JSON Importer conflict detection on live PG (reports diff, never overwrites)
      const conflictJson = path.join(tempDir, 'conflict.json');
      fs.writeFileSync(
        conflictJson,
        JSON.stringify({
          users: {
            [userAId]: {
              id: userAId,
              email: emailA,
              fullName: 'OVERWRITTEN NAME SHOULD NOT APPLY',
              passwordHash: 'other_hash',
              salt: 'other_salt',
            },
          },
          wallets: {
            [userAId]: [
              {
                id: w1.id,
                userId: userAId,
                name: 'TAMPERED WALLET NAME',
                balance: 999_999_999,
              },
            ],
          },
        }),
        'utf-8'
      );

      const importReport = await runJsonImport(
        {
          filePath: conflictJson,
          apply: true,
          confirmToken: 'IMPORT_HISOBOT_DATA',
          batchSize: 50,
          includeDemo: false,
          includeSessions: false,
        },
        storage
      );
      assert.equal(importReport.dbConflictCheck, 'checked');
      assert.equal(importReport.counts.usersInserted, 0);
      assert.ok(importReport.counts.conflictsDetected >= 2);
      assert.ok(importReport.conflicts.some((c) => c.entityType === 'app_users' && c.reason === 'id_conflict'));
      assert.ok(importReport.conflicts.some((c) => c.entityType === 'app_data' && c.reason === 'record_conflict'));

      const untouchedUserA = await repo.getUserById(userAId);
      assert.equal(untouchedUserA?.fullName, 'PG User A');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (!disposableDbName) {
        if (userAId) await storage.query('DELETE FROM public.app_users WHERE id = $1', [userAId]);
        if (userBId) await storage.query('DELETE FROM public.app_users WHERE id = $1', [userBId]);
      }
      await storage.close();
      if (adminStorage && disposableDbName) {
        await adminStorage.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [disposableDbName]
        );
        await adminStorage.query(`DROP DATABASE IF EXISTS "${disposableDbName}"`);
        await adminStorage.close();
      }
    }
  }
);
