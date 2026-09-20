# Day 7 internal project and calendar automations

This report is the evidence log for Day 7 work on top of the completed isolated Day 6 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that an external calendar, email, SMS, reminder, or cron job is connected.

**Verdict: pending local verification. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project is linked, queried, reset, or migrated. Prior stacked PRs remain unmerged. Day 7 lives on draft PR stacked on Day 6 (`cursor/sts-business-os-day6-commercial-workflow-a5ed` / PR #10).

## 1. Implementation plan

Branched from Day 6 HEAD `5fb7b42a66ea2e540841c74bc25bc96cb2da1fc2` as `cursor/sts-business-os-day7-project-calendar-automations-a5ed`. `vercel.json` was left unchanged (`main` true, `*` false).

Owner-approved scope: unified internal schedule, idempotent system-generated calendar entries, explicit owner/admin project kickoff from an invoice created from an accepted estimate, AAL2/RLS, and sanitized audits. Explicitly excluded: Google/Apple/Outlook sync, email/SMS/push/reminders, cron, public calendar links, client portal, payments/Stripe/QuickBooks/payroll/tax, production Supabase, and production deployment.

## 2. Functionality delivered

- Organization-scoped schedule view combining project start/deadline, task due, estimate expiration, invoice due, and manual calendar events, each labeled by source type.
- Today / upcoming / overdue filters on `/dashboard/calendar`.
- Source-row triggers plus `sts_reconcile_ws_schedule` create or close generated `ws_calendar_events` rows. Repeated calls do not duplicate.
- Generated rows are labeled, immutable as manual events, and restore when the source is restored or a date returns.
- Owner/administrator **Start project** on a converted invoice creates at most one project, copies operational snapshot fields only, and does not issue/send/pay the invoice or invent tasks.

## 3. Migrations, tables, views, helpers, and RPCs

- `20260920180000_day7_schedule_automations.sql` — calendar `source_type` / `source_id` / `generated`, unique source index, project `source_invoice_id` / `source_estimate_id`, `sts_internal_schedule` (`security_invoker=true`), generated immutability and same-org source guards.
- `20260920181000_day7_schedule_rpcs.sql` — `sts_reconcile_ws_schedule`, `sts_start_project_from_invoice`, per-item apply/reconcile helpers, source-touch triggers.

## 4. Roles and permissions

Dashboard remains owner/administrator + AAL2.

| Role | Calendar / schedule | Reconcile | Kickoff | Notes |
| --- | --- | --- | --- | --- |
| owner / administrator | read/write manual; read generated allowed by source RLS | yes | yes | Invoice due generated rows also require invoice read |
| employee | calendar + non-invoice schedule sources | no | no | Cannot see invoice due dates through calendar |
| accountant | no calendar SELECT | no | no | Invoice due dates remain on invoices they can already read |
| contractor / client / signed-out / AAL1 / no membership | denied | denied | denied | |

## 5–15. Verification

Filled after the isolated Day 1–7 SQL/Auth/REST/UI/lint/build pass. Until then this document is not a completion claim.
