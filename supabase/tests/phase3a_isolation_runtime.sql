-- Executable Phase 3A ICP + conversion isolation checks for the disposable local stack.
-- Uses synthetic @phase3a.test users and phase3a-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_p3a_seed_auth_user(p_id uuid, p_email text)
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
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );
  begin
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), p_id, jsonb_build_object('sub', p_id::text, 'email', p_email),
      'email', p_id::text, now(), now(), now()
    );
  exception
    when unique_violation then null;
  end;
end;
$$;

create or replace function pg_temp.sts_p3a_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_p3a_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
returns void language plpgsql as $$
declare
  claims jsonb;
begin
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', p_email, true);
  claims := jsonb_build_object('sub', p_user_id, 'role', 'authenticated', 'email', p_email, 'aud', 'authenticated');
  if p_aal is not null and p_aal <> '' then
    claims := claims || jsonb_build_object('aal', p_aal);
    perform set_config('request.jwt.claim.aal', p_aal, true);
  else
    perform set_config('request.jwt.claim.aal', '', true);
  end if;
  perform set_config('request.jwt.claims', claims::text, true);
end;
$$;

create or replace function pg_temp.sts_p3a_as_anon()
returns void language plpgsql as $$
begin
  execute 'reset role';
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;

create or replace function pg_temp.sts_p3a_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'phase3a isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_p3a_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'phase3a isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_p3a_expect_denied_or_zero(p_sql text, p_name text)
returns void language plpgsql as $$
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
  raise exception 'phase3a isolation failed: % (got % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'a1111111-1111-4111-8111-1111111111aa';
  owner_b uuid := 'a2222222-2222-4222-8222-2222222222aa';
  client_u uuid := 'a3333333-3333-4333-8333-3333333333aa';
  org_a uuid := 'aa111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  org_b uuid := 'aa222222-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  n integer;
  icp_a uuid;
  icp_seen uuid;
  lead_a uuid;
  lead_b uuid;
  client_a uuid;
  client_again uuid;
begin
  if to_regclass('public.crm_icps') is null then
    raise exception 'phase3a isolation aborted: crm_icps is missing';
  end if;

  perform pg_temp.sts_p3a_as_postgres();
  delete from public.organizations where slug like 'phase3a-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_p3a_seed_auth_user(owner_a, 'owner-a@phase3a.test');
  perform pg_temp.sts_p3a_seed_auth_user(owner_b, 'owner-b@phase3a.test');
  perform pg_temp.sts_p3a_seed_auth_user(client_u, 'client-a@phase3a.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Phase3A Test Org A', 'Org A', 'phase3a-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Phase3A Test Org B', 'Org B', 'phase3a-test-org-b', 'USD', 'America/Chicago', 1);

  insert into public.business_settings (organization_id)
  values (org_a), (org_b)
  on conflict (organization_id) do nothing;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, accepted_at
  ) values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, client_u, 'client', 'active', now(), now());

  perform pg_temp.sts_p3a_as_anon();
  perform pg_temp.sts_p3a_expect_denied_or_zero('select count(*) from public.crm_icps', 'unauthenticated cannot select crm_icps');
  perform pg_temp.sts_p3a_expect_exception(
    format('select public.sts_save_crm_icp(%L::uuid, null, %L, %L, %L, %L, 0, 0, %L, %L, %L, %L, %L, %L, %L, %L)',
      org_a, 'ICP', '', '', '', '', '', '', '', '', '', '', 'active'),
    'unauthenticated cannot call ICP RPC'
  );
  perform pg_temp.sts_p3a_expect_exception(
    format('select public.sts_convert_crm_lead_to_client(%L::uuid, %L::uuid)', org_a, org_a),
    'unauthenticated cannot convert leads'
  );

  perform pg_temp.sts_p3a_impersonate(owner_a, 'owner-a@phase3a.test', 'aal1');
  perform pg_temp.sts_p3a_expect_exception(
    format('select public.sts_save_crm_icp(%L::uuid, null, %L, %L, %L, %L, 0, 0, %L, %L, %L, %L, %L, %L, %L, %L)',
      org_a, 'AAL1 ICP', '', '', '', '', '', '', '', '', '', '', 'active'),
    'AAL1 cannot execute protected ICP write'
  );
  perform pg_temp.sts_p3a_expect_denied_or_zero('select count(*) from public.crm_icps', 'AAL1 cannot select ICPs');

  perform pg_temp.sts_p3a_impersonate(client_u, 'client-a@phase3a.test', 'aal2');
  perform pg_temp.sts_p3a_expect_denied_or_zero('select count(*) from public.crm_icps', 'client role cannot select ICPs');
  perform pg_temp.sts_p3a_expect_denied_or_zero('select count(*) from public.crm_leads', 'client role cannot select leads');
  perform pg_temp.sts_p3a_expect_exception(
    format('select public.sts_save_crm_icp(%L::uuid, null, %L, %L, %L, %L, 0, 0, %L, %L, %L, %L, %L, %L, %L, %L)',
      org_a, 'Client ICP', '', '', '', '', '', '', '', '', '', '', 'active'),
    'client role cannot save ICPs'
  );

  perform pg_temp.sts_p3a_impersonate(owner_a, 'owner-a@phase3a.test', 'aal2');
  select public.sts_save_crm_icp(
    org_a, null, 'Collision shops', 'Auto', '11-50', 'Southeast', 200000, 800000,
    'No site', 'Website', 'Owner', 'Referral', 'Price', 'Insurance season', 'Notes', 'active'
  ) into icp_a;
  perform pg_temp.sts_p3a_expect(icp_a is not null, 'owner A can create an ICP');
  execute 'select count(*) from public.crm_icps' into n;
  perform pg_temp.sts_p3a_expect(n = 1, 'owner A sees only org A ICPs after create');

  select public.sts_save_crm_lead(
    org_a, null, 'Org A Roofing', 'Riley', 'riley@phase3a.test', '', 'Manual', 'Site', 150000, 25, 'new_inquiry',
    null, null, 0, 0, 0, '', 'Owner', icp_a, null, null, null, null
  ) into lead_a;
  perform pg_temp.sts_p3a_expect(lead_a is not null, 'owner A can save a lead linked to an ICP');

  select public.sts_convert_crm_lead_to_client(org_a, lead_a) into client_a;
  perform pg_temp.sts_p3a_expect(client_a is not null, 'owner A can convert their lead');
  select public.sts_convert_crm_lead_to_client(org_a, lead_a) into client_again;
  perform pg_temp.sts_p3a_expect(client_again = client_a, 'conversion is idempotent');
  execute 'select count(*) from public.crm_clients' into n;
  perform pg_temp.sts_p3a_expect(n = 1, 'retry does not create a second client');

  perform pg_temp.sts_p3a_impersonate(owner_b, 'owner-b@phase3a.test', 'aal2');
  execute 'select count(*) from public.crm_icps' into n;
  perform pg_temp.sts_p3a_expect(n = 0, 'org B cannot access org A ICPs');
  execute 'select id from public.crm_icps where id = ' || quote_literal(icp_a) into icp_seen;
  perform pg_temp.sts_p3a_expect(icp_seen is null, 'org B cannot read org A ICP by id');
  perform pg_temp.sts_p3a_expect_exception(
    format('select public.sts_convert_crm_lead_to_client(%L::uuid, %L::uuid)', org_a, lead_a),
    'org B cannot convert org A leads'
  );
  perform pg_temp.sts_p3a_expect_exception(
    format('select public.sts_convert_crm_lead_to_client(%L::uuid, %L::uuid)', org_b, lead_a),
    'org B cannot convert a foreign lead id into org B'
  );
  select public.sts_save_crm_lead(
    org_b, null, 'Org B Roofing', 'Quinn', '', '', 'Manual', 'Site', 1000, 10, 'new_inquiry',
    null, null, 0, 0, 0, '', 'Owner'
  ) into lead_b;
  perform pg_temp.sts_p3a_expect(lead_b is not null, 'owner B can save their own lead');
  execute 'select count(*) from public.crm_leads' into n;
  perform pg_temp.sts_p3a_expect(n = 1, 'owner B sees only org B leads');

  raise notice 'PHASE3A_ISOLATION_RUNTIME_PASSED';
end;
$$;
