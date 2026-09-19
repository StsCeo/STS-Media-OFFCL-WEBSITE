-- Day 1 follow-up: audit result column, missing constraints, function search_path,
-- and membership self-elevation guards. Additive. Does not drop tables or rewrite
-- historical documents. Do not apply to production without owner approval.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- organizations: constraints that CREATE TABLE IF NOT EXISTS skipped on legacy tables
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_fiscal_year_start_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_fiscal_year_start_check
      check (fiscal_year_start between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'organizations_base_currency_check'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_base_currency_check
      check (base_currency ~ '^[A-Z]{3}$');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- business_settings: locked Day palette is the default for new organizations
-- ---------------------------------------------------------------------------
alter table public.business_settings
  alter column brand_settings set default '{"palette_id":"sts-day","accent_color":"","logo_text":"STS"}'::jsonb;

-- ---------------------------------------------------------------------------
-- audit_events.result (success | failure | denied)
-- ---------------------------------------------------------------------------
alter table public.audit_events
  add column if not exists result text not null default 'success';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'audit_events_result_check'
      and conrelid = 'public.audit_events'::regclass
  ) then
    alter table public.audit_events
      add constraint audit_events_result_check
      check (result in ('success', 'failure', 'denied'));
  end if;
end $$;

create index if not exists audit_events_org_result_idx
  on public.audit_events (organization_id, result, created_at desc);

-- ---------------------------------------------------------------------------
-- Function search_path hardening
-- ---------------------------------------------------------------------------
create or replace function public.sts_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sts_sanitize_audit_metadata(p jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
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

revoke all on function public.sts_set_updated_at() from public, anon;
revoke all on function public.sts_sanitize_audit_metadata(jsonb) from public, anon;

-- ---------------------------------------------------------------------------
-- Audit writer stamps result and still forbids secret metadata
-- ---------------------------------------------------------------------------
drop function if exists public.sts_record_audit_event(uuid, text, text, text, jsonb);

create function public.sts_record_audit_event(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb default '{}'::jsonb,
  p_result text default 'success'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  safe_result text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_is_organization_member(p_organization_id) then
    raise exception 'not authorized';
  end if;
  safe_result := case
    when p_result in ('success', 'failure', 'denied') then p_result
    else 'failure'
  end;
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
    p_action,
    safe_result,
    p_entity_type,
    p_entity_id,
    public.sts_sanitize_audit_metadata(coalesce(p_metadata, '{}'::jsonb))
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.sts_record_audit_event(uuid, text, text, text, jsonb, text) from public, anon;
grant execute on function public.sts_record_audit_event(uuid, text, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Membership writes: no self-elevation, only owners may assign owner
-- ---------------------------------------------------------------------------
create or replace function public.sts_guard_membership_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / maintenance has no JWT. First owner membership is provisioned this way.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.user_id = auth.uid() then
      raise exception 'not authorized';
    end if;
    if new.role = 'owner' and not public.sts_has_organization_role(new.organization_id, array['owner']) then
      raise exception 'not authorized';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'not authorized';
    end if;
    if new.user_id = auth.uid() and (
      new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.user_id is distinct from old.user_id
    ) then
      raise exception 'not authorized';
    end if;
    if new.role = 'owner'
      and old.role is distinct from 'owner'
      and not public.sts_has_organization_role(new.organization_id, array['owner']) then
      raise exception 'not authorized';
    end if;
    if old.role = 'owner' and old.status = 'active'
      and (new.role is distinct from 'owner' or new.status is distinct from 'active')
      and (
        select count(*) from public.organization_members
        where organization_id = old.organization_id
          and role = 'owner'
          and status = 'active'
          and id is distinct from old.id
      ) = 0 then
      raise exception 'not authorized';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.user_id = auth.uid() then
      raise exception 'not authorized';
    end if;
    if old.role = 'owner' and not public.sts_has_organization_role(old.organization_id, array['owner']) then
      raise exception 'not authorized';
    end if;
    if old.role = 'owner' and old.status = 'active'
      and (
        select count(*) from public.organization_members
        where organization_id = old.organization_id
          and role = 'owner'
          and status = 'active'
          and id is distinct from old.id
      ) = 0 then
      raise exception 'not authorized';
    end if;
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.sts_guard_membership_write() from public, anon;

drop trigger if exists organization_members_guard_write on public.organization_members;
create trigger organization_members_guard_write
  before insert or update or delete on public.organization_members
  for each row execute function public.sts_guard_membership_write();

-- Split business_settings writes so DELETE is not a member privilege.
drop policy if exists business_settings_write_owner_admin on public.business_settings;

create policy business_settings_insert_owner_admin
  on public.business_settings
  for insert
  with check (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

create policy business_settings_update_owner_admin
  on public.business_settings
  for update
  using (public.sts_has_organization_role(organization_id, array['owner', 'administrator']))
  with check (public.sts_has_organization_role(organization_id, array['owner', 'administrator']));

-- No DELETE policy on business_settings or audit_events.
-- No INSERT/UPDATE/DELETE policies on audit_events.

create or replace function public.sts_freeze_organization_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'not authorized';
  end if;
  return new;
end;
$$;

revoke all on function public.sts_freeze_organization_id() from public, anon;

drop trigger if exists business_settings_freeze_organization_id on public.business_settings;
create trigger business_settings_freeze_organization_id
  before update on public.business_settings
  for each row execute function public.sts_freeze_organization_id();

drop trigger if exists audit_events_freeze_organization_id on public.audit_events;
create trigger audit_events_freeze_organization_id
  before update on public.audit_events
  for each row execute function public.sts_freeze_organization_id();

comment on column public.audit_events.result is 'Outcome of the audited action: success, failure, or denied. Secrets never belong in metadata.';
comment on function public.sts_guard_membership_write() is 'Blocks self role/status changes, administrator assignment of owner, and removal of the final active owner.';
comment on function public.sts_freeze_organization_id() is 'Prevents moving a row to another organization_id as an isolation bypass.';

