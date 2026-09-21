-- Day 9: invitation-only read-only Client Portal.
-- Additive. Organization-owned. Integer cents. Forced RLS. No authenticated hard-delete.
-- Client access is never inferred from record status; publication is explicit.
-- Parameterless / validated SECURITY DEFINER reads derive organization and CRM client
-- from the authenticated AAL2 client mapping. Never accept a client-supplied org id.
-- Do not embed Auth user UUIDs or mailbox names.
-- Do not activate public signup, invitation delivery, payments, e-sign, messaging,
-- public document links, email/SMS, payroll, tax filing, Stripe, or QuickBooks.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.client_portal_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  crm_client_id uuid not null references public.crm_clients (id) on delete restrict,
  status text not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_identities_status_check check (status in ('active', 'disabled'))
);

create unique index if not exists client_portal_identities_org_user_uidx
  on public.client_portal_identities (organization_id, user_id);
create unique index if not exists client_portal_identities_org_client_active_uidx
  on public.client_portal_identities (organization_id, crm_client_id)
  where status = 'active';
create index if not exists client_portal_identities_org_status_idx
  on public.client_portal_identities (organization_id, status, updated_at desc);

create table if not exists public.client_portal_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  crm_client_id uuid not null references public.crm_clients (id) on delete restrict,
  source_type text not null,
  source_id uuid not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users (id) on delete set null,
  unpublished_at timestamptz,
  unpublished_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_publications_source_type_check check (
    source_type in ('estimate', 'invoice', 'project', 'document')
  ),
  constraint client_portal_publications_unpublish_check check (
    unpublished_at is null or unpublished_at >= published_at
  )
);

create unique index if not exists client_portal_publications_org_source_uidx
  on public.client_portal_publications (organization_id, source_type, source_id);
create index if not exists client_portal_publications_org_client_idx
  on public.client_portal_publications (organization_id, crm_client_id, unpublished_at, source_type);

drop trigger if exists client_portal_identities_set_updated_at on public.client_portal_identities;
create trigger client_portal_identities_set_updated_at
  before update on public.client_portal_identities
  for each row execute function public.sts_set_updated_at();
drop trigger if exists client_portal_publications_set_updated_at on public.client_portal_publications;
create trigger client_portal_publications_set_updated_at
  before update on public.client_portal_publications
  for each row execute function public.sts_set_updated_at();

drop trigger if exists client_portal_identities_freeze_organization_id on public.client_portal_identities;
create trigger client_portal_identities_freeze_organization_id
  before update on public.client_portal_identities
  for each row execute function public.sts_freeze_organization_id();
drop trigger if exists client_portal_publications_freeze_organization_id on public.client_portal_publications;
create trigger client_portal_publications_freeze_organization_id
  before update on public.client_portal_publications
  for each row execute function public.sts_freeze_organization_id();

create or replace function public.sts_freeze_client_portal_identity_keys()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.crm_client_id is distinct from old.crm_client_id then
    raise exception 'immutable';
  end if;
  return new;
end;
$$;

create or replace function public.sts_freeze_client_portal_publication_keys()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.crm_client_id is distinct from old.crm_client_id
     or new.source_type is distinct from old.source_type
     or new.source_id is distinct from old.source_id then
    raise exception 'immutable';
  end if;
  return new;
end;
$$;

revoke all on function public.sts_freeze_client_portal_identity_keys() from public, anon;
revoke all on function public.sts_freeze_client_portal_publication_keys() from public, anon;

drop trigger if exists client_portal_identities_freeze_keys on public.client_portal_identities;
create trigger client_portal_identities_freeze_keys
  before update on public.client_portal_identities
  for each row execute function public.sts_freeze_client_portal_identity_keys();
drop trigger if exists client_portal_publications_freeze_keys on public.client_portal_publications;
create trigger client_portal_publications_freeze_keys
  before update on public.client_portal_publications
  for each row execute function public.sts_freeze_client_portal_publication_keys();

alter table public.client_portal_identities enable row level security;
alter table public.client_portal_identities force row level security;
alter table public.client_portal_publications enable row level security;
alter table public.client_portal_publications force row level security;

revoke all on public.client_portal_identities from anon, public, authenticated;
revoke all on public.client_portal_publications from anon, public, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.client_portal_identities to service_role';
    execute 'grant select, insert, update, delete on public.client_portal_publications to service_role';
  end if;
end $$;

-- No authenticated SELECT/INSERT/UPDATE/DELETE policies. Writes go through SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------
create or replace function public.sts_client_portal_session()
returns table (
  organization_id uuid,
  crm_client_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  if auth.uid() is null or not public.sts_session_is_aal2() then
    return;
  end if;
  select om.organization_id
    into org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.status = 'active'
    and om.role = 'client'
  limit 1;
  if org_id is null then
    return;
  end if;
  select i.crm_client_id
    into client_id
  from public.client_portal_identities i
  join public.crm_clients c
    on c.id = i.crm_client_id
   and c.organization_id = i.organization_id
  where i.organization_id = org_id
    and i.user_id = auth.uid()
    and i.status = 'active'
    and c.status = 'active'
  limit 1;
  if client_id is null then
    return;
  end if;
  organization_id := org_id;
  crm_client_id := client_id;
  return next;
end;
$$;

comment on function public.sts_client_portal_session() is
  'Returns the authenticated client portal organization and CRM client. Requires AAL2, active client membership, and an active same-organization mapping. Never accepts a client-supplied organization id.';

create or replace function public.sts_client_portal_publisher_organization()
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
  select om.organization_id
    into org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.status = 'active'
    and om.role in ('owner', 'administrator')
  limit 1;
  if org_id is null or not public.sts_has_organization_role(org_id, array['owner', 'administrator']) then
    return null;
  end if;
  return org_id;
end;
$$;

comment on function public.sts_client_portal_publisher_organization() is
  'Returns the authenticated owner/administrator organization for publication controls. Never accepts a client-supplied organization id.';

create or replace function public.sts_client_portal_profile()
returns table (
  organization_display_name text,
  organization_legal_name text,
  client_business_name text,
  client_contact_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
    return;
  end if;
  return query
  select
    coalesce(nullif(btrim(o.display_name), ''), o.legal_name),
    o.legal_name,
    c.business_name,
    c.contact_name
  from public.organizations o
  join public.crm_clients c
    on c.organization_id = o.id
   and c.id = client_id
  where o.id = org_id
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client reads (allowlisted columns only)
-- ---------------------------------------------------------------------------
create or replace function public.sts_list_client_portal_estimates()
returns table (
  id uuid,
  estimate_number text,
  status text,
  title text,
  description text,
  issue_date date,
  expires_on date,
  currency text,
  customer_notes text,
  terms text,
  org_legal_name text,
  org_display_name text,
  client_business_name text,
  client_contact_name text,
  subtotal_cents integer,
  discount_cents integer,
  tax_cents integer,
  total_cents integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    e.id,
    e.estimate_number,
    e.status,
    e.title,
    e.description,
    e.issue_date,
    e.expires_on,
    e.currency,
    e.customer_notes,
    e.terms,
    e.org_legal_name,
    e.org_display_name,
    e.client_business_name,
    e.client_contact_name,
    e.subtotal_cents,
    e.discount_cents,
    e.tax_cents,
    e.total_cents,
    p.published_at
  from public.ws_estimates e
  join public.client_portal_publications p
    on p.organization_id = e.organization_id
   and p.source_type = 'estimate'
   and p.source_id = e.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where e.organization_id = org_id
    and e.archived_at is null
    and e.client_id = client_id
  order by e.issue_date desc nulls last, e.created_at desc
  limit 200;
end;
$$;

create or replace function public.sts_get_client_portal_estimate(p_id uuid)
returns table (
  id uuid,
  estimate_number text,
  status text,
  title text,
  description text,
  issue_date date,
  expires_on date,
  currency text,
  customer_notes text,
  terms text,
  org_legal_name text,
  org_display_name text,
  client_business_name text,
  client_contact_name text,
  subtotal_cents integer,
  discount_cents integer,
  tax_cents integer,
  total_cents integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_id is null then
    return;
  end if;
  return query
  select l.*
  from public.sts_list_client_portal_estimates() as l
  where l.id = p_id;
end;
$$;

create or replace function public.sts_list_client_portal_estimate_lines()
returns table (
  estimate_id uuid,
  position integer,
  description text,
  quantity integer,
  unit_cents integer,
  discount_cents integer,
  line_total_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    l.estimate_id,
    l.position,
    l.description,
    l.quantity,
    l.unit_cents,
    l.discount_cents,
    l.line_total_cents
  from public.ws_estimate_lines l
  join public.ws_estimates e
    on e.id = l.estimate_id
   and e.organization_id = l.organization_id
  join public.client_portal_publications p
    on p.organization_id = e.organization_id
   and p.source_type = 'estimate'
   and p.source_id = e.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where l.organization_id = org_id
    and e.archived_at is null
    and e.client_id = client_id
  order by l.estimate_id, l.position
  limit 2000;
end;
$$;

create or replace function public.sts_list_client_portal_invoices()
returns table (
  id uuid,
  invoice_number text,
  status text,
  issue_date date,
  due_date date,
  currency text,
  org_legal_name text,
  org_display_name text,
  client_business_name text,
  client_contact_name text,
  subtotal_cents integer,
  discount_cents integer,
  tax_cents integer,
  total_cents integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
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
    i.org_legal_name,
    i.org_display_name,
    i.client_business_name,
    i.client_contact_name,
    i.subtotal_cents,
    i.discount_cents,
    i.tax_cents,
    i.total_cents,
    p.published_at
  from public.ws_invoices i
  join public.client_portal_publications p
    on p.organization_id = i.organization_id
   and p.source_type = 'invoice'
   and p.source_id = i.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where i.organization_id = org_id
    and i.archived_at is null
    and i.client_id = client_id
  order by i.issue_date desc nulls last, i.created_at desc
  limit 200;
end;
$$;

create or replace function public.sts_get_client_portal_invoice(p_id uuid)
returns table (
  id uuid,
  invoice_number text,
  status text,
  issue_date date,
  due_date date,
  currency text,
  org_legal_name text,
  org_display_name text,
  client_business_name text,
  client_contact_name text,
  subtotal_cents integer,
  discount_cents integer,
  tax_cents integer,
  total_cents integer,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_id is null then
    return;
  end if;
  return query
  select l.*
  from public.sts_list_client_portal_invoices() as l
  where l.id = p_id;
end;
$$;

create or replace function public.sts_list_client_portal_invoice_lines()
returns table (
  invoice_id uuid,
  position integer,
  description text,
  quantity integer,
  unit_cents integer,
  line_total_cents integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    l.invoice_id,
    l.position,
    l.description,
    l.quantity,
    l.unit_cents,
    l.line_total_cents
  from public.ws_invoice_lines l
  join public.ws_invoices i
    on i.id = l.invoice_id
   and i.organization_id = l.organization_id
  join public.client_portal_publications p
    on p.organization_id = i.organization_id
   and p.source_type = 'invoice'
   and p.source_id = i.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where l.organization_id = org_id
    and i.archived_at is null
    and i.client_id = client_id
  order by l.invoice_id, l.position
  limit 2000;
end;
$$;

create or replace function public.sts_list_client_portal_projects()
returns table (
  id uuid,
  name text,
  description text,
  status text,
  start_date date,
  deadline date,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    pr.id,
    pr.name,
    pr.description,
    pr.stage,
    pr.start_date,
    pr.due_date,
    p.published_at
  from public.ops_projects pr
  join public.client_portal_publications p
    on p.organization_id = pr.organization_id
   and p.source_type = 'project'
   and p.source_id = pr.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where pr.organization_id = org_id
    and pr.archived_at is null
    and pr.client_id = client_id
  order by pr.due_date desc nulls last, pr.created_at desc
  limit 200;
end;
$$;

create or replace function public.sts_get_client_portal_project(p_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  status text,
  start_date date,
  deadline date,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_id is null then
    return;
  end if;
  return query
  select l.*
  from public.sts_list_client_portal_projects() as l
  where l.id = p_id;
end;
$$;

create or replace function public.sts_list_client_portal_documents()
returns table (
  id uuid,
  title text,
  description text,
  content_type text,
  byte_size integer,
  created_at timestamptz,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    d.id,
    d.display_filename,
    d.description,
    d.content_type,
    d.byte_size,
    d.created_at,
    p.published_at
  from public.ws_documents d
  join public.client_portal_publications p
    on p.organization_id = d.organization_id
   and p.source_type = 'document'
   and p.source_id = d.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where d.organization_id = org_id
    and d.archived_at is null
    and d.client_id = client_id
  order by d.created_at desc
  limit 200;
end;
$$;

create or replace function public.sts_client_portal_authorize_document(p_id uuid)
returns table (
  id uuid,
  title text,
  content_type text,
  byte_size integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  client_id uuid;
  doc_id uuid;
  doc_title text;
  doc_type text;
  doc_size integer;
begin
  select s.organization_id, s.crm_client_id
    into org_id, client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or client_id is null or p_id is null then
    raise exception 'not authorized';
  end if;
  select d.id, d.display_filename, d.content_type, d.byte_size
    into doc_id, doc_title, doc_type, doc_size
  from public.ws_documents d
  join public.client_portal_publications p
    on p.organization_id = d.organization_id
   and p.source_type = 'document'
   and p.source_id = d.id
   and p.unpublished_at is null
   and p.crm_client_id = client_id
  where d.id = p_id
    and d.organization_id = org_id
    and d.archived_at is null
    and d.client_id = client_id
  limit 1;
  if doc_id is null then
    raise exception 'not authorized';
  end if;
  perform public.sts_record_audit_event(
    org_id,
    'client_portal.document_downloaded',
    'document',
    doc_id::text,
    jsonb_build_object('source_type', 'document', 'result', 'success'),
    'success'
  );
  id := doc_id;
  title := doc_title;
  content_type := doc_type;
  byte_size := doc_size;
  return next;
end;
$$;

create or replace function public.sts_client_portal_document_object_name(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  object_name text;
begin
  if p_id is null then
    return null;
  end if;
  select d.storage_path
    into object_name
  from public.ws_documents d
  join public.client_portal_publications p
    on p.organization_id = d.organization_id
   and p.source_type = 'document'
   and p.source_id = d.id
   and p.unpublished_at is null
  where d.id = p_id
    and d.archived_at is null
    and d.client_id = p.crm_client_id
  limit 1;
  return object_name;
end;
$$;

comment on function public.sts_client_portal_document_object_name(uuid) is
  'Server-only object name for a live published client document. Not granted to authenticated or anon.';

-- ---------------------------------------------------------------------------
-- Owner publication and mapping
-- ---------------------------------------------------------------------------
create or replace function public.sts_list_client_portal_identities()
returns table (
  id uuid,
  crm_client_id uuid,
  client_business_name text,
  user_email text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    i.id,
    i.crm_client_id,
    c.business_name,
    u.email::text,
    i.status,
    i.created_at
  from public.client_portal_identities i
  join public.crm_clients c
    on c.id = i.crm_client_id
   and c.organization_id = i.organization_id
  join auth.users u
    on u.id = i.user_id
  where i.organization_id = org_id
  order by i.created_at desc
  limit 200;
end;
$$;

create or replace function public.sts_list_client_portal_candidate_members()
returns table (
  user_id uuid,
  user_email text,
  mapped boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    om.user_id,
    u.email::text,
    exists (
      select 1
      from public.client_portal_identities i
      where i.organization_id = org_id
        and i.user_id = om.user_id
        and i.status = 'active'
    ) as mapped
  from public.organization_members om
  join auth.users u on u.id = om.user_id
  where om.organization_id = org_id
    and om.role = 'client'
    and om.status = 'active'
  order by u.email
  limit 200;
end;
$$;

create or replace function public.sts_link_client_portal_identity(
  p_user_id uuid,
  p_crm_client_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  existing public.client_portal_identities%rowtype;
  new_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null or p_user_id is null or p_crm_client_id is null then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = p_user_id
      and om.role = 'client'
      and om.status = 'active'
  ) then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from public.crm_clients c
    where c.id = p_crm_client_id
      and c.organization_id = org_id
      and c.status = 'active'
  ) then
    raise exception 'not authorized';
  end if;

  select * into existing
  from public.client_portal_identities
  where organization_id = org_id and user_id = p_user_id
  limit 1;

  if existing.id is not null then
    if existing.crm_client_id is distinct from p_crm_client_id then
      raise exception 'cannot reassign';
    end if;
    if existing.status = 'active' then
      return existing.id;
    end if;
    if exists (
      select 1 from public.client_portal_identities i
      where i.organization_id = org_id
        and i.crm_client_id = p_crm_client_id
        and i.status = 'active'
        and i.id <> existing.id
    ) then
      raise exception 'already mapped';
    end if;
    update public.client_portal_identities
    set status = 'active'
    where id = existing.id
    returning id into new_id;
  else
    if exists (
      select 1 from public.client_portal_identities i
      where i.organization_id = org_id
        and i.crm_client_id = p_crm_client_id
        and i.status = 'active'
    ) then
      raise exception 'already mapped';
    end if;
    insert into public.client_portal_identities (
      organization_id, user_id, crm_client_id, status, created_by
    ) values (
      org_id, p_user_id, p_crm_client_id, 'active', auth.uid()
    ) returning id into new_id;
  end if;

  perform public.sts_record_audit_event(
    org_id,
    'client_portal.identity_linked',
    'client_portal_identity',
    new_id::text,
    jsonb_build_object('source_type', 'identity', 'result', 'success'),
    'success'
  );
  return new_id;
end;
$$;

create or replace function public.sts_disable_client_portal_identity(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  updated_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null or p_id is null then
    raise exception 'not authorized';
  end if;
  update public.client_portal_identities
  set status = 'disabled'
  where id = p_id and organization_id = org_id
  returning id into updated_id;
  if updated_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_record_audit_event(
    org_id,
    'client_portal.identity_disabled',
    'client_portal_identity',
    updated_id::text,
    jsonb_build_object('source_type', 'identity', 'result', 'success'),
    'success'
  );
  return updated_id;
end;
$$;

create or replace function public.sts_list_client_portal_publications()
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  crm_client_id uuid,
  client_business_name text,
  published boolean,
  published_at timestamptz,
  unpublished_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    p.id,
    p.source_type,
    p.source_id,
    p.crm_client_id,
    c.business_name,
    (p.unpublished_at is null) as published,
    p.published_at,
    p.unpublished_at
  from public.client_portal_publications p
  join public.crm_clients c
    on c.id = p.crm_client_id
   and c.organization_id = p.organization_id
  where p.organization_id = org_id
  order by p.published_at desc
  limit 500;
end;
$$;

create or replace function public.sts_client_portal_record_visibility(
  p_source_type text,
  p_source_id uuid
)
returns table (
  source_type text,
  source_id uuid,
  published boolean,
  mapping_active boolean,
  archived boolean,
  client_business_name text,
  can_publish boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  src_client uuid;
  src_archived boolean;
  src_exists boolean := false;
  live_pub boolean := false;
  mapped boolean := false;
  business text := '';
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  if p_source_type is null or p_source_id is null
     or p_source_type not in ('estimate', 'invoice', 'project', 'document') then
    return;
  end if;

  if p_source_type = 'estimate' then
    select e.client_id, e.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ws_estimates e
    where e.id = p_source_id and e.organization_id = org_id;
  elsif p_source_type = 'invoice' then
    select i.client_id, i.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ws_invoices i
    where i.id = p_source_id and i.organization_id = org_id;
  elsif p_source_type = 'project' then
    select pr.client_id, pr.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ops_projects pr
    where pr.id = p_source_id and pr.organization_id = org_id;
  else
    select d.client_id, d.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ws_documents d
    where d.id = p_source_id and d.organization_id = org_id;
  end if;

  if not src_exists then
    return;
  end if;

  select p.unpublished_at is null
    into live_pub
  from public.client_portal_publications p
  where p.organization_id = org_id
    and p.source_type = p_source_type
    and p.source_id = p_source_id
  limit 1;
  live_pub := coalesce(live_pub, false);

  if src_client is not null then
    select c.business_name,
           exists (
             select 1 from public.client_portal_identities i
             where i.organization_id = org_id
               and i.crm_client_id = src_client
               and i.status = 'active'
           )
      into business, mapped
    from public.crm_clients c
    where c.id = src_client and c.organization_id = org_id;
  end if;

  source_type := p_source_type;
  source_id := p_source_id;
  published := live_pub;
  mapping_active := coalesce(mapped, false);
  archived := coalesce(src_archived, false);
  client_business_name := coalesce(business, '');
  can_publish := (not coalesce(src_archived, false)) and coalesce(mapped, false) and src_client is not null;
  return next;
end;
$$;

create or replace function public.sts_publish_client_portal_record(
  p_source_type text,
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  src_client uuid;
  src_archived boolean;
  src_exists boolean := false;
  existing public.client_portal_publications%rowtype;
  publication_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  if p_source_type is null or p_source_id is null
     or p_source_type not in ('estimate', 'invoice', 'project', 'document') then
    raise exception 'not authorized';
  end if;

  if p_source_type = 'estimate' then
    select e.client_id, e.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ws_estimates e
    where e.id = p_source_id and e.organization_id = org_id;
  elsif p_source_type = 'invoice' then
    select i.client_id, i.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ws_invoices i
    where i.id = p_source_id and i.organization_id = org_id;
  elsif p_source_type = 'project' then
    select pr.client_id, pr.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ops_projects pr
    where pr.id = p_source_id and pr.organization_id = org_id;
  else
    select d.client_id, d.archived_at is not null, true
      into src_client, src_archived, src_exists
    from public.ws_documents d
    where d.id = p_source_id and d.organization_id = org_id;
  end if;

  if not src_exists or src_client is null then
    raise exception 'not authorized';
  end if;
  if src_archived then
    raise exception 'archived';
  end if;
  if not exists (
    select 1 from public.client_portal_identities i
    join public.crm_clients c
      on c.id = i.crm_client_id
     and c.organization_id = i.organization_id
    where i.organization_id = org_id
      and i.crm_client_id = src_client
      and i.status = 'active'
      and c.status = 'active'
  ) then
    raise exception 'no client portal mapping';
  end if;

  select * into existing
  from public.client_portal_publications
  where organization_id = org_id
    and source_type = p_source_type
    and source_id = p_source_id
  limit 1;

  if existing.id is not null then
    if existing.crm_client_id is distinct from src_client then
      raise exception 'cannot reassign';
    end if;
    if existing.unpublished_at is null then
      raise exception 'already published';
    end if;
    update public.client_portal_publications
    set
      unpublished_at = null,
      unpublished_by = null,
      published_at = now(),
      published_by = auth.uid()
    where id = existing.id
    returning id into publication_id;
  else
    insert into public.client_portal_publications (
      organization_id, crm_client_id, source_type, source_id, published_by
    ) values (
      org_id, src_client, p_source_type, p_source_id, auth.uid()
    ) returning id into publication_id;
  end if;

  perform public.sts_record_audit_event(
    org_id,
    'client_portal.published',
    p_source_type,
    p_source_id::text,
    jsonb_build_object('source_type', p_source_type, 'result', 'success'),
    'success'
  );
  return publication_id;
end;
$$;

create or replace function public.sts_unpublish_client_portal_record(
  p_source_type text,
  p_source_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  publication_id uuid;
begin
  org_id := public.sts_client_portal_publisher_organization();
  if org_id is null then
    raise exception 'not authorized';
  end if;
  if p_source_type is null or p_source_id is null
     or p_source_type not in ('estimate', 'invoice', 'project', 'document') then
    raise exception 'not authorized';
  end if;
  update public.client_portal_publications
  set
    unpublished_at = now(),
    unpublished_by = auth.uid()
  where organization_id = org_id
    and source_type = p_source_type
    and source_id = p_source_id
    and unpublished_at is null
  returning id into publication_id;
  if publication_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_record_audit_event(
    org_id,
    'client_portal.unpublished',
    p_source_type,
    p_source_id::text,
    jsonb_build_object('source_type', p_source_type, 'result', 'success'),
    'success'
  );
  return publication_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.sts_client_portal_session() from public, anon;
revoke all on function public.sts_client_portal_publisher_organization() from public, anon;
revoke all on function public.sts_client_portal_profile() from public, anon;
revoke all on function public.sts_list_client_portal_estimates() from public, anon;
revoke all on function public.sts_get_client_portal_estimate(uuid) from public, anon;
revoke all on function public.sts_list_client_portal_estimate_lines() from public, anon;
revoke all on function public.sts_list_client_portal_invoices() from public, anon;
revoke all on function public.sts_get_client_portal_invoice(uuid) from public, anon;
revoke all on function public.sts_list_client_portal_invoice_lines() from public, anon;
revoke all on function public.sts_list_client_portal_projects() from public, anon;
revoke all on function public.sts_get_client_portal_project(uuid) from public, anon;
revoke all on function public.sts_list_client_portal_documents() from public, anon;
revoke all on function public.sts_client_portal_authorize_document(uuid) from public, anon;
revoke all on function public.sts_client_portal_document_object_name(uuid) from public, anon, authenticated;
revoke all on function public.sts_list_client_portal_identities() from public, anon;
revoke all on function public.sts_list_client_portal_candidate_members() from public, anon;
revoke all on function public.sts_link_client_portal_identity(uuid, uuid) from public, anon;
revoke all on function public.sts_disable_client_portal_identity(uuid) from public, anon;
revoke all on function public.sts_list_client_portal_publications() from public, anon;
revoke all on function public.sts_client_portal_record_visibility(text, uuid) from public, anon;
revoke all on function public.sts_publish_client_portal_record(text, uuid) from public, anon;
revoke all on function public.sts_unpublish_client_portal_record(text, uuid) from public, anon;

grant execute on function public.sts_client_portal_session() to authenticated;
grant execute on function public.sts_client_portal_publisher_organization() to authenticated;
grant execute on function public.sts_client_portal_profile() to authenticated;
grant execute on function public.sts_list_client_portal_estimates() to authenticated;
grant execute on function public.sts_get_client_portal_estimate(uuid) to authenticated;
grant execute on function public.sts_list_client_portal_estimate_lines() to authenticated;
grant execute on function public.sts_list_client_portal_invoices() to authenticated;
grant execute on function public.sts_get_client_portal_invoice(uuid) to authenticated;
grant execute on function public.sts_list_client_portal_invoice_lines() to authenticated;
grant execute on function public.sts_list_client_portal_projects() to authenticated;
grant execute on function public.sts_get_client_portal_project(uuid) to authenticated;
grant execute on function public.sts_list_client_portal_documents() to authenticated;
grant execute on function public.sts_client_portal_authorize_document(uuid) to authenticated;
grant execute on function public.sts_list_client_portal_identities() to authenticated;
grant execute on function public.sts_list_client_portal_candidate_members() to authenticated;
grant execute on function public.sts_link_client_portal_identity(uuid, uuid) to authenticated;
grant execute on function public.sts_disable_client_portal_identity(uuid) to authenticated;
grant execute on function public.sts_list_client_portal_publications() to authenticated;
grant execute on function public.sts_client_portal_record_visibility(text, uuid) to authenticated;
grant execute on function public.sts_publish_client_portal_record(text, uuid) to authenticated;
grant execute on function public.sts_unpublish_client_portal_record(text, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.sts_client_portal_document_object_name(uuid) to service_role';
  end if;
end $$;

comment on table public.client_portal_identities is
  'Same-organization mapping from an authenticated client user to one CRM client. Immutable identity keys. Clients cannot write this table.';
comment on table public.client_portal_publications is
  'Explicit owner/admin publication of a single client record. Unpublishing or archiving removes portal access. One row per organization source.';
comment on function public.sts_list_client_portal_invoices() is
  'Allowlisted published invoice identity for the authenticated client mapping. No notes, payment instructions, emails, or operational ids.';
comment on function public.sts_list_client_portal_estimates() is
  'Allowlisted published estimate identity. Customer-facing notes and terms only. No internal notes.';
comment on function public.sts_list_client_portal_projects() is
  'Allowlisted published project identity. No budget, profit, assignment, tasks, or internal notes.';
comment on function public.sts_list_client_portal_documents() is
  'Allowlisted published document identity. No storage paths, categories, or uploader ids.';
