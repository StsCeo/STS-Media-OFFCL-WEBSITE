-- Day 10: fail-closed leftover init-era tables.
-- Forward-only. Does not rewrite verified Day 1–9 migrations.
-- Organization-scoped Day 1–9 tables already have FORCE RLS and no anon grants.
-- Init-era tables still had RLS without FORCE and default grants to public/anon.
-- Identifier interpolation uses format(%I) from pg_catalog names only.

do $$
declare
  r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relforcerowsecurity
    order by c.relname
  loop
    execute format('revoke all on table public.%I from anon, public', r.table_name);
    execute format('alter table public.%I enable row level security', r.table_name);
    execute format('alter table public.%I force row level security', r.table_name);
  end loop;
end $$;

revoke all on function public.sts_client_portal_document_object_name(uuid) from public, anon, authenticated;
