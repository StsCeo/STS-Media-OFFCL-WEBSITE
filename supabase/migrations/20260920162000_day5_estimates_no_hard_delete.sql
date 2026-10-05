-- Day 5: authenticated sessions cannot hard-delete estimate records.
-- Additive. Recoverable archival and restore remain the supported removal path.

revoke delete on public.ws_estimate_counters from authenticated, anon, public;
revoke delete on public.ws_estimates from authenticated, anon, public;
revoke delete on public.ws_estimate_lines from authenticated, anon, public;

grant select, insert, update on public.ws_estimate_counters to authenticated;
grant select, insert, update on public.ws_estimates to authenticated;
grant select, insert, update on public.ws_estimate_lines to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.ws_estimate_counters to service_role';
    execute 'grant select, insert, update, delete on public.ws_estimates to service_role';
    execute 'grant select, insert, update, delete on public.ws_estimate_lines to service_role';
  end if;
end $$;
