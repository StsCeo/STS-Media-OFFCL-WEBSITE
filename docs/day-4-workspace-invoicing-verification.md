# Day 4 workspace tools and invoicing

This report is the evidence log for Day 4 work on top of the completed isolated Day 3 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, malware-scanning coverage, or electronic-signature validity.

**Verdict: DAY 4 COMPLETE IN ISOLATED TEST ENV — notes, private documents, internal calendar, and invoices persist with fail-closed RLS/Storage; lint, tests, and production build PASS. Not production-ready.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5, PR #6, and PR #7 were not merged. Day 4 lives on draft PR #8 whose base branch is `cursor/sts-business-os-day3-finance-ops-a5ed`.

Do not paste passwords, TOTP secrets, QR contents, cookies, JWTs, API keys, connection strings, signed URLs, disposable UUIDs, or environment-variable values into this file. Do not copy disposable local users or `@day*.test` identities into production SQL.

## 1. Implementation plan (from inspected Day 3 HEAD)

Inspected `581b81f` on `cursor/sts-business-os-day3-finance-ops-a5ed`. The working tree was clean. Day 4 branched as `cursor/sts-business-os-day4-workspace-invoicing-a5ed`.

1. Add organization-owned notes, document metadata, calendar events, invoices, line items, and invoice counters with integer cents, forced RLS, freeze-organization triggers, archived-row protection, and no authenticated DELETE.
2. Add a private `org-documents` bucket with organization-scoped Storage RLS, server-generated paths, and a conservative file allow-list.
3. Add SECURITY DEFINER save/archive/issue/pay/void RPCs that validate same-organization relationships and write sanitized audit events.
4. Wire Notes, Documents, Calendar, Invoices, and Command Center summaries to those RPCs for configured Supabase sessions. Demo sessions stay in-memory.
5. Verify with local reset, Day 1–3 regression, Day 4 SQL/REST/Storage isolation, persistence across restarts, lint, type-check, tests, and production build.

## 2. Database tables, RPCs, policies, indexes, and Storage

Applied on the isolated local database only.

1. `supabase/migrations/20260920140000_day4_workspace_tools.sql`
   - Helpers: `sts_can_read/write_notes`, `sts_can_read/write_calendar`, `sts_can_read/write_documents`, `sts_can_read/write_invoices`
   - Tables: `ws_notes`, `ws_documents`, `ws_calendar_events`, `ws_invoice_counters`, `ws_invoices`, `ws_invoice_lines`
   - Money stored as integer cents. Totals constrained to `subtotal - discount + tax`.
   - Soft delete via `archived_at`. Business field updates on archived rows raise `archived`.
   - Forced RLS. `anon` has no table grants. No authenticated DELETE policies.
2. `supabase/migrations/20260920141000_day4_workspace_rpcs.sql`
   - `sts_save_ws_note` / `sts_archive_ws_note`
   - `sts_save_ws_document` / `sts_archive_ws_document`
   - `sts_save_ws_calendar_event` / `sts_archive_ws_calendar_event`
   - `sts_save_ws_invoice` (transactional line replacement + server totals)
   - `sts_issue_ws_invoice` (billing snapshots + unique `{prefix}-{padded}` number)
   - `sts_record_ws_invoice_payment` / `sts_void_ws_invoice` / `sts_archive_ws_invoice`
   - `sts_ws_replace_invoice_lines` is internal and is not granted to `authenticated` or `anon`
3. `supabase/migrations/20260920142000_day4_storage_documents.sql`
   - Private bucket `org-documents`, 8MB, MIME allow-list PDF/PNG/JPEG/plain text
   - `sts_storage_org_id` parses the first path segment
   - SELECT/INSERT policies only. No authenticated UPDATE/DELETE on objects
4. `supabase/migrations/20260920143000_day4_no_hard_delete.sql`
   - Revokes `DELETE` from `authenticated`, `anon`, and `public`
5. `supabase/migrations/20260920144000_day4_storage_extension_guard.sql`
   - Insert policy requires `pdf|png|jpe?g|txt` on the generated filename segment

Antivirus/malware scanning is not implemented. Only harmless generated local test files were used.

## 3. Authorization matrix

Dashboard entry remains Day 2: active `owner` or `administrator` plus trusted AAL2. That is an application gate. PostgreSQL RLS and Storage policies are the data gate. UI visibility is not a security control.

| Actor | Notes | Calendar | Documents | Invoices |
| --- | --- | --- | --- | --- |
| Signed out | none | none | none | none |
| Authenticated, no membership | none | none | none | none |
| Other organization member | own org only | own org only | own org only | own org only |
| Session below AAL2 | REST/SQL may still run as AAL1; dashboard remains denied | same | same | same |
| Employee / member | read + write + archive | read + write + archive | read + write + archive | none |
| Accountant | none | none | read | read; no write/issue/pay/void |
| Administrator | all Day 4 records; no hard delete | same | same | all invoice actions except hard delete |
| Owner | same as administrator | same | same | same |

Permanent `DELETE` is denied for application sessions. Recoverable archival is the supported removal path. Direct REST `DELETE` fails closed. `service_role` retains maintenance `DELETE` and is not shipped to the browser.

## 4. Notes, documents, calendar, and invoice UI

Permitted dashboard users (owner/admin + AAL2) can:

- create, edit, pin/unpin, and archive notes (plain text; HTML is stripped and never rendered)
- upload, list, download through a short-lived signed redirect, and archive a harmless document
- create, edit, reschedule, and archive internal calendar events
- create invoice drafts with multiple line items and see server-calculated totals
- record issued, record payment, void, and archive when the invoice status allows it
- open a print-friendly invoice view (PDF generation is a later feature)
- refresh without mixing in-memory demo data into Postgres records

Validation and permission failures return generic or field errors without leaking other organizations.

## 5. Invoice calculation and lifecycle

- Line total = quantity × unit cents.
- Invoice total = subtotal − discount + tax. All integer cents. Browser totals are ignored.
- Draft numbers are `DRAFT-` plus a generated suffix. Issued numbers are `{invoice_prefix}-{padded}` and unique per organization.
- Issue snapshots organization legal/display names and client billing fields so later client edits do not rewrite history.
- Statuses stored: `draft`, `issued`, `paid`, `void`. Overdue is derived from an issued due date.
- “Issued” means recorded in the system only. No email is sent.
- “Paid” means manually recorded only. No payment processor is connected.
- Paid and void invoices cannot be edited as drafts. Paid invoices cannot be voided. Archived invoices cannot be mutated.
- Negative totals, empty line lists, oversized values, and discounts above subtotal are rejected.

## 6. Storage security

- Bucket `org-documents` is private.
- Paths are generated as `{organization_id}/{document_id}/{safe-filename}`. User-supplied paths are not trusted.
- Path traversal, cross-organization prefixes, HTML, executables, and oversized uploads failed closed in direct Storage API tests.
- Accountant can read metadata; employee can upload; other-org listing/download is empty or denied.
- Archiving metadata does not delete or expose the private object.

## 7. Restart persistence

After `npx supabase stop` then `npx supabase start`, Day 4 note, calendar event, document metadata, and invoice rows remained (`DAY4_AUTH_PHASE=persist`). Next.js was restarted on the local app port; Postgres remains the system of record for configured sessions.

## 8. Verification commands and results

| Check | Result |
| --- | --- |
| isolated local `db reset` | PASS (all timestamped migrations through Day 4 storage extension guard) |
| Day 1 local SQL | PASS |
| Day 2 local SQL | PASS |
| Day 3 local SQL | PASS |
| Day 4 local SQL | PASS |
| Day 1 local Auth/REST | PASS (known Day 1 gap: logout does not invalidate an existing access token) |
| Day 2 local Auth/REST | PASS |
| Day 3 local Auth/REST | PASS |
| Day 4 local Auth/REST/Storage | PASS |
| AAL1 password sessions vs dashboard AAL2 | PASS (documented; dashboard gate unchanged) |
| Interactive MFA UI | Not re-enrolled after the isolated reset. Day 4 did not change MFA code from Day 3 closure. |
| lint | PASS, zero warnings |
| type-check | PASS |
| automated tests | PASS, 143 |
| production build | PASS |

Commands (local stack only):

```bash
bash scripts/verify-day1-local-supabase.sh
bash scripts/verify-day2-local-supabase.sh
DAY3_DB_RESET=0 bash scripts/verify-day3-local-supabase.sh
DAY4_DB_RESET=0 bash scripts/verify-day4-local-supabase.sh
python3 scripts/verify-day1-local-auth.py
python3 scripts/verify-day2-local-auth.py
python3 scripts/verify-day3-local-auth.py
python3 scripts/verify-day4-local-auth.py
DAY4_AUTH_PHASE=persist python3 scripts/verify-day4-local-auth.py
npx eslint . --max-warnings 0
npx tsc --noEmit
npx vitest run
npm run build
```

## 9. Remaining limitations

- Dashboard UI is still owner/administrator + AAL2. Employee and accountant Day 4 access is enforced at SQL/REST/Storage, not by opening the Command Center to those roles.
- No Stripe, banking, payroll, tax filing, QuickBooks, DocuSign, email, SMS, or Google/Outlook calendar sync.
- Recurrence, reminders, malware scanning, and PDF export are future work.
- Phase 1 owner-scoped `documents` bucket remains separate from `org-documents`.
- Demo mode still uses in-memory notes/documents/events/`workspaceInvoices`.

## 10. Production deployment order and prerequisites

Do not apply these migrations to production from this work.

1. Backup production. Confirm an active production owner membership exists before Day 2 SQL.
2. Apply Day 1, then Day 2, then Day 3, then Day 4 only after each prior day is reviewed.
3. Provision Storage policies and the private `org-documents` bucket on the intended project only after review.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not copy `@day*.test` users or disposable UUIDs into production SQL.
5. Do not merge PR #5, #6, #7, or #8 as a production cutover from this agent.
