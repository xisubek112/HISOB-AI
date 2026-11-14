-- HISOBOT AI — Migration #006: Dual Starter Wallets & Concurrency-Safe Idempotency Locks
-- Requires Migrations #001-#005.

begin;

-- 1. Replace registration RPC so Supabase creates the exact same two starter wallets as JSON DB
drop function if exists public.hisobot_register_user_atomic(
  text, text, text, text, jsonb, text, jsonb, jsonb, text, jsonb, text, timestamptz
);

create or replace function public.hisobot_register_user_atomic(
  p_user_id text,
  p_email text,
  p_password_hash text,
  p_password_salt text,
  p_profile jsonb,
  p_primary_wallet_id text,
  p_primary_wallet jsonb,
  p_secondary_wallet_id text,
  p_secondary_wallet jsonb,
  p_telegram_record jsonb,
  p_welcome_notif_id text,
  p_welcome_notif jsonb,
  p_token_hash text,
  p_expires_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
begin
  if p_email is null or trim(p_email) = '' then
    raise exception 'Elektron pochta kiritilmagan';
  end if;

  insert into public.app_users (
    id, email, password_hash, password_salt, profile, created_at, updated_at
  ) values (
    p_user_id, trim(p_email), p_password_hash, p_password_salt, p_profile, v_now, v_now
  );

  insert into public.app_data (
    owner_user_id, collection, scope_key, record_key, payload, created_at, updated_at
  ) values
    (p_user_id, 'wallets', p_user_id, p_primary_wallet_id, p_primary_wallet, v_now, v_now),
    (p_user_id, 'wallets', p_user_id, p_secondary_wallet_id, p_secondary_wallet, v_now, v_now),
    (p_user_id, 'telegramConnections', p_user_id, 'default', p_telegram_record, v_now, v_now),
    (p_user_id, 'notifications', p_user_id, p_welcome_notif_id, p_welcome_notif, v_now, v_now);

  insert into public.app_sessions (
    token_hash, user_id, created_at, expires_at, last_used_at
  ) values (
    p_token_hash, p_user_id, v_now, p_expires_at, v_now
  );

  insert into public.app_audit_logs (
    id, owner_user_id, action, entity_type, entity_id, details, created_at
  ) values (
    'aud_' || replace(gen_random_uuid()::text, '-', ''),
    p_user_id,
    'register_user',
    'app_users',
    p_user_id,
    jsonb_build_object('emailNormalized', lower(trim(p_email)), 'starterWallets', 2),
    v_now
  );

  return p_profile;
exception
  when unique_violation then
    raise exception 'Ushbu elektron pochta allaqachon roʻyxatdan oʻtgan';
end;
$$;

revoke all on function public.hisobot_register_user_atomic(
  text, text, text, text, jsonb, text, jsonb, text, jsonb, jsonb, text, jsonb, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.hisobot_register_user_atomic(
  text, text, text, text, jsonb, text, jsonb, text, jsonb, jsonb, text, jsonb, text, timestamptz
) to service_role;

-- 2. Harden idempotency RPCs with transaction-scoped advisory locks to prevent concurrent double-submit races
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
  v_clean_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
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

  if v_clean_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_user_id || ':wallet_transfer:' || v_clean_key));
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'wallet_transfer'
       and idempotency_key = v_clean_key
     for update;

    if found then
      return v_cached;
    end if;
  end if;

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

  if v_clean_key is not null then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'wallet_transfer', v_clean_key, v_transfer, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_transfer;
end;
$$;

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
  v_clean_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
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

  if v_clean_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_user_id || ':add_transaction:' || v_clean_key));
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'add_transaction'
       and idempotency_key = v_clean_key
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

  if v_clean_key is not null then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'add_transaction', v_clean_key, v_tx, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_tx;
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
  v_clean_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Depozit summasi noldan katta boʻlishi kerak';
  end if;

  if v_clean_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_user_id || ':goal_deposit:' || v_clean_key));
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'goal_deposit'
       and idempotency_key = v_clean_key
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

  if v_clean_key is not null then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'goal_deposit', v_clean_key, v_goal, v_now
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
  v_clean_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
begin
  if p_payment is null or p_payment <= 0 then
    raise exception 'Toʻlov summasi noldan katta boʻlishi kerak';
  end if;

  if v_clean_key is not null then
    perform pg_advisory_xact_lock(hashtext(p_user_id || ':debt_pay:' || v_clean_key));
    select response_payload
      into v_cached
      from public.app_idempotency_keys
     where owner_user_id = p_user_id
       and operation = 'debt_pay'
       and idempotency_key = v_clean_key
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

  if v_clean_key is not null then
    insert into public.app_idempotency_keys (
      owner_user_id, operation, idempotency_key, response_payload, created_at
    ) values (
      p_user_id, 'debt_pay', v_clean_key, v_debt, v_now
    )
    on conflict (owner_user_id, operation, idempotency_key) do nothing;
  end if;

  return v_debt;
end;
$$;

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
    perform pg_advisory_xact_lock(hashtext(p_user_id || ':execute_recurring:' || v_effective_key));
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

revoke all on function public.hisobot_transfer_between_wallets(text, text, text, bigint, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_transfer_between_wallets(text, text, text, bigint, bigint, text, text, text) to service_role;

revoke all on function public.hisobot_add_transaction(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.hisobot_add_transaction(text, jsonb, text) to service_role;

revoke all on function public.hisobot_deposit_to_goal(text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_deposit_to_goal(text, text, bigint, text, text) to service_role;

revoke all on function public.hisobot_pay_debt(text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_pay_debt(text, text, bigint, text, text) to service_role;

revoke all on function public.hisobot_execute_recurring_schedule(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.hisobot_execute_recurring_schedule(text, text, text, text, text) to service_role;

commit;
