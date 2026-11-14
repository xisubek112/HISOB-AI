/**
 * Contract tests for the public async repository boundary.
 * Uses mocked PostgREST; never contacts a real Supabase project.
 */
import assert from 'node:assert/strict';
import { supabaseUserDataRepository as repository } from '../src/server/async-repository';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-key';

const requests: { url: URL; method: string; body?: string }[] = [];
const mockFetch: typeof fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? 'GET';
  requests.push({ url, method, body: typeof init.body === 'string' ? init.body : undefined });

  if (url.pathname.endsWith('/app_data') && method === 'GET') {
    const owner = url.searchParams.get('owner_user_id');
    const collection = url.searchParams.get('collection');
    const recordKey = url.searchParams.get('record_key');
    if (owner === 'eq.owner-1' && collection === 'eq.transactions' && recordKey === 'eq.tx-1') {
      return Response.json([{
        owner_user_id: 'owner-1',
        collection: 'transactions',
        scope_key: 'owner-1',
        record_key: 'tx-1',
        payload: { id: 'tx-1', amount: 4200 },
      }]);
    }
    if (owner === 'eq.owner-1' && collection === 'eq.transactions') {
      return Response.json([{
        owner_user_id: 'owner-1',
        collection: 'transactions',
        scope_key: 'owner-1',
        record_key: 'tx-1',
        payload: { id: 'tx-1', amount: 4200 },
      }]);
    }
    return Response.json([]);
  }

  if (url.pathname.endsWith('/rpc/hisobot_transfer_between_wallets')) {
    return Response.json({ success: true, transfer_id: JSON.parse(String(init.body)).p_transfer_id });
  }
  if (url.pathname.endsWith('/rpc/hisobot_apply_financial_operation')) {
    return Response.json({ success: true, operation_type: JSON.parse(String(init.body)).p_operation_type });
  }
  if (url.pathname.endsWith('/rpc/hisobot_execute_recurring_transaction')) {
    return Response.json({ success: true, recurring_id: JSON.parse(String(init.body)).p_recurring_id });
  }
  return new Response(null, { status: 204 });
};
globalThis.fetch = mockFetch;

async function main() {
  const listed = await repository.list<{ id: string; amount: number }>('owner-1', 'transactions');
  assert.deepEqual(listed, [{ id: 'tx-1', amount: 4200 }]);
  assert.equal(requests[0].url.searchParams.get('owner_user_id'), 'eq.owner-1');

  const found = await repository.get<{ id: string; amount: number }>('owner-1', 'transactions', 'tx-1');
  assert.deepEqual(found, { id: 'tx-1', amount: 4200 });

  await repository.put('owner-1', 'transactions', { id: 'tx-2', amount: 900 });
  const putBody = JSON.parse(requests[2].body ?? '{}');
  assert.equal(putBody.owner_user_id, 'owner-1');
  assert.equal(putBody.record_key, 'tx-2');

  await repository.putMany('owner-1', 'transactions', [
    { id: 'tx-3', amount: 100 },
    { id: 'tx-4', amount: 200 },
  ]);
  const batch = JSON.parse(requests[3].body ?? '[]') as Array<Record<string, unknown>>;
  assert.equal(batch.length, 2);
  assert.ok(batch.every((row) => row.owner_user_id === 'owner-1'));

  await repository.remove('owner-1', 'transactions', 'tx-4');
  assert.equal(requests[4].method, 'DELETE');
  assert.equal(requests[4].url.searchParams.get('owner_user_id'), 'eq.owner-1');

  const transfer = await repository.transferWallets({
    userId: 'owner-1', fromWalletId: 'w1', toWalletId: 'w2',
    amount: 100, targetAmount: 100, transferId: 'tr-1', date: '2026-11-14',
  });
  assert.deepEqual(transfer, { success: true, transfer_id: 'tr-1' });

  const deposit = await repository.depositToGoal({
    userId: 'owner-1', operationId: 'op-1', targetRecordId: 'goal-1', amount: 50,
  });
  assert.deepEqual(deposit, { success: true, operation_type: 'goal_deposit' });

  const payment = await repository.payDebt({
    userId: 'owner-1', operationId: 'op-2', targetRecordId: 'debt-1', amount: 25,
  });
  assert.deepEqual(payment, { success: true, operation_type: 'debt_payment' });

  const recurring = await repository.executeRecurring({
    userId: 'owner-1', recurringId: 'schedule-1', executionId: 'exec-1',
  });
  assert.deepEqual(recurring, { success: true, recurring_id: 'schedule-1' });

  const countBeforeInvalid = requests.length;
  await assert.rejects(() => repository.transferWallets({
    userId: 'owner-1', fromWalletId: 'w1', toWalletId: 'w1',
    amount: 100, targetAmount: 100, transferId: 'bad', date: '2026-11-14',
  }), /must differ/);
  await assert.rejects(() => repository.depositToGoal({
    userId: 'owner-1', operationId: 'bad', targetRecordId: 'goal-1', amount: 0,
  }), /positive safe integer/);
  assert.equal(requests.length, countBeforeInvalid, 'invalid financial operations must fail before network I/O');

  process.stdout.write('Async repository contract tests passed\\n');
}

main().catch((error) => {
  process.stderr.write(String(error) + '\\n');
  process.exitCode = 1;
});
