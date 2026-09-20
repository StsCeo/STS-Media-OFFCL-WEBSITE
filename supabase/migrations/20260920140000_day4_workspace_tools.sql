-- Day 4: persist notes, documents, calendar events, and invoices.
-- Additive. Organization-owned. Integer cents. Forced RLS. No authenticated hard-delete.
-- Do not embed Auth user UUIDs or mailbox names.
-- Do not activate payments, payroll, tax filing, banking, Stripe, QuickBooks, e-sign, or email.

create or replace function public.sts_can_read_notes(p_org_id uuid)
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

create or replace function public.sts_can_write_notes(p_org_id uuid)
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

create or replace function public.sts_can_read_calendar(p_org_id uuid)
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

create or replace function public.sts_can_write_calendar(p_org_id uuid)
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

create or replace function public.sts_can_read_documents(p_org_id uuid)
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

create or replace function public.sts_can_write_documents(p_org_id uuid)
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

create or replace function public.sts_can_read_invoices(p_org_id uuid)
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

create or replace function public.sts_can_write_invoices(p_org_id uuid)
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

revoke all on function public.sts_can_read_notes(uuid) from public, anon;
revoke all on function public.sts_can_write_notes(uuid) from public, anon;
revoke all on function public.sts_can_read_calendar(uuid) from public, anon;
revoke all on function public.sts_can_write_calendar(uuid) from public, anon;
revoke all on function public.sts_can_read_documents(uuid) from public, anon;
revoke all on function public.sts_can_write_documents(uuid) from public, anon;
revoke all on function public.sts_can_read_invoices(uuid) from public, anon;
revoke all on function public.sts_can_write_invoices(uuid) from public, anon;
grant execute on function public.sts_can_read_notes(uuid) to authenticated;
grant execute on function public.sts_can_write_notes(uuid) to authenticated;
grant execute on function public.sts_can_read_calendar(uuid) to authenticated;
grant execute on function public.sts_can_write_calendar(uuid) to authenticated;
grant execute on function public.sts_can_read_documents(uuid) to authenticated;
grant execute on function public.sts_can_write_documents(uuid) to authenticated;
grant execute on function public.sts_can_read_invoices(uuid) to authenticated;
grant execute on function public.sts_can_write_invoices(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- ws_notes
-- ---------------------------------------------------------------------------
create table if not exists public.ws_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text not null default '',
  related_type text not null default 'none',
  related_id uuid,
  pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ws_notes_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint ws_notes_body_check check (char_length(body) between 1 and 8000),
  constraint ws_notes_related_type_check check (related_type in ('none', 'client', 'lead', 'project', 'task')),
  constraint ws_notes_related_id_check check (
    (related_type = 'none' and related_id is null)
    or (related_type <> 'none' and related_id is not null)
  )
);

create index if not exists ws_notes_org_updated_idx
  on public.ws_notes (organization_id, archived_at, pinned desc, updated_at desc);

-- ---------------------------------------------------------------------------
-- ws_documents
-- ---------------------------------------------------------------------------
create table if not exists public.ws_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  storage_path text not null,
  display_filename text not null,
  content_type text not null,
  byte_size integer not null,
  description text not null default '',
  category text not null default 'other',
  client_id uuid references public.crm_clients (id) on delete set null,
  project_id uuid references public.ops_projects (id) on delete set null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ws_documents_storage_path_check check (
    char_length(storage_path) between 20 and 400
    and storage_path not like '%..%'
    and storage_path not like '%/%/%/%'
    and storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9._-]+$'
  ),
  constraint ws_documents_filename_check check (char_length(btrim(display_filename)) between 1 and 180),
  constraint ws_documents_content_type_check check (
    content_type in ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')
  ),
  constraint ws_documents_size_check check (byte_size > 0 and byte_size <= 8388608),
  constraint ws_documents_description_check check (char_length(description) <= 2000),
  constraint ws_documents_category_check check (
    category in ('contract', 'formation', 'tax', 'insurance', 'other')
  )
);

create unique index if not exists ws_documents_org_path_uidx
  on public.ws_documents (organization_id, storage_path);
create index if not exists ws_documents_org_updated_idx
  on public.ws_documents (organization_id, archived_at, updated_at desc);

-- ---------------------------------------------------------------------------
-- ws_calendar_events
-- ---------------------------------------------------------------------------
create table if not exists public.ws_calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'America/New_York',
  client_id uuid references public.crm_clients (id) on delete set null,
  project_id uuid references public.ops_projects (id) on delete set null,
  location text not null default '',
  kind text not null default 'team_meeting',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint ws_calendar_title_check check (char_length(btrim(title)) between 2 and 160),
  constraint ws_calendar_description_check check (char_length(description) <= 4000),
  constraint ws_calendar_location_check check (char_length(location) <= 240),
  constraint ws_calendar_timezone_check check (char_length(timezone) between 3 and 64),
  constraint ws_calendar_range_check check (end_at >= start_at),
  constraint ws_calendar_kind_check check (
    kind in (
      'team_meeting',
      'client_meeting',
      'deadline',
      'follow_up',
      'content',
      'invoice_due',
      'domain_renewal',
      'subscription_renewal',
      'task'
    )
  )
);

create index if not exists ws_calendar_org_start_idx
  on public.ws_calendar_events (organization_id, archived_at, start_at);

-- ---------------------------------------------------------------------------
-- ws_invoices + lines + counters
-- ---------------------------------------------------------------------------
create table if not exists public.ws_invoice_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  next_number integer not null default 1,
  constraint ws_invoice_counters_next_check check (next_number >= 1 and next_number <= 999999)
);

create table if not exists public.ws_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.crm_clients (id) on delete set null,
  invoice_number text not null,
  status text not null default 'draft',
  issue_date date,
  due_date date,
  currency text not null default 'USD',
  notes text not null default '',
  payment_instructions text not null default '',
  org_legal_name text not null default '',
  org_display_name text not null default '',
  client_business_name text not null default '',
  client_contact_name text not null default '',
  client_email text not null default '',
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  amount_paid_cents integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  archived_at timestamptz,
  constraint ws_invoices_number_check check (char_length(btrim(invoice_number)) between 2 and 40),
  constraint ws_invoices_status_check check (status in ('draft', 'issued', 'paid', 'void')),
  constraint ws_invoices_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint ws_invoices_notes_check check (char_length(notes) <= 4000),
  constraint ws_invoices_instructions_check check (char_length(payment_instructions) <= 2000),
  constraint ws_invoices_snapshot_check check (
    char_length(org_legal_name) <= 160
    and char_length(org_display_name) <= 160
    and char_length(client_business_name) <= 160
    and char_length(client_contact_name) <= 160
    and char_length(client_email) <= 254
  ),
  constraint ws_invoices_money_check check (
    subtotal_cents >= 0 and subtotal_cents <= 2147483647
    and discount_cents >= 0 and discount_cents <= subtotal_cents
    and tax_cents >= 0 and tax_cents <= 2147483647
    and total_cents = subtotal_cents - discount_cents + tax_cents
    and total_cents >= 0 and total_cents <= 2147483647
    and amount_paid_cents >= 0 and amount_paid_cents <= total_cents
  ),
  constraint ws_invoices_dates_check check (
    (issue_date is null or (issue_date >= date '2000-01-01' and issue_date <= date '2100-01-01'))
    and (due_date is null or (due_date >= date '2000-01-01' and due_date <= date '2100-01-01'))
    and (issue_date is null or due_date is null or due_date >= issue_date)
  ),
  constraint ws_invoices_status_stamps_check check (
    (status = 'draft' and issued_at is null and paid_at is null and voided_at is null)
    or (status = 'issued' and issued_at is not null and paid_at is null and voided_at is null)
    or (status = 'paid' and issued_at is not null and paid_at is not null and voided_at is null and amount_paid_cents = total_cents)
    or (status = 'void' and voided_at is not null and paid_at is null)
  )
);

create unique index if not exists ws_invoices_org_number_uidx
  on public.ws_invoices (organization_id, invoice_number);
create index if not exists ws_invoices_org_status_idx
  on public.ws_invoices (organization_id, archived_at, status, due_date);

create table if not exists public.ws_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invoice_id uuid not null references public.ws_invoices (id) on delete cascade,
  position integer not null,
  description text not null,
  quantity integer not null,
  unit_cents integer not null,
  line_total_cents integer not null,
  created_at timestamptz not null default now(),
  constraint ws_invoice_lines_position_check check (position >= 1 and position <= 100),
  constraint ws_invoice_lines_description_check check (char_length(btrim(description)) between 1 and 240),
  constraint ws_invoice_lines_qty_check check (quantity >= 1 and quantity <= 9999),
  constraint ws_invoice_lines_unit_check check (unit_cents >= 0 and unit_cents <= 99999999),
  constraint ws_invoice_lines_total_check check (
    line_total_cents = quantity * unit_cents
    and line_total_cents >= 0
    and line_total_cents <= 2147483647
  )
);

create unique index if not exists ws_invoice_lines_position_uidx
  on public.ws_invoice_lines (invoice_id, position);
create index if not exists ws_invoice_lines_org_idx
  on public.ws_invoice_lines (organization_id, invoice_id);

drop trigger if exists ws_notes_set_updated_at on public.ws_notes;
create trigger ws_notes_set_updated_at
  before update on public.ws_notes
  for each row execute function public.sts_set_updated_at();
drop trigger if exists ws_documents_set_updated_at on public.ws_documents;
create trigger ws_documents_set_updated_at
  before update on public.ws_documents
  for each row execute function public.sts_set_updated_at();
drop trigger if exists ws_calendar_events_set_updated_at on public.ws_calendar_events;
create trigger ws_calendar_events_set_updated_at
  before update on public.ws_calendar_events
  for each row execute function public.sts_set_updated_at();
drop trigger if exists ws_invoices_set_updated_at on public.ws_invoices;
create trigger ws_invoices_set_updated_at
  before update on public.ws_invoices
  for each row execute function public.sts_set_updated_at();

drop trigger if exists ws_notes_freeze_organization_id on public.ws_notes;
create trigger ws_notes_freeze_organization_id
  before update on public.ws_notes
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ws_documents_freeze_organization_id on public.ws_documents;
create trigger ws_documents_freeze_organization_id
  before update on public.ws_documents
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ws_calendar_events_freeze_organization_id on public.ws_calendar_events;
create trigger ws_calendar_events_freeze_organization_id
  before update on public.ws_calendar_events
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ws_invoices_freeze_organization_id on public.ws_invoices;
create trigger ws_invoices_freeze_organization_id
  before update on public.ws_invoices
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ws_invoice_lines_freeze_organization_id on public.ws_invoice_lines;
create trigger ws_invoice_lines_freeze_organization_id
  before update on public.ws_invoice_lines
  for each row execute function public.sts_freeze_organization_id();

drop trigger if exists ws_notes_reject_archived on public.ws_notes;
create trigger ws_notes_reject_archived
  before update on public.ws_notes
  for each row execute function public.sts_ops_reject_archived_mutation();
drop trigger if exists ws_documents_reject_archived on public.ws_documents;
create trigger ws_documents_reject_archived
  before update on public.ws_documents
  for each row execute function public.sts_ops_reject_archived_mutation();
drop trigger if exists ws_calendar_events_reject_archived on public.ws_calendar_events;
create trigger ws_calendar_events_reject_archived
  before update on public.ws_calendar_events
  for each row execute function public.sts_ops_reject_archived_mutation();
drop trigger if exists ws_invoices_reject_archived on public.ws_invoices;
create trigger ws_invoices_reject_archived
  before update on public.ws_invoices
  for each row execute function public.sts_ops_reject_archived_mutation();

-- ---------------------------------------------------------------------------
-- RLS: no authenticated DELETE
-- ---------------------------------------------------------------------------
alter table public.ws_notes enable row level security;
alter table public.ws_documents enable row level security;
alter table public.ws_calendar_events enable row level security;
alter table public.ws_invoice_counters enable row level security;
alter table public.ws_invoices enable row level security;
alter table public.ws_invoice_lines enable row level security;
alter table public.ws_notes force row level security;
alter table public.ws_documents force row level security;
alter table public.ws_calendar_events force row level security;
alter table public.ws_invoice_counters force row level security;
alter table public.ws_invoices force row level security;
alter table public.ws_invoice_lines force row level security;

revoke all on public.ws_notes from anon, public;
revoke all on public.ws_documents from anon, public;
revoke all on public.ws_calendar_events from anon, public;
revoke all on public.ws_invoice_counters from anon, public;
revoke all on public.ws_invoices from anon, public;
revoke all on public.ws_invoice_lines from anon, public;

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

drop policy if exists ws_notes_select_scoped on public.ws_notes;
create policy ws_notes_select_scoped on public.ws_notes for select
  using (public.sts_can_read_notes(organization_id));
drop policy if exists ws_notes_insert_scoped on public.ws_notes;
create policy ws_notes_insert_scoped on public.ws_notes for insert
  with check (public.sts_can_write_notes(organization_id));
drop policy if exists ws_notes_update_scoped on public.ws_notes;
create policy ws_notes_update_scoped on public.ws_notes for update
  using (public.sts_can_write_notes(organization_id))
  with check (public.sts_can_write_notes(organization_id));

drop policy if exists ws_documents_select_scoped on public.ws_documents;
create policy ws_documents_select_scoped on public.ws_documents for select
  using (public.sts_can_read_documents(organization_id));
drop policy if exists ws_documents_insert_scoped on public.ws_documents;
create policy ws_documents_insert_scoped on public.ws_documents for insert
  with check (public.sts_can_write_documents(organization_id));
drop policy if exists ws_documents_update_scoped on public.ws_documents;
create policy ws_documents_update_scoped on public.ws_documents for update
  using (public.sts_can_write_documents(organization_id))
  with check (public.sts_can_write_documents(organization_id));

drop policy if exists ws_calendar_select_scoped on public.ws_calendar_events;
create policy ws_calendar_select_scoped on public.ws_calendar_events for select
  using (public.sts_can_read_calendar(organization_id));
drop policy if exists ws_calendar_insert_scoped on public.ws_calendar_events;
create policy ws_calendar_insert_scoped on public.ws_calendar_events for insert
  with check (public.sts_can_write_calendar(organization_id));
drop policy if exists ws_calendar_update_scoped on public.ws_calendar_events;
create policy ws_calendar_update_scoped on public.ws_calendar_events for update
  using (public.sts_can_write_calendar(organization_id))
  with check (public.sts_can_write_calendar(organization_id));

drop policy if exists ws_invoice_counters_select_scoped on public.ws_invoice_counters;
create policy ws_invoice_counters_select_scoped on public.ws_invoice_counters for select
  using (public.sts_can_read_invoices(organization_id));
drop policy if exists ws_invoice_counters_insert_scoped on public.ws_invoice_counters;
create policy ws_invoice_counters_insert_scoped on public.ws_invoice_counters for insert
  with check (public.sts_can_write_invoices(organization_id));
drop policy if exists ws_invoice_counters_update_scoped on public.ws_invoice_counters;
create policy ws_invoice_counters_update_scoped on public.ws_invoice_counters for update
  using (public.sts_can_write_invoices(organization_id))
  with check (public.sts_can_write_invoices(organization_id));

drop policy if exists ws_invoices_select_scoped on public.ws_invoices;
create policy ws_invoices_select_scoped on public.ws_invoices for select
  using (public.sts_can_read_invoices(organization_id));
drop policy if exists ws_invoices_insert_scoped on public.ws_invoices;
create policy ws_invoices_insert_scoped on public.ws_invoices for insert
  with check (public.sts_can_write_invoices(organization_id));
drop policy if exists ws_invoices_update_scoped on public.ws_invoices;
create policy ws_invoices_update_scoped on public.ws_invoices for update
  using (public.sts_can_write_invoices(organization_id))
  with check (public.sts_can_write_invoices(organization_id));

drop policy if exists ws_invoice_lines_select_scoped on public.ws_invoice_lines;
create policy ws_invoice_lines_select_scoped on public.ws_invoice_lines for select
  using (public.sts_can_read_invoices(organization_id));
drop policy if exists ws_invoice_lines_insert_scoped on public.ws_invoice_lines;
create policy ws_invoice_lines_insert_scoped on public.ws_invoice_lines for insert
  with check (public.sts_can_write_invoices(organization_id));
drop policy if exists ws_invoice_lines_update_scoped on public.ws_invoice_lines;
create policy ws_invoice_lines_update_scoped on public.ws_invoice_lines for update
  using (public.sts_can_write_invoices(organization_id))
  with check (public.sts_can_write_invoices(organization_id));

comment on table public.ws_notes is
  'Organization notes. Plain text. Soft-archived. Authenticated sessions cannot hard-delete.';
comment on table public.ws_documents is
  'Organization document metadata for private org-documents storage. Antivirus scanning is not implemented.';
comment on table public.ws_calendar_events is
  'Internal calendar only. No external sync, email, or reminders.';
comment on table public.ws_invoices is
  'Operational invoice records. Integer cents. Issued/paid are recorded only; no payment processor.';
comment on table public.ws_invoice_lines is
  'Invoice line items. Totals are computed server-side.';
