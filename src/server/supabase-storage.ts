/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'node:fs';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const TRANSIENT_PG_CODES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

const TRANSIENT_NODE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
]);

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim() || process.env.SUPABASE_DB_URL?.trim();
  return url && url.length > 0 ? url : null;
}

export function isSupabaseDatabaseConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export function shouldUseSupabaseBackend(): boolean {
  const explicit = process.env.DB_BACKEND?.trim().toLowerCase();
  if (explicit === 'json') return false;
  if (explicit === 'supabase' || explicit === 'postgres') {
    if (!isSupabaseDatabaseConfigured()) {
      throw new Error(
        'DB_BACKEND=supabase belgilangan, lekin DATABASE_URL yoki SUPABASE_DB_URL sozlanmagan. Xavfsizlik sababli JSON bazaga avtomatik fallback bloklandi.'
      );
    }
    return true;
  }
  if (explicit && explicit.length > 0) {
    throw new Error(
      `Notoʻgʻri DB_BACKEND qiymati: "${explicit}". Ruxsat etilgan qiymatlar: "supabase", "postgres", "json".`
    );
  }
  // Auto-enable PostgreSQL backend if DATABASE_URL / SUPABASE_DB_URL is configured
  return isSupabaseDatabaseConfigured();
}

export function validateDatabaseConfiguration(): { backend: 'supabase' | 'json' } {
  const useSupabase = shouldUseSupabaseBackend();
  return { backend: useSupabase ? 'supabase' : 'json' };
}

export function sanitizePgError(err: unknown): string {
  if (!(err instanceof Error)) return 'Maʼlumotlar bazasida nomaʼlum xatolik';
  // Scrub any accidental DSN / secret fragments before logging
  return err.message
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: string; message?: string };
  if (anyErr.code && (TRANSIENT_PG_CODES.has(anyErr.code) || TRANSIENT_NODE_CODES.has(anyErr.code))) {
    return true;
  }
  const msg = (anyErr.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('connection terminated');
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = Number(process.env.DB_QUERY_TIMEOUT_MS || 12_000),
  label = 'db_operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Soʻrov vaqti tugadi (${label})`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: { maxAttempts?: number; baseDelayMs?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 120;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === maxAttempts) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 60);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt + jitter));
    }
  }
  throw lastErr;
}

export function buildPostgresSslOptions(
  connectionString: string,
  env: NodeJS.ProcessEnv = process.env
): { rejectUnauthorized: boolean; ca?: string } | undefined {
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const useSsl = env.PG_SSL === 'true' || (!isLocal && env.PG_SSL !== 'false');
  if (!useSsl) return undefined;

  const rejectUnauthorized = env.PG_SSL_REJECT_UNAUTHORIZED !== 'false';
  const caPath = env.PG_SSL_CA_PATH?.trim();
  if (!caPath) return { rejectUnauthorized };

  let ca: string;
  try {
    ca = readFileSync(caPath, 'utf8');
  } catch {
    throw new Error('PG_SSL_CA_PATH faylini o‘qib bo‘lmadi. Render Secret File nomi va yo‘lini tekshiring.');
  }

  if (!ca.includes('-----BEGIN CERTIFICATE-----') || !ca.includes('-----END CERTIFICATE-----')) {
    throw new Error('PG_SSL_CA_PATH faylida yaroqli PEM sertifikat topilmadi.');
  }

  return { rejectUnauthorized, ca };
}

export class PostgresStorage {
  private pool: Pool | null = null;
  private adminClient: SupabaseClient | null = null;
  private readonly connectionString: string;

  constructor(connectionString?: string) {
    const resolved = connectionString || getDatabaseUrl();
    if (!resolved) {
      throw new Error('DATABASE_URL yoki SUPABASE_DB_URL sozlanmagan');
    }
    this.connectionString = resolved;
  }

  getPool(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: Number(process.env.PG_POOL_MAX || 10),
        idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
        connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 8_000),
        statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15_000),
        ssl: buildPostgresSslOptions(this.connectionString),
      });

      this.pool.on('error', (err) => {
        console.error('[HISOBOT DB] Idle client error:', sanitizePgError(err));
      });
    }
    return this.pool;
  }

  /**
   * Optional Supabase JS Admin Client (strictly server-side service role).
   * Never exposed to Vite/React frontend or Capacitor APK.
   */
  getSupabaseAdminClient(): SupabaseClient | null {
    if (this.adminClient) return this.adminClient;
    const url = process.env.SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !serviceKey) return null;

    this.adminClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return this.adminClient;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
    options?: { retryable?: boolean; timeoutMs?: number; label?: string }
  ): Promise<QueryResult<T>> {
    const run = () =>
      withTimeout(
        this.getPool().query<T>(text, params),
        options?.timeoutMs,
        options?.label || 'pg_query'
      );

    if (options?.retryable) {
      return withRetry(run);
    }
    return run();
  }

  async withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
    options?: { isolation?: 'READ COMMITTED' | 'SERIALIZABLE'; retryOnSerialization?: boolean }
  ): Promise<T> {
    const exec = async () => {
      const client = await withTimeout(this.getPool().connect(), 8_000, 'pg_connect');
      try {
        await client.query(`BEGIN ISOLATION LEVEL ${options?.isolation || 'READ COMMITTED'}`);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore rollback failures after broken connection
        }
        throw err;
      } finally {
        client.release();
      }
    };

    if (options?.retryOnSerialization) {
      return withRetry(exec, { maxAttempts: 3, baseDelayMs: 60 });
    }
    return exec();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const started = Date.now();
    try {
      await this.query('SELECT 1 AS ok', [], { retryable: false, timeoutMs: 4000, label: 'health' });
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: sanitizePgError(err),
      };
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      const p = this.pool;
      this.pool = null;
      await p.end();
    }
  }
}

let sharedStorage: PostgresStorage | null = null;

export function getPostgresStorage(): PostgresStorage {
  if (!sharedStorage) {
    sharedStorage = new PostgresStorage();
  }
  return sharedStorage;
}

export async function closeSharedPostgresStorage(): Promise<void> {
  if (sharedStorage) {
    const s = sharedStorage;
    sharedStorage = null;
    await s.close();
  }
}
