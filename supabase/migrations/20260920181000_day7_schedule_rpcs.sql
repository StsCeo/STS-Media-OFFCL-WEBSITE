-- Day 7 RPCs: reconcile generated calendar entries and start a project from a converted invoice.
-- SECURITY DEFINER with search_path = public. Internal helpers are not granted.

create or replace function public.sts_sched_write_audit(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_events (
    organization_id, actor_user_id, action, result, entity_type, entity_id, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    p_action,
    'success',
    p_entity_type,
    p_entity_id::text,
    public.sts_sanitize_audit_metadata(coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('result', 'success'))
  );
end;
$$;

create or replace function public.sts_sched_all_day_bounds(p_date date, out p_start timestamptz, out p_end timestamptz)
language plpgsql
immutable
set search_path = public
as $$
begin
  p_start := (p_date::timestamp at time zone 'UTC');
  p_end := p_start + interval '1 day' - interval '1 second';
end;
$$;

create or replace function public.sts_sched_apply_entry(
  p_organization_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_should_show boolean,
  p_title text,
  p_occurs_on date,
  p_kind text,
  p_client_id uuid,
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.ws_calendar_events%rowtype;
  bounds record;
  new_id uuid;
  action_name text;
begin
  perform set_config('sts.schedule_reconcile', '1', true);
  select * into existing
  from public.ws_calendar_events
  where organization_id = p_organization_id
    and source_type = p_source_type
    and source_id = p_source_id;

  if not p_should_show or p_occurs_on is null then
    if existing.id is not null and existing.archived_at is null then
      update public.ws_calendar_events
      set archived_at = now()
      where id = existing.id and organization_id = p_organization_id;
      perform public.sts_sched_write_audit(
        p_organization_id,
        'schedule.entry_closed',
        'ws_calendar_event',
        existing.id,
        jsonb_build_object('source_type', p_source_type, 'source_id', p_source_id)
      );
    end if;
    perform set_config('sts.schedule_reconcile', '', true);
    return;
  end if;

  select * into bounds from public.sts_sched_all_day_bounds(p_occurs_on);

  if existing.id is null then
    begin
      insert into public.ws_calendar_events (
        organization_id, title, description, start_at, end_at, all_day, timezone,
        client_id, project_id, location, kind, source_type, source_id, generated, created_by
      ) values (
        p_organization_id,
        left(btrim(p_title), 160),
        '',
        bounds.p_start,
        bounds.p_end,
        true,
        'UTC',
        p_client_id,
        p_project_id,
        '',
        p_kind,
        p_source_type,
        p_source_id,
        true,
        auth.uid()
      )
      returning id into new_id;
      perform public.sts_sched_write_audit(
        p_organization_id,
        'schedule.entry_created',
        'ws_calendar_event',
        new_id,
        jsonb_build_object('source_type', p_source_type, 'source_id', p_source_id)
      );
      perform set_config('sts.schedule_reconcile', '', true);
      return;
    exception
      when unique_violation then
        select * into existing
        from public.ws_calendar_events
        where organization_id = p_organization_id
          and source_type = p_source_type
          and source_id = p_source_id;
        if existing.id is null then
          perform set_config('sts.schedule_reconcile', '', true);
          raise;
        end if;
    end;
  end if;

  if existing.archived_at is not null then
    update public.ws_calendar_events
    set
      archived_at = null,
      title = left(btrim(p_title), 160),
      start_at = bounds.p_start,
      end_at = bounds.p_end,
      client_id = p_client_id,
      project_id = p_project_id,
      kind = p_kind
    where id = existing.id and organization_id = p_organization_id;
    perform public.sts_sched_write_audit(
      p_organization_id,
      'schedule.entry_restored',
      'ws_calendar_event',
      existing.id,
      jsonb_build_object('source_type', p_source_type, 'source_id', p_source_id)
    );
    perform set_config('sts.schedule_reconcile', '', true);
    return;
  end if;

  if existing.title is distinct from left(btrim(p_title), 160)
     or existing.start_at is distinct from bounds.p_start
     or existing.end_at is distinct from bounds.p_end
     or existing.client_id is distinct from p_client_id
     or existing.project_id is distinct from p_project_id
     or existing.kind is distinct from p_kind then
    update public.ws_calendar_events
    set
      title = left(btrim(p_title), 160),
      start_at = bounds.p_start,
      end_at = bounds.p_end,
      client_id = p_client_id,
      project_id = p_project_id,
      kind = p_kind
    where id = existing.id and organization_id = p_organization_id;
    perform public.sts_sched_write_audit(
      p_organization_id,
      'schedule.entry_updated',
      'ws_calendar_event',
      existing.id,
      jsonb_build_object('source_type', p_source_type, 'source_id', p_source_id)
    );
  end if;
  perform set_config('sts.schedule_reconcile', '', true);
exception
  when others then
    perform set_config('sts.schedule_reconcile', '', true);
    raise;
end;
$$;

create or replace function public.sts_reconcile_schedule_item(
  p_organization_id uuid,
  p_source_type text,
  p_source_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  project public.ops_projects%rowtype;
  task public.ops_tasks%rowtype;
  estimate public.ws_estimates%rowtype;
  invoice public.ws_invoices%rowtype;
  show boolean;
  occurs date;
  title text;
begin
  if p_source_type in ('project_start', 'project_deadline') then
    select * into project from public.ops_projects
    where id = p_source_id and organization_id = p_organization_id;
    occurs := case when p_source_type = 'project_start' then project.start_date else project.due_date end;
    show := project.id is not null
      and project.archived_at is null
      and project.stage <> 'completed'
      and occurs is not null
      and occurs >= date '2000-01-01'
      and occurs <= date '2100-01-01';
    title := case
      when p_source_type = 'project_start' then left('Project start: ' || coalesce(project.name, 'Project'), 160)
      else left('Project deadline: ' || coalesce(project.name, 'Project'), 160)
    end;
    perform public.sts_sched_apply_entry(
      p_organization_id, p_source_type, p_source_id, show, title, occurs, 'deadline',
      project.client_id, project.id
    );
  elsif p_source_type = 'task_due' then
    select * into task from public.ops_tasks
    where id = p_source_id and organization_id = p_organization_id;
    occurs := task.due_date;
    show := task.id is not null
      and task.archived_at is null
      and task.status <> 'done'
      and occurs is not null
      and occurs >= date '2000-01-01'
      and occurs <= date '2100-01-01';
    title := left('Task due: ' || coalesce(task.title, 'Task'), 160);
    perform public.sts_sched_apply_entry(
      p_organization_id, p_source_type, p_source_id, show, title, occurs, 'task',
      task.client_id, task.project_id
    );
  elsif p_source_type = 'estimate_expires' then
    select * into estimate from public.ws_estimates
    where id = p_source_id and organization_id = p_organization_id;
    occurs := estimate.expires_on;
    show := estimate.id is not null
      and estimate.archived_at is null
      and estimate.status not in ('declined', 'expired')
      and occurs is not null
      and occurs >= date '2000-01-01'
      and occurs <= date '2100-01-01';
    title := left('Estimate expires: ' || coalesce(estimate.estimate_number, 'Estimate'), 160);
    perform public.sts_sched_apply_entry(
      p_organization_id, p_source_type, p_source_id, show, title, occurs, 'deadline',
      estimate.client_id, null
    );
  elsif p_source_type = 'invoice_due' then
    select * into invoice from public.ws_invoices
    where id = p_source_id and organization_id = p_organization_id;
    occurs := invoice.due_date;
    show := invoice.id is not null
      and invoice.archived_at is null
      and invoice.status not in ('paid', 'void')
      and occurs is not null
      and occurs >= date '2000-01-01'
      and occurs <= date '2100-01-01';
    title := left('Invoice due: ' || coalesce(invoice.invoice_number, 'Invoice'), 160);
    perform public.sts_sched_apply_entry(
      p_organization_id, p_source_type, p_source_id, show, title, occurs, 'invoice_due',
      invoice.client_id, null
    );
  end if;
end;
$$;

create or replace function public.sts_reconcile_ws_schedule(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  rec record;
begin
  if auth.uid() is null or not public.sts_can_manage_schedule(p_organization_id) then
    raise exception 'not authorized';
  end if;
  for rec in select id from public.ops_projects where organization_id = p_organization_id
  loop
    perform public.sts_reconcile_schedule_item(p_organization_id, 'project_start', rec.id);
    perform public.sts_reconcile_schedule_item(p_organization_id, 'project_deadline', rec.id);
    n := n + 1;
  end loop;
  for rec in select id from public.ops_tasks where organization_id = p_organization_id
  loop
    perform public.sts_reconcile_schedule_item(p_organization_id, 'task_due', rec.id);
    n := n + 1;
  end loop;
  for rec in select id from public.ws_estimates where organization_id = p_organization_id
  loop
    perform public.sts_reconcile_schedule_item(p_organization_id, 'estimate_expires', rec.id);
    n := n + 1;
  end loop;
  for rec in select id from public.ws_invoices where organization_id = p_organization_id
  loop
    perform public.sts_reconcile_schedule_item(p_organization_id, 'invoice_due', rec.id);
    n := n + 1;
  end loop;
  perform public.sts_sched_write_audit(
    p_organization_id,
    'schedule.reconciled',
    'organization',
    p_organization_id,
    jsonb_build_object('source_count', n)
  );
  return n;
end;
$$;

create or replace function public.sts_start_project_from_invoice(
  p_organization_id uuid,
  p_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice public.ws_invoices%rowtype;
  estimate public.ws_estimates%rowtype;
  existing_id uuid;
  project_id uuid;
  project_name text;
begin
  if auth.uid() is null or not public.sts_can_manage_schedule(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_write_invoices(p_organization_id) then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_manage_operations(p_organization_id) then
    raise exception 'not authorized';
  end if;

  select * into invoice
  from public.ws_invoices
  where id = p_invoice_id and organization_id = p_organization_id
  for update;
  if invoice.id is null then
    raise exception 'not found';
  end if;
  if invoice.archived_at is not null then
    raise exception 'invalid status';
  end if;
  if invoice.source_estimate_id is null then
    raise exception 'invalid source';
  end if;

  select * into estimate
  from public.ws_estimates
  where id = invoice.source_estimate_id and organization_id = p_organization_id
  for update;
  if estimate.id is null or estimate.archived_at is not null or estimate.status <> 'accepted' then
    raise exception 'invalid status';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, invoice.client_id);

  select id into existing_id
  from public.ops_projects
  where organization_id = p_organization_id
    and source_invoice_id = invoice.id;
  if existing_id is not null then
    return existing_id;
  end if;

  project_name := left(btrim(coalesce(nullif(estimate.title, ''), 'Project from ' || invoice.invoice_number)), 160);
  if char_length(project_name) < 2 then
    project_name := 'Project from invoice';
  end if;

  insert into public.ops_projects (
    organization_id, client_id, name, description, stage, priority, start_date, due_date,
    budget_cents, assigned_to, notes, source_invoice_id, source_estimate_id, created_by
  ) values (
    p_organization_id,
    invoice.client_id,
    project_name,
    '',
    'discovery',
    'medium',
    current_date,
    invoice.due_date,
    invoice.total_cents,
    'Owner',
    '',
    invoice.id,
    estimate.id,
    auth.uid()
  )
  returning id into project_id;

  perform public.sts_sched_write_audit(
    p_organization_id,
    'project.started_from_invoice',
    'ops_project',
    project_id,
    jsonb_build_object('invoice_id', invoice.id, 'estimate_id', estimate.id)
  );
  perform public.sts_reconcile_schedule_item(p_organization_id, 'project_start', project_id);
  perform public.sts_reconcile_schedule_item(p_organization_id, 'project_deadline', project_id);
  return project_id;
exception
  when unique_violation then
    select id into existing_id
    from public.ops_projects
    where organization_id = p_organization_id
      and source_invoice_id = p_invoice_id;
    if existing_id is null then
      raise;
    end if;
    return existing_id;
end;
$$;

create or replace function public.sts_sched_touch_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sts_reconcile_schedule_item(new.organization_id, 'project_start', new.id);
  perform public.sts_reconcile_schedule_item(new.organization_id, 'project_deadline', new.id);
  return null;
end;
$$;

create or replace function public.sts_sched_touch_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sts_reconcile_schedule_item(new.organization_id, 'task_due', new.id);
  return null;
end;
$$;

create or replace function public.sts_sched_touch_estimate()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sts_reconcile_schedule_item(new.organization_id, 'estimate_expires', new.id);
  return null;
end;
$$;

create or replace function public.sts_sched_touch_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sts_reconcile_schedule_item(new.organization_id, 'invoice_due', new.id);
  return null;
end;
$$;

drop trigger if exists ops_projects_touch_schedule on public.ops_projects;
create trigger ops_projects_touch_schedule
  after insert or update on public.ops_projects
  for each row execute function public.sts_sched_touch_project();
drop trigger if exists ops_tasks_touch_schedule on public.ops_tasks;
create trigger ops_tasks_touch_schedule
  after insert or update on public.ops_tasks
  for each row execute function public.sts_sched_touch_task();
drop trigger if exists ws_estimates_touch_schedule on public.ws_estimates;
create trigger ws_estimates_touch_schedule
  after insert or update on public.ws_estimates
  for each row execute function public.sts_sched_touch_estimate();
drop trigger if exists ws_invoices_touch_schedule on public.ws_invoices;
create trigger ws_invoices_touch_schedule
  after insert or update on public.ws_invoices
  for each row execute function public.sts_sched_touch_invoice();

revoke all on function public.sts_sched_write_audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.sts_sched_all_day_bounds(date) from public, anon, authenticated;
revoke all on function public.sts_sched_apply_entry(uuid, text, uuid, boolean, text, date, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.sts_reconcile_schedule_item(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.sts_sched_touch_project() from public, anon, authenticated;
revoke all on function public.sts_sched_touch_task() from public, anon, authenticated;
revoke all on function public.sts_sched_touch_estimate() from public, anon, authenticated;
revoke all on function public.sts_sched_touch_invoice() from public, anon, authenticated;

revoke all on function public.sts_reconcile_ws_schedule(uuid) from public, anon;
revoke all on function public.sts_start_project_from_invoice(uuid, uuid) from public, anon;
grant execute on function public.sts_reconcile_ws_schedule(uuid) to authenticated;
grant execute on function public.sts_start_project_from_invoice(uuid, uuid) to authenticated;

comment on function public.sts_reconcile_ws_schedule(uuid) is
  'Idempotent internal schedule reconcile. Does not sync external calendars or send reminders.';
comment on function public.sts_start_project_from_invoice(uuid, uuid) is
  'Creates one project from an invoice that came from an accepted estimate. Idempotent. Does not issue, send, or collect payment.';
