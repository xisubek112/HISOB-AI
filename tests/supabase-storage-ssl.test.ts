import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildPostgresSslOptions } from '../src/server/supabase-storage.ts';

const TEST_CA = '-----BEGIN CERTIFICATE-----\nZmFrZS1jZXJ0aWZpY2F0ZQ==\n-----END CERTIFICATE-----\n';

test('uses normal TLS verification for remote PostgreSQL by default', () => {
  assert.deepEqual(buildPostgresSslOptions('postgresql://db.example.com/postgres', {}), {
    rejectUnauthorized: true,
  });
});

test('keeps local PostgreSQL SSL disabled unless explicitly enabled', () => {
  assert.equal(buildPostgresSslOptions('postgresql://localhost/postgres', {}), undefined);
});

test('loads the configured CA file and keeps certificate verification enabled', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'hisobot-ca-'));
  const caPath = path.join(dir, 'prod-ca-2021.crt');
  try {
    writeFileSync(caPath, TEST_CA, 'utf8');
    const options = buildPostgresSslOptions('postgresql://db.example.com/postgres', {
      PG_SSL_CA_PATH: caPath,
    });
    assert.deepEqual(options, { rejectUnauthorized: true, ca: readFileSync(caPath, 'utf8') });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fails clearly when the configured CA file cannot be read', () => {
  assert.throws(
    () => buildPostgresSslOptions('postgresql://db.example.com/postgres', {
      PG_SSL_CA_PATH: '/path/that/does/not/exist/prod-ca-2021.crt',
    }),
    /PG_SSL_CA_PATH faylini o‘qib bo‘lmadi/
  );
});

test('fails closed when the configured CA file is not PEM', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'hisobot-ca-invalid-'));
  const caPath = path.join(dir, 'invalid.crt');
  try {
    writeFileSync(caPath, 'not a certificate', 'utf8');
    assert.throws(
      () => buildPostgresSslOptions('postgresql://db.example.com/postgres', {
        PG_SSL_CA_PATH: caPath,
      }),
      /yaroqli PEM sertifikat topilmadi/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
