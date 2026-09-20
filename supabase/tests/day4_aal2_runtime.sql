-- Day 4 security closure: AAL1 vs AAL2 on Days 1–4 protected objects.
-- Impersonates JWT aal claims. Superuser counts are not RLS proof.
-- Uses synthetic @day4-aal.test users only. Do not run against production.

create or replace function pg_temp.sts_aal_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_aal_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claim.aal', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_aal_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
returns void language plpgsql as $$
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
  if p_aal is null or p_aal = '' then
    perform set_config('request.jwt.claim.aal', '', true);
  else
    claims := claims || jsonb_build_object('aal', p_aal);
    perform set_config('request.jwt.claim.aal', p_aal, true);
  end if;
  perform set_config('request.jwt.claims', claims::text, true);
end;
$$;

create or replace function pg_temp.sts_aal_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day4 aal isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_aal_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day4 aal isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_aal_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day4 aal isolation failed: % (got % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_aal_expect_blocked_write(p_sql text, p_name text)
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
  raise exception 'day4 aal isolation failed: % (wrote % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'b1111111-1111-4111-8111-111111111111';
  owner_b uuid := 'b2222222-2222-4222-8222-222222222222';
  admin_a uuid := 'b3333333-3333-4333-8333-333333333333';
  member_a uuid := 'b4444444-4444-4444-8444-444444444444';
  accountant_a uuid := 'b5555555-5555-4555-8555-555555555555';
  stranger uuid := 'b6666666-6666-4666-8666-666666666666';
  org_a uuid := 'e4e4e4e4-e4e4-4e4e-8e4e-e4e4e4e4e4e4';
  org_b uuid := 'e5e5e5e5-e5e5-45e5-8e5e-e5e5e5e5e5e5';
  n integer;
  note_id uuid;
  invoice_id uuid;
  client_id uuid;
  lines jsonb := '[{"description":"AAL check","quantity":1,"unit_cents":10000}]'::jsonb;
begin
  if to_regclass('public.sts_session_is_aal2') is null then
    raise exception 'day4 aal isolation aborted: sts_session_is_aal2 is missing';
  end if;

  perform pg_temp.sts_aal_as_postgres();
  delete from public.organizations where slug like 'day4-aal-%' or id in (org_a, org_b);

  perform pg_temp.sts_aal_seed_auth_user(owner_a, 'owner-a@day4-aal.test');
  perform pg_temp.sts_aal_seed_auth_user(owner_b, 'owner-b@day4-aal.test');
  perform pg_temp.sts_aal_seed_auth_user(admin_a, 'admin-a@day4-aal.test');
  perform pg_temp.sts_aal_seed_auth_user(member_a, 'member-a@day4-aal.test');
  perform pg_temp.sts_aal_seed_auth_user(accountant_a, 'accountant-a@day4-aal.test');
  perform pg_temp.sts_aal_seed_auth_user(stranger, 'stranger@day4-aal.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day4 AAL Org A', 'AAL A', 'day4-aal-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day4 AAL Org B', 'AAL B', 'day4-aal-org-b', 'USD', 'America/Chicago', 1);
  insert into public.business_settings (organization_id, invoice_prefix)
  values (org_a, 'AAL'), (org_b, 'ALB')
  on conflict (organization_id) do update set invoice_prefix = excluded.invoice_prefix;
  insert into public.organization_members (organization_id, user_id, role, status, invited_at, accepted_at)
  values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, admin_a, 'administrator', 'active', now(), now()),
    (org_a, member_a, 'employee', 'active', now(), now()),
    (org_a, accountant_a, 'accountant', 'active', now(), now());

  -- AAL2 owner seeds one protected row so AAL1 denial is observable.
  perform pg_temp.sts_aal_impersonate(owner_a, 'owner-a@day4-aal.test', 'aal2');
  select public.sts_save_crm_client(org_a, null, 'AAL Client', 'Ada', 'ada@example.test', '', 'Auto', 'active', '') into client_id;
  select public.sts_save_ws_note(org_a, null, 'AAL note', 'Body', 'none', null, false) into note_id;
  perform pg_temp.sts_aal_expect(note_id is not null and client_id is not null, 'owner AAL2 can create a note and client');

  -- Signed-out / missing JWT
  perform pg_temp.sts_aal_as_postgres();
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', '{}', true);
  perform pg_temp.sts_aal_expect(public.sts_session_is_aal2() is false, 'missing JWT aal fails closed');

  -- Owner AAL1: membership bootstrap allowed; protected data denied.
  perform pg_temp.sts_aal_impersonate(owner_a, 'owner-a@day4-aal.test', 'aal1');
  perform pg_temp.sts_aal_expect(public.sts_session_is_aal2() is false, 'owner AAL1 is not aal2');
  perform pg_temp.sts_aal_expect(public.sts_is_organization_member(org_a) is true, 'owner AAL1 can detect own membership');
  execute 'select count(*) from public.organization_members' into n;
  perform pg_temp.sts_aal_expect(n = 1, 'owner AAL1 can read only own membership row');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.organizations', 'owner AAL1 cannot read organizations');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.business_settings', 'owner AAL1 cannot read business settings');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.audit_events', 'owner AAL1 cannot read audit events');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.crm_clients', 'owner AAL1 cannot read clients');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.crm_leads', 'owner AAL1 cannot read leads');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ops_expenses', 'owner AAL1 cannot read expenses');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ops_revenue', 'owner AAL1 cannot read revenue');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ops_projects', 'owner AAL1 cannot read projects');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ops_tasks', 'owner AAL1 cannot read tasks');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'owner AAL1 cannot read notes');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_documents', 'owner AAL1 cannot read documents');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_calendar_events', 'owner AAL1 cannot read calendar');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_invoices', 'owner AAL1 cannot read invoices');
  perform pg_temp.sts_aal_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, 'AAL1', 'Nope', 'none'),
    'owner AAL1 cannot save a note'
  );
  perform pg_temp.sts_aal_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date + 15, 'USD', '', '', 0, 0, %L::jsonb)$sql$, org_a, client_id, lines),
    'owner AAL1 cannot save an invoice'
  );
  perform pg_temp.sts_aal_expect_exception(
    format('select public.sts_record_audit_event(%L::uuid, %L, %L, %L)', org_a, 'probe', 'note', 'x'),
    'owner AAL1 cannot write audit events'
  );

  -- Missing and malformed aal
  perform pg_temp.sts_aal_impersonate(owner_a, 'owner-a@day4-aal.test', '');
  perform pg_temp.sts_aal_expect(public.sts_session_is_aal2() is false, 'missing aal claim fails closed');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'missing aal cannot read notes');
  perform pg_temp.sts_aal_impersonate(owner_a, 'owner-a@day4-aal.test', 'AAL2');
  perform pg_temp.sts_aal_expect(public.sts_session_is_aal2() is false, 'malformed AAL2 casing fails closed');
  perform pg_temp.sts_aal_impersonate(owner_a, 'owner-a@day4-aal.test', 'aal3');
  perform pg_temp.sts_aal_expect(public.sts_session_is_aal2() is false, 'unknown aal claim fails closed');

  -- Administrator / employee / accountant AAL1
  perform pg_temp.sts_aal_impersonate(admin_a, 'admin-a@day4-aal.test', 'aal1');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_invoices', 'admin AAL1 cannot read invoices');
  perform pg_temp.sts_aal_impersonate(member_a, 'member-a@day4-aal.test', 'aal1');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'employee AAL1 cannot read notes');
  perform pg_temp.sts_aal_impersonate(accountant_a, 'accountant-a@day4-aal.test', 'aal1');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_invoices', 'accountant AAL1 cannot read invoices');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_documents', 'accountant AAL1 cannot read documents');

  -- Other-org owner AAL2 cannot read org A; AAL1 also denied.
  perform pg_temp.sts_aal_impersonate(owner_b, 'owner-b@day4-aal.test', 'aal1');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'other-org owner AAL1 cannot read notes');
  perform pg_temp.sts_aal_impersonate(owner_b, 'owner-b@day4-aal.test', 'aal2');
  execute 'select count(*) from public.ws_notes' into n;
  perform pg_temp.sts_aal_expect(n = 0, 'other-org owner AAL2 still cannot read org A notes');
  perform pg_temp.sts_aal_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, 'Cross', 'Nope', 'none'),
    'other-org owner AAL2 cannot write org A notes'
  );

  -- Stranger AAL1/AAL2
  perform pg_temp.sts_aal_impersonate(stranger, 'stranger@day4-aal.test', 'aal1');
  perform pg_temp.sts_aal_expect(public.sts_is_organization_member(org_a) is false, 'stranger AAL1 has no membership');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'stranger AAL1 cannot read notes');
  perform pg_temp.sts_aal_impersonate(stranger, 'stranger@day4-aal.test', 'aal2');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'stranger AAL2 still cannot read notes');

  -- AAL2 role matrix remains.
  perform pg_temp.sts_aal_impersonate(member_a, 'member-a@day4-aal.test', 'aal2');
  select public.sts_save_ws_note(org_a, null, 'Member AAL2', 'Operational', 'none', null, false) into note_id;
  perform pg_temp.sts_aal_expect(note_id is not null, 'employee AAL2 can save a note');
  perform pg_temp.sts_aal_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date + 15, 'USD', '', '', 0, 0, %L::jsonb)$sql$, org_a, client_id, lines),
    'employee AAL2 still cannot save an invoice'
  );

  perform pg_temp.sts_aal_impersonate(accountant_a, 'accountant-a@day4-aal.test', 'aal2');
  execute 'select count(*) from public.ws_invoices' into n;
  perform pg_temp.sts_aal_expect(n = 0, 'accountant AAL2 invoice read is empty before an invoice exists');
  perform pg_temp.sts_aal_expect_denied_or_zero('select count(*) from public.ws_notes', 'accountant AAL2 cannot read notes');

  perform pg_temp.sts_aal_impersonate(admin_a, 'admin-a@day4-aal.test', 'aal2');
  select public.sts_save_ws_invoice(org_a, null, client_id, current_date, current_date + 15, 'USD', '', '', 0, 0, lines) into invoice_id;
  perform pg_temp.sts_aal_expect(invoice_id is not null, 'administrator AAL2 can save an invoice');

  perform pg_temp.sts_aal_impersonate(accountant_a, 'accountant-a@day4-aal.test', 'aal2');
  execute 'select count(*) from public.ws_invoices' into n;
  perform pg_temp.sts_aal_expect(n = 1, 'accountant AAL2 can read invoices');
  perform pg_temp.sts_aal_expect_exception(
    format('select public.sts_issue_ws_invoice(%L::uuid, %L::uuid)', org_a, invoice_id),
    'accountant AAL2 cannot issue an invoice'
  );

  perform pg_temp.sts_aal_impersonate(owner_a, 'owner-a@day4-aal.test', 'aal2');
  perform public.sts_issue_ws_invoice(org_a, invoice_id);
  execute 'select count(*) from public.ws_invoices where status = ''issued''' into n;
  perform pg_temp.sts_aal_expect(n = 1, 'owner AAL2 can issue an invoice');
  perform pg_temp.sts_aal_expect_blocked_write(
    format('delete from public.ws_invoices where id = %L::uuid', invoice_id),
    'owner AAL2 still cannot hard-delete invoices'
  );

  raise notice 'DAY4_AAL2_RUNTIME_PASSED';
end;
$$;
