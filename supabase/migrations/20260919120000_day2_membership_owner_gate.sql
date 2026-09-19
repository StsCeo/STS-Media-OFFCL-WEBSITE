-- Day 2: replace email-based is_phase1_owner() with membership + role checks.
-- Additive. Uses auth.uid() and organization_members only.
-- Do not embed Auth user identifiers or mailbox names.
-- Do not apply to production until an active owner membership already exists
-- for the real owner Auth user (see supabase/manual/provision-owner-membership.sql).
-- Local test identities belong in seed.sql or supabase/tests, never here.

create or replace function public.is_phase1_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'administrator')
  );
$$;

revoke all on function public.is_phase1_owner() from public, anon;
grant execute on function public.is_phase1_owner() to authenticated;

comment on function public.is_phase1_owner() is
  'Day 2 privileged-member check: active organization owner or administrator for auth.uid(). Not an email comparison.';

create or replace function public.sts_has_privileged_membership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_phase1_owner();
$$;

revoke all on function public.sts_has_privileged_membership() from public, anon;
grant execute on function public.sts_has_privileged_membership() to authenticated;
