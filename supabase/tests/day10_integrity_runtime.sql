-- Day 10 catalog integrity checks for the disposable local stack.
-- Does not embed Auth user UUIDs or mailbox names. Do not run against production.

create or replace function pg_temp.sts_day10_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'day10 integrity failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

do $$
declare
  missing text;
  n integer;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing
  from pg_class c
  join pg_namespace nsp on nsp.oid = c.relnamespace
  where nsp.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (
      'organizations', 'organization_members', 'business_settings', 'audit_events',
      'crm_leads', 'crm_clients', 'ops_expenses', 'ops_revenue', 'ops_projects', 'ops_tasks',
      'ws_notes', 'ws_documents', 'ws_calendar_events', 'ws_invoices', 'ws_invoice_lines',
      'ws_invoice_counters', 'ws_estimates', 'ws_estimate_lines',
      'client_portal_identities', 'client_portal_publications'
    )
    and (not c.relrowsecurity or not c.relforcerowsecurity);
  perform pg_temp.sts_day10_expect(missing is null, 'Day 1–9 organization tables have FORCE RLS');

  select count(*) into n
  from pg_class c
  join pg_namespace nsp on nsp.oid = c.relnamespace
  where nsp.nspname = 'public'
    and c.relkind = 'r'
    and not c.relforcerowsecurity;
  perform pg_temp.sts_day10_expect(n = 0, 'no public tables remain without FORCE RLS');

  select string_agg(p.proname, ', ' order by p.proname)
    into missing
  from pg_proc p
  join pg_namespace nsp on nsp.oid = p.pronamespace
  where nsp.nspname = 'public'
    and p.prosecdef
    and p.proname like 'sts_%'
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) as cfg
      where cfg like 'search_path=%'
    );
  perform pg_temp.sts_day10_expect(missing is null, 'sts_ SECURITY DEFINER functions set search_path');

  select count(*) into n
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and table_name in (
      'organizations', 'organization_members', 'business_settings', 'audit_events',
      'crm_leads', 'crm_clients', 'ops_expenses', 'ops_revenue', 'ops_projects', 'ops_tasks',
      'ws_notes', 'ws_documents', 'ws_invoices', 'ws_estimates',
      'client_portal_identities', 'client_portal_publications'
    );
  perform pg_temp.sts_day10_expect(n = 0, 'anon has no grants on organization business tables');

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and grantee = 'anon'
    and privilege_type = 'EXECUTE'
    and routine_name like 'sts_%';
  perform pg_temp.sts_day10_expect(n = 0, 'anon cannot execute sts_ functions');

  select count(*) into n
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and grantee in ('anon', 'authenticated', 'public')
    and privilege_type = 'EXECUTE'
    and routine_name = 'sts_client_portal_document_object_name';
  perform pg_temp.sts_day10_expect(n = 0, 'document object-name RPC is not granted to anon or authenticated');

  raise notice 'DAY10_INTEGRITY_RUNTIME_PASSED';
end;
$$;
