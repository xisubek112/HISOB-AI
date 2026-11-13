-- HISOBOT AI: PostgreSQL foundation for the existing custom Node.js auth layer.
-- This migration creates storage only. It does not migrate JSON data or change app code.
-- Run only in the HISOBOT AI Supabase project after reviewing this file.

begin;

create table if not exists public.app_users (
  id text primary key,
  email text not null,
  email_normalized text generated always as (lower(trim(email))) stored,
  password_hash text not null,
  password_salt text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_email_normalized_unique unique (email_normalized)
);

create table if not exists public.app_sessions (
  token_hash text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  last_used_at timestamptz
);

create index if not exists app_sessions_user_id_idx
  on public.app_sessions(user_id);
create index if not exists app_sessions_expires_at_idx
  on public.app_sessions(expires_at);

-- JSONB records preserve the current TypeScript model shape during the
-- staged migration from the synchronous JSON-file Database class.
create table if not exists public.app_data (
  owner_user_id text not null references public.app_users(id) on delete cascade,
  collection text not null check (collection in (
    'transactions', 'categories', 'budgets', 'goals', 'debts',
    'notifications', 'wallets', 'walletTransfers', 'familyGroups',
    'familyMembers', 'familyInvitations', 'subscriptions',
    'recurringTransactions', 'recurringLogs', 'receipts',
    'bankConnections', 'bankSyncLogs', 'telegramConnections'
  )),
  scope_key text not null,
  record_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, collection, scope_key, record_key)
);

create index if not exists app_data_owner_collection_idx
  on public.app_data(owner_user_id, collection);
create index if not exists app_data_payload_gin_idx
  on public.app_data using gin(payload);

-- No direct browser/mobile access: the Node.js server will use the
-- Supabase service-role credential stored only in Render environment secrets.
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_data enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.app_sessions from anon, authenticated;
revoke all on table public.app_data from anon, authenticated;

grant all on table public.app_users to service_role;
grant all on table public.app_sessions to service_role;
grant all on table public.app_data to service_role;

commit;
