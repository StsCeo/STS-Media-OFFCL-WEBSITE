-- Day 4 RPCs for notes, documents, calendar, and invoices. Additive. No identity literals.

create or replace function public.sts_ops_assert_org_lead(p_organization_id uuid, p_lead_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_lead_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.crm_leads
    where id = p_lead_id and organization_id = p_organization_id
  ) then
    raise exception 'invalid lead';
  end if;
end;
$$;

create or replace function public.sts_ops_assert_org_task(p_organization_id uuid, p_task_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_task_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.ops_tasks
    where id = p_task_id and organization_id = p_organization_id and archived_at is null
  ) then
    raise exception 'invalid task';
  end if;
end;
$$;

create or replace function public.sts_ws_assert_note_related(
  p_organization_id uuid,
  p_related_type text,
  p_related_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(p_related_type, 'none') = 'none' then
    return;
  end if;
  if p_related_id is null then
    raise exception 'invalid related record';
  end if;
  if p_related_type = 'client' then
    perform public.sts_ops_assert_org_client(p_organization_id, p_related_id);
  elsif p_related_type = 'lead' then
    perform public.sts_ops_assert_org_lead(p_organization_id, p_related_id);
  elsif p_related_type = 'project' then
    perform public.sts_ops_assert_org_project(p_organization_id, p_related_id);
  elsif p_related_type = 'task' then
    perform public.sts_ops_assert_org_task(p_organization_id, p_related_id);
  else
    raise exception 'invalid related record';
  end if;
end;
$$;

create or replace function public.sts_save_ws_note(
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_body text,
  p_related_type text,
  p_related_id uuid,
  p_pinned boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  action_name text := 'ws_note.created';
  was_pinned boolean;
begin
  if auth.uid() is null or not public.sts_can_write_notes(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ws_assert_note_related(p_organization_id, coalesce(p_related_type, 'none'), p_related_id);

  if p_id is null then
    insert into public.ws_notes (
      organization_id, title, body, related_type, related_id, pinned, created_by
    ) values (
      p_organization_id,
      btrim(p_title),
      p_body,
      coalesce(p_related_type, 'none'),
      p_related_id,
      coalesce(p_pinned, false),
      auth.uid()
    )
    returning id into record_id;
  else
    select pinned into was_pinned from public.ws_notes
    where id = p_id and organization_id = p_organization_id;
    update public.ws_notes
    set
      title = btrim(p_title),
      body = p_body,
      related_type = coalesce(p_related_type, 'none'),
      related_id = p_related_id,
      pinned = coalesce(p_pinned, false)
    where id = p_id and organization_id = p_organization_id and archived_at is null
    returning id into record_id;
    if was_pinned is distinct from coalesce(p_pinned, false) then
      action_name := case when coalesce(p_pinned, false) then 'ws_note.pinned' else 'ws_note.unpinned' end;
    else
      action_name := 'ws_note.updated';
    end if;
  end if;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ws_note', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ws_note(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_notes(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ws_notes
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_note.archived', 'ws_note', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_save_ws_document(
  p_organization_id uuid,
  p_id uuid,
  p_storage_path text,
  p_display_filename text,
  p_content_type text,
  p_byte_size integer,
  p_description text,
  p_category text,
  p_client_id uuid,
  p_project_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  action_name text := 'ws_document.created';
  expected_prefix text;
begin
  if auth.uid() is null or not public.sts_can_write_documents(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  perform public.sts_ops_assert_org_project(p_organization_id, p_project_id);
  expected_prefix := p_organization_id::text || '/';
  if p_storage_path is null or left(p_storage_path, char_length(expected_prefix)) <> expected_prefix then
    raise exception 'invalid storage path';
  end if;

  if p_id is null then
    insert into public.ws_documents (
      organization_id, storage_path, display_filename, content_type, byte_size,
      description, category, client_id, project_id, uploaded_by
    ) values (
      p_organization_id, p_storage_path, btrim(p_display_filename), p_content_type, p_byte_size,
      coalesce(p_description, ''), coalesce(p_category, 'other'), p_client_id, p_project_id, auth.uid()
    )
    returning id into record_id;
  else
    update public.ws_documents
    set
      display_filename = btrim(p_display_filename),
      description = coalesce(p_description, ''),
      category = coalesce(p_category, 'other'),
      client_id = p_client_id,
      project_id = p_project_id
    where id = p_id and organization_id = p_organization_id and archived_at is null
    returning id into record_id;
    action_name := 'ws_document.updated';
  end if;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ws_document', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ws_document(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_documents(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ws_documents
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_document.archived', 'ws_document', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_save_ws_calendar_event(
  p_organization_id uuid,
  p_id uuid,
  p_title text,
  p_description text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_all_day boolean,
  p_timezone text,
  p_client_id uuid,
  p_project_id uuid,
  p_location text,
  p_kind text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  prior public.ws_calendar_events%rowtype;
  action_name text := 'ws_calendar.created';
begin
  if auth.uid() is null or not public.sts_can_write_calendar(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if p_end_at < p_start_at then
    raise exception 'invalid time range';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  perform public.sts_ops_assert_org_project(p_organization_id, p_project_id);

  if p_id is null then
    insert into public.ws_calendar_events (
      organization_id, title, description, start_at, end_at, all_day, timezone,
      client_id, project_id, location, kind, created_by
    ) values (
      p_organization_id, btrim(p_title), coalesce(p_description, ''), p_start_at, p_end_at,
      coalesce(p_all_day, false), coalesce(p_timezone, 'America/New_York'),
      p_client_id, p_project_id, coalesce(p_location, ''), coalesce(p_kind, 'team_meeting'), auth.uid()
    )
    returning id into record_id;
  else
    select * into prior from public.ws_calendar_events
    where id = p_id and organization_id = p_organization_id;
    if prior.id is null then
      raise exception 'not found';
    end if;
    update public.ws_calendar_events
    set
      title = btrim(p_title),
      description = coalesce(p_description, ''),
      start_at = p_start_at,
      end_at = p_end_at,
      all_day = coalesce(p_all_day, false),
      timezone = coalesce(p_timezone, prior.timezone),
      client_id = p_client_id,
      project_id = p_project_id,
      location = coalesce(p_location, ''),
      kind = coalesce(p_kind, prior.kind)
    where id = p_id and organization_id = p_organization_id and archived_at is null
    returning id into record_id;
    if prior.start_at is distinct from p_start_at or prior.end_at is distinct from p_end_at then
      action_name := 'ws_calendar.rescheduled';
    else
      action_name := 'ws_calendar.updated';
    end if;
  end if;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ws_calendar_event', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ws_calendar_event(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_calendar(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ws_calendar_events
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_calendar.archived', 'ws_calendar_event', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_ws_replace_invoice_lines(
  p_organization_id uuid,
  p_invoice_id uuid,
  p_lines jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  pos integer := 0;
  subtotal integer := 0;
  qty integer;
  unit integer;
  line_total integer;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 100 then
    raise exception 'invalid lines';
  end if;
  delete from public.ws_invoice_lines where invoice_id = p_invoice_id and organization_id = p_organization_id;
  for line in select value from jsonb_array_elements(p_lines)
  loop
    pos := pos + 1;
    qty := (line->>'quantity')::integer;
    unit := (line->>'unit_cents')::integer;
    if qty is null or unit is null then
      raise exception 'invalid lines';
    end if;
    line_total := qty * unit;
    if line_total < 0 then
      raise exception 'invalid lines';
    end if;
    insert into public.ws_invoice_lines (
      organization_id, invoice_id, position, description, quantity, unit_cents, line_total_cents
    ) values (
      p_organization_id, p_invoice_id, pos, btrim(line->>'description'), qty, unit, line_total
    );
    subtotal := subtotal + line_total;
  end loop;
  return subtotal;
end;
$$;

create or replace function public.sts_save_ws_invoice(
  p_organization_id uuid,
  p_id uuid,
  p_client_id uuid,
  p_issue_date date,
  p_due_date date,
  p_currency text,
  p_notes text,
  p_payment_instructions text,
  p_discount_cents integer,
  p_tax_cents integer,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  prior public.ws_invoices%rowtype;
  subtotal integer;
  discount integer := coalesce(p_discount_cents, 0);
  tax integer := coalesce(p_tax_cents, 0);
  total integer;
  draft_number text;
begin
  if auth.uid() is null or not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  if discount < 0 or tax < 0 then
    raise exception 'invalid totals';
  end if;

  if p_id is null then
    draft_number := 'DRAFT-' || replace(gen_random_uuid()::text, '-', '');
    insert into public.ws_invoices (
      organization_id, client_id, invoice_number, status, issue_date, due_date, currency,
      notes, payment_instructions, created_by
    ) values (
      p_organization_id, p_client_id, draft_number, 'draft', p_issue_date, p_due_date,
      coalesce(p_currency, 'USD'), coalesce(p_notes, ''), coalesce(p_payment_instructions, ''), auth.uid()
    )
    returning id into record_id;
    subtotal := public.sts_ws_replace_invoice_lines(p_organization_id, record_id, p_lines);
    if discount > subtotal then
      raise exception 'invalid totals';
    end if;
    total := subtotal - discount + tax;
    update public.ws_invoices
    set subtotal_cents = subtotal, discount_cents = discount, tax_cents = tax, total_cents = total
    where id = record_id;
    perform public.sts_ops_write_audit(p_organization_id, 'ws_invoice.created', 'ws_invoice', record_id);
    return record_id;
  end if;

  select * into prior from public.ws_invoices
  where id = p_id and organization_id = p_organization_id;
  if prior.id is null then
    raise exception 'not found';
  end if;
  if prior.status <> 'draft' or prior.archived_at is not null then
    raise exception 'invalid status';
  end if;
  subtotal := public.sts_ws_replace_invoice_lines(p_organization_id, prior.id, p_lines);
  if discount > subtotal then
    raise exception 'invalid totals';
  end if;
  total := subtotal - discount + tax;
  update public.ws_invoices
  set
    client_id = p_client_id,
    issue_date = p_issue_date,
    due_date = p_due_date,
    currency = coalesce(p_currency, prior.currency),
    notes = coalesce(p_notes, ''),
    payment_instructions = coalesce(p_payment_instructions, ''),
    subtotal_cents = subtotal,
    discount_cents = discount,
    tax_cents = tax,
    total_cents = total
  where id = prior.id and organization_id = p_organization_id and archived_at is null
  returning id into record_id;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_invoice.updated', 'ws_invoice', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_issue_ws_invoice(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.ws_invoices%rowtype;
  next_num integer;
  prefix text;
  issued_number text;
  org_legal text;
  org_display text;
  client_business text := '';
  client_contact text := '';
  client_email text := '';
begin
  if auth.uid() is null or not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  select * into rec from public.ws_invoices
  where id = p_id and organization_id = p_organization_id for update;
  if rec.id is null then
    raise exception 'not found';
  end if;
  if rec.status <> 'draft' or rec.archived_at is not null then
    raise exception 'invalid status';
  end if;
  if rec.client_id is null or rec.total_cents <= 0 then
    raise exception 'invalid invoice';
  end if;
  if not exists (select 1 from public.ws_invoice_lines where invoice_id = rec.id) then
    raise exception 'invalid lines';
  end if;

  select legal_name, display_name into org_legal, org_display
  from public.organizations where id = p_organization_id;
  select coalesce(invoice_prefix, 'STS') into prefix
  from public.business_settings where organization_id = p_organization_id;
  prefix := coalesce(prefix, 'STS');
  select business_name, contact_name, email into client_business, client_contact, client_email
  from public.crm_clients where id = rec.client_id and organization_id = p_organization_id;
  if client_business is null then
    raise exception 'invalid client';
  end if;

  insert into public.ws_invoice_counters (organization_id, next_number)
  values (p_organization_id, 1)
  on conflict (organization_id) do nothing;
  select next_number into next_num from public.ws_invoice_counters
  where organization_id = p_organization_id for update;
  issued_number := prefix || '-' || lpad(next_num::text, 4, '0');
  update public.ws_invoice_counters
  set next_number = next_number + 1
  where organization_id = p_organization_id;

  update public.ws_invoices
  set
    status = 'issued',
    invoice_number = issued_number,
    issue_date = coalesce(rec.issue_date, current_date),
    due_date = coalesce(rec.due_date, current_date + 15),
    issued_at = now(),
    org_legal_name = coalesce(org_legal, ''),
    org_display_name = coalesce(org_display, ''),
    client_business_name = coalesce(client_business, ''),
    client_contact_name = coalesce(client_contact, ''),
    client_email = coalesce(client_email, '')
  where id = rec.id;

  perform public.sts_ops_write_audit(p_organization_id, 'ws_invoice.issued', 'ws_invoice', rec.id);
  return rec.id;
end;
$$;

create or replace function public.sts_record_ws_invoice_payment(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare rec public.ws_invoices%rowtype;
begin
  if auth.uid() is null or not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  select * into rec from public.ws_invoices
  where id = p_id and organization_id = p_organization_id;
  if rec.id is null then
    raise exception 'not found';
  end if;
  if rec.status <> 'issued' or rec.archived_at is not null then
    raise exception 'invalid status';
  end if;
  update public.ws_invoices
  set status = 'paid', paid_at = now(), amount_paid_cents = total_cents
  where id = rec.id;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_invoice.payment_recorded', 'ws_invoice', rec.id);
  return rec.id;
end;
$$;

create or replace function public.sts_void_ws_invoice(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare rec public.ws_invoices%rowtype;
begin
  if auth.uid() is null or not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  select * into rec from public.ws_invoices
  where id = p_id and organization_id = p_organization_id;
  if rec.id is null then
    raise exception 'not found';
  end if;
  if rec.status not in ('draft', 'issued') or rec.archived_at is not null then
    raise exception 'invalid status';
  end if;
  update public.ws_invoices
  set status = 'void', voided_at = now(), amount_paid_cents = 0
  where id = rec.id;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_invoice.voided', 'ws_invoice', rec.id);
  return rec.id;
end;
$$;

create or replace function public.sts_archive_ws_invoice(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ws_invoices
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ws_invoice.archived', 'ws_invoice', record_id);
  return record_id;
end;
$$;

revoke all on function public.sts_ops_assert_org_lead(uuid, uuid) from public, anon;
revoke all on function public.sts_ops_assert_org_task(uuid, uuid) from public, anon;
revoke all on function public.sts_ws_assert_note_related(uuid, text, uuid) from public, anon;
revoke all on function public.sts_save_ws_note(uuid, uuid, text, text, text, uuid, boolean) from public, anon;
revoke all on function public.sts_archive_ws_note(uuid, uuid) from public, anon;
revoke all on function public.sts_save_ws_document(uuid, uuid, text, text, text, integer, text, text, uuid, uuid) from public, anon;
revoke all on function public.sts_archive_ws_document(uuid, uuid) from public, anon;
revoke all on function public.sts_save_ws_calendar_event(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text, uuid, uuid, text, text) from public, anon;
revoke all on function public.sts_archive_ws_calendar_event(uuid, uuid) from public, anon;
revoke all on function public.sts_ws_replace_invoice_lines(uuid, uuid, jsonb) from public, anon;
revoke all on function public.sts_save_ws_invoice(uuid, uuid, uuid, date, date, text, text, text, integer, integer, jsonb) from public, anon;
revoke all on function public.sts_issue_ws_invoice(uuid, uuid) from public, anon;
revoke all on function public.sts_record_ws_invoice_payment(uuid, uuid) from public, anon;
revoke all on function public.sts_void_ws_invoice(uuid, uuid) from public, anon;
revoke all on function public.sts_archive_ws_invoice(uuid, uuid) from public, anon;

grant execute on function public.sts_ops_assert_org_lead(uuid, uuid) to authenticated;
grant execute on function public.sts_ops_assert_org_task(uuid, uuid) to authenticated;
grant execute on function public.sts_ws_assert_note_related(uuid, text, uuid) to authenticated;
grant execute on function public.sts_save_ws_note(uuid, uuid, text, text, text, uuid, boolean) to authenticated;
grant execute on function public.sts_archive_ws_note(uuid, uuid) to authenticated;
grant execute on function public.sts_save_ws_document(uuid, uuid, text, text, text, integer, text, text, uuid, uuid) to authenticated;
grant execute on function public.sts_archive_ws_document(uuid, uuid) to authenticated;
grant execute on function public.sts_save_ws_calendar_event(uuid, uuid, text, text, timestamptz, timestamptz, boolean, text, uuid, uuid, text, text) to authenticated;
grant execute on function public.sts_archive_ws_calendar_event(uuid, uuid) to authenticated;
grant execute on function public.sts_save_ws_invoice(uuid, uuid, uuid, date, date, text, text, text, integer, integer, jsonb) to authenticated;
grant execute on function public.sts_issue_ws_invoice(uuid, uuid) to authenticated;
grant execute on function public.sts_record_ws_invoice_payment(uuid, uuid) to authenticated;
grant execute on function public.sts_void_ws_invoice(uuid, uuid) to authenticated;
grant execute on function public.sts_archive_ws_invoice(uuid, uuid) to authenticated;
-- replace_invoice_lines is internal; do not grant to authenticated or anon.
