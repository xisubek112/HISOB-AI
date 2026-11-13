-- Atomic recurring transaction execution: transaction, wallet balance,
-- schedule advancement and execution log commit or roll back together.
begin;

create table if not exists public.app_recurring_executions (
  owner_user_id text not null references public.app_users(id) on delete cascade,
  execution_id text not null,
  recurring_id text not null,
  scheduled_for date not null,
  transaction_payload jsonb not null,
  log_payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, execution_id),
  unique (owner_user_id, recurring_id, scheduled_for)
);

alter table public.app_recurring_executions enable row level security;
revoke all on table public.app_recurring_executions from anon, authenticated;
grant all on table public.app_recurring_executions to service_role;

create or replace function public.hisobot_execute_recurring_transaction(
  p_user_id text,
  p_recurring_id text,
  p_execution_id text,
  p_executed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rec_row public.app_data%rowtype;
  v_wallet_row public.app_data%rowtype;
  v_rec jsonb;
  v_tx jsonb;
  v_log jsonb;
  v_execution public.app_recurring_executions%rowtype;
  v_amount numeric;
  v_balance numeric;
  v_next_date date;
  v_scheduled_for date;
  v_type text;
  v_wallet_id text;
  v_tx_id text;
  v_now timestamptz := coalesce(p_executed_at, now());
begin
  if p_user_id is null or length(trim(p_user_id)) = 0
     or p_recurring_id is null or length(trim(p_recurring_id)) = 0
     or p_execution_id is null or length(trim(p_execution_id)) = 0 then
    raise exception 'Recurring execution identifiers are required' using errcode = '22023';
  end if;

  select * into v_execution
  from public.app_recurring_executions
  where owner_user_id = p_user_id and execution_id = p_execution_id;
  if found then
    if v_execution.recurring_id <> p_recurring_id then
      raise exception 'Execution id was already used for another schedule' using errcode = '23505';
    end if;
    return v_execution.transaction_payload;
  end if;

  select * into v_rec_row
  from public.app_data
  where owner_user_id = p_user_id
    and collection = 'recurringTransactions'
    and scope_key = p_user_id
    and record_key = p_recurring_id
  for update;

  if v_rec_row.owner_user_id is null then
    raise exception 'Recurring schedule was not found' using errcode = 'P0002';
  end if;

  v_rec := v_rec_row.payload;
  if v_rec->>'status' <> 'active' then
    raise exception 'Recurring schedule is paused' using errcode = '22023';
  end if;

  v_scheduled_for := (v_rec->>'nextExecutionDate')::date;
  if v_scheduled_for > (v_now at time zone 'UTC')::date then
    raise exception 'Recurring schedule is not due yet' using errcode = '22023';
  end if;

  v_amount := (v_rec->>'amount')::numeric;
  v_type := v_rec->>'type';
  if v_amount <= 0 or v_amount <> round(v_amount) or v_type not in ('income', 'expense') then
    raise exception 'Recurring schedule has invalid amount or transaction type' using errcode = '22023';
  end if;

  -- Same recurring schedule/date cannot be executed twice, even with a new request ID.
  select * into v_execution
  from public.app_recurring_executions
  where owner_user_id = p_user_id
    and recurring_id = p_recurring_id
    and scheduled_for = v_scheduled_for;
  if found then
    return v_execution.transaction_payload;
  end if;

  v_wallet_id := nullif(v_rec->>'walletId', '');
  if v_wallet_id is not null then
    select * into v_wallet_row
    from public.app_data
    where owner_user_id = p_user_id
      and collection = 'wallets'
      and scope_key = p_user_id
      and record_key = v_wallet_id
    for update;

    if v_wallet_row.owner_user_id is null then
      raise exception 'Recurring payment wallet was not found' using errcode = 'P0002';
    end if;
    if coalesce((v_wallet_row.payload->>'isArchived')::boolean, false) then
      raise exception 'Archived wallet cannot be used for recurring transactions' using errcode = '22023';
    end if;

    v_balance := (v_wallet_row.payload->>'balance')::numeric;
    if v_type = 'expense' and v_balance < v_amount then
      raise exception 'Insufficient wallet balance for recurring expense' using errcode = '22003';
    end if;

    update public.app_data
    set payload = jsonb_set(
      payload, '{balance}',
      to_jsonb(case when v_type = 'income' then v_balance + v_amount else v_balance - v_amount end),
      true
    ), updated_at = now()
    where owner_user_id = p_user_id
      and collection = 'wallets'
      and scope_key = p_user_id
      and record_key = v_wallet_id;
  end if;

  v_tx_id := 'tx_' || replace(p_execution_id, '-', '_');
  v_tx := jsonb_build_object(
    'id', v_tx_id,
    'userId', p_user_id,
    'type', v_type,
    'amount', v_amount,
    'currency', v_rec->>'currency',
    'categoryId', v_rec->>'categoryId',
    'categoryName', v_rec->>'categoryName',
    'walletId', v_wallet_id,
    'date', (v_now at time zone 'UTC')::date::text,
    'time', to_char(v_now at time zone 'UTC', 'HH24:MI'),
    'description', coalesce(v_rec->>'description', 'Recurring transaction') || ' (Avtomatik qayd)',
    'paymentMethod', v_rec->>'paymentMethod',
    'notes', 'Rejalashtirilgan toʻlov jadvallari orqali avtomatik kiritildi',
    'createdAt', v_now
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload
  ) values (
    p_user_id, 'transactions', p_user_id, v_tx_id, v_tx
  );

  v_next_date := case v_rec->>'frequency'
    when 'weekly' then v_scheduled_for + interval '7 days'
    when 'monthly' then (v_scheduled_for + interval '1 month')::date
    when 'quarterly' then (v_scheduled_for + interval '3 months')::date
    when 'yearly' then (v_scheduled_for + interval '1 year')::date
    else null
  end;
  if v_next_date is null then
    raise exception 'Unsupported recurring frequency' using errcode = '22023';
  end if;

  update public.app_data
  set payload = jsonb_set(
    jsonb_set(payload, '{nextExecutionDate}', to_jsonb(v_next_date::text), true),
    '{lastExecutedAt}', to_jsonb(v_now), true
  ), updated_at = now()
  where owner_user_id = p_user_id
    and collection = 'recurringTransactions'
    and scope_key = p_user_id
    and record_key = p_recurring_id;

  v_log := jsonb_build_object(
    'id', 'log_' || replace(p_execution_id, '-', '_'),
    'userId', p_user_id,
    'recurringId', p_recurring_id,
    'description', v_rec->>'description',
    'amount', v_amount,
    'type', v_type,
    'executedAt', v_now,
    'status', 'success',
    'message', 'Muvaffaqiyatli tranzaksiya yaratildi'
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload
  ) values (
    p_user_id, 'recurringLogs', p_user_id,
    'log_' || replace(p_execution_id, '-', '_'), v_log
  );

  insert into public.app_recurring_executions (
    owner_user_id, execution_id, recurring_id, scheduled_for,
    transaction_payload, log_payload
  ) values (
    p_user_id, p_execution_id, p_recurring_id, v_scheduled_for, v_tx, v_log
  );

  return v_tx;
end;
$$;

revoke all on function public.hisobot_execute_recurring_transaction(text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.hisobot_execute_recurring_transaction(text,text,text,timestamptz) to service_role;

commit;
