-- Day 6: accepted estimate to draft invoice, plus printable commercial documents.
-- Additive. Integer cents. Forced RLS remains on ws_invoices. No authenticated hard-delete.
-- Conversion is one atomic, idempotent RPC. It does not send email or collect payment.
-- Do not embed Auth user UUIDs or mailbox names.

alter table public.ws_invoices
  add column if not exists source_estimate_id uuid references public.ws_estimates (id) on delete restrict,
  add column if not exists source_estimate_number text not null default '';

alter table public.ws_invoices
  drop constraint if exists ws_invoices_source_number_check;
alter table public.ws_invoices
  add constraint ws_invoices_source_number_check
  check (char_length(source_estimate_number) <= 40);

create unique index if not exists ws_invoices_source_estimate_uidx
  on public.ws_invoices (source_estimate_id)
  where source_estimate_id is not null;

create or replace function public.sts_ws_assert_same_org_estimate()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_estimate_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.ws_estimates estimate
    where estimate.id = new.source_estimate_id
      and estimate.organization_id = new.organization_id
  ) then
    raise exception 'invalid estimate';
  end if;
  if tg_op = 'UPDATE'
    and old.source_estimate_id is not null
    and new.source_estimate_id is distinct from old.source_estimate_id then
    raise exception 'source_estimate_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists ws_invoices_assert_source_estimate on public.ws_invoices;
create trigger ws_invoices_assert_source_estimate
  before insert or update on public.ws_invoices
  for each row execute function public.sts_ws_assert_same_org_estimate();

revoke all on function public.sts_ws_assert_same_org_estimate() from public, anon, authenticated;

create or replace function public.sts_convert_ws_estimate_to_invoice(
  p_organization_id uuid,
  p_estimate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  estimate public.ws_estimates%rowtype;
  existing_id uuid;
  invoice_id uuid;
  line public.ws_estimate_lines%rowtype;
  pos integer := 0;
  subtotal integer := 0;
  discount integer := 0;
  tax integer := 0;
  total integer := 0;
  draft_number text;
  terms text;
begin
  if auth.uid() is null or not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if p_estimate_id is null then
    raise exception 'not found';
  end if;

  select * into estimate
  from public.ws_estimates
  where id = p_estimate_id and organization_id = p_organization_id
  for update;
  if estimate.id is null then
    raise exception 'not found';
  end if;
  if estimate.archived_at is not null then
    raise exception 'invalid status';
  end if;
  if estimate.status <> 'accepted' then
    raise exception 'invalid status';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, estimate.client_id);

  select id into existing_id
  from public.ws_invoices
  where organization_id = p_organization_id
    and source_estimate_id = estimate.id;
  if existing_id is not null then
    return existing_id;
  end if;

  if not exists (
    select 1 from public.ws_estimate_lines
    where estimate_id = estimate.id and organization_id = p_organization_id
  ) then
    raise exception 'invalid lines';
  end if;

  draft_number := 'DRAFT-' || replace(gen_random_uuid()::text, '-', '');
  terms := left(coalesce(estimate.terms, ''), 2000);

  insert into public.ws_invoices (
    organization_id, client_id, invoice_number, status, issue_date, due_date, currency,
    notes, payment_instructions, org_legal_name, org_display_name,
    client_business_name, client_contact_name, client_email,
    source_estimate_id, source_estimate_number, created_by
  ) values (
    p_organization_id,
    estimate.client_id,
    draft_number,
    'draft',
    coalesce(estimate.issue_date, current_date),
    coalesce(estimate.issue_date, current_date) + 15,
    estimate.currency,
    coalesce(estimate.customer_notes, ''),
    terms,
    coalesce(estimate.org_legal_name, ''),
    coalesce(estimate.org_display_name, ''),
    coalesce(estimate.client_business_name, ''),
    coalesce(estimate.client_contact_name, ''),
    coalesce(estimate.client_email, ''),
    estimate.id,
    estimate.estimate_number,
    auth.uid()
  )
  returning id into invoice_id;

  for line in
    select * from public.ws_estimate_lines
    where estimate_id = estimate.id and organization_id = p_organization_id
    order by position
  loop
    pos := pos + 1;
    insert into public.ws_invoice_lines (
      organization_id, invoice_id, position, description, quantity, unit_cents, line_total_cents
    ) values (
      p_organization_id,
      invoice_id,
      pos,
      line.description,
      line.quantity,
      line.unit_cents,
      line.quantity * line.unit_cents
    );
    subtotal := subtotal + (line.quantity * line.unit_cents);
    discount := discount + line.discount_cents;
  end loop;

  tax := estimate.tax_cents;
  if discount > subtotal then
    raise exception 'invalid totals';
  end if;
  total := subtotal - discount + tax;
  if total <> estimate.total_cents then
    raise exception 'invalid totals';
  end if;

  update public.ws_invoices
  set
    subtotal_cents = subtotal,
    discount_cents = discount,
    tax_cents = tax,
    total_cents = total
  where id = invoice_id and organization_id = p_organization_id;

  insert into public.audit_events (
    organization_id, actor_user_id, action, result, entity_type, entity_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'estimate.converted_to_invoice',
    'success',
    'ws_estimate',
    estimate.id::text,
    public.sts_sanitize_audit_metadata(
      jsonb_build_object('result', 'success', 'invoice_id', invoice_id)
    )
  );

  return invoice_id;
exception
  when unique_violation then
    select id into existing_id
    from public.ws_invoices
    where organization_id = p_organization_id
      and source_estimate_id = p_estimate_id;
    if existing_id is null then
      raise;
    end if;
    return existing_id;
end;
$$;

revoke all on function public.sts_convert_ws_estimate_to_invoice(uuid, uuid) from public, anon;
grant execute on function public.sts_convert_ws_estimate_to_invoice(uuid, uuid) to authenticated;

comment on function public.sts_convert_ws_estimate_to_invoice(uuid, uuid) is
  'Creates one draft invoice from an accepted same-organization estimate. Idempotent. Does not send email or collect payment.';

comment on column public.ws_invoices.source_estimate_id is
  'Optional same-organization estimate that created this draft invoice. Unique when set.';
