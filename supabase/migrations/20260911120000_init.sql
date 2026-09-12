-- STS Media Command Center schema
-- Apply with the Supabase CLI: supabase db push
-- Enable required extensions first.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Organizations, profiles, roles
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  full_name text,
  role text not null default 'contractor',
  email citext,
  mfa_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid references public.roles (id),
  created_at timestamptz not null default now(),
  unique (organization_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- CRM / delivery
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_name text not null,
  industry text,
  status text not null default 'active',
  portal_enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  name text not null,
  email citext,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_name text not null,
  contact_name text,
  email citext,
  phone text,
  source text,
  requested_service text,
  estimated_value numeric(12,2) not null default 0,
  probability numeric(5,2) not null default 0,
  stage text not null default 'new_inquiry',
  last_contact date,
  next_follow_up date,
  calls_made int not null default 0,
  emails_sent int not null default 0,
  meetings int not null default 0,
  notes text,
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  kind text not null,
  body text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  slug text not null,
  summary text,
  description text,
  active boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  setup_price numeric(12,2),
  monthly_price numeric(12,2),
  included jsonb not null default '[]',
  delivery_estimate text,
  add_ons jsonb not null default '[]',
  featured boolean not null default false,
  cta_label text,
  cta_href text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id),
  package_id uuid references public.packages (id),
  name text not null,
  stage text not null default 'lead',
  start_date date,
  deadline date,
  budget numeric(12,2) not null default 0,
  amount_invoiced numeric(12,2) not null default 0,
  amount_collected numeric(12,2) not null default 0,
  direct_cost numeric(12,2) not null default 0,
  github_repo text,
  vercel_project text,
  production_url text,
  domain text,
  maintenance_plan text,
  credentials_reference text,
  notes text,
  at_risk boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (project_id, profile_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'todo',
  priority text not null default 'medium',
  assignee uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  kind text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  related_id uuid,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

-- ---------------------------------------------------------------------------
-- Commercial
-- ---------------------------------------------------------------------------
create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid references public.leads (id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  number text not null,
  issue_date date,
  due_date date,
  status text not null default 'draft',
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid references public.invoices (id),
  amount numeric(12,2) not null,
  status text not null default 'pending',
  received_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  name text not null,
  monthly_amount numeric(12,2) not null,
  status text not null default 'draft',
  start_date date,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.revenue_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entry_date date not null,
  type text not null,
  description text,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  service text,
  invoice_status text,
  payment_status text not null default 'unpaid',
  due_date date,
  stripe_customer_id text,
  stripe_subscription_id text,
  recognized boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  unique (organization_id, name)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  default_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bank_accounts_reference (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  institution text,
  last4 text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transaction_date date not null,
  posted_date date,
  vendor text,
  description text,
  pretax_amount numeric(12,2) not null default 0,
  sales_tax numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  category text,
  subcategory text,
  client_id uuid references public.clients (id),
  project_id uuid references public.projects (id),
  business_purpose text,
  payment_account text,
  payment_method text,
  recurring boolean not null default false,
  billing_frequency text not null default 'one_time',
  receipt_status text not null default 'missing',
  reimbursable boolean not null default false,
  reimbursement_status text not null default 'n/a',
  direct_project_cost boolean not null default false,
  tax_review_status text not null default 'needs_review',
  deductibility_status text not null default 'unknown',
  tax_year int,
  notes text,
  archived boolean not null default false,
  confirmation_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  category text not null,
  year int not null,
  monthly_limit numeric(12,2) not null default 0
);

-- ---------------------------------------------------------------------------
-- Content / files / comms
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null,
  company_name text not null,
  industry text,
  project_title text,
  service_provided text,
  challenge text,
  solution text,
  deliverables jsonb not null default '[]',
  website_url text,
  start_date date,
  end_date date,
  results jsonb not null default '[]',
  featured boolean not null default false,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  author_name text not null,
  author_role text,
  company text,
  quote text not null,
  approved boolean not null default false,
  published boolean not null default false,
  related_portfolio_id uuid references public.portfolio_items (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  caption text,
  hook text,
  cta text,
  hashtags text[],
  platform text,
  pillar text,
  campaign text,
  status text not null default 'draft',
  publish_date date,
  assigned_creator text,
  reviewer text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  platform text not null,
  handle text,
  status text not null default 'needs_setup',
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  require_manual_review boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid references public.email_templates (id),
  direction text,
  subject text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  status text not null default 'needs_setup',
  last_sync timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  integration_id uuid references public.integrations (id) on delete cascade,
  payload_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text,
  href text,
  kind text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  kind text,
  related_to text,
  visibility text not null default 'private',
  storage_path text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  body text not null,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  actor uuid,
  action text not null,
  target text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email citext not null,
  role text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.brand_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  legal_name text,
  short_name text,
  mission text,
  brand_statement text,
  accent_color text,
  palette_id text not null default 'charcoal-sage',
  calendly_url text,
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists leads_org_stage_idx on public.leads (organization_id, stage);
create index if not exists expenses_org_date_idx on public.expenses (organization_id, transaction_date);
create index if not exists revenue_org_date_idx on public.revenue_entries (organization_id, entry_date);
create index if not exists projects_org_stage_idx on public.projects (organization_id, stage);
create index if not exists invoices_org_status_idx on public.invoices (organization_id, status);
create index if not exists audit_org_created_idx on public.audit_logs (organization_id, created_at desc);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- RLS helper
create or replace function public.current_org_id()
returns uuid language sql stable as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.clients enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.milestones enable row level security;
alter table public.meetings enable row level security;
alter table public.calendar_events enable row level security;
alter table public.services enable row level security;
alter table public.packages enable row level security;
alter table public.proposals enable row level security;
alter table public.contracts enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.revenue_entries enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_categories enable row level security;
alter table public.receipts enable row level security;
alter table public.vendors enable row level security;
alter table public.budgets enable row level security;
alter table public.bank_accounts_reference enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.testimonials enable row level security;
alter table public.content_items enable row level security;
alter table public.content_assets enable row level security;
alter table public.social_accounts enable row level security;
alter table public.email_templates enable row level security;
alter table public.email_activity enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_events enable row level security;
alter table public.notifications enable row level security;
alter table public.files enable row level security;
alter table public.comments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.invitations enable row level security;
alter table public.brand_settings enable row level security;
alter table public.memberships enable row level security;
alter table public.project_members enable row level security;

-- Org isolation policies (members of the same organization)
do $$
declare t text;
begin
  for t in
    select unnest(array[
      'clients','contacts','leads','lead_activities','projects','tasks','milestones','meetings',
      'calendar_events','services','packages','proposals','contracts','invoices','payments',
      'subscriptions','revenue_entries','expenses','expense_categories','receipts','vendors',
      'budgets','bank_accounts_reference','portfolio_items','testimonials','content_items',
      'content_assets','social_accounts','email_templates','email_activity','integrations',
      'integration_events','notifications','files','comments','audit_logs','invitations','brand_settings'
    ])
  loop
    execute format('drop policy if exists org_isolation on public.%I', t);
    execute format(
      'create policy org_isolation on public.%I for all using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())',
      t
    );
  end loop;
end $$;

create policy profiles_self on public.profiles
  for select using (id = auth.uid() or organization_id = public.current_org_id());

-- Public marketing reads can be granted later via a published flag + anon policy.
-- Storage buckets (create in dashboard): receipts, client-files — both private.
