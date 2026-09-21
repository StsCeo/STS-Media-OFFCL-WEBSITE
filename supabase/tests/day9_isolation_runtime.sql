-- Executable Day 9 client-portal isolation checks for the disposable local stack.
-- Uses synthetic @day9.test users and day9-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day9_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day9_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day9_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
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

create or replace function pg_temp.sts_day9_as_anon()
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

create or replace function pg_temp.sts_day9_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day9 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day9_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day9 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day9_expect_zero_rows(p_sql text, p_name text)
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
      if sqlerrm ilike '%permission denied%' or sqlerrm ilike '%not authorized%' or sqlerrm ilike '%immutable%' then
        raise notice 'PASS % (denied)', p_name;
        return;
      end if;
      raise;
  end;
  if n = 0 then
    raise notice 'PASS % (zero rows)', p_name;
    return;
  end if;
  raise exception 'day9 isolation failed: % (changed % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day9_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day9 isolation failed: % (got % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'd9111111-1111-4911-8911-111111111119';
  owner_b uuid := 'd9222222-2222-4922-8922-222222222229';
  admin_a uuid := 'd9333333-3333-4933-8933-333333333339';
  employee_a uuid := 'd9444444-4444-4944-8944-444444444449';
  accountant_a uuid := 'd9555555-5555-4955-8955-555555555559';
  contractor_a uuid := 'd9666666-6666-4966-8966-666666666669';
  client_a uuid := 'd9777777-7777-4977-8977-777777777779';
  client_b uuid := 'd9888888-8888-4988-8988-888888888889';
  client_c uuid := 'd9999999-9999-4999-8999-999999999999';
  stranger uuid := 'd9000000-0000-4900-8900-000000000009';
  org_a uuid := 'a9a9a9a9-a9a9-49a9-89a9-a9a9a9a9a9a9';
  org_b uuid := 'b9b9b9b9-b9b9-49b9-89b9-b9b9b9b9b9b9';
  doc_a uuid := 'c9c9c9c9-c9c9-49c9-89c9-c9c9c9c9c9c9';
  doc_b uuid := 'c8c8c8c8-c8c8-48c8-88c8-c8c8c8c8c8c8';
  n integer;
  crm_a uuid;
  crm_b uuid;
  crm_c uuid;
  estimate_a uuid;
  estimate_b uuid;
  estimate_unpub uuid;
  invoice_a uuid;
  invoice_b uuid;
  project_a uuid;
  project_b uuid;
  pub_id uuid;
  identity_a uuid;
  identity_b uuid;
  hidden integer;
  meta jsonb;
  session_org uuid;
  session_client uuid;
begin
  if to_regprocedure('public.sts_list_client_portal_invoices()') is null
     or to_regprocedure('public.sts_publish_client_portal_record(text,uuid)') is null
     or to_regprocedure('public.sts_client_portal_session()') is null then
    raise exception 'day9 isolation aborted: client portal helpers are missing';
  end if;

  perform pg_temp.sts_day9_as_postgres();
  delete from public.organizations where slug like 'day9-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day9_seed_auth_user(owner_a, 'owner-a@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(owner_b, 'owner-b@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(admin_a, 'admin-a@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(employee_a, 'employee-a@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(accountant_a, 'accountant-a@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(contractor_a, 'contractor-a@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(client_a, 'client-a@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(client_b, 'client-b@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(client_c, 'client-c@day9.test');
  perform pg_temp.sts_day9_seed_auth_user(stranger, 'stranger@day9.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day9 Test Org A', 'Day9 A', 'day9-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day9 Test Org B', 'Day9 B', 'day9-test-org-b', 'USD', 'America/New_York', 1);
  insert into public.organization_members (organization_id, user_id, role, status) values
    (org_a, owner_a, 'owner', 'active'),
    (org_b, owner_b, 'owner', 'active'),
    (org_a, admin_a, 'administrator', 'active'),
    (org_a, employee_a, 'employee', 'active'),
    (org_a, accountant_a, 'accountant', 'active'),
    (org_a, contractor_a, 'contractor', 'active'),
    (org_a, client_a, 'client', 'active'),
    (org_a, client_b, 'client', 'active'),
    (org_b, client_c, 'client', 'active');
  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix, default_payment_terms)
  values (org_a, 'STS', 'EST', 'Net 15'), (org_b, 'STS', 'EST', 'Net 15')
  on conflict (organization_id) do update set estimate_prefix = excluded.estimate_prefix;

  perform pg_temp.sts_day9_as_anon();
  perform pg_temp.sts_day9_expect_exception('select count(*) from public.sts_list_client_portal_invoices()', 'anon cannot list client invoices');
  perform pg_temp.sts_day9_expect_exception($sql$select public.sts_publish_client_portal_record('invoice', '00000000-0000-4000-8000-000000000001')$sql$, 'anon cannot publish');

  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal1');
  perform pg_temp.sts_day9_expect_exception('select count(*) from public.sts_list_client_portal_estimates()', 'AAL1 client cannot list estimates');
  select s.organization_id into session_org from public.sts_client_portal_session() s;
  perform pg_temp.sts_day9_expect(session_org is null, 'AAL1 client session is empty');

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  select public.sts_save_crm_client(org_a, null, 'North Client', 'Casey', 'casey@day9.test', '555-0100', 'Auto', 'active', 'Internal CRM note') into crm_a;
  select public.sts_save_crm_client(org_a, null, 'East Client', 'Drew', 'drew@day9.test', '555-0101', 'Auto', 'active', 'Other client note') into crm_b;
  perform pg_temp.sts_day9_impersonate(owner_b, 'owner-b@day9.test', 'aal2');
  select public.sts_save_crm_client(org_b, null, 'South Client', 'Riley', 'riley@day9.test', '555-0199', 'Auto', 'active', '') into crm_c;

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  select public.sts_link_client_portal_identity(client_a, crm_a) into identity_a;
  select public.sts_link_client_portal_identity(client_b, crm_b) into identity_b;
  perform pg_temp.sts_day9_expect(identity_a is not null and identity_b is not null, 'owner can link two same-organization client mappings');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_link_client_portal_identity(%L, %L)', client_a, crm_b),
    'owner cannot reassign an identity to a different CRM client'
  );

  perform pg_temp.sts_day9_impersonate(employee_a, 'employee-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_link_client_portal_identity(%L, %L)', client_a, crm_a),
    'employee cannot link client portal identities'
  );

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  select public.sts_save_ws_estimate(
    org_a, null, crm_a, 'North quote', 'Customer facing description', current_date, current_date + 21,
    'USD', 'Internal estimate notes', 'Customer estimate notes', 'Net 15', 'Day9 A', 'Day9 A', 'North Client', 'Casey', 0,
    '[{"description":"Website quote","quantity":1,"unit_cents":500000,"discount_cents":0}]'::jsonb
  ) into estimate_a;
  select public.sts_save_ws_estimate(
    org_a, null, crm_b, 'East quote', 'Other client quote', current_date, current_date + 21,
    'USD', 'Internal estimate notes', 'East customer notes', 'Net 15', 'Day9 A', 'Day9 A', 'East Client', 'Drew', 0,
    '[{"description":"Brand quote","quantity":1,"unit_cents":250000,"discount_cents":0}]'::jsonb
  ) into estimate_b;
  select public.sts_save_ws_estimate(
    org_a, null, crm_a, 'Unpublished quote', 'Should stay hidden', current_date, current_date + 10,
    'USD', 'Internal unpublished notes', 'Customer unpublished notes', '', 'Day9 A', 'Day9 A', 'North Client', 'Casey', 0,
    '[{"description":"Hidden quote","quantity":1,"unit_cents":1000,"discount_cents":0}]'::jsonb
  ) into estimate_unpub;
  select public.sts_save_ws_invoice(
    org_a, null, crm_a, current_date, current_date + 14, 'USD', 'Hidden invoice notes', 'Wire instructions 123', 0, 0,
    '[{"description":"Open work","quantity":1,"unit_cents":15000}]'::jsonb
  ) into invoice_a;
  perform public.sts_issue_ws_invoice(org_a, invoice_a);
  select public.sts_save_ws_invoice(
    org_a, null, crm_b, current_date, current_date + 14, 'USD', 'East invoice notes', 'Private payment', 0, 0,
    '[{"description":"East work","quantity":1,"unit_cents":8800}]'::jsonb
  ) into invoice_b;
  perform public.sts_issue_ws_invoice(org_a, invoice_b);
  select public.sts_save_ops_project(
    org_a, null, crm_a, 'North site', 'Client facing project description', 'in_development', 'high',
    current_date, current_date + 30, 900000, null, 'Owner', true, 'Internal project notes'
  ) into project_a;
  select public.sts_save_ops_project(
    org_a, null, crm_b, 'East brand', 'East project description', 'discovery', 'low',
    current_date, current_date + 40, 400000, null, 'Owner', false, 'East internal notes'
  ) into project_b;
  perform public.sts_save_ws_document(
    org_a, doc_a,
    org_a::text || '/' || doc_a::text || '/welcome.txt',
    'welcome.txt', 'text/plain', 12, 'Safe client description', 'other', crm_a, null
  );
  perform public.sts_save_ws_document(
    org_a, doc_b,
    org_a::text || '/' || doc_b::text || '/east.txt',
    'east.txt', 'text/plain', 12, 'East description', 'other', crm_b, null
  );

  perform public.sts_publish_client_portal_record('estimate', estimate_a);
  perform public.sts_publish_client_portal_record('invoice', invoice_a);
  perform public.sts_publish_client_portal_record('project', project_a);
  perform public.sts_publish_client_portal_record('document', doc_a);
  perform public.sts_publish_client_portal_record('estimate', estimate_b);
  perform public.sts_publish_client_portal_record('invoice', invoice_b);
  perform public.sts_publish_client_portal_record('project', project_b);
  perform public.sts_publish_client_portal_record('document', doc_b);
  perform pg_temp.sts_day9_impersonate(admin_a, 'admin-a@day9.test', 'aal2');
  perform public.sts_publish_client_portal_record('estimate', estimate_unpub);
  perform public.sts_unpublish_client_portal_record('estimate', estimate_unpub);
  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_publish_client_portal_record(%L, %L)', 'invoice', invoice_a),
    'duplicate live publication is rejected'
  );

  perform pg_temp.sts_day9_impersonate(employee_a, 'employee-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_publish_client_portal_record(%L, %L)', 'invoice', invoice_a),
    'employee cannot publish'
  );
  perform pg_temp.sts_day9_impersonate(accountant_a, 'accountant-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_unpublish_client_portal_record(%L, %L)', 'invoice', invoice_a),
    'accountant cannot unpublish'
  );
  perform pg_temp.sts_day9_impersonate(contractor_a, 'contractor-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_publish_client_portal_record(%L, %L)', 'project', project_a),
    'contractor cannot publish'
  );

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_list_client_portal_invoices()'),
    'owner cannot silently use the client invoice read function'
  );

  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal2');
  select s.organization_id, s.crm_client_id into session_org, session_client from public.sts_client_portal_session() s;
  perform pg_temp.sts_day9_expect(session_org = org_a and session_client = crm_a, 'client A AAL2 session maps to CRM A');
  execute 'select count(*) from public.sts_list_client_portal_invoices()' into n;
  perform pg_temp.sts_day9_expect(n = 1, 'client A sees only the one published invoice');
  execute 'select count(*) from public.sts_list_client_portal_invoices() where client_business_name = ''East Client''' into n;
  perform pg_temp.sts_day9_expect(n = 0, 'client A cannot read client B invoice identity');
  execute 'select count(*) from public.sts_list_client_portal_estimates()' into n;
  perform pg_temp.sts_day9_expect(n = 1, 'unpublished estimate is not listed for client A');
  execute format('select count(*) from public.sts_get_client_portal_invoice(%L)', invoice_b) into n;
  perform pg_temp.sts_day9_expect(n = 0, 'client A cannot get client B invoice by id');
  execute 'select count(*) from public.sts_list_client_portal_projects() where name = ''East brand''' into n;
  perform pg_temp.sts_day9_expect(n = 0, 'client A cannot read client B project');
  execute 'select count(*) from public.sts_list_client_portal_documents()' into n;
  perform pg_temp.sts_day9_expect(n = 1, 'client A sees only the published document');
  perform pg_temp.sts_day9_expect_exception(
    'select storage_path from public.sts_list_client_portal_documents()',
    'document list does not expose storage_path'
  );
  perform pg_temp.sts_day9_expect_exception(
    'select notes, payment_instructions, client_email from public.sts_list_client_portal_invoices()',
    'invoice list does not expose notes, payment instructions, or email'
  );
  perform pg_temp.sts_day9_expect_exception(
    'select internal_notes from public.sts_list_client_portal_estimates()',
    'estimate list does not expose internal notes'
  );
  perform pg_temp.sts_day9_expect_exception(
    'select budget_cents, notes, assigned_to from public.sts_list_client_portal_projects()',
    'project list does not expose budget, notes, or assignment'
  );
  perform pg_temp.sts_day9_expect_denied_or_zero('select count(*) from public.ws_invoices', 'client A cannot SELECT ws_invoices');
  perform pg_temp.sts_day9_expect_denied_or_zero('select count(*) from public.ws_estimates', 'client A cannot SELECT ws_estimates');
  perform pg_temp.sts_day9_expect_denied_or_zero('select count(*) from public.ops_projects', 'client A cannot SELECT ops_projects');
  perform pg_temp.sts_day9_expect_denied_or_zero('select count(*) from public.ws_documents', 'client A cannot SELECT ws_documents');
  perform pg_temp.sts_day9_expect_denied_or_zero('select count(*) from public.client_portal_publications', 'client A cannot SELECT publications');
  perform pg_temp.sts_day9_expect_denied_or_zero('select count(*) from public.client_portal_identities', 'client A cannot SELECT identities');
  perform pg_temp.sts_day9_expect_zero_rows(
    format('insert into public.client_portal_publications (organization_id, crm_client_id, source_type, source_id) values (%L, %L, %L, %L)', org_a, crm_a, 'estimate', estimate_unpub),
    'client cannot insert publications'
  );
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_publish_client_portal_record(%L, %L)', 'estimate', estimate_unpub),
    'client cannot publish'
  );
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_save_ws_invoice(%L, null, %L, current_date, current_date + 7, %L, %L, %L, 0, 0, %L)', org_a, crm_a, 'USD', '', '', '[{"description":"Nope","quantity":1,"unit_cents":100}]'),
    'client cannot write invoices'
  );
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_client_portal_document_object_name(%L)', doc_a),
    'authenticated client cannot execute the object-name function'
  );
  execute format('select count(*) from public.sts_client_portal_authorize_document(%L)', doc_a) into n;
  perform pg_temp.sts_day9_expect(n = 1, 'client A can authorize the published document');
  begin
    perform public.sts_client_portal_authorize_document(doc_b);
    raise exception 'day9 isolation failed: client A authorized client B document';
  exception
    when others then
      if sqlerrm ilike '%not authorized%' then
        raise notice 'PASS client A cannot authorize client B document';
      else
        raise;
      end if;
  end;

  perform pg_temp.sts_day9_impersonate(client_b, 'client-b@day9.test', 'aal2');
  execute 'select count(*) from public.sts_list_client_portal_invoices() where client_business_name = ''North Client''' into n;
  perform pg_temp.sts_day9_expect(n = 0, 'client B cannot read client A invoices');
  execute 'select count(*) from public.sts_list_client_portal_invoices()' into n;
  perform pg_temp.sts_day9_expect(n = 1, 'client B still sees its own published invoice');

  perform pg_temp.sts_day9_impersonate(owner_b, 'owner-b@day9.test', 'aal2');
  select public.sts_link_client_portal_identity(client_c, crm_c) into identity_a;
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_publish_client_portal_record(%L, %L)', 'invoice', invoice_a),
    'cross-organization owner cannot publish org A invoices'
  );

  perform pg_temp.sts_day9_impersonate(client_c, 'client-c@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_denied_or_zero(
    'select count(*) from public.sts_list_client_portal_invoices()',
    'org B client cannot read org A published invoices'
  );

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  perform public.sts_unpublish_client_portal_record('invoice', invoice_a);
  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal2');
  execute 'select count(*) from public.sts_list_client_portal_invoices()' into n;
  perform pg_temp.sts_day9_expect(n = 0, 'unpublishing immediately removes client A invoice access');

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  perform public.sts_publish_client_portal_record('invoice', invoice_a);
  perform public.sts_archive_ws_estimate(org_a, estimate_a);
  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal2');
  execute 'select count(*) from public.sts_list_client_portal_estimates()' into n;
  perform pg_temp.sts_day9_expect(n = 0, 'archiving a published estimate removes portal access');

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception(
    format('select public.sts_publish_client_portal_record(%L, %L)', 'estimate', estimate_a),
    'archived records cannot be newly published'
  );

  perform pg_temp.sts_day9_as_postgres();
  update public.organization_members set status = 'disabled' where user_id = client_a and organization_id = org_a;
  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception('select count(*) from public.sts_list_client_portal_projects()', 'inactive membership cannot list projects');
  perform pg_temp.sts_day9_as_postgres();
  update public.organization_members set status = 'active' where user_id = client_a and organization_id = org_a;
  update public.client_portal_identities set status = 'disabled' where user_id = client_a and organization_id = org_a;
  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_exception('select count(*) from public.sts_list_client_portal_documents()', 'inactive mapping cannot list documents');
  perform pg_temp.sts_day9_as_postgres();
  update public.client_portal_identities set status = 'active' where user_id = client_a and organization_id = org_a;

  perform pg_temp.sts_day9_impersonate(owner_a, 'owner-a@day9.test', 'aal2');
  execute $sql$
    select count(*) from public.audit_events
    where organization_id = $1
      and action in ('client_portal.published', 'client_portal.unpublished', 'client_portal.document_downloaded')
  $sql$ into n using org_a;
  perform pg_temp.sts_day9_expect(n >= 3, 'sanitized client portal audit actions were recorded');
  execute $sql$
    select count(*) from public.audit_events
    where organization_id = $1
      and action like 'client_portal.%'
      and (
        metadata::text ilike '%storage_path%'
        or metadata::text ilike '%payment_instructions%'
        or metadata::text ilike '%internal_notes%'
        or metadata::text ilike '%Wire instructions%'
        or metadata::text ilike '%https://%'
      )
  $sql$ into hidden using org_a;
  perform pg_temp.sts_day9_expect(hidden = 0, 'client portal audits omit storage paths, notes, and URLs');

  perform pg_temp.sts_day9_impersonate(client_a, 'client-a@day9.test', 'aal2');
  perform pg_temp.sts_day9_expect_zero_rows(
    format('delete from public.client_portal_publications where source_id = %L', invoice_a),
    'client cannot hard-delete publications'
  );

  raise notice 'DAY9_ISOLATION_RUNTIME_PASSED';
end;
$$;
