-- Optional seed for a connected Supabase project.
-- Do not run this against production until records are reviewed.
-- Amounts are drafts and must remain editable.

-- Create the owner profile after the first invited auth user exists:
-- insert into public.profiles (id, organization_id, full_name, role, mfa_required)
-- values ('AUTH_USER_UUID', 'ORG_UUID', 'Owner', 'owner', true);
