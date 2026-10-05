-- Day 7: internal project/calendar automations and unified schedule.
-- Additive. Forced RLS. No authenticated hard-delete. No external calendar, email, or cron.
-- Do not embed Auth user UUIDs or mailbox names.

alter table public.ws_calendar_events
  add column if not exists source_type text not null default 'manual',
  add column if not exists source_id uuid,
  add column if not exists generated boolean not null default false;

alter table public.ws_calendar_events
  drop constraint if exists ws_calendar_source_check;
alter table public.ws_calendar_events
  add constraint ws_calendar_source_check check (
    source_type in (
      'manual',
      'project_start',
      'project_deadline',
      'task_due',
      'estimate_expires',
      'invoice_due'
    )
    and (
      (source_type = 'manual' and source_id is null and generated = false)
      or (source_type <> 'manual' and source_id is not null and generated = true)
    )
  );

create unique index if not exists ws_calendar_source_uidx
  on public.ws_calendar_events (organization_id, source_type, source_id)
  where source_id is not null;

alter table public.ops_projects
  add column if not exists source_invoice_id uuid references public.ws_invoices (id) on delete restrict,
  add column if not exists source_estimate_id uuid references public.ws_estimates (id) on delete restrict;

create unique index if not exists ops_projects_source_invoice_uidx
  on public.ops_projects (source_invoice_id)
  where source_invoice_id is not null;
create unique index if not exists ops_projects_source_estimate_uidx
  on public.ops_projects (source_estimate_id)
  where source_estimate_id is not null;

create or replace function public.sts_can_manage_schedule(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_has_organization_role(p_org_id, array['owner', 'administrator']);
$$;

revoke all on function public.sts_can_manage_schedule(uuid) from public, anon;
grant execute on function public.sts_can_manage_schedule(uuid) to authenticated;

create or replace function public.sts_sched_assert_same_org_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_type = 'manual' or new.source_id is null then
    return new;
  end if;
  if new.source_type in ('project_start', 'project_deadline') then
    if not exists (
      select 1 from public.ops_projects p
      where p.id = new.source_id and p.organization_id = new.organization_id
    ) then
      raise exception 'invalid source';
    end if;
  elsif new.source_type = 'task_due' then
    if not exists (
      select 1 from public.ops_tasks t
      where t.id = new.source_id and t.organization_id = new.organization_id
    ) then
      raise exception 'invalid source';
    end if;
  elsif new.source_type = 'estimate_expires' then
    if not exists (
      select 1 from public.ws_estimates e
      where e.id = new.source_id and e.organization_id = new.organization_id
    ) then
      raise exception 'invalid source';
    end if;
  elsif new.source_type = 'invoice_due' then
    if not exists (
      select 1 from public.ws_invoices i
      where i.id = new.source_id and i.organization_id = new.organization_id
    ) then
      raise exception 'invalid source';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if old.source_type is distinct from new.source_type
       or old.source_id is distinct from new.source_id
       or old.generated is distinct from new.generated then
      if current_setting('sts.schedule_reconcile', true) is distinct from '1' then
        raise exception 'source reference is immutable';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ws_calendar_assert_source on public.ws_calendar_events;
create trigger ws_calendar_assert_source
  before insert or update on public.ws_calendar_events
  for each row execute function public.sts_sched_assert_same_org_source();

create or replace function public.sts_sched_guard_generated_event()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('sts.schedule_reconcile', true) = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.generated then
    raise exception 'generated event is immutable';
  end if;
  if tg_op = 'UPDATE' and old.generated then
    raise exception 'generated event is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists ws_calendar_guard_generated on public.ws_calendar_events;
create trigger ws_calendar_guard_generated
  before insert or update on public.ws_calendar_events
  for each row execute function public.sts_sched_guard_generated_event();

create or replace function public.sts_sched_reject_archived_calendar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.archived_at is not null then
    if current_setting('sts.schedule_reconcile', true) = '1' then
      return new;
    end if;
    raise exception 'archived';
  end if;
  return new;
end;
$$;

drop trigger if exists ws_calendar_events_reject_archived on public.ws_calendar_events;
create trigger ws_calendar_events_reject_archived
  before update on public.ws_calendar_events
  for each row execute function public.sts_sched_reject_archived_calendar();

create or replace function public.sts_sched_assert_project_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_invoice_id is not null and not exists (
    select 1 from public.ws_invoices i
    where i.id = new.source_invoice_id and i.organization_id = new.organization_id
  ) then
    raise exception 'invalid source';
  end if;
  if new.source_estimate_id is not null and not exists (
    select 1 from public.ws_estimates e
    where e.id = new.source_estimate_id and e.organization_id = new.organization_id
  ) then
    raise exception 'invalid source';
  end if;
  if tg_op = 'UPDATE' then
    if old.source_invoice_id is not null
       and new.source_invoice_id is distinct from old.source_invoice_id then
      raise exception 'source_invoice_id is immutable';
    end if;
    if old.source_estimate_id is not null
       and new.source_estimate_id is distinct from old.source_estimate_id then
      raise exception 'source_estimate_id is immutable';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ops_projects_assert_source on public.ops_projects;
create trigger ops_projects_assert_source
  before insert or update on public.ops_projects
  for each row execute function public.sts_sched_assert_project_source();

revoke all on function public.sts_sched_assert_same_org_source() from public, anon, authenticated;
revoke all on function public.sts_sched_guard_generated_event() from public, anon, authenticated;
revoke all on function public.sts_sched_reject_archived_calendar() from public, anon, authenticated;
revoke all on function public.sts_sched_assert_project_source() from public, anon, authenticated;

drop policy if exists ws_calendar_select_scoped on public.ws_calendar_events;
create policy ws_calendar_select_scoped on public.ws_calendar_events for select
  using (
    case coalesce(source_type, 'manual')
      when 'invoice_due' then
        public.sts_can_read_calendar(organization_id) and public.sts_can_read_invoices(organization_id)
      when 'estimate_expires' then
        public.sts_can_read_calendar(organization_id) and public.sts_can_read_estimates(organization_id)
      else public.sts_can_read_calendar(organization_id)
    end
  );

create or replace view public.sts_internal_schedule
with (security_invoker = true) as
select
  ('project_start:' || p.id::text) as id,
  p.organization_id,
  'project_start'::text as source_type,
  p.id as source_id,
  left('Project start: ' || p.name, 160) as title,
  p.start_date as occurs_on,
  p.stage as source_status
from public.ops_projects p
where p.archived_at is null
  and p.start_date is not null
  and p.stage <> 'completed'
union all
select
  ('project_deadline:' || p.id::text),
  p.organization_id,
  'project_deadline',
  p.id,
  left('Project deadline: ' || p.name, 160),
  p.due_date,
  p.stage
from public.ops_projects p
where p.archived_at is null
  and p.due_date is not null
  and p.stage <> 'completed'
union all
select
  ('task_due:' || t.id::text),
  t.organization_id,
  'task_due',
  t.id,
  left('Task due: ' || t.title, 160),
  t.due_date,
  t.status
from public.ops_tasks t
where t.archived_at is null
  and t.due_date is not null
  and t.status <> 'done'
union all
select
  ('estimate_expires:' || e.id::text),
  e.organization_id,
  'estimate_expires',
  e.id,
  left('Estimate expires: ' || e.estimate_number, 160),
  e.expires_on,
  e.status
from public.ws_estimates e
where e.archived_at is null
  and e.expires_on is not null
  and e.status not in ('declined', 'expired')
union all
select
  ('invoice_due:' || i.id::text),
  i.organization_id,
  'invoice_due',
  i.id,
  left('Invoice due: ' || i.invoice_number, 160),
  i.due_date,
  i.status
from public.ws_invoices i
where i.archived_at is null
  and i.due_date is not null
  and i.status not in ('paid', 'void')
union all
select
  ('manual:' || c.id::text),
  c.organization_id,
  'manual',
  c.id,
  c.title,
  (c.start_at at time zone 'UTC')::date,
  c.kind
from public.ws_calendar_events c
where c.archived_at is null
  and c.generated = false
  and c.source_type = 'manual';

revoke all on public.sts_internal_schedule from anon, public;
grant select on public.sts_internal_schedule to authenticated;

comment on view public.sts_internal_schedule is
  'Organization-scoped internal schedule. Security invoker so source-table RLS applies. No external calendar sync.';

comment on column public.ws_calendar_events.source_type is
  'manual or generated source kind. Generated rows cannot be edited as unrelated events.';
comment on column public.ops_projects.source_invoice_id is
  'Optional same-organization invoice that started this project. Unique when set.';
