-- Day 1 follow-up: keep the normal timestamped migration sequence honest when
-- 20260911120000_init.sql created the legacy organizations.name column, and
-- tighten sts_save_business_settings argument guards.
-- Additive. Does not drop init.sql tables. Does not replace is_phase1_owner().
-- Do not apply to production without owner approval.

-- Legacy init.sql organizations.name is NOT NULL with no default. Day 1
-- provisioning sets legal_name / display_name. Without a default, a normal
-- `supabase db reset` (init first) then service-role insert fails.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organizations'
      and column_name = 'name'
  ) then
    execute $sql$
      alter table public.organizations
        alter column name set default 'Scars to Stars Media'
    $sql$;
    execute $sql$
      update public.organizations
      set name = coalesce(nullif(btrim(name), ''), display_name, legal_name, 'Scars to Stars Media')
      where name is null or btrim(name) = ''
    $sql$;
  end if;
end $$;

-- Recreate the settings RPC with a null organization-id guard. Same signature.
-- SECURITY DEFINER still bypasses RLS; auth.uid() and active owner/admin
-- membership remain the control. No caller-supplied actor or role arguments.
create or replace function public.sts_save_business_settings(
  p_organization_id uuid,
  p_legal_name text,
  p_display_name text,
  p_timezone text,
  p_base_currency text,
  p_fiscal_year_start integer,
  p_invoice_prefix text,
  p_estimate_prefix text,
  p_default_payment_terms text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_id uuid;
  audit_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if p_organization_id is null then
    raise exception 'not authorized';
  end if;
  if not public.sts_has_organization_role(p_organization_id, array['owner', 'administrator']) then
    raise exception 'not authorized';
  end if;

  if p_legal_name is null or length(btrim(p_legal_name)) < 2 or length(p_legal_name) > 160 then
    raise exception 'invalid settings';
  end if;
  if p_display_name is null or length(btrim(p_display_name)) < 2 or length(p_display_name) > 80 then
    raise exception 'invalid settings';
  end if;
  if p_timezone is null or length(p_timezone) < 3 or length(p_timezone) > 64 then
    raise exception 'invalid settings';
  end if;
  if p_base_currency is null or p_base_currency !~ '^[A-Z]{3}$' then
    raise exception 'invalid settings';
  end if;
  if p_fiscal_year_start is null or p_fiscal_year_start < 1 or p_fiscal_year_start > 12 then
    raise exception 'invalid settings';
  end if;
  if p_invoice_prefix is null or p_invoice_prefix !~ '^[A-Za-z0-9]{2,12}$' then
    raise exception 'invalid settings';
  end if;
  if p_estimate_prefix is null or p_estimate_prefix !~ '^[A-Za-z0-9]{2,12}$' then
    raise exception 'invalid settings';
  end if;
  if p_default_payment_terms is null or length(btrim(p_default_payment_terms)) < 2 or length(p_default_payment_terms) > 80 then
    raise exception 'invalid settings';
  end if;

  update public.organizations
  set
    legal_name = btrim(p_legal_name),
    display_name = btrim(p_display_name),
    timezone = p_timezone,
    base_currency = p_base_currency,
    fiscal_year_start = p_fiscal_year_start
  where id = p_organization_id;
  if not found then
    raise exception 'not found';
  end if;

  update public.business_settings
  set
    invoice_prefix = upper(p_invoice_prefix),
    estimate_prefix = upper(p_estimate_prefix),
    default_payment_terms = btrim(p_default_payment_terms)
  where organization_id = p_organization_id
  returning id into settings_id;
  if settings_id is null then
    raise exception 'not found';
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
    'business_settings.updated',
    'success',
    'business_settings',
    settings_id::text,
    public.sts_sanitize_audit_metadata(
      jsonb_build_object(
        'result', 'success',
        'note', 'Prefix and terms apply to new documents only. Historical documents are not rewritten.'
      )
    )
  )
  returning id into audit_id;

  if audit_id is null then
    raise exception 'not authorized';
  end if;

  return audit_id;
end;
$$;

revoke all on function public.sts_save_business_settings(uuid, text, text, text, text, integer, text, text, text) from public, anon;
grant execute on function public.sts_save_business_settings(uuid, text, text, text, text, integer, text, text, text) to authenticated;

comment on function public.sts_save_business_settings(uuid, text, text, text, text, integer, text, text, text)
  is 'Updates organization defaults and writes a success audit row in one transaction. Actor is auth.uid(). SECURITY DEFINER is gated by membership, not by RLS.';
