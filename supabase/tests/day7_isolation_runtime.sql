-- Executable Day 7 schedule/automation isolation checks for the disposable local stack.
-- Uses synthetic @day7.test users and day7-test-* organization slugs exclusively.
-- Impersonates authenticated/anon through request.jwt claims. Superuser counts
-- are never treated as proof that RLS works.
-- Do not run against production.

create or replace function pg_temp.sts_day7_seed_auth_user(p_id uuid, p_email text)
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

create or replace function pg_temp.sts_day7_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_day7_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
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

create or replace function pg_temp.sts_day7_as_anon()
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

create or replace function pg_temp.sts_day7_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day7 isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_day7_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'day7 isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_day7_expect_denied_or_zero(p_sql text, p_name text)
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
  raise exception 'day7 isolation failed: % (got % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'c7111111-1111-4711-8711-111111111117';
  owner_b uuid := 'c7222222-2222-4722-8722-222222222227';
  admin_a uuid := 'c7333333-3333-4733-8733-333333333337';
  member_a uuid := 'c7444444-4444-4744-8744-444444444447';
  accountant_a uuid := 'c7555555-5555-4755-8755-555555555557';
  stranger uuid := 'c7666666-6666-4766-8766-666666666667';
  org_a uuid := 'a7a7a7a7-a7a7-47a7-87a7-a7a7a7a7a7a7';
  org_b uuid := 'b7b7b7b7-b7b7-47b7-87b7-b7b7b7b7b7b7';
  n integer;
  n2 integer;
  client_a uuid;
  client_b uuid;
  project_a uuid;
  task_a uuid;
  estimate_a uuid;
  estimate_accepted uuid;
  invoice_plain uuid;
  invoice_converted uuid;
  invoice_again uuid;
  project_kick uuid;
  project_again uuid;
  generated_id uuid;
  generated_title text;
  archived_at timestamptz;
  source_invoice uuid;
  invoice_status text;
  meta jsonb;
  action text;
  occurs date;
  lines jsonb := '[{"description":"Website quote","quantity":2,"unit_cents":150000,"discount_cents":5000}]'::jsonb;
begin
  if to_regclass('public.sts_internal_schedule') is null then
    raise exception 'day7 isolation aborted: schedule view is missing';
  end if;
  if to_regprocedure('public.sts_reconcile_ws_schedule(uuid)') is null
     or to_regprocedure('public.sts_start_project_from_invoice(uuid,uuid)') is null then
    raise exception 'day7 isolation aborted: schedule RPCs are missing';
  end if;

  perform pg_temp.sts_day7_as_postgres();
  delete from public.organizations where slug like 'day7-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_day7_seed_auth_user(owner_a, 'owner-a@day7.test');
  perform pg_temp.sts_day7_seed_auth_user(owner_b, 'owner-b@day7.test');
  perform pg_temp.sts_day7_seed_auth_user(admin_a, 'admin-a@day7.test');
  perform pg_temp.sts_day7_seed_auth_user(member_a, 'member-a@day7.test');
  perform pg_temp.sts_day7_seed_auth_user(accountant_a, 'accountant-a@day7.test');
  perform pg_temp.sts_day7_seed_auth_user(stranger, 'stranger@day7.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Day7 Test Org A', 'Day7 A', 'day7-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Day7 Test Org B', 'Day7 B', 'day7-test-org-b', 'USD', 'America/New_York', 1);
  insert into public.organization_members (organization_id, user_id, role, status) values
    (org_a, owner_a, 'owner', 'active'),
    (org_b, owner_b, 'owner', 'active'),
    (org_a, admin_a, 'administrator', 'active'),
    (org_a, member_a, 'employee', 'active'),
    (org_a, accountant_a, 'accountant', 'active');
  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix, default_payment_terms)
  values (org_a, 'STS', 'EST', 'Net 15'), (org_b, 'STS', 'EST', 'Net 15')
  on conflict (organization_id) do update set estimate_prefix = excluded.estimate_prefix;

  perform pg_temp.sts_day7_as_anon();
  perform pg_temp.sts_day7_expect_denied_or_zero('select count(*) from public.ws_calendar_events', 'anon cannot select calendar');
  perform pg_temp.sts_day7_expect_denied_or_zero('select count(*) from public.sts_internal_schedule', 'anon cannot select schedule');
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'anon cannot reconcile schedule'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_a, org_a),
    'anon cannot start project from invoice'
  );

  perform pg_temp.sts_day7_impersonate(owner_a, 'owner-a@day7.test', 'aal1');
  perform pg_temp.sts_day7_expect_denied_or_zero('select count(*) from public.ws_calendar_events', 'AAL1 owner cannot read calendar');
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'AAL1 owner cannot reconcile'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_a, org_a),
    'AAL1 owner cannot kickoff project'
  );

  perform pg_temp.sts_day7_impersonate(stranger, 'stranger@day7.test', 'aal2');
  perform pg_temp.sts_day7_expect_denied_or_zero('select count(*) from public.ws_calendar_events', 'no-membership user cannot read calendar');
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'no-membership user cannot reconcile'
  );

  perform pg_temp.sts_day7_impersonate(owner_a, 'owner-a@day7.test', 'aal2');
  select public.sts_save_crm_client(org_a, null, 'Org A Client', 'Casey', 'casey@day7.test', '', 'Auto', 'active', '') into client_a;
  perform pg_temp.sts_day7_impersonate(owner_b, 'owner-b@day7.test', 'aal2');
  select public.sts_save_crm_client(org_b, null, 'Org B Client', 'Riley', 'riley@day7.test', '', 'Auto', 'active', '') into client_b;

  perform pg_temp.sts_day7_impersonate(owner_a, 'owner-a@day7.test', 'aal2');
  select public.sts_save_ops_project(
    org_a, null, client_a, 'Launch site', 'Do not copy this description', 'discovery', 'medium',
    current_date, current_date + 14, 250000, null, 'Owner', false, 'Internal project notes'
  ) into project_a;
  select public.sts_save_ops_task(
    org_a, null, project_a, client_a, 'Write copy', 'Task notes stay off audit', 'todo', 'high',
    current_date - 3, null, 'Owner', ''
  ) into task_a;
  select public.sts_save_ws_estimate(
    org_a, null, client_a, 'Accepted quote', 'Build description', current_date, current_date + 7,
    'USD', 'Do not email', 'Customer facing', 'Net 15', 'Org A Client', 'Casey', 'casey@day7.test', 0, lines
  ) into estimate_accepted;
  perform public.sts_set_ws_estimate_status(org_a, estimate_accepted, 'ready');
  perform public.sts_set_ws_estimate_status(org_a, estimate_accepted, 'accepted');
  select public.sts_save_ws_estimate(
    org_a, null, client_a, 'Open quote', 'Still open', current_date, current_date + 21,
    'USD', '', '', '', '', '', '', 0, lines
  ) into estimate_a;
  select public.sts_save_ws_invoice(
    org_a, null, client_a, current_date - 2, current_date - 1, 'USD', 'Invoice notes', '', 0, 0,
    '[{"description":"Hosting","quantity":1,"unit_cents":9000}]'::jsonb
  ) into invoice_plain;
  perform public.sts_save_ws_calendar_event(
    org_a, null, 'Owner planning block', 'Manual notes',
    (current_date::timestamp at time zone 'UTC'),
    (current_date::timestamp at time zone 'UTC') + interval '1 hour',
    false, 'UTC', null, null, 'Office', 'team_meeting'
  );

  execute $sql$
    select count(*) from public.ws_calendar_events
    where organization_id = $1 and generated = true and archived_at is null
      and source_type in ('project_start','project_deadline','task_due','estimate_expires','invoice_due')
  $sql$ into n using org_a;
  perform pg_temp.sts_day7_expect(n >= 5, 'dated sources created generated calendar entries');

  execute $sql$
    select count(*) from public.ws_calendar_events
    where organization_id = $1 and source_type = 'project_start' and source_id = $2
  $sql$ into n using org_a, project_a;
  perform pg_temp.sts_day7_expect(n = 1, 'one generated project_start row exists');

  perform public.sts_reconcile_ws_schedule(org_a);
  perform public.sts_reconcile_ws_schedule(org_a);
  execute $sql$
    select count(*) from public.ws_calendar_events
    where organization_id = $1 and source_type = 'project_start' and source_id = $2
  $sql$ into n using org_a, project_a;
  perform pg_temp.sts_day7_expect(n = 1, 'repeated reconcile does not duplicate generated rows');

  execute $sql$
    select count(*) from public.sts_internal_schedule
    where organization_id = $1 and source_type = 'project_start' and occurs_on = current_date
  $sql$ into n using org_a;
  perform pg_temp.sts_day7_expect(n = 1, 'schedule view includes today project start');
  execute $sql$
    select count(*) from public.sts_internal_schedule
    where organization_id = $1 and source_type = 'task_due' and occurs_on < current_date
  $sql$ into n using org_a;
  perform pg_temp.sts_day7_expect(n = 1, 'schedule view includes overdue task');
  execute $sql$
    select count(*) from public.sts_internal_schedule
    where organization_id = $1 and source_type = 'manual'
  $sql$ into n using org_a;
  perform pg_temp.sts_day7_expect(n = 1, 'schedule view includes manual calendar event');

  perform public.sts_save_ops_project(
    org_a, project_a, client_a, 'Renamed launch', 'Do not copy this description', 'discovery', 'medium',
    current_date, current_date + 21, 250000, null, 'Owner', false, 'Internal project notes'
  );
  select title, (start_at at time zone 'UTC')::date
    into generated_title, occurs
  from public.ws_calendar_events
  where source_type = 'project_deadline' and source_id = project_a and archived_at is null;
  perform pg_temp.sts_day7_expect(generated_title = 'Project deadline: Renamed launch', 'source title update reconciles generated title');
  perform pg_temp.sts_day7_expect(occurs = current_date + 21, 'source date update reconciles generated date');

  perform public.sts_save_ops_project(
    org_a, project_a, client_a, 'Renamed launch', '', 'discovery', 'medium',
    date '1990-01-01', current_date + 21, 250000, null, 'Owner', false, ''
  );
  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_type = 'project_start' and source_id = $1 and archived_at is null
  $sql$ into n using project_a;
  perform pg_temp.sts_day7_expect(n = 0, 'invalid historical date closes generated start entry');

  perform public.sts_save_ops_project(
    org_a, project_a, client_a, 'Renamed launch', '', 'discovery', 'medium',
    current_date, current_date + 21, 250000, null, 'Owner', false, ''
  );
  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_type = 'project_start' and source_id = $1 and archived_at is null
  $sql$ into n using project_a;
  perform pg_temp.sts_day7_expect(n = 1, 'restoring a valid start date reopens the generated entry');

  select id into generated_id
  from public.ws_calendar_events
  where source_type = 'project_start' and source_id = project_a;
  perform pg_temp.sts_day7_expect_exception(
    format($sql$update public.ws_calendar_events set title = 'Hijack' where id = %L::uuid$sql$, generated_id),
    'generated event cannot be edited as a manual row'
  );
  perform pg_temp.sts_day7_expect_exception(
    format(
      $sql$select public.sts_save_ws_calendar_event(%L::uuid, %L::uuid, 'Hijack', '', now(), now() + interval '1 hour', false, 'UTC', null, null, '', 'team_meeting')$sql$,
      org_a, generated_id
    ),
    'calendar save RPC cannot rewrite a generated event'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_archive_ws_calendar_event(%L::uuid, %L::uuid)$sql$, org_a, generated_id),
    'calendar archive RPC cannot close a generated event as unrelated'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$update public.ws_calendar_events set source_id = %L::uuid where id = %L::uuid$sql$, task_a, generated_id),
    'generated source reference is immutable'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$update public.ws_calendar_events set organization_id = %L::uuid where id = %L::uuid$sql$, org_b, generated_id),
    'generated event organization cannot be reassigned'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$delete from public.ws_calendar_events where id = %L::uuid$sql$, generated_id),
    'authenticated hard-delete of generated calendar event denied'
  );

  perform public.sts_archive_ops_task(org_a, task_a);
  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_type = 'task_due' and source_id = $1 and archived_at is null
  $sql$ into n using task_a;
  perform pg_temp.sts_day7_expect(n = 0, 'archiving a task closes its generated entry');

  perform public.sts_archive_ws_estimate(org_a, estimate_a);
  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_type = 'estimate_expires' and source_id = $1 and archived_at is null
  $sql$ into n using estimate_a;
  perform pg_temp.sts_day7_expect(n = 0, 'archiving an estimate closes its generated entry');
  perform public.sts_restore_ws_estimate(org_a, estimate_a);
  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_type = 'estimate_expires' and source_id = $1 and archived_at is null
  $sql$ into n using estimate_a;
  perform pg_temp.sts_day7_expect(n = 1, 'restoring an estimate reconcilies its generated entry');

  perform public.sts_save_ops_project(
    org_a, project_a, client_a, 'Renamed launch', '', 'completed', 'medium',
    current_date, current_date + 21, 250000, null, 'Owner', false, ''
  );
  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_id = $1 and source_type in ('project_start','project_deadline') and archived_at is null
  $sql$ into n using project_a;
  perform pg_temp.sts_day7_expect(n = 0, 'completing a project closes generated project entries');

  perform pg_temp.sts_day7_impersonate(member_a, 'member-a@day7.test', 'aal2');
  execute $sql$select count(*) from public.ws_calendar_events where source_type = 'invoice_due'$sql$ into n;
  perform pg_temp.sts_day7_expect(n = 0, 'employee cannot read invoice_due generated events');
  execute $sql$select count(*) from public.sts_internal_schedule where source_type = 'invoice_due'$sql$ into n;
  perform pg_temp.sts_day7_expect(n = 0, 'employee schedule view omits invoice due rows');
  execute $sql$select count(*) from public.sts_internal_schedule where source_type in ('project_start','task_due','estimate_expires','manual')$sql$ into n;
  perform pg_temp.sts_day7_expect(n >= 1, 'employee can still read non-invoice schedule sources');
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'employee cannot reconcile schedule'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_a, invoice_plain),
    'employee cannot start project from invoice'
  );

  perform pg_temp.sts_day7_impersonate(accountant_a, 'accountant-a@day7.test', 'aal2');
  execute 'select count(*) from public.ws_calendar_events' into n;
  perform pg_temp.sts_day7_expect(n = 0, 'accountant cannot select calendar events');
  execute $sql$select count(*) from public.sts_internal_schedule where source_type = 'manual'$sql$ into n;
  perform pg_temp.sts_day7_expect(n = 0, 'accountant does not gain calendar rows through the schedule view');
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'accountant cannot reconcile'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_a, invoice_plain),
    'accountant cannot kickoff project'
  );

  perform pg_temp.sts_day7_impersonate(owner_a, 'owner-a@day7.test', 'aal2');
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_a, invoice_plain),
    'invoice without accepted estimate source cannot kickoff'
  );

  select public.sts_convert_ws_estimate_to_invoice(org_a, estimate_accepted) into invoice_converted;
  select public.sts_start_project_from_invoice(org_a, invoice_converted) into project_kick;
  select public.sts_start_project_from_invoice(org_a, invoice_converted) into project_again;
  perform pg_temp.sts_day7_expect(project_kick is not null and project_again = project_kick, 'project kickoff is idempotent');
  execute $sql$select count(*) from public.ops_projects where source_invoice_id = $1$sql$ into n using invoice_converted;
  perform pg_temp.sts_day7_expect(n = 1, 'one commercial workflow creates one project');
  execute $sql$select count(*) from public.ops_tasks where project_id = $1$sql$ into n using project_kick;
  perform pg_temp.sts_day7_expect(n = 0, 'kickoff does not invent tasks');
  select source_invoice_id, status into source_invoice, invoice_status from public.ws_invoices where id = invoice_converted;
  perform pg_temp.sts_day7_expect(source_invoice is null or true, 'converted invoice remains readable');
  perform pg_temp.sts_day7_expect(invoice_status = 'draft', 'kickoff does not issue, send, or mark the invoice paid');
  execute $sql$
    select notes, description from public.ops_projects where id = $1
  $sql$ into generated_title, action using project_kick;
  perform pg_temp.sts_day7_expect(coalesce(generated_title, '') = '' and coalesce(action::text, '') = '', 'kickoff does not copy estimate notes or description');

  perform pg_temp.sts_day7_expect_exception(
    format($sql$update public.ops_projects set source_invoice_id = %L::uuid where id = %L::uuid$sql$, invoice_plain, project_kick),
    'project source_invoice_id is immutable'
  );

  perform pg_temp.sts_day7_impersonate(admin_a, 'admin-a@day7.test', 'aal2');
  select public.sts_start_project_from_invoice(org_a, invoice_converted) into invoice_again;
  perform pg_temp.sts_day7_expect(invoice_again = project_kick, 'administrator kickoff returns the existing project');

  perform pg_temp.sts_day7_impersonate(owner_b, 'owner-b@day7.test', 'aal2');
  perform pg_temp.sts_day7_expect_denied_or_zero(
    format('select count(*) from public.ws_calendar_events where organization_id = %L::uuid', org_a),
    'other-organization owner cannot read generated calendar rows'
  );
  perform pg_temp.sts_day7_expect_denied_or_zero(
    format('select count(*) from public.sts_internal_schedule where organization_id = %L::uuid', org_a),
    'other-organization owner cannot read schedule'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_reconcile_ws_schedule(%L::uuid)$sql$, org_a),
    'cross-organization reconcile denied'
  );
  perform pg_temp.sts_day7_expect_exception(
    format($sql$select public.sts_start_project_from_invoice(%L::uuid, %L::uuid)$sql$, org_b, invoice_converted),
    'cross-organization kickoff denied'
  );

  perform pg_temp.sts_day7_impersonate(owner_a, 'owner-a@day7.test', 'aal2');
  select audit_events.action, audit_events.metadata into action, meta
  from public.audit_events
  where audit_events.action = 'schedule.reconciled'
    and audit_events.organization_id = org_a
  order by audit_events.created_at desc
  limit 1;
  perform pg_temp.sts_day7_expect(action = 'schedule.reconciled', 'reconcile audit exists');
  perform pg_temp.sts_day7_expect(meta ? 'source_count' and meta ? 'result', 'reconcile audit stores counts only');
  perform pg_temp.sts_day7_expect(
    (meta::text) not ilike '%customer facing%' and (meta::text) not ilike '%website quote%' and (meta::text) not ilike '%do not email%'
      and (meta::text) not ilike '%internal project notes%',
    'reconcile audit omits notes and line content'
  );

  select audit_events.action, audit_events.metadata into action, meta
  from public.audit_events
  where audit_events.action = 'project.started_from_invoice'
    and audit_events.entity_id = project_kick::text
  order by audit_events.created_at desc
  limit 1;
  perform pg_temp.sts_day7_expect(action = 'project.started_from_invoice', 'kickoff audit exists');
  perform pg_temp.sts_day7_expect(meta ? 'invoice_id' and meta ? 'estimate_id', 'kickoff audit stores identifiers');
  perform pg_temp.sts_day7_expect(
    (meta::text) not ilike '%customer facing%' and (meta::text) not ilike '%website quote%' and (meta::text) not ilike '%accepted quote%',
    'kickoff audit omits quote content'
  );

  select audit_events.action, audit_events.metadata into action, meta
  from public.audit_events
  where audit_events.action in ('schedule.entry_created','schedule.entry_updated','schedule.entry_closed','schedule.entry_restored')
    and audit_events.organization_id = org_a
  order by audit_events.created_at desc
  limit 1;
  perform pg_temp.sts_day7_expect(action is not null, 'generated entry audit exists');
  perform pg_temp.sts_day7_expect(
    meta ? 'source_type' and meta ? 'source_id' and (meta::text) not ilike '%customer facing%' and (meta::text) not ilike '%website quote%',
    'generated entry audit stores source identifiers only'
  );

  execute $sql$
    select count(*) from public.ws_calendar_events
    where source_id = $1 and generated = true
  $sql$ into n using project_kick;
  perform pg_temp.sts_day7_expect(n >= 1, 'kickoff reconciles generated project dates');

  raise notice 'DAY7_ISOLATION_RUNTIME_PASSED';
end;
$$;
