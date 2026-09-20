# Day 3 Finance and Operations persistence

This report is the evidence log for Day 3 work on top of the completed isolated Day 2 state. It does not claim production readiness.

**Verdict: DAY 3 CLOSURE COMPLETE IN ISOLATED TEST ENV — finance/operations persistence, authenticated hard-delete denial, archival + audit, interactive MFA UI, restart persistence, and the quality suite PASS. Not production-ready.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5 and PR #6 were not merged. Day 3 lives on a draft PR whose base branch is `cursor/sts-business-os-day2-hardening-a5ed`.

Do not paste passwords, TOTP secrets, QR contents, cookies, JWTs, API keys, connection strings, or environment-variable values into this file. Do not copy disposable local UUIDs into production migrations.

## 1. Implementation plan (from inspected Day 2 HEAD)

Inspected `70eda73` on `cursor/sts-business-os-day2-hardening-a5ed`. Day 1 MFA/settings and Day 2 membership/CRM were already passing. Day 3 branched from that HEAD as `cursor/sts-business-os-day3-finance-ops-a5ed`.

1. Add organization-owned `ops_projects`, `ops_expenses`, `ops_revenue`, and `ops_tasks` with integer cents, checks, indexes, freeze-organization triggers, archived-row protection, and forced RLS.
2. Add SECURITY DEFINER save/archive RPCs that validate same-organization client/project/member references and write sanitized audit events.
3. Wire existing Finance and Operations pages and Command Center operational estimates to those RPCs for configured Supabase sessions. Demo sessions stay in-memory.
4. Verify with local reset, Day 1/2 regression, Day 3 SQL/REST isolation, persistence across restarts, lint, type-check, tests, and production build.

## 2. Database tables and migrations

Applied on the isolated local database only.

1. `supabase/migrations/20260920120000_day3_finance_operations.sql`
   - Helpers: `sts_can_read_finance`, `sts_can_write_expenses`, `sts_can_write_revenue`, `sts_can_manage_operations`
   - Tables: `ops_projects`, `ops_expenses`, `ops_revenue`, `ops_tasks`
   - Money stored as integer cents (`*_cents`). No `float` / `double precision` currency columns.
   - Soft delete via `archived_at`. Business field updates on archived rows raise `archived`.
   - `organization_id` cannot be reassigned (`sts_freeze_organization_id`).
   - Forced RLS. `anon` has no table grants.
2. `supabase/migrations/20260920121000_day3_finance_operations_rpcs.sql`
   - `sts_save_ops_expense` / `sts_archive_ops_expense`
   - `sts_save_ops_revenue` / `sts_archive_ops_revenue`
   - `sts_save_ops_project` / `sts_archive_ops_project`
   - `sts_save_ops_task` / `sts_archive_ops_task`
   - Cross-organization client, project, and member asserts
   - Audit actions: created, updated, archived, reimbursement/payment/status changed, assigned, completed
3. `supabase/migrations/20260920130000_day3_ops_no_hard_delete.sql`
   - Drops `ops_*_delete_privileged` policies
   - Revokes `DELETE` from `authenticated`, `anon`, and `public`
   - Re-grants `SELECT`/`INSERT`/`UPDATE` to `authenticated`
   - Grants `DELETE` to `service_role` only when that role exists (maintenance; never exposed to the client)
   - No authenticated restore RPC. Archived rows stay immutable except through a future authorized restoration workflow.

## 3. Authorization matrix

Dashboard entry remains Day 2: active `owner` or `administrator` plus trusted AAL2. That is an application gate. PostgreSQL RLS is the data gate.

| Actor | Expenses | Revenue | Projects / tasks | Audit |
| --- | --- | --- | --- | --- |
| Signed out | none | none | none | none |
| Authenticated, no membership | none | none | none | none |
| Other organization member | own org only | own org only | own org only | own org only |
| Employee / member | read + create/update/archive own org | none | read + create/update/archive own org | created by their writes |
| Accountant | read | read | none | read if membership allows audit read; no ops writes |
| Administrator | read + write + archive; no hard delete | read + write + archive; no hard delete | read + write + archive; no hard delete | yes |
| Owner | same as administrator | same as administrator | same as administrator | yes |

Permanent `DELETE` is denied for owner, administrator, accountant, employee, and other authenticated application sessions. Recoverable archival (`archived_at` via `sts_archive_ops_*`) is the supported business-record removal path. Direct REST `DELETE` fails closed (HTTP 403). Ordinary server actions archive; they do not hard-delete organization ledgers. `service_role` retains maintenance `DELETE` and is not shipped to the browser. Next.js dashboard mutations still call `requireOwnerWrite()` (dashboard owner/admin + AAL2), so employees and accountants are tested through SQL and REST, not the owner dashboard UI.

## 4. Validation rules

- Amounts are integer cents, `>= 0`, and capped by the column type / check constraints.
- Expense vendor and description must be non-empty after trim.
- Expense categories include the STS Media list (Business Formation through Other) plus the existing workspace categories, including `Needs review`.
- Reimbursable expenses must be `pending` or `reimbursed`. Non-reimbursable expenses must be `n/a`.
- Revenue paid status requires a paid date and a payment method of at least two characters. This is recordkeeping only.
- Dates must fall between 2000-01-01 and 2100-01-01.
- Projects and tasks cannot reference a client, project, or member from another organization.
- Archived rows cannot be edited. Archive is idempotent on first write of `archived_at`.

## 5. Audit behavior

RPCs insert `audit_events` in the same organization with `actor_user_id = auth.uid()`, `result = success`, and sanitized metadata. No secrets, tokens, or government identifiers. Other-organization members cannot read those rows.

## 6. Dashboard calculations

Command Center and Finance use organization-scoped server queries (or demo memory when the session is demo).

| Metric | Rule |
| --- | --- |
| Total revenue | Sum of non-archived paid revenue that is not a refund |
| Total expenses | Sum of non-archived expense totals |
| Net income | Revenue minus expenses |
| Outstanding revenue | Unpaid + pending revenue |
| Unreimbursed expenses | Reimbursable expenses not marked reimbursed |
| Active projects | Projects whose stage is not `completed` |
| Open tasks | Tasks whose status is not `done` |
| Overdue tasks | Open tasks with a due date before today |

Labeled: “Operational estimate for this organization. Not a formal accounting or tax report.” Empty ledgers render zeros. Rounding uses the existing money helper.

## 7. Verification commands

```bash
bash scripts/verify-day3-local-supabase.sh
bash scripts/verify-day1-local-supabase.sh
bash scripts/verify-day2-local-supabase.sh
DAY3_DB_RESET=0 bash scripts/verify-day3-local-supabase.sh
python3 scripts/verify-day1-local-auth.py
python3 scripts/verify-day2-local-auth.py
python3 scripts/verify-day3-local-auth.py
npm run lint
npm run typecheck
npm test
npm run build
```

Persistence phase after local Supabase stop/start and Next.js restart:

```bash
DAY3_AUTH_PHASE=persist python3 scripts/verify-day3-local-auth.py
```

## 8. Persistence results

After `npx supabase stop` (backup) then `npx supabase start`, and after restarting the Next.js production server on port 3000:

- Expense, revenue, project, and task rows written through Day 3 RPCs remained (`DAY3_AUTH_PHASE=persist` → all four markers PASS).
- The archived expense row still had `archived_at` set.
- Archive audit events with `action = ops_expense.archived` remained (count > 0).
- Day 2 CRM lead persistence still PASS after the same restart.
- Operational audit events with `entity_type` in `ops_expense` / `ops_revenue` / `ops_project` / `ops_task` remained (count > 0).
- Signed-out `/dashboard` still redirected to `/login`.
- A harmless local task created through the MFA UI remained in the organization ledger after the same restart.

Page refresh and a new authenticated REST session continued to see the same organization-scoped rows. Demo in-memory ledgers are still process-local and are not this persistence path.

## 9. Realistic local request results

| Scenario | Result |
| --- | --- |
| Signed-out `/dashboard` | Redirect to login |
| Signed-out REST `ops_*` | Denied or empty |
| Valid owner REST create/update | PASS (expense, revenue, project, task; reimbursement update) |
| Valid admin REST read | PASS |
| Valid employee REST expense write | PASS |
| Valid employee REST revenue write | Fail closed |
| Valid accountant REST expense read | PASS |
| Valid accountant REST expense write | Fail closed |
| Authenticated user without membership | Zero `ops_*` rows |
| Other organization read/write | Fail closed |
| Session below AAL2 | Password REST is AAL1 (expected). Dashboard AAL2 remains the Day 1/2 application gate. |
| Negative / oversized amounts | HTTP 400 |
| Paid revenue without payment info | HTTP 400 |
| Direct REST insert into another org | HTTP 403 |
| Archived record mutation | SQL `archived` / blocked write |
| Cross-organization client/project/member refs | Fail closed |
| Owner REST hard-delete | Fail closed (HTTP 403) |
| Admin REST hard-delete | Fail closed (HTTP 403) |
| Employee REST hard-delete | Fail closed (HTTP 403) |
| Accountant REST hard-delete | Fail closed (HTTP 403) |
| Cross-organization REST hard-delete | Fail closed (HTTP 403) |
| Owner REST archive | PASS; writes `ops_expense.archived` audit |
| Audit-log isolation | Other org sees zero org A audit rows |

`scripts/verify-day3-local-supabase.sh` ended with `DAY3_LOCAL_SUPABASE_VERIFY_PASSED`.
`scripts/verify-day3-local-auth.py` ended with `DAY3_LOCAL_AUTH_REST_PASSED`.
Day 1 and Day 2 verification scripts still ended with their PASS banners.

## 9.1 Interactive MFA UI (disposable local owner)

Completed against `next start` on `http://127.0.0.1:3000` with a disposable local owner. No QR image, TOTP secret, password, cookie, JWT, or environment value was logged, screenshot, or committed. Temporary secret material used for in-memory QR decode lived in a 0600 file under `/tmp/sts-local` and was deleted with the disposable Auth user afterward.

| Step | Result |
| --- | --- |
| Signed-out `/dashboard` | Redirect to `/login` |
| Password sign-in | Directed to `/mfa/verify` (AAL1; dashboard denied) |
| `/mfa/recovery` | Fails safely; recovery codes are not issued |
| `/mfa/enroll` | Start renders a session-only QR (not captured) |
| Cancel enrollment | Unfinished factor removed; UI returns to Start |
| Finish enrollment | Auth provider challenge/verify; AAL2 Command Center |
| Tasks UI | Harmless local task created on the organization ledger |
| Refresh | Dashboard still protected |
| Sign-out | Auth cookie gone; `/dashboard`, `/mfa/enroll`, `/mfa/verify` redirect to `/login` |
| Second sign-in | MFA challenge required; AAL2 dashboard granted |

Enrollment cancel uses `listFactors().all` because the Auth client omits unverified TOTP factors from `.totp`. Confirm does not treat `describeMfaAttempt(..., verifiedByProvider: false)` as a hard failure.

## 10. Quality suite

| Check | Result |
| --- | --- |
| isolated local `db reset` | PASS (all eleven timestamped migrations applied, including Day 3 no-hard-delete) |
| Day 1 local SQL | PASS |
| Day 2 local SQL | PASS |
| Day 3 local SQL | PASS (owner/admin/employee/accountant/cross-org hard-delete denied; archive still works) |
| Day 1 local Auth/REST | PASS (pre-existing GAP: logout may not immediately revoke JWTs) |
| Day 2 local Auth/REST | PASS |
| Day 3 local Auth/REST | PASS (REST hard-delete fail closed; archive + persist markers PASS) |
| Interactive MFA browser UI | PASS (disposable local owner; QR/secret never logged, screenshot, or committed; artifacts deleted after) |
| lint | PASS (zero warnings) |
| type-check | PASS |
| all tests | PASS (136) |
| production build | PASS |
| persistence after Next.js + local Supabase restart | PASS (including archived expense + archive audit) |

## 11. Known limitations

- Dashboard UI remains owner/administrator + AAL2. Employee and accountant access is enforced and tested at RLS/REST.
- PostgreSQL `integer` cents cap amounts near $21,474,836.47. That is below the check maximum and is enough for STS Media operating records.
- Invoices, subscriptions, notes, documents, calendar, payroll, and tax filing remain outside Day 3 persistence.
- Receipt file bytes still require configured private object storage.
- No payment processing, payroll, tax filing, banking, Stripe, or QuickBooks.
- AAL2 is an application dashboard gate. REST password tokens are AAL1 by design.

## 12. Production deployment prerequisites

1. Do not merge PR #5, PR #6, or the Day 3 PR from this work.
2. Backup production before any future hosted migration.
3. Confirm an active production owner membership exists before Day 2 SQL, then apply Day 3 only after Day 2.
4. Do not copy local test UUIDs or `@day3.test` identities into production.
5. Keep public signup disabled.
6. Enroll MFA privately. Do not store TOTP secrets in git or chat.
7. Demo mode must stay off in production.

## 13. Exact remaining blockers

- Hosted/production Supabase was not migrated.
- Payments, payroll, tax, banking, and external accounting integrations are intentionally absent.
- MFA recovery codes are not issued.
- Remaining workspace tools (notes, documents, calendar, and so on) are still in-process memory for demo and not yet organization ledgers.
- An already-issued bearer JWT can remain valid until expiry after logout (unchanged Supabase behavior).
