/**
 * In-memory integration tests for the staged Supabase auth service.
 * Exercises the auth service through its real PostgREST storage adapter.
 */
import assert from 'node:assert/strict';
import {
  getUserBySupabaseToken,
  loginUserInSupabase,
  logoutAllSupabaseSessions,
  logoutFromSupabase,
  registerUserInSupabase,
} from '../src/server/supabase-auth';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-service-key';

type Row = Record<string, unknown>;
const users: Row[] = [];
const sessions: Row[] = [];

function response(data: unknown, status = 200): Response {
  return status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
}

const mockFetch: typeof fetch = async (input, init = {}) => {
  const url = new URL(String(input));
  const table = url.pathname.split('/').pop();
  const method = init.method ?? 'GET';
  const rows = table === 'app_users' ? users : table === 'app_sessions' ? sessions : null;
  if (!rows) return response({ message: 'unexpected endpoint' }, 404);

  if (method === 'POST') {
    const body = JSON.parse(String(init.body)) as Row;
    if (table === 'app_users') {
      const email = String(body.email).trim().toLowerCase();
      if (users.some((row) => String(row.email).trim().toLowerCase() === email)) {
        return response({ message: 'duplicate email' }, 409);
      }
    }
    rows.push(body);
    return response(null, 204);
  }

  const filters = [...url.searchParams.entries()].filter(([key]) => key !== 'select' && key !== 'limit');
  if (method === 'DELETE') {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (filters.every(([key, value]) => String(rows[i][key]) === value.slice(3))) rows.splice(i, 1);
    }
    return response(null, 204);
  }

  if (method === 'GET') {
    const matches = rows.filter((row) =>
      filters.every(([key, value]) => String(row[key]) === value.slice(3)),
    );
    return response(matches.slice(0, Number(url.searchParams.get('limit') ?? '100')));
  }

  return response({ message: 'unsupported method' }, 405);
};

globalThis.fetch = mockFetch;

async function main() {
  const registered = await registerUserInSupabase('Test@Example.com', 'StrongPass123!', 'Test User');
  assert.equal(registered.user.email, 'Test@Example.com');
  assert.equal(registered.user.currency, 'UZS');
  assert.match(registered.token, /^[a-f0-9]{64}$/);
  assert.equal(users.length, 1);
  assert.equal(sessions.length, 1);
  assert.ok(!JSON.stringify(sessions).includes(registered.token), 'raw bearer token must never be stored');

  const authenticated = await getUserBySupabaseToken(registered.token);
  assert.equal(authenticated?.id, registered.user.id);

  const loggedIn = await loginUserInSupabase(' test@example.com ', 'StrongPass123!');
  assert.equal(loggedIn.user.id, registered.user.id);
  assert.equal(sessions.length, 2);

  await assert.rejects(
    () => loginUserInSupabase('test@example.com', 'incorrect-password'),
    /notoʻgʻri/,
  );
  await assert.rejects(
    () => registerUserInSupabase('test@example.com', 'AnotherPass123!', 'Duplicate'),
    /failed \(409\)/,
  );

  await logoutFromSupabase(registered.token);
  assert.equal(await getUserBySupabaseToken(registered.token), null);
  assert.equal(await getUserBySupabaseToken('not-a-token'), null);

  await logoutAllSupabaseSessions(registered.user.id);
  assert.equal(sessions.length, 0);
  assert.equal(await getUserBySupabaseToken(loggedIn.token), null);

  console.log('Supabase auth self-tests passed');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
