-- Manual / SQL test plan for Day 1 tenant isolation
-- These statements are intended for a non-production Supabase branch or local `supabase db test`.
-- Do not run against production with live financial data.
-- Replace the UUIDs with test users created in Auth. Never paste access tokens or service-role keys here.

-- Expected baseline
-- 1. RLS is enabled and forced on organizations, organization_members, business_settings, audit_events.
-- 2. No policy uses `using (true)` or grants every authenticated user every organization.
-- 3. Anonymous role cannot select these tables.
-- 4. Service role can insert the first organization and owner membership (RLS bypass).
-- 5. A member of org A cannot select org B rows.
-- 6. A client member can select only their own organization_members row.
-- 7. An accountant cannot select audit_events and cannot update organizations.
-- 8. A contractor cannot update business_settings.
-- 9. sts_record_audit_event() stamps actor_user_id = auth.uid() and strips password/token/ein keys.
-- 10. Cross-organization writes fail.

-- Example assertions after seeding two orgs and two users (run as each JWT):

-- as owner of org_a
--   select count(*) from public.organizations;                 -- expect 1
--   select count(*) from public.business_settings;             -- expect 1
--   update public.organizations set display_name = 'A' where id = org_a; -- expect 1
--   update public.organizations set display_name = 'B' where id = org_b; -- expect 0

-- as member of org_b
--   select * from public.organizations where id = org_a;       -- expect 0
--   select * from public.business_settings where organization_id = org_a; -- expect 0
--   select * from public.audit_events where organization_id = org_a; -- expect 0

-- as accountant of org_a
--   select * from public.business_settings where organization_id = org_a; -- expect 1
--   select * from public.audit_events where organization_id = org_a; -- expect 0
--   update public.organizations set legal_name = 'x' where id = org_a; -- expect 0

-- as client of org_a
--   select * from public.organization_members;                 -- expect only the client's row
--   select * from public.business_settings;                    -- expect 0

-- as contractor of org_a
--   update public.business_settings set invoice_prefix = 'ZZZ' where organization_id = org_a; -- expect 0

-- as owner of org_a, audit sanitizer
--   select public.sts_record_audit_event(org_a, 'test', 'business_settings', null, '{"password":"nope","ein":"12-3456789","invoicePrefix":"STS"}'::jsonb);
--   select metadata from public.audit_events order by created_at desc limit 1;
--   -- expect metadata to contain invoicePrefix and to omit password and ein

-- Anonymous
--   select * from public.organizations;                        -- expect permission denied or 0
