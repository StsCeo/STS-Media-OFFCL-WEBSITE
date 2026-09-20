# Day 6 estimate-to-invoice workflow and printable commercial documents

This report is the evidence log for Day 6 work on top of the completed isolated Day 5 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that a document was emailed, stored as a PDF, signed, or paid.

**Verdict: pending local verification — not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5, PR #6, PR #7, PR #8, and PR #9 were not merged. Day 6 lives on a draft PR whose base branch is `cursor/sts-business-os-day5-estimates-a5ed`.

## 1. Implementation plan (from inspected Day 5 HEAD)

Inspected `21acb846c65e2d7ba0e7c77a916cac87dcfab95c` on `cursor/sts-business-os-day5-estimates-a5ed`. Day 6 branched as `cursor/sts-business-os-day6-commercial-workflow-a5ed`. `vercel.json` was left unchanged (`main` true, `*` false).

Owner-approved scope: accepted estimate → one draft invoice via an atomic idempotent RPC, plus authenticated print views that use the browser print dialog. Explicitly excluded: email sending, stored PDFs, public document URLs, e-signatures, contracts, Stripe or payment collection, QuickBooks, external storage, production Supabase, and production deployment.

## 2. Functionality delivered

- Owner/administrator can convert an accepted, active, same-organization estimate into one draft invoice.
- Conversion snapshots estimate number, organization and customer information, line items, integer-cent totals, terms, and customer notes.
- Repeated conversion returns the existing invoice. `source_estimate_id` is unique and immutable.
- Conversion does not issue, email, or collect payment.
- Authenticated print views at `/dashboard/estimates/[id]/print` and `/dashboard/invoices/[id]/print` with Print / Save as PDF using `window.print()`.
- Navigation, controls, and estimate internal notes are hidden when printing.
- No generated PDF is uploaded or stored. Print URLs remain behind the dashboard AAL2 session.

## 3. Migrations, tables, helpers, and RPCs

Migration: `20260920170000_day6_estimate_to_invoice.sql`

- Adds `ws_invoices.source_estimate_id` and `source_estimate_number`
- Unique index on `source_estimate_id` where not null
- Same-organization / immutability trigger `sts_ws_assert_same_org_estimate`
- RPC `sts_convert_ws_estimate_to_invoice(uuid, uuid)` granted to `authenticated` only

Money remains integer cents. Invoice line totals are quantity × unit. Header discount is the sum of estimate line discounts. Tax is copied from the estimate header. The RPC fails if the recalculated total does not match `estimate.total_cents`.

## 4. Roles and permissions

Dashboard entry remains owner/administrator + AAL2. Conversion uses `sts_can_write_invoices` (owner/administrator). Employee estimate write was not broadened to invoice write.

| Role | Convert estimate | Print views (dashboard) | Notes |
| --- | --- | --- | --- |
| Owner | yes at AAL2 | yes at AAL2 | |
| Administrator | yes at AAL2 | yes at AAL2 | |
| Employee | no | no dashboard | can write estimates, cannot convert |
| Accountant | no | no | |
| Contractor / client / stranger / anon | no | no | |
| AAL1 member | no | no | fail-closed via `sts_session_is_aal2()` |

## 5. Conversion security and idempotency

Allowed: accepted + not archived + same organization + invoice write role.

Denied: draft, ready, declined, expired, archived, cross-organization, AAL1, employee, accountant, signed-out.

Idempotency: SELECT existing by `source_estimate_id` under `FOR UPDATE`, unique index, and `unique_violation` catch returning the existing id.

Audit: `estimate.converted_to_invoice` with sanitized metadata `{result, invoice_id}` only.

## 6. Print / PDF behavior

Print / Save as PDF opens the browser print dialog. Nothing is uploaded to Storage or an external provider. Pages are not public. Internal notes and chrome use `.no-print`.

## 7–12. Verification results

Filled after the isolated local verification pass.
