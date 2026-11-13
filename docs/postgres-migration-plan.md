# HISOBOT AI PostgreSQL migration plan

## Current-state audit (main)

- The server imports a singleton `db` from `src/server/db.ts`.
- `Database` loads and persists the entire application state synchronously in `data/database.json` using `fs.readFileSync` / `fs.writeFileSync`.
- Server routes call the database methods synchronously throughout `server.ts`; the auth middleware is synchronous too.
- The data model includes users, sessions, transactions, categories, budgets, goals, debts, notifications, wallets, wallet transfers, family groups/members/invitations, subscriptions, recurring transactions/logs, receipts, bank connections/sync logs, and Telegram connections.
- Several operations update multiple collections together (wallet balance + transaction; family membership + group; recurring execution + transaction + log). These must become database transactions, not separate independent writes.
- Demo seed data is created by the database constructor when the JSON file is absent, including demo financial data and simulated bank/Telegram connections. Production must not silently seed this data.
- Current password hashing is PBKDF2-SHA512 with only 1,000 iterations. This should be upgraded with a carefully versioned password-hash migration, not by silently making existing passwords unusable.
- Password reset currently generates a predictable Math.random code and returns it from the API path. This must be redesigned before production.
- The server currently exposes `POST /api/user/upgrade-premium` to any authenticated user without payment verification. This must be disabled until a trusted payment verification workflow exists.

## Migration strategy

1. Keep the existing custom Node.js authentication model initially; do not mix this project with Supabase Auth in the same migration.
2. Add a PostgreSQL repository using a server-only Supabase service-role credential. Never expose that credential to Vite/client code or commit it to Git.
3. Convert the server routes and middleware to async/await and make repository methods asynchronous. A partial sync/async conversion is not safe.
4. Use relational tables for identity, sessions, core financial records, family membership, payment orders/events, and audit records. Use JSONB only for flexible profile/preferences or staged legacy payloads where appropriate.
5. Use database transactions for multi-record operations and enforce owner/family authorization in server code. Enable RLS and keep direct `anon` / `authenticated` access revoked unless a specific reviewed policy is added.
6. Add explicit indexes, foreign keys, uniqueness constraints, validation, and expiry rules. Store only a SHA-256 hash of opaque session tokens; never store bearer tokens in plaintext.
7. Disable demo seeding in production. Provide an explicit development-only seed command.
8. Keep the JSON adapter available temporarily for local tests only; do not run both stores as live writable sources.
9. Add tests for registration/login/logout, user isolation, transactions, wallet balance atomicity, family permissions, recurring execution idempotency, and failure/retry behavior.
10. Only after tests pass: run the reviewed SQL migration in Supabase, configure Render environment variables (server-side only), deploy, and smoke-test. Keep rollback plan and JSON export backup.

## Safety status

- This branch is a planning/audit branch only at this point.
- Do not run the draft SQL migration in Supabase yet.
- Do not merge or deploy until the async repository implementation, schema, and tests are complete.
- Existing JSON data is test/demo data per project owner, but still preserve an export before any destructive change.
