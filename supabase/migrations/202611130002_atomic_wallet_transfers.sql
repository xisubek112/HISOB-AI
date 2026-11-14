-- HISOBOT AI — Migration #002: Audit logs, Idempotency keys, and Atomic Wallet Transfers
-- Requires Migration #001 (app_users, app_sessions, app_data).

begin;

create table if not exists public.app_idempotency_keys (
  owner_user_id text not null references public.app_users(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  response_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, operation, idempotency_key)
);

create index if not exists app_idempotency_keys_created_idx
  on public.app_idempotency_keys(created_at);

create table if not exists public.app_audit_logs (
  id text primary key,
  owner_user_id text not null references public.app_users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_audit_logs_owner_created_idx
  on public.app_audit_logs(owner_user_id, created_at desc);

alter table public.app_idempotency_keys enable row level security;
alter table public.app_audit_logs enable row level security;

revoke all on table public.app_idempotency_keys from anon, authenticated;
revoke all on table public.app_audit_logs from anon, authenticated;

grant all on table public.app_idempotency_keys to service_role;
grant all on table public.app_audit_logs to service_role;

create or replace function public.hisobot_transfer_between_wallets(
  p_user_id text,
  p_from_wallet_id text,
  p_to_wallet_id text,
  p_amount bigint,
  p_target_amount bigint default null,
  p_notes text default null,
  p_idempotency_key text default null,
  p_today text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cached jsonb;
  v_first_id text;
  v_second_id text;
  v_from_payload jsonb;
  v_to_payload jsonb;
  v_from_balance bigint;
  v_to_balance bigint;
  v_dest_amount bigint;
  v_transfer_id text;
  v_now timestamptz := now();
  v_today text := coalesce(nullif(trim(p_today), ''), to_char(v_now at time zone 'UTC', 'YYYY-MM-DD'));
  v_transfer jsonb;
begin
  if p_user_id is null or trim(p_user_id) = '' then
    raise exception 'Foydalanuvchi aniqlanmadi';
  end if;

  if p_from_wallet_id is null or p_to_wallet_id is null then
    raise exception 'Tanlangan hamyonlar topilmadi';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Bir xil hamyonlar oʻrtasida oʻtkazma qilib boʻlmaydi';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Oʻtkazma summasi noldan katta boʻlishi kerak';
  end if;

  v_dest_amount := coalesce(p_target_amount, p_amount);
  if v_dest_amount <= 0 then
    raise exception 'Qabul qiluvchi summa noldan katta boʻlishi kerak';
  end if;

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'wallet_transfer'
       and idempotency_key = trim(p_idempotency_key)
     for update;

    if found then
      return v_cached;
    end if;
  end if;

  -- Lock wallet rows in deterministic order to avoid deadlocks under concurrency.
  if p_from_wallet_id < p_to_wallet_id then
    v_first_id := p_from_wallet_id;
    v_second_id := p_to_wallet_id;
  else
    v_first_id := p_to_wallet_id;
    v_second_id := p_from_wallet_id;
  end if;

  perform 1
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'wallets'
     and scope_key = p_user_id
     and record_key in (v_first_id, v_second_id)
   order by record_key asc
   for update;

  select payload
    into v_from_payload
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'wallets'
     and scope_key = p_user_id
     and record_key = p_from_wallet_id
     and coalesce((payload->>'isArchived')::boolean, false) = false;

  select payload
    into v_to_payload
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'wallets'
     and scope_key = p_user_id
     and record_key = p_to_wallet_id
     and coalesce((payload->>'isArchived')::boolean, false) = false;

  if v_from_payload is null or v_to_payload is null then
    raise exception 'Tanlangan hamyonlar topilmadi';
  end if;

  v_from_balance := coalesce((v_from_payload->>'balance')::bigint, 0);
  v_to_balance := coalesce((v_to_payload->>'balance')::bigint, 0);

  if v_from_balance < p_amount then
    raise exception 'Manba hamyonda yetarli mablagʻ mavjud emas';
  end if;

  update public.app_data
     set payload = jsonb_set(payload, '{balance}', to_jsonb(v_from_balance - p_amount), true),
         updated_at = v_now
   where owner_user_id = p_user_id
     and collection = 'wallets'
     and scope_key = p_user_id
     and record_key = p_from_wallet_id;

  update public.app_data
     set payload = jsonb_set(payload, '{balance}', to_jsonb(v_to_balance + v_dest_amount), true),
         updated_at = v_now
   where owner_user_id = p_user_id
     and collection = 'wallets'
     and scope_key = p_user_id
     and record_key = p_to_wallet_id;

  v_transfer_id := 'tr_' || replace(gen_random_uuid()::text, '-', '');
  v_transfer := jsonb_build_object(
    'id', v_transfer_id,
    'userId', p_user_id,
    'fromWalletId', p_from_wallet_id,
    'fromWalletName', v_from_payload->>'name',
    'toWalletId', p_to_wallet_id,
    'toWalletName', v_to_payload->>'name',
    'amount', p_amount,
    'targetAmount', v_dest_amount,
    'date', v_today,
    'notes', coalesce(nullif(trim(p_notes), ''), 'Hamyonlararo ichki oʻtkazma'),
    'createdAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
  ) values (
    p_user_id, 'walletTransfers', p_user_id, v_transfer_id, v_transfer, v_now, v_now
  );

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'wallet_transfer',
    'walletTransfers',
    v_transfer_id,
    jsonb_build_object(
      'fromWalletId', p_from_wallet_id,
      'toWalletId', p_to_wallet_id,
      'amount', p_amount,
      'targetAmount', v_dest_amount
    ),
    v_now
  );

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'wallet_transfer', trim(p_idempotency_key), v_transfer, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_transfer;
end;
$$;

revoke all on function public.hisobot_transfer_between_wallets(text, text, text, bigint, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_transfer_between_wallets(text, text, text, bigint, bigint, text, text, text) to service_role;

commit;
