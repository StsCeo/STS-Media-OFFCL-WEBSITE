-- Remove the unused authenticated TRUNCATE privilege left by public-schema defaults.
-- Does not change SELECT, INSERT, UPDATE, DELETE, RLS, or service_role.

revoke truncate on table public.ws_estimates from authenticated;
revoke truncate on table public.ws_estimate_sections from authenticated;
