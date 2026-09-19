-- Local-only seed. Safe to run on the disposable sts-media stack after Auth users exist.
-- Looks up identities by email. Never embeds an Auth user UUID.
-- Do not run this against production. Do not treat any local UUID as a production owner id.

do $$
declare
  owner_id uuid;
  org_id uuid;
begin
  select id into owner_id
  from auth.users
  where lower(email) = 'info@stsmedia.co'
  limit 1;

  if owner_id is null then
    raise notice 'day2 local seed: no local Auth user for the documented owner mailbox; membership not inserted';
    return;
  end if;

  select id into org_id
  from public.organizations
  where slug = 'sts-media'
  limit 1;

  if org_id is null then
    insert into public.organizations (
      legal_name,
      display_name,
      slug,
      base_currency,
      timezone,
      fiscal_year_start
    )
    values (
      'Scars to Stars Media',
      'STS Media',
      'sts-media',
      'USD',
      'America/New_York',
      1
    )
    returning id into org_id;

    insert into public.business_settings (organization_id)
    values (org_id)
    on conflict (organization_id) do nothing;
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    invited_at,
    accepted_at
  )
  values (
    org_id,
    owner_id,
    'owner',
    'active',
    now(),
    now()
  )
  on conflict (organization_id, user_id) do update
    set role = 'owner',
        status = 'active',
        accepted_at = coalesce(public.organization_members.accepted_at, now());
end;
$$;
