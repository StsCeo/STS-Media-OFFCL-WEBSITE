-- Executable Day 8 accountant-center isolation checks for the disposable local stack.
-- Uses synthetic @day8.test users and day8-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day8_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day8_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day8_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
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

create or replace function pg_temp.sts_day8_as_anon()
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

create or replace function pg_temp.sts_day8_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day8 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day8_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day8 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day8_expect_zero_rows(p_sql text, p_name text)
returns void language plpgsql as $$
declare n integer := -1;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
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
  raise exception 'day8 isolation failed: % (changed % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day8_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day8 isolation failed: % (got % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'd8111111-1111-4811-8811-111111111118';
  owner_b uuid := 'd8222222-2222-4822-8822-222222222228';
  admin_a uuid := 'd8333333-3333-4833-8833-333333333338';
  employee_a uuid := 'd8444444-4444-4844-8844-444444444448';
  accountant_a uuid := 'd8555555-5555-4855-8855-555555555558';
  contractor_a uuid := 'd8666666-6666-4866-8866-666666666668';
  client_a uuid := 'd8777777-7777-4877-8877-777777777778';
  stranger uuid := 'd8888888-8888-4888-8888-888888888888';
  org_a uuid := 'a8a8a8a8-a8a8-48a8-88a8-a8a8a8a8a8a8';
  org_b uuid := 'b8b8b8b8-b8b8-48b8-88b8-b8b8b8b8b8b8';
  n integer;
  paid_cents bigint;
  outstanding_cents bigint;
  expense_cents bigint;
  unreimbursed_cents bigint;
  crm_client_a uuid;
  crm_client_b uuid;
  invoice_draft uuid;
  invoice_open uuid;
  invoice_overdue uuid;
  invoice_paid uuid;
  invoice_archived uuid;
  expense_live uuid;
  expense_unreimbursed uuid;
  expense_archived uuid;
  revenue_paid uuid;
  estimate_id uuid;
  export_id uuid;
  meta jsonb;
  hidden integer;
begin
  if to_regprocedure('public.sts_list_accountant_invoices()') is null
     or to_regprocedure('public.sts_list_accountant_expenses()') is null
     or to_regprocedure('public.sts_list_accountant_revenue()') is null
     or to_regprocedure('public.sts_record_accountant_export(text,integer)') is null then
    raise exception 'day8 isolation aborted: accountant helpers are missing';
  end if;
  if to_regclass('public.sts_accountant_invoices') is not null
     or to_regclass('public.sts_accountant_expenses') is not null
     or to_regclass('public.sts_accountant_revenue') is not null
     or to_regclass('public.sts_accountant_monthly_summary') is not null then
    raise exception 'day8 isolation aborted: accountant views must be dropped';
  end if;

  perform pg_temp.sts_day8_as_postgres();
  delete from public.organizations where slug like 'day8-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day8_seed_auth_user(owner_a, 'owner-a@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(owner_b, 'owner-b@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(admin_a, 'admin-a@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(employee_a, 'employee-a@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(accountant_a, 'accountant-a@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(contractor_a, 'contractor-a@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(client_a, 'client-a@day8.test');
  perform pg_temp.sts_day8_seed_auth_user(stranger, 'stranger@day8.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day8 Test Org A', 'Day8 A', 'day8-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day8 Test Org B', 'Day8 B', 'day8-test-org-b', 'USD', 'America/New_York', 1);
  insert into public.organization_members (organization_id, user_id, role, status) values
    (org_a, owner_a, 'owner', 'active'),
    (org_b, owner_b, 'owner', 'active'),
    (org_a, admin_a, 'administrator', 'active'),
    (org_a, employee_a, 'employee', 'active'),
    (org_a, accountant_a, 'accountant', 'active'),
    (org_a, contractor_a, 'contractor', 'active'),
    (org_a, client_a, 'client', 'active');
  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix, default_payment_terms)
  values (org_a, 'STS', 'EST', 'Net 15'), (org_b, 'STS', 'EST', 'Net 15')
  on conflict (organization_id) do update set estimate_prefix = excluded.estimate_prefix;

  perform pg_temp.sts_day8_as_anon();
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_invoices()', 'anon cannot list accountant invoices');
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_expenses()', 'anon cannot list accountant expenses');
  perform pg_temp.sts_day8_expect_exception('select public.sts_list_accountant_finance_audit()', 'anon cannot list finance audit');
  perform pg_temp.sts_day8_expect_exception($sql$select public.sts_record_accountant_export('invoices', 1)$sql$, 'anon cannot record export');

  perform pg_temp.sts_day8_impersonate(accountant_a, 'accountant-a@day8.test', 'aal1');
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_invoices()', 'AAL1 accountant cannot list invoices');
  if public.sts_accountant_session_organization() is not null then
    raise exception 'day8 isolation failed: AAL1 accountant session organization is denied';
  end if;
  raise notice 'PASS AAL1 accountant session organization is null';
  perform pg_temp.sts_day8_expect_exception($sql$select public.sts_record_accountant_export('invoices', 1)$sql$, 'AAL1 accountant cannot export');

  perform pg_temp.sts_day8_impersonate(stranger, 'stranger@day8.test', 'aal2');
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_revenue()', 'no-membership user cannot list accountant revenue');
  perform pg_temp.sts_day8_expect_exception('select public.sts_list_accountant_finance_audit()', 'no-membership user cannot list finance audit');

  perform pg_temp.sts_day8_impersonate(employee_a, 'employee-a@day8.test', 'aal2');
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_invoices()', 'employee cannot list accountant invoices');
  perform pg_temp.sts_day8_expect_exception($sql$select public.sts_record_accountant_export('expenses', 1)$sql$, 'employee cannot record accountant export');

  perform pg_temp.sts_day8_impersonate(contractor_a, 'contractor-a@day8.test', 'aal2');
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_expenses()', 'contractor cannot list accountant expenses');

  perform pg_temp.sts_day8_impersonate(client_a, 'client-a@day8.test', 'aal2');
  perform pg_temp.sts_day8_expect_exception('select count(*) from public.sts_list_accountant_invoices()', 'client cannot list accountant invoices');

  perform pg_temp.sts_day8_impersonate(owner_a, 'owner-a@day8.test', 'aal2');
  select public.sts_save_crm_client(org_a, null, 'North Client', 'Casey', 'casey@day8.test', '555-0100', 'Auto', 'active', 'Internal CRM note') into crm_client_a;
  perform pg_temp.sts_day8_impersonate(owner_b, 'owner-b@day8.test', 'aal2');
  select public.sts_save_crm_client(org_b, null, 'South Client', 'Riley', 'riley@day8.test', '555-0199', 'Auto', 'active', '') into crm_client_b;

  perform pg_temp.sts_day8_impersonate(owner_a, 'owner-a@day8.test', 'aal2');
  select public.sts_save_ops_revenue(
    org_a, null, crm_client_a, null, 'Launch', 'Website launch', 100000, 'USD', 'STS-PAID',
    'one_time_project', current_date, current_date, current_date, 'paid', 'paid', 'check', false, true, 'Do not expose revenue notes'
  ) into revenue_paid;
  perform public.sts_save_ops_revenue(
    org_a, null, crm_client_a, null, 'Balance', 'Pending balance', 25000, 'USD', '',
    'final_payment', current_date, current_date + 14, null, 'sent', 'unpaid', '', false, false, 'Hidden outstanding note'
  );
  perform public.sts_save_ops_revenue(
    org_a, null, crm_client_a, null, 'Refund', 'Courtesy refund', 5000, 'USD', '',
    'refund', current_date, current_date, current_date, 'paid', 'paid', 'check', false, true, ''
  );
  select public.sts_save_ops_revenue(
    org_a, null, crm_client_a, null, 'Old job', 'Archived paid job', 99900, 'USD', '',
    'one_time_project', current_date - 40, current_date - 30, current_date - 30, 'paid', 'paid', 'check', false, true, ''
  ) into revenue_paid;
  perform public.sts_archive_ops_revenue(org_a, revenue_paid);

  select public.sts_save_ops_expense(
    org_a, null, current_date, current_date, 'Adobe', 'Design tools', 20000, 0, 'USD',
    'Software & Subscriptions', '', crm_client_a, null, '', 'Operating', 'card', false, 'one_time',
    null, 'missing', false, 'n/a', false, 'Hidden expense note'
  ) into expense_live;
  select public.sts_save_ops_expense(
    org_a, null, current_date, current_date, 'Owner', 'Mileage', 4000, 0, 'USD',
    'Travel & Mileage', '', null, null, '', '', '', false, 'one_time',
    null, 'missing', true, 'pending', false, ''
  ) into expense_unreimbursed;
  select public.sts_save_ops_expense(
    org_a, null, current_date - 20, current_date - 20, 'Old vendor', 'Archived printer', 8000, 0, 'USD',
    'Office Supplies', '', null, null, '', 'Operating', 'card', false, 'one_time',
    null, 'missing', false, 'n/a', false, ''
  ) into expense_archived;
  perform public.sts_archive_ops_expense(org_a, expense_archived);

  select public.sts_save_ws_estimate(
    org_a, null, crm_client_a, 'Open quote', 'Estimate is not revenue', current_date, current_date + 21,
    'USD', 'Internal estimate notes', '', '', 'North Client', 'Casey', 'casey@day8.test', 0,
    '[{"description":"Website quote","quantity":1,"unit_cents":500000,"discount_cents":0}]'::jsonb
  ) into estimate_id;

  select public.sts_save_ws_invoice(
    org_a, null, crm_client_a, current_date, current_date + 10, 'USD', 'Hidden invoice notes', 'Wire instructions', 0, 0,
    '[{"description":"Draft work","quantity":1,"unit_cents":9000}]'::jsonb
  ) into invoice_draft;
  select public.sts_save_ws_invoice(
    org_a, null, crm_client_a, current_date, current_date + 14, 'USD', 'Hidden invoice notes', '', 0, 0,
    '[{"description":"Open work","quantity":1,"unit_cents":15000}]'::jsonb
  ) into invoice_open;
  perform public.sts_issue_ws_invoice(org_a, invoice_open);
  select public.sts_save_ws_invoice(
    org_a, null, crm_client_a, current_date - 20, current_date - 5, 'USD', 'Hidden invoice notes', '', 0, 0,
    '[{"description":"Overdue work","quantity":1,"unit_cents":7500}]'::jsonb
  ) into invoice_overdue;
  perform public.sts_issue_ws_invoice(org_a, invoice_overdue);
  select public.sts_save_ws_invoice(
    org_a, null, crm_client_a, current_date - 15, current_date - 1, 'USD', 'Hidden invoice notes', '', 0, 0,
    '[{"description":"Paid work","quantity":1,"unit_cents":30000}]'::jsonb
  ) into invoice_paid;
  perform public.sts_issue_ws_invoice(org_a, invoice_paid);
  perform public.sts_record_ws_invoice_payment(org_a, invoice_paid);
  select public.sts_save_ws_invoice(
    org_a, null, crm_client_a, current_date - 40, current_date - 30, 'USD', 'Hidden invoice notes', '', 0, 0,
    '[{"description":"Archived invoice","quantity":1,"unit_cents":50000}]'::jsonb
  ) into invoice_archived;
  perform public.sts_issue_ws_invoice(org_a, invoice_archived);
  perform public.sts_archive_ws_invoice(org_a, invoice_archived);

  perform pg_temp.sts_day8_impersonate(owner_b, 'owner-b@day8.test', 'aal2');
  perform public.sts_save_ops_revenue(
    org_b, null, crm_client_b, null, 'Other org', 'Org B paid job', 77700, 'USD', '',
    'one_time_project', current_date, current_date, current_date, 'paid', 'paid', 'check', false, true, ''
  );

  perform pg_temp.sts_day8_impersonate(accountant_a, 'accountant-a@day8.test', 'aal2');
  execute $sql$select count(*) from public.sts_list_accountant_invoices()$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 5, 'accountant AAL2 can list org A invoices through the safe read function');
  execute $sql$select count(*) from public.sts_list_accountant_invoices() where client_business_name = 'South Client'$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 0, 'accountant invoice function cannot return another organization');
  execute $sql$select count(*) from public.sts_list_accountant_revenue() where description = 'Org B paid job'$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 0, 'accountant cannot read org B revenue');

  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_invoices', 'accountant cannot select invoice base table');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_invoice_lines', 'accountant cannot select invoice lines');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_invoice_counters', 'accountant cannot select invoice counters');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ops_expenses', 'accountant cannot select expense base table');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ops_revenue', 'accountant cannot select revenue base table');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_documents', 'accountant cannot select documents');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.business_settings', 'accountant cannot select business settings');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_invoices where notes <> ''''', 'accountant cannot select invoice notes');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_invoices where payment_instructions <> ''''', 'accountant cannot select payment instructions');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_invoices where client_email <> ''''', 'accountant cannot select client email');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ops_expenses where payment_account <> ''''', 'accountant cannot select expense payment account');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ops_revenue where notes <> ''''', 'accountant cannot select revenue notes');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ops_projects', 'accountant cannot select projects');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ops_tasks', 'accountant cannot select tasks');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_notes', 'accountant cannot select notes');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_calendar_events', 'accountant cannot select calendar');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.ws_estimates', 'accountant cannot select estimates');
  perform pg_temp.sts_day8_expect_denied_or_zero('select count(*) from public.crm_clients', 'accountant cannot select CRM clients');
  perform pg_temp.sts_day8_expect_exception(
    'select notes from public.sts_list_accountant_invoices()',
    'accountant invoice function has no notes column'
  );
  perform pg_temp.sts_day8_expect_exception(
    'select payment_instructions from public.sts_list_accountant_invoices()',
    'accountant invoice function has no payment instructions column'
  );
  perform pg_temp.sts_day8_expect_exception(
    $sql$select public.sts_list_accountant_invoices('a8a8a8a8-a8a8-48a8-88a8-a8a8a8a8a8a8'::uuid)$sql$,
    'accountant invoice function rejects a client-supplied organization id'
  );

  select count(*) into hidden
  from information_schema.routines r
  join information_schema.parameters p
    on r.specific_name = p.specific_name
   and r.specific_schema = p.specific_schema
  where r.specific_schema = 'public'
    and r.routine_name = 'sts_list_accountant_invoices'
    and p.parameter_mode = 'OUT'
    and p.parameter_name in ('notes', 'payment_instructions', 'client_email', 'client_contact_name', 'client_id');
  perform pg_temp.sts_day8_expect(hidden = 0, 'invoice function withholds notes, emails, and payment instructions');
  select count(*) into hidden
  from information_schema.routines r
  join information_schema.parameters p
    on r.specific_name = p.specific_name
   and r.specific_schema = p.specific_schema
  where r.specific_schema = 'public'
    and r.routine_name in ('sts_list_accountant_expenses', 'sts_list_accountant_revenue')
    and p.parameter_mode = 'OUT'
    and p.parameter_name in ('notes', 'payment_account', 'payment_method', 'client_id', 'project_id');
  perform pg_temp.sts_day8_expect(hidden = 0, 'expense and revenue functions withhold notes and payment details');

  execute $sql$
    select coalesce(sum(amount_cents), 0)
    from public.sts_list_accountant_revenue()
    where archived_at is null
      and payment_status = 'paid'
      and entry_type <> 'refund'
  $sql$ into paid_cents;
  execute $sql$
    select coalesce(sum(amount_cents), 0)
    from public.sts_list_accountant_revenue()
    where archived_at is null
      and payment_status in ('unpaid', 'pending')
  $sql$ into outstanding_cents;
  execute $sql$
    select coalesce(sum(total_cents), 0)
    from public.sts_list_accountant_expenses()
    where archived_at is null
  $sql$ into expense_cents;
  execute $sql$
    select coalesce(sum(total_cents), 0)
    from public.sts_list_accountant_expenses()
    where archived_at is null
      and reimbursable
      and reimbursement_status <> 'reimbursed'
  $sql$ into unreimbursed_cents;
  perform pg_temp.sts_day8_expect(paid_cents = 100000, 'paid revenue excludes refunds, estimates, and archived rows');
  perform pg_temp.sts_day8_expect(outstanding_cents = 25000, 'outstanding revenue is unpaid operational revenue');
  perform pg_temp.sts_day8_expect(expense_cents = 24000, 'non-archived expenses include unreimbursed live rows only as live expenses');
  perform pg_temp.sts_day8_expect(unreimbursed_cents = 4000, 'unreimbursed expenses are pending reimbursable rows');
  execute $sql$select count(*) from public.sts_list_accountant_revenue() where description = 'Estimate is not revenue'$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 0, 'estimates are not sourced as accountant revenue');
  execute $sql$select count(*) from public.sts_list_accountant_invoices() where archived_at is not null$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 1, 'archived invoices remain visible and labeled in the function');

  perform pg_temp.sts_day8_expect_exception(
    format($sql$insert into public.ws_invoices (organization_id, invoice_number, status, currency, client_business_name, subtotal_cents, discount_cents, tax_cents, total_cents, amount_paid_cents) values (%L, 'HACK-1', 'draft', 'USD', 'Nope', 0, 0, 0, 0, 0)$sql$, org_a),
    'accountant cannot insert invoices'
  );
  perform pg_temp.sts_day8_expect_zero_rows(
    format($sql$update public.ws_invoices set notes = 'hack' where id = %L::uuid$sql$, invoice_draft),
    'accountant cannot update invoices'
  );
  perform pg_temp.sts_day8_expect_zero_rows(
    format($sql$update public.ws_invoices set organization_id = %L::uuid where id = %L::uuid$sql$, org_b, invoice_draft),
    'accountant cannot reassign invoice organization'
  );
  perform pg_temp.sts_day8_expect_zero_rows(
    format($sql$delete from public.ops_expenses where id = %L::uuid$sql$, expense_live),
    'accountant cannot delete expenses'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_save_ops_expense(%L::uuid, %L::uuid, current_date, current_date, 'Hack', 'Nope', 1, 0, 'USD', 'Office Supplies', '', null, null, '', '', '', false, 'one_time', null, 'missing', false, 'n/a', false, '')$sql$, org_a, expense_live),
    'accountant cannot execute expense save RPC'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_archive_ops_expense(%L::uuid, %L::uuid)$sql$, org_a, expense_live),
    'accountant cannot execute expense archive RPC'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_save_ops_revenue(%L::uuid, null, null, null, 'Hack', 'Nope', 1, 'USD', '', 'one_time_project', current_date, null, null, 'draft', 'unpaid', '', false, false, '')$sql$, org_a),
    'accountant cannot execute revenue save RPC'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_issue_ws_invoice(%L::uuid, %L::uuid)$sql$, org_a, invoice_draft),
    'accountant cannot issue invoices'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_record_ws_invoice_payment(%L::uuid, %L::uuid)$sql$, org_a, invoice_open),
    'accountant cannot record invoice payment'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_a, invoice_paid),
    'accountant cannot start a project'
  );
  perform pg_temp.sts_day8_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'accountant cannot reconcile the schedule'
  );

  select public.sts_record_accountant_export('invoices', 5) into export_id;
  perform pg_temp.sts_day8_expect(export_id is not null, 'accountant export audit succeeds');
  perform pg_temp.sts_day8_expect_exception($sql$select public.sts_record_accountant_export('payroll', 1)$sql$, 'unknown export types are rejected');

  perform pg_temp.sts_day8_as_postgres();
  select metadata into meta
  from public.audit_events
  where id = export_id;
  perform pg_temp.sts_day8_expect(
    meta ? 'export_type' and meta ? 'row_count'
      and (select count(*) from jsonb_each(meta)) = 2
      and meta ->> 'export_type' = 'invoices'
      and (meta ->> 'row_count')::int = 5
      and meta::text not ilike '%North Client%'
      and meta::text not ilike '%Hidden%',
    'export audit stores type and count only'
  );
  execute $sql$
    select count(*) from public.audit_events
    where organization_id = $1 and action = 'accountant.exported'
  $sql$ into n using org_a;
  perform pg_temp.sts_day8_expect(n = 1, 'ordinary accountant reads are not audited');

  perform pg_temp.sts_day8_impersonate(admin_a, 'admin-a@day8.test', 'aal2');
  execute $sql$select count(*) from public.sts_list_accountant_invoices()$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 5, 'administrator can oversee accountant invoice function');
  execute $sql$select count(*) from public.ws_invoices$sql$ into n;
  perform pg_temp.sts_day8_expect(n = 5, 'administrator can still select invoice base table');

  perform pg_temp.sts_day8_impersonate(owner_a, 'owner-a@day8.test', 'aal2');
  execute $sql$select count(*) from public.sts_list_accountant_finance_audit() where action like 'ws_invoice.%' or action like 'ops_%' or action = 'accountant.exported'$sql$ into n;
  perform pg_temp.sts_day8_expect(n >= 1, 'owner can read sanitized finance audit through the accountant RPC');
  execute $sql$select count(*) from public.ops_expenses$sql$ into n;
  perform pg_temp.sts_day8_expect(n >= 1, 'owner can still select expense base table');

  raise notice 'DAY8_ISOLATION_RUNTIME_PASSED';
end;
$$;
