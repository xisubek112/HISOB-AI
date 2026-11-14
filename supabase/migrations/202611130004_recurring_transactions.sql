-- HISOBOT AI — Migration #004: Atomic Recurring Transaction Execution
-- Requires Migrations #001, #002, #003.

begin;

create or replace function public.hisobot_execute_recurring_schedule(
  p_user_id text,
  p_recurring_id text,
  p_idempotency_key text default null,
  p_today text default null,
  p_time text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cached jsonb;
  v_now timestamptz := now();
  v_today text := coalesce(nullif(trim(p_today), ''), to_char(v_now at time zone 'UTC', 'YYYY-MM-DD'));
  v_time text := coalesce(nullif(trim(p_time), ''), to_char(v_now at time zone 'UTC', 'HH24:MI'));
  v_rec jsonb;
  v_tx jsonb;
  v_freq text;
  v_base_date date;
  v_next_date text;
  v_log_id text;
  v_log jsonb;
  v_effective_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if v_effective_key is not null then
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'execute_recurring'
       and idempotency_key = v_effective_key
     for update;
    if found then
      return v_cached;
    end if;
  end if;

  select payload
    into v_rec
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'recurringTransactions'
     and scope_key = p_user_id
     and record_key = p_recurring_id
   for update;

  if v_rec is null then
    raise exception 'Doimiy toʻlov topilmadi';
  end if;

  v_tx := public.hisobot_add_transaction(
    p_user_id,
    jsonb_build_object(
      'type', v_rec->>'type',
      'amount', (v_rec->>'amount')::bigint,
      'categoryId', coalesce(v_rec->>'categoryId', 'cat_custom'),
      'categoryName', coalesce(v_rec->>'categoryName', 'Boshqa'),
      'walletId', v_rec->>'walletId',
      'date', v_today,
      'time', v_time,
      'description', coalesce(v_rec->>'description', '') || ' (Avtomatik qayd)',
      'paymentMethod', coalesce(v_rec->>'paymentMethod', 'card'),
      'notes', 'Rejalashtirilgan toʻlov jadvallari orqali avtomatik kiritildi'
    ),
    null
  );

  v_freq := coalesce(v_rec->>'frequency', 'monthly');
  v_base_date := coalesce(nullif(v_rec->>'nextExecutionDate', '')::date, v_today::date);

  if v_freq = 'weekly' then
    v_next_date := to_char(v_base_date + interval '7 days', 'YYYY-MM-DD');
  elsif v_freq = 'quarterly' then
    v_next_date := to_char(v_base_date + interval '3 months', 'YYYY-MM-DD');
  elsif v_freq = 'yearly' then
    v_next_date := to_char(v_base_date + interval '1 year', 'YYYY-MM-DD');
  else
    v_next_date := to_char(v_base_date + interval '1 month', 'YYYY-MM-DD');
  end if;

  v_rec := v_rec || jsonb_build_object(
    'nextExecutionDate', v_next_date,
    'lastExecutedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  update public.app_data
     set payload = v_rec,
         updated_at = v_now
   where owner_user_id = p_user_id
     and collection = 'recurringTransactions'
     and scope_key = p_user_id
     and record_key = p_recurring_id;

  v_log_id := 'log_' || replace(gen_random_uuid()::text, '-', '');
  v_log := jsonb_build_object(
    'id', v_log_id,
    'userId', p_user_id,
    'recurringId', p_recurring_id,
    'description', v_rec->>'description',
    'amount', (v_rec->>'amount')::bigint,
    'type', v_rec->>'type',
    'executedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status', 'success',
    'message', 'Muvaffaqiyatli tranzaksiya yaratildi'
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
  ) values (
    p_user_id, 'recurringLogs', p_user_id, v_log_id, v_log, v_now, v_now
  );

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'execute_recurring',
    'recurringTransactions',
    p_recurring_id,
    jsonb_build_object('transactionId', v_tx->>'id', 'nextExecutionDate', v_next_date),
    v_now
  );

  if v_effective_key is not null then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'execute_recurring', v_effective_key, v_tx, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_tx;
end;
$$;

revoke all on function public.hisobot_execute_recurring_schedule(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_execute_recurring_schedule(text, text, text, text, text) to service_role;

commit;
