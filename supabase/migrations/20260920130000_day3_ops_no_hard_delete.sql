-- Day 3 closure: business ledgers are archived, not permanently deleted, for
-- authenticated application sessions. Service-role/postgres remains available
-- for isolated local maintenance only and is never exposed to the browser client.

drop policy if exists ops_projects_delete_privileged on public.ops_projects;
drop policy if exists ops_expenses_delete_privileged on public.ops_expenses;
drop policy if exists ops_revenue_delete_privileged on public.ops_revenue;
drop policy if exists ops_tasks_delete_privileged on public.ops_tasks;

revoke delete on public.ops_projects from authenticated, anon, public;
revoke delete on public.ops_expenses from authenticated, anon, public;
revoke delete on public.ops_revenue from authenticated, anon, public;
revoke delete on public.ops_tasks from authenticated, anon, public;

grant select, insert, update on public.ops_projects to authenticated;
grant select, insert, update on public.ops_expenses to authenticated;
grant select, insert, update on public.ops_revenue to authenticated;
grant select, insert, update on public.ops_tasks to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.ops_projects to service_role';
    execute 'grant select, insert, update, delete on public.ops_expenses to service_role';
    execute 'grant select, insert, update, delete on public.ops_revenue to service_role';
    execute 'grant select, insert, update, delete on public.ops_tasks to service_role';
  end if;
end $$;

comment on table public.ops_expenses is
  'Organization-owned expense ledger. Integer cents. Soft-archived. Authenticated sessions cannot hard-delete.';
comment on table public.ops_revenue is
  'Organization-owned revenue ledger. Recordkeeping only. Authenticated sessions cannot hard-delete.';
comment on table public.ops_projects is
  'Organization-owned projects. Authenticated sessions cannot hard-delete.';
comment on table public.ops_tasks is
  'Organization-owned tasks. Authenticated sessions cannot hard-delete.';
