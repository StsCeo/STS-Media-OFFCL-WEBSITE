# Day 8 read-only Accountant Center

This report is the evidence log for Day 8 work on top of the completed isolated Day 7 closure, including the base-table lockdown that was still open after the first Accountant Center pass. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that tax returns, tax advice, audited financial statements, or bank balances are produced.

**Verdict: DAY 8 COMPLETE IN ISOLATED TEST ENV — dedicated `/accountant` surface, accountant base-table SELECT closed, parameterless SECURITY DEFINER reads, production-mode AAL2 Accountant Center observed. Not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. Prior stacked PRs remain unmerged. Day 8 lives on draft PR #12 whose base branch is `cursor/sts-business-os-day7-project-calendar-automations-a5ed` / PR #11. Day 9 was not started.

## 1. PASS/FAIL table

| Check | Result |
| --- | --- |
| Branch from Day 7 HEAD `2a86f419fbab76bae7e860667e0d6929940ae176` | PASS |
| Complete Day 7 history present | PASS |
| Dedicated `/accountant` loader (not Command Center) | PASS |
| Accountant AAL2 access through safe read functions | PASS |
| AAL1 denial | PASS |
| Owner/admin read-only oversight | PASS |
| Employee / contractor / client / stranger / no-membership denial | PASS |
| Signed-out `/accountant` and export URLs redirect to login | PASS |
| Cross-organization isolation | PASS |
| Direct sensitive base-table SELECT denial for accountants | PASS |
| Sensitive-column REST probing denial | PASS |
| Direct table-write denial | PASS |
| Write-RPC denial | PASS |
| Data minimization on functions/UI/CSV | PASS |
| Financial calculations (unit tests paid 1000 / outstanding 250 / expenses 240 / unreimbursed 40 / net 760; isolation paid 100000¢ / outstanding 25000¢ / expenses 24000¢ / unreimbursed 4000¢) | PASS |
| Estimates excluded from recognized revenue | PASS |
| Archived rows labeled and excluded from headlines | PASS |
| CSV authorization (AAL2 + accountant-read; org from membership) | PASS |
| CSV escaping and formula-injection prefix for `=+-@` | PASS |
| Sanitized `accountant.exported` audit (type + count only) | PASS |
| No ordinary-read audit spam | PASS |
| Public signup remains invite-only in the app | PASS |
| Isolated local SQL Day 1–8 | PASS |
| Isolated local Auth/REST Day 1–8 | PASS |
| Persistence after local Supabase and production Next restart | PASS |
| Production-mode `next start` AAL2 Accountant Center rendered | PASS |
| ESLint zero warnings | PASS |
| Type-check | PASS |
| Vitest | PASS 164/164 |
| Production build | PASS |
| `vercel.json` unchanged | PASS |
| Vercel Preview unauthenticated → SSO | PASS (302 `https://vercel.com/sso-api`) |
| Merge / deploy / production accountant invite | Not done (blocked on purpose) |

## 2. Accountant base-table access before and after

Inventory is for an active accountant membership at AAL2 against organization-owned tables, via SQL or PostgREST. Owner/administrator SELECT is unchanged.

**Before the Day 8 closure migration** (`20260920191000_day8_accountant_base_table_lockdown.sql`):

| Table | Accountant SELECT | Why |
| --- | --- | --- |
| `organizations` | allow (own org) | member policy + AAL2 |
| `organization_members` | allow (own row + staff-visible members) | Day 1 staff visibility includes accountant |
| `business_settings` | allow | `business_settings_select_staff` included accountant |
| `ops_expenses` | allow | `sts_can_read_finance` included accountant |
| `ops_revenue` | allow | `ops_revenue_select_scoped` included accountant |
| `ws_invoices` | allow | `sts_can_read_invoices` included accountant |
| `ws_invoice_lines` | allow | same invoice helper |
| `ws_invoice_counters` | allow | same invoice helper |
| `ws_documents` + storage `org-documents` | allow | `sts_can_read_documents` included accountant |
| `sts_accountant_*` views | allow | `security_invoker` views required the base-table grants above |
| `crm_*` | deny | `sts_can_manage_crm` |
| `ops_projects` / `ops_tasks` | deny | `sts_can_manage_operations` |
| `ws_notes` | deny | notes helpers exclude accountant |
| `ws_calendar_events` | deny | calendar helpers exclude accountant |
| `ws_estimates` | deny | estimate helpers exclude accountant |
| `audit_events` | deny | owner/administrator only |

**After the closure migration:**

| Table | Accountant SELECT | Notes |
| --- | --- | --- |
| `organizations` | allow (own org) | required for membership/session |
| `organization_members` | allow (own row + staff-visible members) | required for session; no extra privilege added |
| `business_settings` | deny / zero rows | staff policy is now owner/administrator/employee |
| `ops_expenses` | deny / zero rows | `sts_can_read_finance` is owner/administrator/employee |
| `ops_revenue` | deny / zero rows | revenue SELECT is owner/administrator |
| `ws_invoices` / `ws_invoice_lines` / `ws_invoice_counters` | deny / zero rows | `sts_can_read_invoices` is owner/administrator |
| `ws_documents` + `org-documents` | deny / zero rows | `sts_can_read_documents` is owner/administrator/employee |
| `sts_accountant_*` views | dropped | replaced by parameterless functions |
| CRM / projects / tasks / notes / calendar / estimates / `audit_events` | deny | unchanged |

Owner and administrator still SELECT invoice, expense, revenue, document, and settings base tables. Employee still SELECT expenses, documents, and settings. Earlier Day 1/3/4 isolation and Auth expectations that said accountants could read those base tables were updated to denials. Write-denial coverage was not weakened.

## 3. Sensitive fields now blocked

Direct accountant REST/SQL against the locked tables returns no rows, including `select=*`, embeds/joins, and explicit column lists. Changing REST `select` parameters cannot obtain:

- Invoice `notes`, `payment_instructions`, `client_email`, `client_contact_name`, `client_id`, `created_by`, org legal/display snapshots beyond the allowlisted business name
- Expense `notes`, `payment_account`, `payment_method`, `business_purpose`, `client_id`, `project_id`, `receipt_name`
- Revenue `notes`, `payment_method`, `client_id`, `project_id`
- Document `storage_path`, `description`, `client_id`, `project_id`, `uploaded_by`, and storage object bytes
- Business settings `default_payment_terms`, prefixes, brand JSON, notification JSON
- CRM contact fields, project/task identifiers, calendar contents, internal notes, estimate contents

Client-supplied organization ids on the list RPCs are rejected or ignored; extra JSON keys cannot select another organization.

## 4. Safe read functions and exact allowlisted output

`supabase/migrations/20260920191000_day8_accountant_base_table_lockdown.sql` drops the four `security_invoker` views and adds:

| Function | Allowlisted columns |
| --- | --- |
| `sts_list_accountant_invoices()` | `id`, `invoice_number`, `status`, `issue_date`, `due_date`, `currency`, `client_business_name`, `subtotal_cents`, `tax_cents`, `total_cents`, `amount_paid_cents`, `paid_at`, `archived_at` |
| `sts_list_accountant_expenses()` | `id`, `transaction_date`, `vendor`, `description`, `category`, `currency`, `total_cents`, `reimbursable`, `reimbursement_status`, `archived_at` |
| `sts_list_accountant_revenue()` | `id`, `earned_date`, `entry_type`, `description`, `invoice_number`, `currency`, `amount_cents`, `payment_status`, `archived_at` |

Shared guarantees on every list function:

- `SECURITY DEFINER`
- `set search_path = public`
- no organization argument; org from `sts_accountant_session_organization()` only
- requires AAL2 + active owner/administrator/accountant membership via `sts_can_read_accountant_center`
- `raise exception 'not authorized'` if the session org is null
- no dynamic SQL
- `limit 500`
- `REVOKE ALL` from `public`/`anon`; `GRANT EXECUTE` to `authenticated` only

Existing `sts_list_accountant_finance_audit()` still returns `occurred_at`, `action`, `entity_type`, `result`. `sts_record_accountant_export(text, integer)` remains the only accountant-justified write and stores `export_type` + clamped `row_count` only.

The Accountant Center loader and CSV route call these RPCs with no `organization_id` argument. Monthly totals are derived in application code from the allowlisted rows.

## 5. Real production-mode AAL2 browser results

Production `next start` on `http://127.0.0.1:3000` (`NODE_ENV=production`, demo mode false) with a disposable local accountant:

| Flow | Result |
| --- | --- |
| Sign in through `/login?next=/accountant` | PASS |
| TOTP challenge to AAL2 | PASS |
| `/accountant` full document with `data-surface="accountant"` | PASS (headed Chrome) |
| Financial summary, invoices, expenses, revenue, sanitized audits | PASS |
| No mutation controls / write RPC names | PASS |
| Invoices, revenue, and expenses CSV downloads | PASS (headers and filename checked; bodies not logged) |
| Mobile layout + menu | PASS |
| `/dashboard` bounces to `/accountant` | PASS |
| Sign out, then `/accountant` and export URL redirect to login | PASS |

Screenshots (email redacted in-page before capture): `accountant_center_desktop.png`, `accountant_center_mobile.png`, `accountant_signed_out_login.png`. Passwords, TOTP secrets, codes, cookies, JWTs, CSV bodies, and service-role credentials were not logged or committed.

## 6. RSC failure root cause and fix

The earlier `destination stream closed early` was a test-harness abort, not an application 500.

Root cause: Puppeteer `Promise.all(click, waitForNavigation({ waitUntil: "load" }))` cancelled the in-flight RSC GET for `/accountant` while Next was still streaming. A second harness bug treated the AAL1 hop through `/accountant` (before the MFA redirect) as success and skipped TOTP, so later dumps showed an MFA document or an empty `<!--$--><!--/$-->` slot.

Application-side hardening:

- Accountant layout streams the shell (`data-surface="accountant"`) through `Suspense` so the surface can flush before list RPCs finish
- Loader timeout that returned an empty “unavailable” overview was removed
- CSV and page reads use the new RPCs instead of views that would fail closed after RLS tightening

Harness-side fix:

- Do not call `waitForNavigation` after server-action submits
- Wait for the MFA form **or** `[data-surface="accountant"]`, never pathname `/accountant` alone
- Issue TOTP from a fresh window immediately before fill
- Close the mobile overlay before Sign out

Sanitized Next logs during the passing headed run contained no RSC/stream exception. The passing headed check observed the rendered Accountant Center, not only a screenshot of MFA.

## 7. SQL/REST security results

Isolation SQL (`DAY8_LOCAL_SUPABASE_VERIFY_PASSED`) and Auth/REST (`DAY8_LOCAL_AUTH_REST_PASSED`) both passed after the lockdown:

- Accountant AAL2 list RPCs return org A allowlisted rows
- Accountant AAL1 list/export denied
- Direct SELECT on `ws_invoices`, `ws_invoice_lines`, `ws_invoice_counters`, `ops_expenses`, `ops_revenue`, `ws_documents`, `business_settings` denied or empty
- REST probes with `select=*`, withheld columns, and embeds returned no rows
- Extra RPC organization arguments rejected or ignored without cross-org data
- Employee/contractor/client/stranger/cross-org owner denied on list RPCs
- Owner/admin still SELECT invoice and expense base tables and can oversee list RPCs
- Accountant mutations (direct insert/update/delete and write RPCs) denied
- Ordinary reads do not insert `accountant.exported`; only the export RPC does

## 8. CSV security results

| Check | Result |
| --- | --- |
| AAL2 + accountant-read rechecked per GET | PASS |
| Organization from membership, not client input | PASS |
| Signed-out export redirects to login | PASS |
| Filename `sts-accountant-{type}-YYYYMMDD.csv` | PASS |
| Quotes, commas, newlines escaped | PASS |
| Values beginning `=`, `+`, `-`, `@` prefixed with `'` | PASS |
| Withheld fields absent from headers/body checks | PASS |
| CSV contents not logged | PASS |
| Export audit type + count only; payroll type rejected | PASS |
| Employee export denied | PASS |

## 9. Regression totals

| Check | Result |
| --- | --- |
| isolated local `db reset` through Day 8 closure migration | PASS `DAY8_LOCAL_SUPABASE_VERIFY_PASSED` |
| Day 1–8 SQL | PASS |
| Day 1–8 Auth/REST | PASS |
| Persist after Docker Auth/REST/DB restart and production Next restart | PASS (invoice/expense rows + list function remain) |
| ESLint `--max-warnings 0` | PASS |
| `tsc --noEmit` | PASS |
| Vitest | PASS **164/164** (33 files) |
| `next build` | PASS including `/accountant` and `/accountant/export/[type]` |
| `vercel.json` sha256 | `212ced7130515fb7925078dac17826205bea0e9d875ecaeacfb440237ea1e61d` (`main` true, `*` false) |

Day 1/3/4 accountant **read** expectations were deliberately rewritten as denials. Owner/admin positive tests and all write-denial tests remain.

## 10. Changed files and new commits

Day 8 commits on `cursor/sts-business-os-day8-accountant-read-center-a5ed` after Day 7 `2a86f41`:

- `01ee41b` Add a dedicated read-only Accountant Center on Day 8
- `d57aa22` Fix Day 8 isolation write checks and page-source assertions
- `5776315` Fix Accountant Center CSV links and Day 8 invoice seed dates
- `e1c0a51` Tighten Day 8 accountant permissions and CSV authorization
- `7a3bbdc` Fix Day 8 TypeScript invoice status and audit row typing
- `049d775` Page local Auth user lookup after stacked isolation leftovers
- `d2566ca` Record Day 8 local verification without secrets or production claims
- `8f88079` Close accountant SELECT on sensitive base tables
- `8c0c00f` Fix Day 8 accountant RPC row typing for tsc
- `692461e` Accept any allowlisted invoice row in Day 8 Auth checks
- `371c84e` Wait for MFA or the accountant surface before treating sign-in as AAL2
- `2308907` Close the mobile menu before signing out of Accountant Center

`vercel.json` is not in the diff.

## 11. PR #12 status

Draft PR #12: https://github.com/StsCeo/STS-Media-OFFCL-WEBSITE/pull/12  
Base: `cursor/sts-business-os-day7-project-calendar-automations-a5ed` / PR #11  
This agent did not merge PR #5–#12 and did not promote or deploy. No Day 9 PR was created.

## 12. Vercel protection result

`vercel.json` remains `{ "main": true, "*": false }`. GitHub still recorded Preview deployments. Unauthenticated GET of `https://sts-media-offcl-website-bcgdwe9o9-stsceo.vercel.app/` returned **302** to `https://vercel.com/sso-api` (Vercel Authentication). No bypass link, protection exception, or production promotion was created.

## 13. Remaining blockers

- Write RPC `EXECUTE` remains on `authenticated`; denials are in-function/RLS, not a separate PostgreSQL role
- These migrations have not been applied to production
- No tax preparation, payroll, banking, payments, Stripe, QuickBooks, accountant invitations, production memberships, email, or sharing links
- Demo CSV path still skips export audits (demo-memory only). Postgres exports are audited
- Day 1 logout still does not invalidate an existing access token
- Do not invite a production accountant

## 14. Review / merge safety verdict

Draft PR #12 is stacked on Day 7 (`cursor/sts-business-os-day7-project-calendar-automations-a5ed` / PR #11). Direct accountant SELECT of sensitive operational base tables is closed in the isolated stack, and the production-mode Accountant Center was observed at AAL2. **Safe to review. Not safe to merge, promote, or deploy from this work.**
