/**
 * Focused tests for the async Supabase repository facade.
 * Uses a mocked PostgREST endpoint; no real credentials or network calls.
 */
import assert from 'node:assert/strict';
import { getRecord, putRecord, putRecords } from '../src/server/supabase-repository';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-key';

const requests: { url: URL; method: string; body?: string }[] = [];
const mockFetch: typeof fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const method = init.method ?? 'GET';
  requests.push({ url, method, body: typeof init.body === 'string' ? init.body : undefined });

  if (method === 'GET') {
    const owner = url.searchParams.get('owner_user_id');
    const key = url.searchParams.get('record_key');
    const rows = owner === 'eq.user-a' && key === 'eq.tx-1'
      ? [{
          owner_user_id: 'user-a',
          collection: 'transactions',
          scope_key: 'user-a',
          record_key: 'tx-1',
          payload: { id: 'tx-1', userId: 'user-a', amount: 125000 },
        }]
      : [];
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(null, { status: 204 });
};
globalThis.fetch = mockFetch;

async function main() {
  const record = await getRecord<{ id: string; amount: number }>(
    'user-a', 'transactions', 'tx-1',
  );
  assert.deepEqual(record, { id: 'tx-1', userId: 'user-a', amount: 125000 });
  assert.equal(requests.length, 1, 'single-record lookup must issue one request');

  const params = requests[0].url.searchParams;
  assert.equal(params.get('owner_user_id'), 'eq.user-a');
  assert.equal(params.get('collection'), 'eq.transactions');
  assert.equal(params.get('scope_key'), 'eq.user-a');
  assert.equal(params.get('record_key'), 'eq.tx-1');
  assert.equal(params.get('limit'), '1');

  const foreignRecord = await getRecord<{ id: string }>(
    'user-b', 'transactions', 'tx-1',
  );
  assert.equal(foreignRecord, null, 'a different owner must not see another user record');
  assert.equal(requests[1].url.searchParams.get('owner_user_id'), 'eq.user-b');

  await putRecord('user-a', 'transactions', { id: 'tx-2', amount: 5000 });
  assert.equal(requests[2].method, 'POST');
  const saved = JSON.parse(requests[2].body ?? '{}') as Record<string, unknown>;
  assert.equal(saved.owner_user_id, 'user-a');
  assert.equal(saved.record_key, 'tx-2');

  const beforeDuplicate = requests.length;
  await assert.rejects(
    () => putRecords('user-a', 'transactions', [
      { id: 'same', amount: 1 },
      { id: 'same', amount: 2 },
    ]),
    /Duplicate record id/,
  );
  assert.equal(requests.length, beforeDuplicate, 'invalid duplicate batch must not call Supabase');

  await assert.rejects(
    () => getRecord('user-a', 'not-a-collection' as never, 'tx-1'),
    /Unsupported app data collection/,
  );

  process.stdout.write('Supabase repository tests passed\\n');
}

main().catch((error) => {
  process.stderr.write(String(error) + '\\n');
  process.exitCode = 1;
});
