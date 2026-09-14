-- STS Media Business OS — Phase 1 owner schema
-- Do not treat 20260911120000_init.sql (org / multi-role / portal) as the live production model.
-- This migration is the Phase 1 owner-only foundation: one owner, RLS by auth.uid(), integer cents.

create extension if not exists "pgcrypto";

create or replace function public.is_phase1_owner()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'info@stsmedia.co';
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner / business
-- ---------------------------------------------------------------------------
create table if not exists public.os_business_profile (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  legal_name text not null default 'Scars to Stars Media',
  dba text not null default 'STS Media',
  entity_type text not null default 'llc',
  federal_classification text not null default 'tbd',
  formation_state text not null default 'Georgia',
  accounting_method text not null default 'cash',
  fiscal_year_type text not null default 'calendar',
  fiscal_year_start_month integer not null default 1,
  timezone text not null default 'America/New_York',
  currency text not null default 'USD',
  website text not null default 'https://stsmedia.co',
  public_email text not null default 'hello@stsmedia.co',
  owner_email text not null default 'info@stsmedia.co',
  tax_reserve_percent numeric(5,2) not null default 0,
  reserved_tax_amount_cents integer not null default 0,
  invoice_number_format text not null default 'STS-{YYYY}-{####}',
  default_payment_terms text not null default 'Net 15',
  default_deposit_percent numeric(5,2) not null default 50,
  s_corp_status text not null default 'not_elected',
  s_corp_notes text not null default 'S-corp status is recorded only. This system does not recommend an election.',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_dashboard_preferences (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  hidden_cards jsonb not null default '[]'::jsonb,
  card_order jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.os_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  industry text not null default '',
  status text not null default 'active',
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid references public.os_clients (id) on delete set null,
  name text not null,
  stage text not null default 'lead',
  start_date date,
  deadline date,
  budget_cents integer not null default 0,
  amount_invoiced_cents integer not null default 0,
  amount_collected_cents integer not null default 0,
  direct_cost_cents integer not null default 0,
  notes text not null default '',
  at_risk boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.os_projects (id) on delete set null,
  client_id uuid references public.os_clients (id) on delete set null,
  title text not null,
  due_date date,
  status text not null default 'todo',
  priority text not null default 'medium',
  assignee text not null default 'Owner',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  related_type text not null default 'none',
  related_id uuid,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  occurred_on date not null,
  kind text not null,
  source text not null default 'manual',
  source_id text,
  description text not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  client_id uuid references public.os_clients (id) on delete set null,
  project_id uuid references public.os_projects (id) on delete set null,
  category text not null default '',
  notes text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_receipts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid references public.os_transactions (id) on delete set null,
  original_name text not null,
  storage_path text not null,
  content_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.os_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null default 'other',
  related_type text not null default 'none',
  related_id uuid,
  notes text not null default '',
  storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_tax_year_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  tax_year integer not null,
  reserve_percent numeric(5,2) not null default 0,
  reserved_amount_cents integer not null default 0,
  notes text not null default '',
  unique (owner_id, tax_year)
);

create table if not exists public.os_tax_checklist_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  tax_year integer not null,
  title text not null,
  notes text not null default '',
  due_date date,
  status text not null default 'todo',
  owner_entered boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  href text not null default '/dashboard',
  kind text not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.os_activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  actor text not null default 'owner',
  action text not null,
  target text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.os_backup_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'ready',
  storage_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Storage (private). Client-files bucket is intentionally not created.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.os_business_profile enable row level security;
alter table public.os_dashboard_preferences enable row level security;
alter table public.os_clients enable row level security;
alter table public.os_projects enable row level security;
alter table public.os_tasks enable row level security;
alter table public.os_notes enable row level security;
alter table public.os_transactions enable row level security;
alter table public.os_receipts enable row level security;
alter table public.os_documents enable row level security;
alter table public.os_tax_year_settings enable row level security;
alter table public.os_tax_checklist_items enable row level security;
alter table public.os_alerts enable row level security;
alter table public.os_activity_events enable row level security;
alter table public.os_backup_jobs enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'os_business_profile',
    'os_dashboard_preferences',
    'os_clients',
    'os_projects',
    'os_tasks',
    'os_notes',
    'os_transactions',
    'os_receipts',
    'os_documents',
    'os_tax_year_settings',
    'os_tax_checklist_items',
    'os_alerts',
    'os_activity_events',
    'os_backup_jobs'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      tbl || '_owner_all',
      tbl
    );
    execute format(
      'create policy %I on public.%I for all using (owner_id = auth.uid() and public.is_phase1_owner()) with check (owner_id = auth.uid() and public.is_phase1_owner())',
      tbl || '_owner_all',
      tbl
    );
  end loop;
end $$;

drop policy if exists receipts_owner_select on storage.objects;
drop policy if exists receipts_owner_write on storage.objects;
drop policy if exists documents_owner_select on storage.objects;
drop policy if exists documents_owner_write on storage.objects;

create policy receipts_owner_select on storage.objects
  for select using (bucket_id = 'receipts' and auth.uid() is not null and public.is_phase1_owner());
create policy receipts_owner_write on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.uid() is not null and public.is_phase1_owner());
create policy documents_owner_select on storage.objects
  for select using (bucket_id = 'documents' and auth.uid() is not null and public.is_phase1_owner());
create policy documents_owner_write on storage.objects
  for insert with check (bucket_id = 'documents' and auth.uid() is not null and public.is_phase1_owner());
