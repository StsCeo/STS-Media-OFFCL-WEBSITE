-- Phase 1: one public inquiry becomes one CRM lead and one follow-up task.
-- The organization is the sts-media row. Callers cannot pass an organization id.
-- Does not grant membership, portal access, payment, or signature status.
-- Does not replace sts_save_crm_lead. That RPC still requires an AAL2 organization role.
-- Rollback: drop function public.sts_capture_public_inquiry(uuid, text, text, text, text, text, text, text, text, text);
--            drop table public.agency_intake_receipts;

create table if not exists public.agency_intake_receipts (
  submission_key uuid primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  task_id uuid not null references public.ops_tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint agency_intake_receipts_lead_key unique (lead_id),
  constraint agency_intake_receipts_task_key unique (task_id)
);

alter table public.agency_intake_receipts enable row level security;
alter table public.agency_intake_receipts force row level security;

revoke all on table public.agency_intake_receipts from public, anon, authenticated;

create or replace function public.sts_capture_public_inquiry(
  p_submission_key uuid,
  p_contact_name text,
  p_business_name text,
  p_email text,
  p_phone text,
  p_service text,
  p_audience text,
  p_budget text,
  p_preferred_contact text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  org_id uuid;
  lead_id uuid;
  task_id uuid;
  contact_name text;
  business_name text;
  email text;
  phone text;
  service text;
  audience text;
  budget text;
  preferred_contact text;
  message text;
  notes text;
  follow_up date;
begin
  if p_submission_key is null then
    return jsonb_build_object('ok', false);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_key::text, 0));

  if exists (
    select 1 from public.agency_intake_receipts where submission_key = p_submission_key
  ) then
    return jsonb_build_object('ok', true);
  end if;

  select id into org_id
  from public.organizations
  where slug = 'sts-media';

  if org_id is null then
    return jsonb_build_object('ok', false);
  end if;

  contact_name := left(replace(replace(btrim(coalesce(p_contact_name, '')), '<', ''), '>', ''), 160);
  business_name := left(replace(replace(btrim(coalesce(p_business_name, '')), '<', ''), '>', ''), 160);
  if char_length(business_name) < 2 then
    business_name := contact_name;
  end if;
  email := left(btrim(coalesce(p_email, '')), 254);
  phone := left(replace(replace(btrim(coalesce(p_phone, '')), '<', ''), '>', ''), 40);
  service := left(replace(replace(btrim(coalesce(p_service, '')), '<', ''), '>', ''), 160);
  audience := lower(btrim(coalesce(p_audience, 'both')));
  budget := left(replace(replace(btrim(coalesce(p_budget, '')), '<', ''), '>', ''), 80);
  preferred_contact := lower(btrim(coalesce(p_preferred_contact, '')));
  message := replace(replace(btrim(coalesce(p_message, '')), '<', ''), '>', '');

  if char_length(contact_name) < 2
    or char_length(business_name) < 2
    or char_length(email) < 3
    or position('@' in email) < 2
    or char_length(service) < 1
    or audience not in ('owner', 'creator', 'both')
    or preferred_contact not in ('email', 'phone', 'either')
    or char_length(message) < 10
    or char_length(message) > 5000
  then
    return jsonb_build_object('ok', false);
  end if;

  follow_up := (timezone('America/New_York', now()))::date;
  notes := left(format(
    'Audience: %s. Preferred contact: %s. Budget: %s.%s%s',
    audience,
    preferred_contact,
    case when budget = '' then 'not given' else budget end,
    E'\n',
    message
  ), 4000);

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
    next_follow_up,
    calls_made,
    emails_sent,
    meetings,
    notes,
    assigned_to
  ) values (
    org_id,
    business_name,
    contact_name,
    email,
    phone,
    'Contact form',
    service,
    0,
    10,
    'new_inquiry',
    follow_up,
    0,
    0,
    0,
    notes,
    'Owner'
  )
  returning id into lead_id;

  insert into public.ops_tasks (
    organization_id,
    title,
    description,
    status,
    priority,
    due_date,
    assigned_to,
    notes,
    completed_at
  ) values (
    org_id,
    left('Follow up: ' || business_name, 160),
    'Reply to this inquiry. This is not a booking, signature, or payment.',
    'todo',
    'high',
    follow_up,
    'Owner',
    left(format('Service: %s. Audience: %s. Not booked. Not signed. Not paid.', service, audience), 4000),
    null
  )
  returning id into task_id;

  insert into public.agency_intake_receipts (
    submission_key,
    organization_id,
    lead_id,
    task_id
  ) values (
    p_submission_key,
    org_id,
    lead_id,
    task_id
  );

  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    if exists (
      select 1 from public.agency_intake_receipts where submission_key = p_submission_key
    ) then
      return jsonb_build_object('ok', true);
    end if;
    return jsonb_build_object('ok', false);
end;
$$;

revoke all on function public.sts_capture_public_inquiry(uuid, text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sts_capture_public_inquiry(uuid, text, text, text, text, text, text, text, text, text) to service_role;
