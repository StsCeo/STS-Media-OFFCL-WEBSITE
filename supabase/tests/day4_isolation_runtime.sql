-- Executable Day 4 workspace/invoicing isolation checks for the disposable local stack.
-- Uses synthetic @day4.test users and day4-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day4_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day4_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day4_impersonate(p_user_id uuid, p_email text)
returns void language plpgsql as $$
begin
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', p_email, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated', 'email', p_email, 'aud', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function pg_temp.sts_day4_as_anon()
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

create or replace function pg_temp.sts_day4_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day4 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day4_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day4 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day4_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day4 isolation failed: % (got % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day4_expect_blocked_write(p_sql text, p_name text)
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
  raise exception 'day4 isolation failed: % (wrote % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'a1111111-1111-4111-8111-111111111111';
  owner_b uuid := 'a2222222-2222-4222-8222-222222222222';
  admin_a uuid := 'a3333333-3333-4333-8333-333333333333';
  member_a uuid := 'a4444444-4444-4444-8444-444444444444';
  accountant_a uuid := 'a5555555-5555-4555-8555-555555555555';
  stranger uuid := 'a6666666-6666-4666-8666-666666666666';
  org_a uuid := 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4';
  org_b uuid := 'd5d5d5d5-d5d5-45d5-8d5d-d5d5d5d5d5d5';
  n integer;
  client_a uuid;
  client_b uuid;
  note_a uuid;
  event_a uuid;
  invoice_a uuid;
  doc_a uuid;
  doc_id uuid := 'd4c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0';
  lines jsonb := '[{"description":"Website build","quantity":2,"unit_cents":150000}]'::jsonb;
  tampered jsonb;
  issued_number text;
  subtotal integer;
  total integer;
begin
  if to_regclass('public.ws_notes') is null or to_regclass('public.ws_invoices') is null
     or to_regclass('public.ws_documents') is null or to_regclass('public.ws_calendar_events') is null then
    raise exception 'day4 isolation aborted: workspace tables are missing';
  end if;

  perform pg_temp.sts_day4_as_postgres();
  delete from public.organizations where slug like 'day4-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day4_seed_auth_user(owner_a, 'owner-a@day4.test');
  perform pg_temp.sts_day4_seed_auth_user(owner_b, 'owner-b@day4.test');
  perform pg_temp.sts_day4_seed_auth_user(admin_a, 'admin-a@day4.test');
  perform pg_temp.sts_day4_seed_auth_user(member_a, 'member-a@day4.test');
  perform pg_temp.sts_day4_seed_auth_user(accountant_a, 'accountant-a@day4.test');
  perform pg_temp.sts_day4_seed_auth_user(stranger, 'stranger@day4.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day4 Test Org A', 'Org A', 'day4-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day4 Test Org B', 'Org B', 'day4-test-org-b', 'USD', 'America/Chicago', 1);
  insert into public.business_settings (organization_id, invoice_prefix)
  values (org_a, 'STS'), (org_b, 'ORG')
  on conflict (organization_id) do update set invoice_prefix = excluded.invoice_prefix;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, accepted_at
  ) values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, admin_a, 'administrator', 'active', now(), now()),
    (org_a, member_a, 'employee', 'active', now(), now()),
    (org_a, accountant_a, 'accountant', 'active', now(), now());

  perform pg_temp.sts_day4_as_anon();
  perform pg_temp.sts_day4_expect_denied_or_zero('select count(*) from public.ws_notes', 'anon cannot select notes');
  perform pg_temp.sts_day4_expect_denied_or_zero('select count(*) from public.ws_documents', 'anon cannot select documents');
  perform pg_temp.sts_day4_expect_denied_or_zero('select count(*) from public.ws_calendar_events', 'anon cannot select calendar');
  perform pg_temp.sts_day4_expect_denied_or_zero('select count(*) from public.ws_invoices', 'anon cannot select invoices');
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, 'Anon', 'Nope', 'none'),
    'anon cannot save a note'
  );

  perform pg_temp.sts_day4_impersonate(stranger, 'stranger@day4.test');
  perform pg_temp.sts_day4_expect_denied_or_zero('select count(*) from public.ws_notes', 'stranger cannot select notes');
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, 'Stranger', 'Nope', 'none'),
    'stranger cannot save a note'
  );

  perform pg_temp.sts_day4_impersonate(owner_b, 'owner-b@day4.test');
  select public.sts_save_crm_client(org_b, null, 'Org B Client', 'Blake', 'b@example.test', '', 'Auto', 'active', '') into client_b;
  perform pg_temp.sts_day4_expect(client_b is not null, 'owner B can save a client in org B');
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, 'Cross', 'Nope', 'none'),
    'owner B cannot save a note in org A'
  );

  perform pg_temp.sts_day4_impersonate(member_a, 'member-a@day4.test');
  select public.sts_save_crm_client(org_a, null, 'Org A Client', 'Casey', 'c@example.test', '', 'Auto', 'active', '') into client_a;
  select public.sts_save_ws_note(org_a, null, 'Kickoff', 'Need photos. <script>alert(1)</script>', 'client', client_a, true) into note_a;
  perform pg_temp.sts_day4_expect(note_a is not null, 'employee can save a note');
  select public.sts_save_ws_calendar_event(
    org_a, null, 'Discovery call', 'Internal only', timestamptz '2026-09-21 14:00:00+00',
    timestamptz '2026-09-21 15:00:00+00', false, 'America/New_York', client_a, null, 'Zoom placeholder', 'client_meeting'
  ) into event_a;
  perform pg_temp.sts_day4_expect(event_a is not null, 'employee can save a calendar event');
  select public.sts_save_ws_document(
    org_a, doc_id,
    org_a::text || '/' || doc_id::text || '/brief.txt',
    'brief.txt', 'text/plain', 12, 'Harmless text', 'other', client_a, null
  ) into doc_a;
  perform pg_temp.sts_day4_expect(doc_a = doc_id, 'employee can save document metadata with generated path');
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date + 15, 'USD', '', '', 0, 0, %L::jsonb)$sql$, org_a, client_a, lines),
    'employee cannot save an invoice'
  );
  execute 'select count(*) from public.ws_invoices' into n;
  perform pg_temp.sts_day4_expect(n = 0, 'employee cannot read invoices');

  perform pg_temp.sts_day4_impersonate(accountant_a, 'accountant-a@day4.test');
  execute 'select count(*) from public.ws_documents' into n;
  perform pg_temp.sts_day4_expect(n = 1, 'accountant can read documents');
  execute 'select count(*) from public.ws_notes' into n;
  perform pg_temp.sts_day4_expect(n = 0, 'accountant cannot read notes');
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, 'Books', 'Nope', 'none'),
    'accountant cannot save a note'
  );
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date + 15, 'USD', '', '', 0, 0, %L::jsonb)$sql$, org_a, client_a, lines),
    'accountant cannot save an invoice'
  );

  perform pg_temp.sts_day4_impersonate(owner_a, 'owner-a@day4.test');
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, %L::uuid, false)', org_a, 'Cross', 'Nope', 'client', client_b),
    'note cannot reference a client from another organization'
  );
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, null, %L, %L, %L, null, false)', org_a, repeat('x', 161), 'Body', 'none'),
    'oversized note title is rejected'
  );
  perform pg_temp.sts_day4_expect_exception(
    format(
      $sql$select public.sts_save_ws_calendar_event(%L::uuid, null, %L, %L, timestamptz '2026-09-21 16:00:00+00', timestamptz '2026-09-21 15:00:00+00', false, 'America/New_York', null, null, '', 'team_meeting')$sql$,
      org_a, 'Backwards', ''
    ),
    'calendar rejects end before start'
  );
  perform pg_temp.sts_day4_expect_exception(
    format(
      $sql$select public.sts_save_ws_document(%L::uuid, %L::uuid, %L, %L, %L, 12, '', 'other', null, null)$sql$,
      org_a, doc_id, org_b::text || '/' || doc_id::text || '/x.txt', 'x.txt', 'text/plain'
    ),
    'document path cannot use another organization prefix'
  );
  perform pg_temp.sts_day4_expect_exception(
    format(
      $sql$select public.sts_save_ws_document(%L::uuid, gen_random_uuid(), %L, %L, %L, 12, '', 'other', null, null)$sql$,
      org_a, org_a::text || '/../secret.txt', 'secret.txt', 'text/plain'
    ),
    'document path traversal is rejected'
  );

  select public.sts_save_ws_invoice(org_a, null, client_a, current_date, current_date + 15, 'USD', 'Thanks', 'Mail a check. Not collected here.', 0, 2500, lines) into invoice_a;
  perform pg_temp.sts_day4_expect(invoice_a is not null, 'owner can save an invoice draft');
  select subtotal_cents, total_cents into subtotal, total from public.ws_invoices where id = invoice_a;
  perform pg_temp.sts_day4_expect(subtotal = 300000 and total = 302500, 'server calculates invoice totals from line items');

  tampered := '[{"description":"Website build","quantity":2,"unit_cents":1}]'::jsonb;
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date, 'USD', '', '', 0, 0, '[]'::jsonb)$sql$, org_a, client_a),
    'invoice without line items is rejected'
  );
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date, 'USD', '', '', 999999, 0, %L::jsonb)$sql$, org_a, client_a, lines),
    'discount greater than subtotal is rejected'
  );
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, null, %L::uuid, current_date, current_date, 'USD', '', '', 0, 0, %L::jsonb)$sql$, org_b, client_a, lines),
    'invoice cannot use a client from another organization via org B id'
  );

  perform public.sts_issue_ws_invoice(org_a, invoice_a);
  select invoice_number into issued_number from public.ws_invoices where id = invoice_a;
  perform pg_temp.sts_day4_expect(issued_number like 'STS-%', 'issued invoice receives an organization unique number');
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, %L::uuid, %L::uuid, current_date, current_date, 'USD', 'edit', '', 0, 0, %L::jsonb)$sql$, org_a, invoice_a, client_a, tampered),
    'issued invoice cannot be edited as a draft'
  );
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_issue_ws_invoice(%L::uuid, %L::uuid)', org_a, invoice_a),
    'issued invoice cannot be issued again'
  );
  perform public.sts_record_ws_invoice_payment(org_a, invoice_a);
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_record_ws_invoice_payment(%L::uuid, %L::uuid)', org_a, invoice_a),
    'paid invoice cannot be paid again'
  );
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_void_ws_invoice(%L::uuid, %L::uuid)', org_a, invoice_a),
    'paid invoice cannot be voided'
  );

  perform pg_temp.sts_day4_impersonate(admin_a, 'admin-a@day4.test');
  select public.sts_save_ws_invoice(org_a, null, client_a, current_date, current_date + 10, 'USD', '', '', 0, 0, lines) into invoice_a;
  perform public.sts_void_ws_invoice(org_a, invoice_a);
  perform pg_temp.sts_day4_expect_exception(
    format($sql$select public.sts_save_ws_invoice(%L::uuid, %L::uuid, %L::uuid, current_date, current_date, 'USD', 'edit', '', 0, 0, %L::jsonb)$sql$, org_a, invoice_a, client_a, lines),
    'void invoice cannot be edited'
  );
  perform public.sts_archive_ws_invoice(org_a, invoice_a);
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_void_ws_invoice(%L::uuid, %L::uuid)', org_a, invoice_a),
    'archived invoice cannot be mutated'
  );

  perform pg_temp.sts_day4_impersonate(owner_a, 'owner-a@day4.test');
  perform pg_temp.sts_day4_expect_blocked_write(
    format('delete from public.ws_notes where id = %L::uuid', note_a),
    'authenticated cannot hard-delete notes'
  );
  perform pg_temp.sts_day4_expect_blocked_write(
    format('delete from public.ws_invoices where organization_id = %L::uuid', org_a),
    'authenticated cannot hard-delete invoices'
  );
  perform public.sts_archive_ws_note(org_a, note_a);
  perform pg_temp.sts_day4_expect_exception(
    format('select public.sts_save_ws_note(%L::uuid, %L::uuid, %L, %L, %L, null, false)', org_a, note_a, 'Archived', 'Nope', 'none'),
    'archived note cannot be mutated'
  );

  perform pg_temp.sts_day4_impersonate(owner_b, 'owner-b@day4.test');
  execute 'select count(*) from public.ws_notes' into n;
  perform pg_temp.sts_day4_expect(n = 0, 'owner B cannot read org A notes');
  execute 'select count(*) from public.ws_invoices' into n;
  perform pg_temp.sts_day4_expect(n = 0, 'owner B cannot read org A invoices');
  execute 'select count(*) from public.audit_events where organization_id = ' || quote_literal(org_a) into n;
  perform pg_temp.sts_day4_expect(n = 0, 'owner B cannot read org A audit events');

  perform pg_temp.sts_day4_as_postgres();
  execute 'select count(*) from public.audit_events where organization_id = ' || quote_literal(org_a) || ' and action like ''ws_%''' into n;
  perform pg_temp.sts_day4_expect(n >= 6, 'workspace writes created audit events');

  raise notice 'DAY4_ISOLATION_RUNTIME_PASSED';
end;
$$;
