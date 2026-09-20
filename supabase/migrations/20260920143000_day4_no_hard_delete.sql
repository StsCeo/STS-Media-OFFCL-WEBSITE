-- Day 4: authenticated sessions cannot hard-delete workspace records.
-- Additive. Recoverable archival remains the supported removal path.

revoke delete on public.ws_notes from authenticated, anon, public;
revoke delete on public.ws_documents from authenticated, anon, public;
revoke delete on public.ws_calendar_events from authenticated, anon, public;
revoke delete on public.ws_invoice_counters from authenticated, anon, public;
revoke delete on public.ws_invoices from authenticated, anon, public;
revoke delete on public.ws_invoice_lines from authenticated, anon, public;

grant select, insert, update on public.ws_notes to authenticated;
grant select, insert, update on public.ws_documents to authenticated;
grant select, insert, update on public.ws_calendar_events to authenticated;
grant select, insert, update on public.ws_invoice_counters to authenticated;
grant select, insert, update on public.ws_invoices to authenticated;
grant select, insert, update on public.ws_invoice_lines to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.ws_notes to service_role';
    execute 'grant select, insert, update, delete on public.ws_documents to service_role';
    execute 'grant select, insert, update, delete on public.ws_calendar_events to service_role';
    execute 'grant select, insert, update, delete on public.ws_invoice_counters to service_role';
    execute 'grant select, insert, update, delete on public.ws_invoices to service_role';
    execute 'grant select, insert, update, delete on public.ws_invoice_lines to service_role';
  end if;
end $$;
