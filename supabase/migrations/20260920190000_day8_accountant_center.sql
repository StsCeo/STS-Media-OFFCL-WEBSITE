-- Day 8: read-only Accountant Center helpers.
-- Additive. Organization-owned. Integer cents. No new writable tables.
-- security_invoker views expose minimized financial columns only.
-- SECURITY DEFINER is limited to filtered finance-audit listing and export audit.
-- Do not embed Auth user UUIDs or mailbox names.
-- Do not activate payments, payroll, tax filing, banking, Stripe, QuickBooks, e-sign, or email.

create or replace function public.sts_can_read_accountant_center(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_has_organization_role(
    p_org_id,
    array['owner', 'administrator', 'accountant']
  );
$$;

comment on function public.sts_can_read_accountant_center(uuid) is
  'True only for an active owner, administrator, or accountant membership at trusted AAL2.';

create or replace function public.sts_accountant_session_organization()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  if auth.uid() is null or not public.sts_session_is_aal2() then
    return null;
  end if;
  select organization_id
    into org_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active'
    and role in ('owner', 'administrator', 'accountant')
  limit 1;
  if org_id is null or not public.sts_can_read_accountant_center(org_id) then
    return null;
  end if;
  return org_id;
end;
$$;

comment on function public.sts_accountant_session_organization() is
  'Returns the authenticated accountant-read membership organization. Never accepts a client-supplied organization id.';

revoke all on function public.sts_can_read_accountant_center(uuid) from public, anon;
revoke all on function public.sts_accountant_session_organization() from public, anon;
grant execute on function public.sts_can_read_accountant_center(uuid) to authenticated;
grant execute on function public.sts_accountant_session_organization() to authenticated;

-- Minimized invoice identity for financial review. No notes, emails, phones, or payment instructions.
create or replace view public.sts_accountant_invoices
with (security_invoker = true) as
select
  i.id,
  i.organization_id,
  i.invoice_number,
  i.status,
  i.issue_date,
  i.due_date,
  i.currency,
  i.client_business_name,
  i.subtotal_cents,
  i.discount_cents,
  i.tax_cents,
  i.total_cents,
  i.amount_paid_cents,
  i.issued_at,
  i.paid_at,
  i.voided_at,
  i.archived_at,
  i.created_at,
  i.updated_at
from public.ws_invoices i
where public.sts_can_read_accountant_center(i.organization_id);

-- Minimized expense columns. No notes, payment account, payment method, or project/client identifiers.
create or replace view public.sts_accountant_expenses
with (security_invoker = true) as
select
  e.id,
  e.organization_id,
  e.transaction_date,
  e.posted_date,
  e.vendor,
  e.description,
  e.pretax_cents,
  e.tax_cents,
  e.total_cents,
  e.currency,
  e.category,
  e.subcategory,
  e.reimbursable,
  e.reimbursement_status,
  e.archived_at,
  e.created_at,
  e.updated_at
from public.ops_expenses e
where public.sts_can_read_accountant_center(e.organization_id);

-- Minimized revenue columns. Estimates are not sourced here. No notes or payment method.
create or replace view public.sts_accountant_revenue
with (security_invoker = true) as
select
  r.id,
  r.organization_id,
  r.source_label,
  r.description,
  r.amount_cents,
  r.currency,
  r.invoice_number,
  r.entry_type,
  r.earned_date,
  r.due_date,
  r.paid_date,
  r.invoice_status,
  r.payment_status,
  r.recognized,
  r.archived_at,
  r.created_at,
  r.updated_at
from public.ops_revenue r
where public.sts_can_read_accountant_center(r.organization_id);

create or replace view public.sts_accountant_monthly_summary
with (security_invoker = true) as
with revenue_months as (
  select
    organization_id,
    to_char(earned_date, 'YYYY-MM') as month_key,
    coalesce(sum(amount_cents) filter (
      where archived_at is null
        and payment_status = 'paid'
        and entry_type <> 'refund'
    ), 0)::bigint as paid_revenue_cents,
    coalesce(sum(amount_cents) filter (
      where archived_at is null
        and payment_status in ('unpaid', 'pending')
    ), 0)::bigint as outstanding_revenue_cents
  from public.sts_accountant_revenue
  group by organization_id, to_char(earned_date, 'YYYY-MM')
),
expense_months as (
  select
    organization_id,
    to_char(transaction_date, 'YYYY-MM') as month_key,
    coalesce(sum(total_cents) filter (where archived_at is null), 0)::bigint as expense_cents,
    coalesce(sum(total_cents) filter (
      where archived_at is null
        and reimbursable
        and reimbursement_status <> 'reimbursed'
    ), 0)::bigint as unreimbursed_cents
  from public.sts_accountant_expenses
  group by organization_id, to_char(transaction_date, 'YYYY-MM')
)
select
  coalesce(r.organization_id, e.organization_id) as organization_id,
  coalesce(r.month_key, e.month_key) as month_key,
  coalesce(r.paid_revenue_cents, 0) as paid_revenue_cents,
  coalesce(r.outstanding_revenue_cents, 0) as outstanding_revenue_cents,
  coalesce(e.expense_cents, 0) as expense_cents,
  coalesce(e.unreimbursed_cents, 0) as unreimbursed_cents
from revenue_months r
full outer join expense_months e
  on r.organization_id = e.organization_id
 and r.month_key = e.month_key;

comment on view public.sts_accountant_invoices is
  'Read-only invoice identity for the Accountant Center. Operational records only. No notes, emails, or payment instructions.';
comment on view public.sts_accountant_expenses is
  'Read-only expense review columns. Operational records only. Archived rows remain labeled by archived_at.';
comment on view public.sts_accountant_revenue is
  'Read-only operational revenue. Estimates are never sourced. Refunds are visible but not paid revenue.';
comment on view public.sts_accountant_monthly_summary is
  'Monthly operational paid revenue and non-archived expenses. Not a tax return or bank balance.';

revoke all on public.sts_accountant_invoices from anon, public;
revoke all on public.sts_accountant_expenses from anon, public;
revoke all on public.sts_accountant_revenue from anon, public;
revoke all on public.sts_accountant_monthly_summary from anon, public;
grant select on public.sts_accountant_invoices to authenticated;
grant select on public.sts_accountant_expenses to authenticated;
grant select on public.sts_accountant_revenue to authenticated;
grant select on public.sts_accountant_monthly_summary to authenticated;

create or replace function public.sts_list_accountant_finance_audit()
returns table (
  occurred_at timestamptz,
  action text,
  entity_type text,
  result text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.sts_accountant_session_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    e.created_at,
    e.action,
    e.entity_type,
    e.result
  from public.audit_events e
  where e.organization_id = org_id
    and (
      e.action like 'ops_expense.%'
      or e.action like 'ops_revenue.%'
      or e.action like 'ws_invoice.%'
      or e.action = 'accountant.exported'
    )
  order by e.created_at desc
  limit 50;
end;
$$;

comment on function public.sts_list_accountant_finance_audit() is
  'Sanitized finance-related audit actions for accountant-read sessions. No metadata, actor ids, or row contents.';

create or replace function public.sts_record_accountant_export(
  p_export_type text,
  p_row_count integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  safe_type text;
  safe_count integer;
  new_id uuid;
begin
  org_id := public.sts_accountant_session_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  safe_type := lower(btrim(coalesce(p_export_type, '')));
  if safe_type not in ('invoices', 'revenue', 'expenses') then
    raise exception 'not authorized';
  end if;
  safe_count := greatest(0, least(coalesce(p_row_count, 0), 1000000));
  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    result
  )
  values (
    org_id,
    auth.uid(),
    'accountant.exported',
    'accountant_export',
    safe_type,
    public.sts_sanitize_audit_metadata(
      jsonb_build_object(
        'export_type', safe_type,
        'row_count', safe_count
      )
    ),
    'success'
  )
  returning id into new_id;
  return new_id;
end;
$$;

comment on function public.sts_record_accountant_export(text, integer) is
  'Records a sanitized accountant.exported event with export type and row count only. Organization comes from membership.';

revoke all on function public.sts_list_accountant_finance_audit() from public, anon;
revoke all on function public.sts_record_accountant_export(text, integer) from public, anon;
grant execute on function public.sts_list_accountant_finance_audit() to authenticated;
grant execute on function public.sts_record_accountant_export(text, integer) to authenticated;
