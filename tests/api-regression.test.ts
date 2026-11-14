/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import type { AddressInfo } from 'net';
import { createApp } from '../server.ts';
import { Database } from '../src/server/db.ts';
import { JsonAsyncRepository, setRepositoryForTests } from '../src/server/async-repository.ts';
import { clearAuthRateLimitForTests } from '../src/server/supabase-auth.ts';

async function startTestServer() {
  clearAuthRateLimitForTests();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisobot-api-test-'));
  const db = new Database({ dbFilePath: path.join(dir, 'db.json'), skipDemoSeed: true });
  setRepositoryForTests(new JsonAsyncRepository(db));

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      setRepositoryForTests(null);
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function api(baseUrl: string, pathname: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
  const text = await res.text();
  let json: Record<string, any> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, body: json };
}

test('API regression: health, security headers, CORS, auth lifecycle, disabled endpoints, and full financial flows', async () => {
  const srv = await startTestServer();
  try {
    // 1. Health & Security Headers & CORS
    const health = await api(srv.baseUrl, '/api/health', {
      headers: { Origin: 'capacitor://localhost' },
    });
    assert.equal(health.status, 200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.backend, 'json');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(health.headers.get('x-frame-options'), 'DENY');
    assert.equal(health.headers.get('access-control-allow-origin'), 'capacitor://localhost');

    // Disallowed origin does not receive ACAO
    const evilCors = await api(srv.baseUrl, '/api/health', {
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(evilCors.headers.get('access-control-allow-origin'), null);

    // 2. Unauthenticated request blocked with 401
    const unauth = await api(srv.baseUrl, '/api/transactions');
    assert.equal(unauth.status, 401);

    // 3. Register & Me & Disabled Endpoints
    const reg = await api(srv.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: 'api.user@hisobot.uz',
        password: 'Password123',
        fullName: 'API Test User',
      }),
    });
    assert.equal(reg.status, 200);
    const token = reg.body.token as string;
    assert.ok(token);

    const me = await api(srv.baseUrl, '/api/auth/me', {}, token);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'api.user@hisobot.uz');

    const forgot = await api(srv.baseUrl, '/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'api.user@hisobot.uz' }),
    });
    assert.equal(forgot.status, 503);

    const premium = await api(srv.baseUrl, '/api/user/upgrade-premium', { method: 'POST' }, token);
    assert.equal(premium.status, 403);

    // Profile tampering rejected silently
    const prof = await api(
      srv.baseUrl,
      '/api/auth/profile',
      {
        method: 'PUT',
        body: JSON.stringify({ fullName: 'Renamed User', familyGroupId: 'fam_hack', isPremium: true }),
      },
      token
    );
    assert.equal(prof.status, 200);
    assert.equal(prof.body.user.fullName, 'Renamed User');
    assert.equal(prof.body.user.familyGroupId, undefined);
    assert.equal(prof.body.user.isPremium, undefined);

    // 4. Wallets + Transactions + Idempotent Transfer
    const walletsRes = await api(srv.baseUrl, '/api/wallets', {}, token);
    assert.equal(walletsRes.status, 200);
    const w1 = walletsRes.body.wallets[0];
    const w2 = walletsRes.body.wallets[1];

    const addTx = await api(
      srv.baseUrl,
      '/api/transactions',
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': 'api-tx-1' },
        body: JSON.stringify({
          type: 'income',
          amount: 2_000_000,
          categoryId: 'inc_salary',
          categoryName: 'Oylik maosh',
          walletId: w1.id,
          date: '2026-11-13',
          description: 'Oylik',
          paymentMethod: 'card',
        }),
      },
      token
    );
    assert.equal(addTx.status, 200);
    assert.equal(addTx.body.transaction.amount, 2_000_000);

    // Retry with same idempotency key does NOT double-credit wallet
    const addTxDup = await api(
      srv.baseUrl,
      '/api/transactions',
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': 'api-tx-1' },
        body: JSON.stringify({
          type: 'income',
          amount: 2_000_000,
          categoryId: 'inc_salary',
          categoryName: 'Oylik maosh',
          walletId: w1.id,
          date: '2026-11-13',
          description: 'Oylik',
          paymentMethod: 'card',
        }),
      },
      token
    );
    assert.equal(addTxDup.body.transaction.id, addTx.body.transaction.id);

    const tr1 = await api(
      srv.baseUrl,
      '/api/wallets/transfer',
      {
        method: 'POST',
        headers: { 'X-Idempotency-Key': 'api-tr-1' },
        body: JSON.stringify({ fromWalletId: w1.id, toWalletId: w2.id, amount: 500_000 }),
      },
      token
    );
    assert.equal(tr1.status, 200);
    const walletsAfter = await api(srv.baseUrl, '/api/wallets', {}, token);
    assert.equal(walletsAfter.body.wallets.find((w: any) => w.id === w1.id).balance, 1_500_000);
    assert.equal(walletsAfter.body.wallets.find((w: any) => w.id === w2.id).balance, 500_000);

    // 5. Budgets + Goals + Debts
    const month = new Date().toISOString().slice(0, 7);
    const setBdg = await api(
      srv.baseUrl,
      '/api/budgets',
      {
        method: 'POST',
        body: JSON.stringify({
          categoryId: 'exp_food',
          categoryName: 'Oziq-ovqat va kafe',
          monthlyLimit: 1_000_000,
          month,
          alertThreshold: 80,
        }),
      },
      token
    );
    assert.equal(setBdg.status, 200);

    const listBdg = await api(srv.baseUrl, '/api/budgets', {}, token);
    assert.equal(listBdg.status, 200);
    assert.equal(listBdg.body.budgets.length, 1);

    const goal = await api(
      srv.baseUrl,
      '/api/goals',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Telefon',
          targetAmount: 1_000_000,
          savedAmount: 0,
          deadline: '2026-12-31',
          color: '#10B981',
          icon: 'Target',
        }),
      },
      token
    );
    assert.equal(goal.status, 200);
    const dep = await api(
      srv.baseUrl,
      `/api/goals/${goal.body.goal.id}/deposit`,
      { method: 'POST', body: JSON.stringify({ amount: 250_000, walletId: w1.id }) },
      token
    );
    assert.equal(dep.status, 200);
    assert.equal(dep.body.goal.savedAmount, 250_000);

    // 6. Receipts with createTransaction link persisted
    const rcp = await api(
      srv.baseUrl,
      '/api/receipts/save',
      {
        method: 'POST',
        body: JSON.stringify({
          merchantName: 'Havas',
          date: '2026-11-13',
          totalAmount: 42_000,
          currency: 'UZS',
          categorySuggested: 'Oziq-ovqat va kafe',
          lineItems: [],
          confidence: 0.9,
          createTransaction: true,
        }),
      },
      token
    );
    assert.equal(rcp.status, 200);
    assert.ok(rcp.body.receipt.transactionId);
    const rcps = await api(srv.baseUrl, '/api/receipts', {}, token);
    assert.equal(rcps.body.receipts[0].transactionId, rcp.body.receipt.transactionId);

    // 7. Summary, Health Score, Forecast, AI Assistant
    const sum = await api(srv.baseUrl, '/api/reports/summary?period=this_year', {}, token);
    assert.equal(sum.status, 200);
    assert.equal(sum.body.summary.totalIncome, 2_000_000);

    const aiHealth = await api(srv.baseUrl, '/api/ai/health-score', {}, token);
    assert.equal(aiHealth.status, 200);
    assert.ok(typeof aiHealth.body.healthScore.score === 'number');

    const aiTurn = await api(
      srv.baseUrl,
      '/api/ai/assistant',
      { method: 'POST', body: JSON.stringify({ message: 'Salom!', language: 'uz' }) },
      token
    );
    assert.equal(aiTurn.status, 200);
    assert.ok(typeof aiTurn.body.reply === 'string' && aiTurn.body.reply.length > 0);

    // 8. Logout invalidates token
    const out = await api(srv.baseUrl, '/api/auth/logout', { method: 'POST' }, token);
    assert.equal(out.status, 200);
    const afterOut = await api(srv.baseUrl, '/api/auth/me', {}, token);
    assert.equal(afterOut.status, 401);
  } finally {
    await srv.close();
  }
});
