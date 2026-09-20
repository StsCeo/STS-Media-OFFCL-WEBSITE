-- Day 4 security closure: require JWT aal=aal2 for protected organization data.
-- Fail closed when the claim is missing, empty, or not exactly aal2.
-- AAL1 may still authenticate, read own membership, and complete MFA enrollment/verify.
-- service_role remains maintenance-only and is never shipped to the browser.
-- Do not embed Auth user UUIDs or mailbox names.

create or replace function public.sts_session_aal()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'aal', '');
$$;

create or replace function public.sts_session_is_aal2()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(auth.role(), '') = 'service_role'
    or coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

comment on function public.sts_session_is_aal2() is
  'True only for a trusted JWT aal=aal2 claim or service_role maintenance. Missing, empty, or non-aal2 claims fail closed.';

revoke all on function public.sts_session_aal() from public, anon;
revoke all on function public.sts_session_is_aal2() from public, anon;
grant execute on function public.sts_session_aal() to authenticated;
grant execute on function public.sts_session_is_aal2() to authenticated;

create or replace function public.sts_has_organization_role(p_org_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_session_is_aal2()
    and exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and organization_id = p_org_id
        and status = 'active'
        and role = any (p_roles)
    );
$$;

create or replace function public.is_phase1_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sts_session_is_aal2()
    and exists (
      select 1
      from public.organization_members
      where user_id = auth.uid()
        and status = 'active'
        and role in ('owner', 'administrator')
    );
$$;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  using (
    public.sts_session_is_aal2()
    and public.sts_is_organization_member(id)
  );

create or replace function public.sts_record_audit_event(
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
  if not public.sts_session_is_aal2() then
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
    entity_type,
    entity_id,
    metadata,
    result
  )
  values (
    p_organization_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    public.sts_sanitize_audit_metadata(coalesce(p_metadata, '{}'::jsonb)),
    safe_result
  )
  returning id into new_id;
  return new_id;
end;
$$;
