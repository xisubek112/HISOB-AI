-- HISOBOT AI — Migration #005: Atomic User Registration & Lookup Indexes
-- Requires Migrations #001-#004.

begin;

create index if not exists app_data_invite_code_idx
  on public.app_data((payload->>'inviteCode'))
  where collection = 'familyInvitations';

create index if not exists app_data_family_member_user_idx
  on public.app_data((payload->>'userId'))
  where collection = 'familyMembers';

create or replace function public.hisobot_register_user_atomic(
  p_user_id text,
  p_email text,
  p_password_hash text,
  p_password_salt text,
  p_profile jsonb,
  p_default_wallet_id text,
  p_default_wallet jsonb,
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
    (p_user_id, 'wallets', p_user_id, p_default_wallet_id, p_default_wallet, v_now, v_now),
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
    jsonb_build_object('emailNormalized', lower(trim(p_email))),
    v_now
  );

  return p_profile;
exception
  when unique_violation then
    raise exception 'Ushbu elektron pochta allaqachon roʻyxatdan oʻtgan';
end;
$$;

revoke all on function public.hisobot_register_user_atomic(text, text, text, text, jsonb, text, jsonb, jsonb, text, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.hisobot_register_user_atomic(text, text, text, text, jsonb, text, jsonb, jsonb, text, jsonb, text, timestamptz) to service_role;

commit;
