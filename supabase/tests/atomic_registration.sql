-- HISOBOT AI atomic registration integration checks.
-- Run manually in a NON-PRODUCTION Supabase project after migrations 001 and 005.
-- All fixtures and writes are rolled back at the end.
begin;

do $test$
declare
  v_suffix text := replace(gen_random_uuid()::text, '-', '');
  v_user text := 'register_user_' || v_suffix;
  v_duplicate text := 'register_duplicate_' || v_suffix;
  v_email text := 'register_' || v_suffix || '@example.invalid';
  v_token_hash text := md5(gen_random_uuid()::text);
  v_profile jsonb;
  v_wallets jsonb;
  v_telegram jsonb;
  v_notification jsonb;
  v_count integer;
begin
  v_profile := jsonb_build_object(
    'id', v_user, 'email', v_email, 'fullName', 'Registration Test',
    'currency', 'UZS', 'language', 'uz', 'theme', 'light',
    'monthlyBudget', 5000000, 'notificationPrefs', '{}'::jsonb
  );

  v_wallets := jsonb_build_array(
    jsonb_build_object('id', 'wallet_a_' || v_suffix, 'userId', v_user, 'name', 'Asosiy karta', 'type', 'card', 'balance', 0, 'currency', 'UZS'),
    jsonb_build_object('id', 'wallet_b_' || v_suffix, 'userId', v_user, 'name', 'Naqd pul', 'type', 'cash', 'balance', 0, 'currency', 'UZS')
  );

  v_telegram := jsonb_build_object(
    'userId', v_user, 'isConnected', false, 'connectCode', 'HISOBOT-1234',
    'preferences', jsonb_build_object('dailyReport', true, 'weeklyReport', true, 'budgetAlerts', true, 'subscriptionAlerts', true)
  );

  v_notification := jsonb_build_object(
    'id', 'welcome_' || v_suffix, 'userId', v_user,
    'title', 'HISOBOT AI ga xush kelibsiz!',
    'message', 'Registration integration test',
    'type', 'monthly_summary', 'date', current_date::text,
    'isRead', false, 'linkTab', 'dashboard'
  );

  -- Successful registration creates user, hashed-token session and all defaults.
  perform public.hisobot_register_user(
    v_user, v_email, 'test-only-hash', 'test-only-salt',
    v_profile, v_token_hash, v_wallets, v_telegram, v_notification
  );

  select count(*) into v_count from public.app_users where id = v_user;
  if v_count <> 1 then raise exception 'Registration did not create exactly one user'; end if;

  select count(*) into v_count from public.app_sessions
  where token_hash = v_token_hash and user_id = v_user;
  if v_count <> 1 then raise exception 'Registration did not create exactly one session'; end if;

  select count(*) into v_count from public.app_data
  where owner_user_id = v_user and collection = 'wallets';
  if v_count <> 2 then raise exception 'Registration did not create exactly two wallets: %', v_count; end if;

  select count(*) into v_count from public.app_data
  where owner_user_id = v_user and collection in ('telegramConnections', 'notifications');
  if v_count <> 2 then raise exception 'Registration did not create Telegram and welcome defaults'; end if;

  -- Duplicate email must fail without leaving a partial second account.
  begin
    perform public.hisobot_register_user(
      v_duplicate, v_email, 'test-only-hash-2', 'test-only-salt-2',
      jsonb_set(v_profile, '{id}', to_jsonb(v_duplicate)),
      md5(gen_random_uuid()::text),
      jsonb_build_array(
        jsonb_build_object('id', 'wallet_c_' || v_suffix, 'userId', v_duplicate),
        jsonb_build_object('id', 'wallet_d_' || v_suffix, 'userId', v_duplicate)
      ),
      jsonb_set(v_telegram, '{userId}', to_jsonb(v_duplicate)),
      jsonb_set(jsonb_set(v_notification, '{id}', to_jsonb('welcome_duplicate_' || v_suffix)), '{userId}', to_jsonb(v_duplicate))
    );
    raise exception 'Expected duplicate email constraint was not raised';
  exception when unique_violation then
    null;
  end;

  select count(*) into v_count from public.app_users where id = v_duplicate;
  if v_count <> 0 then raise exception 'Duplicate registration left a partial user'; end if;

  select count(*) into v_count from public.app_sessions where user_id = v_duplicate;
  if v_count <> 0 then raise exception 'Duplicate registration left a partial session'; end if;

  select count(*) into v_count from public.app_data where owner_user_id = v_duplicate;
  if v_count <> 0 then raise exception 'Duplicate registration left partial app data'; end if;

  raise notice 'HISOBOT AI atomic-registration tests passed for fixture %', v_suffix;
end;
$test$;

rollback;
