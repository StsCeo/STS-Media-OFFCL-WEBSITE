-- Day 5 RPCs for customer estimates. Additive. No identity literals.
-- Ready is an internal lifecycle stamp. It does not send email or export a document.

create or replace function public.sts_est_write_audit(
  p_organization_id uuid,
  p_action text,
  p_entity_id uuid,
  p_from_status text default null,
  p_to_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := jsonb_build_object('result', 'success');
begin
  if p_from_status is not null then
    meta := meta || jsonb_build_object('from_status', p_from_status);
  end if;
  if p_to_status is not null then
    meta := meta || jsonb_build_object('to_status', p_to_status);
  end if;
  insert into public.audit_events (
    organization_id, actor_user_id, action, result, entity_type, entity_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    p_action,
    'success',
    'ws_estimate',
    p_entity_id::text,
    public.sts_sanitize_audit_metadata(meta)
  );
end;
$$;

create or replace function public.sts_est_next_number(p_organization_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_num integer;
  prefix text;
begin
  select coalesce(nullif(btrim(estimate_prefix), ''), 'EST') into prefix
  from public.business_settings
  where organization_id = p_organization_id;
  prefix := coalesce(prefix, 'EST');
  insert into public.ws_estimate_counters (organization_id, next_number)
  values (p_organization_id, 1)
  on conflict (organization_id) do nothing;
  select next_number into next_num from public.ws_estimate_counters
  where organization_id = p_organization_id for update;
  update public.ws_estimate_counters
  set next_number = next_number + 1
  where organization_id = p_organization_id;
  return prefix || '-' || lpad(next_num::text, 4, '0');
end;
$$;

create or replace function public.sts_est_replace_lines(
  p_organization_id uuid,
  p_estimate_id uuid,
  p_lines jsonb
)
returns integer[]
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  pos integer := 0;
  subtotal integer := 0;
  discount integer := 0;
  qty integer;
  unit integer;
  line_discount integer;
  line_total integer;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 100 then
    raise exception 'invalid lines';
  end if;
  delete from public.ws_estimate_lines where estimate_id = p_estimate_id and organization_id = p_organization_id;
  for line in select value from jsonb_array_elements(p_lines)
  loop
    pos := pos + 1;
    qty := (line->>'quantity')::integer;
    unit := (line->>'unit_cents')::integer;
    line_discount := coalesce((line->>'discount_cents')::integer, 0);
    if qty is null or unit is null or line_discount is null then
      raise exception 'invalid lines';
    end if;
    if qty < 1 or unit < 0 or line_discount < 0 then
      raise exception 'invalid lines';
    end if;
    line_total := (qty * unit) - line_discount;
    if line_total < 0 then
      raise exception 'invalid lines';
    end if;
    insert into public.ws_estimate_lines (
      organization_id, estimate_id, position, description, quantity, unit_cents, discount_cents, line_total_cents
    ) values (
      p_organization_id, p_estimate_id, pos, btrim(line->>'description'), qty, unit, line_discount, line_total
    );
    subtotal := subtotal + (qty * unit);
    discount := discount + line_discount;
  end loop;
  return array[subtotal, discount];
end;
$$;

create or replace function public.sts_save_ws_estimate(
  p_organization_id uuid,
  p_id uuid,
  p_client_id uuid,
  p_title text,
  p_description text,
  p_issue_date date,
  p_expires_on date,
  p_currency text,
  p_internal_notes text,
  p_customer_notes text,
  p_terms text,
  p_client_business_name text,
  p_client_contact_name text,
  p_client_email text,
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
  prior public.ws_estimates%rowtype;
  totals integer[];
  subtotal integer;
  discount integer;
  tax integer := coalesce(p_tax_cents, 0);
  total integer;
  assigned_number text;
  snap_business text := coalesce(p_client_business_name, '');
  snap_contact text := coalesce(p_client_contact_name, '');
  snap_email text := coalesce(p_client_email, '');
  default_terms text;
begin
  if auth.uid() is null or not public.sts_can_write_estimates(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  if tax < 0 then
    raise exception 'invalid totals';
  end if;
  if p_client_id is not null then
    select
      coalesce(nullif(btrim(p_client_business_name), ''), business_name, ''),
      coalesce(nullif(btrim(p_client_contact_name), ''), contact_name, ''),
      coalesce(nullif(btrim(p_client_email), ''), email, '')
    into snap_business, snap_contact, snap_email
    from public.crm_clients
    where id = p_client_id and organization_id = p_organization_id;
    if not found then
      raise exception 'invalid client';
    end if;
  end if;

  if p_id is null then
    select coalesce(default_payment_terms, '') into default_terms
    from public.business_settings where organization_id = p_organization_id;
    assigned_number := public.sts_est_next_number(p_organization_id);
    insert into public.ws_estimates (
      organization_id, client_id, estimate_number, status, title, description,
      issue_date, expires_on, currency, internal_notes, customer_notes, terms,
      client_business_name, client_contact_name, client_email, created_by
    ) values (
      p_organization_id, p_client_id, assigned_number, 'draft', btrim(p_title),
      coalesce(p_description, ''), p_issue_date, p_expires_on, coalesce(p_currency, 'USD'),
      coalesce(p_internal_notes, ''), coalesce(p_customer_notes, ''),
      coalesce(nullif(btrim(coalesce(p_terms, '')), ''), coalesce(default_terms, '')),
      coalesce(snap_business, ''), coalesce(snap_contact, ''), coalesce(snap_email, ''), auth.uid()
    )
    returning id into record_id;
    totals := public.sts_est_replace_lines(p_organization_id, record_id, p_lines);
    subtotal := totals[1];
    discount := totals[2];
    if discount > subtotal then
      raise exception 'invalid totals';
    end if;
    total := subtotal - discount + tax;
    update public.ws_estimates
    set subtotal_cents = subtotal, discount_cents = discount, tax_cents = tax, total_cents = total
    where id = record_id;
    perform public.sts_est_write_audit(p_organization_id, 'ws_estimate.created', record_id, null, 'draft');
    return record_id;
  end if;

  select * into prior from public.ws_estimates
  where id = p_id and organization_id = p_organization_id;
  if prior.id is null then
    raise exception 'not found';
  end if;
  if prior.status <> 'draft' or prior.archived_at is not null then
    raise exception 'invalid status';
  end if;
  totals := public.sts_est_replace_lines(p_organization_id, prior.id, p_lines);
  subtotal := totals[1];
  discount := totals[2];
  if discount > subtotal then
    raise exception 'invalid totals';
  end if;
  total := subtotal - discount + tax;
  update public.ws_estimates
  set
    client_id = p_client_id,
    title = btrim(p_title),
    description = coalesce(p_description, ''),
    issue_date = p_issue_date,
    expires_on = p_expires_on,
    currency = coalesce(p_currency, prior.currency),
    internal_notes = coalesce(p_internal_notes, ''),
    customer_notes = coalesce(p_customer_notes, ''),
    terms = coalesce(p_terms, ''),
    client_business_name = coalesce(snap_business, ''),
    client_contact_name = coalesce(snap_contact, ''),
    client_email = coalesce(snap_email, ''),
    subtotal_cents = subtotal,
    discount_cents = discount,
    tax_cents = tax,
    total_cents = total
  where id = prior.id and organization_id = p_organization_id and archived_at is null
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_est_write_audit(p_organization_id, 'ws_estimate.updated', record_id, 'draft', 'draft');
  return record_id;
end;
$$;

create or replace function public.sts_set_ws_estimate_status(
  p_organization_id uuid,
  p_id uuid,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.ws_estimates%rowtype;
  org_legal text;
  org_display text;
  allowed boolean := false;
begin
  if auth.uid() is null or not public.sts_can_write_estimates(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if p_status is null or p_status not in ('draft', 'ready', 'accepted', 'declined', 'expired') then
    raise exception 'invalid status';
  end if;
  select * into rec from public.ws_estimates
  where id = p_id and organization_id = p_organization_id for update;
  if rec.id is null then
    raise exception 'not found';
  end if;
  if rec.archived_at is not null then
    raise exception 'archived';
  end if;
  if rec.status = p_status then
    return rec.id;
  end if;
  if rec.status = 'draft' and p_status = 'ready' then
    allowed := true;
  elsif rec.status = 'ready' and p_status in ('draft', 'accepted', 'declined', 'expired') then
    allowed := true;
  end if;
  if not allowed then
    raise exception 'invalid status';
  end if;
  if p_status = 'ready' then
    if not exists (select 1 from public.ws_estimate_lines where estimate_id = rec.id) then
      raise exception 'invalid lines';
    end if;
    select legal_name, display_name into org_legal, org_display
    from public.organizations where id = p_organization_id;
    update public.ws_estimates
    set
      status = 'ready',
      ready_at = now(),
      accepted_at = null,
      declined_at = null,
      expired_at = null,
      issue_date = coalesce(rec.issue_date, current_date),
      org_legal_name = coalesce(org_legal, ''),
      org_display_name = coalesce(org_display, '')
    where id = rec.id;
  elsif p_status = 'draft' then
    update public.ws_estimates
    set status = 'draft', ready_at = null, accepted_at = null, declined_at = null, expired_at = null
    where id = rec.id;
  elsif p_status = 'accepted' then
    update public.ws_estimates
    set status = 'accepted', accepted_at = now(), declined_at = null, expired_at = null
    where id = rec.id;
  elsif p_status = 'declined' then
    update public.ws_estimates
    set status = 'declined', declined_at = now(), accepted_at = null, expired_at = null
    where id = rec.id;
  else
    update public.ws_estimates
    set status = 'expired', expired_at = now(), accepted_at = null, declined_at = null
    where id = rec.id;
  end if;
  perform public.sts_est_write_audit(p_organization_id, 'ws_estimate.status_changed', rec.id, rec.status, p_status);
  return rec.id;
end;
$$;

create or replace function public.sts_archive_ws_estimate(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_estimates(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ws_estimates
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_est_write_audit(p_organization_id, 'ws_estimate.archived', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_restore_ws_estimate(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_estimates(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform set_config('sts.allow_estimate_restore', '1', true);
  update public.ws_estimates
  set archived_at = null
  where id = p_id and organization_id = p_organization_id and archived_at is not null
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_est_write_audit(p_organization_id, 'ws_estimate.restored', record_id);
  return record_id;
end;
$$;

revoke all on function public.sts_est_write_audit(uuid, text, uuid, text, text) from public, anon;
revoke all on function public.sts_est_next_number(uuid) from public, anon;
revoke all on function public.sts_est_replace_lines(uuid, uuid, jsonb) from public, anon;
revoke all on function public.sts_save_ws_estimate(uuid, uuid, uuid, text, text, date, date, text, text, text, text, text, text, text, integer, jsonb) from public, anon;
revoke all on function public.sts_set_ws_estimate_status(uuid, uuid, text) from public, anon;
revoke all on function public.sts_archive_ws_estimate(uuid, uuid) from public, anon;
revoke all on function public.sts_restore_ws_estimate(uuid, uuid) from public, anon;

grant execute on function public.sts_save_ws_estimate(uuid, uuid, uuid, text, text, date, date, text, text, text, text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.sts_set_ws_estimate_status(uuid, uuid, text) to authenticated;
grant execute on function public.sts_archive_ws_estimate(uuid, uuid) to authenticated;
grant execute on function public.sts_restore_ws_estimate(uuid, uuid) to authenticated;
-- next_number, replace_lines, and write_audit are internal; do not grant to authenticated or anon.
