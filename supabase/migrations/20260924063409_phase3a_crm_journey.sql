-- Phase 3A: ICP records, lead conversion fields, and convert-to-client RPC.
-- Additive. Does not rewrite crm_leads stage values or historical migrations.
-- Organization-owned. FORCE RLS. SECURITY DEFINER writes. AAL2 via sts_can_manage_crm.
-- Do not embed Auth user UUIDs or mailbox names.

create table if not exists public.crm_icps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  industry text not null default '',
  company_size text not null default '',
  market text not null default '',
  estimated_budget_min_cents integer not null default 0,
  estimated_budget_max_cents integer not null default 0,
  common_problems text not null default '',
  services_needed text not null default '',
  decision_maker text not null default '',
  acquisition_channels text not null default '',
  common_objections text not null default '',
  buying_triggers text not null default '',
  notes text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint crm_icps_name_check check (char_length(btrim(name)) between 2 and 160),
  constraint crm_icps_industry_check check (char_length(industry) <= 80),
  constraint crm_icps_company_size_check check (char_length(company_size) <= 80),
  constraint crm_icps_market_check check (char_length(market) <= 160),
  constraint crm_icps_text_check check (
    char_length(common_problems) <= 4000
    and char_length(services_needed) <= 4000
    and char_length(decision_maker) <= 160
    and char_length(acquisition_channels) <= 4000
    and char_length(common_objections) <= 4000
    and char_length(buying_triggers) <= 4000
    and char_length(notes) <= 4000
  ),
  constraint crm_icps_budget_check check (
    estimated_budget_min_cents >= 0
    and estimated_budget_max_cents >= 0
    and estimated_budget_max_cents >= estimated_budget_min_cents
  ),
  constraint crm_icps_status_check check (status in ('active', 'archived'))
);

create index if not exists crm_icps_org_status_idx
  on public.crm_icps (organization_id, status, updated_at desc);

drop trigger if exists crm_icps_set_updated_at on public.crm_icps;
create trigger crm_icps_set_updated_at
  before update on public.crm_icps
  for each row execute function public.sts_set_updated_at();

alter table public.crm_leads
  add column if not exists icp_id uuid references public.crm_icps (id) on delete set null,
  add column if not exists converted_client_id uuid references public.crm_clients (id) on delete set null,
  add column if not exists estimate_id uuid references public.ws_estimates (id) on delete set null,
  add column if not exists lost_reason text,
  add column if not exists expected_close_on date,
  add column if not exists assigned_member_id uuid references public.organization_members (id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crm_leads_lost_reason_check'
  ) then
    alter table public.crm_leads
      add constraint crm_leads_lost_reason_check
      check (lost_reason is null or char_length(lost_reason) <= 400);
  end if;
end $$;

create index if not exists crm_leads_org_assigned_idx
  on public.crm_leads (organization_id, assigned_member_id);
create index if not exists crm_leads_org_close_idx
  on public.crm_leads (organization_id, expected_close_on);
create index if not exists crm_leads_org_follow_up_idx
  on public.crm_leads (organization_id, next_follow_up);
create index if not exists crm_leads_org_created_idx
  on public.crm_leads (organization_id, created_at desc);
create index if not exists crm_leads_org_icp_idx
  on public.crm_leads (organization_id, icp_id);
create index if not exists crm_leads_converted_client_idx
  on public.crm_leads (organization_id, converted_client_id);

alter table public.crm_icps enable row level security;
alter table public.crm_icps force row level security;

revoke all on public.crm_icps from anon, public;
grant select, insert, update, delete on public.crm_icps to authenticated;

drop policy if exists crm_icps_select_scoped on public.crm_icps;
create policy crm_icps_select_scoped
  on public.crm_icps
  for select
  using (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_icps_write_scoped on public.crm_icps;
create policy crm_icps_write_scoped
  on public.crm_icps
  for insert
  with check (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_icps_update_scoped on public.crm_icps;
create policy crm_icps_update_scoped
  on public.crm_icps
  for update
  using (public.sts_can_manage_crm(organization_id))
  with check (public.sts_can_manage_crm(organization_id));

drop policy if exists crm_icps_delete_privileged on public.crm_icps;
create policy crm_icps_delete_privileged
  on public.crm_icps
  for delete
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

create or replace function public.sts_save_crm_icp(
  p_organization_id uuid,
  p_id uuid,
  p_name text,
  p_industry text,
  p_company_size text,
  p_market text,
  p_estimated_budget_min_cents integer,
  p_estimated_budget_max_cents integer,
  p_common_problems text,
  p_services_needed text,
  p_decision_maker text,
  p_acquisition_channels text,
  p_common_objections text,
  p_buying_triggers text,
  p_notes text,
  p_status text
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
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(p_name) > 160 then
    raise exception 'invalid icp';
  end if;
  if p_status is null or p_status not in ('active', 'archived') then
    raise exception 'invalid icp';
  end if;
  if p_estimated_budget_min_cents is null or p_estimated_budget_min_cents < 0 then
    raise exception 'invalid icp';
  end if;
  if p_estimated_budget_max_cents is null or p_estimated_budget_max_cents < p_estimated_budget_min_cents then
    raise exception 'invalid icp';
  end if;

  if p_id is null then
    insert into public.crm_icps (
      organization_id,
      name,
      industry,
      company_size,
      market,
      estimated_budget_min_cents,
      estimated_budget_max_cents,
      common_problems,
      services_needed,
      decision_maker,
      acquisition_channels,
      common_objections,
      buying_triggers,
      notes,
      status,
      created_by,
      updated_by
    )
    values (
      p_organization_id,
      btrim(p_name),
      coalesce(btrim(p_industry), ''),
      coalesce(btrim(p_company_size), ''),
      coalesce(btrim(p_market), ''),
      p_estimated_budget_min_cents,
      p_estimated_budget_max_cents,
      coalesce(p_common_problems, ''),
      coalesce(p_services_needed, ''),
      coalesce(btrim(p_decision_maker), ''),
      coalesce(p_acquisition_channels, ''),
      coalesce(p_common_objections, ''),
      coalesce(p_buying_triggers, ''),
      coalesce(p_notes, ''),
      p_status,
      auth.uid(),
      auth.uid()
    )
    returning id into record_id;
  else
    update public.crm_icps
    set
      name = btrim(p_name),
      industry = coalesce(btrim(p_industry), ''),
      company_size = coalesce(btrim(p_company_size), ''),
      market = coalesce(btrim(p_market), ''),
      estimated_budget_min_cents = p_estimated_budget_min_cents,
      estimated_budget_max_cents = p_estimated_budget_max_cents,
      common_problems = coalesce(p_common_problems, ''),
      services_needed = coalesce(p_services_needed, ''),
      decision_maker = coalesce(btrim(p_decision_maker), ''),
      acquisition_channels = coalesce(p_acquisition_channels, ''),
      common_objections = coalesce(p_common_objections, ''),
      buying_triggers = coalesce(p_buying_triggers, ''),
      notes = coalesce(p_notes, ''),
      status = p_status,
      updated_by = auth.uid()
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
    'crm_icp.saved',
    'success',
    'crm_icp',
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

drop function if exists public.sts_save_crm_lead(uuid, uuid, text, text, text, text, text, text, integer, integer, text, date, date, integer, integer, integer, text, text);

create function public.sts_save_crm_lead(
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
  p_assigned_to text,
  p_icp_id uuid default null,
  p_estimate_id uuid default null,
  p_lost_reason text default null,
  p_expected_close_on date default null,
  p_assigned_member_id uuid default null
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
  if p_icp_id is not null and not exists (
    select 1 from public.crm_icps
    where id = p_icp_id and organization_id = p_organization_id
  ) then
    raise exception 'invalid lead';
  end if;
  if p_estimate_id is not null and not exists (
    select 1 from public.ws_estimates
    where id = p_estimate_id and organization_id = p_organization_id
  ) then
    raise exception 'invalid lead';
  end if;
  if p_assigned_member_id is not null and not exists (
    select 1 from public.organization_members
    where id = p_assigned_member_id
      and organization_id = p_organization_id
      and status = 'active'
      and role in ('owner', 'administrator', 'employee')
  ) then
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
      assigned_to,
      icp_id,
      estimate_id,
      lost_reason,
      expected_close_on,
      assigned_member_id
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
      coalesce(nullif(btrim(p_assigned_to), ''), 'Owner'),
      p_icp_id,
      p_estimate_id,
      nullif(btrim(coalesce(p_lost_reason, '')), ''),
      p_expected_close_on,
      p_assigned_member_id
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
      assigned_to = coalesce(nullif(btrim(p_assigned_to), ''), assigned_to),
      icp_id = p_icp_id,
      estimate_id = p_estimate_id,
      lost_reason = nullif(btrim(coalesce(p_lost_reason, '')), ''),
      expected_close_on = p_expected_close_on,
      assigned_member_id = p_assigned_member_id
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

create or replace function public.sts_convert_crm_lead_to_client(
  p_organization_id uuid,
  p_lead_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row public.crm_leads%rowtype;
  client_id uuid;
  audit_id uuid;
  match_email text;
begin
  if auth.uid() is null or p_organization_id is null or p_lead_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_manage_crm(p_organization_id) then
    raise exception 'not authorized';
  end if;

  select * into lead_row
  from public.crm_leads
  where id = p_lead_id
    and organization_id = p_organization_id;

  if not found then
    raise exception 'not found';
  end if;

  if lead_row.converted_client_id is not null then
    return lead_row.converted_client_id;
  end if;

  match_email := lower(btrim(lead_row.email));

  if match_email <> '' then
    select id into client_id
    from public.crm_clients
    where organization_id = p_organization_id
      and lower(btrim(email)) = match_email
    order by updated_at desc
    limit 1;
  end if;

  if client_id is null then
    select id into client_id
    from public.crm_clients
    where organization_id = p_organization_id
      and lower(btrim(business_name)) = lower(btrim(lead_row.business_name))
    order by updated_at desc
    limit 1;
  end if;

  if client_id is null then
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
      lead_row.business_name,
      lead_row.contact_name,
      lead_row.email,
      lead_row.phone,
      '',
      'active',
      case
        when btrim(coalesce(lead_row.notes, '')) = '' then 'Converted from lead.'
        else lead_row.notes
      end
    )
    returning id into client_id;
  end if;

  update public.crm_leads
  set converted_client_id = client_id
  where id = lead_row.id
    and organization_id = p_organization_id
    and converted_client_id is null;

  select converted_client_id into client_id
  from public.crm_leads
  where id = lead_row.id
    and organization_id = p_organization_id;

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
    'crm_lead.converted',
    'success',
    'crm_lead',
    lead_row.id::text,
    public.sts_sanitize_audit_metadata(jsonb_build_object('result', 'success', 'client_id', client_id::text))
  )
  returning id into audit_id;

  if audit_id is null then
    raise exception 'not authorized';
  end if;

  return client_id;
end;
$$;

revoke all on function public.sts_save_crm_icp(uuid, uuid, text, text, text, text, integer, integer, text, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.sts_save_crm_lead(uuid, uuid, text, text, text, text, text, text, integer, integer, text, date, date, integer, integer, integer, text, text, uuid, uuid, text, date, uuid) from public, anon;
revoke all on function public.sts_convert_crm_lead_to_client(uuid, uuid) from public, anon;

grant execute on function public.sts_save_crm_icp(uuid, uuid, text, text, text, text, integer, integer, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.sts_save_crm_lead(uuid, uuid, text, text, text, text, text, text, integer, integer, text, date, date, integer, integer, integer, text, text, uuid, uuid, text, date, uuid) to authenticated;
grant execute on function public.sts_convert_crm_lead_to_client(uuid, uuid) to authenticated;

comment on table public.crm_icps is 'Organization-owned ICP definitions. RLS by CRM membership. Amounts stored as integer cents.';
comment on function public.sts_convert_crm_lead_to_client(uuid, uuid) is 'Idempotent lead-to-client conversion. Does not change lead stage. Does not create a second client on retry.';
