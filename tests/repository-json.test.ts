/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Database } from '../src/server/db.ts';
import { JsonAsyncRepository } from '../src/server/async-repository.ts';
import {
  runJsonImport,
  type StorageQueryAdapter,
  validateAndPlanImport,
} from '../scripts/import-json-to-supabase.ts';

function createTempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisobot-repo-test-'));
  const filePath = path.join(dir, 'db.json');
  const db = new Database({ dbFilePath: filePath, skipDemoSeed: true });
  const repo = new JsonAsyncRepository(db);
  return {
    repo,
    filePath,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('ownership isolation, profile hardening, and auth lifecycle', async () => {
  const { repo, cleanup } = createTempRepo();
  try {
    const a = await repo.registerUser('usera@hisobot.uz', 'pass1234', 'User A');
    const b = await repo.registerUser('userb@hisobot.uz', 'pass1234', 'User B');

    // Duplicate email rejected (case-insensitive)
    await assert.rejects(() => repo.registerUser('USERA@hisobot.uz', 'pass1234', 'Dup'));

    // Profile tampering cannot overwrite familyGroupId or isPremium
    const updatedProfile = await repo.updateProfile(a.user.id, {
      fullName: 'User A Updated',
      familyGroupId: 'fam_hijack',
      isPremium: true,
    } as Record<string, unknown>);
    assert.equal(updatedProfile.fullName, 'User A Updated');
    assert.equal(updatedProfile.familyGroupId, undefined);
    assert.equal(updatedProfile.isPremium, undefined);

    // User A creates transaction; User B cannot update or delete it
    const tx = await repo.addTransaction(a.user.id, {
      type: 'income',
      amount: 500_000,
      categoryId: 'inc_salary',
      categoryName: 'Oylik maosh',
      date: '2026-11-10',
      description: 'Maosh',
      paymentMethod: 'card',
    });

    assert.equal((await repo.getTransactions(b.user.id)).length, 0);
    await assert.rejects(() => repo.updateTransaction(b.user.id, tx.id, { amount: 100 }));
    assert.equal(await repo.deleteTransaction(b.user.id, tx.id), false);
    assert.equal((await repo.getTransactions(a.user.id)).length, 1);

    // Logout & logoutAllDevices
    await repo.logout(a.token);
    assert.equal(await repo.getUserByToken(a.token), null);

    const login2 = await repo.loginUser('usera@hisobot.uz', 'pass1234');
    assert.ok(await repo.getUserByToken(login2.token));
    const cleared = await repo.logoutAllDevices(a.user.id);
    assert.ok(cleared >= 1);
    assert.equal(await repo.getUserByToken(login2.token), null);
  } finally {
    cleanup();
  }
});

test('wallet balance sync across transaction add/update/delete, transfers, goals, and debts', async () => {
  const { repo, cleanup } = createTempRepo();
  try {
    const { user } = await repo.registerUser('finance@hisobot.uz', 'pass1234', 'Finance User');
    const wallets = await repo.getWallets(user.id);
    assert.equal(wallets.length, 2);
    assert.ok(wallets.some((w) => w.name === 'Asosiy karta' && w.type === 'card' && w.color === '#10B981'));
    assert.ok(wallets.some((w) => w.name === 'Naqd pul' && w.type === 'cash' && w.color === '#3B82F6'));
    const w1 = wallets[0];
    const w2 = wallets[1];

    // Add income into wallet 1 -> +1,000,000
    const incTx = await repo.addTransaction(user.id, {
      type: 'income',
      amount: 1_000_000,
      categoryId: 'inc_salary',
      categoryName: 'Oylik maosh',
      walletId: w1.id,
      date: '2026-11-10',
      description: 'Income',
      paymentMethod: 'card',
    });
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 1_000_000);

    // Overdraft expense rejected without corrupting balance
    await assert.rejects(() =>
      repo.addTransaction(user.id, {
        type: 'expense',
        amount: 2_000_000,
        categoryId: 'exp_food',
        categoryName: 'Oziq-ovqat va kafe',
        walletId: w1.id,
        date: '2026-11-10',
        description: 'Too big',
        paymentMethod: 'card',
      })
    );
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 1_000_000);

    // Update income amount 1,000,000 -> 1,500,000 updates wallet balance
    await repo.updateTransaction(user.id, incTx.id, { amount: 1_500_000 });
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 1_500_000);

    // Add expense 300,000 then delete it -> balance returns to 1,500,000
    const expTx = await repo.addTransaction(user.id, {
      type: 'expense',
      amount: 300_000,
      categoryId: 'exp_food',
      categoryName: 'Oziq-ovqat va kafe',
      walletId: w1.id,
      date: '2026-11-10',
      description: 'Lunch',
      paymentMethod: 'card',
    });
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 1_200_000);
    assert.equal(await repo.deleteTransaction(user.id, expTx.id), true);
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 1_500_000);

    // Wallet transfer with idempotency key executes only once
    const t1 = await repo.transferBetweenWallets(user.id, w1.id, w2.id, 400_000, undefined, 'Test transfer', 'idem-tr-1');
    const t2 = await repo.transferBetweenWallets(user.id, w1.id, w2.id, 400_000, undefined, 'Test transfer', 'idem-tr-1');
    assert.equal(t1.id, t2.id);
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 1_100_000);
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w2.id)?.balance, 400_000);

    // Overdraft transfer rejected
    await assert.rejects(() => repo.transferBetweenWallets(user.id, w1.id, w2.id, 5_000_000));

    // Goal deposit & completion
    const goal = await repo.addGoal(user.id, {
      name: 'Noutbuk',
      targetAmount: 500_000,
      savedAmount: 0,
      deadline: '2026-12-31',
      color: '#10B981',
      icon: 'Laptop',
    });
    const completedGoal = await repo.depositToGoal(user.id, goal.id, 500_000, w1.id, 'idem-goal-1');
    assert.equal(completedGoal.isCompleted, true);
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 600_000);

    // Debt payment & overpayment guard
    const debt = await repo.addDebt(user.id, {
      type: 'borrowed',
      personName: 'Ali',
      amount: 200_000,
      paidAmount: 0,
      startDate: '2026-11-01',
      dueDate: '2026-12-01',
      status: 'active',
    });
    await assert.rejects(() => repo.payDebt(user.id, debt.id, 300_000));
    const paidDebt = await repo.payDebt(user.id, debt.id, 200_000, w1.id);
    assert.equal(paidDebt.status, 'paid');
    assert.equal(paidDebt.remainingAmount, 0);
    assert.equal((await repo.getWallets(user.id)).find((w) => w.id === w1.id)?.balance, 400_000);
  } finally {
    cleanup();
  }
});

test('family RBAC, invite email/expiry enforcement, and recurring + receipt persistence', async () => {
  const { repo, cleanup } = createTempRepo();
  try {
    const owner = await repo.registerUser('owner@hisobot.uz', 'pass1234', 'Owner');
    const member = await repo.registerUser('member@hisobot.uz', 'pass1234', 'Member');
    const stranger = await repo.registerUser('stranger@hisobot.uz', 'pass1234', 'Stranger');

    const group = await repo.createFamilyGroup(owner.user.id, 'Oila', 10_000_000);
    assert.equal(group.ownerId, owner.user.id);

    const inv = await repo.inviteFamilyMember(owner.user.id, member.user.email, 'member');

    // Wrong user cannot accept invite issued to member@hisobot.uz
    await assert.rejects(() => repo.acceptFamilyInvite(stranger.user.id, inv.inviteCode));

    // Member accepts invite
    const joined = await repo.acceptFamilyInvite(member.user.id, inv.inviteCode);
    assert.equal(joined.id, group.id);

    // Member with role='member' cannot invite others
    await assert.rejects(() => repo.inviteFamilyMember(member.user.id, 'another@hisobot.uz', 'viewer'));

    // Recurring execution
    const rec = await repo.addRecurringTransaction(owner.user.id, {
      type: 'income',
      amount: 100_000,
      currency: 'UZS',
      categoryId: 'inc_salary',
      categoryName: 'Oylik maosh',
      description: 'Bonus',
      paymentMethod: 'card',
      frequency: 'monthly',
      nextExecutionDate: '2026-11-15',
      status: 'active',
      idempotencyKeyPrefix: 'bonus',
    });
    const recTx = await repo.executeRecurringSchedule(owner.user.id, rec.id, 'idem-rec-1');
    assert.equal(recTx.amount, 100_000);
    assert.equal((await repo.getRecurringLogs(owner.user.id)).length, 1);

    // Receipt transaction linking
    const receipt = await repo.saveReceipt(owner.user.id, {
      merchantName: 'Korzinka',
      date: '2026-11-13',
      totalAmount: 55_000,
      currency: 'UZS',
      categorySuggested: 'Oziq-ovqat va kafe',
      lineItems: [{ name: 'Non', price: 5000 }],
      confidence: 0.95,
    });
    await repo.linkReceiptTransaction(owner.user.id, receipt.id, 'tx_linked_1');
    const savedReceipts = await repo.getReceipts(owner.user.id);
    assert.equal(savedReceipts[0].transactionId, 'tx_linked_1');
  } finally {
    cleanup();
  }
});

test('JSON importer validates orphans, duplicates, skips demo by default, and enforces dry-run safety', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisobot-import-test-'));
  const jsonFile = path.join(dir, 'sample.json');
  try {
    const sample = {
      users: {
        usr_demo_hisobot_2026: {
          id: 'usr_demo_hisobot_2026',
          email: 'demo@hisobot.uz',
          fullName: 'Demo',
          passwordHash: 'abc',
          salt: 'def',
        },
        usr_real_1: {
          id: 'usr_real_1',
          email: 'real@hisobot.uz',
          fullName: 'Real User',
          passwordHash: 'hash1',
          salt: 'salt1',
          resetToken: 'leak_me_not',
        },
      },
      sessions: {
        demo_token: 'usr_demo_hisobot_2026',
        raw_user_token: 'usr_real_1',
      },
      transactions: {
        usr_demo_hisobot_2026: [{ id: 'tx_demo', amount: 100 }],
        usr_real_1: [{ id: 'tx_1', amount: 50000 }],
        usr_orphan: [{ id: 'tx_orph', amount: 999 }],
      },
      familyGroups: {
        fam_real: { id: 'fam_real', ownerId: 'usr_real_1', name: 'Real Family' },
      },
      familyMembers: {
        fam_real: [{ id: 'fm_1', familyId: 'fam_real', userId: 'usr_real_1', role: 'owner' }],
      },
    };
    fs.writeFileSync(jsonFile, JSON.stringify(sample), 'utf-8');

    const plan = validateAndPlanImport(sample, {
      filePath: jsonFile,
      apply: false,
      batchSize: 50,
      includeDemo: false,
      includeSessions: true,
    });

    assert.equal(plan.report.valid, true);
    assert.equal(plan.users.length, 1);
    assert.equal(plan.users[0].id, 'usr_real_1');
    assert.equal('passwordHash' in plan.users[0].profile, false);
    assert.equal('resetToken' in plan.users[0].profile, false);
    assert.equal(plan.sessions.length, 1);
    assert.notEqual(plan.sessions[0].tokenHash, 'raw_user_token');
    assert.equal(plan.report.counts.skippedDemoRecords >= 2, true);
    assert.equal(plan.report.counts.skippedOrphanRecords, 1);

    // Dry-run succeeds with 0 DB writes even without DATABASE_URL
    const dryReport = await runJsonImport({
      filePath: jsonFile,
      apply: false,
      batchSize: 50,
      includeDemo: false,
      includeSessions: false,
    });
    assert.equal(dryReport.mode, 'dry-run');
    assert.equal(dryReport.valid, true);
    assert.equal(dryReport.counts.usersInserted, 0);

    // Apply without confirmation token is rejected safely
    const unsafeApply = await runJsonImport({
      filePath: jsonFile,
      apply: true,
      batchSize: 50,
      includeDemo: false,
      includeSessions: false,
    });
    assert.equal(unsafeApply.valid, false);
    assert.ok(unsafeApply.errors[0].includes('IMPORT_HISOBOT_DATA'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON importer detects id_conflict, email_conflict, and record_conflict with diffs and NEVER overwrites', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisobot-import-conflict-'));
  const jsonFile = path.join(dir, 'conflicts.json');
  try {
    const sample = {
      users: {
        usr_id_conflict: {
          id: 'usr_id_conflict',
          email: 'sameid@hisobot.uz',
          fullName: 'Incoming Full Name',
          monthlyBudget: 9_000_000,
          passwordHash: 'new_hash_secret',
          salt: 'salt1',
        },
        usr_email_conflict_new_id: {
          id: 'usr_email_conflict_new_id',
          email: 'taken@hisobot.uz',
          fullName: 'Email Hijack Attempt',
          passwordHash: 'hash2',
          salt: 'salt2',
        },
        usr_exact_match: {
          id: 'usr_exact_match',
          email: 'exact@hisobot.uz',
          fullName: 'Exact Match',
          passwordHash: 'hash_exact',
          salt: 'salt_exact',
        },
      },
      transactions: {
        usr_id_conflict: [
          {
            id: 'tx_conflict_1',
            userId: 'usr_id_conflict',
            amount: 250_000,
            description: 'Incoming Description',
          },
          {
            id: 'tx_new_safe',
            userId: 'usr_id_conflict',
            amount: 75_000,
            description: 'Brand new tx',
          },
        ],
        usr_email_conflict_new_id: [
          {
            id: 'tx_blocked_by_email_conflict',
            userId: 'usr_email_conflict_new_id',
            amount: 500_000,
            description: 'Must not import',
          },
        ],
        usr_exact_match: [
          {
            id: 'tx_exact_1',
            userId: 'usr_exact_match',
            amount: 100_000,
            description: 'Exact tx',
          },
        ],
      },
    };
    fs.writeFileSync(jsonFile, JSON.stringify(sample), 'utf-8');

    const executedSql: Array<{ sql: string; params: unknown[] }> = [];
    const mockQuery = async (sql: string, params: unknown[] = []) => {
      executedSql.push({ sql, params });
      if (sql.includes('FROM public.app_users')) {
        return {
          rows: [
            {
              id: 'usr_id_conflict',
              email: 'sameid@hisobot.uz',
              email_normalized: 'sameid@hisobot.uz',
              password_hash: 'existing_hash_secret',
              profile: {
                id: 'usr_id_conflict',
                email: 'sameid@hisobot.uz',
                fullName: 'Existing Original Name',
                monthlyBudget: 5_000_000,
              },
            },
            {
              id: 'usr_original_owner',
              email: 'taken@hisobot.uz',
              email_normalized: 'taken@hisobot.uz',
              password_hash: 'existing_hash_2',
              profile: {
                id: 'usr_original_owner',
                email: 'taken@hisobot.uz',
                fullName: 'Original Email Owner',
              },
            },
            {
              id: 'usr_exact_match',
              email: 'exact@hisobot.uz',
              email_normalized: 'exact@hisobot.uz',
              password_hash: 'hash_exact',
              profile: {
                id: 'usr_exact_match',
                email: 'exact@hisobot.uz',
                fullName: 'Exact Match',
              },
            },
          ],
          rowCount: 3,
        };
      }

      if (sql.includes('FROM public.app_data d')) {
        return {
          rows: [
            {
              owner_user_id: 'usr_id_conflict',
              collection: 'transactions',
              scope_key: 'usr_id_conflict',
              record_key: 'tx_conflict_1',
              payload: {
                id: 'tx_conflict_1',
                userId: 'usr_id_conflict',
                amount: 100_000,
                description: 'Existing DB Description',
              },
            },
            {
              owner_user_id: 'usr_exact_match',
              collection: 'transactions',
              scope_key: 'usr_exact_match',
              record_key: 'tx_exact_1',
              payload: {
                id: 'tx_exact_1',
                userId: 'usr_exact_match',
                amount: 100_000,
                description: 'Exact tx',
              },
            },
          ],
          rowCount: 2,
        };
      }

      if (sql.includes('INSERT INTO public.app_users')) {
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('INSERT INTO public.app_data')) {
        // Only tx_new_safe should be inserted (1 row); tx_conflict_1 & tx_exact_1 are ON CONFLICT DO NOTHING,
        // and tx_blocked_by_email_conflict is excluded before INSERT
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    };

    const mockStorage: StorageQueryAdapter = {
      query: mockQuery as unknown as StorageQueryAdapter['query'],
      withTransaction: (async (fn) =>
        fn({ query: mockQuery } as unknown as Parameters<typeof fn>[0])) as StorageQueryAdapter['withTransaction'],
    };

    const report = await runJsonImport(
      {
        filePath: jsonFile,
        apply: true,
        confirmToken: 'IMPORT_HISOBOT_DATA',
        batchSize: 50,
        includeDemo: false,
        includeSessions: false,
      },
      mockStorage
    );

    assert.equal(report.dbConflictCheck, 'checked');
    assert.equal(report.counts.usersSkippedExisting, 3);
    assert.equal(report.counts.usersExactMatch, 1);
    assert.equal(report.counts.usersInserted, 0);
    assert.equal(report.counts.dataExactMatch, 1);
    assert.equal(report.counts.dataRecordsInserted, 1);
    assert.equal(report.counts.conflictsDetected, 3);

    const idConflict = report.conflicts.find(
      (c) => c.entityType === 'app_users' && c.key === 'usr_id_conflict'
    );
    assert.ok(idConflict);
    assert.equal(idConflict.reason, 'id_conflict');
    assert.equal(idConflict.resolution, 'skipped_no_overwrite');
    assert.deepEqual(
      idConflict.diffs.find((d) => d.field === 'fullName'),
      { field: 'fullName', incoming: 'Incoming Full Name', existing: 'Existing Original Name' }
    );
    assert.deepEqual(
      idConflict.diffs.find((d) => d.field === 'passwordHash'),
      { field: 'passwordHash', incoming: '[changed]', existing: '[existing]' }
    );

    const emailConflict = report.conflicts.find(
      (c) => c.entityType === 'app_users' && c.key === 'usr_email_conflict_new_id'
    );
    assert.ok(emailConflict);
    assert.equal(emailConflict.reason, 'email_conflict');
    assert.deepEqual(
      emailConflict.diffs.find((d) => d.field === 'id'),
      { field: 'id', incoming: 'usr_email_conflict_new_id', existing: 'usr_original_owner' }
    );

    const dataConflict = report.conflicts.find(
      (c) => c.entityType === 'app_data' && c.key.includes('tx_conflict_1')
    );
    assert.ok(dataConflict);
    assert.equal(dataConflict.reason, 'record_conflict');
    assert.deepEqual(
      dataConflict.diffs.find((d) => d.field === 'amount'),
      { field: 'amount', incoming: 250_000, existing: 100_000 }
    );

    // Ensure NO DO UPDATE ever ran and dependent tx for email_conflict user was never passed to app_data INSERT
    for (const q of executedSql) {
      assert.equal(/DO UPDATE/i.test(q.sql), false, 'Importer must NEVER execute ON CONFLICT DO UPDATE');
      if (q.sql.includes('INSERT INTO public.app_data')) {
        const owners = q.params[0] as string[];
        assert.equal(owners.includes('usr_email_conflict_new_id'), false);
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
