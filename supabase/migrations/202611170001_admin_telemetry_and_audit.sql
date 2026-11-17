-- HISOBOT AI — Migration #007: Admin Audit Logs, AI/API Telemetry, Subscription Ledger & App Config
-- Requires Migrations #001-#006.

begin;

create table if not exists public.admin_audit_logs (
  id text primary key,
  admin_user_id text not null references public.app_users(id) on delete cascade,
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_action_idx
  on public.admin_audit_logs(action, created_at desc);

create table if not exists public.ai_usage_events (
  id text primary key,
  user_id text references public.app_users(id) on delete set null,
  endpoint text not null,
  model text not null,
  source text not null check (source in ('gemini', 'fallback')),
  status text not null check (status in ('success', 'fallback', 'error')),
  latency_ms integer not null default 0,
  prompt_chars integer not null default 0,
  completion_chars integer not null default 0,
  language text not null default 'uz',
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_created_idx
  on public.ai_usage_events(created_at desc);
create index if not exists ai_usage_events_source_idx
  on public.ai_usage_events(source, created_at desc);

create table if not exists public.api_error_events (
  id text primary key,
  user_id text references public.app_users(id) on delete set null,
  method text not null,
  path text not null,
  status_code integer not null,
  error_message text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_error_events_created_idx
  on public.api_error_events(created_at desc);

create table if not exists public.subscription_events (
  id text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'business')),
  previous_plan text not null check (previous_plan in ('free', 'pro', 'business')),
  amount_uzs bigint not null default 0,
  currency text not null default 'UZS',
  source text not null check (source in ('admin_grant', 'checkout', 'system')),
  actor_user_id text not null,
  duration_months integer not null default 1,
  expires_at text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_created_idx
  on public.subscription_events(created_at desc);
create index if not exists subscription_events_user_idx
  on public.subscription_events(user_id, created_at desc);

create table if not exists public.app_runtime_config (
  config_key text primary key,
  config_value jsonb not null,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.api_error_events enable row level security;
alter table public.subscription_events enable row level security;
alter table public.app_runtime_config enable row level security;

revoke all on table public.admin_audit_logs from anon, authenticated;
revoke all on table public.ai_usage_events from anon, authenticated;
revoke all on table public.api_error_events from anon, authenticated;
revoke all on table public.subscription_events from anon, authenticated;
revoke all on table public.app_runtime_config from anon, authenticated;

grant all on table public.admin_audit_logs to service_role;
grant all on table public.ai_usage_events to service_role;
grant all on table public.api_error_events to service_role;
grant all on table public.subscription_events to service_role;
grant all on table public.app_runtime_config to service_role;

commit;
