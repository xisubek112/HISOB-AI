-- HISOBOT AI — Migration #003: Atomic Financial Operations (Transactions, Goals, Debts, Budget Alerts)
-- Requires Migrations #001 and #002.

begin;

create index if not exists app_data_collection_scope_idx
  on public.app_data(collection, scope_key);

create or replace function public.hisobot_add_transaction(
  p_user_id text,
  p_tx jsonb,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cached jsonb;
  v_now timestamptz := now();
  v_tx_id text := coalesce(nullif(trim(p_tx->>'id'), ''), 'tx_' || replace(gen_random_uuid()::text, '-', ''));
  v_type text := p_tx->>'type';
  v_amount bigint := round(coalesce((p_tx->>'amount')::numeric, 0))::bigint;
  v_wallet_id text := nullif(trim(coalesce(p_tx->>'walletId', '')), '');
  v_wallet_payload jsonb;
  v_wallet_balance bigint;
  v_new_balance bigint;
  v_tx jsonb;
  v_tx_month text;
  v_cat_id text;
  v_cat_name text;
  v_budget_rec record;
  v_total_spent bigint;
  v_pct int;
  v_notif_id text;
  v_today text := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD');
begin
  if p_user_id is null or trim(p_user_id) = '' then
    raise exception 'Foydalanuvchi aniqlanmadi';
  end if;

  if v_type not in ('income', 'expense') then
    raise exception 'Tranzaksiya turi notoʻgʻri';
  end if;

  if v_amount <= 0 then
    raise exception 'Tranzaksiya summasi noldan katta boʻlishi kerak';
  end if;

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'add_transaction'
       and idempotency_key = trim(p_idempotency_key)
     for update;

    if found then
      return v_cached;
    end if;
  end if;

  if v_wallet_id is not null then
    select payload
      into v_wallet_payload
      from public.app_data
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = v_wallet_id
       and coalesce((payload->>'isArchived')::boolean, false) = false
     for update;

    if v_wallet_payload is null then
      raise exception 'Tanlangan hamyon topilmadi';
    end if;

    v_wallet_balance := coalesce((v_wallet_payload->>'balance')::bigint, 0);
    if v_type = 'income' then
      v_new_balance := v_wallet_balance + v_amount;
    else
      if v_wallet_balance < v_amount then
        raise exception 'Hamyonda yetarli mablagʻ mavjud emas';
      end if;
      v_new_balance := v_wallet_balance - v_amount;
    end if;

    update public.app_data
       set payload = jsonb_set(payload, '{balance}', to_jsonb(v_new_balance), true),
           updated_at = v_now
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = v_wallet_id;
  end if;

  v_tx := p_tx || jsonb_build_object(
    'id', v_tx_id,
    'userId', p_user_id,
    'amount', v_amount,
    'createdAt', coalesce(nullif(p_tx->>'createdAt', ''), to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
  ) values (
    p_user_id, 'transactions', p_user_id, v_tx_id, v_tx, v_now, v_now
  );

  -- Preserve budget threshold alert business rule on expense transactions.
  if v_type = 'expense' and length(coalesce(v_tx->>'date', '')) >= 7 then
    v_tx_month := substring(v_tx->>'date' from 1 for 7);
    v_cat_id := coalesce(v_tx->>'categoryId', '');
    v_cat_name := coalesce(v_tx->>'categoryName', '');

    for v_budget_rec in
      select payload
        from public.app_data
       where owner_user_id = p_user_id
         and collection = 'budgets'
         and scope_key = p_user_id
         and payload->>'month' = v_tx_month
         and (payload->>'categoryId' = v_cat_id or payload->>'categoryName' = v_cat_name)
    loop
      if coalesce((v_budget_rec.payload->>'monthlyLimit')::bigint, 0) > 0 then
        select coalesce(sum((payload->>'amount')::bigint), 0)
          into v_total_spent
          from public.app_data
         where owner_user_id = p_user_id
           and collection = 'transactions'
           and scope_key = p_user_id
           and payload->>'type' = 'expense'
           and substring(coalesce(payload->>'date', '') from 1 for 7) = v_tx_month
           and (payload->>'categoryId' = v_cat_id or payload->>'categoryName' = v_cat_name);

        v_pct := round((v_total_spent::numeric / (v_budget_rec.payload->>'monthlyLimit')::numeric) * 100)::int;
        if v_pct >= coalesce((v_budget_rec.payload->>'alertThreshold')::int, 80) then
          v_notif_id := 'notif_' || replace(gen_random_uuid()::text, '-', '');
          insert into public.app_data (
            owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
          ) values (
            p_user_id,
            'notifications',
            p_user_id,
            v_notif_id,
            jsonb_build_object(
              'id', v_notif_id,
              'userId', p_user_id,
              'title', 'Budjet ogohlantirishi: ' || coalesce(v_budget_rec.payload->>'categoryName', v_cat_name),
              'message', coalesce(v_budget_rec.payload->>'categoryName', v_cat_name) || ' boʻyicha sarf-xarajatingiz belgilangan budjetning ' || v_pct::text || '% qismiga yetdi (' || v_total_spent::text || ' / ' || (v_budget_rec.payload->>'monthlyLimit') || ' soʻm).',
              'type', 'budget_warning',
              'date', v_today,
              'isRead', false,
              'linkTab', 'budgets'
            ),
            v_now,
            v_now
          );
        end if;
      end if;
    end loop;
  end if;

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'add_transaction',
    'transactions',
    v_tx_id,
    jsonb_build_object('type', v_type, 'amount', v_amount, 'walletId', v_wallet_id),
    v_now
  );

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'add_transaction', trim(p_idempotency_key), v_tx, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_tx;
end;
$$;

create or replace function public.hisobot_update_transaction(
  p_user_id text,
  p_tx_id text,
  p_updates jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_existing jsonb;
  v_updated jsonb;
  v_old_type text;
  v_new_type text;
  v_old_amount bigint;
  v_new_amount bigint;
  v_old_wallet_id text;
  v_new_wallet_id text;
  v_wallet_ids text[] := array[]::text[];
  v_w_id text;
  v_w_payload jsonb;
  v_w_balance bigint;
  v_delta bigint;
begin
  select payload
    into v_existing
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'transactions'
     and scope_key = p_user_id
     and record_key = p_tx_id
   for update;

  if v_existing is null then
    raise exception 'Tranzaksiya topilmadi';
  end if;

  v_old_type := v_existing->>'type';
  v_old_amount := coalesce((v_existing->>'amount')::bigint, 0);
  v_old_wallet_id := nullif(trim(coalesce(v_existing->>'walletId', '')), '');

  v_updated := v_existing || (p_updates - 'id' - 'userId' - 'createdAt');
  v_new_type := v_updated->>'type';
  v_new_amount := round(coalesce((v_updated->>'amount')::numeric, v_old_amount))::bigint;
  v_new_wallet_id := nullif(trim(coalesce(v_updated->>'walletId', '')), '');

  if v_new_type not in ('income', 'expense') then
    raise exception 'Tranzaksiya turi notoʻgʻri';
  end if;

  if v_new_amount <= 0 then
    raise exception 'Tranzaksiya summasi noldan katta boʻlishi kerak';
  end if;

  v_updated := v_updated || jsonb_build_object(
    'amount', v_new_amount,
    'updatedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  if v_old_wallet_id is not null then
    v_wallet_ids := array_append(v_wallet_ids, v_old_wallet_id);
  end if;
  if v_new_wallet_id is not null and v_new_wallet_id <> coalesce(v_old_wallet_id, '') then
    v_wallet_ids := array_append(v_wallet_ids, v_new_wallet_id);
  end if;

  if coalesce(array_length(v_wallet_ids, 1), 0) > 0 then
    perform 1
      from public.app_data
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = any(v_wallet_ids)
     order by record_key asc
     for update;

    if v_old_wallet_id is not null and v_old_wallet_id = v_new_wallet_id then
      select payload into v_w_payload
        from public.app_data
       where owner_user_id = p_user_id and collection = 'wallets' and scope_key = p_user_id and record_key = v_old_wallet_id;
      if v_w_payload is not null then
        v_w_balance := coalesce((v_w_payload->>'balance')::bigint, 0);
        -- Reverse old impact and apply new impact
        v_delta := (case when v_old_type = 'income' then -v_old_amount else v_old_amount end)
                 + (case when v_new_type = 'income' then v_new_amount else -v_new_amount end);
        if v_w_balance + v_delta < 0 then
          raise exception 'Hamyonda yetarli mablagʻ mavjud emas';
        end if;
        update public.app_data
           set payload = jsonb_set(payload, '{balance}', to_jsonb(v_w_balance + v_delta), true),
               updated_at = v_now
         where owner_user_id = p_user_id and collection = 'wallets' and scope_key = p_user_id and record_key = v_old_wallet_id;
      end if;
    else
      if v_old_wallet_id is not null then
        select payload into v_w_payload
          from public.app_data
         where owner_user_id = p_user_id and collection = 'wallets' and scope_key = p_user_id and record_key = v_old_wallet_id;
        if v_w_payload is not null then
          v_w_balance := coalesce((v_w_payload->>'balance')::bigint, 0);
          v_delta := case when v_old_type = 'income' then -v_old_amount else v_old_amount end;
          if v_w_balance + v_delta < 0 then
            raise exception 'Oldingi hamyon balansini tuzatib boʻlmadi';
          end if;
          update public.app_data
             set payload = jsonb_set(payload, '{balance}', to_jsonb(v_w_balance + v_delta), true),
                 updated_at = v_now
           where owner_user_id = p_user_id and collection = 'wallets' and scope_key = p_user_id and record_key = v_old_wallet_id;
        end if;
      end if;

      if v_new_wallet_id is not null then
        select payload into v_w_payload
          from public.app_data
         where owner_user_id = p_user_id
           and collection = 'wallets'
           and scope_key = p_user_id
           and record_key = v_new_wallet_id
           and coalesce((payload->>'isArchived')::boolean, false) = false;
        if v_w_payload is null then
          raise exception 'Tanlangan hamyon topilmadi';
        end if;
        v_w_balance := coalesce((v_w_payload->>'balance')::bigint, 0);
        v_delta := case when v_new_type = 'income' then v_new_amount else -v_new_amount end;
        if v_w_balance + v_delta < 0 then
          raise exception 'Hamyonda yetarli mablagʻ mavjud emas';
        end if;
        update public.app_data
           set payload = jsonb_set(payload, '{balance}', to_jsonb(v_w_balance + v_delta), true),
               updated_at = v_now
         where owner_user_id = p_user_id and collection = 'wallets' and scope_key = p_user_id and record_key = v_new_wallet_id;
      end if;
    end if;
  end if;

  update public.app_data
     set payload = v_updated,
         updated_at = v_now
   where owner_user_id = p_user_id
     and collection = 'transactions'
     and scope_key = p_user_id
     and record_key = p_tx_id;

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'update_transaction',
    'transactions',
    p_tx_id,
    jsonb_build_object('oldAmount', v_old_amount, 'newAmount', v_new_amount),
    v_now
  );

  return v_updated;
end;
$$;

create or replace function public.hisobot_delete_transaction(
  p_user_id text,
  p_tx_id text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_existing jsonb;
  v_type text;
  v_amount bigint;
  v_wallet_id text;
  v_wallet_payload jsonb;
  v_wallet_balance bigint;
  v_delta bigint;
begin
  select payload
    into v_existing
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'transactions'
     and scope_key = p_user_id
     and record_key = p_tx_id
   for update;

  if v_existing is null then
    return false;
  end if;

  v_type := v_existing->>'type';
  v_amount := coalesce((v_existing->>'amount')::bigint, 0);
  v_wallet_id := nullif(trim(coalesce(v_existing->>'walletId', '')), '');

  if v_wallet_id is not null then
    select payload
      into v_wallet_payload
      from public.app_data
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = v_wallet_id
     for update;

    if v_wallet_payload is not null then
      v_wallet_balance := coalesce((v_wallet_payload->>'balance')::bigint, 0);
      v_delta := case when v_type = 'income' then -v_amount else v_amount end;
      update public.app_data
         set payload = jsonb_set(payload, '{balance}', to_jsonb(v_wallet_balance + v_delta), true),
             updated_at = v_now
       where owner_user_id = p_user_id
         and collection = 'wallets'
         and scope_key = p_user_id
         and record_key = v_wallet_id;
    end if;
  end if;

  delete from public.app_data
   where owner_user_id = p_user_id
     and collection = 'transactions'
     and scope_key = p_user_id
     and record_key = p_tx_id;

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'delete_transaction',
    'transactions',
    p_tx_id,
    jsonb_build_object('type', v_type, 'amount', v_amount, 'walletId', v_wallet_id),
    v_now
  );

  return true;
end;
$$;

create or replace function public.hisobot_deposit_to_goal(
  p_user_id text,
  p_goal_id text,
  p_amount bigint,
  p_wallet_id text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cached jsonb;
  v_now timestamptz := now();
  v_goal jsonb;
  v_saved bigint;
  v_target bigint;
  v_new_saved bigint;
  v_completed boolean;
  v_was_completed boolean;
  v_wallet_payload jsonb;
  v_wallet_balance bigint;
  v_notif_id text;
  v_today text := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Depozit summasi noldan katta boʻlishi kerak';
  end if;

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'goal_deposit'
       and idempotency_key = trim(p_idempotency_key)
     for update;
    if found then
      return v_cached;
    end if;
  end if;

  if p_wallet_id is not null and trim(p_wallet_id) <> '' then
    select payload
      into v_wallet_payload
      from public.app_data
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = trim(p_wallet_id)
       and coalesce((payload->>'isArchived')::boolean, false) = false
     for update;
    if v_wallet_payload is null then
      raise exception 'Tanlangan hamyon topilmadi';
    end if;
    v_wallet_balance := coalesce((v_wallet_payload->>'balance')::bigint, 0);
    if v_wallet_balance < p_amount then
      raise exception 'Hamyonda yetarli mablagʻ mavjud emas';
    end if;
    update public.app_data
       set payload = jsonb_set(payload, '{balance}', to_jsonb(v_wallet_balance - p_amount), true),
           updated_at = v_now
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = trim(p_wallet_id);
  end if;

  select payload
    into v_goal
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'goals'
     and scope_key = p_user_id
     and record_key = p_goal_id
   for update;

  if v_goal is null then
    raise exception 'Maqsad topilmadi';
  end if;

  v_saved := coalesce((v_goal->>'savedAmount')::bigint, 0);
  v_target := coalesce((v_goal->>'targetAmount')::bigint, 0);
  v_was_completed := coalesce((v_goal->>'isCompleted')::boolean, false);
  v_new_saved := v_saved + p_amount;
  v_completed := v_new_saved >= v_target;

  v_goal := v_goal || jsonb_build_object(
    'savedAmount', v_new_saved,
    'isCompleted', v_completed
  );

  update public.app_data
     set payload = v_goal,
         updated_at = v_now
   where owner_user_id = p_user_id
     and collection = 'goals'
     and scope_key = p_user_id
     and record_key = p_goal_id;

  if v_completed and not v_was_completed then
    v_notif_id := 'notif_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.app_data (
      owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
    ) values (
      p_user_id,
      'notifications',
      p_user_id,
      v_notif_id,
      jsonb_build_object(
        'id', v_notif_id,
        'userId', p_user_id,
        'title', 'Maqsadga erishildi!',
        'message', 'Tabriklaymiz! Siz "' || coalesce(v_goal->>'name', '') || '" uchun koʻzlangan ' || v_target::text || ' soʻm mablagʻni muvaffaqiyatli toʻpladingiz!',
        'type', 'goal_reached',
        'date', v_today,
        'isRead', false,
        'linkTab', 'goals'
      ),
      v_now,
      v_now
    );
  end if;

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'goal_deposit',
    'goals',
    p_goal_id,
    jsonb_build_object('amount', p_amount, 'walletId', p_wallet_id, 'newSaved', v_new_saved),
    v_now
  );

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'goal_deposit', trim(p_idempotency_key), v_goal, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_goal;
end;
$$;

create or replace function public.hisobot_pay_debt(
  p_user_id text,
  p_debt_id text,
  p_payment bigint,
  p_wallet_id text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cached jsonb;
  v_now timestamptz := now();
  v_debt jsonb;
  v_amount bigint;
  v_paid bigint;
  v_remaining bigint;
  v_new_paid bigint;
  v_new_remaining bigint;
  v_status text;
  v_wallet_payload jsonb;
  v_wallet_balance bigint;
begin
  if p_payment is null or p_payment <= 0 then
    raise exception 'Toʻlov summasi noldan katta boʻlishi kerak';
  end if;

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'debt_pay'
       and idempotency_key = trim(p_idempotency_key)
     for update;
    if found then
      return v_cached;
    end if;
  end if;

  select payload
    into v_debt
    from public.app_data
   where owner_user_id = p_user_id
     and collection = 'debts'
     and scope_key = p_user_id
     and record_key = p_debt_id
   for update;

  if v_debt is null then
    raise exception 'Qarz topilmadi';
  end if;

  v_amount := coalesce((v_debt->>'amount')::bigint, 0);
  v_paid := coalesce((v_debt->>'paidAmount')::bigint, 0);
  v_remaining := coalesce((v_debt->>'remainingAmount')::bigint, greatest(0, v_amount - v_paid));

  if v_remaining <= 0 then
    raise exception 'Ushbu qarz allaqachon toʻliq yopilgan';
  end if;

  if p_payment > v_remaining then
    raise exception 'Toʻlov summasi qolgan qarzdan oshmasligi kerak';
  end if;

  if p_wallet_id is not null and trim(p_wallet_id) <> '' then
    select payload
      into v_wallet_payload
      from public.app_data
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = trim(p_wallet_id)
       and coalesce((payload->>'isArchived')::boolean, false) = false
     for update;
    if v_wallet_payload is null then
      raise exception 'Tanlangan hamyon topilmadi';
    end if;
    v_wallet_balance := coalesce((v_wallet_payload->>'balance')::bigint, 0);
    if v_debt->>'type' = 'borrowed' and v_wallet_balance < p_payment then
      raise exception 'Hamyonda yetarli mablagʻ mavjud emas';
    end if;
    update public.app_data
       set payload = jsonb_set(
             payload,
             '{balance}',
             to_jsonb(
               case when v_debt->>'type' = 'borrowed'
                    then v_wallet_balance - p_payment
                    else v_wallet_balance + p_payment
               end
             ),
             true
           ),
           updated_at = v_now
     where owner_user_id = p_user_id
       and collection = 'wallets'
       and scope_key = p_user_id
       and record_key = trim(p_wallet_id);
  end if;

  v_new_paid := v_paid + p_payment;
  v_new_remaining := greatest(0, v_amount - v_new_paid);
  v_status := case when v_new_remaining = 0 then 'paid' else 'partial' end;

  v_debt := v_debt || jsonb_build_object(
    'paidAmount', v_new_paid,
    'remainingAmount', v_new_remaining,
    'status', v_status
  );

  update public.app_data
     set payload = v_debt,
         updated_at = v_now
   where owner_user_id = p_user_id
     and collection = 'debts'
     and scope_key = p_user_id
     and record_key = p_debt_id;

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'debt_pay',
    'debts',
    p_debt_id,
    jsonb_build_object('payment', p_payment, 'remainingAmount', v_new_remaining, 'walletId', p_wallet_id),
    v_now
  );

  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'debt_pay', trim(p_idempotency_key), v_debt, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_debt;
end;
$$;

revoke all on function public.hisobot_add_transaction(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.hisobot_add_transaction(text, jsonb, text) to service_role;

revoke all on function public.hisobot_update_transaction(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.hisobot_update_transaction(text, text, jsonb) to service_role;

revoke all on function public.hisobot_delete_transaction(text, text) from public, anon, authenticated;
grant execute on function public.hisobot_delete_transaction(text, text) to service_role;

revoke all on function public.hisobot_deposit_to_goal(text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_deposit_to_goal(text, text, bigint, text, text) to service_role;

revoke all on function public.hisobot_pay_debt(text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_pay_debt(text, text, bigint, text, text) to service_role;

commit;
