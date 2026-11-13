# Supabase server storage rollout

The initial schema is installed in the Supabase project. The server-only adapter in
`src/server/supabase-storage.ts` is the first code step toward replacing the
ephemeral JSON file store.

## Required Render secrets (do not add these to frontend/Vite variables)

- `SUPABASE_URL`: the Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: the project's service-role key.

Keep the service-role key exclusively in the Render backend environment. Never
use it in a `VITE_*` variable, mobile app bundle, GitHub commit, issue, or chat.
The browser/mobile app must continue to call the HISOBOT AI backend.

## Important rollout status

This adapter is not yet connected to `src/server/db.ts` or the Express routes.
The existing `Database` class is synchronous and performs many in-memory
read/modify/write operations. PostgreSQL requests are asynchronous, so enabling
this adapter by changing environment variables alone would be unsafe.

Before production activation:

1. Convert repository operations and all dependent Express handlers to async.
2. Add transaction boundaries for multi-record operations (wallet transfers,
   recurring execution, family invites, and transaction/wallet balance changes).
3. Add integration tests against a disposable Supabase project/schema.
4. Add an explicit, idempotent JSON export/import tool and verify row counts.
5. Test signup, login, session revocation, all finance modules, and restart
   persistence in a staging Render service.
6. Only then switch production traffic and retain a rollback/export plan.

No production data is copied or deleted by this adapter. No runtime behavior is
changed by this commit.


## Legacy JSON import utility

A one-time importer is available at `scripts/migrate-json-to-supabase.ts`.
It is deliberately separate from application startup and never runs automatically.

1. Make a private backup of the existing `data/database.json` file.
2. Place a copy of that JSON file in a trusted local working environment; do not commit it.
3. Set `HISOBOT_JSON_PATH` to that copy if it is not at `data/database.json`.
4. Run a dry-run first (no credentials and no writes):

   ```sh
   npx tsx scripts/migrate-json-to-supabase.ts
   ```

5. Review the counts and investigate any validation error before proceeding.
6. Only in a controlled staging environment, set `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` as private environment variables, then explicitly
   run:

   ```sh
   npx tsx scripts/migrate-json-to-supabase.ts --apply --confirm-hisobot-import
   ```

The importer hashes legacy session tokens before storing them, skips the known
demo token, maps family records to their owning user, uses conflict-safe upserts,
and never modifies or deletes the source JSON file. Do not run it against
production until the async application repository and staging verification are
complete. The service-role key must never be pasted into chat or committed.

## Import preflight and retry behavior

Before the first network write, the importer validates that session and data
owners exist in the legacy user set, checks normalized email uniqueness, and
checks every record payload can be serialized. It skips the known demo session.

The import is idempotent at the row-key level because it uses PostgREST upserts
against each table's primary key. If a network failure occurs after some batches
have been written, do not delete rows manually: inspect the error and rerun the
same import after correcting the cause. Keep the original JSON backup unchanged.
The importer does not provide a single transaction across all three tables, so
a failed run can leave a partial but safely re-runnable import.


## Async repository foundation

`src/server/supabase-repository.ts` provides typed async primitives for
user-owned collections: list records, read one record, upsert one or a bounded
batch, and delete one record. The batch operation rejects duplicate IDs and
never deletes records omitted from the submitted batch.

This is intentionally a foundation only. It does not make multi-step financial
operations atomic, and it is not connected to Express or the legacy Database
class yet. Wallet transfers, recurring execution, goal deposits, debt payments,
and family membership changes must be implemented with database-side atomic
operations before their routes can move to this repository.


## Atomic wallet transfer

The migration `supabase/migrations/202611130002_atomic_wallet_transfers.sql`
adds `hisobot_transfer_between_wallets`. It locks the two wallet rows in a
stable order, validates ownership, archive state and available balance, updates
both balances, and inserts the transfer ledger entry in one PostgreSQL
transaction. The transfer ID is an idempotency key, so retrying the same request
does not apply the balance change twice.

The server adapter exposes this operation through
`transferWalletsAtomically`, and the async repository exposes `transferWallets`.
Neither is wired to the existing Express route yet. Do not call this RPC until
the second SQL migration has been applied in the intended Supabase project.
The existing JSON-backed wallet route remains active until route migration and
staging integration tests are complete.
