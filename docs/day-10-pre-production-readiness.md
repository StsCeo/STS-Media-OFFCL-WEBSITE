# Day 10 pre-production readiness

This document is a planning and evidence log. It does **not** authorize staging or production cutover. It does not claim automatic rollback. Local identities, UUIDs, MFA factors, test data, and secrets must never be copied to production.

**Starting baseline:** Day 9 HEAD `246a3d9` on `cursor/sts-business-os-day9-client-portal-a5ed`. Day 10 branch: `cursor/sts-business-os-day10-release-hardening-a5ed`. Isolated local stack only (`project_id = "sts-media"`).

## Stacked PR order (do not merge from this document)

1. PR #5 Day 1 foundation → `main`
2. PR #6 Day 2 → Day 1
3. PR #7 Day 3 → Day 2
4. PR #8 Day 4 → Day 3
5. PR #9 Day 5 → Day 4
6. PR #10 Day 6 → Day 5
7. PR #11 Day 7 → Day 6
8. PR #12 Day 8 → Day 7
9. PR #13 Day 9 → Day 8
10. Day 10 draft PR → Day 9 (`cursor/sts-business-os-day9-client-portal-a5ed`)

Never retarget these PRs to `main` as a group until the owner approves a controlled merge plan.

## Migration order

Apply timestamped files in `supabase/migrations/` lexicographic order. Day 10 adds `20260921120000_day10_legacy_table_lockdown.sql` after Day 9. Do not skip, reorder, or hand-edit applied migrations on a hosted project without a backup and owner approval.

## Required Vercel environment-variable names (no values)

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_ENABLE_DEMO_MODE` (must be ignored in production; keep unset or false)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never Preview-shared if Preview is not the staging project)
- `OWNER_EMAIL`
- `DEMO_SESSION_SECRET` (omit in production; demo cookies are disabled)

## Required Supabase configuration (no secrets)

- Hosted project is **not** the local `sts-media` stack
- Public signup disabled
- MFA (TOTP) enabled
- Site URL and redirect allowlist only for the intended origin (`/auth/callback`, `/reset-password`, `/login`)
- Storage bucket `org-documents` private
- Service role key never shipped to the browser

## Prerequisites that stay mandatory

- Public signup remains disabled
- Owner/admin/accountant/client access requires AAL2
- Membership is invite/owner-created; no self-serve org creation in production
- Preview Deployment Protection / Vercel Authentication stays on
- No Vercel bypass, shareable Preview exception, or protection exception

## Pre-deployment backup

1. Snapshot the hosted database using the provider’s backup/PITR, not a local dump copied from this VM.
2. Record the current production git SHA and the migration list already applied.
3. Confirm Preview SSO still redirects unauthenticated users.
4. Do not restore local `@day*.test` users or MFA factors onto the hosted project.

## Staging verification (owner-approved environment only)

This agent does not perform staging. When the owner provisions staging:

1. Apply migrations in order to an empty or snapshotted staging database.
2. Create **new** staging identities. Never copy local passwords, TOTP secrets, or UUIDs.
3. Repeat signed-out, AAL1, owner/admin/accountant/client AAL2, isolation, unpublish, and download checks.
4. Confirm demo mode is off.
5. Confirm `vercel.json` still disables non-`main` Git auto-deploy, or that staging uses an explicit owner-controlled promotion.

## Controlled production migration order

1. Owner written approval.
2. Backup / PITR window confirmed.
3. Merge stacked PRs only in Day 1→10 order, or squash-equivalent after review — this document does not merge them.
4. Apply any pending hosted migrations in timestamp order.
5. Smoke-test with a newly invited production owner at AAL2.
6. Stop if any check fails; do not continue to client invites.

## Post-deployment smoke-test checklist

- Unauthenticated `/dashboard`, `/accountant`, `/client` redirect to login
- Owner password login requires MFA
- Business settings save
- Estimate → invoice conversion remains idempotent
- Invoice kickoff does not duplicate calendar rows
- Accountant CSV headers only, no withheld columns
- Client sees only published records
- Document download is an attachment from the app origin
- Sign-out protects private routes

## Rollback decision points

- **Before migrations apply:** restore the previous application deployment. Database is unchanged.
- **After migrations apply:** application rollback does **not** undo additive SQL (tables, FORCE RLS, functions). Database rollback requires provider PITR/backup restore, which is a separate owner-approved operation and is not automatic.
- **After production data exists:** do not replay local isolation tests; do not delete organization business rows with hard DELETE.

## What application rollback can and cannot undo

| Change | App rollback | Database rollback |
| --- | --- | --- |
| Next.js UI/route code | yes | not required |
| New RPCs/tables/policies | no | only via backup/PITR |
| FORCE RLS lockdown | no | only via backup/PITR |
| Published client rows | no | restore from backup |

## Owner approval checkpoints

1. Staging environment exists and is not production Supabase.
2. Preview SSO verified without a bypass.
3. Migration backup confirmed.
4. No local test users will be copied.
5. Written approval for production merge/deploy — **not granted by this document**.

## Explicit prohibition

Do not copy local users, UUIDs, MFA factors, `@day*.test` mailboxes, local URLs, document bytes, or environment-variable values into staging or production.
