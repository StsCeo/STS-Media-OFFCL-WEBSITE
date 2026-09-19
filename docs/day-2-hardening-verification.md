# Day 2 security and persistence hardening

This report is the evidence log for Day 2 work on top of the completed isolated Day 1 state. It does not claim production readiness.

**Verdict: DAY 2 COMPLETE IN ISOLATED TEST ENV — membership authorization, private MFA enrollment path, CRM persistence, RLS/REST isolation, and restart persistence PASS. Not production-ready.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5 was not merged. Day 2 lives on PR #6.

Do not paste passwords, TOTP secrets, QR contents, cookies, JWTs, API keys, connection strings, or environment-variable values into this file.

## 1. Implementation plan (from inspected Day 1 HEAD)

Inspected `7a12ad7` on `cursor/sts-business-os-day1-foundation-a5ed`. Day 1 MFA verify, Business Settings RPC, and org RLS were already passing. Day 2 did not repeat that work except as regression.

1. Replace email `is_phase1_owner()` with active owner/administrator membership. No Auth UUIDs in production SQL. Local identities only in seed/tests.
2. Gate Supabase sessions on membership. Keep the demo allowlist.
3. Add a private MFA enroll/cancel/recovery path. Never log secrets. Keep AAL2 on `/dashboard`.
4. Persist the next in-memory Command Center group: CRM leads and clients.
5. Verify with realistic local identities, restart persistence, and the full quality suite.

## 2. Migrations added (local only)

Applied forward with `npx supabase db push --local`. Auth users were not reset.

1. `supabase/migrations/20260919120000_day2_membership_owner_gate.sql`
   - Redefines `public.is_phase1_owner()` as `auth.uid()` with an active `organization_members` row in role `owner` or `administrator`.
   - No mailbox names and no user UUIDs.
2. `supabase/migrations/20260919123000_day2_crm_leads_clients.sql`
   - `crm_clients` and `crm_leads` with organization ownership, timestamps, checks, indexes, forced RLS, and `sts_save_crm_*` SECURITY DEFINER RPCs.

Local-only seed: `supabase/seed.sql` looks up `auth.users` by email and inserts membership if that user exists. Isolation and REST tests use `@day2.test` identities only.

## 3. Authorization model

| Actor | Session | Dashboard | CRM read/write | Phase 1 `os_*` (`is_phase1_owner`) |
| --- | --- | --- | --- | --- |
| Signed out | none | denied | denied | cannot execute / denied |
| Authenticated, no membership | signed in | denied | empty / RPC denied | false |
| Organization employee | signed in; MFA required for dashboard gate | denied (not owner/admin) | allowed for their org | false |
| Organization owner | `needs_mfa` until AAL2 | allowed after AAL2 | allowed | true |
| Organization administrator | `needs_mfa` until AAL2 | allowed after AAL2 | allowed | true |
| Other organization owner | own org only | own org only | cannot read/write foreign org | true only via their membership |
| Demo owner | demo cookie | allowed when demo mode is on | in-memory | n/a |

Enforcement is RLS and SECURITY DEFINER RPCs. UI checks are not the only gate.

## 4. RLS coverage

`supabase/tests/day2_isolation_runtime.sql` ended with `DAY2_ISOLATION_RUNTIME_PASSED` (authenticated / anon impersonation, not superuser proof).

Passed: anon denied CRM and cannot execute `is_phase1_owner()`; stranger sees no CRM and cannot save; employee can save/read own-org CRM but is not privileged; owner/admin privileged without email comparison; cross-org lead/client reads and writes fail closed; malformed client write rejected.

## 5. MFA enrollment behavior

- `/mfa/enroll` requires a signed-in organization member. Signed-out visitors go to login.
- Start/confirm/cancel are server actions. Recent authentication (`last_sign_in_at` within 15 minutes) is required.
- An existing verified factor at AAL1 must be verified before another enrollment.
- Cancel unenrolls an unfinished factor only. A verified factor is not removed by cancel.
- Recovery is honest: this path does not issue recovery codes.
- `/dashboard` still requires trusted AAL2. A password session was held at `/mfa/verify` and could not open the dashboard.
- The enrollment page was opened without starting a new factor. No TOTP URI or secret appeared in HTML, logs, or this report. Do not screenshot the QR.

## 6. Persistence results

A CRM lead written through `sts_save_crm_lead` remained after restarting local Supabase (`stop` with backup, then `start`) and restarting the Next.js production server on port 3000. Marker check: `DAY2_AUTH_PHASE=persist` → `CRM lead remained after local restart`.

## 7. Realistic local request results

| Scenario | Result |
| --- | --- |
| Signed-out `/dashboard`, `/mfa/enroll`, `/mfa/verify` | Redirect to login |
| Valid organization member (employee) REST CRM write | PASS |
| Valid organization owner REST CRM write | PASS |
| Valid organization admin REST CRM read | PASS |
| User from another organization read/write | Fail closed |
| Authenticated user without membership | Zero CRM rows; RPC denied |
| Session below MFA assurance | Dashboard blocked; MFA verify shown |
| Malformed CRM write | HTTP 400 |
| Cross-organization reads and writes | Fail closed |

`scripts/verify-day2-local-auth.py` ended with `DAY2_LOCAL_AUTH_REST_PASSED`.

## 8. Quality suite

| Check | Result |
| --- | --- |
| lint | PASS (existing unused import warning in Day 1 test file only) |
| type-check | PASS |
| all tests | PASS (130) |
| production build | PASS |
| new RLS SQL tests | PASS |
| real local Auth and REST | PASS |

## 9. Remaining in-memory Command Center areas

Still `getWorkspace()` / `mutateWorkspace()` and not moved in Day 2:

- expenses, revenue, transactions, taxes
- projects, tasks, notes, documents, files
- brand, legal, portfolio, testimonials, public site content
- calendar, inbox, notifications, integrations
- demo Business Settings fallback

Public contact submissions still create in-memory leads. Payments, payroll, tax filing, and external integrations were not opened.

## 10. Remaining production blockers

- Apply Day 2 SQL only after an active production owner membership exists. Deploying the membership-gate migration first locks the owner out of Phase 1 `os_*` tables.
- Do not copy a disposable local Auth user UUID into production.
- Production must keep public signup disabled.
- Remaining ledgers are still in-process memory.
- MFA recovery codes are not issued.
- An already-issued bearer JWT can remain valid until expiry after logout (unchanged Supabase behavior).
- Hosted/production Supabase was not migrated. Do not treat this isolated pass as production readiness.

## 11. Production deployment prerequisites

1. Backup the production database.
2. Confirm the production owner Auth user UUID from the Auth dashboard. Do not invent it.
3. Insert an active `organization_members` owner row with that UUID (`supabase/manual/provision-owner-membership.sql`). Do not commit the filled-in values.
4. Confirm the owner can still open `/dashboard` on a non-production hosted project first.
5. Only then apply Day 2 migrations.
6. Set production env **names** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL` for demo docs only). Demo mode must stay off.
7. Enroll MFA privately. Do not store the TOTP secret in git or chat.

## 12. PR status

- PR #6 is the Day 2 review vehicle. Do not merge it from this work.
- PR #5 remains the Day 1 review vehicle. It is safe to **review**. It is **not** safe to merge to production from this work, and it was not merged.
