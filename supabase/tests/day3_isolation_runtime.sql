-- Executable Day 3 finance/operations isolation checks for the disposable local stack.
-- Uses synthetic @day3.test users and day3-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day3_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day3_as_postgres()
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

create or replace function pg_temp.sts_day3_impersonate(p_user_id uuid, p_email text)
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

create or replace function pg_temp.sts_day3_as_anon()
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

create or replace function pg_temp.sts_day3_expect(p_ok boolean, p_name text)
returns void
language plpgsql
as $$
begin
  if not p_ok then
    raise exception 'day3 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day3_expect_exception(p_sql text, p_name text)
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
  raise exception 'day3 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day3_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day3 isolation failed: % (got % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day3_expect_blocked_write(p_sql text, p_name text)
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
  raise exception 'day3 isolation failed: % (wrote % rows)', p_name, n;
end;
$$;

create or replace function pg_temp.sts_day3_expense_sql(
  p_org uuid,
  p_id uuid default null,
  p_vendor text default 'Vendor Co',
  p_description text default 'Test expense',
  p_cents bigint default 100,
  p_category text default 'Other',
  p_frequency text default 'one_time',
  p_reimb_status text default 'n/a'
)
returns text
language sql
as $$
  select format(
    $sql$select public.sts_save_ops_expense(
      p_organization_id := %L::uuid,
      p_id := %s,
      p_transaction_date := current_date,
      p_posted_date := current_date,
      p_vendor := %L,
      p_description := %L,
      p_pretax_cents := %s,
      p_tax_cents := 0,
      p_currency := 'USD',
      p_category := %L,
      p_subcategory := '',
      p_client_id := null,
      p_project_id := null,
      p_business_purpose := '',
      p_payment_account := '',
      p_payment_method := '',
      p_recurring := false,
      p_billing_frequency := %L,
      p_receipt_name := null,
      p_receipt_status := 'missing',
      p_reimbursable := false,
      p_reimbursement_status := %L,
      p_direct_project_cost := false,
      p_notes := '')$sql$,
    p_org,
    case when p_id is null then 'null' else quote_literal(p_id::text) || '::uuid' end,
    p_vendor,
    p_description,
    p_cents::text,
    p_category,
    p_frequency,
    p_reimb_status
  );
$$;

do $$
declare
  owner_a uuid := 'e1111111-1111-4111-8111-111111111111';
  owner_b uuid := 'e2222222-2222-4222-8222-222222222222';
  admin_a uuid := 'e3333333-3333-4333-8333-333333333333';
  member_a uuid := 'e4444444-4444-4444-8444-444444444444';
  accountant_a uuid := 'e5555555-5555-4555-8555-555555555555';
  stranger uuid := 'e6666666-6666-4666-8666-666666666666';
  org_a uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  org_b uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  n integer;
  client_a uuid;
  client_b uuid;
  project_a uuid;
  project_b uuid;
  expense_a uuid;
  revenue_a uuid;
  task_a uuid;
begin
  if to_regclass('public.ops_expenses') is null or to_regclass('public.ops_revenue') is null
     or to_regclass('public.ops_projects') is null or to_regclass('public.ops_tasks') is null then
    raise exception 'day3 isolation aborted: finance/operations tables are missing';
  end if;

  perform pg_temp.sts_day3_as_postgres();
  delete from public.organizations where slug like 'day3-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day3_seed_auth_user(owner_a, 'owner-a@day3.test');
  perform pg_temp.sts_day3_seed_auth_user(owner_b, 'owner-b@day3.test');
  perform pg_temp.sts_day3_seed_auth_user(admin_a, 'admin-a@day3.test');
  perform pg_temp.sts_day3_seed_auth_user(member_a, 'member-a@day3.test');
  perform pg_temp.sts_day3_seed_auth_user(accountant_a, 'accountant-a@day3.test');
  perform pg_temp.sts_day3_seed_auth_user(stranger, 'stranger@day3.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day3 Test Org A', 'Org A', 'day3-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day3 Test Org B', 'Org B', 'day3-test-org-b', 'USD', 'America/Chicago', 1);

  insert into public.business_settings (organization_id)
  values (org_a), (org_b)
  on conflict (organization_id) do nothing;

  insert into public.organization_members (
    organization_id, user_id, role, status, invited_at, accepted_at
  ) values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, admin_a, 'administrator', 'active', now(), now()),
    (org_a, member_a, 'employee', 'active', now(), now()),
    (org_a, accountant_a, 'accountant', 'active', now(), now());

  perform pg_temp.sts_day3_as_anon();
  perform pg_temp.sts_day3_expect_denied_or_zero('select count(*) from public.ops_expenses', 'anon cannot select ops_expenses');
  perform pg_temp.sts_day3_expect_denied_or_zero('select count(*) from public.ops_revenue', 'anon cannot select ops_revenue');
  perform pg_temp.sts_day3_expect_denied_or_zero('select count(*) from public.ops_projects', 'anon cannot select ops_projects');
  perform pg_temp.sts_day3_expect_denied_or_zero('select count(*) from public.ops_tasks', 'anon cannot select ops_tasks');
  perform pg_temp.sts_day3_expect_exception(
    pg_temp.sts_day3_expense_sql(org_a, p_vendor := 'Vendor Co', p_description := 'Anon write'),
    'anon cannot save an expense'
  );

  perform pg_temp.sts_day3_impersonate(stranger, 'stranger@day3.test');
  perform pg_temp.sts_day3_expect_denied_or_zero('select count(*) from public.ops_expenses', 'stranger cannot select ops_expenses');
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_project(%L::uuid, null, null, %L, %L, %L, %L, current_date, current_date, 0, null, %L, false, %L)',
      org_a, 'Stranger project', '', 'lead', 'medium', 'Owner', ''),
    'stranger cannot save a project'
  );

  perform pg_temp.sts_day3_impersonate(owner_b, 'owner-b@day3.test');
  select public.sts_save_crm_client(org_b, null, 'Org B Client', 'Blake', '', '', 'Auto', 'active', '') into client_b;
  perform pg_temp.sts_day3_expect(client_b is not null, 'owner B can save a client in org B');
  select public.sts_save_ops_project(org_b, null, client_b, 'Org B Project', '', 'lead', 'medium', current_date, current_date, 0, null, 'Owner', false, '') into project_b;
  perform pg_temp.sts_day3_expect(project_b is not null, 'owner B can save a project in org B');

  perform pg_temp.sts_day3_impersonate(member_a, 'member-a@day3.test');
  select public.sts_save_crm_client(org_a, null, 'Org A Client', 'Casey', '', '', 'Auto', 'active', '') into client_a;
  select public.sts_save_ops_project(org_a, null, client_a, 'Org A Project', 'Delivery', 'in_development', 'high', current_date, current_date + 14, 150000, null, 'Owner', false, '') into project_a;
  perform pg_temp.sts_day3_expect(project_a is not null, 'employee can save a project in their organization');
  select public.sts_save_ops_expense(
    org_a, null, current_date, current_date, 'Adobe', 'Creative Cloud', 5999, 0, 'USD',
    'Software & Subscriptions', '', null, project_a, 'Design tools', 'Operating', 'Card',
    true, 'monthly', null, 'missing', true, 'pending', false, ''
  ) into expense_a;
  perform pg_temp.sts_day3_expect(expense_a is not null, 'employee can save an expense in their organization');
  select public.sts_save_ops_task(org_a, null, project_a, client_a, 'Draft homepage', '', 'todo', 'high', current_date - 1, null, 'Owner', '') into task_a;
  perform pg_temp.sts_day3_expect(task_a is not null, 'employee can save a task in their organization');
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_revenue(%L::uuid, null, null, null, %L, %L, 1000, %L, %L, %L, current_date, null, null, %L, %L, %L, false, false, %L)',
      org_a, 'Employee', 'Unauthorized revenue', 'USD', '', 'one_time_project', 'draft', 'unpaid', '', ''),
    'employee cannot save revenue'
  );
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_project(%L::uuid, null, %L::uuid, %L, %L, %L, %L, current_date, current_date, 0, null, %L, false, %L)',
      org_a, client_b, 'Cross client project', '', 'lead', 'medium', 'Owner', ''),
    'employee cannot attach a client from another organization'
  );
  execute 'select count(*) from public.ops_revenue' into n;
  perform pg_temp.sts_day3_expect(n = 0, 'employee cannot read revenue rows');

  perform pg_temp.sts_day3_impersonate(owner_a, 'owner-a@day3.test');
  select public.sts_save_ops_revenue(
    org_a, null, client_a, project_a, 'State Collision Pro', 'Website build', 250000, 'USD',
    'STS-1001', 'one_time_project', current_date, current_date + 15, current_date, 'paid', 'paid', 'Check', false, true, ''
  ) into revenue_a;
  perform pg_temp.sts_day3_expect(revenue_a is not null, 'owner can save a paid revenue record');
  perform pg_temp.sts_day3_expect_exception(
    pg_temp.sts_day3_expense_sql(org_a, p_vendor := 'Negative Co', p_description := 'Negative amount', p_cents := -1),
    'negative expense amount is rejected'
  );
  perform pg_temp.sts_day3_expect_exception(
    pg_temp.sts_day3_expense_sql(org_a, p_vendor := 'Huge Co', p_description := 'Excessive amount', p_cents := 10000000000),
    'excessively large expense amount is rejected'
  );
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_revenue(%L::uuid, null, null, null, %L, %L, 5000, %L, %L, %L, %L, null, null, %L, %L, %L, false, false, %L)',
      org_a, 'Old', 'Invalid date', 'USD', '', 'one_time_project', '1999-01-01', 'draft', 'unpaid', '', ''),
    'invalid earned date is rejected'
  );
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_revenue(%L::uuid, null, null, null, %L, %L, 5000, %L, %L, %L, current_date, null, null, %L, %L, %L, false, false, %L)',
      org_a, 'Paid', 'Missing payment info', 'USD', '', 'one_time_project', 'sent', 'paid', '', ''),
    'paid revenue without payment information is rejected'
  );
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_task(%L::uuid, null, %L::uuid, null, %L, %L, %L, %L, current_date, null, %L, %L)',
      org_a, project_b, 'Cross project task', '', 'todo', 'medium', 'Owner', ''),
    'task cannot reference a project from another organization'
  );
  perform pg_temp.sts_day3_expect_exception(
    format('select public.sts_save_ops_task(%L::uuid, null, null, null, %L, %L, %L, %L, current_date, %L::uuid, %L, %L)',
      org_a, 'Cross member task', '', 'todo', 'medium', owner_b, 'Owner', ''),
    'task cannot assign a member from another organization'
  );

  execute format('select public.sts_save_ops_task(%L::uuid, %L::uuid, %L::uuid, %L::uuid, %L, %L, %L, %L, current_date, null, %L, %L)',
    org_a, task_a, project_a, client_a, 'Draft homepage', '', 'done', 'high', 'Owner', '') into task_a;
  perform pg_temp.sts_day3_expect(task_a is not null, 'owner can complete a task');

  execute format('select public.sts_archive_ops_expense(%L::uuid, %L::uuid)', org_a, expense_a) into expense_a;
  perform pg_temp.sts_day3_expect(expense_a is not null, 'owner can archive an expense');
  perform pg_temp.sts_day3_expect_exception(
    pg_temp.sts_day3_expense_sql(
      org_a,
      p_id := expense_a,
      p_vendor := 'Adobe',
      p_description := 'Creative Cloud',
      p_category := 'Software & Subscriptions',
      p_frequency := 'monthly'
    ),
    'archived expense cannot be updated through the save RPC'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('update public.ops_expenses set vendor = %L where id = %L::uuid', 'Stolen', expense_a),
    'direct update of an archived expense is rejected'
  );

  execute 'select count(*) from public.ops_expenses' into n;
  perform pg_temp.sts_day3_expect(n >= 1, 'owner can still read archived expenses in their organization');
  execute format('select count(*) from public.audit_events where organization_id = %L::uuid and entity_type like %L', org_a, 'ops_%') into n;
  perform pg_temp.sts_day3_expect(n >= 1, 'org A audit events exist for operations writes');

  perform pg_temp.sts_day3_impersonate(admin_a, 'admin-a@day3.test');
  execute 'select count(*) from public.ops_projects' into n;
  perform pg_temp.sts_day3_expect(n >= 1, 'administrator can read org A projects');
  execute format('select public.sts_save_ops_project(%L::uuid, %L::uuid, %L::uuid, %L, %L, %L, %L, current_date, current_date + 14, 150000, null, %L, true, %L)',
    org_a, project_a, client_a, 'Org A Project', 'Delivery', 'client_review', 'high', 'Owner', '') into project_a;
  perform pg_temp.sts_day3_expect(project_a is not null, 'administrator can change project status');

  perform pg_temp.sts_day3_impersonate(accountant_a, 'accountant-a@day3.test');
  execute 'select count(*) from public.ops_expenses' into n;
  perform pg_temp.sts_day3_expect(n = 0, 'accountant cannot select expense base table');
  execute 'select count(*) from public.ops_revenue' into n;
  perform pg_temp.sts_day3_expect(n = 0, 'accountant cannot select revenue base table');
  perform pg_temp.sts_day3_expect_exception(
    pg_temp.sts_day3_expense_sql(org_a, p_vendor := 'Accountant Co', p_description := 'Unauthorized write'),
    'accountant cannot write expenses'
  );
  perform pg_temp.sts_day3_expect_denied_or_zero('select count(*) from public.ops_projects', 'accountant cannot read projects');

  perform pg_temp.sts_day3_impersonate(owner_b, 'owner-b@day3.test');
  execute format('select count(*) from public.ops_expenses where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day3_expect(n = 0, 'owner B cannot read org A expenses');
  execute format('select count(*) from public.ops_revenue where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day3_expect(n = 0, 'owner B cannot read org A revenue');
  execute format('select count(*) from public.ops_projects where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day3_expect(n = 0, 'owner B cannot read org A projects');
  execute format('select count(*) from public.ops_tasks where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day3_expect(n = 0, 'owner B cannot read org A tasks');
  execute format('select count(*) from public.audit_events where organization_id = %L::uuid', org_a) into n;
  perform pg_temp.sts_day3_expect(n = 0, 'owner B cannot read org A audit events');
  perform pg_temp.sts_day3_expect_blocked_write(
    format('update public.ops_revenue set description = %L where id = %L::uuid', 'Stolen', revenue_a),
    'owner B cannot update org A revenue'
  );
  perform pg_temp.sts_day3_expect_exception(
    pg_temp.sts_day3_expense_sql(org_a, p_vendor := 'Cross Org', p_description := 'Hijack'),
    'owner B cannot save an expense into org A'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_expenses where id = %L::uuid', expense_a),
    'owner B cannot hard-delete org A expenses'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_revenue where id = %L::uuid', revenue_a),
    'owner B cannot hard-delete org A revenue'
  );

  perform pg_temp.sts_day3_impersonate(owner_a, 'owner-a@day3.test');
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_expenses where id = %L::uuid', expense_a),
    'owner cannot hard-delete expenses'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_revenue where id = %L::uuid', revenue_a),
    'owner cannot hard-delete revenue'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_projects where id = %L::uuid', project_a),
    'owner cannot hard-delete projects'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_tasks where id = %L::uuid', task_a),
    'owner cannot hard-delete tasks'
  );
  execute format('select public.sts_archive_ops_revenue(%L::uuid, %L::uuid)', org_a, revenue_a) into revenue_a;
  perform pg_temp.sts_day3_expect(revenue_a is not null, 'owner can still archive revenue');

  perform pg_temp.sts_day3_impersonate(admin_a, 'admin-a@day3.test');
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_projects where id = %L::uuid', project_a),
    'administrator cannot hard-delete projects'
  );
  execute format('select public.sts_archive_ops_task(%L::uuid, %L::uuid)', org_a, task_a) into task_a;
  perform pg_temp.sts_day3_expect(task_a is not null, 'administrator can still archive a task');

  perform pg_temp.sts_day3_impersonate(member_a, 'member-a@day3.test');
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_expenses where id = %L::uuid', expense_a),
    'employee cannot hard-delete expenses'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_tasks where id = %L::uuid', task_a),
    'employee cannot hard-delete tasks'
  );

  perform pg_temp.sts_day3_impersonate(accountant_a, 'accountant-a@day3.test');
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_expenses where id = %L::uuid', expense_a),
    'accountant cannot hard-delete expenses'
  );
  perform pg_temp.sts_day3_expect_blocked_write(
    format('delete from public.ops_revenue where id = %L::uuid', revenue_a),
    'accountant cannot hard-delete revenue'
  );

  perform pg_temp.sts_day3_as_postgres();
  execute format('select count(*) from public.ops_expenses where id = %L::uuid', expense_a) into n;
  perform pg_temp.sts_day3_expect(n = 1, 'archived expense row still exists after denied deletes');
  execute format('select count(*) from public.ops_revenue where id = %L::uuid', revenue_a) into n;
  perform pg_temp.sts_day3_expect(n = 1, 'archived revenue row still exists after denied deletes');
  execute format('select count(*) from public.audit_events where organization_id = %L::uuid and action like %L', org_a, 'ops_%.archived') into n;
  perform pg_temp.sts_day3_expect(n >= 1, 'archive operations still write audit events');
  raise notice 'DAY3_ISOLATION_RUNTIME_PASSED';
end $$;
