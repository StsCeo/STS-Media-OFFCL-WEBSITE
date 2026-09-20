-- Executable Day 6 conversion isolation checks for the disposable local stack.
-- Uses synthetic @day6.test users and day6-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day6_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day6_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day6_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
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

create or replace function pg_temp.sts_day6_as_anon()
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

create or replace function pg_temp.sts_day6_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day6 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day6_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day6 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day6_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day6 isolation failed: % (got % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'c6111111-1111-4611-8611-111111111116';
  owner_b uuid := 'c6222222-2222-4622-8622-222222222226';
  admin_a uuid := 'c6333333-3333-4633-8633-333333333336';
  member_a uuid := 'c6444444-4444-4644-8644-444444444446';
  accountant_a uuid := 'c6555555-5555-4655-8655-555555555556';
  stranger uuid := 'c6666666-6666-4666-8666-666666666666';
  org_a uuid := 'a6a6a6a6-a6a6-46a6-86a6-a6a6a6a6a6a6';
  org_b uuid := 'b6b6b6b6-b6b6-46b6-86b6-b6b6b6b6b6b6';
  n integer;
  client_a uuid;
  client_b uuid;
  estimate_accepted uuid;
  estimate_draft uuid;
  estimate_ready uuid;
  invoice_a uuid;
  invoice_again uuid;
  lines jsonb := '[{"description":"Website quote","quantity":2,"unit_cents":150000,"discount_cents":5000}]'::jsonb;
  subtotal integer;
  discount integer;
  total integer;
  source_id uuid;
  source_number text;
  invoice_status text;
  meta jsonb;
  action text;
begin
  if to_regclass('public.ws_estimates') is null or to_regclass('public.ws_invoices') is null then
    raise exception 'day6 isolation aborted: commercial tables are missing';
  end if;
  if to_regprocedure('public.sts_convert_ws_estimate_to_invoice(uuid,uuid)') is null then
    raise exception 'day6 isolation aborted: conversion RPC is missing';
  end if;

  perform pg_temp.sts_day6_as_postgres();
  delete from public.organizations where slug like 'day6-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day6_seed_auth_user(owner_a, 'owner-a@day6.test');
  perform pg_temp.sts_day6_seed_auth_user(owner_b, 'owner-b@day6.test');
  perform pg_temp.sts_day6_seed_auth_user(admin_a, 'admin-a@day6.test');
  perform pg_temp.sts_day6_seed_auth_user(member_a, 'member-a@day6.test');
  perform pg_temp.sts_day6_seed_auth_user(accountant_a, 'accountant-a@day6.test');
  perform pg_temp.sts_day6_seed_auth_user(stranger, 'stranger@day6.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day6 Test Org A', 'Day6 A', 'day6-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day6 Test Org B', 'Day6 B', 'day6-test-org-b', 'USD', 'America/New_York', 1);
  insert into public.organization_members (organization_id, user_id, role, status) values
    (org_a, owner_a, 'owner', 'active'),
    (org_b, owner_b, 'owner', 'active'),
    (org_a, admin_a, 'administrator', 'active'),
    (org_a, member_a, 'employee', 'active'),
    (org_a, accountant_a, 'accountant', 'active');
  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix, default_payment_terms)
  values (org_a, 'STS', 'EST', 'Net 15'), (org_b, 'STS', 'EST', 'Net 15')
  on conflict (organization_id) do update set estimate_prefix = excluded.estimate_prefix;

  perform pg_temp.sts_day6_as_anon();
  perform pg_temp.sts_day6_expect_denied_or_zero('select count(*) from public.ws_invoices', 'anon cannot select invoices');
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, org_a),
    'anon cannot convert estimates'
  );

  perform pg_temp.sts_day6_impersonate(owner_a, 'owner-a@day6.test', 'aal1');
  perform pg_temp.sts_day6_expect_denied_or_zero('select count(*) from public.ws_invoices', 'AAL1 owner cannot read invoices');
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, org_a),
    'AAL1 owner cannot convert'
  );

  perform pg_temp.sts_day6_impersonate(owner_a, 'owner-a@day6.test', 'aal2');
  select public.sts_save_crm_client(org_a, null, 'Org A Client', 'Casey', 'casey@day6.test', '', 'Auto', 'active', '') into client_a;
  perform pg_temp.sts_day6_impersonate(owner_b, 'owner-b@day6.test', 'aal2');
  select public.sts_save_crm_client(org_b, null, 'Org B Client', 'Riley', 'riley@day6.test', '', 'Auto', 'active', '') into client_b;

  perform pg_temp.sts_day6_impersonate(owner_a, 'owner-a@day6.test', 'aal2');
  select public.sts_save_ws_estimate(org_a, null, client_a, 'Accepted quote', 'Build', current_date, null, 'USD', 'Do not email', 'Customer facing', 'Net 15', 'Org A Client', 'Casey', 'casey@day6.test', 0, lines) into estimate_accepted;
  perform public.sts_set_ws_estimate_status(org_a, estimate_accepted, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_accepted, 'accepted');

  select public.sts_save_ws_estimate(org_a, null, client_a, 'Draft quote', 'Draft', current_date, null, 'USD', '', '', '', '', '', '', 0, lines) into estimate_draft;
  select public.sts_save_ws_estimate(org_a, null, client_a, 'Ready quote', 'Ready', current_date, null, 'USD', '', '', '', '', '', '', 0, lines) into estimate_ready;
  perform public.sts_set_ws_estimate_status(org_a, estimate_ready, 'ready');

  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_draft),
    'draft estimate cannot convert'
  );
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_ready),
    'ready estimate cannot convert'
  );

  select public.sts_convert_ws_estimate_to_invoice(org_a, estimate_accepted) into invoice_a;
  perform pg_temp.sts_day6_expect(invoice_a is not null, 'accepted estimate converted to invoice');
  select public.sts_convert_ws_estimate_to_invoice(org_a, estimate_accepted) into invoice_again;
  perform pg_temp.sts_day6_expect(invoice_again = invoice_a, 'conversion is idempotent');
  execute 'select count(*) from public.ws_invoices where source_estimate_id = $1' into n using estimate_accepted;
  perform pg_temp.sts_day6_expect(n = 1, 'one estimate created one invoice');

  select source_estimate_id, source_estimate_number, status, subtotal_cents, discount_cents, total_cents
    into source_id, source_number, invoice_status, subtotal, discount, total
  from public.ws_invoices where id = invoice_a;
  perform pg_temp.sts_day6_expect(source_id = estimate_accepted, 'invoice stores source_estimate_id');
  perform pg_temp.sts_day6_expect(invoice_status = 'draft', 'conversion creates a draft invoice');
  perform pg_temp.sts_day6_expect(subtotal = 300000 and discount = 5000 and total = 295000, 'converted totals are integer cents');
  perform pg_temp.sts_day6_expect(source_number like 'EST-%', 'converted invoice snapshots the estimate number');
  execute 'select count(*) from public.ws_invoice_lines where invoice_id = $1' into n using invoice_a;
  perform pg_temp.sts_day6_expect(n = 1, 'converted invoice has snapped line items');

  perform pg_temp.sts_day6_expect_exception(
    format($sql$update public.ws_invoices set source_estimate_id = %L::uuid where id = %L::uuid$sql$, estimate_draft, invoice_a),
    'source_estimate_id is immutable'
  );

  perform pg_temp.sts_day6_impersonate(member_a, 'member-a@day6.test', 'aal2');
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_accepted),
    'employee cannot convert to invoice'
  );

  perform pg_temp.sts_day6_impersonate(accountant_a, 'accountant-a@day6.test', 'aal2');
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_accepted),
    'accountant cannot convert to invoice'
  );

  perform pg_temp.sts_day6_impersonate(owner_b, 'owner-b@day6.test', 'aal2');
  perform pg_temp.sts_day6_expect_denied_or_zero(
    format('select count(*) from public.ws_invoices where id = %L::uuid', invoice_a),
    'other-organization owner cannot read converted invoice'
  );
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_b, estimate_accepted),
    'cross-organization conversion denied'
  );

  perform pg_temp.sts_day6_impersonate(stranger, 'stranger@day6.test', 'aal1');
  perform pg_temp.sts_day6_expect_denied_or_zero('select count(*) from public.ws_invoices', 'stranger cannot read invoices');

  perform pg_temp.sts_day6_impersonate(owner_a, 'owner-a@day6.test', 'aal2');
  perform public.sts_archive_ws_estimate(org_a, estimate_ready);
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_ready),
    'archived estimate cannot convert'
  );

  select public.sts_save_ws_estimate(org_a, null, client_a, 'Declined quote', 'No', current_date, null, 'USD', '', '', '', '', '', '', 0, lines) into estimate_draft;
  perform public.sts_set_ws_estimate_status(org_a, estimate_draft, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_draft, 'declined');
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_draft),
    'declined estimate cannot convert'
  );

  select public.sts_save_ws_estimate(org_a, null, client_a, 'Expired quote', 'Old', current_date, null, 'USD', '', '', '', '', '', '', 0, lines) into estimate_ready;
  perform public.sts_set_ws_estimate_status(org_a, estimate_ready, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_ready, 'expired');
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_ready),
    'expired estimate cannot convert'
  );

  select public.sts_save_ws_estimate(org_a, null, client_a, 'Later archived', 'Hold', current_date, null, 'USD', '', '', '', '', '', '', 0, lines) into estimate_draft;
  perform public.sts_set_ws_estimate_status(org_a, estimate_draft, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_draft, 'accepted');
  perform public.sts_archive_ws_estimate(org_a, estimate_draft);
  perform pg_temp.sts_day6_expect_exception(
    format($sql$select public.sts_convert_ws_estimate_to_invoice(%L::uuid, %L::uuid)$sql$, org_a, estimate_draft),
    'archived accepted estimate cannot convert'
  );

  perform pg_temp.sts_day6_expect_exception(
    format('delete from public.ws_invoices where id = %L::uuid', invoice_a),
    'authenticated hard-delete of converted invoice denied'
  );

  select action, metadata into action, meta
  from public.audit_events
  where entity_id = estimate_accepted::text
    and action = 'estimate.converted_to_invoice'
  order by created_at desc
  limit 1;
  perform pg_temp.sts_day6_expect(action = 'estimate.converted_to_invoice', 'conversion audit exists');
  perform pg_temp.sts_day6_expect(meta ? 'invoice_id' and meta ? 'result', 'conversion audit stores identifiers');
  perform pg_temp.sts_day6_expect(
    (meta::text) not ilike '%customer facing%' and (meta::text) not ilike '%website quote%' and (meta::text) not ilike '%do not email%',
    'conversion audit omits notes and line content'
  );

  raise notice 'DAY6_ISOLATION_RUNTIME_PASSED';
end;
$$;
