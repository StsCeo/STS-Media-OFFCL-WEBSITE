-- Executable Day 5 estimate isolation checks for the disposable local stack.
-- Uses synthetic @day5.test users and day5-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day5_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day5_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day5_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
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

create or replace function pg_temp.sts_day5_as_anon()
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

create or replace function pg_temp.sts_day5_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day5 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day5_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day5 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day5_expect_denied_or_zero(p_sql text, p_name text)
returns void language plpgsql as $$
declare n integer;
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
  raise exception 'day5 isolation failed: % (got % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day5_expect_blocked_write(p_sql text, p_name text)
returns void language plpgsql as $$
declare n integer;
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
  raise exception 'day5 isolation failed: % (wrote % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'b1111111-1111-4111-8111-111111111115';
  owner_b uuid := 'b2222222-2222-4222-8222-222222222225';
  admin_a uuid := 'b3333333-3333-4333-8333-333333333335';
  member_a uuid := 'b4444444-4444-4444-8444-444444444445';
  accountant_a uuid := 'b5555555-5555-4555-8555-555555555555';
  stranger uuid := 'b6666666-6666-4666-8666-666666666665';
  org_a uuid := 'e5e5e5e5-e5e5-45e5-8e5e-e5e5e5e5e5e5';
  org_b uuid := 'e6e6e6e6-e6e6-46e6-8e6e-e6e6e6e6e6e6';
  n integer;
  client_a uuid;
  client_b uuid;
  estimate_a uuid;
  estimate_b uuid;
  lines jsonb := '[{"description":"Website quote","quantity":2,"unit_cents":150000,"discount_cents":5000}]'::jsonb;
  negative jsonb := '[{"description":"Bad","quantity":1,"unit_cents":-1,"discount_cents":0}]'::jsonb;
  oversized jsonb := '[{"description":"Huge","quantity":9999,"unit_cents":99999999,"discount_cents":0}]'::jsonb;
  empty_disc jsonb := '[{"description":"Over discount","quantity":1,"unit_cents":100,"discount_cents":200}]'::jsonb;
  subtotal integer;
  discount integer;
  total integer;
  assigned_number text;
  from_status text;
  to_status text;
  meta jsonb;
begin
  if to_regclass('public.ws_estimates') is null or to_regclass('public.ws_estimate_lines') is null then
    raise exception 'day5 isolation aborted: estimate tables are missing';
  end if;

  perform pg_temp.sts_day5_as_postgres();
  delete from public.organizations where slug like 'day5-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day5_seed_auth_user(owner_a, 'owner-a@day5.test');
  perform pg_temp.sts_day5_seed_auth_user(owner_b, 'owner-b@day5.test');
  perform pg_temp.sts_day5_seed_auth_user(admin_a, 'admin-a@day5.test');
  perform pg_temp.sts_day5_seed_auth_user(member_a, 'member-a@day5.test');
  perform pg_temp.sts_day5_seed_auth_user(accountant_a, 'accountant-a@day5.test');
  perform pg_temp.sts_day5_seed_auth_user(stranger, 'stranger@day5.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day5 Test Org A', 'Org A', 'day5-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day5 Test Org B', 'Org B', 'day5-test-org-b', 'USD', 'America/Chicago', 1);
  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix)
  values (org_a, 'STS', 'EST'), (org_b, 'ORG', 'QUO')
  on conflict (organization_id) do update
    set invoice_prefix = excluded.invoice_prefix, estimate_prefix = excluded.estimate_prefix;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, accepted_at
  ) values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, admin_a, 'administrator', 'active', now(), now()),
    (org_a, member_a, 'employee', 'active', now(), now()),
    (org_a, accountant_a, 'accountant', 'active', now(), now());

  perform pg_temp.sts_day5_as_anon();
  perform pg_temp.sts_day5_expect_denied_or_zero('select count(*) from public.ws_estimates', 'anon cannot select estimates');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, null, 'Anon', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, lines),
    'anon cannot save an estimate'
  );

  perform pg_temp.sts_day5_impersonate(stranger, 'stranger@day5.test');
  perform pg_temp.sts_day5_expect_denied_or_zero('select count(*) from public.ws_estimates', 'stranger cannot select estimates');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, null, 'Stranger', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, lines),
    'stranger cannot save an estimate'
  );

  perform pg_temp.sts_day5_impersonate(owner_a, 'owner-a@day5.test', 'aal1');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, null, 'AAL1', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, lines),
    'AAL1 owner cannot save an estimate'
  );
  perform pg_temp.sts_day5_expect_denied_or_zero('select count(*) from public.ws_estimates', 'AAL1 owner cannot read estimates');

  perform pg_temp.sts_day5_impersonate(owner_b, 'owner-b@day5.test');
  select public.sts_save_crm_client(org_b, null, 'Org B Client', 'Blake', 'b@example.test', '', 'Auto', 'active', '') into client_b;
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, null, 'Cross', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, lines),
    'owner B cannot save an estimate in org A'
  );

  perform pg_temp.sts_day5_impersonate(accountant_a, 'accountant-a@day5.test');
  perform pg_temp.sts_day5_expect_denied_or_zero('select count(*) from public.ws_estimates', 'accountant cannot read estimates');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, null, 'Books', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, lines),
    'accountant cannot save an estimate'
  );

  perform pg_temp.sts_day5_impersonate(member_a, 'member-a@day5.test');
  select public.sts_save_crm_client(org_a, null, 'Org A Client', 'Casey', 'c@example.test', '', 'Auto', 'active', '') into client_a;
  select public.sts_save_ws_estimate(
    org_a, null, client_a, 'Kickoff quote', 'Internal rebuild', current_date, current_date + 30,
    'USD', 'Do not email this', 'Customer facing note', 'Net 15', '', '', '', 2500, lines
  ) into estimate_a;
  perform pg_temp.sts_day5_expect(estimate_a is not null, 'employee can save an estimate');
  select subtotal_cents, discount_cents, total_cents, estimate_number
    into subtotal, discount, total, assigned_number
  from public.ws_estimates where id = estimate_a;
  perform pg_temp.sts_day5_expect(subtotal = 300000 and discount = 5000 and total = 297500, 'server calculates estimate totals from line items');
  perform pg_temp.sts_day5_expect(assigned_number like 'EST-%', 'new estimates receive an organization unique number');

  perform pg_temp.sts_day5_impersonate(owner_a, 'owner-a@day5.test');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, 'Cross client', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, client_b, lines),
    'estimate cannot reference a client from another organization'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, 'Empty', '', current_date, null, 'USD', '', '', '', '', '', '', 0, '[]'::jsonb)$sql$, org_a, client_a),
    'estimate without line items is rejected'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, 'Neg', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, client_a, negative),
    'negative unit price is rejected'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, 'Huge', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, client_a, oversized),
    'oversized line total is rejected'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, 'Disc', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, client_a, empty_disc),
    'line discount greater than line amount is rejected'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, %L, '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, client_a, repeat('x', 161), lines),
    'oversized estimate title is rejected'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_set_ws_estimate_status(%L::uuid, %L::uuid, 'accepted')$sql$, org_a, estimate_a),
    'draft cannot jump to accepted'
  );

  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, null, %L::uuid, 'Dates', '', current_date, current_date - 1, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, client_a, lines),
    'expiration before issue date is rejected'
  );
  select public.sts_save_ws_estimate(
    org_a, null, client_a, 'Expiring quote', '', current_date, current_date + 1,
    'USD', '', '', '', '', '', '', 0, lines
  ) into estimate_b;
  perform public.sts_set_ws_estimate_status(org_a, estimate_b, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_b, 'expired');
  select status into assigned_number from public.ws_estimates where id = estimate_b;
  perform pg_temp.sts_day5_expect(assigned_number = 'expired', 'ready estimate can be recorded expired');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_set_ws_estimate_status(%L::uuid, %L::uuid, 'accepted')$sql$, org_a, estimate_b),
    'expired estimate cannot be accepted'
  );

  perform public.sts_set_ws_estimate_status(org_a, estimate_a, 'ready');
  select status into assigned_number from public.ws_estimates where id = estimate_a;
  perform pg_temp.sts_day5_expect(assigned_number = 'ready', 'draft can be marked ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_a, 'ready');
  select status into assigned_number from public.ws_estimates where id = estimate_a;
  perform pg_temp.sts_day5_expect(assigned_number = 'ready', 'marking ready again is a no-op');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, %L::uuid, %L::uuid, 'Edit ready', '', current_date, null, 'USD', 'secret note', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, estimate_a, client_a, lines),
    'ready estimate cannot be edited as a draft'
  );

  perform public.sts_set_ws_estimate_status(org_a, estimate_a, 'accepted');
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_set_ws_estimate_status(%L::uuid, %L::uuid, 'declined')$sql$, org_a, estimate_a),
    'accepted estimate cannot be declined'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_set_ws_estimate_status(%L::uuid, %L::uuid, 'draft')$sql$, org_a, estimate_a),
    'accepted estimate cannot return to draft'
  );

  perform pg_temp.sts_day5_impersonate(admin_a, 'admin-a@day5.test');
  select public.sts_save_ws_estimate(
    org_a, null, client_a, 'Admin quote', '', current_date, current_date + 10,
    'USD', '', '', '', '', '', '', 0, lines
  ) into estimate_b;
  perform public.sts_set_ws_estimate_status(org_a, estimate_b, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_b, 'declined');
  perform public.sts_archive_ws_estimate(org_a, estimate_b);
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_set_ws_estimate_status(%L::uuid, %L::uuid, 'draft')$sql$, org_a, estimate_b),
    'archived estimate cannot change status'
  );
  perform pg_temp.sts_day5_expect_exception(
    format($sql$select public.sts_save_ws_estimate(%L::uuid, %L::uuid, %L::uuid, 'Archived', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb)$sql$, org_a, estimate_b, client_a, lines),
    'archived estimate cannot be mutated'
  );
  perform public.sts_restore_ws_estimate(org_a, estimate_b);
  select status into assigned_number from public.ws_estimates where id = estimate_b and archived_at is null;
  perform pg_temp.sts_day5_expect(assigned_number = 'declined', 'restore keeps prior status and clears archive');

  perform pg_temp.sts_day5_impersonate(owner_a, 'owner-a@day5.test');
  perform pg_temp.sts_day5_expect_blocked_write(
    format('delete from public.ws_estimates where id = %L::uuid', estimate_a),
    'authenticated cannot hard-delete estimates'
  );
  perform pg_temp.sts_day5_expect_blocked_write(
    format('delete from public.ws_estimate_lines where estimate_id = %L::uuid', estimate_a),
    'authenticated cannot hard-delete estimate lines'
  );
  perform pg_temp.sts_day5_expect_blocked_write(
    format('update public.ws_estimates set organization_id = %L::uuid where id = %L::uuid', org_b, estimate_a),
    'estimate organization_id cannot change'
  );

  perform pg_temp.sts_day5_impersonate(owner_b, 'owner-b@day5.test');
  execute 'select count(*) from public.ws_estimates' into n;
  perform pg_temp.sts_day5_expect(n = 0, 'owner B cannot read org A estimates');
  execute 'select count(*) from public.audit_events where organization_id = ' || quote_literal(org_a) into n;
  perform pg_temp.sts_day5_expect(n = 0, 'owner B cannot read org A audit events');

  perform pg_temp.sts_day5_as_postgres();
  execute 'select count(*) from public.audit_events where organization_id = ' || quote_literal(org_a) || ' and action like ''ws_estimate.%''' into n;
  perform pg_temp.sts_day5_expect(n >= 5, 'estimate writes created sanitized audit events');
  select metadata into meta
  from public.audit_events
  where organization_id = org_a and action = 'ws_estimate.status_changed'
  order by created_at desc limit 1;
  from_status := meta->>'from_status';
  to_status := meta->>'to_status';
  perform pg_temp.sts_day5_expect(from_status is not null and to_status is not null, 'status audit stores from/to metadata');
  perform pg_temp.sts_day5_expect(
    meta::text not ilike '%Do not email this%' and meta::text not ilike '%Website quote%',
    'audit metadata does not contain notes or line item content'
  );

  raise notice 'DAY5_ISOLATION_RUNTIME_PASSED';
end;
$$;
