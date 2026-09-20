# Day 5 customer estimates and quotes

This report is the evidence log for Day 5 work on top of the completed isolated Day 4 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that a quote was sent, signed, or converted to an invoice.

**Verdict: DAY 5 COMPLETE IN ISOLATED TEST ENV — customer estimates persist with integer-cent totals, a narrow lifecycle, archive/restore, and AAL2 RLS/RPC gates. Not production-ready.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5, PR #6, PR #7, and PR #8 were not merged. Day 5 lives on a draft PR whose base branch is `cursor/sts-business-os-day4-workspace-invoicing-a5ed`.

## 1. Implementation plan (from inspected Day 4 HEAD)

Inspected `cf0b047233750f587c66aef5ba0b1d1096991f97` on `cursor/sts-business-os-day4-workspace-invoicing-a5ed`. The working tree was clean except untracked pycache. Day 5 branched as `cursor/sts-business-os-day5-estimates-a5ed`. `vercel.json` was left unchanged (`main` true, `*` false).

Owner-approved scope: Customer Estimates/Quotes only. Explicitly excluded: email sending, PDF generation/export, e-signatures, contracts, estimate-to-invoice conversion, payment collection, Stripe, QuickBooks, external calendar or accounting integrations, payroll, tax filing, and client portal access.

## 2. Database objects

Migrations:

- `20260920160000_day5_estimates.sql` — helpers, tables, forced RLS, freeze `organization_id`, archived mutation guard with authorized restore
- `20260920161000_day5_estimates_rpcs.sql` — save, status, archive, restore; internal line replace and number assignment
- `20260920162000_day5_estimates_no_hard_delete.sql` — revoke authenticated DELETE

Tables: `ws_estimate_counters`, `ws_estimates`, `ws_estimate_lines`.

Helpers: `sts_can_read_estimates`, `sts_can_write_estimates`, `sts_est_write_audit`, `sts_est_next_number`, `sts_est_replace_lines`.

RPCs granted to `authenticated`: `sts_save_ws_estimate`, `sts_set_ws_estimate_status`, `sts_archive_ws_estimate`, `sts_restore_ws_estimate`.

Internal (not granted): `sts_est_next_number`, `sts_est_replace_lines`, `sts_est_write_audit`.

Money is integer cents. Totals: line total = quantity × unit − line discount; estimate total = subtotal − discount + header tax. Browser totals are ignored.

## 3. Roles and permissions

Dashboard entry remains owner/administrator + AAL2.

| Role | Read estimates | Write estimates | Notes |
| --- | --- | --- | --- |
| Owner | yes at AAL2 | yes at AAL2 | dashboard + SQL/REST |
| Administrator | yes at AAL2 | yes at AAL2 | dashboard + SQL/REST |
| Employee | yes at AAL2 | yes at AAL2 | SQL/REST only; already had `section.estimates` |
| Accountant | no | no | existing matrix has no estimates section |
| Contractor / client / stranger / anon | no | no | |
| AAL1 member | no | no | fail-closed via `sts_session_is_aal2()` |

## 4. Lifecycle

Stored statuses: `draft`, `ready`, `accepted`, `declined`, `expired`.

| From | To | Allowed |
| --- | --- | --- |
| draft | ready | yes |
| ready | draft, accepted, declined, expired | yes |
| accepted / declined / expired | any other status | no |
| any | archived | yes via archive RPC |
| archived | restored | yes via restore RPC; status unchanged |

Ready does **not** send email or generate a document. Expired display can also be derived for a ready quote past `expires_on`.

## 5. UI

`/dashboard/estimates` lists organization-scoped quotes with search and status filters, empty/error/success/pending states, and create/edit/archive/restore. Totals shown in the form are labeled preview-only.

## 6. Exclusions

Not implemented and not implied: sending, PDF, e-sign, contracts, conversion to invoice, payments, Stripe, QuickBooks, payroll, tax filing, external calendar, client portal.

## 7. Verification commands

```bash
bash scripts/verify-day5-local-supabase.sh
python3 scripts/verify-day1-local-auth.py
python3 scripts/verify-day2-local-auth.py
python3 scripts/verify-day3-local-auth.py
python3 scripts/verify-day4-local-auth.py
python3 scripts/verify-day5-local-auth.py
DAY5_AUTH_PHASE=persist python3 scripts/verify-day5-local-auth.py
npx eslint . --max-warnings 0
npx tsc --noEmit
npx vitest run
npm run build
```

Results are recorded in the Day 5 completion report after those commands run.
