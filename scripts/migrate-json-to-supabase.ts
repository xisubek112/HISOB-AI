/**
 * One-time, non-destructive importer for the legacy JSON database.
 *
 * Dry-run is the default. To write to Supabase, pass --apply and provide
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the server-side environment.
 * Never run this from a browser or commit secrets to the repository.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

type JsonRecord = Record<string, any>;

const COLLECTIONS = [
  'transactions', 'categories', 'budgets', 'goals', 'debts',
  'notifications', 'wallets', 'walletTransfers', 'familyGroups',
  'familyMembers', 'familyInvitations', 'subscriptions',
  'recurringTransactions', 'recurringLogs', 'receipts',
  'bankConnections', 'bankSyncLogs', 'telegramConnections',
] as const;

const BATCH_SIZE = 100;
const apply = process.argv.includes('--apply');
const inputPath = path.resolve(process.env.HISOBOT_JSON_PATH || 'data/database.json');

function assertObject(value: unknown, label: string): asserts value is JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid legacy database: ${label} must be an object`);
  }
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function postRows(
  baseUrl: string,
  serviceKey: string,
  table: string,
  rows: JsonRecord[],
  onConflict: string,
): Promise<void> {
  for (const batch of chunks(rows, BATCH_SIZE)) {
    const response = await fetch(`${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      // Do not print response bodies: they may contain private financial records.
      throw new Error(`Supabase import failed for ${table} (HTTP ${response.status})`);
    }
  }
}

function buildUserRows(users: JsonRecord): JsonRecord[] {
  return Object.entries(users).map(([id, raw]) => {
    assertObject(raw, `users.${id}`);
    const { passwordHash, salt, resetToken: _discardedResetToken, ...profile } = raw;
    if (typeof raw.email !== 'string' || !raw.email.trim() ||
        typeof passwordHash !== 'string' || !passwordHash ||
        typeof salt !== 'string' || !salt) {
      throw new Error(`User ${id} is missing email or password hash material; import stopped`);
    }
    return {
      id,
      email: raw.email,
      password_hash: passwordHash,
      password_salt: salt,
      profile,
    };
  });
}

function buildSessionRows(sessions: JsonRecord): JsonRecord[] {
  return Object.entries(sessions)
    .filter(([token]) => token !== 'demo_token')
    .map(([token, userId]) => ({
      token_hash: sha256(token),
      user_id: String(userId),
    }));
}

function buildDataRows(data: JsonRecord): JsonRecord[] {
  const rows: JsonRecord[] = [];
  const familyGroups = data.familyGroups ?? {};
  assertObject(familyGroups, 'familyGroups');
  const familyOwners = new Map<string, string>();

  for (const [familyId, rawGroup] of Object.entries(familyGroups)) {
    assertObject(rawGroup, `familyGroups.${familyId}`);
    const ownerId = typeof rawGroup.ownerId === 'string' ? rawGroup.ownerId : '';
    if (!ownerId) throw new Error(`Family group ${familyId} has no ownerId; import stopped`);
    familyOwners.set(familyId, ownerId);
  }

  for (const collection of COLLECTIONS) {
    const source = data[collection] ?? {};
    assertObject(source, collection);
    for (const [scopeKey, value] of Object.entries(source)) {
      if (value == null) continue;

      if (collection === 'familyGroups') {
        const group = value as JsonRecord;
        const ownerId = familyOwners.get(scopeKey);
        if (!ownerId) throw new Error(`Family group owner missing for ${scopeKey}`);
        rows.push({
          owner_user_id: ownerId,
          collection,
          scope_key: scopeKey,
          record_key: scopeKey,
          payload: value,
        });
        continue;
      }

      if (collection === 'familyMembers' || collection === 'familyInvitations') {
        if (!Array.isArray(value)) throw new Error(`Expected ${collection}.${scopeKey} to be an array`);
        const ownerId = familyOwners.get(scopeKey);
        if (!ownerId) throw new Error(`Cannot map ${collection} family ${scopeKey} to its owner; import stopped`);
        for (const item of value) {
          assertObject(item, `${collection}.${scopeKey}[]`);
          if (typeof item.id !== 'string' || !item.id) throw new Error(`Missing id in ${collection}.${scopeKey}`);
          rows.push({
            owner_user_id: ownerId,
            collection,
            scope_key: scopeKey,
            record_key: item.id,
            payload: item,
          });
        }
        continue;
      }

      if (collection === 'telegramConnections') {
        rows.push({
          owner_user_id: scopeKey,
          collection,
          scope_key: scopeKey,
          record_key: scopeKey,
          payload: value,
        });
        continue;
      }

      if (!Array.isArray(value)) throw new Error(`Expected ${collection}.${scopeKey} to be an array`);
      for (const item of value) {
        assertObject(item, `${collection}.${scopeKey}[]`);
        const recordKey = typeof item.id === 'string' && item.id ? item.id : null;
        if (!recordKey) throw new Error(`Missing id in ${collection}.${scopeKey}; import stopped`);
        rows.push({
          owner_user_id: scopeKey,
          collection,
          scope_key: scopeKey,
          record_key: recordKey,
          payload: item,
        });
      }
    }
  }
  return rows;
}

function validateRelations(users: JsonRecord[], sessions: JsonRecord[], records: JsonRecord[]): void {
  const userIds = new Set(users.map((user) => String(user.id)));
  const emails = new Set<string>();

  for (const user of users) {
    const normalized = String(user.email).trim().toLowerCase();
    if (emails.has(normalized)) {
      throw new Error('Duplicate normalized email in legacy users; import stopped before writing');
    }
    emails.add(normalized);
  }

  for (const session of sessions) {
    if (!userIds.has(String(session.user_id))) {
      throw new Error('A legacy session references a missing user; import stopped before writing');
    }
  }

  for (const record of records) {
    if (!userIds.has(String(record.owner_user_id))) {
      throw new Error('A legacy data record references a missing owner; import stopped before writing');
    }
    // Ensure each payload can be serialized before the first network write.
    try {
      JSON.stringify(record.payload);
    } catch {
      throw new Error('A legacy data record contains a non-serializable payload');
    }
  }
}

async function main() {
  if (apply && !process.argv.includes('--confirm-hisobot-import')) {
    throw new Error('Write mode requires both --apply and --confirm-hisobot-import');
  }
  const raw = await fs.readFile(inputPath, 'utf8');
  const legacy = JSON.parse(raw) as JsonRecord;
  assertObject(legacy, 'root');
  assertObject(legacy.users ?? {}, 'users');
  assertObject(legacy.sessions ?? {}, 'sessions');

  const users = buildUserRows(legacy.users ?? {});
  const sessions = buildSessionRows(legacy.sessions ?? {});
  const records = buildDataRows(legacy);
  validateRelations(users, sessions, records);

  const summary = {
    mode: apply ? 'APPLY' : 'DRY RUN',
    source: inputPath,
    users: users.length,
    sessions: sessions.length,
    appDataRecords: records.length,
    collections: Object.fromEntries(COLLECTIONS.map((name) => [
      name,
      records.filter((row) => row.collection === name).length,
    ])),
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log('No data was written. Review the counts, then rerun with --apply to import.');
    return;
  }

  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !serviceKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply');
  const parsedUrl = new URL(rawUrl);
  if (parsedUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
    throw new Error('SUPABASE_URL must use HTTPS');
  }
  const baseUrl = parsedUrl.origin;

  // Parent rows first because sessions and app_data have user foreign keys.
  await postRows(baseUrl, serviceKey, 'app_users', users, 'id');
  await postRows(baseUrl, serviceKey, 'app_sessions', sessions, 'token_hash');
  await postRows(baseUrl, serviceKey, 'app_data', records, 'owner_user_id,collection,scope_key,record_key');

  console.log('Import completed. The source JSON file was not modified or deleted.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Import failed');
  process.exitCode = 1;
});
