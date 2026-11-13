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
