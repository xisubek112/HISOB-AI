/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';
import { hashSessionToken } from '../src/server/supabase-auth.ts';
import { isSupabaseDatabaseConfigured, PostgresStorage, sanitizePgError } from '../src/server/supabase-storage.ts';

dotenv.config();

const DEMO_USER_ID = 'usr_demo_hisobot_2026';
const DEMO_FAMILY_ID = 'fam_qodirovlar_2026';
const SENSITIVE_FIELDS = new Set(['passwordHash', 'passwordSalt', 'salt', 'resetToken', 'tokenHash']);

export interface ImportOptions {
  filePath: string;
  apply: boolean;
  confirmToken?: string;
  batchSize: number;
  includeDemo: boolean;
  includeSessions: boolean;
  strict?: boolean;
}

export interface PlannedUserRow {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  profile: Record<string, unknown>;
}

export interface PlannedSessionRow {
  tokenHash: string;
  userId: string;
}

export interface PlannedDataRow {
  ownerUserId: string;
  collection: string;
  scopeKey: string;
  recordKey: string;
  payload: Record<string, unknown>;
}

export interface ConflictFieldDiff {
  field: string;
  incoming: unknown;
  existing: unknown;
}

export interface ImportConflict {
  entityType: 'app_users' | 'app_data';
  key: string;
  reason: 'id_conflict' | 'email_conflict' | 'record_conflict';
  resolution: 'skipped_no_overwrite';
  diffs: ConflictFieldDiff[];
}

export interface ImportReport {
  mode: 'dry-run' | 'apply';
  sourceFile: string;
  valid: boolean;
  batchSize: number;
  dbConflictCheck: 'checked' | 'skipped_no_database_url' | 'failed';
  counts: {
    usersScanned: number;
    usersPlanned: number;
    usersInserted: number;
    usersSkippedExisting: number;
    usersExactMatch: number;
    sessionsPlanned: number;
    sessionsInserted: number;
    dataRecordsPlanned: number;
    dataRecordsInserted: number;
    dataRecordsSkippedExisting: number;
    dataExactMatch: number;
    conflictsDetected: number;
    skippedDemoRecords: number;
    skippedOrphanRecords: number;
    duplicateRecordsDetected: number;
    byCollection: Record<string, number>;
  };
  conflicts: ImportConflict[];
  warnings: string[];
  errors: string[];
}

export interface ImportPlan {
  users: PlannedUserRow[];
  sessions: PlannedSessionRow[];
  dataRows: PlannedDataRow[];
  report: ImportReport;
}

export interface StorageQueryAdapter {
  query: PostgresStorage['query'];
  withTransaction?: PostgresStorage['withTransaction'];
  close?: PostgresStorage['close'];
}

const USER_ARRAY_COLLECTIONS = [
  'transactions',
  'categories',
  'budgets',
  'goals',
  'debts',
  'notifications',
  'wallets',
  'walletTransfers',
  'subscriptions',
  'recurringTransactions',
  'recurringLogs',
  'receipts',
  'bankConnections',
  'bankSyncLogs',
] as const;

export function parseCliArgs(argv: string[]): ImportOptions {
  let filePath = path.resolve(process.cwd(), 'data', 'database.json');
  let apply = false;
  let confirmToken: string | undefined;
  let batchSize = 100;
  let includeDemo = false;
  let includeSessions = false;
  let strict = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file' && argv[i + 1]) {
      filePath = path.resolve(process.cwd(), argv[++i]);
    } else if (arg.startsWith('--file=')) {
      filePath = path.resolve(process.cwd(), arg.slice('--file='.length));
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg === '--dry-run') {
      apply = false;
    } else if (arg === '--confirm' && argv[i + 1]) {
      confirmToken = argv[++i];
    } else if (arg.startsWith('--confirm=')) {
      confirmToken = arg.slice('--confirm='.length);
    } else if (arg === '--batch-size' && argv[i + 1]) {
      batchSize = Math.max(1, Math.min(500, Number(argv[++i]) || 100));
    } else if (arg.startsWith('--batch-size=')) {
      batchSize = Math.max(1, Math.min(500, Number(arg.slice('--batch-size='.length)) || 100));
    } else if (arg === '--include-demo') {
      includeDemo = true;
    } else if (arg === '--include-sessions') {
      includeSessions = true;
    } else if (arg === '--strict') {
      strict = true;
    }
  }

  return { filePath, apply, confirmToken, batchSize, includeDemo, includeSessions, strict };
}

function stableEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, idx) => stableEqual(v, b[idx]));
  }
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA).filter((k) => objA[k] !== undefined);
  const keysB = Object.keys(objB).filter((k) => objB[k] !== undefined);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(objB, k) && stableEqual(objA[k], objB[k]));
}

export function computeRecordDiffs(
  incoming: Record<string, unknown>,
  existing: Record<string, unknown>
): ConflictFieldDiff[] {
  const keys = new Set([...Object.keys(incoming), ...Object.keys(existing)]);
  const diffs: ConflictFieldDiff[] = [];

  for (const key of Array.from(keys).sort()) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    const inVal = incoming[key];
    const exVal = existing[key];
    if (inVal === undefined && exVal === undefined) continue;
    if (!stableEqual(inVal, exVal)) {
      diffs.push({
        field: key,
        incoming: inVal ?? null,
        existing: exVal ?? null,
      });
    }
  }

  return diffs;
}

export function validateAndPlanImport(
  rawData: Record<string, unknown>,
  options: Pick<ImportOptions, 'filePath' | 'apply' | 'batchSize' | 'includeDemo' | 'includeSessions' | 'strict'>
): ImportPlan {
  const warnings: string[] = [];
  const errors: string[] = [];
  const byCollection: Record<string, number> = {};
  const users: PlannedUserRow[] = [];
  const sessions: PlannedSessionRow[] = [];
  const dataRows: PlannedDataRow[] = [];

  let skippedDemoRecords = 0;
  let skippedOrphanRecords = 0;
  let duplicateRecordsDetected = 0;

  const rawUsers = (rawData.users && typeof rawData.users === 'object' ? rawData.users : {}) as Record<
    string,
    Record<string, unknown>
  >;

  const validUserIds = new Set<string>();
  const seenEmails = new Set<string>();
  const usersScanned = Object.keys(rawUsers).length;

  for (const [keyId, u] of Object.entries(rawUsers)) {
    const userId = String(u?.id || keyId).trim();
    if (!options.includeDemo && userId === DEMO_USER_ID) {
      skippedDemoRecords++;
      continue;
    }

    const email = String(u?.email || '').trim();
    const emailNorm = email.toLowerCase();
    const passwordHash = String(u?.passwordHash || '');
    const passwordSalt = String(u?.salt || u?.passwordSalt || '');

    if (!userId || !email || !email.includes('@')) {
      errors.push(`Yaroqsiz foydalanuvchi yozuvi: id=${keyId}`);
      continue;
    }
    if (seenEmails.has(emailNorm)) {
      errors.push(`Takroriy elektron pochta aniqlandi: ${email}`);
      duplicateRecordsDetected++;
      continue;
    }
    if (!passwordHash || !passwordSalt) {
      errors.push(`Foydalanuvchi parol xeshi yoki tuz yoʻq: ${userId}`);
      continue;
    }

    seenEmails.add(emailNorm);
    validUserIds.add(userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, salt: _s, passwordSalt: _ps, resetToken: _rt, ...profile } = u;
    users.push({
      id: userId,
      email,
      passwordHash,
      passwordSalt,
      profile: { ...profile, id: userId, email },
    });
  }

  const seenDataPks = new Set<string>();
  const pushDataRow = (row: PlannedDataRow) => {
    const pk = `${row.ownerUserId}::${row.collection}::${row.scopeKey}::${row.recordKey}`;
    if (seenDataPks.has(pk)) {
      duplicateRecordsDetected++;
      warnings.push(`Takroriy yozuv oʻtkazib yuborildi: ${pk}`);
      return;
    }
    seenDataPks.add(pk);
    dataRows.push(row);
    byCollection[row.collection] = (byCollection[row.collection] || 0) + 1;
  };

  for (const collection of USER_ARRAY_COLLECTIONS) {
    const mapObj = (rawData[collection] && typeof rawData[collection] === 'object'
      ? rawData[collection]
      : {}) as Record<string, unknown[]>;

    for (const [ownerId, items] of Object.entries(mapObj)) {
      if (!options.includeDemo && ownerId === DEMO_USER_ID) {
        skippedDemoRecords += Array.isArray(items) ? items.length : 1;
        continue;
      }
      if (!validUserIds.has(ownerId)) {
        const count = Array.isArray(items) ? items.length : 1;
        skippedOrphanRecords += count;
        warnings.push(`Yetim (orphan) ${collection} yozuvlari topildi: userId=${ownerId} (${count} ta)`);
        continue;
      }
      if (!Array.isArray(items)) continue;

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx] as Record<string, unknown> | null;
        if (!item || typeof item !== 'object') continue;
        const recordKey = String(item.id || `${collection}_${idx}`).trim();
        pushDataRow({
          ownerUserId: ownerId,
          collection,
          scopeKey: ownerId,
          recordKey,
          payload: { ...item, userId: item.userId || ownerId },
        });
      }
    }
  }

  const telegramMap = (rawData.telegramConnections && typeof rawData.telegramConnections === 'object'
    ? rawData.telegramConnections
    : {}) as Record<string, Record<string, unknown>>;
  for (const [ownerId, conn] of Object.entries(telegramMap)) {
    if (!options.includeDemo && ownerId === DEMO_USER_ID) {
      skippedDemoRecords++;
      continue;
    }
    if (!validUserIds.has(ownerId)) {
      skippedOrphanRecords++;
      warnings.push(`Yetim telegramConnections yozuvi: userId=${ownerId}`);
      continue;
    }
    if (!conn || typeof conn !== 'object') continue;
    pushDataRow({
      ownerUserId: ownerId,
      collection: 'telegramConnections',
      scopeKey: ownerId,
      recordKey: 'default',
      payload: { ...conn, userId: ownerId },
    });
  }

  const familyGroups = (rawData.familyGroups && typeof rawData.familyGroups === 'object'
    ? rawData.familyGroups
    : {}) as Record<string, Record<string, unknown>>;
  const validFamilyOwners = new Map<string, string>();

  for (const [famKey, group] of Object.entries(familyGroups)) {
    const familyId = String(group?.id || famKey).trim();
    const ownerId = String(group?.ownerId || '').trim();
    if (!options.includeDemo && (familyId === DEMO_FAMILY_ID || ownerId === DEMO_USER_ID)) {
      skippedDemoRecords++;
      continue;
    }
    if (!validUserIds.has(ownerId)) {
      skippedOrphanRecords++;
      warnings.push(`Yetim familyGroups yozuvi: familyId=${familyId}, ownerId=${ownerId}`);
      continue;
    }
    validFamilyOwners.set(familyId, ownerId);
    pushDataRow({
      ownerUserId: ownerId,
      collection: 'familyGroups',
      scopeKey: familyId,
      recordKey: familyId,
      payload: group,
    });
  }

  const familyMembers = (rawData.familyMembers && typeof rawData.familyMembers === 'object'
    ? rawData.familyMembers
    : {}) as Record<string, Record<string, unknown>[]>;
  for (const [famId, members] of Object.entries(familyMembers)) {
    const groupOwner = validFamilyOwners.get(famId);
    if (!groupOwner) {
      if (!options.includeDemo && famId === DEMO_FAMILY_ID) {
        skippedDemoRecords += Array.isArray(members) ? members.length : 1;
      } else {
        skippedOrphanRecords += Array.isArray(members) ? members.length : 1;
        warnings.push(`Yetim familyMembers guruhi: familyId=${famId}`);
      }
      continue;
    }
    if (!Array.isArray(members)) continue;
    for (const m of members) {
      if (!m || typeof m !== 'object') continue;
      const recKey = String(m.id || `fm_${m.userId || ''}`).trim();
      pushDataRow({
        ownerUserId: groupOwner,
        collection: 'familyMembers',
        scopeKey: famId,
        recordKey: recKey,
        payload: m,
      });
    }
  }

  const familyInvitations = (rawData.familyInvitations && typeof rawData.familyInvitations === 'object'
    ? rawData.familyInvitations
    : {}) as Record<string, Record<string, unknown>[]>;
  for (const [famId, invites] of Object.entries(familyInvitations)) {
    const groupOwner = validFamilyOwners.get(famId);
    if (!groupOwner) {
      if (!options.includeDemo && famId === DEMO_FAMILY_ID) {
        skippedDemoRecords += Array.isArray(invites) ? invites.length : 1;
      } else {
        skippedOrphanRecords += Array.isArray(invites) ? invites.length : 1;
        warnings.push(`Yetim familyInvitations guruhi: familyId=${famId}`);
      }
      continue;
    }
    if (!Array.isArray(invites)) continue;
    for (const inv of invites) {
      if (!inv || typeof inv !== 'object') continue;
      const recKey = String(inv.id || inv.inviteCode || '').trim();
      pushDataRow({
        ownerUserId: groupOwner,
        collection: 'familyInvitations',
        scopeKey: famId,
        recordKey: recKey,
        payload: inv,
      });
    }
  }

  if (options.includeSessions && rawData.sessions && typeof rawData.sessions === 'object') {
    const rawSessions = rawData.sessions as Record<string, string>;
    for (const [rawToken, uid] of Object.entries(rawSessions)) {
      if (rawToken === 'demo_token' || (!options.includeDemo && uid === DEMO_USER_ID)) {
        skippedDemoRecords++;
        continue;
      }
      if (!validUserIds.has(uid)) {
        skippedOrphanRecords++;
        continue;
      }
      sessions.push({
        tokenHash: hashSessionToken(rawToken),
        userId: uid,
      });
    }
  }

  if (options.strict && skippedOrphanRecords > 0) {
    errors.push(`Strict rejim: ${skippedOrphanRecords} ta yetim yozuv mavjud`);
  }

  return {
    users,
    sessions,
    dataRows,
    report: {
      mode: options.apply ? 'apply' : 'dry-run',
      sourceFile: options.filePath,
      valid: errors.length === 0,
      batchSize: options.batchSize,
      dbConflictCheck: 'skipped_no_database_url',
      counts: {
        usersScanned,
        usersPlanned: users.length,
        usersInserted: 0,
        usersSkippedExisting: 0,
        usersExactMatch: 0,
        sessionsPlanned: sessions.length,
        sessionsInserted: 0,
        dataRecordsPlanned: dataRows.length,
        dataRecordsInserted: 0,
        dataRecordsSkippedExisting: 0,
        dataExactMatch: 0,
        conflictsDetected: 0,
        skippedDemoRecords,
        skippedOrphanRecords,
        duplicateRecordsDetected,
        byCollection,
      },
      conflicts: [],
      warnings,
      errors,
    },
  };
}

export async function inspectDatabaseConflicts(
  plan: ImportPlan,
  storage: StorageQueryAdapter,
  batchSize = 200
): Promise<{ emailConflictUserIds: Set<string> }> {
  const emailConflictUserIds = new Set<string>();

  if (plan.users.length > 0) {
    const userIds = plan.users.map((u) => u.id);
    const emailsNorm = plan.users.map((u) => u.email.trim().toLowerCase());

    const existingUsersRes = await storage.query<{
      id: string;
      email: string;
      email_normalized: string;
      password_hash: string;
      profile: Record<string, unknown>;
    }>(
      `SELECT id, email, lower(trim(email)) AS email_normalized, password_hash, profile
         FROM public.app_users
        WHERE id = ANY($1::text[])
           OR lower(trim(email)) = ANY($2::text[])`,
      [userIds, emailsNorm],
      { retryable: true, label: 'import_inspect_user_conflicts' }
    );

    const byId = new Map(existingUsersRes.rows.map((r) => [r.id, r]));
    const byEmail = new Map(existingUsersRes.rows.map((r) => [r.email_normalized, r]));

    for (const incoming of plan.users) {
      const existingById = byId.get(incoming.id);
      const existingByEmail = byEmail.get(incoming.email.trim().toLowerCase());
      if (!existingById && !existingByEmail) continue;

      plan.report.counts.usersSkippedExisting++;

      // An incoming row must never bind an existing ID to a different email owner,
      // or an incoming email to a different ID owner. Check both identities independently.
      const identityCollision =
        Boolean(existingById && existingByEmail && existingById.id !== existingByEmail.id);
      const emailIdentityMismatch = Boolean(existingByEmail && existingByEmail.id !== incoming.id);
      const idIdentityMismatch = Boolean(existingById && existingById.email_normalized !== incoming.email.trim().toLowerCase());
      const isEmailIdentityMismatch = identityCollision || emailIdentityMismatch || idIdentityMismatch;
      if (isEmailIdentityMismatch) {
        emailConflictUserIds.add(incoming.id);
      }

      const existing = existingById || existingByEmail!;
      const diffs = computeRecordDiffs(incoming.profile, existing.profile || {});
      if (existing.id !== incoming.id) {
        diffs.unshift({ field: 'id', incoming: incoming.id, existing: existing.id });
      }
      if (identityCollision) {
        diffs.unshift({
          field: 'identity',
          incoming: 'ID va email ikki xil mavjud akkauntga tegishli',
          existing: 'Import bekor qilindi',
        });
      }
      if (existing.password_hash !== incoming.passwordHash) {
        diffs.push({ field: 'passwordHash', incoming: '[changed]', existing: '[existing]' });
      }

      if (diffs.length === 0 && !isEmailIdentityMismatch) {
        plan.report.counts.usersExactMatch++;
      } else {
        plan.report.counts.conflictsDetected++;
        plan.report.conflicts.push({
          entityType: 'app_users',
          key: incoming.id,
          reason: isEmailIdentityMismatch ? 'email_conflict' : 'id_conflict',
          resolution: 'skipped_no_overwrite',
          diffs,
        });
      }
    }
  }

  if (plan.dataRows.length > 0) {
    const chunkSize = Math.max(50, batchSize);
    const existingMap = new Map<string, Record<string, unknown>>();

    for (let i = 0; i < plan.dataRows.length; i += chunkSize) {
      const batch = plan.dataRows.slice(i, i + chunkSize);
      const owners = batch.map((r) => r.ownerUserId);
      const collections = batch.map((r) => r.collection);
      const scopes = batch.map((r) => r.scopeKey);
      const records = batch.map((r) => r.recordKey);

      const existingDataRes = await storage.query<{
        owner_user_id: string;
        collection: string;
        scope_key: string;
        record_key: string;
        payload: Record<string, unknown>;
      }>(
        `SELECT d.owner_user_id, d.collection, d.scope_key, d.record_key, d.payload
           FROM public.app_data d
           JOIN unnest($1::text[], $2::text[], $3::text[], $4::text[])
             AS k(owner_user_id, collection, scope_key, record_key)
             ON d.owner_user_id = k.owner_user_id
            AND d.collection = k.collection
            AND d.scope_key = k.scope_key
            AND d.record_key = k.record_key`,
        [owners, collections, scopes, records],
        { retryable: true, label: 'import_inspect_data_conflicts' }
      );

      for (const r of existingDataRes.rows) {
        existingMap.set(
          `${r.owner_user_id}::${r.collection}::${r.scope_key}::${r.record_key}`,
          r.payload
        );
      }
    }

    for (const row of plan.dataRows) {
      const pk = `${row.ownerUserId}::${row.collection}::${row.scopeKey}::${row.recordKey}`;
      const existingPayload = existingMap.get(pk);
      if (!existingPayload) continue;

      plan.report.counts.dataRecordsSkippedExisting++;
      const diffs = computeRecordDiffs(row.payload, existingPayload);
      if (diffs.length === 0) {
        plan.report.counts.dataExactMatch++;
      } else {
        plan.report.counts.conflictsDetected++;
        plan.report.conflicts.push({
          entityType: 'app_data',
          key: pk,
          reason: 'record_conflict',
          resolution: 'skipped_no_overwrite',
          diffs,
        });
      }
    }
  }

  plan.report.dbConflictCheck = 'checked';
  return { emailConflictUserIds };
}

export async function runJsonImport(
  options: ImportOptions,
  storageOverride?: StorageQueryAdapter
): Promise<ImportReport> {
  if (!fs.existsSync(options.filePath)) {
    throw new Error(`Manba fayl topilmadi: ${options.filePath}`);
  }

  const rawText = fs.readFileSync(options.filePath, 'utf-8');
  const rawJson = JSON.parse(rawText) as Record<string, unknown>;
  const plan = validateAndPlanImport(rawJson, options);

  if (!plan.report.valid) {
    return plan.report;
  }

  const canConnectDb = Boolean(storageOverride) || isSupabaseDatabaseConfigured();
  const storage: StorageQueryAdapter | null = canConnectDb ? storageOverride || new PostgresStorage() : null;
  const shouldClose = Boolean(storage && !storageOverride && typeof storage.close === 'function');

  try {
    let emailConflictUserIds = new Set<string>();
    if (storage) {
      const inspected = await inspectDatabaseConflicts(plan, storage, options.batchSize);
      emailConflictUserIds = inspected.emailConflictUserIds;
      if (plan.report.counts.conflictsDetected > 0) {
        plan.report.warnings.push(
          `${plan.report.counts.conflictsDetected} ta mavjud yozuv bilan farq (conflict) aniqlandi — mavjud maʼlumotlar avtomatik overwrite qilinmadi.`
        );
      }
    } else if (!options.apply) {
      plan.report.warnings.push(
        'DATABASE_URL berilmagani sababli faqat lokal JSON validatsiyasi bajarildi; bazadagi mavjud yozuvlar bilan conflict tekshiruvi oʻtkazilmadi.'
      );
    }

    if (!options.apply) {
      return plan.report;
    }

    if (options.confirmToken !== 'IMPORT_HISOBOT_DATA') {
      plan.report.valid = false;
      plan.report.errors.push(
        'Xavfsizlik tasdigʻi yetishmayapti: haqiqiy yozish uchun --apply --confirm=IMPORT_HISOBOT_DATA parametrlarini kiriting'
      );
      return plan.report;
    }

    if (!storage || !storage.withTransaction) {
      plan.report.valid = false;
      plan.report.errors.push('Haqiqiy import uchun DATABASE_URL sozlangan boʻlishi shart');
      return plan.report;
    }

    // 1. Insert users idempotently (NEVER overwrite existing users or mismatched-id emails)
    for (const u of plan.users) {
      if (emailConflictUserIds.has(u.id)) {
        continue;
      }
      await storage.withTransaction(async (client) => {
        const res = await client.query(
          `INSERT INTO public.app_users (
             id, email, password_hash, password_salt, profile, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5::jsonb, now(), now())
           ON CONFLICT (id) DO NOTHING`,
          [u.id, u.email, u.passwordHash, u.passwordSalt, JSON.stringify(u.profile)]
        );
        if ((res.rowCount || 0) > 0) {
          plan.report.counts.usersInserted++;
          await client.query(
            `INSERT INTO public.app_audit_logs (
               id, owner_user_id, action, entity_type, entity_id, details, created_at
             ) VALUES ($1, $2, 'json_migration_import', 'app_users', $2, $3::jsonb, now())
             ON CONFLICT (id) DO NOTHING`,
            [
              `aud_imp_${u.id}`,
              u.id,
              JSON.stringify({ source: path.basename(options.filePath) }),
            ]
          );
        }
      });
    }

    // 2. Insert app_data in safe batches (skip rows belonging to email-conflicted users; NEVER overwrite)
    const eligibleRows = plan.dataRows.filter((r) => !emailConflictUserIds.has(r.ownerUserId));
    for (let i = 0; i < eligibleRows.length; i += options.batchSize) {
      const batch = eligibleRows.slice(i, i + options.batchSize);
      await storage.withTransaction(async (client) => {
        const owners = batch.map((r) => r.ownerUserId);
        const collections = batch.map((r) => r.collection);
        const scopes = batch.map((r) => r.scopeKey);
        const records = batch.map((r) => r.recordKey);
        const payloads = batch.map((r) => JSON.stringify(r.payload));

        const res = await client.query(
          `INSERT INTO public.app_data (
             owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
           )
           SELECT u.owner_user_id, u.collection, u.scope_key, u.record_key, u.payload, now(), now()
           FROM unnest(
             $1::text[],
             $2::text[],
             $3::text[],
             $4::text[],
             $5::jsonb[]
           ) AS u(owner_user_id, collection, scope_key, record_key, payload)
           ON CONFLICT (owner_user_id, collection, scope_key, record_key) DO NOTHING`,
          [owners, collections, scopes, records, payloads]
        );
        const inserted = res.rowCount || 0;
        plan.report.counts.dataRecordsInserted += inserted;
      });
    }

    // 3. Insert sessions if opted in (never overwrite)
    for (const s of plan.sessions) {
      if (emailConflictUserIds.has(s.userId)) continue;
      const res = await storage.query(
        `INSERT INTO public.app_sessions (token_hash, user_id, created_at, expires_at, last_used_at)
         VALUES ($1, $2, now(), now() + interval '30 days', now())
         ON CONFLICT (token_hash) DO NOTHING`,
        [s.tokenHash, s.userId],
        { label: 'import_session' }
      );
      if ((res.rowCount || 0) > 0) {
        plan.report.counts.sessionsInserted++;
      }
    }

    return plan.report;
  } catch (err) {
    plan.report.dbConflictCheck = 'failed';
    plan.report.valid = false;
    plan.report.errors.push(sanitizePgError(err));
    return plan.report;
  } finally {
    if (shouldClose && storage?.close) {
      await storage.close();
    }
  }
}

const isEntrypoint =
  typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const options = parseCliArgs(process.argv.slice(2));
  runJsonImport(options)
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (!report.valid) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[HISOBOT IMPORT] Xatolik:', sanitizePgError(err));
      process.exit(1);
    });
}
