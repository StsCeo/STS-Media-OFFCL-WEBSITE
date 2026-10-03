-- STS Media Business OS — Day 1 organization foundation
-- Additive. Does not drop Phase 1 os_* tables or legacy draft tables.
-- Do not treat 20260911120000_init.sql as the live production model.
-- This migration does not activate Stripe, payroll, tax filing, e-sign, or QuickBooks.
-- Do not store EINs, Social Security numbers, card numbers, CVV codes,
-- banking passwords, access tokens, or payroll credentials.

create extension if not exists "pgcrypto";

create or replace function public.sts_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null default 'Scars to Stars Media',
  display_name text not null default 'STS Media',
  slug text not null,
  base_currency text not null default 'USD',
  timezone text not null default 'America/New_York',
  fiscal_year_start integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_unique unique (slug),
  constraint organizations_fiscal_year_start_check check (fiscal_year_start between 1 and 12),
  constraint organizations_base_currency_check check (base_currency ~ '^[A-Z]{3}$')
);

alter table public.organizations add column if not exists legal_name text;
alter table public.organizations add column if not exists display_name text;
alter table public.organizations add column if not exists base_currency text;
alter table public.organizations add column if not exists timezone text;
alter table public.organizations add column if not exists fiscal_year_start integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organizations' and column_name = 'name'
  ) then
    execute $sql$
      update public.organizations
      set legal_name = coalesce(nullif(legal_name, ''), name, 'Scars to Stars Media')
      where legal_name is null or legal_name = ''
    $sql$;
    execute $sql$
      update public.organizations
      set display_name = coalesce(nullif(display_name, ''), name, 'STS Media')
      where display_name is null or display_name = ''
    $sql$;
  end if;
end $$;

update public.organizations
set
  legal_name = coalesce(nullif(legal_name, ''), 'Scars to Stars Media'),
  display_name = coalesce(nullif(display_name, ''), 'STS Media'),
  slug = coalesce(nullif(slug, ''), 'sts-media'),
  base_currency = coalesce(nullif(base_currency, ''), 'USD'),
  timezone = coalesce(nullif(timezone, ''), 'America/New_York'),
  fiscal_year_start = coalesce(fiscal_year_start, 1);

alter table public.organizations alter column legal_name set default 'Scars to Stars Media';
alter table public.organizations alter column display_name set default 'STS Media';
alter table public.organizations alter column base_currency set default 'USD';
alter table public.organizations alter column timezone set default 'America/New_York';
alter table public.organizations alter column fiscal_year_start set default 1;

alter table public.organizations alter column legal_name set not null;
alter table public.organizations alter column display_name set not null;
alter table public.organizations alter column slug set not null;
alter table public.organizations alter column base_currency set not null;
alter table public.organizations alter column timezone set not null;
alter table public.organizations alter column fiscal_year_start set not null;

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  status text not null default 'invited',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_role_check check (
    role in ('owner', 'administrator', 'accountant', 'employee', 'contractor', 'client')
  ),
  constraint organization_members_status_check check (
    status in ('invited', 'active', 'disabled', 'removed')
  ),
  constraint organization_members_unique_user unique (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id, status);
create index if not exists organization_members_org_idx
  on public.organization_members (organization_id, role, status);

-- ---------------------------------------------------------------------------
-- business_settings
-- ---------------------------------------------------------------------------
create table if not exists public.business_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  invoice_prefix text not null default 'STS',
  estimate_prefix text not null default 'EST',
  default_payment_terms text not null default 'Net 15',
  brand_settings jsonb not null default '{"palette_id":"charcoal-sage","accent_color":"","logo_text":"STS"}'::jsonb,
  notification_settings jsonb not null default '{"email_invoices":false,"email_estimates":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_settings_invoice_prefix_check check (invoice_prefix ~ '^[A-Za-z0-9]{2,12}$'),
  constraint business_settings_estimate_prefix_check check (estimate_prefix ~ '^[A-Za-z0-9]{2,12}$')
);

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx
  on public.audit_events (organization_id, created_at desc);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.sts_set_updated_at();

drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.sts_set_updated_at();

drop trigger if exists business_settings_set_updated_at on public.business_settings;
create trigger business_settings_set_updated_at
  before update on public.business_settings
  for each row execute function public.sts_set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER to avoid recursive RLS)
-- ---------------------------------------------------------------------------
create or replace function public.sts_active_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid()
    and status = 'active';
$$;

create or replace function public.sts_is_organization_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and organization_id = p_org_id
      and status = 'active'
  );
$$;

create or replace function public.sts_has_organization_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and organization_id = p_org_id
      and status = 'active'
      and role = any (p_roles)
  );
$$;

create or replace function public.sts_sanitize_audit_metadata(p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb := '{}'::jsonb;
  rec record;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return '{}'::jsonb;
  end if;
  for rec in select * from jsonb_each(p)
  loop
    if rec.key ~* '(password|passwd|token|secret|ssn|ein|itin|cvv|cvc|pan|card|bank|routing|iban|swift|account_number|access_token|refresh_token|api[_-]?key|authorization|credential|private_key|session)' then
      continue;
    end if;
    if jsonb_typeof(rec.value) = 'object' then
      result := result || jsonb_build_object(rec.key, public.sts_sanitize_audit_metadata(rec.value));
    else
      result := result || jsonb_build_object(rec.key, rec.value);
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.sts_record_audit_event(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_is_organization_member(p_organization_id) then
    raise exception 'not authorized';
  end if;
  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    public.sts_sanitize_audit_metadata(coalesce(p_metadata, '{}'::jsonb))
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.sts_active_organization_ids() from public, anon;
revoke all on function public.sts_is_organization_member(uuid) from public, anon;
revoke all on function public.sts_has_organization_role(uuid, text[]) from public, anon;
revoke all on function public.sts_record_audit_event(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.sts_active_organization_ids() to authenticated;
grant execute on function public.sts_is_organization_member(uuid) to authenticated;
grant execute on function public.sts_has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.sts_record_audit_event(uuid, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security — deny by default, membership-scoped, never grant every authenticated user every organization
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.audit_events enable row level security;

alter table public.organizations force row level security;
alter table public.organization_members force row level security;
alter table public.business_settings force row level security;
alter table public.audit_events force row level security;

revoke all on public.organizations from anon, public;
revoke all on public.organization_members from anon, public;
revoke all on public.business_settings from anon, public;
revoke all on public.audit_events from anon, public;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.business_settings to authenticated;
grant select on public.audit_events to authenticated;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  using (public.sts_is_organization_member(id));

drop policy if exists organizations_update_owner_admin on public.organizations;
create policy organizations_update_owner_admin
  on public.organizations
  for update
  using (public.sts_has_organization_role(id, array['owner', 'administrator']))
  with check (public.sts_has_organization_role(id, array['owner', 'administrator']));

drop policy if exists organization_members_select_scoped on public.organization_members;
create policy organization_members_select_scoped
  on public.organization_members
  for select
  using (
    public.sts_is_organization_member(organization_id)
    and (
      user_id = auth.uid()
      or public.sts_has_organization_role(
        organization_id,
        array['owner', 'administrator', 'employee', 'accountant']
      )
    )
  );

drop policy if exists organization_members_write_owner_admin on public.organization_members;
create policy organization_members_write_owner_admin
  on public.organization_members
  for all
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']))
  with check (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists business_settings_select_staff on public.business_settings;
create policy business_settings_select_staff
  on public.business_settings
  for select
  using (
    public.sts_has_organization_role(
      organization_id,
      array['owner', 'administrator', 'accountant', 'employee']
    )
  );

drop policy if exists business_settings_write_owner_admin on public.business_settings;
create policy business_settings_write_owner_admin
  on public.business_settings
  for all
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']))
  with check (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists audit_events_select_owner_admin on public.audit_events;
create policy audit_events_select_owner_admin
  on public.audit_events
  for select
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

-- No direct insert/update/delete policies on audit_events.
-- Authenticated members write through sts_record_audit_event().
-- Table INSERT/UPDATE/DELETE are not granted beyond SELECT.
-- Service role bypasses RLS for provisioning only.

comment on table public.organizations is 'Business OS tenant. Provision the first owner membership with the service role after the owner user is invited.';
comment on table public.organization_members is 'Organization membership and role. Clients and contractors see only their own row.';
comment on table public.business_settings is 'Operating prefixes and terms. Changes apply to new documents only.';
comment on table public.audit_events is 'Immutable organization audit log. Metadata is sanitized to exclude secrets and government identifiers.';
