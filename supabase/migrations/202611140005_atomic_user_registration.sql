-- Atomic registration and initial account setup for HISOBOT AI.
-- Apply after migration 001. The function is callable only by the backend service role.

begin;

create or replace function public.hisobot_register_user(
  p_user_id text,
  p_email text,
  p_password_hash text,
  p_password_salt text,
  p_profile jsonb,
  p_token_hash text,
  p_wallets jsonb,
  p_telegram_connection jsonb,
  p_welcome_notification jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet jsonb;
begin
  if nullif(trim(p_user_id), '') is null
     or nullif(trim(p_email), '') is null
     or nullif(trim(p_password_hash), '') is null
     or nullif(trim(p_password_salt), '') is null
     or nullif(trim(p_token_hash), '') is null then
    raise exception 'Required registration fields are missing' using errcode = '22023';
  end if;

  if jsonb_typeof(p_profile) is distinct from 'object'
     or p_profile->>'id' is distinct from p_user_id
     or lower(trim(p_profile->>'email')) is distinct from lower(trim(p_email)) then
    raise exception 'Profile does not match registration identity' using errcode = '22023';
  end if;

  if jsonb_typeof(p_wallets) is distinct from 'array'
     or jsonb_array_length(p_wallets) <> 2 then
    raise exception 'Exactly two initial wallets are required' using errcode = '22023';
  end if;

  if jsonb_typeof(p_telegram_connection) is distinct from 'object'
     or p_telegram_connection->>'userId' is distinct from p_user_id then
    raise exception 'Invalid Telegram connection defaults' using errcode = '22023';
  end if;

  if jsonb_typeof(p_welcome_notification) is distinct from 'object'
     or p_welcome_notification->>'userId' is distinct from p_user_id
     or nullif(p_welcome_notification->>'id', '') is null then
    raise exception 'Invalid welcome notification defaults' using errcode = '22023';
  end if;

  insert into public.app_users (id, email, password_hash, password_salt, profile)
  values (p_user_id, trim(p_email), p_password_hash, p_password_salt, p_profile);

  insert into public.app_sessions (token_hash, user_id)
  values (p_token_hash, p_user_id);

  for v_wallet in select value from jsonb_array_elements(p_wallets)
  loop
    if nullif(v_wallet->>'id', '') is null
       or v_wallet->>'userId' is distinct from p_user_id then
      raise exception 'Invalid initial wallet record' using errcode = '22023';
    end if;

    insert into public.app_data (owner_user_id, collection, scope_key, record_key, payload)
    values (p_user_id, 'wallets', p_user_id, v_wallet->>'id', v_wallet);
  end loop;

  insert into public.app_data (owner_user_id, collection, scope_key, record_key, payload)
  values (p_user_id, 'telegramConnections', p_user_id, p_user_id, p_telegram_connection);

  insert into public.app_data (owner_user_id, collection, scope_key, record_key, payload)
  values (
    p_user_id,
    'notifications',
    p_user_id,
    p_welcome_notification->>'id',
    p_welcome_notification
  );

  return jsonb_build_object('user_id', p_user_id, 'created', true);
end;
$$;

revoke all on function public.hisobot_register_user(text, text, text, text, jsonb, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.hisobot_register_user(text, text, text, text, jsonb, text, jsonb, jsonb, jsonb)
  to service_role;

commit;
