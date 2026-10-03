-- Day 8 closure: stop accountant SELECT on sensitive operational base tables.
-- Forward-only. Does not weaken owner/administrator policies or Day 1–7 isolation.
-- security_invoker accountant views cannot survive this lockdown; they are replaced
-- with parameterless SECURITY DEFINER read functions that derive the organization
-- from the authenticated AAL2 membership and return allowlisted columns only.
-- Do not embed Auth user UUIDs or mailbox names.
-- Do not activate payments, payroll, tax filing, banking, Stripe, QuickBooks, e-sign, or email.

-- ---------------------------------------------------------------------------
-- Recreate read helpers without accountant. Owner/administrator (and employee
-- where that role already had operational read) stay unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.sts_can_read_finance(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_has_organization_role(
    p_org_id,
    array['owner', 'administrator', 'employee']
  );
$$;

comment on function public.sts_can_read_finance(uuid) is
  'True for an active owner, administrator, or employee at trusted AAL2. Accountants use sts_list_accountant_* instead of base-table SELECT.';

create or replace function public.sts_can_read_invoices(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_has_organization_role(
    p_org_id,
    array['owner', 'administrator']
  );
$$;

comment on function public.sts_can_read_invoices(uuid) is
  'True for an active owner or administrator at trusted AAL2. Accountants cannot SELECT ws_invoices, lines, or counters.';

create or replace function public.sts_can_read_documents(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_has_organization_role(
    p_org_id,
    array['owner', 'administrator', 'employee']
  );
$$;

comment on function public.sts_can_read_documents(uuid) is
  'True for an active owner, administrator, or employee at trusted AAL2. Accountants cannot SELECT documents or org-documents storage.';

drop policy if exists ops_revenue_select_scoped on public.ops_revenue;
create policy ops_revenue_select_scoped on public.ops_revenue for select
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists business_settings_select_staff on public.business_settings;
create policy business_settings_select_staff
  on public.business_settings
  for select
  using (
    public.sts_has_organization_role(
      organization_id,
      array['owner', 'administrator', 'employee']
    )
  );

-- ---------------------------------------------------------------------------
-- Drop security_invoker views. They required accountant SELECT on base tables.
-- ---------------------------------------------------------------------------
drop view if exists public.sts_accountant_monthly_summary;
drop view if exists public.sts_accountant_invoices;
drop view if exists public.sts_accountant_expenses;
drop view if exists public.sts_accountant_revenue;

-- ---------------------------------------------------------------------------
-- Narrow SECURITY DEFINER reads. No client-supplied organization id.
-- ---------------------------------------------------------------------------
create or replace function public.sts_list_accountant_invoices()
returns table (
  id uuid,
  invoice_number text,
  status text,
  issue_date date,
  due_date date,
  currency text,
  client_business_name text,
  subtotal_cents integer,
  tax_cents integer,
  total_cents integer,
  amount_paid_cents integer,
  paid_at timestamptz,
  archived_at timestamptz
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
  if not public.sts_can_read_accountant_center(org_id) then
    raise exception 'not authorized';
  end if;
  return query
  select
    i.id,
    i.invoice_number,
    i.status,
    i.issue_date,
    i.due_date,
    i.currency,
    i.client_business_name,
    i.subtotal_cents,
    i.tax_cents,
    i.total_cents,
    i.amount_paid_cents,
    i.paid_at,
    i.archived_at
  from public.ws_invoices as i
  where i.organization_id = org_id
  order by i.issue_date desc nulls last, i.created_at desc
  limit 500;
end;
$$;

comment on function public.sts_list_accountant_invoices() is
  'Allowlisted invoice identity for AAL2 accountant-read sessions. Organization is taken from membership. No notes, emails, phones, payment instructions, or client/project ids.';

create or replace function public.sts_list_accountant_expenses()
returns table (
  id uuid,
  transaction_date date,
  vendor text,
  description text,
  category text,
  currency text,
  total_cents integer,
  reimbursable boolean,
  reimbursement_status text,
  archived_at timestamptz
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
  if not public.sts_can_read_accountant_center(org_id) then
    raise exception 'not authorized';
  end if;
  return query
  select
    e.id,
    e.transaction_date,
    e.vendor,
    e.description,
    e.category,
    e.currency,
    e.total_cents,
    e.reimbursable,
    e.reimbursement_status,
    e.archived_at
  from public.ops_expenses as e
  where e.organization_id = org_id
  order by e.transaction_date desc, e.created_at desc
  limit 500;
end;
$$;

comment on function public.sts_list_accountant_expenses() is
  'Allowlisted expense review columns for AAL2 accountant-read sessions. No notes, payment account, payment method, business purpose, or client/project ids.';

create or replace function public.sts_list_accountant_revenue()
returns table (
  id uuid,
  earned_date date,
  entry_type text,
  description text,
  invoice_number text,
  currency text,
  amount_cents integer,
  payment_status text,
  archived_at timestamptz
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
  if not public.sts_can_read_accountant_center(org_id) then
    raise exception 'not authorized';
  end if;
  return query
  select
    r.id,
    r.earned_date,
    r.entry_type,
    r.description,
    r.invoice_number,
    r.currency,
    r.amount_cents,
    r.payment_status,
    r.archived_at
  from public.ops_revenue as r
  where r.organization_id = org_id
  order by r.earned_date desc, r.created_at desc
  limit 500;
end;
$$;

comment on function public.sts_list_accountant_revenue() is
  'Allowlisted operational revenue for AAL2 accountant-read sessions. Estimates are never sourced. No notes, payment method, or client/project ids.';

revoke all on function public.sts_list_accountant_invoices() from public, anon;
revoke all on function public.sts_list_accountant_expenses() from public, anon;
revoke all on function public.sts_list_accountant_revenue() from public, anon;
grant execute on function public.sts_list_accountant_invoices() to authenticated;
grant execute on function public.sts_list_accountant_expenses() to authenticated;
grant execute on function public.sts_list_accountant_revenue() to authenticated;
