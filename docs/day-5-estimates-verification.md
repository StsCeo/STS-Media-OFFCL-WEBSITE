# Day 5 customer estimates and quotes

This report is the evidence log for Day 5 work on top of the completed isolated Day 4 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that a quote was sent, signed, or converted to an invoice.

**Verdict: DAY 5 COMPLETE IN ISOLATED TEST ENV — customer estimates persist with integer-cent totals, a narrow lifecycle, archive/restore, and AAL2 RLS/RPC gates. Not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5, PR #6, PR #7, and PR #8 were not merged. Day 5 lives on draft PR #9 whose base branch is `cursor/sts-business-os-day4-workspace-invoicing-a5ed`.

## 1. Implementation plan (from inspected Day 4 HEAD)

Inspected `cf0b047233750f587c66aef5ba0b1d1096991f97` on `cursor/sts-business-os-day4-workspace-invoicing-a5ed`. Day 5 branched as `cursor/sts-business-os-day5-estimates-a5ed`. `vercel.json` was left unchanged (`main` true, `*` false).

Owner-approved scope: Customer Estimates/Quotes only. Explicitly excluded: email sending, PDF generation/export, e-signatures, contracts, estimate-to-invoice conversion, payment collection, Stripe, QuickBooks, external calendar or accounting integrations, payroll, tax filing, and client portal access.

## 2. Functionality delivered

- `/dashboard/estimates` lists organization-scoped quotes with search, status filters, empty/error/success/pending states, and create/edit/archive/restore.
- Optional same-organization client association. Cross-organization clients are rejected.
- Organization-scoped estimate numbers (`EST-0001` style from `estimate_prefix`).
- Title, description, issue date, optional expiration, internal notes, customer-facing notes, terms.
- Normalized line items: description, quantity, integer unit cents, optional integer line discount, optional integer header tax. Totals are calculated on the server. Browser totals are labeled preview-only.
- Lifecycle: `draft`, `ready`, `accepted`, `declined`, `expired`. Ready does not send email or export a document.
- Recoverable archive/restore. No authenticated hard delete. Archived rows are immutable except authorized restore.
- Sanitized audit events for created, updated, status changed, archived, and restored.

## 3. Migrations, tables, helpers, and RPCs

Migrations:

- `20260920160000_day5_estimates.sql` — helpers, tables, forced RLS, freeze `organization_id`, archived mutation guard with authorized restore
- `20260920161000_day5_estimates_rpcs.sql` — save, status, archive, restore; internal line replace and number assignment
- `20260920162000_day5_estimates_no_hard_delete.sql` — revoke authenticated DELETE

Tables: `ws_estimate_counters`, `ws_estimates`, `ws_estimate_lines`.

Helpers: `sts_can_read_estimates`, `sts_can_write_estimates`, `sts_est_write_audit`, `sts_est_next_number`, `sts_est_replace_lines`.

RPCs granted to `authenticated`: `sts_save_ws_estimate`, `sts_set_ws_estimate_status`, `sts_archive_ws_estimate`, `sts_restore_ws_estimate`.

Internal (not granted): `sts_est_next_number`, `sts_est_replace_lines`, `sts_est_write_audit`.

Money is integer cents. Line total = quantity × unit − line discount. Estimate total = subtotal − discount + header tax. Browser-submitted totals are ignored.

## 4. Roles and permissions

Dashboard entry remains owner/administrator + AAL2. Existing `section.estimates` already included employee; accountant was not broadened.

| Role | Read estimates | Write estimates | Notes |
| --- | --- | --- | --- |
| Owner | yes at AAL2 | yes at AAL2 | dashboard + SQL/REST |
| Administrator | yes at AAL2 | yes at AAL2 | dashboard + SQL/REST |
| Employee | yes at AAL2 | yes at AAL2 | SQL/REST only; already had `section.estimates` |
| Accountant | no | no | existing matrix has no estimates section |
| Contractor / client / stranger / anon | no | no | |
| AAL1 member | no | no | fail-closed via `sts_session_is_aal2()` |

## 5. Lifecycle

Stored statuses: `draft`, `ready`, `accepted`, `declined`, `expired`.

| From | To | Allowed |
| --- | --- | --- |
| draft | ready | yes |
| ready | draft, accepted, declined, expired | yes |
| accepted / declined / expired | any other status | no |
| any | archived | yes via archive RPC |
| archived | restored | yes via restore RPC; status unchanged |
| archived | any other mutation | no |

Ready does **not** send email or generate a document. Expired display can also be derived for a ready quote past `expires_on`.

## 6. UI flows tested

Production `next start` on port 3000: signed-out `GET /dashboard/estimates` returned 307 to `/login?next=%2Fdashboard%2Festimates`. Demo mode is disabled when `NODE_ENV=production`.

Local demo on `http://localhost:3000` (in-memory, not Postgres):

| Flow | Result |
| --- | --- |
| Signed-out estimates redirect to login | PASS |
| Empty state and exclusion copy | PASS |
| Empty line description rejected | PASS |
| Save draft EST-0001 with $2,950.00 total (2 × $1,500 − $50) | PASS |
| Search `collision` / `invoice` and Draft vs Ready filters | PASS |
| Mark ready; copy states no email or PDF was created | PASS |
| Archive then restore | PASS |
| Record accepted; no Send / e-sign / convert / pay buttons | PASS |
| Invoices and Command Center still load | PASS |
| Mobile viewport still shows the accepted quote | PASS |

## 7. RLS, cross-organization, archival, and hard-delete

| Check | Result |
| --- | --- |
| AAL1 owner REST read/write | denied |
| Employee AAL2 save | allowed |
| Accountant AAL2 read/write | denied |
| Cross-organization client on an estimate | denied |
| Other-organization owner REST read | empty/denied |
| Stranger / signed-out REST | empty/denied |
| Negative unit cents | denied |
| Oversized line total | denied |
| Invalid status (accepted → declined) | denied |
| Archived mutation | denied |
| Authenticated DELETE | denied |
| Restore after archive | allowed; status unchanged |

## 8. Persistence

After `npx supabase stop` then `npx supabase start`, the REST persist phase re-read the Day 5 estimate header (`accepted`, not archived), integer-cent line items, and sanitized audit actions (`created`, `status_changed`, `archived`, `restored`) without customer notes or line descriptions. After a production-mode Next.js restart, the same persist phase passed and signed-out `/dashboard/estimates` still returned 307 to login. Postgres remains the system of record for configured sessions.

## 9. Verification commands and results

| Check | Result |
| --- | --- |
| isolated local `db reset` and full migration chain | PASS through `20260920162000_day5_estimates_no_hard_delete.sql` |
| Day 1 local SQL | PASS |
| Day 2 local SQL | PASS |
| Day 3 local SQL | PASS |
| Day 4 local SQL + AAL2 SQL | PASS |
| Day 5 local SQL | PASS (`DAY5_ISOLATION_RUNTIME_PASSED`) |
| Day 1 local Auth/REST | PASS (known Day 1 gap: logout does not invalidate an existing access token) |
| Day 2 local Auth/REST | PASS |
| Day 3 local Auth/REST | PASS |
| Day 4 local Auth/REST | PASS |
| Day 5 local Auth/REST | PASS (`DAY5_LOCAL_AUTH_REST_PASSED`) |
| Persistence after `supabase stop/start` | PASS |
| Persistence after Next.js production restart | PASS |
| Signed-out `/dashboard/estimates` | PASS (307 to login) |
| AAL2 enforcement | PASS |
| lint | PASS, zero warnings |
| type-check | PASS |
| automated tests | PASS, 149/149 |
| production build | PASS (includes `/dashboard/estimates`) |
| `vercel.json` | PASS unchanged (`main` true, `*` false) vs Day 4 `cf0b047` |

Commands (local stack only):

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

## 10. Exclusions

Not implemented and not implied: sending, PDF export, e-sign, contracts, conversion to invoice, payments, Stripe, QuickBooks, payroll, tax filing, external calendar, client portal.

## 11. Remaining gaps and production blockers

- Dashboard UI is still owner/administrator + AAL2. Employee estimate access is SQL/REST only.
- Demo mode still uses in-memory `workspaceEstimates`. Configured Supabase sessions write through Day 5 RPCs.
- Day 1 logout still does not invalidate an existing access token.
- These migrations have not been applied to production.
- `vercel.json` is unchanged and still says only `main` auto-deploys. GitHub nevertheless recorded Preview deployment objects for Day 5 commits (`43a2fe8`, `3ef71f0`, `258a519`) with state `success`. This agent did not open, promote, or delete those deployments. Owner action remains: confirm Vercel Git settings and Preview isolation using `docs/vercel-preview-safety.md`.
- Do not merge PR #5, #6, #7, #8, or #9 as a production cutover from this agent.

## 12. Review / merge safety

Draft PR #9 is stacked on Day 4 (`cursor/sts-business-os-day4-workspace-invoicing-a5ed`). Safe to review. Not safe to merge, promote, or deploy from this work.
