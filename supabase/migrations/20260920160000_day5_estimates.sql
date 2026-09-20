-- Day 5: persist customer estimates/quotes as operational records.
-- Additive. Organization-owned. Integer cents. Forced RLS. No authenticated hard-delete.
-- Do not embed Auth user UUIDs or mailbox names.
-- Do not activate email, PDF export, e-sign, contracts, estimate-to-invoice conversion,
-- payments, payroll, tax filing, Stripe, QuickBooks, or external calendar/accounting.

create or replace function public.sts_can_read_estimates(p_org_id uuid)
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

create or replace function public.sts_can_write_estimates(p_org_id uuid)
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

revoke all on function public.sts_can_read_estimates(uuid) from public, anon;
revoke all on function public.sts_can_write_estimates(uuid) from public, anon;
grant execute on function public.sts_can_read_estimates(uuid) to authenticated;
grant execute on function public.sts_can_write_estimates(uuid) to authenticated;

create table if not exists public.ws_estimate_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  next_number integer not null default 1,
  constraint ws_estimate_counters_next_check check (next_number >= 1 and next_number <= 999999)
);

create table if not exists public.ws_estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.crm_clients (id) on delete set null,
  estimate_number text not null,
  status text not null default 'draft',
  title text not null,
  description text not null default '',
  issue_date date,
  expires_on date,
  currency text not null default 'USD',
  internal_notes text not null default '',
  customer_notes text not null default '',
  terms text not null default '',
  org_legal_name text not null default '',
  org_display_name text not null default '',
  client_business_name text not null default '',
  client_contact_name text not null default '',
  client_email text not null default '',
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  archived_at timestamptz,
  constraint ws_estimates_number_check check (char_length(btrim(estimate_number)) between 2 and 40),
  constraint ws_estimates_status_check check (status in ('draft', 'ready', 'accepted', 'declined', 'expired')),
  constraint ws_estimates_title_check check (char_length(btrim(title)) between 2 and 160),
  constraint ws_estimates_description_check check (char_length(description) <= 4000),
  constraint ws_estimates_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint ws_estimates_notes_check check (
    char_length(internal_notes) <= 4000
    and char_length(customer_notes) <= 4000
    and char_length(terms) <= 4000
  ),
  constraint ws_estimates_snapshot_check check (
    char_length(org_legal_name) <= 160
    and char_length(org_display_name) <= 160
    and char_length(client_business_name) <= 160
    and char_length(client_contact_name) <= 160
    and char_length(client_email) <= 254
  ),
  constraint ws_estimates_money_check check (
    subtotal_cents >= 0 and subtotal_cents <= 2147483647
    and discount_cents >= 0 and discount_cents <= subtotal_cents
    and tax_cents >= 0 and tax_cents <= 2147483647
    and total_cents = subtotal_cents - discount_cents + tax_cents
    and total_cents >= 0 and total_cents <= 2147483647
  ),
  constraint ws_estimates_dates_check check (
    (issue_date is null or (issue_date >= date '2000-01-01' and issue_date <= date '2100-01-01'))
    and (expires_on is null or (expires_on >= date '2000-01-01' and expires_on <= date '2100-01-01'))
    and (issue_date is null or expires_on is null or expires_on >= issue_date)
  ),
  constraint ws_estimates_status_stamps_check check (
    (status = 'draft' and ready_at is null and accepted_at is null and declined_at is null and expired_at is null)
    or (status = 'ready' and ready_at is not null and accepted_at is null and declined_at is null and expired_at is null)
    or (status = 'accepted' and ready_at is not null and accepted_at is not null and declined_at is null and expired_at is null)
    or (status = 'declined' and ready_at is not null and declined_at is not null and accepted_at is null and expired_at is null)
    or (status = 'expired' and ready_at is not null and expired_at is not null and accepted_at is null and declined_at is null)
  )
);

create unique index if not exists ws_estimates_org_number_uidx
  on public.ws_estimates (organization_id, estimate_number);
create index if not exists ws_estimates_org_status_idx
  on public.ws_estimates (organization_id, archived_at, status, updated_at desc);

create table if not exists public.ws_estimate_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  estimate_id uuid not null references public.ws_estimates (id) on delete cascade,
  position integer not null,
  description text not null,
  quantity integer not null,
  unit_cents integer not null,
  discount_cents integer not null default 0,
  line_total_cents integer not null,
  created_at timestamptz not null default now(),
  constraint ws_estimate_lines_position_check check (position >= 1 and position <= 100),
  constraint ws_estimate_lines_description_check check (char_length(btrim(description)) between 1 and 240),
  constraint ws_estimate_lines_qty_check check (quantity >= 1 and quantity <= 9999),
  constraint ws_estimate_lines_unit_check check (unit_cents >= 0 and unit_cents <= 99999999),
  constraint ws_estimate_lines_discount_check check (
    discount_cents >= 0 and discount_cents <= (quantity * unit_cents)
  ),
  constraint ws_estimate_lines_total_check check (
    line_total_cents = (quantity * unit_cents) - discount_cents
    and line_total_cents >= 0
    and line_total_cents <= 2147483647
  )
);

create unique index if not exists ws_estimate_lines_position_uidx
  on public.ws_estimate_lines (estimate_id, position);
create index if not exists ws_estimate_lines_org_idx
  on public.ws_estimate_lines (organization_id, estimate_id);

drop trigger if exists ws_estimates_set_updated_at on public.ws_estimates;
create trigger ws_estimates_set_updated_at
  before update on public.ws_estimates
  for each row execute function public.sts_set_updated_at();

drop trigger if exists ws_estimates_freeze_organization_id on public.ws_estimates;
create trigger ws_estimates_freeze_organization_id
  before update on public.ws_estimates
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ws_estimate_lines_freeze_organization_id on public.ws_estimate_lines;
create trigger ws_estimate_lines_freeze_organization_id
  before update on public.ws_estimate_lines
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists ws_estimate_counters_freeze_organization_id on public.ws_estimate_counters;
create trigger ws_estimate_counters_freeze_organization_id
  before update on public.ws_estimate_counters
  for each row execute function public.sts_freeze_organization_id();

create or replace function public.sts_est_reject_archived_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.archived_at is not null then
    if current_setting('sts.allow_estimate_restore', true) = '1' and new.archived_at is null then
      return new;
    end if;
    raise exception 'archived';
  end if;
  return new;
end;
$$;

create or replace function public.sts_est_reject_archived_line_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_id uuid;
begin
  parent_id := coalesce(new.estimate_id, old.estimate_id);
  if exists (
    select 1 from public.ws_estimates
    where id = parent_id and archived_at is not null
  ) then
    raise exception 'archived';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.sts_est_reject_archived_mutation() from public, anon;
revoke all on function public.sts_est_reject_archived_line_mutation() from public, anon;

drop trigger if exists ws_estimates_reject_archived on public.ws_estimates;
create trigger ws_estimates_reject_archived
  before update on public.ws_estimates
  for each row execute function public.sts_est_reject_archived_mutation();
drop trigger if exists ws_estimate_lines_reject_archived_ins on public.ws_estimate_lines;
create trigger ws_estimate_lines_reject_archived_ins
  before insert on public.ws_estimate_lines
  for each row execute function public.sts_est_reject_archived_line_mutation();
drop trigger if exists ws_estimate_lines_reject_archived_upd on public.ws_estimate_lines;
create trigger ws_estimate_lines_reject_archived_upd
  before update on public.ws_estimate_lines
  for each row execute function public.sts_est_reject_archived_line_mutation();
drop trigger if exists ws_estimate_lines_reject_archived_del on public.ws_estimate_lines;
create trigger ws_estimate_lines_reject_archived_del
  before delete on public.ws_estimate_lines
  for each row execute function public.sts_est_reject_archived_line_mutation();

alter table public.ws_estimate_counters enable row level security;
alter table public.ws_estimates enable row level security;
alter table public.ws_estimate_lines enable row level security;
alter table public.ws_estimate_counters force row level security;
alter table public.ws_estimates force row level security;
alter table public.ws_estimate_lines force row level security;

revoke all on public.ws_estimate_counters from anon, public;
revoke all on public.ws_estimates from anon, public;
revoke all on public.ws_estimate_lines from anon, public;

grant select, insert, update on public.ws_estimate_counters to authenticated;
grant select, insert, update on public.ws_estimates to authenticated;
grant select, insert, update on public.ws_estimate_lines to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.ws_estimate_counters to service_role';
    execute 'grant select, insert, update, delete on public.ws_estimates to service_role';
    execute 'grant select, insert, update, delete on public.ws_estimate_lines to service_role';
  end if;
end $$;

drop policy if exists ws_estimate_counters_select_scoped on public.ws_estimate_counters;
create policy ws_estimate_counters_select_scoped on public.ws_estimate_counters for select
  using (public.sts_can_read_estimates(organization_id));
drop policy if exists ws_estimate_counters_insert_scoped on public.ws_estimate_counters;
create policy ws_estimate_counters_insert_scoped on public.ws_estimate_counters for insert
  with check (public.sts_can_write_estimates(organization_id));
drop policy if exists ws_estimate_counters_update_scoped on public.ws_estimate_counters;
create policy ws_estimate_counters_update_scoped on public.ws_estimate_counters for update
  using (public.sts_can_write_estimates(organization_id))
  with check (public.sts_can_write_estimates(organization_id));

drop policy if exists ws_estimates_select_scoped on public.ws_estimates;
create policy ws_estimates_select_scoped on public.ws_estimates for select
  using (public.sts_can_read_estimates(organization_id));
drop policy if exists ws_estimates_insert_scoped on public.ws_estimates;
create policy ws_estimates_insert_scoped on public.ws_estimates for insert
  with check (public.sts_can_write_estimates(organization_id));
drop policy if exists ws_estimates_update_scoped on public.ws_estimates;
create policy ws_estimates_update_scoped on public.ws_estimates for update
  using (public.sts_can_write_estimates(organization_id))
  with check (public.sts_can_write_estimates(organization_id));

drop policy if exists ws_estimate_lines_select_scoped on public.ws_estimate_lines;
create policy ws_estimate_lines_select_scoped on public.ws_estimate_lines for select
  using (public.sts_can_read_estimates(organization_id));
drop policy if exists ws_estimate_lines_insert_scoped on public.ws_estimate_lines;
create policy ws_estimate_lines_insert_scoped on public.ws_estimate_lines for insert
  with check (public.sts_can_write_estimates(organization_id));
drop policy if exists ws_estimate_lines_update_scoped on public.ws_estimate_lines;
create policy ws_estimate_lines_update_scoped on public.ws_estimate_lines for update
  using (public.sts_can_write_estimates(organization_id))
  with check (public.sts_can_write_estimates(organization_id));

comment on table public.ws_estimates is
  'Operational customer estimates/quotes. Integer cents. Ready does not send email or generate a PDF. No e-sign, invoice conversion, or payments.';
comment on table public.ws_estimate_lines is
  'Estimate line items. Totals are computed server-side in integer cents.';
