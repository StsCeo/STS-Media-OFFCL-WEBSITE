-- Day 3 RPCs for Finance and Operations. Additive. No identity literals.

create or replace function public.sts_ops_write_audit(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid
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
    public.sts_sanitize_audit_metadata(jsonb_build_object('result', 'success'))
  );
end;
$$;

create or replace function public.sts_ops_assert_org_client(p_organization_id uuid, p_client_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_client_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.crm_clients
    where id = p_client_id and organization_id = p_organization_id
  ) then
    raise exception 'invalid client';
  end if;
end;
$$;

create or replace function public.sts_ops_assert_org_project(p_organization_id uuid, p_project_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_project_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.ops_projects
    where id = p_project_id and organization_id = p_organization_id and archived_at is null
  ) then
    raise exception 'invalid project';
  end if;
end;
$$;

create or replace function public.sts_ops_assert_org_member(p_organization_id uuid, p_member_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_member_id is null then
    return;
  end if;
  if not exists (
    select 1 from public.organization_members
    where user_id = p_member_id and organization_id = p_organization_id and status = 'active'
  ) then
    raise exception 'invalid assignee';
  end if;
end;
$$;

create or replace function public.sts_save_ops_expense(
  p_organization_id uuid,
  p_id uuid,
  p_transaction_date date,
  p_posted_date date,
  p_vendor text,
  p_description text,
  p_pretax_cents integer,
  p_tax_cents integer,
  p_currency text,
  p_category text,
  p_subcategory text,
  p_client_id uuid,
  p_project_id uuid,
  p_business_purpose text,
  p_payment_account text,
  p_payment_method text,
  p_recurring boolean,
  p_billing_frequency text,
  p_receipt_name text,
  p_receipt_status text,
  p_reimbursable boolean,
  p_reimbursement_status text,
  p_direct_project_cost boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  prior public.ops_expenses%rowtype;
  action_name text := 'ops_expense.created';
begin
  if auth.uid() is null or p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_write_expenses(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  perform public.sts_ops_assert_org_project(p_organization_id, p_project_id);

  if p_id is null then
    insert into public.ops_expenses (
      organization_id, transaction_date, posted_date, vendor, description,
      pretax_cents, tax_cents, total_cents, currency, category, subcategory,
      client_id, project_id, business_purpose, payment_account, payment_method,
      recurring, billing_frequency, receipt_name, receipt_status,
      reimbursable, reimbursement_status, direct_project_cost, notes, created_by
    ) values (
      p_organization_id, p_transaction_date, coalesce(p_posted_date, p_transaction_date),
      btrim(p_vendor), btrim(p_description),
      p_pretax_cents, p_tax_cents, p_pretax_cents + p_tax_cents,
      coalesce(p_currency, 'USD'), p_category, coalesce(p_subcategory, ''),
      p_client_id, p_project_id, coalesce(p_business_purpose, ''),
      coalesce(p_payment_account, ''), coalesce(p_payment_method, ''),
      coalesce(p_recurring, false), coalesce(p_billing_frequency, 'one_time'),
      p_receipt_name, coalesce(p_receipt_status, 'missing'),
      coalesce(p_reimbursable, false), coalesce(p_reimbursement_status, 'n/a'),
      coalesce(p_direct_project_cost, false), coalesce(p_notes, ''), auth.uid()
    ) returning id into record_id;
  else
    select * into prior from public.ops_expenses
    where id = p_id and organization_id = p_organization_id;
    if prior.id is null then
      raise exception 'not found';
    end if;
    if prior.archived_at is not null then
      raise exception 'archived';
    end if;
    action_name := 'ops_expense.updated';
    if prior.reimbursement_status is distinct from coalesce(p_reimbursement_status, prior.reimbursement_status) then
      action_name := 'ops_expense.reimbursement_changed';
    end if;
    update public.ops_expenses set
      transaction_date = p_transaction_date,
      posted_date = coalesce(p_posted_date, p_transaction_date),
      vendor = btrim(p_vendor),
      description = btrim(p_description),
      pretax_cents = p_pretax_cents,
      tax_cents = p_tax_cents,
      total_cents = p_pretax_cents + p_tax_cents,
      currency = coalesce(p_currency, 'USD'),
      category = p_category,
      subcategory = coalesce(p_subcategory, ''),
      client_id = p_client_id,
      project_id = p_project_id,
      business_purpose = coalesce(p_business_purpose, ''),
      payment_account = coalesce(p_payment_account, ''),
      payment_method = coalesce(p_payment_method, ''),
      recurring = coalesce(p_recurring, false),
      billing_frequency = coalesce(p_billing_frequency, 'one_time'),
      receipt_name = p_receipt_name,
      receipt_status = coalesce(p_receipt_status, 'missing'),
      reimbursable = coalesce(p_reimbursable, false),
      reimbursement_status = coalesce(p_reimbursement_status, 'n/a'),
      direct_project_cost = coalesce(p_direct_project_cost, false),
      notes = coalesce(p_notes, '')
    where id = p_id and organization_id = p_organization_id
    returning id into record_id;
  end if;

  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ops_expense', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ops_expense(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_expenses(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ops_expenses
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ops_expense.archived', 'ops_expense', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_save_ops_revenue(
  p_organization_id uuid,
  p_id uuid,
  p_client_id uuid,
  p_project_id uuid,
  p_source_label text,
  p_description text,
  p_amount_cents integer,
  p_currency text,
  p_invoice_number text,
  p_entry_type text,
  p_earned_date date,
  p_due_date date,
  p_paid_date date,
  p_invoice_status text,
  p_payment_status text,
  p_payment_method text,
  p_recurring boolean,
  p_recognized boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  prior public.ops_revenue%rowtype;
  action_name text := 'ops_revenue.created';
begin
  if auth.uid() is null or p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_write_revenue(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  perform public.sts_ops_assert_org_project(p_organization_id, p_project_id);

  if p_id is null then
    insert into public.ops_revenue (
      organization_id, client_id, project_id, source_label, description,
      amount_cents, currency, invoice_number, entry_type, earned_date, due_date, paid_date,
      invoice_status, payment_status, payment_method, recurring, recognized, notes, created_by
    ) values (
      p_organization_id, p_client_id, p_project_id, coalesce(p_source_label, ''), btrim(p_description),
      p_amount_cents, coalesce(p_currency, 'USD'), coalesce(p_invoice_number, ''),
      coalesce(p_entry_type, 'one_time_project'), p_earned_date, p_due_date, p_paid_date,
      coalesce(p_invoice_status, 'draft'), coalesce(p_payment_status, 'unpaid'),
      coalesce(p_payment_method, ''), coalesce(p_recurring, false), coalesce(p_recognized, false),
      coalesce(p_notes, ''), auth.uid()
    ) returning id into record_id;
  else
    select * into prior from public.ops_revenue
    where id = p_id and organization_id = p_organization_id;
    if prior.id is null then
      raise exception 'not found';
    end if;
    if prior.archived_at is not null then
      raise exception 'archived';
    end if;
    action_name := 'ops_revenue.updated';
    if prior.payment_status is distinct from coalesce(p_payment_status, prior.payment_status) then
      action_name := 'ops_revenue.payment_changed';
    end if;
    update public.ops_revenue set
      client_id = p_client_id,
      project_id = p_project_id,
      source_label = coalesce(p_source_label, ''),
      description = btrim(p_description),
      amount_cents = p_amount_cents,
      currency = coalesce(p_currency, 'USD'),
      invoice_number = coalesce(p_invoice_number, ''),
      entry_type = coalesce(p_entry_type, 'one_time_project'),
      earned_date = p_earned_date,
      due_date = p_due_date,
      paid_date = p_paid_date,
      invoice_status = coalesce(p_invoice_status, 'draft'),
      payment_status = coalesce(p_payment_status, 'unpaid'),
      payment_method = coalesce(p_payment_method, ''),
      recurring = coalesce(p_recurring, false),
      recognized = coalesce(p_recognized, false),
      notes = coalesce(p_notes, '')
    where id = p_id and organization_id = p_organization_id
    returning id into record_id;
  end if;

  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ops_revenue', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ops_revenue(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_write_revenue(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ops_revenue
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ops_revenue.archived', 'ops_revenue', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_save_ops_project(
  p_organization_id uuid,
  p_id uuid,
  p_client_id uuid,
  p_name text,
  p_description text,
  p_stage text,
  p_priority text,
  p_start_date date,
  p_due_date date,
  p_budget_cents integer,
  p_assigned_member_id uuid,
  p_assigned_to text,
  p_at_risk boolean,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  prior public.ops_projects%rowtype;
  action_name text := 'ops_project.created';
begin
  if auth.uid() is null or p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_manage_operations(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  perform public.sts_ops_assert_org_member(p_organization_id, p_assigned_member_id);

  if p_id is null then
    insert into public.ops_projects (
      organization_id, client_id, name, description, stage, priority, start_date, due_date,
      budget_cents, assigned_member_id, assigned_to, at_risk, notes, created_by
    ) values (
      p_organization_id, p_client_id, btrim(p_name), coalesce(p_description, ''),
      coalesce(p_stage, 'lead'), coalesce(p_priority, 'medium'), p_start_date, p_due_date,
      coalesce(p_budget_cents, 0), p_assigned_member_id, coalesce(nullif(btrim(p_assigned_to), ''), 'Owner'),
      coalesce(p_at_risk, false), coalesce(p_notes, ''), auth.uid()
    ) returning id into record_id;
  else
    select * into prior from public.ops_projects
    where id = p_id and organization_id = p_organization_id;
    if prior.id is null then
      raise exception 'not found';
    end if;
    if prior.archived_at is not null then
      raise exception 'archived';
    end if;
    action_name := 'ops_project.updated';
    if prior.stage is distinct from coalesce(p_stage, prior.stage) then
      action_name := 'ops_project.status_changed';
    end if;
    update public.ops_projects set
      client_id = p_client_id,
      name = btrim(p_name),
      description = coalesce(p_description, ''),
      stage = coalesce(p_stage, 'lead'),
      priority = coalesce(p_priority, 'medium'),
      start_date = p_start_date,
      due_date = p_due_date,
      budget_cents = coalesce(p_budget_cents, 0),
      assigned_member_id = p_assigned_member_id,
      assigned_to = coalesce(nullif(btrim(p_assigned_to), ''), assigned_to),
      at_risk = coalesce(p_at_risk, false),
      notes = coalesce(p_notes, '')
    where id = p_id and organization_id = p_organization_id
    returning id into record_id;
  end if;

  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ops_project', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ops_project(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_manage_operations(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ops_projects
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ops_project.archived', 'ops_project', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_save_ops_task(
  p_organization_id uuid,
  p_id uuid,
  p_project_id uuid,
  p_client_id uuid,
  p_title text,
  p_description text,
  p_status text,
  p_priority text,
  p_due_date date,
  p_assigned_member_id uuid,
  p_assigned_to text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  record_id uuid;
  prior public.ops_tasks%rowtype;
  action_name text := 'ops_task.created';
  next_status text := coalesce(p_status, 'todo');
  done_at timestamptz := null;
begin
  if auth.uid() is null or p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_can_manage_operations(p_organization_id) then
    raise exception 'not authorized';
  end if;
  perform public.sts_ops_assert_org_client(p_organization_id, p_client_id);
  perform public.sts_ops_assert_org_project(p_organization_id, p_project_id);
  perform public.sts_ops_assert_org_member(p_organization_id, p_assigned_member_id);
  if next_status = 'done' then
    done_at := now();
  end if;

  if p_id is null then
    insert into public.ops_tasks (
      organization_id, project_id, client_id, title, description, status, priority,
      due_date, assigned_member_id, assigned_to, completed_at, notes, created_by
    ) values (
      p_organization_id, p_project_id, p_client_id, btrim(p_title), coalesce(p_description, ''),
      next_status, coalesce(p_priority, 'medium'), p_due_date, p_assigned_member_id,
      coalesce(nullif(btrim(p_assigned_to), ''), 'Owner'), done_at, coalesce(p_notes, ''), auth.uid()
    ) returning id into record_id;
    if next_status = 'done' then
      action_name := 'ops_task.completed';
    end if;
  else
    select * into prior from public.ops_tasks
    where id = p_id and organization_id = p_organization_id;
    if prior.id is null then
      raise exception 'not found';
    end if;
    if prior.archived_at is not null then
      raise exception 'archived';
    end if;
    action_name := 'ops_task.updated';
    if prior.status is distinct from next_status and next_status = 'done' then
      action_name := 'ops_task.completed';
    elsif prior.assigned_to is distinct from coalesce(nullif(btrim(p_assigned_to), ''), prior.assigned_to)
       or prior.assigned_member_id is distinct from p_assigned_member_id then
      action_name := 'ops_task.assigned';
    end if;
    if next_status = 'done' then
      done_at := coalesce(prior.completed_at, now());
    end if;
    update public.ops_tasks set
      project_id = p_project_id,
      client_id = p_client_id,
      title = btrim(p_title),
      description = coalesce(p_description, ''),
      status = next_status,
      priority = coalesce(p_priority, 'medium'),
      due_date = p_due_date,
      assigned_member_id = p_assigned_member_id,
      assigned_to = coalesce(nullif(btrim(p_assigned_to), ''), assigned_to),
      completed_at = done_at,
      notes = coalesce(p_notes, '')
    where id = p_id and organization_id = p_organization_id
    returning id into record_id;
  end if;

  perform public.sts_ops_write_audit(p_organization_id, action_name, 'ops_task', record_id);
  return record_id;
end;
$$;

create or replace function public.sts_archive_ops_task(p_organization_id uuid, p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare record_id uuid;
begin
  if auth.uid() is null or not public.sts_can_manage_operations(p_organization_id) then
    raise exception 'not authorized';
  end if;
  update public.ops_tasks
  set archived_at = coalesce(archived_at, now())
  where id = p_id and organization_id = p_organization_id
  returning id into record_id;
  if record_id is null then
    raise exception 'not found';
  end if;
  perform public.sts_ops_write_audit(p_organization_id, 'ops_task.archived', 'ops_task', record_id);
  return record_id;
end;
$$;

revoke all on function public.sts_ops_write_audit(uuid, text, text, uuid) from public, anon;
revoke all on function public.sts_ops_assert_org_client(uuid, uuid) from public, anon;
revoke all on function public.sts_ops_assert_org_project(uuid, uuid) from public, anon;
revoke all on function public.sts_ops_assert_org_member(uuid, uuid) from public, anon;
revoke all on function public.sts_save_ops_expense(uuid, uuid, date, date, text, text, integer, integer, text, text, text, uuid, uuid, text, text, text, boolean, text, text, text, boolean, text, boolean, text) from public, anon;
revoke all on function public.sts_archive_ops_expense(uuid, uuid) from public, anon;
revoke all on function public.sts_save_ops_revenue(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, date, date, date, text, text, text, boolean, boolean, text) from public, anon;
revoke all on function public.sts_archive_ops_revenue(uuid, uuid) from public, anon;
revoke all on function public.sts_save_ops_project(uuid, uuid, uuid, text, text, text, text, date, date, integer, uuid, text, boolean, text) from public, anon;
revoke all on function public.sts_archive_ops_project(uuid, uuid) from public, anon;
revoke all on function public.sts_save_ops_task(uuid, uuid, uuid, uuid, text, text, text, text, date, uuid, text, text) from public, anon;
revoke all on function public.sts_archive_ops_task(uuid, uuid) from public, anon;

grant execute on function public.sts_save_ops_expense(uuid, uuid, date, date, text, text, integer, integer, text, text, text, uuid, uuid, text, text, text, boolean, text, text, text, boolean, text, boolean, text) to authenticated;
grant execute on function public.sts_archive_ops_expense(uuid, uuid) to authenticated;
grant execute on function public.sts_save_ops_revenue(uuid, uuid, uuid, uuid, text, text, integer, text, text, text, date, date, date, text, text, text, boolean, boolean, text) to authenticated;
grant execute on function public.sts_archive_ops_revenue(uuid, uuid) to authenticated;
grant execute on function public.sts_save_ops_project(uuid, uuid, uuid, text, text, text, text, date, date, integer, uuid, text, boolean, text) to authenticated;
grant execute on function public.sts_archive_ops_project(uuid, uuid) to authenticated;
grant execute on function public.sts_save_ops_task(uuid, uuid, uuid, uuid, text, text, text, text, date, uuid, text, text) to authenticated;
grant execute on function public.sts_archive_ops_task(uuid, uuid) to authenticated;

comment on table public.ops_expenses is 'Organization-owned expense ledger. Integer cents. Soft-archived. Not a tax return.';
comment on table public.ops_revenue is 'Organization-owned revenue ledger. Recordkeeping only. No payment processing.';
comment on table public.ops_projects is 'Organization-owned projects. Client references must belong to the same organization.';
comment on table public.ops_tasks is 'Organization-owned tasks. Project and member references must belong to the same organization.';
