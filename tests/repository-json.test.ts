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
import { runJsonImport, validateAndPlanImport } from '../scripts/import-json-to-supabase.ts';

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
    assert.ok(wallets.length >= 2);
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
