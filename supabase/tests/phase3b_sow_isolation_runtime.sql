-- Executable Phase 3B statement-of-work isolation checks for the disposable local stack.
-- Synthetic @phase3b.test users and phase3b-test-* organizations only.
-- Do not run against production or hosted Supabase.

create or replace function pg_temp.sts_p3b_seed_auth_user(p_id uuid, p_email text)
returns void
language plpgsql
as $$
begin
  if exists (select 1 from auth.users where id = p_id) then
    update auth.users
    set email = p_email,
        email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = p_id;
    return;
  end if;
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );
  begin
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), p_id, jsonb_build_object('sub', p_id::text, 'email', p_email),
      'email', p_id::text, now(), now(), now()
    );
  exception
    when unique_violation then null;
  end;
end;
$$;

create or replace function pg_temp.sts_p3b_as_postgres()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', '', true);
  perform set_config('request.jwt.claim.email', '', true);
  perform set_config('request.jwt.claims', '{}', true);
end;
$$;

create or replace function pg_temp.sts_p3b_impersonate(p_user_id uuid, p_email text, p_aal text default 'aal2')
returns void language plpgsql as $$
declare
  claims jsonb;
begin
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.email', p_email, true);
  claims := jsonb_build_object('sub', p_user_id, 'role', 'authenticated', 'email', p_email, 'aud', 'authenticated', 'aal', p_aal);
  perform set_config('request.jwt.claim.aal', p_aal, true);
  perform set_config('request.jwt.claims', claims::text, true);
end;
$$;

create or replace function pg_temp.sts_p3b_expect(p_ok boolean, p_name text)
returns void language plpgsql as $$
begin
  if not p_ok then
    raise exception 'phase3b sow isolation failed: %', p_name;
  end if;
  raise notice 'PASS %', p_name;
end;
$$;

create or replace function pg_temp.sts_p3b_expect_exception(p_sql text, p_name text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice 'PASS %', p_name;
      return;
  end;
  raise exception 'phase3b sow isolation failed: % (expected an error)', p_name;
end;
$$;

create or replace function pg_temp.sts_p3b_expect_denied_or_zero(p_sql text, p_name text)
returns void language plpgsql as $$
declare
  n integer;
begin
  begin
    execute p_sql into n;
  exception
    when insufficient_privilege then
      raise notice 'PASS % (permission denied)', p_name;
      return;
    when others then
      if sqlerrm ilike '%permission denied%' or sqlerrm ilike '%not authorized%' then
        raise notice 'PASS % (denied)', p_name;
        return;
      end if;
      raise;
  end;
  if n = 0 then
    raise notice 'PASS % (zero rows)', p_name;
    return;
  end if;
  raise exception 'phase3b sow isolation failed: % (got % rows)', p_name, n;
end;
$$;

do $$
declare
  owner_a uuid := 'c1111111-1111-4111-8111-1111111113b1';
  owner_b uuid := 'c2222222-2222-4222-8222-2222222223b2';
  employee_a uuid := 'c3333333-3333-4333-8333-3333333333b3';
  accountant_a uuid := 'c4444444-4444-4444-8444-4444444443b4';
  contractor_a uuid := 'c5555555-5555-4555-8555-5555555553b5';
  client_a uuid := 'c6666666-6666-4666-8666-6666666663b6';
  org_a uuid := 'd5d5d5d5-d5d5-45d5-8d5d-d5d5d5d5d5d5';
  org_b uuid := 'd6d6d6d6-d6d6-46d6-8d6d-d6d6d6d6d6d6';
  crm_a uuid;
  estimate_a uuid;
  invoice_a uuid;
  invoice_again uuid;
  n integer;
  total integer;
  heading text;
  lines jsonb := '[{"description":"Website quote","quantity":1,"unit_cents":10000,"discount_cents":0}]'::jsonb;
  sections jsonb := '[{"heading":"Discovery","body":"Review the current site."},{"heading":"Build","body":"Deliver the agreed pages."}]'::jsonb;
begin
  if to_regclass('public.ws_estimate_sections') is null then
    raise exception 'phase3b sow isolation aborted: ws_estimate_sections is missing';
  end if;

  perform pg_temp.sts_p3b_as_postgres();
  delete from public.ws_invoices where organization_id in (org_a, org_b);
  delete from public.client_portal_publications where organization_id in (org_a, org_b);
  delete from public.client_portal_identities where organization_id in (org_a, org_b);
  delete from public.organizations where slug like 'phase3b-test-%' or id in (org_a, org_b);

  perform pg_temp.sts_p3b_seed_auth_user(owner_a, 'owner-a@phase3b.test');
  perform pg_temp.sts_p3b_seed_auth_user(owner_b, 'owner-b@phase3b.test');
  perform pg_temp.sts_p3b_seed_auth_user(employee_a, 'employee-a@phase3b.test');
  perform pg_temp.sts_p3b_seed_auth_user(accountant_a, 'accountant-a@phase3b.test');
  perform pg_temp.sts_p3b_seed_auth_user(contractor_a, 'contractor-a@phase3b.test');
  perform pg_temp.sts_p3b_seed_auth_user(client_a, 'client-a@phase3b.test');

  insert into public.organizations (id, legal_name, display_name, slug, base_currency, timezone, fiscal_year_start)
  values
    (org_a, 'Phase3B Test Org A', 'Org A', 'phase3b-test-org-a', 'USD', 'America/New_York', 1),
    (org_b, 'Phase3B Test Org B', 'Org B', 'phase3b-test-org-b', 'USD', 'America/Chicago', 1);
  insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix)
  values (org_a, 'STS', 'EST'), (org_b, 'ORG', 'QUO')
  on conflict (organization_id) do update
    set invoice_prefix = excluded.invoice_prefix, estimate_prefix = excluded.estimate_prefix;
  insert into public.organization_members (organization_id, user_id, role, status, invited_at, accepted_at)
  values
    (org_a, owner_a, 'owner', 'active', now(), now()),
    (org_b, owner_b, 'owner', 'active', now(), now()),
    (org_a, employee_a, 'employee', 'active', now(), now()),
    (org_a, accountant_a, 'accountant', 'active', now(), now()),
    (org_a, contractor_a, 'contractor', 'active', now(), now()),
    (org_a, client_a, 'client', 'active', now(), now());

  perform pg_temp.sts_p3b_impersonate(owner_a, 'owner-a@phase3b.test', 'aal1');
  perform pg_temp.sts_p3b_expect_denied_or_zero(
    'select count(*) from public.ws_estimate_sections',
    'AAL1 cannot read estimate sections'
  );
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$select public.sts_save_ws_estimate_with_sections(%L::uuid, null, null, 'AAL1 quote', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb, %L::jsonb)$sql$, org_a, lines, sections),
    'AAL1 cannot save estimate sections'
  );

  perform pg_temp.sts_p3b_impersonate(owner_a, 'owner-a@phase3b.test');
  select public.sts_save_crm_client(org_a, null, 'Phase3B Client', 'Casey', 'casey@phase3b.test', '', 'Auto', 'active', '') into crm_a;
  select public.sts_save_ws_estimate_with_sections(
    org_a, null, crm_a, 'SOW quote', 'Overview', current_date, current_date + 10,
    'USD', 'internal', 'customer', 'Net 15', '', '', '', 0, lines, sections
  ) into estimate_a;
  select total_cents into total from public.ws_estimates where id = estimate_a;
  perform pg_temp.sts_p3b_expect(total = 10000, 'SOW sections do not change the estimate total');
  select count(*) into n from public.ws_estimate_sections where estimate_id = estimate_a;
  perform pg_temp.sts_p3b_expect(n = 2, 'owner can save ordered sections on a draft');
  select heading into heading from public.ws_estimate_sections where estimate_id = estimate_a and position = 1;
  perform pg_temp.sts_p3b_expect(heading = 'Discovery', 'sections keep the submitted order');

  perform pg_temp.sts_p3b_impersonate(owner_b, 'owner-b@phase3b.test');
  perform pg_temp.sts_p3b_expect_denied_or_zero(
    'select count(*) from public.ws_estimate_sections',
    'organization B cannot read organization A sections'
  );
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$insert into public.ws_estimate_sections (organization_id, estimate_id, position, heading, body) values (%L::uuid, %L::uuid, 1, 'Cross', 'No')$sql$, org_b, estimate_a),
    'parent estimate organization mismatch is rejected'
  );

  perform pg_temp.sts_p3b_impersonate(accountant_a, 'accountant-a@phase3b.test');
  perform pg_temp.sts_p3b_expect_denied_or_zero(
    'select count(*) from public.ws_estimate_sections',
    'accountant cannot read estimate sections'
  );
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$select public.sts_save_ws_estimate_with_sections(%L::uuid, %L::uuid, %L::uuid, 'Accountant edit', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb, %L::jsonb)$sql$, org_a, estimate_a, crm_a, lines, sections),
    'accountant cannot modify sections'
  );

  perform pg_temp.sts_p3b_impersonate(contractor_a, 'contractor-a@phase3b.test');
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$insert into public.ws_estimate_sections (organization_id, estimate_id, position, heading, body) values (%L::uuid, %L::uuid, 3, 'Contractor', 'No')$sql$, org_a, estimate_a),
    'contractor cannot modify sections'
  );

  perform pg_temp.sts_p3b_impersonate(employee_a, 'employee-a@phase3b.test');
  perform public.sts_save_ws_estimate_with_sections(
    org_a, estimate_a, crm_a, 'SOW quote', 'Overview', current_date, current_date + 10,
    'USD', 'internal', 'customer', 'Net 15', '', '', '', 0, lines,
    '[{"heading":"Discovery","body":"Review the current site."}]'::jsonb
  );
  select count(*) into n from public.ws_estimate_sections where estimate_id = estimate_a;
  perform pg_temp.sts_p3b_expect(n = 1, 'employee can replace draft sections');
  select total_cents into total from public.ws_estimates where id = estimate_a;
  perform pg_temp.sts_p3b_expect(total = 10000, 'replacing sections leaves the total unchanged');

  perform pg_temp.sts_p3b_impersonate(owner_a, 'owner-a@phase3b.test');
  perform public.sts_set_ws_estimate_status(org_a, estimate_a, 'ready');
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$select public.sts_save_ws_estimate_with_sections(%L::uuid, %L::uuid, %L::uuid, 'Ready edit', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb, %L::jsonb)$sql$, org_a, estimate_a, crm_a, lines, sections),
    'ready estimate sections cannot be modified'
  );
  perform public.sts_archive_ws_estimate(org_a, estimate_a);
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$insert into public.ws_estimate_sections (organization_id, estimate_id, position, heading, body) values (%L::uuid, %L::uuid, 2, 'Archived', 'No')$sql$, org_a, estimate_a),
    'archived estimate sections cannot be modified'
  );
  perform public.sts_restore_ws_estimate(org_a, estimate_a);
  perform public.sts_set_ws_estimate_status(org_a, estimate_a, 'accepted');
  select public.sts_convert_ws_estimate_to_invoice(org_a, estimate_a) into invoice_a;
  select public.sts_convert_ws_estimate_to_invoice(org_a, estimate_a) into invoice_again;
  perform pg_temp.sts_p3b_expect(invoice_a = invoice_again, 'estimate-to-invoice conversion stays idempotent');
  select total_cents into total from public.ws_invoices where id = invoice_a;
  perform pg_temp.sts_p3b_expect(total = 10000, 'converted invoice total ignores statement of work text');

  perform public.sts_link_client_portal_identity(client_a, crm_a);
  perform pg_temp.sts_p3b_impersonate(client_a, 'client-a@phase3b.test');
  perform pg_temp.sts_p3b_expect_denied_or_zero(
    'select count(*) from public.sts_list_client_portal_estimate_sections()',
    'portal client cannot read unpublished estimate sections'
  );
  perform pg_temp.sts_p3b_expect_exception(
    format($sql$select public.sts_save_ws_estimate_with_sections(%L::uuid, %L::uuid, %L::uuid, 'Client edit', '', current_date, null, 'USD', '', '', '', '', '', '', 0, %L::jsonb, %L::jsonb)$sql$, org_a, estimate_a, crm_a, lines, sections),
    'portal client cannot edit sections'
  );

  perform pg_temp.sts_p3b_impersonate(owner_a, 'owner-a@phase3b.test');
  perform public.sts_publish_client_portal_record('estimate', estimate_a);
  perform pg_temp.sts_p3b_impersonate(client_a, 'client-a@phase3b.test');
  select count(*) into n from public.sts_list_client_portal_estimate_sections();
  perform pg_temp.sts_p3b_expect(n = 1, 'portal client can read sections only after publication');
  select heading into heading from public.sts_list_client_portal_estimate_sections();
  perform pg_temp.sts_p3b_expect(heading = 'Discovery', 'published portal section keeps the saved heading');

  perform pg_temp.sts_p3b_as_postgres();
  delete from public.ws_invoices where organization_id in (org_a, org_b);
  delete from public.client_portal_publications where organization_id in (org_a, org_b);
  delete from public.client_portal_identities where organization_id in (org_a, org_b);
  delete from public.organizations where id in (org_a, org_b);
  raise notice 'PHASE3B_SOW_ISOLATION_RUNTIME_PASSED';
end;
$$;
