-- Executable Day 2 membership + CRM isolation checks for the disposable local stack.
-- Uses synthetic @day2.test users and day2-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day2_seed_auth_user(p_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  if exists (select 1 from auth.users where id = p_id) then
    update auth.users
    set email = p_email,
        email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = p_id;
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  begin
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      p_id,
      jsonb_build_object('sub', p_id::text, 'email', p_email),
      'email',
      p_id::text,
      now(),
      now(),
      now()
    );
  exception
    when unique_violation then
      null;
  end;
end;
$$;

create or replace function pg_temp.sts_day2_as_postgres()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day2_impersonate(p_user_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', p_email, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated', 'email', p_email, 'aud', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end;
$$;

create or replace function pg_temp.sts_day2_as_anon()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

create or replace function pg_temp.sts_day2_expect(p_ok boolean, p_name text)
returns void
language plpgsql
as $$
begin
  if not p_ok then
    raise exception 'day2 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day2_expect_exception(p_sql text, p_name text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day2 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day2_expect_denied_or_zero(p_sql text, p_name text)
returns void
language plpgsql
as $$
declare
  n integer;
begin
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then
      raise notice 'PASS % (permission denied)', p_name;
      return;
    when others then
      if sqlerrm ilike '%permission denied%' or sqlerrm ilike '%not authorized%' then
        raise notice 'PASS % (denied)', p_name;
        return;
      end if;
      raise;
  end;
  if n = 0 then
    raise notice 'PASS % (zero rows)', p_name;
    return;
  end if;
  raise exception 'day2 isolation failed: % (got % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day2_expect_blocked_write(p_sql text, p_name text)
returns void
language plpgsql
as $$
declare
  n integer;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception
    when others then
      raise notice 'PASS % (error)', p_name;
      return;
  end;
  if n = 0 then
    raise notice 'PASS % (zero rows)', p_name;
    return;
  end if;
  raise exception 'day2 isolation failed: % (wrote % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'c1111111-1111-4111-8111-111111111111';
  owner_b uuid := 'c2222222-2222-4222-8222-222222222222';
  admin_a uuid := 'c3333333-3333-4333-8333-333333333333';
  member_a uuid := 'c4444444-4444-4444-8444-444444444444';
  stranger uuid := 'c5555555-5555-4555-8555-555555555555';
  org_a uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  org_b uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  n integer;
  privileged boolean;
  client_id uuid;
  lead_id uuid;
begin
  if to_regclass('public.crm_clients') is null or to_regclass('public.crm_leads') is null then
    raise exception 'day2 isolation aborted: CRM tables are missing';
  end if;

  perform pg_temp.sts_day2_as_postgres();
  delete from public.organizations where slug like 'day2-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day2_seed_auth_user(owner_a, 'owner-a@day2.test');
  perform pg_temp.sts_day2_seed_auth_user(owner_b, 'owner-b@day2.test');
  perform pg_temp.sts_day2_seed_auth_user(admin_a, 'admin-a@day2.test');
  perform pg_temp.sts_day2_seed_auth_user(member_a, 'member-a@day2.test');
  perform pg_temp.sts_day2_seed_auth_user(stranger, 'stranger@day2.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day2 Test Org A', 'Org A', 'day2-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day2 Test Org B', 'Org B', 'day2-test-org-b', 'USD', 'America/Chicago', 1);

  insert into public.business_settings (organization_id)
  values (org_a), (org_b)
  on conflict (organization_id) do nothing;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, accepted_at
  ) values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, admin_a, 'administrator', 'active', now(), now()),
    (org_a, member_a, 'employee', 'active', now(), now());

  perform pg_temp.sts_day2_as_anon();
  perform pg_temp.sts_day2_expect_denied_or_zero('select count(*) from public.crm_clients', 'anon cannot select crm_clients');
  perform pg_temp.sts_day2_expect_denied_or_zero('select count(*) from public.crm_leads', 'anon cannot select crm_leads');
  perform pg_temp.sts_day2_expect_exception('select public.is_phase1_owner()', 'anon cannot execute is_phase1_owner');

  perform pg_temp.sts_day2_impersonate(stranger, 'stranger@day2.test');
  select public.is_phase1_owner() into privileged;
  perform pg_temp.sts_day2_expect(privileged = false, 'authenticated user without membership is not privileged');
  perform pg_temp.sts_day2_expect_denied_or_zero('select count(*) from public.crm_clients', 'stranger cannot select crm_clients');
  perform pg_temp.sts_day2_expect_exception(
    format(
      'select public.sts_save_crm_client(%L::uuid, null, %L, %L, %L, %L, %L, %L, %L)',
      org_a, 'No Access', 'X', '', '', '', 'active', ''
    ),
    'stranger cannot save a client'
  );

  perform pg_temp.sts_day2_impersonate(member_a, 'member-a@day2.test');
  select public.is_phase1_owner() into privileged;
  perform pg_temp.sts_day2_expect(privileged = false, 'employee member is not privileged for Phase 1 owner tables');
  select public.sts_save_crm_client(org_a, null, 'Member Client', 'Casey', '', '', 'Auto', 'active', '') into client_id;
  perform pg_temp.sts_day2_expect(client_id is not null, 'employee can save a client in their organization');
  execute 'select count(*) from public.crm_clients' into n;
  perform pg_temp.sts_day2_expect(n = 1, 'employee sees the org A client');
  perform pg_temp.sts_day2_expect_exception(
    format(
      'select public.sts_save_crm_client(%L::uuid, null, %L, %L, %L, %L, %L, %L, %L)',
      org_b, 'Cross Org', 'X', '', '', '', 'active', ''
    ),
    'employee cannot save a client in another organization'
  );

  perform pg_temp.sts_day2_impersonate(owner_a, 'owner-a@day2.test');
  select public.is_phase1_owner() into privileged;
  perform pg_temp.sts_day2_expect(privileged = true, 'org A owner is privileged without an email comparison');
  select public.sts_save_crm_lead(
    org_a, null, 'Owner Lead', 'Riley', '', '', 'Manual', 'Site', 150000, 25, 'new_inquiry',
    null, null, 0, 0, 0, '', 'Owner'
  ) into lead_id;
  perform pg_temp.sts_day2_expect(lead_id is not null, 'owner can save a lead');
  execute 'select count(*) from public.crm_leads' into n;
  perform pg_temp.sts_day2_expect(n = 1, 'owner sees org A leads');
  perform pg_temp.sts_day2_expect_exception(
    format(
      'select public.sts_save_crm_lead(%L::uuid, null, %L, %L, %L, %L, %L, %L, 1, 10, %L, null, null, 0, 0, 0, %L, %L)',
      org_b, 'Hijack Lead', '', '', '', 'Manual', '', 'new_inquiry', '', 'Owner'
    ),
    'owner A cannot save a lead in org B'
  );
  perform pg_temp.sts_day2_expect_exception(
    format(
      'select public.sts_save_crm_client(%L::uuid, null, %L, %L, %L, %L, %L, %L, %L)',
      org_a, 'X', '', '', '', '', 'active', ''
    ),
    'malformed client write is rejected'
  );

  perform pg_temp.sts_day2_impersonate(admin_a, 'admin-a@day2.test');
  select public.is_phase1_owner() into privileged;
  perform pg_temp.sts_day2_expect(privileged = true, 'org A administrator is privileged');
  execute 'select count(*) from public.crm_leads' into n;
  perform pg_temp.sts_day2_expect(n = 1, 'administrator can read org A leads');

  perform pg_temp.sts_day2_impersonate(owner_b, 'owner-b@day2.test');
  select public.is_phase1_owner() into privileged;
  perform pg_temp.sts_day2_expect(privileged = true, 'org B owner is privileged for their own membership');
  execute format('select count(*) from public.crm_clients where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day2_expect(n = 0, 'owner B cannot read org A clients');
  execute format('select count(*) from public.crm_leads where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day2_expect(n = 0, 'owner B cannot read org A leads');
  perform pg_temp.sts_day2_expect_blocked_write(
    format('update public.crm_leads set business_name = %L where id = %L::uuid', 'Stolen', lead_id),
    'owner B cannot update org A leads'
  );

  perform pg_temp.sts_day2_as_postgres();
  raise notice 'DAY2_ISOLATION_RUNTIME_PASSED';
end $$;
