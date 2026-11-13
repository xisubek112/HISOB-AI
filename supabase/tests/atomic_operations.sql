-- HISOBOT AI atomic-operation integration checks.
-- Run manually in a NON-PRODUCTION Supabase project after migrations 001-004.
-- Every fixture and write is rolled back. Do not use this as a substitute for
-- running the tests against a disposable staging database.
begin;

do $test$
declare
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_user text := 'test_user_' || v_suffix;
  v_wallet_a text := 'wallet_a_' || v_suffix;
  v_wallet_b text := 'wallet_b_' || v_suffix;
  v_goal text := 'goal_' || v_suffix;
  v_debt text := 'debt_' || v_suffix;
  v_recurring text := 'recurring_' || v_suffix;
  v_transfer jsonb;
  v_retry jsonb;
  v_result jsonb;
  v_balance numeric;
  v_saved numeric;
  v_remaining numeric;
  v_next_date date;
  v_tx_count integer;
begin
  insert into public.app_users (id, email, password_hash, password_salt, profile)
  values (v_user, v_user || '@example.invalid', 'test-only-hash', 'test-only-salt', '{}'::jsonb);

  insert into public.app_data (owner_user_id, collection, scope_key, record_key, payload)
  values
    (v_user, 'wallets', v_user, v_wallet_a,
      jsonb_build_object('id', v_wallet_a, 'userId', v_user, 'name', 'Test source', 'balance', 1000, 'currency', 'UZS', 'isArchived', false)),
    (v_user, 'wallets', v_user, v_wallet_b,
      jsonb_build_object('id', v_wallet_b, 'userId', v_user, 'name', 'Test destination', 'balance', 100, 'currency', 'UZS', 'isArchived', false)),
    (v_user, 'goals', v_user, v_goal,
      jsonb_build_object('id', v_goal, 'userId', v_user, 'name', 'Test goal', 'targetAmount', 1000, 'savedAmount', 200)),
    (v_user, 'debts', v_user, v_debt,
      jsonb_build_object('id', v_debt, 'userId', v_user, 'amount', 1000, 'paidAmount', 200, 'remainingAmount', 800, 'status', 'partial')),
    (v_user, 'recurringTransactions', v_user, v_recurring,
      jsonb_build_object(
        'id', v_recurring, 'userId', v_user, 'type', 'expense', 'amount', 50,
        'currency', 'UZS', 'categoryId', 'test_category', 'categoryName', 'Test',
        'description', 'Staging recurring test', 'paymentMethod', 'card',
        'frequency', 'weekly', 'nextExecutionDate', (current_date - 1)::text,
        'status', 'active', 'walletId', v_wallet_b
      ));

  -- 1) Wallet transfer updates both balances and creates one ledger record.
  v_transfer := public.hisobot_transfer_between_wallets(
    v_user, v_wallet_a, v_wallet_b, 200, 200,
    'transfer_' || v_suffix, current_date::text, 'staging test'
  );
  select (payload->>'balance')::numeric into v_balance
  from public.app_data
  where owner_user_id = v_user and collection = 'wallets' and record_key = v_wallet_a;
  if v_balance <> 800 then raise exception 'Wallet transfer source balance assertion failed: %', v_balance; end if;

  select (payload->>'balance')::numeric into v_balance
  from public.app_data
  where owner_user_id = v_user and collection = 'wallets' and record_key = v_wallet_b;
  if v_balance <> 300 then raise exception 'Wallet transfer destination balance assertion failed: %', v_balance; end if;

  v_retry := public.hisobot_transfer_between_wallets(
    v_user, v_wallet_a, v_wallet_b, 200, 200,
    'transfer_' || v_suffix, current_date::text, 'staging test retry'
  );
  if v_retry->>'id' <> v_transfer->>'id' then
    raise exception 'Wallet transfer idempotency assertion failed';
  end if;

  -- An insufficient-funds transfer must fail and leave balances unchanged.
  begin
    perform public.hisobot_transfer_between_wallets(
      v_user, v_wallet_a, v_wallet_b, 900, 900,
      'transfer_insufficient_' || v_suffix, current_date::text, null
    );
    raise exception 'Expected insufficient wallet balance error was not raised';
  exception when sqlstate '22003' then
    null;
  end;
  select (payload->>'balance')::numeric into v_balance
  from public.app_data
  where owner_user_id = v_user and collection = 'wallets' and record_key = v_wallet_a;
  if v_balance <> 800 then raise exception 'Insufficient transfer changed source balance'; end if;

  -- 2) Goal deposit is applied once for a repeated operation id.
  v_result := public.hisobot_apply_financial_operation(
    v_user, 'goal_op_' || v_suffix, 'goal_deposit', v_goal, 300
  );
  v_retry := public.hisobot_apply_financial_operation(
    v_user, 'goal_op_' || v_suffix, 'goal_deposit', v_goal, 300
  );
  select (payload->>'savedAmount')::numeric into v_saved
  from public.app_data
  where owner_user_id = v_user and collection = 'goals' and record_key = v_goal;
  if v_saved <> 500 then raise exception 'Goal deposit/idempotency assertion failed: %', v_saved; end if;
  if (v_result->>'savedAmount')::numeric <> (v_retry->>'savedAmount')::numeric then
    raise exception 'Goal deposit retry result mismatch';
  end if;

  -- 3) Debt payment updates paid and remaining amounts, and is idempotent.
  perform public.hisobot_apply_financial_operation(
    v_user, 'debt_op_' || v_suffix, 'debt_payment', v_debt, 300
  );
  perform public.hisobot_apply_financial_operation(
    v_user, 'debt_op_' || v_suffix, 'debt_payment', v_debt, 300
  );
  select (payload->>'remainingAmount')::numeric into v_remaining
  from public.app_data
  where owner_user_id = v_user and collection = 'debts' and record_key = v_debt;
  if v_remaining <> 500 then raise exception 'Debt payment assertion failed: %', v_remaining; end if;

  -- 4) Recurring expense writes transaction/log, debits wallet, and advances schedule once.
  v_result := public.hisobot_execute_recurring_transaction(
    v_user, v_recurring, 'recurring_exec_' || v_suffix, now()
  );
  v_retry := public.hisobot_execute_recurring_transaction(
    v_user, v_recurring, 'recurring_exec_' || v_suffix, now()
  );
  if v_result->>'id' <> v_retry->>'id' then
    raise exception 'Recurring execution idempotency assertion failed';
  end if;

  select (payload->>'balance')::numeric into v_balance
  from public.app_data
  where owner_user_id = v_user and collection = 'wallets' and record_key = v_wallet_b;
  if v_balance <> 250 then raise exception 'Recurring wallet balance assertion failed: %', v_balance; end if;

  select (payload->>'nextExecutionDate')::date into v_next_date
  from public.app_data
  where owner_user_id = v_user and collection = 'recurringTransactions' and record_key = v_recurring;
  if v_next_date <> current_date + 6 then
    raise exception 'Recurring next date assertion failed: %', v_next_date;
  end if;

  select count(*) into v_tx_count
  from public.app_data
  where owner_user_id = v_user and collection = 'transactions'
    and record_key = v_result->>'id';
  if v_tx_count <> 1 then raise exception 'Recurring transaction count assertion failed: %', v_tx_count; end if;

  raise notice 'HISOBOT AI atomic-operation tests passed for fixture %', v_suffix;
end;
$test$;

rollback;
