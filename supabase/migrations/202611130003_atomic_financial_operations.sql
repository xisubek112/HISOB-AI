-- Atomic, idempotent goal deposits and debt payments.
-- All writes are scoped to the authenticated application user ID supplied by
-- the trusted Node.js service-role backend.
begin;

create table if not exists public.app_operations (
  owner_user_id text not null references public.app_users(id) on delete cascade,
  operation_id text not null,
  operation_type text not null check (operation_type in ('goal_deposit', 'debt_payment')),
  target_record_id text not null,
  amount numeric not null check (amount > 0),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, operation_id)
);

alter table public.app_operations enable row level security;
revoke all on table public.app_operations from anon, authenticated;
grant all on table public.app_operations to service_role;

create or replace function public.hisobot_apply_financial_operation(
  p_user_id text,
  p_operation_id text,
  p_operation_type text,
  p_target_record_id text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.app_operations%rowtype;
  v_record public.app_data%rowtype;
  v_payload jsonb;
  v_current numeric;
  v_next numeric;
  v_key text;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0
     or p_operation_id is null or length(trim(p_operation_id)) = 0
     or p_target_record_id is null or length(trim(p_target_record_id)) = 0 then
    raise exception 'Operation identifiers are required' using errcode = '22023';
  end if;
  if p_operation_type is null or p_operation_type not in ('goal_deposit', 'debt_payment') then
    raise exception 'Unsupported financial operation' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount) then
    raise exception 'Amount must be a positive whole number' using errcode = '22023';
  end if;

  select * into v_existing
  from public.app_operations
  where owner_user_id = p_user_id and operation_id = p_operation_id;

  if found then
    if v_existing.operation_type <> p_operation_type
       or v_existing.target_record_id <> p_target_record_id
       or v_existing.amount <> p_amount then
      raise exception 'Operation id was already used for a different request' using errcode = '23505';
    end if;
    return v_existing.result;
  end if;

  if p_operation_type = 'goal_deposit' then
    v_key := 'goals';
  else
    v_key := 'debts';
  end if;

  select * into v_record
  from public.app_data
  where owner_user_id = p_user_id
    and collection = v_key
    and scope_key = p_user_id
    and record_key = p_target_record_id
  for update;

  if v_record.owner_user_id is null then
    raise exception 'Financial record was not found' using errcode = 'P0002';
  end if;

  -- Recheck after locking the target row so concurrent retries cannot apply
  -- the same deposit/payment twice.
  select * into v_existing
  from public.app_operations
  where owner_user_id = p_user_id and operation_id = p_operation_id;

  if found then
    if v_existing.operation_type <> p_operation_type
       or v_existing.target_record_id <> p_target_record_id
       or v_existing.amount <> p_amount then
      raise exception 'Operation id was already used for a different request' using errcode = '23505';
    end if;
    return v_existing.result;
  end if;

  v_payload := v_record.payload;

  if p_operation_type = 'goal_deposit' then
    v_current := coalesce((v_payload->>'savedAmount')::numeric, 0);
    v_next := v_current + p_amount;
    v_payload := jsonb_set(v_payload, '{savedAmount}', to_jsonb(v_next), true);
    v_payload := jsonb_set(
      v_payload,
      '{isCompleted}',
      to_jsonb(v_next >= coalesce((v_payload->>'targetAmount')::numeric, 0)),
      true
    );
  else
    v_current := coalesce((v_payload->>'remainingAmount')::numeric, 0);
    if p_amount > v_current then
      raise exception 'Payment exceeds remaining debt' using errcode = '22003';
    end if;
    v_payload := jsonb_set(
      v_payload,
      '{paidAmount}',
      to_jsonb(coalesce((v_payload->>'paidAmount')::numeric, 0) + p_amount),
      true
    );
    v_next := v_current - p_amount;
    v_payload := jsonb_set(v_payload, '{remainingAmount}', to_jsonb(v_next), true);
    v_payload := jsonb_set(
      v_payload,
      '{status}',
      to_jsonb(case when v_next = 0 then 'paid' else 'partial' end),
      true
    );
  end if;

  update public.app_data
  set payload = v_payload, updated_at = now()
  where owner_user_id = p_user_id
    and collection = v_key
    and scope_key = p_user_id
    and record_key = p_target_record_id;

  insert into public.app_operations (
    owner_user_id, operation_id, operation_type, target_record_id, amount, result
  ) values (
    p_user_id, p_operation_id, p_operation_type, p_target_record_id, p_amount, v_payload
  );

  return v_payload;
end;
$$;

revoke all on function public.hisobot_apply_financial_operation(text,text,text,text,numeric) from public, anon, authenticated;
grant execute on function public.hisobot_apply_financial_operation(text,text,text,text,numeric) to service_role;

commit;
