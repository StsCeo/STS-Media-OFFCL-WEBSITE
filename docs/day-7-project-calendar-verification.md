# Day 7 internal project and calendar automations

This report is the evidence log for Day 7 work on top of the completed isolated Day 6 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that an external calendar, email, SMS, reminder, or cron job is connected.

**Verdict: DAY 7 COMPLETE IN ISOLATED TEST ENV — unified internal schedule, idempotent generated calendar rows, and explicit owner/admin project kickoff from a converted invoice. Not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. Prior stacked PRs remain unmerged. Day 7 lives on draft PR #11 whose base branch is `cursor/sts-business-os-day6-commercial-workflow-a5ed` / PR #10.

## 1. Implementation plan

Branched from Day 6 HEAD `5fb7b42a66ea2e540841c74bc25bc96cb2da1fc2` as `cursor/sts-business-os-day7-project-calendar-automations-a5ed`. `vercel.json` was left unchanged (`main` true, `*` false).

Owner-approved scope: unified internal schedule, idempotent system-generated calendar entries, explicit owner/admin project kickoff from an invoice created from an accepted estimate, AAL2/RLS, and sanitized audits. Explicitly excluded: Google/Apple/Outlook sync, email/SMS/push/reminders, cron, public calendar links, client portal, payments/Stripe/QuickBooks/payroll/tax, production Supabase, and production deployment.

## 2. Schedule and automation functionality delivered

- Organization-scoped schedule combining project start/deadline, task due, estimate expiration, invoice due, and manual calendar events, each labeled by source type.
- Today / upcoming / overdue views on `/dashboard/calendar` via `?schedule=` so the filter is server-rendered.
- Source-row triggers plus `sts_reconcile_ws_schedule` create, update, close, or restore generated `ws_calendar_events` rows. Repeated calls do not duplicate.
- Generated rows are labeled, immutable as manual events, and restore when the source is restored or a date returns.
- Owner/administrator **Start project** on a converted invoice creates at most one project, copies operational snapshot fields only, does not issue/send/pay the invoice, and does not invent tasks (no repository task template exists).
- Kickoff and reconcile forms bind the server action directly so they submit without client-side `useActionState` hydration.

## 3. Migrations, tables, views, helpers, and RPCs

- `20260920180000_day7_schedule_automations.sql` — calendar `source_type` / `source_id` / `generated`, unique `(organization_id, source_type, source_id)` where `source_id` is set, project `source_invoice_id` / `source_estimate_id`, `sts_internal_schedule` (`security_invoker=true`), generated immutability and same-org source guards.
- `20260920181000_day7_schedule_rpcs.sql` — `sts_reconcile_ws_schedule`, `sts_start_project_from_invoice`, per-item apply/reconcile helpers, source-touch triggers. `sts.schedule_reconcile` GUC is set only around generated writes and cleared on every return/exception.

Public RPCs are granted to `authenticated` only. Internal helpers are revoked from `authenticated`.

## 4. Roles and permissions

Dashboard remains owner/administrator + AAL2.

| Role | Calendar / schedule | Reconcile | Kickoff | Notes |
| --- | --- | --- | --- | --- |
| owner / administrator | read/write manual; read generated allowed by source RLS | yes | yes | Invoice due generated rows also require invoice read |
| employee | calendar + non-invoice schedule sources | no | no | Cannot see invoice due dates through calendar |
| accountant | no calendar SELECT | no | no | Invoice due dates remain on invoices they can already read |
| contractor / client / signed-out / AAL1 / no membership | denied | denied | denied | |

## 5. Automation lifecycle and idempotency

| Check | Result |
| --- | --- |
| Generated create from dated source | PASS |
| Repeat reconcile | same row; unique index; no duplicates |
| Source title/date update | generated row updates |
| Remove source date | generated row closed |
| Invalid date `1990-01-01` | rejected by source date check (2000–2100) |
| Archive / complete / cancel source | generated row hidden or closed |
| Restore source / restore date | generated row reopened |
| Direct UPDATE of generated row | denied unless reconcile GUC |
| Organization/source reassignment | denied |
| Authenticated DELETE | denied |
| Invoice-due SELECT for employee | denied |
| Accountant calendar SELECT | denied |

## 6. Project kickoff

Schema supported the subsection. No repository-defined task template exists, so kickoff creates no tasks.

| Check | Result |
| --- | --- |
| Owner/admin AAL2, same-org, unarchived invoice from accepted estimate | PASS; one project |
| Repeat kickoff | returns existing project; unique `source_invoice_id` |
| Invoice status | remains draft; not issued, sent, or paid |
| Snapshot | name from estimate title (fallback invoice number); empty notes/description; stage discovery; start today; due invoice due date; budget invoice total cents; client_id |
| Employee / accountant / AAL1 / cross-org | denied |
| UI Start project | redirects to the project; control becomes Open linked project; second project is not created |

## 7. UI and mobile flows tested

Local demo on `http://127.0.0.1:3000` (`next dev`, in-memory, not Postgres). Production `next start` keeps `isDemoModeEnabled()` false even if the public flag is true.

| Flow | Result |
| --- | --- |
| Demo login | PASS |
| Unified schedule source labels + System badges | PASS |
| Overdue filter (`?schedule=overdue`) | PASS — project start and overdue tasks; upcoming deadline/estimate/invoice excluded |
| Upcoming filter (`?schedule=upcoming`) | PASS — project deadline, invoice due, estimate expiration |
| Today filter | PASS |
| Mobile overdue / upcoming (390×844) | PASS |
| Generated rows cannot be edited as manual events | PASS |
| Start project from converted draft invoice | PASS |
| Invoice remains draft; Open linked project; no duplicate | PASS |
| Signed-out `/dashboard/calendar`, `/invoices`, `/projects` | PASS — redirect to login |

## 8. RLS and cross-organization results

Day 7 isolation SQL and Auth/REST denied signed-out, AAL1, no-membership, unauthorized-role, and cross-organization access. Employee cannot reconcile or kickoff and cannot read invoice-due generated rows. Accountant cannot SELECT calendar. Audits store identifiers and transition metadata only (no notes, terms, descriptions, or line-item content).

## 9. Persistence

After docker restart of local db/auth/rest plus a production-mode Next.js restart, the persist Auth phase re-read the kickoff project, draft invoice, and generated calendar row. Signed-out dashboard calendar/invoice/project routes still redirected to login. Postgres remains the system of record for configured sessions.

## 10. Test / build totals

| Check | Result |
| --- | --- |
| isolated local `db reset` and full migration chain through Day 7 | PASS (`DAY7_LOCAL_SUPABASE_VERIFY_PASSED`, `DAY7_ISOLATION_RUNTIME_PASSED`) |
| Day 1–6 local SQL | PASS (re-run as part of the Day 7 chain) |
| Day 7 local SQL | PASS |
| Day 1–6 local Auth/REST | PASS (re-run) |
| Day 7 local Auth/REST | PASS (`DAY7_LOCAL_AUTH_REST_PASSED`) |
| Persistence after Supabase restart | PASS |
| Persistence after Next.js production restart | PASS |
| lint | PASS, zero warnings |
| type-check | PASS |
| automated tests | PASS, 156/156 |
| production build | PASS |
| `vercel.json` | PASS unchanged (`main` true, `*` false), sha256 `212ced7130515fb7925078dac17826205bea0e9d875ecaeacfb440237ea1e61d` |

Commands (local stack only):

```bash
DAY7_DB_RESET=1 bash scripts/verify-day7-local-supabase.sh
python3 scripts/verify-day7-local-auth.py
DAY7_AUTH_PHASE=persist python3 scripts/verify-day7-local-auth.py
npx eslint . --max-warnings 0
npx tsc --noEmit
npx vitest run
npm run build
```

## 11. Changed files and commits

Day 7 branch commits include schema/RPCs, app wiring, isolation tests, GUC/date/variable fixes, URL-driven schedule filters, progressive-enhancement kickoff/reconcile forms, demo seed for one converted invoice, and this verification log. `vercel.json` is not in the diff.

## 12. Draft PR and stacked base

Draft PR #11: https://github.com/StsCeo/STS-Media-OFFCL-WEBSITE/pull/11  
Base: `cursor/sts-business-os-day6-commercial-workflow-a5ed` / PR #10  
This agent did not merge PR #5, #6, #7, #8, #9, #10, or #11.

## 13. Vercel Preview / protection status

`vercel.json` remains `{ "main": true, "*": false }`. GitHub nevertheless recorded Preview deployment objects for Day 7 commits. An unauthenticated GET of the listed Preview URL returned **302** to `https://vercel.com/sso-api?...` (Vercel SSO / Standard Protection). No bypass link, protection exception, or production promotion was created. Owner action remains: confirm Vercel Git settings using `docs/vercel-preview-safety.md`.

## 14. Remaining gaps and production blockers

- Dashboard UI is still owner/administrator + AAL2. Employee/accountant kickoff and reconcile remain denied on purpose.
- Demo mode still uses in-memory records. Configured Supabase sessions write through Day 7 RPCs.
- Month/week/agenda calendar controls remain client-side; schedule filters are URL-driven.
- No task templates exist, so kickoff does not create tasks.
- Day 1 logout still does not invalidate an existing access token.
- These migrations have not been applied to production.
- Do not merge stacked PRs as a production cutover from this agent.

## 15. Review / merge safety

Draft PR #11 is stacked on Day 6 (`cursor/sts-business-os-day6-commercial-workflow-a5ed` / PR #10). Safe to review. Not safe to merge, promote, or deploy from this work.
