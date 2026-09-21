# Day 9 read-only invitation-only Client Portal

This report is the evidence log for Day 9 work on top of the completed isolated Day 8 closure. It does not claim production readiness, legal compliance, payment compliance, or that clients can pay, sign, message, or upload.

**Verdict: DAY 9 COMPLETE IN ISOLATED TEST ENV — dedicated `/client` portal, explicit publication model, parameterless SECURITY DEFINER reads, production-mode AAL2 Client Portal observed. Not production-ready. Do not merge or deploy.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. Prior stacked PRs remain unmerged. Day 9 lives on draft PR #13 whose base branch is `cursor/sts-business-os-day8-accountant-read-center-a5ed` / PR #12. Day 10 was not started.

No passwords, TOTP secrets/codes, cookies, JWTs, service-role keys, signed URLs, storage paths, document contents, connection strings, or environment-variable values were logged or committed.

## 1. PASS/FAIL table

| Check | Result |
| --- | --- |
| Branch from Day 8 HEAD `9b1e67b` | PASS |
| Complete Day 8 closure history present | PASS |
| Dedicated `/client` route, not Command Center | PASS |
| Unique active user/org/CRM mapping, immutable from the client | PASS |
| Public signup remains disabled | PASS |
| Client role + active membership + active mapping + AAL2 | PASS |
| Owner/admin/employee/accountant/contractor cannot silently become clients | PASS |
| Explicit owner/admin AAL2 publish/unpublish | PASS |
| Archived records cannot be newly published | PASS |
| Unpublish removes portal access immediately | PASS |
| Publishing one record does not expose related records | PASS |
| Duplicate live publication prevention | PASS |
| No authenticated hard deletes | PASS |
| Allowlisted estimate/invoice/project/document fields only | PASS |
| No payment collection or payment button | PASS |
| Authenticated document stream; no public URL or storage path | PASS |
| Clients denied direct SELECT on sensitive base tables | PASS |
| Parameterless/validated SECURITY DEFINER reads; org from session | PASS |
| Same-organization client A vs client B isolation | PASS |
| Cross-organization isolation | PASS |
| AAL1 denial | PASS |
| Inactive membership/mapping denial | PASS |
| Signed-out redirect | PASS |
| Employee/accountant/contractor publication denial | PASS |
| Direct mutation and write-RPC denial | PASS |
| Sensitive-column REST probing denial | PASS |
| Sanitized `client_portal.published` / `.unpublished` / `.document_downloaded` audits | PASS |
| Isolated local SQL Day 1–9 | PASS |
| Isolated local Auth/REST Day 1–9 | PASS |
| Production-mode `next start` AAL2 Client Portal rendered (desktop + mobile) | PASS |
| Harmless local document download without logging contents or access URL | PASS |
| Sign-out protects portal routes and download | PASS |
| Persistence after local Supabase and production Next restart | PASS |
| ESLint zero warnings | PASS |
| Type-check | PASS |
| Vitest | PASS 169/169 |
| Production build | PASS |
| `vercel.json` unchanged | PASS |
| Vercel Preview unauthenticated → SSO | PASS (302 `https://vercel.com/sso-api`) |
| Merge / deploy / production client invite | Not done (blocked on purpose) |

## 2. Client portal functionality delivered

A separate invitation-only read-only portal at `/client`:

- Client-branded shell with STS Media navigation, gradient invoice/estimate presentation, and a persistent read-only banner
- Sections for published estimates, invoices, projects, and documents, including empty, loading, failure, and unmapped states
- Detail pages for estimates, invoices, and projects
- Authenticated document download through a Next.js server stream
- Owner/admin publication controls on existing estimates, invoices, projects, documents, and `/dashboard/client-portal`
- Sign-out clears the cookie session; `/client`, invoice routes, and document download then redirect to login
- Clients are bounced from `/dashboard` to `/client`; privileged roles are bounced away from `/client`

Payments, signatures, messaging, uploads, estimate acceptance, invoice issue/pay, publish, archive, restore, convert, and reconcile controls are absent from the client UI.

## 3. Exact fields exposed and withheld

| Record | Exposed | Withheld |
| --- | --- | --- |
| Estimate | `id`, `estimate_number`, `status`, `title`, `description`, `issue_date`, `expires_on`, `currency`, `customer_notes`, `terms`, org legal/display name, client business/contact name, integer-cent subtotal/discount/tax/total, `published_at`, line `line_position`, description, quantity, unit/discount/line-total cents | `internal_notes`, `client_email`, CRM notes, unpublished/archived siblings, related invoices/projects/documents |
| Invoice | `id`, `invoice_number`, `status`, `issue_date`, `due_date`, `currency`, org legal/display name, client business/contact name, integer-cent totals, `published_at`, line position/description/quantity/unit/line-total cents | `notes`, `payment_instructions`, `client_email`, payment accounts, hidden operational fields, payment buttons |
| Project | `id`, `name`, client-facing `description`, `status` (stage), `start_date`, `deadline`, `published_at` | `notes`, `budget_cents`, assignment, tasks, profit, audit rows |
| Document | `id`, title (`display_filename`), safe `description`, `content_type`, `byte_size`, `created_at`, `published_at` | `storage_path`, `uploaded_by`, public bucket URL, signed URL |
| Profile | organization display/legal name, client business/contact name | membership editing, email/phone from CRM internals |

## 4. Identity-mapping and publication model

`client_portal_identities`:

- Unique `(organization_id, user_id)`
- Partial unique `(organization_id, crm_client_id)` where `status = 'active'`
- Same-organization CRM client required
- Freeze trigger blocks org/user/CRM reassignment
- Owner/admin AAL2 can link or disable; clients cannot mutate the mapping
- Session requires `role = 'client'`, active membership, active mapping, AAL2

`client_portal_publications`:

- Unique `(organization_id, source_type, source_id)`
- Freeze trigger blocks org/client/source reassignment
- Live duplicate publish is rejected; unpublished rows may be republished by clearing `unpublished_at`
- Archived source rows cannot be newly published
- List/get functions require a live publication **and** `archived_at is null` **and** `source.client_id = mapping.crm_client_id`
- Publishing an invoice does not publish its estimate, project, or documents

## 5. Safe functions and RLS design

New tables have `FORCE ROW LEVEL SECURITY`. Authenticated/anon have no table GRANT for SELECT/INSERT/UPDATE/DELETE. Writes go through SECURITY DEFINER RPCs.

Read functions follow the Day 8 pattern:

- `SECURITY DEFINER`
- `set search_path = public`
- no dynamic SQL
- no client-supplied organization id
- organization and CRM client from `sts_client_portal_session()`
- allowlisted columns only
- `REVOKE ALL` from `public`/`anon`; `GRANT EXECUTE` to `authenticated` except `sts_client_portal_document_object_name(uuid)` which is service-role only

Client reads: `sts_client_portal_session`, `sts_client_portal_profile`, list/get estimates (plus lines), invoices (plus lines), projects, documents, `sts_client_portal_authorize_document`.

Owner/admin: identity list/candidates, link/disable, publication list, visibility, publish, unpublish.

## 6. Role/permission matrix

| Actor | `/client` | Publish/unpublish | Client read RPCs | Base-table SELECT |
| --- | --- | --- | --- | --- |
| Client AAL2 + active mapping | yes, own published rows | deny | own org + CRM client only | deny / zero |
| Client AAL1 | deny | deny | deny | deny / zero |
| Inactive membership or mapping | deny | deny | deny | deny / zero |
| Owner / administrator AAL2 | bounced to Command Center | yes, same org | cannot impersonate client session | unchanged staff rules |
| Employee / accountant / contractor | deny | deny | deny | unchanged Day 8 rules |
| Signed out / anon | login redirect | deny | deny | deny |
| Cross-org owner or client | deny | deny | deny | deny |

## 7. Client-A versus client-B and cross-org results

Isolation SQL and Auth/REST both passed:

- Client A AAL2 listed only North Client published invoices/estimates/projects/documents
- Client A could not get client B invoice by id, read East Client identity, or authorize client B’s document
- Client B could not read North Client invoices and still saw its own published invoice
- Org B client could not list org A published invoices
- Org B owner could not publish org A invoices
- Owner A could not use `sts_list_client_portal_invoices()` as a silent client impersonation path

## 8. Document security results

| Check | Result |
| --- | --- |
| User JWT authorize RPC returns filename/type/size only | PASS |
| Object name granted only to service_role | PASS |
| Next.js streams bytes after authorize + ownership/org/client/publication/archive checks | PASS |
| No `signedUrl` / `createSignedUrl` in the client download route | PASS |
| List RPC does not expose `storage_path` | PASS |
| Headed download returned an attachment from the app origin, not `/storage/` | PASS |
| Contents and access URL not logged | PASS |
| Signed-out download redirected or denied | PASS |
| `client_portal.document_downloaded` audit stores type/result only | PASS |

## 9. Publication/audit results

- Owner AAL2 published and unpublished invoices; admin published then unpublished an estimate
- Employee, accountant, contractor, and client publish/unpublish denied
- Duplicate live publication rejected
- Archived estimate could not be newly published; archiving removed portal access
- Unpublishing removed the invoice from the client list immediately
- Audit actions present: `client_portal.published`, `client_portal.unpublished`, `client_portal.document_downloaded`
- Audit metadata checks found no storage paths, payment instructions, internal notes, or URLs

## 10. Real AAL2 desktop/mobile browser results

Production `next start` on `http://127.0.0.1:3000` (`NODE_ENV=production`, demo mode false) with a disposable local client:

| Flow | Result |
| --- | --- |
| Sign in through `/login?next=/client` | PASS |
| TOTP challenge to AAL2 | PASS |
| `/client` full document with `data-surface="client"` | PASS (headed Chrome) |
| Published invoices + empty estimates/projects + published document | PASS |
| Read-only / unavailable-capabilities copy | PASS |
| No mutation controls | PASS |
| Invoice presentation: STS branding, purple-to-blue hero, From/To, line items, integer-cent totals, number/dates/status | PASS |
| Authenticated document download | PASS |
| `/dashboard` bounces to `/client` | PASS |
| Mobile layout + menu | PASS |
| Sign out, then `/client`, invoice route, and download redirect to login | PASS |

Screenshots (email redacted in-page before capture): `client_portal_desktop.png`, `client_portal_invoice_desktop.png`, `client_portal_mobile.png`, `client_portal_signed_out_login.png`. Recording: `day9-client-portal-aal2.mp4`.

## 11. Persistence and regression totals

| Check | Result |
| --- | --- |
| isolated local `db reset` through Day 9 migration | PASS `DAY9_LOCAL_SUPABASE_VERIFY_PASSED` |
| Day 1–9 SQL | PASS |
| Day 1–9 Auth/REST | PASS |
| Persist after Docker DB/Auth/REST restart and production Next restart | PASS (invoice row + publication row remain) |
| ESLint `--max-warnings 0` | PASS |
| `tsc --noEmit` | PASS |
| Vitest | PASS **169/169** (34 files) |
| `next build` | PASS including `/client`, invoice/estimate/project pages, and `/client/documents/[id]/download` |
| `vercel.json` sha256 | `212ced7130515fb7925078dac17826205bea0e9d875ecaeacfb440237ea1e61d` (`main` true, `*` false) |

## 12. Changed files and commits

Day 9 commits on `cursor/sts-business-os-day9-client-portal-a5ed` after Day 8 `9b1e67b`:

- `f605b8e` Add a read-only invitation-only client portal on Day 9
- `90ae404` Fix Day 9 client portal SQL identifier collisions
- `7a3c67c` Harden Day 9 Auth, lint, and UI verification harnesses
- plus the headed-UI enroll import and this verification log

Primary added files: `supabase/migrations/20260920200000_day9_client_portal.sql`, `supabase/tests/day9_isolation_runtime.sql`, `src/app/client/**`, `src/components/client/**`, `src/lib/org/client-portal*.ts`, `scripts/verify-day9-*`. `vercel.json` is not in the diff.

## 13. Draft PR and stacked base

Draft PR #13: `https://github.com/StsCeo/STS-Media-OFFCL-WEBSITE/pull/13`

- Head: `cursor/sts-business-os-day9-client-portal-a5ed`
- Base: `cursor/sts-business-os-day8-accountant-read-center-a5ed` / PR #12
- Not merged. Not promoted. Not deployed from this agent.

## 14. Vercel protection result

`vercel.json` remains `{ "main": true, "*": false }`. GitHub still recorded Preview deployments for the Day 9 commits, matching the Day 8 observation. Unauthenticated GET of those Preview hosts returned **302** to `https://vercel.com/sso-api` (Vercel Authentication). No bypass link, protection exception, or production promotion was created.

## 15. Remaining gaps and production blockers

- Public invitation delivery, email/SMS, and production client identities were not built (explicit exclusions)
- Mapping is owner-created against disposable local Auth users only
- No payments, Stripe, refunds, banking, e-sign, messaging, uploads, public links, payroll, tax, or QuickBooks
- GoTrue may not immediately revoke JWTs after logout (Day 1 GAP); cookie session clearing still protects app routes
- GitHub/Vercel still creates Preview deployments despite `vercel.json`; Preview SSO must stay enabled
- Production Supabase, production client invites, merge, and deploy were not performed

## 16. Review/merge safety verdict

Safe to review as a stacked draft on Day 8 / PR #12. **Do not merge, promote, or deploy.** Day 8 / PR #12 also remains unmerged. Day 10 was not started. Isolated local verification passed; production cutover is blocked until invitation delivery, production identities, Preview isolation, and owner go-live review exist outside this task.
