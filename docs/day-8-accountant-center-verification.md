# Day 8 read-only Accountant Center

This report is the evidence log for Day 8 work on top of the completed isolated Day 7 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that tax returns, tax advice, audited financial statements, or bank balances are produced.

**Verdict: DAY 8 COMPLETE IN ISOLATED TEST ENV — dedicated `/accountant` surface, minimized read views, authenticated CSV, sanitized export audits. Not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. Prior stacked PRs remain unmerged. Day 8 lives on draft PR #12 whose base branch is `cursor/sts-business-os-day7-project-calendar-automations-a5ed` / PR #11.

## 1. PASS/FAIL table

| Check | Result |
| --- | --- |
| Branch from Day 7 HEAD `2a86f419fbab76bae7e860667e0d6929940ae176` | PASS |
| Complete Day 7 history present | PASS |
| Dedicated `/accountant` loader (not Command Center) | PASS |
| Accountant AAL2 access | PASS |
| AAL1 denial | PASS |
| Owner/admin read-only oversight | PASS |
| Employee / contractor / client / stranger / no-membership denial | PASS |
| Signed-out redirect to login | PASS |
| Cross-organization isolation | PASS |
| Direct table-write denial | PASS |
| Write-RPC denial | PASS |
| Data minimization on accountant views/UI/CSV | PASS |
| Financial calculations (paid 1000 / outstanding 250 / expenses 240 / unreimbursed 40 / net 760 in unit tests; isolation paid 100000¢ / outstanding 25000¢ / expenses 24000¢ / unreimbursed 4000¢) | PASS |
| Estimates excluded from recognized revenue | PASS |
| Archived rows labeled and excluded from headlines | PASS |
| CSV authorization (AAL2 + accountant-read; org from membership) | PASS |
| CSV escaping and formula-injection prefix for `=+-@` | PASS |
| Sanitized `accountant.exported` audit (type + count only) | PASS |
| Public signup remains invite-only in the app | PASS |
| Isolated local SQL Day 1–8 | PASS |
| Isolated local Auth/REST Day 1–8 | PASS |
| Persistence after local Supabase and production Next restart | PASS |
| ESLint zero warnings | PASS |
| Type-check | PASS |
| Vitest | PASS 164/164 |
| Production build | PASS |
| `vercel.json` unchanged | PASS |
| Vercel Preview unauthenticated → SSO | PASS (302 `https://vercel.com/sso-api`) |
| Headed production Next.js AAL2 accountant page flush under puppeteer | FAIL (see §9) |
| Merge / deploy / production accountant invite | Not done (blocked on purpose) |

## 2. Accountant Center functionality

- Dedicated `/accountant` with `AccountantLayout` calling `canAccessAccountantCenter` (AAL2 + owner/administrator/accountant). Command Center stays `canAccessDashboard` (owner/administrator + AAL2).
- Accountants at AAL2 are bounced from `/dashboard` to `/accountant`. `/dashboard/accountant` redirects to `/accountant`. MFA default next for accountants is `/accountant`.
- Owner/administrator may open `/accountant` for oversight; the page has no create/edit/status/archive/restore/delete/convert/reconcile/payment controls.
- Operational totals: paid revenue, outstanding revenue, non-archived expenses, unreimbursed expenses, operational net income estimate, draft/open/overdue/paid invoice totals, monthly summary, invoice list, expense list, sanitized finance audit.
- CSV downloads: GET `/accountant/export/{invoices|revenue|expenses}` rechecks `requireAccountantRead` + `hasAccountantReadRole` on every request. Organization id comes from the session membership, never a query parameter.
- Demo owner may oversee the same read-only surface. No disposable demo accountant identity is invented. Public signup stays disabled in the application (invite-only copy).

## 3. Exact data exposed and deliberately withheld

Exposed on views/UI/CSV:

- Invoice: number, status (including derived overdue), issue/due dates, total, currency, client **business name**, archived label
- Expense: date, vendor, category, safe description, amount, reimbursement status, archived label
- Revenue: earned date, entry type, description, invoice number, amount, payment status, archived label
- Monthly operational paid/outstanding revenue and non-archived expenses
- Finance-related audit: occurred_at, action, entity_type, result (no metadata)
- Export audit: `export_type` and `row_count` only

Withheld:

- Notes, payment instructions, payment account/method
- Client email, phone, contact name, CRM client id, project id
- Estimate contents (estimates are not sourced as revenue)
- Projects, tasks, calendar, internal notes, documents, contract terms, payroll, bank balances, secrets, tokens
- Ordinary read audits (only successful CSV exports are audited)

Day 3/4 leftover: accountants still have SELECT on `ws_invoices` / finance tables through earlier RLS helpers, so REST against those **base tables** can still include notes. The Accountant Center views, UI, and CSV omit those columns. Tightening base-table SELECT would fail Day 4 isolation (`accountant AAL2 can read invoices` / documents).

## 4. Migrations, views, helpers, and RPCs

`supabase/migrations/20260920190000_day8_accountant_center.sql`:

- `sts_can_read_accountant_center(uuid)` — owner/administrator/accountant + inherited AAL2
- `sts_accountant_session_organization()` — org from active membership only
- `security_invoker` views: `sts_accountant_invoices`, `sts_accountant_expenses`, `sts_accountant_revenue`, `sts_accountant_monthly_summary` (SELECT to `authenticated` only)
- `sts_list_accountant_finance_audit()` — sanitized finance actions
- `sts_record_accountant_export(text, integer)` — justified write; `accountant.exported` with type + clamped row count

No new tables. FORCE RLS on existing tables is unchanged. Organization id freeze triggers remain. EXECUTE on prior write RPCs stays on `authenticated`; accountant calls fail closed inside the function/RLS (isolation + Auth/REST proved denials).

## 5. Role and permission matrix

| Actor | `/accountant` | Command Center | Accountant views | Write RPCs / table writes | CSV export |
| --- | --- | --- | --- | --- | --- |
| accountant AAL2 | allow | deny (bounce) | same-org read | deny | allow |
| accountant AAL1 | deny | deny | deny | deny | deny |
| owner / administrator AAL2 | allow (read-only here) | allow | same-org read | deny **on this surface**; Command Center writes unchanged | allow |
| employee / contractor / client | deny | deny | deny | deny | deny |
| no-membership / stranger | deny | deny | deny | deny | deny |
| signed-out | login redirect | login redirect | deny | deny | login or 401 |
| cross-organization | empty/deny | n/a | empty | deny | other org’s rows never loaded |
| anon | deny | deny | deny | deny | deny |

App-role matrix: accountant keeps `section.accountant`, `section.finance`, `section.invoices`, `settings.business.read`. Command Center, taxes, documents, reports, projects, estimates, calendar, and payroll are not granted to the accountant app role.

## 6. Read-only enforcement results

| Check | Result |
| --- | --- |
| Accountant Center page has no submit/write RPCs | PASS |
| Owner/admin cannot UPDATE accountant views | PASS |
| Accountant INSERT/UPDATE/DELETE invoices/expenses | PASS denied |
| Accountant `sts_save_ops_expense` / archive / revenue save / issue / payment / kickoff / reconcile | PASS denied |
| Organization id reassignment | PASS denied |
| Service role not shipped to the browser | PASS |

## 7. Cross-organization and AAL2 results

Isolation SQL and Auth/REST: accountant AAL2 reads five org A invoices and zero org B rows. AAL1 accountant session organization is null; views and export RPC denied. Employee, contractor, client, stranger, and org B owner see empty/denied accountant views. JWT `aal` must be exactly `aal2`.

## 8. CSV security results

| Check | Result |
| --- | --- |
| AAL2 + accountant-read rechecked per GET | PASS (`requireAccountantRead` / `hasAccountantReadRole`) |
| Organization from membership, not client input | PASS |
| On-demand attachment; `Cache-Control: no-store`; no stored files | PASS |
| Filename `sts-accountant-{type}-YYYYMMDD.csv` | PASS |
| Quotes, commas, newlines escaped | PASS |
| Values beginning `=`, `+`, `-`, `@` prefixed with `'` | PASS |
| CSV contents not logged | PASS |
| Export audit type + count only; payroll type rejected | PASS |
| Employee export denied | PASS |

## 9. UI / mobile flows

| Flow | Result |
| --- | --- |
| Signed-out `/accountant` and `/accountant/export/invoices` | PASS → `/login` (screenshot `day8_accountant_signed_out_login.png`) |
| Production `next start` on `http://127.0.0.1:3000` | PASS process; demo mode remains false |
| Disposable local `accountant-ui@day8.test` password + TOTP | Auth/REST AAL2 PASS; headed puppeteer did not receive a flushed AccountantShell (`data-surface=accountant`) before timeout. Next logs showed RSC `destination stream closed early`. |
| Desktop / mobile logged-in layout | Not confirmed in headed Chrome for AAL2; shell includes a mobile menu and overflow tables |
| Accountant `/dashboard` bounce | Layout + unit tests PASS; headed bounce not captured |

## 10. Persistence results

After `docker restart` of local db/auth/rest and production-mode Next restart:

- Day 8 invoice and expense rows remained in `ws_invoices` / `ops_expenses` with unchanged `organization_id`
- `sts_accountant_invoices` remained queryable
- Signed-out `/accountant` still 307 to login
- `DAY8_LOCAL_AUTH_REST_PASSED` persist phase

Postgres remains the system of record for configured sessions. Service-role reads of **security_invoker** accountant views can be empty because the view predicate uses membership/AAL helpers; persist therefore checks base tables for row survival.

## 11. Test / build totals

| Check | Result |
| --- | --- |
| isolated local `db reset` through Day 8 | PASS `DAY8_LOCAL_SUPABASE_VERIFY_PASSED` |
| Day 1–7 SQL re-run | PASS |
| Day 8 SQL | PASS `DAY8_ISOLATION_RUNTIME_PASSED` |
| Day 1–7 Auth/REST re-run | PASS |
| Day 8 Auth/REST | PASS `DAY8_LOCAL_AUTH_REST_PASSED` |
| Persist after restart | PASS |
| ESLint `--max-warnings 0` | PASS |
| `tsc --noEmit` | PASS |
| Vitest | PASS **164/164** (33 files) |
| `next build` | PASS including `/accountant` and `/accountant/export/[type]` |
| `vercel.json` sha256 | `212ced7130515fb7925078dac17826205bea0e9d875ecaeacfb440237ea1e61d` (`main` true, `*` false) |

## 12. Changed files and commits

Day 8 commits on `cursor/sts-business-os-day8-accountant-read-center-a5ed` after Day 7 `2a86f41`:

- `01ee41b` Add a dedicated read-only Accountant Center on Day 8
- `d57aa22` Fix Day 8 isolation write checks and page-source assertions
- `5776315` Fix Accountant Center CSV links and Day 8 invoice seed dates
- `e1c0a51` Tighten Day 8 accountant permissions and CSV authorization
- `7a3bbdc` Fix Day 8 TypeScript invoice status and audit row typing
- `049d775` Page local Auth user lookup after stacked isolation leftovers
- plus this verification log / persist / UI script / loader timeout

`vercel.json` is not in the diff.

## 13. Draft PR and correct stacked base

Draft PR #12: https://github.com/StsCeo/STS-Media-OFFCL-WEBSITE/pull/12  
Base: `cursor/sts-business-os-day7-project-calendar-automations-a5ed` / PR #11  
This agent did not merge PR #5–#12 and did not promote or deploy.

## 14. Vercel Preview protection result

`vercel.json` remains `{ "main": true, "*": false }`. GitHub still recorded Preview deployments. Unauthenticated GET of the listed Preview host returned **302** to `https://vercel.com/sso-api` (Vercel Authentication). No bypass link, protection exception, or production promotion was created.

## 15. Remaining gaps and production blockers

- Headed production-mode Next.js did not flush the AAL2 Accountant Center document to puppeteer in this VM (RSC stream closed early). SQL/Auth/REST still prove the data path.
- Accountants retain Day 3/4 SELECT on some operational base tables (notes possible via REST on `ws_invoices`). Center views/UI/CSV withhold those fields. Day 4 isolation expects invoice/document SELECT.
- Write RPC EXECUTE remains on `authenticated`; denials are in-function/RLS, not a separate PostgreSQL role.
- No tax preparation, payroll, banking, payments, Stripe, QuickBooks, accountant invitations, production memberships, email, or sharing links.
- Demo CSV skip-audits (demo-memory path). Postgres exports are audited.
- Day 1 logout still does not invalidate an existing access token.
- These migrations have not been applied to production.
- Do not invite a production accountant.

## 16. Review / merge safety verdict

Draft PR #12 is stacked on Day 7 (`cursor/sts-business-os-day7-project-calendar-automations-a5ed` / PR #11). **Safe to review. Not safe to merge, promote, or deploy from this work.**
