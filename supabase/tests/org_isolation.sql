-- Manual / SQL test plan for Day 1 tenant isolation
-- These statements are intended for a non-production Supabase branch or local `supabase db test`.
-- Do not run against production with live financial data.
-- Replace the UUIDs with test users created in Auth. Never paste access tokens or service-role keys here.
-- Postgres is not required in the application CI image; Vitest covers the application-layer equivalents.

-- Required scenarios (must all pass before treating Postgres as the live data plane):
-- 1. Signed-out users cannot read private records.
-- 2. Organization A members can access permitted Organization A data.
-- 3. Organization A members cannot read Organization B data.
-- 4. Organization A members cannot insert Organization B records.
-- 5. Changing a row’s organization_id cannot bypass isolation (sts_freeze_organization_id).
-- 6. Users cannot elevate their own roles; the final active owner cannot be removed.
-- 7. Inactive memberships grant no access.
-- 8. Non-owners cannot perform owner-only operations.
-- 9. Clients and contractors cannot gain broad internal access.
-- 10. Users cannot forge, update, or delete audit events.
-- 11. Settings validation rejects invalid values.
-- 12. A permitted settings save creates the correct audit event atomically (sts_save_business_settings).
-- 13. Service-role credentials never reach the browser.

-- Expected baseline
-- A. RLS is enabled and forced on organizations, organization_members, business_settings, audit_events.
-- B. No policy uses `using (true)` or grants every authenticated user every organization.
-- C. Anonymous role cannot select these tables.
-- D. Service role can insert the first organization and owner membership (RLS bypass).
-- E. A member of org A cannot select org B rows.
-- F. A client member can select only their own organization_members row.
-- G. An accountant cannot select audit_events and cannot update organizations.
-- H. A contractor cannot update business_settings.
-- I. sts_record_audit_event() stamps actor_user_id = auth.uid(), result, and strips password/token/ein keys.
-- J. Cross-organization writes fail.
-- K. An administrator cannot UPDATE their own role to owner (sts_guard_membership_write).
-- L. An administrator cannot INSERT/UPDATE another member to role owner.
-- M. Direct INSERT/UPDATE/DELETE on audit_events is denied for authenticated and anon.

-- Example assertions after seeding two orgs and two users (run as each JWT):

-- 1. Signed-out / anonymous
--   select * from public.organizations;                        -- expect permission denied or 0
--   select * from public.business_settings;                    -- expect permission denied or 0
--   select * from public.audit_events;                         -- expect permission denied or 0

-- 2. as owner of org_a (permitted org A data)
--   select count(*) from public.organizations;                 -- expect 1
--   select count(*) from public.business_settings;             -- expect 1
--   update public.organizations set display_name = 'A' where id = org_a; -- expect 1

-- 3. as member of org_b (cannot read org A)
--   select * from public.organizations where id = org_a;       -- expect 0
--   select * from public.business_settings where organization_id = org_a; -- expect 0
--   select * from public.audit_events where organization_id = org_a; -- expect 0

-- 4. as member of org_a (cannot insert org B records)
--   insert into public.business_settings (organization_id, invoice_prefix, estimate_prefix)
--     values (org_b, 'HAX', 'HAX');                            -- expect not authorized / 0 rows
--   update public.organizations set display_name = 'B' where id = org_b; -- expect 0

-- 5. as administrator of org_a (cannot elevate own role)
--   update public.organization_members set role = 'owner' where user_id = auth.uid(); -- expect not authorized
--   update public.organization_members set role = 'owner' where user_id = other_user; -- expect not authorized

-- 6. as accountant of org_a (non-owner cannot perform owner-only actions)
--   select * from public.business_settings where organization_id = org_a; -- expect 1
--   select * from public.audit_events where organization_id = org_a; -- expect 0
--   update public.organizations set legal_name = 'x' where id = org_a; -- expect 0

-- 7. Unauthorized audit mutation
--   insert into public.audit_events (organization_id, action, result, entity_type)
--     values (org_a, 'forged', 'success', 'organizations');     -- expect permission denied
--   update public.audit_events set action = 'tamper';          -- expect permission denied
--   delete from public.audit_events;                           -- expect permission denied

-- 8. Service-role credentials never reach the browser
--   grep the Next.js client bundle / src/lib/supabase/browser.ts for SUPABASE_SERVICE_ROLE_KEY
--   -- expect the browser client to use NEXT_PUBLIC_SUPABASE_ANON_KEY only

-- as client of org_a
--   select * from public.organization_members;                 -- expect only the client's row
--   select * from public.business_settings;                    -- expect 0

-- as contractor of org_a
--   update public.business_settings set invoice_prefix = 'ZZZ' where organization_id = org_a; -- expect 0

-- as owner of org_a, audit sanitizer
--   select public.sts_record_audit_event(org_a, 'test', 'business_settings', null, '{"password":"nope","ein":"12-3456789","invoicePrefix":"STS"}'::jsonb, 'success');
--   select result, metadata from public.audit_events order by created_at desc limit 1;
--   -- expect result = success, metadata to contain invoicePrefix and to omit password and ein
