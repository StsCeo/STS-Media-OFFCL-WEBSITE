-- Day 3: persist Finance and Operations ledgers (expenses, revenue, projects, tasks).
-- Additive. Organization-owned. Integer cents. Forced RLS plus SECURITY DEFINER save/archive RPCs.
-- Do not embed Auth user UUIDs or mailbox names.
-- Do not activate payments, payroll, tax filing, banking, Stripe, or QuickBooks.

create or replace function public.sts_can_read_finance(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_has_organization_role(
    p_org_id,
    array['owner', 'administrator', 'accountant', 'employee']
  );
$$;

create or replace function public.sts_can_write_expenses(p_org_id uuid)
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

create or replace function public.sts_can_write_revenue(p_org_id uuid)
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

create or replace function public.sts_can_manage_operations(p_org_id uuid)
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

revoke all on function public.sts_can_read_finance(uuid) from public, anon;
revoke all on function public.sts_can_write_expenses(uuid) from public, anon;
revoke all on function public.sts_can_write_revenue(uuid) from public, anon;
revoke all on function public.sts_can_manage_operations(uuid) from public, anon;
grant execute on function public.sts_can_read_finance(uuid) to authenticated;
grant execute on function public.sts_can_write_expenses(uuid) to authenticated;
grant execute on function public.sts_can_write_revenue(uuid) to authenticated;
grant execute on function public.sts_can_manage_operations(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ops_projects (created first so expenses/revenue/tasks can reference them)
-- ---------------------------------------------------------------------------
create table if not exists public.ops_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.crm_clients (id) on delete set null,
  name text not null,
  description text not null default '',
  stage text not null default 'lead',
  priority text not null default 'medium',
  start_date date,
  due_date date,
  budget_cents integer not null default 0,
  amount_invoiced_cents integer not null default 0,
  amount_collected_cents integer not null default 0,
  direct_cost_cents integer not null default 0,
  assigned_member_id uuid references auth.users (id) on delete set null,
  assigned_to text not null default 'Owner',
  at_risk boolean not null default false,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ops_projects_name_check check (char_length(btrim(name)) between 2 and 160),
  constraint ops_projects_description_check check (char_length(description) <= 4000),
  constraint ops_projects_notes_check check (char_length(notes) <= 4000),
  constraint ops_projects_assigned_to_check check (char_length(assigned_to) <= 80),
  constraint ops_projects_priority_check check (priority in ('low', 'medium', 'high')),
  constraint ops_projects_money_check check (
    budget_cents >= 0 and budget_cents <= 9999999999
    and amount_invoiced_cents >= 0 and amount_invoiced_cents <= 9999999999
    and amount_collected_cents >= 0 and amount_collected_cents <= 9999999999
    and direct_cost_cents >= 0 and direct_cost_cents <= 9999999999
  ),
  constraint ops_projects_dates_check check (
    (start_date is null or (start_date >= date '2000-01-01' and start_date <= date '2100-01-01'))
    and (due_date is null or (due_date >= date '2000-01-01' and due_date <= date '2100-01-01'))
  ),
  constraint ops_projects_stage_check check (
    stage in (
      'lead',
      'awaiting_deposit',
      'discovery',
      'waiting_for_content',
      'wireframe',
      'in_development',
      'internal_review',
      'client_review',
      'revisions',
      'ready_to_launch',
      'launched',
      'maintenance',
      'on_hold',
      'completed'
    )
  )
);

create index if not exists ops_projects_org_updated_idx
  on public.ops_projects (organization_id, archived_at, updated_at desc);

drop trigger if exists ops_projects_set_updated_at on public.ops_projects;
create trigger ops_projects_set_updated_at
  before update on public.ops_projects
  for each row execute function public.sts_set_updated_at();

-- ---------------------------------------------------------------------------
-- ops_expenses
-- ---------------------------------------------------------------------------
create table if not exists public.ops_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transaction_date date not null,
  posted_date date not null,
  vendor text not null,
  description text not null,
  pretax_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'USD',
  category text not null,
  subcategory text not null default '',
  client_id uuid references public.crm_clients (id) on delete set null,
  project_id uuid references public.ops_projects (id) on delete set null,
  business_purpose text not null default '',
  payment_account text not null default '',
  payment_method text not null default '',
  recurring boolean not null default false,
  billing_frequency text not null default 'one_time',
  receipt_name text,
  receipt_status text not null default 'missing',
  reimbursable boolean not null default false,
  reimbursement_status text not null default 'n/a',
  direct_project_cost boolean not null default false,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ops_expenses_vendor_check check (char_length(btrim(vendor)) between 2 and 160),
  constraint ops_expenses_description_check check (char_length(btrim(description)) between 2 and 240),
  constraint ops_expenses_notes_check check (char_length(notes) <= 4000),
  constraint ops_expenses_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint ops_expenses_money_check check (
    pretax_cents >= 0 and pretax_cents <= 9999999999
    and tax_cents >= 0 and tax_cents <= 9999999999
    and total_cents = pretax_cents + tax_cents
    and total_cents <= 9999999999
  ),
  constraint ops_expenses_dates_check check (
    transaction_date >= date '2000-01-01' and transaction_date <= date '2100-01-01'
    and posted_date >= date '2000-01-01' and posted_date <= date '2100-01-01'
  ),
  constraint ops_expenses_frequency_check check (billing_frequency in ('one_time', 'monthly', 'yearly')),
  constraint ops_expenses_receipt_status_check check (receipt_status in ('missing', 'attached', 'needs_review')),
  constraint ops_expenses_reimbursement_check check (
    reimbursement_status in ('n/a', 'pending', 'reimbursed')
    and (
      (not reimbursable and reimbursement_status = 'n/a')
      or (reimbursable and reimbursement_status in ('pending', 'reimbursed'))
    )
  ),
  constraint ops_expenses_category_check check (
    category in (
      'Business Formation',
      'Registered Agent',
      'Domain & Website',
      'Software & Subscriptions',
      'Advertising & Marketing',
      'Office Supplies',
      'Equipment',
      'Phone & Internet',
      'Professional Services',
      'Banking & Processing Fees',
      'Travel & Mileage',
      'Meals',
      'Education & Training',
      'Other',
      'Software and SaaS subscriptions',
      'AI tools',
      'Website hosting',
      'Domains and DNS',
      'Cloud and database services',
      'Email and communication',
      'Advertising',
      'Marketing',
      'Social media',
      'Contractors and freelancers',
      'Payroll',
      'Legal services',
      'Accounting and bookkeeping',
      'Consulting',
      'Business registration and licenses',
      'Registered-agent fees',
      'Insurance',
      'Bank fees',
      'Payment-processing fees',
      'Office supplies',
      'Computer equipment',
      'Cameras and production equipment',
      'Repairs and maintenance',
      'Phone',
      'Internet',
      'Education and training',
      'Conferences and events',
      'Airfare',
      'Lodging',
      'Rental vehicles',
      'Rideshare and transportation',
      'Mileage',
      'Gas',
      'Parking',
      'Tolls',
      'Business meals',
      'Coworking and office rent',
      'Virtual mailbox',
      'Shipping and postage',
      'Client gifts',
      'Taxes and government fees',
      'Miscellaneous',
      'Needs review'
    )
  )
);

create index if not exists ops_expenses_org_date_idx
  on public.ops_expenses (organization_id, archived_at, transaction_date desc);

drop trigger if exists ops_expenses_set_updated_at on public.ops_expenses;
create trigger ops_expenses_set_updated_at
  before update on public.ops_expenses
  for each row execute function public.sts_set_updated_at();

-- ---------------------------------------------------------------------------
-- ops_revenue
-- ---------------------------------------------------------------------------
create table if not exists public.ops_revenue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.crm_clients (id) on delete set null,
  project_id uuid references public.ops_projects (id) on delete set null,
  source_label text not null default '',
  description text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  invoice_number text not null default '',
  entry_type text not null default 'one_time_project',
  earned_date date not null,
  due_date date,
  paid_date date,
  invoice_status text not null default 'draft',
  payment_status text not null default 'unpaid',
  payment_method text not null default '',
  recurring boolean not null default false,
  recognized boolean not null default false,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ops_revenue_description_check check (char_length(btrim(description)) between 2 and 240),
  constraint ops_revenue_notes_check check (char_length(notes) <= 4000),
  constraint ops_revenue_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint ops_revenue_amount_check check (amount_cents >= 0 and amount_cents <= 9999999999),
  constraint ops_revenue_dates_check check (
    earned_date >= date '2000-01-01' and earned_date <= date '2100-01-01'
    and (due_date is null or (due_date >= date '2000-01-01' and due_date <= date '2100-01-01'))
    and (paid_date is null or (paid_date >= date '2000-01-01' and paid_date <= date '2100-01-01'))
  ),
  constraint ops_revenue_entry_type_check check (
    entry_type in (
      'one_time_project',
      'deposit',
      'final_payment',
      'recurring_maintenance',
      'add_on',
      'refund',
      'discount',
      'tax_collected',
      'processing_fee'
    )
  ),
  constraint ops_revenue_invoice_status_check check (
    invoice_status in ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void')
  ),
  constraint ops_revenue_payment_status_check check (
    payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'failed')
  ),
  constraint ops_revenue_paid_info_check check (
    payment_status <> 'paid'
    or (
      paid_date is not null
      and char_length(btrim(payment_method)) >= 2
    )
  )
);

create index if not exists ops_revenue_org_date_idx
  on public.ops_revenue (organization_id, archived_at, earned_date desc);

drop trigger if exists ops_revenue_set_updated_at on public.ops_revenue;
create trigger ops_revenue_set_updated_at
  before update on public.ops_revenue
  for each row execute function public.sts_set_updated_at();

-- ---------------------------------------------------------------------------
-- ops_tasks
-- ---------------------------------------------------------------------------
create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.ops_projects (id) on delete set null,
  client_id uuid references public.crm_clients (id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'todo',
  priority text not null default 'medium',
  due_date date,
  assigned_member_id uuid references auth.users (id) on delete set null,
  assigned_to text not null default 'Owner',
  completed_at timestamptz,
  notes text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ops_tasks_title_check check (char_length(btrim(title)) between 2 and 160),
  constraint ops_tasks_description_check check (char_length(description) <= 4000),
  constraint ops_tasks_notes_check check (char_length(notes) <= 4000),
  constraint ops_tasks_assigned_to_check check (char_length(assigned_to) <= 80),
  constraint ops_tasks_status_check check (status in ('todo', 'in_progress', 'blocked', 'done')),
  constraint ops_tasks_priority_check check (priority in ('low', 'medium', 'high')),
  constraint ops_tasks_dates_check check (
    due_date is null or (due_date >= date '2000-01-01' and due_date <= date '2100-01-01')
  ),
  constraint ops_tasks_completed_check check (
    (status = 'done' and completed_at is not null)
    or (status <> 'done' and completed_at is null)
  )
);

create index if not exists ops_tasks_org_status_idx
  on public.ops_tasks (organization_id, archived_at, status, due_date);

drop trigger if exists ops_tasks_set_updated_at on public.ops_tasks;
create trigger ops_tasks_set_updated_at
  before update on public.ops_tasks
  for each row execute function public.sts_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ops_projects enable row level security;
alter table public.ops_expenses enable row level security;
alter table public.ops_revenue enable row level security;
alter table public.ops_tasks enable row level security;
alter table public.ops_projects force row level security;
alter table public.ops_expenses force row level security;
alter table public.ops_revenue force row level security;
alter table public.ops_tasks force row level security;

revoke all on public.ops_projects from anon, public;
revoke all on public.ops_expenses from anon, public;
revoke all on public.ops_revenue from anon, public;
revoke all on public.ops_tasks from anon, public;
grant select, insert, update, delete on public.ops_projects to authenticated;
grant select, insert, update, delete on public.ops_expenses to authenticated;
grant select, insert, update, delete on public.ops_revenue to authenticated;
grant select, insert, update, delete on public.ops_tasks to authenticated;

drop policy if exists ops_projects_select_scoped on public.ops_projects;
create policy ops_projects_select_scoped on public.ops_projects for select
  using (public.sts_can_manage_operations(organization_id));
drop policy if exists ops_projects_insert_scoped on public.ops_projects;
create policy ops_projects_insert_scoped on public.ops_projects for insert
  with check (public.sts_can_manage_operations(organization_id));
drop policy if exists ops_projects_update_scoped on public.ops_projects;
create policy ops_projects_update_scoped on public.ops_projects for update
  using (public.sts_can_manage_operations(organization_id))
  with check (public.sts_can_manage_operations(organization_id));
drop policy if exists ops_projects_delete_privileged on public.ops_projects;
create policy ops_projects_delete_privileged on public.ops_projects for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists ops_expenses_select_scoped on public.ops_expenses;
create policy ops_expenses_select_scoped on public.ops_expenses for select
  using (public.sts_can_read_finance(organization_id));
drop policy if exists ops_expenses_insert_scoped on public.ops_expenses;
create policy ops_expenses_insert_scoped on public.ops_expenses for insert
  with check (public.sts_can_write_expenses(organization_id));
drop policy if exists ops_expenses_update_scoped on public.ops_expenses;
create policy ops_expenses_update_scoped on public.ops_expenses for update
  using (public.sts_can_write_expenses(organization_id))
  with check (public.sts_can_write_expenses(organization_id));
drop policy if exists ops_expenses_delete_privileged on public.ops_expenses;
create policy ops_expenses_delete_privileged on public.ops_expenses for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists ops_revenue_select_scoped on public.ops_revenue;
create policy ops_revenue_select_scoped on public.ops_revenue for select
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator', 'accountant']));
drop policy if exists ops_revenue_insert_scoped on public.ops_revenue;
create policy ops_revenue_insert_scoped on public.ops_revenue for insert
  with check (public.sts_can_write_revenue(organization_id));
drop policy if exists ops_revenue_update_scoped on public.ops_revenue;
create policy ops_revenue_update_scoped on public.ops_revenue for update
  using (public.sts_can_write_revenue(organization_id))
  with check (public.sts_can_write_revenue(organization_id));
drop policy if exists ops_revenue_delete_privileged on public.ops_revenue;
create policy ops_revenue_delete_privileged on public.ops_revenue for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists ops_tasks_select_scoped on public.ops_tasks;
create policy ops_tasks_select_scoped on public.ops_tasks for select
  using (public.sts_can_manage_operations(organization_id));
drop policy if exists ops_tasks_insert_scoped on public.ops_tasks;
create policy ops_tasks_insert_scoped on public.ops_tasks for insert
  with check (public.sts_can_manage_operations(organization_id));
drop policy if exists ops_tasks_update_scoped on public.ops_tasks;
create policy ops_tasks_update_scoped on public.ops_tasks for update
  using (public.sts_can_manage_operations(organization_id))
  with check (public.sts_can_manage_operations(organization_id));
drop policy if exists ops_tasks_delete_privileged on public.ops_tasks;
create policy ops_tasks_delete_privileged on public.ops_tasks for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop trigger if exists ops_projects_freeze_organization_id on public.ops_projects;
create trigger ops_projects_freeze_organization_id
  before update on public.ops_projects
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ops_expenses_freeze_organization_id on public.ops_expenses;
create trigger ops_expenses_freeze_organization_id
  before update on public.ops_expenses
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ops_revenue_freeze_organization_id on public.ops_revenue;
create trigger ops_revenue_freeze_organization_id
  before update on public.ops_revenue
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ops_tasks_freeze_organization_id on public.ops_tasks;
create trigger ops_tasks_freeze_organization_id
  before update on public.ops_tasks
  for each row execute function public.sts_freeze_organization_id();

create or replace function public.sts_ops_reject_archived_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.archived_at is not null then
    raise exception 'archived';
  end if;
  return new;
end;
$$;

revoke all on function public.sts_ops_reject_archived_mutation() from public, anon;

drop trigger if exists ops_projects_reject_archived on public.ops_projects;
create trigger ops_projects_reject_archived
  before update on public.ops_projects
  for each row execute function public.sts_ops_reject_archived_mutation();
drop trigger if exists ops_expenses_reject_archived on public.ops_expenses;
create trigger ops_expenses_reject_archived
  before update on public.ops_expenses
  for each row execute function public.sts_ops_reject_archived_mutation();
drop trigger if exists ops_revenue_reject_archived on public.ops_revenue;
create trigger ops_revenue_reject_archived
  before update on public.ops_revenue
  for each row execute function public.sts_ops_reject_archived_mutation();
drop trigger if exists ops_tasks_reject_archived on public.ops_tasks;
create trigger ops_tasks_reject_archived
  before update on public.ops_tasks
  for each row execute function public.sts_ops_reject_archived_mutation();
