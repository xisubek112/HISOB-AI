# HISOBOT AI async API migration plan

## Current architecture (verified on `feat/supabase-storage-adapter`)

- `server.ts` imports the synchronous singleton `db` from `src/server/db.ts`.
- The authentication middleware calls `db.getUserByToken` synchronously.
- Signup/login/logout/profile and finance route handlers call synchronous `db.*` methods.
- `src/server/db.ts` loads and persists the complete `DatabaseSchema` as one JSON file using synchronous filesystem operations.
- `src/server/supabase-storage.ts`, `supabase-repository.ts`, and `supabase-auth.ts` are asynchronous primitives, but none is wired into Express.
- Therefore adding Supabase environment variables or switching only the auth routes would create split-brain accounts and is not a safe deployment step.

## Data model inventory

The legacy JSON schema contains these user-owned collections:

| Collection | Main API responsibility | Migration notes |
| --- | --- | --- |
| transactions | Income/expense CRUD and reports | Coordinate with wallet balance changes and budget alerts |
| categories | Custom categories | Merge with built-in income/expense categories at read time |
| budgets | Monthly/category limits | Budget warning notifications must remain consistent |
| goals | Savings goals | Goal deposits need atomic operation + milestone notification |
| debts | Borrowed/lent balances | Debt payments need atomic operation |
| notifications | User alerts | Read state and generated alerts must persist |
| wallets | Cards/cash balances | All balance-changing actions need transaction boundaries |
| walletTransfers | Transfer history | Use the existing transfer RPC |
| familyGroups | Family budget metadata | Access must be authorized by membership/role |
| familyMembers | Family membership | Invite/accept/remove must be atomic and permission-checked |
| familyInvitations | Pending invitations | Token/code lifecycle and expiry need server-side validation |
| subscriptions | Recurring subscription metadata | Keep separate from actual recurring transaction execution |
| recurringTransactions | Scheduled income/expense | Use the existing recurring execution RPC |
| recurringLogs | Execution history | Persist with the schedule execution transaction |
| receipts | Receipt scan records | Store metadata only; define secure object storage separately for images |
| bankConnections | Bank integration metadata | Do not store bank passwords or raw credentials in JSONB |
| bankSyncLogs | Bank sync audit trail | Preserve ordering and avoid duplicate sync events |
| telegramConnections | Telegram link/preferences | Treat connect codes and chat IDs as sensitive |

## Safe migration sequence

### Phase 0 — keep production unchanged
- Keep the JSON-backed runtime active.
- Keep PR #4 Draft and do not switch Render environment variables.
- Back up the JSON database before any staging import.
- Never place `SUPABASE_SERVICE_ROLE_KEY` in Vite variables, mobile builds, GitHub, or chat.

### Phase 1 — define the async application contract
- Introduce an asynchronous repository interface for every collection and user operation.
- Make ownership explicit in every read/write method; never accept an arbitrary owner ID from request bodies.
- Add typed serializers/deserializers and validate stored JSONB payloads at the repository boundary.
- Preserve built-in categories and exchange-rate defaults as application-level read models rather than user records.
- Add integration tests against a disposable Supabase project before wiring production routes.

### Phase 2 — authentication cutover in staging only
- Convert auth middleware to async and catch/reject storage errors safely.
- Convert signup, login, logout, logout-all, profile, password verification, and password change routes together.
- Do not enable Supabase auth while finance routes still depend on a JSON-only user store unless a deliberate, tested compatibility bridge exists.
- Test legacy password hashes, expired sessions, token revocation, duplicate email handling, and restart persistence.

### Phase 3 — migrate read-only finance endpoints
- Convert list/detail endpoints first: transactions, categories, budgets, goals, debts, wallets, notifications, subscriptions, recurring schedules, receipts, bank metadata, and Telegram preferences.
- Keep response JSON shapes stable for the existing web/mobile clients.
- Add per-user isolation tests for every collection and family-membership authorization tests for shared data.
- Compare API results against a fixture-backed legacy JSON database.

### Phase 4 — migrate writes with database-side atomicity
- Simple single-record writes may use bounded upserts/deletes.
- Wallet transfer must call `hisobot_transfer_between_wallets`.
- Goal deposit and debt payment must call `hisobot_apply_financial_operation`.
- Recurring execution must call `hisobot_execute_recurring_transaction`.
- Transaction create/update/delete with wallet balance changes must be one database transaction; do not split the transaction row and wallet balance update into separate HTTP calls.
- Budget alert and goal milestone notifications must be written consistently with the triggering financial operation.
- Family invite/accept/remove and role changes require dedicated RPCs or equivalent transaction-safe SQL functions before moving those routes.

### Phase 5 — staging data rehearsal and cutover
- Take a private, immutable JSON backup and run importer dry-run.
- Review every collection count, user/session count, family ownership mapping, and validation warning.
- Import only into a disposable/staging Supabase project first; verify row counts and sample records.
- Run end-to-end tests for signup/login, every finance module, concurrent wallet operations, recurring execution, family access, and service restart.
- Switch production only after an approved maintenance/cutover plan, verified backup, rollback plan, and successful staging rehearsal.
- Keep the source JSON backup untouched until post-cutover reconciliation is complete.

## Release blockers / checks

- [ ] The async repository covers all 18 collections listed above.
- [ ] No Express route or middleware performs synchronous JSON database access after cutover.
- [ ] All async Express 4 handlers forward errors to centralized error middleware.
- [ ] User ownership and family authorization are enforced server-side.
- [ ] Multi-record financial operations are atomic and idempotent.
- [ ] SQL migrations and SQL integration scripts pass on disposable PostgreSQL.
- [ ] Import dry-run and staging import counts reconcile exactly.
- [ ] Staging end-to-end and restart-persistence tests pass.
- [ ] Production rollback/export procedure is documented and rehearsed.

## Explicitly not done by this plan

This document does not change runtime behavior, apply SQL migrations, import data, change Render settings, or enable Supabase. Those actions require separate validation and an explicit production cutover decision.
