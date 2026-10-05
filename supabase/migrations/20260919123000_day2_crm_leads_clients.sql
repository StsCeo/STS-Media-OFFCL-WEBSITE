-- Day 2: persist Command Center CRM leads and clients.
-- Next smallest coherent in-memory group. No payments, payroll, tax filing, or integrations.
-- Additive. Organization-owned. RLS plus SECURITY DEFINER save RPCs.
-- Do not embed Auth user UUIDs or mailbox names.

create or replace function public.sts_can_manage_crm(p_org_id uuid)
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

revoke all on function public.sts_can_manage_crm(uuid) from public, anon;
grant execute on function public.sts_can_manage_crm(uuid) to authenticated;

create table if not exists public.crm_clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  industry text not null default '',
  status text not null default 'active',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_clients_business_name_check check (char_length(btrim(business_name)) between 2 and 160),
  constraint crm_clients_contact_name_check check (char_length(contact_name) <= 160),
  constraint crm_clients_email_check check (char_length(email) <= 254),
  constraint crm_clients_phone_check check (char_length(phone) <= 40),
  constraint crm_clients_industry_check check (char_length(industry) <= 80),
  constraint crm_clients_notes_check check (char_length(notes) <= 4000),
  constraint crm_clients_status_check check (status in ('active', 'paused', 'archived'))
);

create index if not exists crm_clients_org_updated_idx
  on public.crm_clients (organization_id, updated_at desc);

drop trigger if exists crm_clients_set_updated_at on public.crm_clients;
create trigger crm_clients_set_updated_at
  before update on public.crm_clients
  for each row execute function public.sts_set_updated_at();

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  business_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  source text not null default 'Manual',
  requested_service text not null default '',
  estimated_value_cents integer not null default 0,
  probability integer not null default 10,
  stage text not null default 'new_inquiry',
  last_contact date,
  next_follow_up date,
  calls_made integer not null default 0,
  emails_sent integer not null default 0,
  meetings integer not null default 0,
  notes text not null default '',
  assigned_to text not null default 'Owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_business_name_check check (char_length(btrim(business_name)) between 2 and 160),
  constraint crm_leads_contact_name_check check (char_length(contact_name) <= 160),
  constraint crm_leads_email_check check (char_length(email) <= 254),
  constraint crm_leads_phone_check check (char_length(phone) <= 40),
  constraint crm_leads_source_check check (char_length(source) between 1 and 80),
  constraint crm_leads_requested_service_check check (char_length(requested_service) <= 160),
  constraint crm_leads_notes_check check (char_length(notes) <= 4000),
  constraint crm_leads_assigned_to_check check (char_length(assigned_to) <= 80),
  constraint crm_leads_estimated_value_check check (estimated_value_cents >= 0),
  constraint crm_leads_probability_check check (probability between 0 and 100),
  constraint crm_leads_counts_check check (calls_made >= 0 and emails_sent >= 0 and meetings >= 0),
  constraint crm_leads_stage_check check (
    stage in (
      'new_inquiry',
      'contacted',
      'discovery_scheduled',
      'discovery_completed',
      'proposal_sent',
      'negotiating',
      'won',
      'lost',
      'nurture'
    )
  )
);

create index if not exists crm_leads_org_stage_idx
  on public.crm_leads (organization_id, stage, updated_at desc);

drop trigger if exists crm_leads_set_updated_at on public.crm_leads;
create trigger crm_leads_set_updated_at
  before update on public.crm_leads
  for each row execute function public.sts_set_updated_at();

alter table public.crm_clients enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_clients force row level security;
alter table public.crm_leads force row level security;

revoke all on public.crm_clients from anon, public;
revoke all on public.crm_leads from anon, public;
grant select, insert, update, delete on public.crm_clients to authenticated;
grant select, insert, update, delete on public.crm_leads to authenticated;

drop policy if exists crm_clients_select_scoped on public.crm_clients;
create policy crm_clients_select_scoped
  on public.crm_clients
  for select
  using (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_clients_write_scoped on public.crm_clients;
create policy crm_clients_write_scoped
  on public.crm_clients
  for insert
  with check (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_clients_update_scoped on public.crm_clients;
create policy crm_clients_update_scoped
  on public.crm_clients
  for update
  using (public.sts_can_manage_crm(organization_id))
  with check (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_clients_delete_privileged on public.crm_clients;
create policy crm_clients_delete_privileged
  on public.crm_clients
  for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

drop policy if exists crm_leads_select_scoped on public.crm_leads;
create policy crm_leads_select_scoped
  on public.crm_leads
  for select
  using (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_leads_write_scoped on public.crm_leads;
create policy crm_leads_write_scoped
  on public.crm_leads
  for insert
  with check (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_leads_update_scoped on public.crm_leads;
create policy crm_leads_update_scoped
  on public.crm_leads
  for update
  using (public.sts_can_manage_crm(organization_id))
  with check (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_leads_delete_privileged on public.crm_leads;
create policy crm_leads_delete_privileged
  on public.crm_leads
  for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

create or replace function public.sts_save_crm_client(
  p_organization_id uuid,
  p_id uuid,
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_industry text,
  p_status text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  audit_id uuid;
begin
  if auth.uid() is null or p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_manage_crm(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if p_business_name is null or char_length(btrim(p_business_name)) < 2 or char_length(p_business_name) > 160 then
    raise exception 'invalid client';
  end if;
  if p_status is null or p_status not in ('active', 'paused', 'archived') then
    raise exception 'invalid client';
  end if;

  if p_id is null then
    insert into public.crm_clients (
      organization_id,
      business_name,
      contact_name,
      email,
      phone,
      industry,
      status,
      notes
    )
    values (
      p_organization_id,
      btrim(p_business_name),
      coalesce(btrim(p_contact_name), ''),
      coalesce(btrim(p_email), ''),
      coalesce(btrim(p_phone), ''),
      coalesce(btrim(p_industry), ''),
      p_status,
      coalesce(p_notes, '')
    )
    returning id into record_id;
  else
    update public.crm_clients
    set
      business_name = btrim(p_business_name),
      contact_name = coalesce(btrim(p_contact_name), ''),
      email = coalesce(btrim(p_email), ''),
      phone = coalesce(btrim(p_phone), ''),
      industry = coalesce(btrim(p_industry), ''),
      status = p_status,
      notes = coalesce(p_notes, '')
    where id = p_id
      and organization_id = p_organization_id
    returning id into record_id;
    if record_id is null then
      raise exception 'not found';
    end if;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    result,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    'crm_client.saved',
    'success',
    'crm_client',
    record_id::text,
    public.sts_sanitize_audit_metadata(jsonb_build_object('result', 'success'))
  )
  returning id into audit_id;

  if audit_id is null then
    raise exception 'not authorized';
  end if;

  return record_id;
end;
$$;

create or replace function public.sts_save_crm_lead(
  p_organization_id uuid,
  p_id uuid,
  p_business_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_source text,
  p_requested_service text,
  p_estimated_value_cents integer,
  p_probability integer,
  p_stage text,
  p_last_contact date,
  p_next_follow_up date,
  p_calls_made integer,
  p_emails_sent integer,
  p_meetings integer,
  p_notes text,
  p_assigned_to text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  audit_id uuid;
begin
  if auth.uid() is null or p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_manage_crm(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if p_business_name is null or char_length(btrim(p_business_name)) < 2 or char_length(p_business_name) > 160 then
    raise exception 'invalid lead';
  end if;
  if p_stage is null or p_stage not in (
    'new_inquiry',
    'contacted',
    'discovery_scheduled',
    'discovery_completed',
    'proposal_sent',
    'negotiating',
    'won',
    'lost',
    'nurture'
  ) then
    raise exception 'invalid lead';
  end if;
  if p_estimated_value_cents is null or p_estimated_value_cents < 0 then
    raise exception 'invalid lead';
  end if;
  if p_probability is null or p_probability < 0 or p_probability > 100 then
    raise exception 'invalid lead';
  end if;

  if p_id is null then
    insert into public.crm_leads (
      organization_id,
      business_name,
      contact_name,
      email,
      phone,
      source,
      requested_service,
      estimated_value_cents,
      probability,
      stage,
      last_contact,
      next_follow_up,
      calls_made,
      emails_sent,
      meetings,
      notes,
      assigned_to
    )
    values (
      p_organization_id,
      btrim(p_business_name),
      coalesce(btrim(p_contact_name), ''),
      coalesce(btrim(p_email), ''),
      coalesce(btrim(p_phone), ''),
      coalesce(nullif(btrim(p_source), ''), 'Manual'),
      coalesce(btrim(p_requested_service), ''),
      p_estimated_value_cents,
      p_probability,
      p_stage,
      p_last_contact,
      p_next_follow_up,
      greatest(coalesce(p_calls_made, 0), 0),
      greatest(coalesce(p_emails_sent, 0), 0),
      greatest(coalesce(p_meetings, 0), 0),
      coalesce(p_notes, ''),
      coalesce(nullif(btrim(p_assigned_to), ''), 'Owner')
    )
    returning id into record_id;
  else
    update public.crm_leads
    set
      business_name = btrim(p_business_name),
      contact_name = coalesce(btrim(p_contact_name), ''),
      email = coalesce(btrim(p_email), ''),
      phone = coalesce(btrim(p_phone), ''),
      source = coalesce(nullif(btrim(p_source), ''), source),
      requested_service = coalesce(btrim(p_requested_service), ''),
      estimated_value_cents = p_estimated_value_cents,
      probability = p_probability,
      stage = p_stage,
      last_contact = p_last_contact,
      next_follow_up = p_next_follow_up,
      calls_made = greatest(coalesce(p_calls_made, 0), 0),
      emails_sent = greatest(coalesce(p_emails_sent, 0), 0),
      meetings = greatest(coalesce(p_meetings, 0), 0),
      notes = coalesce(p_notes, ''),
      assigned_to = coalesce(nullif(btrim(p_assigned_to), ''), assigned_to)
    where id = p_id
      and organization_id = p_organization_id
    returning id into record_id;
    if record_id is null then
      raise exception 'not found';
    end if;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    result,
    entity_type,
    entity_id,
    metadata
  )
  values (
    p_organization_id,
    auth.uid(),
    'crm_lead.saved',
    'success',
    'crm_lead',
    record_id::text,
    public.sts_sanitize_audit_metadata(jsonb_build_object('result', 'success'))
  )
  returning id into audit_id;

  if audit_id is null then
    raise exception 'not authorized';
  end if;

  return record_id;
end;
$$;

revoke all on function public.sts_save_crm_client(uuid, uuid, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.sts_save_crm_lead(uuid, uuid, text, text, text, text, text, text, integer, integer, text, date, date, integer, integer, integer, text, text) from public, anon;
grant execute on function public.sts_save_crm_client(uuid, uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.sts_save_crm_lead(uuid, uuid, text, text, text, text, text, text, integer, integer, text, date, date, integer, integer, integer, text, text) to authenticated;

comment on table public.crm_clients is 'Organization-owned CRM clients. No portal logins. RLS by membership role.';
comment on table public.crm_leads is 'Organization-owned CRM leads. RLS by membership role. Amounts stored as integer cents.';
