-- Executable Day 1 tenant-isolation checks for a disposable local Supabase stack.
-- Run only via scripts/verify-day1-local-supabase.sh after `npx supabase db reset`.
-- Uses synthetic @day1.test users and day1-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production or any database that already has real business data.

do $$
declare
  foreign_orgs integer;
begin
  if to_regclass('public.organizations') is null then
    raise exception 'day1 isolation aborted: organizations table is missing';
  end if;
  select count(*) into foreign_orgs
  from public.organizations
  where slug is null or slug not like 'day1-test-%';
  if foreign_orgs > 0 then
    raise exception 'day1 isolation aborted: refusing to mutate organizations that are not day1-test-* slugs';
  end if;
end $$;

create or replace function pg_temp.sts_day1_seed_auth_user(p_id uuid, p_email text)
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
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
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
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
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
    when undefined_column then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        p_id,
        jsonb_build_object('sub', p_id::text, 'email', p_email),
        'email',
        now(),
        now(),
        now()
      );
    when unique_violation then
      null;
  end;
end;
$$;

create or replace function pg_temp.sts_day1_as_postgres()
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

create or replace function pg_temp.sts_day1_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
returns void
language plpgsql
as $$
declare
  claims jsonb;
begin
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', p_email, true);
  claims := jsonb_build_object(
    'sub', p_user_id,
    'role', 'authenticated',
    'email', p_email,
    'aud', 'authenticated'
  );
  if p_aal is not null and p_aal <> '' then
    claims := claims || jsonb_build_object('aal', p_aal);
    perform set_config('request.jwt.claim.aal', p_aal, true);
  else
    perform set_config('request.jwt.claim.aal', '', true);
  end if;
  perform set_config('request.jwt.claims', claims::text, true);
end;
$$;

create or replace function pg_temp.sts_day1_as_anon()
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

create or replace function pg_temp.sts_day1_expect(p_ok boolean, p_name text)
returns void
language plpgsql
as $$
begin
  if not p_ok then
    raise exception 'day1 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day1_expect_exception(p_sql text, p_name text)
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
  raise exception 'day1 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day1_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day1 isolation failed: % (got % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day1_expect_blocked_write(p_sql text, p_name text)
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
  raise exception 'day1 isolation failed: % (wrote % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := '11111111-1111-4111-8111-111111111111';
  owner_b uuid := '22222222-2222-4222-8222-222222222222';
  admin_a uuid := '33333333-3333-4333-8333-333333333333';
  accountant_a uuid := '44444444-4444-4444-8444-444444444444';
  client_a uuid := '55555555-5555-4555-8555-555555555555';
  contractor_a uuid := '66666666-6666-4666-8666-666666666666';
  inactive_a uuid := '77777777-7777-4777-8777-777777777777';
  org_a uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  org_b uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  n integer;
  audit_id uuid;
  display_name text;
  invoice_prefix text;
  actor uuid;
  result text;
begin
  perform pg_temp.sts_day1_as_postgres();

  delete from public.organization_members where organization_id in (org_a, org_b);
  delete from public.audit_events where organization_id in (org_a, org_b);
  delete from public.business_settings where organization_id in (org_a, org_b);
  delete from public.organizations where id in (org_a, org_b);

  perform pg_temp.sts_day1_seed_auth_user(owner_a, 'owner-a@day1.test');
  perform pg_temp.sts_day1_seed_auth_user(owner_b, 'owner-b@day1.test');
  perform pg_temp.sts_day1_seed_auth_user(admin_a, 'admin-a@day1.test');
  perform pg_temp.sts_day1_seed_auth_user(accountant_a, 'accountant-a@day1.test');
  perform pg_temp.sts_day1_seed_auth_user(client_a, 'client-a@day1.test');
  perform pg_temp.sts_day1_seed_auth_user(contractor_a, 'contractor-a@day1.test');
  perform pg_temp.sts_day1_seed_auth_user(inactive_a, 'inactive-a@day1.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day1 Test Org A', 'Org A', 'day1-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day1 Test Org B', 'Org B', 'day1-test-org-b', 'USD', 'America/Chicago', 1);

  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix, default_payment_terms)
  values
    (org_a, 'AAA', 'EST', 'Net 15'),
    (org_b, 'BBB', 'EST', 'Net 15');

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, accepted_at
  ) values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, admin_a, 'administrator', 'active', now(), now()),
    (org_a, accountant_a, 'accountant', 'active', now(), now()),
    (org_a, client_a, 'client', 'active', now(), now()),
    (org_a, contractor_a, 'contractor', 'active', now(), now()),
    (org_a, inactive_a, 'employee', 'disabled', now(), null);

  perform pg_temp.sts_day1_as_anon();
  perform pg_temp.sts_day1_expect_denied_or_zero('select count(*) from public.organizations', 'anon cannot select organizations');
  perform pg_temp.sts_day1_expect_denied_or_zero('select count(*) from public.business_settings', 'anon cannot select business_settings');
  perform pg_temp.sts_day1_expect_denied_or_zero('select count(*) from public.audit_events', 'anon cannot select audit_events');
  perform pg_temp.sts_day1_expect_exception(
    format(
      'select public.sts_save_business_settings(%L::uuid, %L, %L, %L, %L, 1, %L, %L, %L)',
      org_a, 'Scars to Stars Media', 'STS Media', 'America/New_York', 'USD', 'STS', 'EST', 'Net 15'
    ),
    'anon cannot execute sts_save_business_settings'
  );

  perform pg_temp.sts_day1_impersonate(owner_a, 'owner-a@day1.test');
  execute 'select count(*) from public.organizations' into n;
  perform pg_temp.sts_day1_expect(n = 1, 'owner A sees one organization');
  execute 'select count(*) from public.business_settings' into n;
  perform pg_temp.sts_day1_expect(n = 1, 'owner A sees one settings row');
  execute format('update public.organizations set display_name = %L where id = %L::uuid', 'Org A Live', org_a);
  get diagnostics n = row_count;
  perform pg_temp.sts_day1_expect(n = 1, 'owner A can update own organization');

  perform pg_temp.sts_day1_impersonate(owner_b, 'owner-b@day1.test');
  execute format('select count(*) from public.organizations where id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day1_expect(n = 0, 'owner B cannot read org A');
  execute format('select count(*) from public.business_settings where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day1_expect(n = 0, 'owner B cannot read org A settings');
  execute format('select count(*) from public.audit_events where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day1_expect(n = 0, 'owner B cannot read org A audit');

  perform pg_temp.sts_day1_impersonate(owner_a, 'owner-a@day1.test');
  perform pg_temp.sts_day1_expect_exception(
    format(
      'insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix) values (%L::uuid, %L, %L)',
      org_b, 'HAX', 'HAX'
    ),
    'owner A cannot insert org B settings'
  );
  execute format('update public.organizations set display_name = %L where id = %L::uuid', 'Hijack', org_b);
  get diagnostics n = row_count;
  perform pg_temp.sts_day1_expect(n = 0, 'owner A cannot update org B');
  perform pg_temp.sts_day1_expect_exception(
    format(
      'update public.business_settings set organization_id = %L::uuid where organization_id = %L::uuid',
      org_b, org_a
    ),
    'owner A cannot reassign settings organization_id'
  );

  perform pg_temp.sts_day1_impersonate(admin_a, 'admin-a@day1.test');
  perform pg_temp.sts_day1_expect_exception(
    format('update public.organization_members set role = %L where user_id = %L::uuid', 'owner', admin_a),
    'administrator cannot self-promote to owner'
  );
  perform pg_temp.sts_day1_expect_exception(
    format(
      'insert into public.organization_members (organization_id, user_id, role, status) values (%L::uuid, %L::uuid, %L, %L)',
      org_a, admin_a, 'owner', 'active'
    ),
    'administrator cannot insert a membership for self'
  );

  perform pg_temp.sts_day1_impersonate(inactive_a, 'inactive-a@day1.test');
  execute 'select count(*) from public.organizations' into n;
  perform pg_temp.sts_day1_expect(n = 0, 'inactive member cannot select organizations');
  execute 'select count(*) from public.business_settings' into n;
  perform pg_temp.sts_day1_expect(n = 0, 'inactive member cannot select settings');

  perform pg_temp.sts_day1_impersonate(accountant_a, 'accountant-a@day1.test');
  execute 'select count(*) from public.business_settings' into n;
  perform pg_temp.sts_day1_expect(n = 1, 'accountant can read settings');
  execute 'select count(*) from public.audit_events' into n;
  perform pg_temp.sts_day1_expect(n = 0, 'accountant cannot read audit events');
  execute format('update public.organizations set legal_name = %L where id = %L::uuid', 'No', org_a);
  get diagnostics n = row_count;
  perform pg_temp.sts_day1_expect(n = 0, 'accountant cannot update organizations');

  perform pg_temp.sts_day1_impersonate(client_a, 'client-a@day1.test');
  execute 'select count(*) from public.organization_members' into n;
  perform pg_temp.sts_day1_expect(n = 1, 'client sees only own membership row');
  execute 'select count(*) from public.business_settings' into n;
  perform pg_temp.sts_day1_expect(n = 0, 'client cannot read business settings');

  perform pg_temp.sts_day1_impersonate(contractor_a, 'contractor-a@day1.test');
  execute format('update public.business_settings set invoice_prefix = %L where organization_id = %L::uuid', 'ZZZ', org_a);
  get diagnostics n = row_count;
  perform pg_temp.sts_day1_expect(n = 0, 'contractor cannot update settings');

  perform pg_temp.sts_day1_impersonate(owner_a, 'owner-a@day1.test');
  perform public.sts_record_audit_event(org_a, 'pre-tamper', 'organizations', org_a::text, '{}'::jsonb, 'success');
  perform pg_temp.sts_day1_expect_exception(
    format(
      'insert into public.audit_events (organization_id, action, result, entity_type) values (%L::uuid, %L, %L, %L)',
      org_a, 'forged', 'success', 'organizations'
    ),
    'authenticated cannot insert audit events directly'
  );
  perform pg_temp.sts_day1_expect_blocked_write(
    'update public.audit_events set action = ''tamper''',
    'authenticated cannot update audit events'
  );
  perform pg_temp.sts_day1_expect_blocked_write(
    'delete from public.audit_events',
    'authenticated cannot delete audit events'
  );
  perform pg_temp.sts_day1_as_postgres();
  execute format(
    'select count(*) from public.audit_events where organization_id = %L::uuid and action = %L',
    org_a, 'pre-tamper'
  ) into n;
  perform pg_temp.sts_day1_expect(n = 1, 'audit row remains after blocked tamper attempts');

  perform pg_temp.sts_day1_impersonate(owner_a, 'owner-a@day1.test');
  perform pg_temp.sts_day1_expect_exception(
    format(
      'select public.sts_save_business_settings(%L::uuid, %L, %L, %L, %L, 1, %L, %L, %L)',
      org_a, 'X', 'STS Media', 'America/New_York', 'USD', 'STS', 'EST', 'Net 15'
    ),
    'RPC rejects invalid legal name'
  );

  perform pg_temp.sts_day1_as_postgres();
  select bs.invoice_prefix into invoice_prefix from public.business_settings as bs where bs.organization_id = org_a;
  perform pg_temp.sts_day1_expect(invoice_prefix = 'AAA', 'invalid RPC leaves settings unchanged');

  perform pg_temp.sts_day1_impersonate(owner_a, 'owner-a@day1.test');
  perform pg_temp.sts_day1_expect_exception(
    format(
      'select public.sts_save_business_settings(%L::uuid, %L, %L, %L, %L, 1, %L, %L, %L)',
      org_b, 'Day1 Test Org B', 'Org B', 'America/Chicago', 'USD', 'BBB', 'EST', 'Net 15'
    ),
    'owner A cannot save settings for org B through the RPC'
  );

  select public.sts_save_business_settings(
    org_a,
    'Day1 Test Org A',
    'Org A Saved',
    'America/New_York',
    'USD',
    1,
    'STSX',
    'EST',
    'Net 15'
  ) into audit_id;
  perform pg_temp.sts_day1_expect(audit_id is not null, 'owner A RPC returns an audit id');

  select org.display_name into display_name from public.organizations as org where org.id = org_a;
  select bs.invoice_prefix into invoice_prefix from public.business_settings as bs where bs.organization_id = org_a;
  perform pg_temp.sts_day1_expect(display_name = 'Org A Saved', 'owner A RPC persisted display name');
  perform pg_temp.sts_day1_expect(invoice_prefix = 'STSX', 'owner A RPC persisted invoice prefix');

  select ev.actor_user_id, ev.result into actor, result from public.audit_events as ev where ev.id = audit_id;
  perform pg_temp.sts_day1_expect(actor = owner_a, 'audit actor is auth.uid()');
  perform pg_temp.sts_day1_expect(result = 'success', 'audit result is success');

  perform pg_temp.sts_day1_as_postgres();
  execute 'select count(*) from public.organizations' into n;
  perform pg_temp.sts_day1_expect(n = 2, 'postgres contrast count is 2 (not used as RLS proof)');

  raise notice 'DAY1_ISOLATION_RUNTIME_PASSED';
end $$;
