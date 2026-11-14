-- Atomic wallet transfer for the JSONB-backed wallet records.
-- A single PostgreSQL function call locks both wallet rows and writes the
-- transfer ledger row in the same transaction.
begin;

create or replace function public.hisobot_transfer_between_wallets(
  p_user_id text,
  p_from_wallet_id text,
  p_to_wallet_id text,
  p_amount numeric,
  p_target_amount numeric,
  p_transfer_id text,
  p_date text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from public.app_data%rowtype;
  v_to public.app_data%rowtype;
  v_from_balance numeric;
  v_to_balance numeric;
  v_transfer jsonb;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0
     or p_from_wallet_id is null or length(trim(p_from_wallet_id)) = 0
     or p_to_wallet_id is null or length(trim(p_to_wallet_id)) = 0
     or p_transfer_id is null or length(trim(p_transfer_id)) = 0 then
    raise exception 'Transfer identifiers are required' using errcode = '22023';
  end if;

  if p_from_wallet_id = p_to_wallet_id then
    raise exception 'Source and destination wallets must differ' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 or p_target_amount is null or p_target_amount <= 0 then
    raise exception 'Transfer amounts must be greater than zero' using errcode = '22023';
  end if;

  if p_amount <> round(p_amount) or p_target_amount <> round(p_target_amount) then
    raise exception 'Transfer amounts must be whole numbers' using errcode = '22023';
  end if;
  if p_date is null or length(trim(p_date)) = 0 then
    raise exception 'Transfer date is required' using errcode = '22023';
  end if;

  -- Idempotency: a retry with the same transfer id returns the existing ledger entry.
  select payload into v_transfer
  from public.app_data
  where owner_user_id = p_user_id
    and collection = 'walletTransfers'
    and scope_key = p_user_id
    and record_key = p_transfer_id;

  if found then
    if v_transfer->>'fromWalletId' is distinct from p_from_wallet_id
       or v_transfer->>'toWalletId' is distinct from p_to_wallet_id
       or (v_transfer->>'amount')::numeric is distinct from p_amount
       or (v_transfer->>'targetAmount')::numeric is distinct from p_target_amount
       or v_transfer->>'date' is distinct from p_date
       or v_transfer->>'notes' is distinct from coalesce(p_notes, 'Hamyonlararo ichki oʻtkazma') then
      raise exception 'Transfer id was already used for a different operation' using errcode = '23505';
    end if;
    return v_transfer;
  end if;

  -- Lock both wallet rows in deterministic order to avoid deadlocks.
  perform 1
  from public.app_data
  where owner_user_id = p_user_id
    and collection = 'wallets'
    and scope_key = p_user_id
    and record_key in (p_from_wallet_id, p_to_wallet_id)
  order by record_key
  for update;

  -- Recheck idempotency after acquiring wallet locks. This closes the race
  -- where two concurrent retries both passed the first existence check.
  select payload into v_transfer
  from public.app_data
  where owner_user_id = p_user_id
    and collection = 'walletTransfers'
    and scope_key = p_user_id
    and record_key = p_transfer_id;

  if found then
    if v_transfer->>'fromWalletId' is distinct from p_from_wallet_id
       or v_transfer->>'toWalletId' is distinct from p_to_wallet_id
       or (v_transfer->>'amount')::numeric is distinct from p_amount
       or (v_transfer->>'targetAmount')::numeric is distinct from p_target_amount
       or v_transfer->>'date' is distinct from p_date
       or v_transfer->>'notes' is distinct from coalesce(p_notes, 'Hamyonlararo ichki oʻtkazma') then
      raise exception 'Transfer id was already used for a different operation' using errcode = '23505';
    end if;
    return v_transfer;
  end if;

  select * into v_from
  from public.app_data
  where owner_user_id = p_user_id
    and collection = 'wallets'
    and scope_key = p_user_id
    and record_key = p_from_wallet_id;

  select * into v_to
  from public.app_data
  where owner_user_id = p_user_id
    and collection = 'wallets'
    and scope_key = p_user_id
    and record_key = p_to_wallet_id;

  if v_from.owner_user_id is null or v_to.owner_user_id is null then
    raise exception 'Selected wallets were not found' using errcode = 'P0002';
  end if;

  if coalesce((v_from.payload->>'isArchived')::boolean, false)
     or coalesce((v_to.payload->>'isArchived')::boolean, false) then
    raise exception 'Archived wallets cannot be used for transfers' using errcode = '22023';
  end if;

  if coalesce(trim(v_from.payload->>'balance'), '') = ''
     or coalesce(trim(v_to.payload->>'balance'), '') = '' then
    raise exception 'Wallet balance is missing' using errcode = '22023';
  end if;
  v_from_balance := (v_from.payload->>'balance')::numeric;
  v_to_balance := (v_to.payload->>'balance')::numeric;

  if v_from_balance < 0 or v_to_balance < 0 then
    raise exception 'Wallet balance cannot be negative' using errcode = '22023';
  end if;
  if v_from_balance < p_amount then
    raise exception 'Insufficient wallet balance' using errcode = '22003';
  end if;

  update public.app_data
  set payload = jsonb_set(payload, '{balance}', to_jsonb(v_from_balance - p_amount), true),
      updated_at = now()
  where owner_user_id = p_user_id
    and collection = 'wallets'
    and scope_key = p_user_id
    and record_key = p_from_wallet_id;

  update public.app_data
  set payload = jsonb_set(payload, '{balance}', to_jsonb(v_to_balance + p_target_amount), true),
      updated_at = now()
  where owner_user_id = p_user_id
    and collection = 'wallets'
    and scope_key = p_user_id
    and record_key = p_to_wallet_id;

  v_transfer := jsonb_build_object(
    'id', p_transfer_id,
    'userId', p_user_id,
    'fromWalletId', p_from_wallet_id,
    'fromWalletName', v_from.payload->>'name',
    'toWalletId', p_to_wallet_id,
    'toWalletName', v_to.payload->>'name',
    'amount', p_amount,
    'targetAmount', p_target_amount,
    'date', p_date,
    'notes', coalesce(p_notes, 'Hamyonlararo ichki oʻtkazma'),
    'createdAt', now()
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload
  ) values (
    p_user_id, 'walletTransfers', p_user_id, p_transfer_id, v_transfer
  );

  return v_transfer;
end;
$$;

revoke all on function public.hisobot_transfer_between_wallets(text,text,text,numeric,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.hisobot_transfer_between_wallets(text,text,text,numeric,numeric,text,text,text) to service_role;

commit;
