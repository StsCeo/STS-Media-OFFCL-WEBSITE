# Day 6 estimate-to-invoice workflow and printable commercial documents

This report is the evidence log for Day 6 work on top of the completed isolated Day 5 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that a document was emailed, stored as a PDF, signed, or paid.

**Verdict: DAY 6 COMPLETE IN ISOLATED TEST ENV — accepted estimates convert to one draft invoice through an atomic idempotent RPC, and authenticated print views use the browser print dialog. Not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5, PR #6, PR #7, PR #8, and PR #9 were not merged. Day 6 lives on draft PR #10 whose base branch is `cursor/sts-business-os-day5-estimates-a5ed`.

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

| Check | Result |
| --- | --- |
| Accepted + active + same org + invoice write | allowed; creates draft invoice |
| Repeat conversion | returns the same invoice id; one row |
| Totals 2 × 150000 − 5000 | subtotal 300000, discount 5000, total 295000 |
| Draft / ready / declined / expired | denied |
| Archived, including archived accepted | denied |
| AAL1 owner | denied |
| Employee / accountant | denied |
| Cross-organization | denied |
| Signed-out / stranger | denied |
| `source_estimate_id` mutate | denied |
| Authenticated DELETE | denied |
| Audit `estimate.converted_to_invoice` | identifiers only; notes and line text omitted |

## 6. Print / PDF behavior

Print / Save as PDF opens the browser print dialog. Nothing is uploaded to Storage or an external provider. Pages are not public. Sidebar, header, demo banner, skip link, mobile nav, and estimate internal notes use `.no-print`. Signed-out print URLs redirect to login.

## 7. UI flows tested

Production `next start` on port 3040: signed-out `GET` of estimates and both print routes returned 307 to `/login`. Demo mode is disabled when `NODE_ENV=production`.

Local demo on `http://localhost:3030` (in-memory, not Postgres):

| Flow | Result |
| --- | --- |
| Demo login | PASS |
| Save draft with $2,950.00 preview | PASS |
| Mark ready; no send/payment claim | PASS |
| Record accepted | PASS |
| Create draft invoice | PASS |
| Open draft invoice / invoices list with source estimate and total | PASS |
| Estimate print: customer, terms, notes, internal notes no-print, Print / Save as PDF | PASS |
| Invoice print: customer, line items, totals, source estimate, nav no-print | PASS |
| Mobile estimates and print layout | PASS |
| Command Center still loads | PASS |
| Conversion link remains after navigation | PASS |

## 8. Persistence

After `npx supabase stop` then `npx supabase start`, the REST persist phase re-read the converted draft invoice (`source_estimate_id`, integer-cent totals 300000/5000/295000, customer snapshot, line items) and the sanitized `estimate.converted_to_invoice` audit without notes or line descriptions. After a production-mode Next.js restart on port 3040, the same persist phase passed and signed-out print/estimate routes still returned 307 to login. Postgres remains the system of record for configured sessions.

## 9. Verification commands and results

| Check | Result |
| --- | --- |
| isolated local `db reset` and full migration chain | PASS through `20260920170000_day6_estimate_to_invoice.sql` |
| Day 1 local SQL | PASS |
| Day 2 local SQL | PASS |
| Day 3 local SQL | PASS |
| Day 4 local SQL + AAL2 SQL | PASS |
| Day 5 local SQL | PASS |
| Day 6 local SQL | PASS (`DAY6_ISOLATION_RUNTIME_PASSED`) |
| Day 1 local Auth/REST | PASS (known Day 1 gap: logout does not invalidate an existing access token) |
| Day 2 local Auth/REST | PASS |
| Day 3 local Auth/REST | PASS |
| Day 4 local Auth/REST | PASS |
| Day 5 local Auth/REST | PASS |
| Day 6 local Auth/REST | PASS (`DAY6_LOCAL_AUTH_REST_PASSED`) |
| Persistence after `supabase stop/start` | PASS |
| Persistence after Next.js production restart | PASS |
| Signed-out estimates and print views | PASS (307 to login) |
| AAL2 enforcement | PASS |
| lint | PASS, zero warnings |
| type-check | PASS |
| automated tests | PASS, 151/151 |
| production build | PASS (includes `/dashboard/estimates/[id]/print` and `/dashboard/invoices/[id]/print`) |
| `vercel.json` | PASS unchanged (`main` true, `*` false) vs Day 5 `21acb84` |

Commands (local stack only):

```bash
bash scripts/verify-day6-local-supabase.sh
python3 scripts/verify-day1-local-auth.py
python3 scripts/verify-day2-local-auth.py
python3 scripts/verify-day3-local-auth.py
python3 scripts/verify-day4-local-auth.py
python3 scripts/verify-day5-local-auth.py
python3 scripts/verify-day6-local-auth.py
DAY6_AUTH_PHASE=persist python3 scripts/verify-day6-local-auth.py
npx eslint . --max-warnings 0
npx tsc --noEmit
npx vitest run
npm run build
```

## 10. Exclusions

Not implemented and not implied: email sending, stored PDF files, e-sign, public customer links, Stripe or payment collection, QuickBooks, external storage, contracts, production Supabase, or production deployment.

## 11. Remaining gaps and production blockers

- Dashboard UI is still owner/administrator + AAL2. Employee conversion remains denied on purpose.
- Demo mode still uses in-memory estimates/invoices. Configured Supabase sessions write through Day 6 RPCs.
- Day 1 logout still does not invalidate an existing access token.
- These migrations have not been applied to production.
- `vercel.json` is unchanged and still says only `main` auto-deploys. GitHub nevertheless recorded Preview deployment objects for Day 6 commits (`c84f072`, `becd8fc`, `032fa04`, `107f2af`) with a Vercel check marked completed. This agent did not open, promote, delete, or create a bypass link for those deployments. Owner action remains: confirm Vercel Git settings and Preview isolation using `docs/vercel-preview-safety.md`.
- Do not merge PR #5, #6, #7, #8, #9, or #10 as a production cutover from this agent.

## 12. Review / merge safety

Draft PR #10 is stacked on Day 5 (`cursor/sts-business-os-day5-estimates-a5ed`). Safe to review. Not safe to merge, promote, or deploy from this work.
