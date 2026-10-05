-- Phase 3B: structured statement-of-work sections on existing estimates.
-- Additive. Does not rewrite Day 5–6 estimate or invoice functions.
-- Sections are organization-owned narrative. They do not change integer-cent totals.
-- Forced RLS. AAL2 through sts_can_read_estimates / sts_can_write_estimates.
-- Draft, unarchived parent estimates can be edited by owner, administrator, or employee.
-- Client portal reads are a separate parameterless function. No browser organization id.

create or replace function public.sts_est_guard_section_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_id uuid;
  parent public.ws_estimates%rowtype;
begin
  parent_id := case when tg_op = 'DELETE' then old.estimate_id else new.estimate_id end;
  select * into parent from public.ws_estimates where id = parent_id;
  if parent.id is null then
    raise exception 'invalid estimate';
  end if;
  if tg_op <> 'DELETE' and parent.organization_id is distinct from new.organization_id then
    raise exception 'invalid organization';
  end if;
  if parent.archived_at is not null then
    raise exception 'archived';
  end if;
  if parent.status <> 'draft' then
    raise exception 'invalid status';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sts_est_guard_section_write() from public, anon;

create table if not exists public.ws_estimate_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  estimate_id uuid not null references public.ws_estimates (id) on delete cascade,
  position integer not null,
  heading text not null,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ws_estimate_sections_position_check check (position >= 1 and position <= 40),
  constraint ws_estimate_sections_heading_check check (char_length(btrim(heading)) between 2 and 160),
  constraint ws_estimate_sections_body_check check (char_length(body) <= 4000)
);

create unique index if not exists ws_estimate_sections_position_uidx
  on public.ws_estimate_sections (estimate_id, position);
create index if not exists ws_estimate_sections_org_idx
  on public.ws_estimate_sections (organization_id, estimate_id, position);

drop trigger if exists ws_estimate_sections_set_updated_at on public.ws_estimate_sections;
create trigger ws_estimate_sections_set_updated_at
  before update on public.ws_estimate_sections
  for each row execute function public.sts_set_updated_at();

drop trigger if exists ws_estimate_sections_freeze_organization_id on public.ws_estimate_sections;
create trigger ws_estimate_sections_freeze_organization_id
  before update on public.ws_estimate_sections
  for each row execute function public.sts_freeze_organization_id();

drop trigger if exists ws_estimate_sections_guard on public.ws_estimate_sections;
create trigger ws_estimate_sections_guard
  before insert or update or delete on public.ws_estimate_sections
  for each row execute function public.sts_est_guard_section_write();

alter table public.ws_estimate_sections enable row level security;
alter table public.ws_estimate_sections force row level security;

revoke all on public.ws_estimate_sections from anon, public;
grant select, insert, update on public.ws_estimate_sections to authenticated;
revoke delete on public.ws_estimate_sections from authenticated, anon, public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on public.ws_estimate_sections to service_role';
  end if;
end $$;

drop policy if exists ws_estimate_sections_select_scoped on public.ws_estimate_sections;
create policy ws_estimate_sections_select_scoped
  on public.ws_estimate_sections
  for select
  using (public.sts_can_read_estimates(organization_id));

drop policy if exists ws_estimate_sections_insert_scoped on public.ws_estimate_sections;
create policy ws_estimate_sections_insert_scoped
  on public.ws_estimate_sections
  for insert
  with check (public.sts_can_write_estimates(organization_id));

drop policy if exists ws_estimate_sections_update_scoped on public.ws_estimate_sections;
create policy ws_estimate_sections_update_scoped
  on public.ws_estimate_sections
  for update
  using (public.sts_can_write_estimates(organization_id))
  with check (public.sts_can_write_estimates(organization_id));

create or replace function public.sts_est_replace_sections(
  p_organization_id uuid,
  p_estimate_id uuid,
  p_sections jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  parent public.ws_estimates%rowtype;
  section jsonb;
  pos integer := 0;
  heading text;
  body text;
begin
  if auth.uid() is null or p_organization_id is null or not public.sts_can_write_estimates(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if p_sections is null or jsonb_typeof(p_sections) <> 'array' or jsonb_array_length(p_sections) > 40 then
    raise exception 'invalid sections';
  end if;

  select * into parent
  from public.ws_estimates
  where id = p_estimate_id
    and organization_id = p_organization_id
  for update;
  if parent.id is null then
    raise exception 'not found';
  end if;
  if parent.archived_at is not null then
    raise exception 'archived';
  end if;
  if parent.status <> 'draft' then
    raise exception 'invalid status';
  end if;

  delete from public.ws_estimate_sections
  where estimate_id = parent.id
    and organization_id = p_organization_id;

  for section in select value from jsonb_array_elements(p_sections)
  loop
    pos := pos + 1;
    heading := btrim(coalesce(section->>'heading', ''));
    body := coalesce(section->>'body', '');
    if char_length(heading) < 2 or char_length(heading) > 160 or char_length(body) > 4000 then
      raise exception 'invalid sections';
    end if;
    insert into public.ws_estimate_sections (
      organization_id, estimate_id, position, heading, body
    ) values (
      p_organization_id, parent.id, pos, heading, body
    );
  end loop;

  return pos;
end;
$$;

create or replace function public.sts_save_ws_estimate_with_sections(
  p_organization_id uuid,
  p_id uuid,
  p_client_id uuid,
  p_title text,
  p_description text,
  p_issue_date date,
  p_expires_on date,
  p_currency text,
  p_internal_notes text,
  p_customer_notes text,
  p_terms text,
  p_client_business_name text,
  p_client_contact_name text,
  p_client_email text,
  p_tax_cents integer,
  p_lines jsonb,
  p_sections jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
begin
  record_id := public.sts_save_ws_estimate(
    p_organization_id,
    p_id,
    p_client_id,
    p_title,
    p_description,
    p_issue_date,
    p_expires_on,
    p_currency,
    p_internal_notes,
    p_customer_notes,
    p_terms,
    p_client_business_name,
    p_client_contact_name,
    p_client_email,
    p_tax_cents,
    p_lines
  );
  perform public.sts_est_replace_sections(p_organization_id, record_id, p_sections);
  return record_id;
end;
$$;

revoke all on function public.sts_est_replace_sections(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sts_save_ws_estimate_with_sections(uuid, uuid, uuid, text, text, date, date, text, text, text, text, text, text, text, integer, jsonb, jsonb) from public, anon;
grant execute on function public.sts_save_ws_estimate_with_sections(uuid, uuid, uuid, text, text, date, date, text, text, text, text, text, text, text, integer, jsonb, jsonb) to authenticated;

create or replace function public.sts_list_client_portal_estimate_sections()
returns table (
  estimate_id uuid,
  section_position integer,
  heading text,
  body text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  org_id uuid;
  session_client_id uuid;
begin
  select s.organization_id, s.crm_client_id
    into org_id, session_client_id
  from public.sts_client_portal_session() as s;
  if org_id is null or session_client_id is null then
    raise exception 'not authorized';
  end if;
  return query
  select
    section.estimate_id,
    section.position,
    section.heading,
    section.body
  from public.ws_estimate_sections as section
  join public.ws_estimates as estimate
    on estimate.id = section.estimate_id
   and estimate.organization_id = section.organization_id
  join public.client_portal_publications as publication
    on publication.organization_id = estimate.organization_id
   and publication.source_type = 'estimate'
   and publication.source_id = estimate.id
   and publication.unpublished_at is null
   and publication.crm_client_id = session_client_id
  where section.organization_id = org_id
    and estimate.archived_at is null
    and estimate.client_id = session_client_id
  order by section.estimate_id, section.position
  limit 2000;
end;
$$;

revoke all on function public.sts_list_client_portal_estimate_sections() from public, anon;
grant execute on function public.sts_list_client_portal_estimate_sections() to authenticated;

comment on table public.ws_estimate_sections is
  'Ordered statement-of-work sections for an organization estimate. Narrative only. Integer-cent totals stay on ws_estimates.';
comment on function public.sts_est_replace_sections(uuid, uuid, jsonb) is
  'Replaces draft estimate sections in the caller organization. Internal. Rejects archived and non-draft parents.';
comment on function public.sts_save_ws_estimate_with_sections(uuid, uuid, uuid, text, text, date, date, text, text, text, text, text, text, text, integer, jsonb, jsonb) is
  'Saves an estimate draft through the existing estimate RPC, then replaces SOW sections in the same transaction. Sections do not change totals.';
comment on function public.sts_list_client_portal_estimate_sections() is
  'Allowlisted SOW sections for published estimates of the authenticated AAL2 client. Organization and client come from the portal session.';
