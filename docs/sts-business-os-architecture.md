# STS Business OS — Architecture (Day 1)

This document is the Day 1 foundation audit and architecture checkpoint for the Scars to Stars Media public website and private Business OS. It records what already exists, what Day 1 added, and what still requires owner approval. It is not a license to activate payments, payroll, tax filing, e-sign, or third-party accounting sync.

## 1. Current technology stack

| Layer | Choice | Notes |
| --- | --- | --- |
| App framework | Next.js **16.3.4** (App Router) | `src/app`. Request interception uses `src/proxy.ts` (Next.js 16 `proxy` convention; `middleware` is deprecated). |
| UI | React **19.2.8** | Server Components by default; client islands for shell, forms, and auth. |
| Language | TypeScript **5**, `strict` | Path alias `@/*` → `src/*`. |
| Package manager | **npm** (`package-lock.json`) | Do not switch managers in this repo without owner approval. |
| Styling | Tailwind CSS **v4** + CSS variables in `src/app/globals.css` | Locked appearances: **Day** (`sts-day`, soft white `#F8F7FC`, charcoal type `#20202B`, purple buttons `#7047EB`, lavender selection `#EDE6FF`, blue `#2563EB` only on charts/links) and **Night** (`midnight-navy`). Cookie `sts_theme`. |
| Validation | Zod **4** | Server-side schemas for public forms and Day 1 business settings. |
| Auth / DB / storage | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) when configured | Phase 1 also runs an in-memory workspace when demo mode is on. |
| Charts | Recharts | Used by existing Phase 1 finance pages, not by the Day 1 Command Center totals. |
| Tests | Vitest **5** | `src/**/*.test.ts`, Node environment. |
| Lint | ESLint 9 + `eslint-config-next` | |
| Hosting (intended) | Vercel + domain `stsmedia.co` | `vercel.json` enables Git deployments on `main` only (`git.deploymentEnabled`: `main` true, `*` false). Other project settings live in the Vercel dashboard. |

**Day 1 baseline (this checkpoint):** recorded after inspect, repair, and verification. Commands and exit codes belong in the Day 1 completion report. Do not treat demo totals as filed books.

## 2. What already existed (reuse)

- Public marketing site under `src/app/(public)/` with chrome, legal, contact, work, packages, and trust pages.
- Invite-only owner authentication: password, email code, magic link, MFA screens, demo workspace cookie, owner allowlist via `OWNER_EMAIL`.
- Private Command Center at `/dashboard/*` gated by `src/proxy.ts` and `src/app/dashboard/layout.tsx`.
- Phase 1 owner operating tools: leads, clients, projects, tasks, calendar, income, expenses, finance, documents, notes, taxes, reports, integrations, brand, security, export.
- In-memory workspace (`src/lib/data/store.ts`) used as the live data plane for Phase 1 records.
- SQL:
  - `supabase/migrations/20260911120000_init.sql` — **legacy org / multi-role draft. Not the live production model.**
  - `supabase/migrations/20260912060000_phase1_owner_os.sql` — Phase 1 owner-only `os_*` tables, RLS by `owner_id = auth.uid()` plus `is_phase1_owner()`.
- Private storage buckets `receipts` and `documents` (Phase 1). Client-files bucket is intentionally not created.
- Security headers in `next.config.ts`, generic auth errors, rate limits, signed HTTP-only demo cookie.

## 3. Public versus private boundaries

| Surface | Location | Audience |
| --- | --- | --- |
| Public website | `src/app/(public)/*`, plus `/login` and other auth pages | Anyone |
| Private Business OS | `/dashboard/*` | Allowlisted owner (Phase 1 and Day 1) |
| Public `/portal` | Marketing page | Anyone; **not** an authenticated client portal |
| Future client portal | Planned at `/dashboard/client-portal` (staff view) and a later client-auth route | Clients must never use owner dashboard routes |

Day 1 does **not** change public routes, public navigation, or public copy. Private navigation was expanded to the 18-section Business OS map; existing Phase 1 pages remain routed under “Workspace tools.”

## 3.1 Locked Day / Night appearance

**Owner approved: keep these colors and this chrome.** Do not restyle the live Day / Night pair, public cards, or header control unless the owner asks.

Live chrome ignores the saved lookbook palette. The public header, auth shell, and Command Center write `sts_theme` (`light` = Day, `dark` = Night) for a year. A blocking script in the root layout reads that cookie before paint so Night does not flash Day. Lookbook preview cookies still override for an hour.

- **Day (`sts-day`)**: page `#F8F7FC`, type `#20202B`, buttons `#7047EB` / hover `#5B35D4`, selected nav `#EDE6FF`, blue `#2563EB` only on chart lines and links.
- **Night (`midnight-navy`)**: navy field `#0B1020`, cream type, violet actions.

## 4. Authentication flow

1. Browser hits `/login`.
2. Demo authentication is **local opt-in only**. It requires `NEXT_PUBLIC_ENABLE_DEMO_MODE=true`, a 32+ character `DEMO_SESSION_SECRET`, and a non-production runtime (`NODE_ENV` and `VERCEL_ENV` are not `production`). Production never issues, verifies, or honors demo cookies, including cookies issued earlier.
3. If Supabase is configured, password / OTP / magic-link go through Supabase Auth. Public signup must stay disabled (invite-only). Missing Supabase configuration in production returns `unconfigured` and denies `/dashboard`; it does not fall back to demo.
4. `src/proxy.ts` blocks `/dashboard` unless a verified demo cookie (local only) or a Supabase auth cookie **and** configured Supabase env names are present. A cookie whose name merely contains `-auth-token` is ignored when Supabase is unset.
5. `getSession()` then `canAccessDashboard()` require:
   - a session user
   - Demo: `role === "owner"` and the `OWNER_EMAIL` allowlist
   - Supabase: an **active** owner or administrator membership and trusted AAL2
6. Organization role and `organizationId` come from an **active** `organization_members` row when Supabase is configured. A missing membership stays signed in but cannot open the dashboard or read org data. An email allowlist is not the production authorization model.
7. Server actions that mutate workspace data call `assertSameOrigin()` and `requireOwnerWrite()`.
8. Sign-out and idle expiry clear the demo cookie and call Supabase `signOut` when configured.

Day 1 adds organization role metadata on the session (`organizationId`, `organizationRole`, `membershipStatus`) and a permission matrix. It does **not** open the dashboard to accountants, employees, contractors, or clients. Those roles are denied by default until memberships exist and owner approval is given to invite them.

## 5. Database architecture

Portability rule: standard PostgreSQL, numbered SQL migrations in `supabase/migrations/`, no vendor lock-in beyond documented env vars and replaceable providers.

### 5.1 Phase 1 live owner schema (`os_*`)

Owner-scoped tables keyed by `owner_id` → `auth.users`. Integer cents. RLS: `owner_id = auth.uid() and public.is_phase1_owner()`. Day 2 redefines `is_phase1_owner()` as an active owner or administrator membership for `auth.uid()`. It is no longer an email comparison. Production must have that membership before this function is deployed (see §15).

### 5.2 Day 1 Business OS tenant schema

Migration `supabase/migrations/20260918134000_business_os_org_foundation.sql` is **additive**. It does not drop `os_*` tables or rewrite historical documents.

| Table | Purpose |
| --- | --- |
| `organizations` | Tenant: legal name, display name, slug, base currency, timezone, fiscal-year start month |
| `organization_members` | `user_id` + role + status (invited / active / disabled / removed) |
| `business_settings` | Invoice / estimate prefixes, default payment terms, structured brand and notification JSON |
| `audit_events` | Who / what / when / **result** (`success` \| `failure` \| `denied`) / entity + sanitized metadata JSON |

UUID primary keys. Every organization-owned row includes `organization_id`.

Forward-only follow-up: `supabase/migrations/20260919033000_day1_audit_result_and_rls_hardening.sql` adds the audit `result` column, missing organization check constraints on legacy tables, `search_path` on remaining functions, membership self-elevation / last-owner guards, and a freeze on changing `organization_id`. `supabase/migrations/20260919041000_day1_settings_save_transaction.sql` adds `sts_save_business_settings()` so a settings update and its success audit commit together. `supabase/migrations/20260919053000_day1_legacy_init_compat_and_rpc_guards.sql` keeps a normal `db reset` honest when legacy `init.sql` created `organizations.name`, and rejects a null organization id in the RPC.

**Normal migration process:** `npx supabase db reset` applies every timestamped file in filename order. `20260911120000_init.sql` is **first** and is applied. It is not the live model. Day 1 files are additive (`IF NOT EXISTS` / `ADD COLUMN`). Do not claim the normal process passed while skipping `init.sql`. Local setup: `docs/day-1-local-supabase-setup.md`.

If the legacy `organizations` table from init.sql already exists, the Day 1 migrations add missing columns instead of creating a duplicate tenant table.

**Application persistence:**

- Local demo session (`source=demo`, demo mode on): in-memory `src/lib/org/store.ts`. Process restart loses demo org data.
- Configured Supabase session (`source=supabase`): PostgreSQL via the user-scoped client and `sts_save_business_settings`. Organization IDs come from the session membership. If the database is unavailable, the save returns a generic error and **does not** write the in-memory store.
- Day 2 CRM leads/clients persist through `sts_save_crm_*`.
- Day 3 expenses, revenue, projects, and tasks persist through `sts_save_ops_*` / `sts_archive_ops_*` on `ops_*` tables. Authenticated sessions cannot hard-delete those rows; archival is the supported removal path. Demo sessions stay in-memory.
- Day 4 notes, documents, calendar events, and invoices persist through `sts_save_ws_*` / archive / issue / pay / void RPCs. Invoice money is integer cents with server-calculated totals. Private files use the `org-documents` bucket. Demo sessions stay in-memory.
- Day 5 estimates persist through `sts_save_ws_estimate` / `sts_set_ws_estimate_status` / archive / restore. Quote money is integer cents with server-calculated totals. Ready does not send email or store a PDF. Day 6 converts an accepted estimate through `sts_convert_ws_estimate_to_invoice` into one draft invoice. Demo sessions stay in-memory.
- Day 7 reconciles internal calendar rows for dated projects, tasks, estimates, and invoices through `sts_reconcile_ws_schedule` and source-row triggers. Owner/administrator may start one project from a converted invoice through `sts_start_project_from_invoice`. Demo sessions derive generated rows in memory.

Manual owner membership insert: `supabase/manual/provision-owner-membership.sql` (blocked until the owner supplies the Auth user UUID).

## 6. Storage architecture

| Bucket | Visibility | Status |
| --- | --- | --- |
| `receipts` | Private | Phase 1 |
| `documents` | Private | Phase 1 |
| `client-files` | — | Not created (intentional) |

Service-role keys stay server-side (`SUPABASE_SERVICE_ROLE_KEY`). Browser clients use the anon key only. Day 1 adds no new buckets and no public uploads.

## 7. Organization ownership model

- One Business OS tenant per organization row.
- The first owner membership must be inserted with the **service role** after the owner Auth user is invited. There is no “every authenticated user can create or see every organization” path.
- All future financial, CRM, file, and settings records must include `organization_id`.
- Cross-organization IDs are rejected in application permission checks and in RLS policies.
- Demo workspace uses a labeled local organization id for exploration only. It is not production books.

## 8. User and role model

Application roles for the Business OS:

`owner` · `administrator` · `accountant` · `employee` · `contractor` · `client`

Deny by default. Hidden navigation is not authorization.

| Role | Day 1 intent |
| --- | --- |
| owner | Full organization control, including security/ownership |
| administrator | Operate the org; **no** ownership transfer and **no** credential vault |
| accountant | Finance / taxes / reports / accountant center **read** of business settings; **no** security, credentials, integrations, or other orgs |
| employee | Delivery and CRM; not security, payroll credentials, or settings writes |
| contractor | Assigned work only |
| client | Own portal records only; never the owner dashboard |

Phase 1 `canAccessDashboard()` remains owner/administrator + AAL2 so existing invite-only dashboard behavior is preserved. Employees and accountants can still be authorized at RLS/REST **only after** the JWT `aal` claim is exactly `aal2`. Password sessions are AAL1 and may read own membership to reach MFA; they cannot read or mutate protected business records. Hidden navigation is not authorization.

Application helpers: `hasPermission`, `canAccessOrganizationResource`, `canAccessAssignedWork`, `canAccessClientRecord`, `canWriteMembership`. Members cannot change their own role or status. Only an owner may assign the owner role. Hidden navigation is not authorization.

## 9. Planned financial-data model

Day 3 persists organization-owned expense, revenue, project, and task records in `ops_*` tables using integer cents, forced RLS, and recoverable `archived_at`. Day 4 adds notes, private documents, internal calendar events, and invoices (`ws_*`) with the same archival rule. Day 5 adds customer estimates/quotes (`ws_estimates`) with integer-cent line items, a `draft → ready → accepted|declined|expired` lifecycle, and authorized restore. Day 6 adds an atomic accepted-estimate-to-draft-invoice conversion (`source_estimate_id`) and authenticated print views that use the browser print dialog. Day 7 adds an organization-scoped internal schedule (`sts_internal_schedule`) and idempotent generated calendar rows linked to the same-organization source. Invoice and estimate totals are calculated on the server in integer cents. Issued, paid, and ready statuses are recorded only; no processor, email, stored PDF, e-sign, or tax filing is connected. Dashboard and Finance totals from those ledgers are **operational estimates / operational invoice and quote records**, not formal accounting or tax reports.

Still later:

- Invoice PDF export, estimate send, contracts, recurrence, reminders, and malware scanning
- Keep Stripe / QuickBooks / payroll provider ids as opaque references only
- Never store PAN, CVV, banking passwords, EINs, or SSNs
- Apply invoice/estimate prefixes to **new** documents only

Command Center now shows operational estimates and Day 4 workspace summaries for the current organization when those records exist. Payments, payroll, tax filing, banking, Stripe, and QuickBooks are not implemented.

## 10. Server-side authorization

Deny by default. The browser never supplies a trusted role or organization id.

1. `src/proxy.ts` redirects signed-out requests away from `/dashboard`. A cookie named like a Supabase auth token is not enough by itself; `getSession()` still verifies the user.
2. `src/app/dashboard/layout.tsx` calls `getSession()` then `canAccessDashboard()`. Invalid sessions, non-owners, emails outside `OWNER_EMAIL`, and unverified MFA (except demo) redirect to login or MFA.
3. Mutating server actions call `assertSameOrigin()` and `requireOwnerWrite()`. Business Settings also calls `requireBusinessSettingsWrite()`, which checks `settings.business.write` against the **session** organization id (`sessionOrganizationId`).
4. `canAccessOrganizationResource` rejects missing membership, inactive membership, and cross-organization ids.
5. PostgreSQL `sts_session_is_aal2()` fail-closes unless the authenticated JWT `aal` claim is exactly `aal2` (or the caller is `service_role` for maintenance). `sts_has_organization_role()`, `is_phase1_owner()`, organization SELECT, audit writes, Day 1–7 RLS, SECURITY DEFINER RPCs, and `org-documents` Storage policies inherit that gate.
6. AAL1 remains able to authenticate, read **own** `organization_members` row, and complete MFA enrollment/verify. It cannot load CRM, finance, operations, notes, documents, calendar, invoices, settings, or audit rows.
7. Application clients use the session-bound anon key. `SUPABASE_SERVICE_ROLE_KEY` is server-only and is not shipped to the browser.
8. Roles and organization ids on forms, query strings, or localStorage are ignored.
9. Day 3 `ops_*` ledgers, Day 4 `ws_*` records, and Day 5 `ws_estimates` have no authenticated `DELETE` policy or grant. Application sessions archive through `sts_archive_*`. Day 5 estimates may be restored through `sts_restore_ws_estimate`. Day 6 conversion and Day 7 generated calendar rows do not add DELETE. `service_role` may delete for maintenance only and is never given to the browser.
10. MFA enrollment lists unfinished factors from `listFactors().all` (the Auth client keeps unverified TOTP out of `.totp`). Cancel unenrolls unverified factors only. Confirm sends well-formed codes to the Auth provider; `describeMfaAttempt(..., verifiedByProvider: false)` is not treated as a hard failure.

## 10.1 Row-level security

When the Day 1 migrations are applied to a non-production Postgres/Supabase database:

- RLS is **enabled and forced** on `organizations`, `organization_members`, `business_settings`, and `audit_events`.
- Policies use `sts_is_organization_member` / `sts_has_organization_role` (`SECURITY DEFINER`, `search_path = public`) so membership checks do not recurse. Day 4 closure adds `sts_session_is_aal2()` so role checks also require JWT `aal = aal2`.
- `USING` and `WITH CHECK` both require an active membership in **that** `organization_id`.
- There is no `USING (true)` policy and no grant that lets every authenticated user read every organization.
- `anon` / `public` have no table privileges. `authenticated` cannot `INSERT` organizations (first tenant is provisioned with the service role).
- `authenticated` cannot `INSERT`/`UPDATE`/`DELETE` `audit_events`. Members write through `sts_record_audit_event()`, which stamps `actor_user_id = auth.uid()` and a `result`.
- `sts_guard_membership_write` blocks self role/status changes and administrator assignment of `owner`.
- `business_settings` has INSERT/UPDATE policies only (no DELETE).
- Privileged clients (`SUPABASE_SERVICE_ROLE_KEY`) stay server-side and are never imported into Client Components.

`sts_save_business_settings` is `SECURITY DEFINER`. RLS on the tables does not protect that path. The control is `auth.uid()`, an active owner/administrator membership check, field validation, and a single transaction that rolls back if the audit insert fails. Execute is revoked from `public`/`anon` and granted to `authenticated`.

Until the migration is applied, the in-memory store enforces the same membership, cross-org, self-elevation, and audit-immutability rules in application code. Source review of the RPC is not a substitute for running `supabase/tests/day1_isolation_runtime.sql` as `anon` and `authenticated` on a disposable local stack.

## 10.2 Audit-event strategy

Every successful Business Settings save records an organization audit event with:

- who: `actor_user_id` from the session (never a client-supplied actor)
- what: `action` (for example `business_settings.updated`)
- when: `created_at`
- result: `success` | `failure` | `denied` (column plus sanitized metadata)
- organization: `organization_id`
- affected entity: `entity_type` + `entity_id`

Metadata is allowlisted by sanitizer: keys and values matching passwords, tokens, secrets, PAN/CVV, bank identifiers, EINs, SSNs, and similar are dropped. Failed saves record `result = failure` without the database error text. Audit rows are append-only; application helpers `updateOrganizationAuditEvent` / `deleteOrganizationAuditEvent` always deny. Prefix and terms changes apply to **new** documents only and never rewrite historical invoices or estimates.

## 10.3 Security and integration boundaries

- Dashboard layout + proxy: signed-out users cannot use private routes.
- Owner allowlist + `canAccessDashboard`: non-owners cannot use owner routes.
- Permission helper `canAccessOrganizationResource`: cross-org requests fail.
- Server actions return generic errors; dashboard `error.tsx` does not render `error.message`.
- CSP, frame denial, HSTS in production, and `poweredByHeader: false` remain in `next.config.ts`.
- Stripe, payroll, tax filing, e-sign, and QuickBooks remain env-name-only.

Manual SQL isolation plan: `supabase/tests/org_isolation.sql` (eight required scenarios in §18).

## 11. Integration boundaries

| Integration | Day 1 status |
| --- | --- |
| Stripe charges / webhooks | Env names reserved; **not activated** |
| Gmail / Google Calendar / Calendly / Zoom | Env names reserved; not activated |
| GitHub / Vercel APIs | Env names reserved; not activated |
| Analytics | `NEXT_PUBLIC_ANALYTICS_ID` unused until approved |
| QuickBooks / tax filing / payroll processors / e-sign | **Out of scope; do not enable** |
| Spaceship | Secure quick link only |

## 12. Backup, portability, and recovery

- Owner JSON backup remains at `/dashboard/export` (Phase 1 workspace). That export is a portability snapshot, not a substitute for Postgres backups once organization tables are live.
- Schema lives in ordinary `.sql` migrations that can be applied to any Postgres 15-compatible host.
- Recovery: restore from a Postgres backup / Supabase point-in-time recovery for applied migrations; restore the owner JSON export only into a **non-production** workspace. Demo data must never be copied into production books.
- Replace Supabase Auth later by swapping the session adapter; keep membership tables on Postgres.
- Do not rely on dashboard-only UI as the system of record once Postgres writes are connected.
- Applying Day 1 SQL to production requires owner approval and a backup first.

## 13. Route map for the 18 sections

| # | Section | Route | Day 1 status |
| --- | --- | --- | --- |
| 1 | Command Center | `/dashboard` | Shell + honest placeholders; no calculated books |
| 2 | CRM & Sales | `/dashboard/crm` | Hub to existing leads/clients |
| 3 | Estimates & Quotes | `/dashboard/estimates` | Day 5 quotes; Day 6 convert + print |
| 4 | Contracts & Signatures | `/dashboard/contracts` | Planned; e-sign not activated |
| 5 | Projects | `/dashboard/projects` | Day 3 organization ledger |
| 6 | Invoices & Payments | `/dashboard/invoices` | Day 4 operational invoices; Day 6 print |
| 7 | Finance & Accounting | `/dashboard/finance` | Day 3 operational estimates + existing definitions |
| 8 | STS Sheets & Charts | `/dashboard/sheets` | Planned |
| 9 | Taxes | `/dashboard/taxes` | Existing checklist; not a filing product |
| 10 | Payroll & Contractors | `/dashboard/payroll` | Planned; payroll processing not activated |
| 11 | Documents & Receipts | `/dashboard/documents` | Day 4 org-documents metadata + private bucket |
| 12 | Calendar & Automations | `/dashboard/calendar` | Day 7 internal schedule + generated entries |
| 13 | Client Portal | `/dashboard/client-portal` | Planned staff view; public `/portal` unchanged |
| 14 | Accountant Center | `/dashboard/accountant` | Planned |
| 15 | Reports | `/dashboard/reports` | Existing Phase 1 |
| 16 | Integrations | `/dashboard/integrations` | Existing “needs setup” cards |
| 17 | Security & Ownership | `/dashboard/security` | Hub to existing security settings |
| 18 | Business Settings | `/dashboard/settings/business` | Day 1 org defaults + remaining Phase 1 profile |

Existing extra routes (inbox, tasks, notes, content studio, and so on) stay in the sidebar under **Workspace tools**.

## 14. Recommended implementation phases

1. **Day 1 (this checkpoint)** — Audit, architecture, org/role/RLS foundation, dashboard shell, Command Center shell, Business Settings + audit.
2. **Day 2** — Replace email `is_phase1_owner()` with membership roles, private MFA enrollment, and persist CRM leads/clients. Settings persistence remains the Day 1 RPC.
3. **Day 3** — Persist expenses, revenue, projects, and tasks with organization-scoped RLS, audit, and operational estimates.
4. **Day 4** — Persist notes, private documents, internal calendar, and invoices as operational records. No live charges, email, or external calendar sync.
5. **Day 5** — Persist customer estimates/quotes as operational records. No email send, stored PDF, e-sign, contracts, or payments.
6. **Day 6** — Convert an accepted estimate into one draft invoice and add authenticated print views that use the browser print dialog. No email, stored PDF, e-sign, public document URLs, or payment collection.
7. **Day 7** — Unified internal schedule and idempotent generated calendar rows for dated projects, tasks, estimates, and invoices. Explicit owner/admin project kickoff from a converted invoice. No external calendar sync, email, cron, or reminders.
8. **Accountant read center** after a real accountant membership exists.
9. **Client portal** on a separate auth path.
10. **Integrations** only after owner approval, credentials, and a disconnect/revoke design.
11. **Payroll / tax filing / e-sign / QuickBooks / stored invoice PDF** only as explicit later programs, never as silent add-ons.

## 15. Known risks

- Phase 1 `os_*` tables are now gated by active owner/administrator membership (`is_phase1_owner()`). Deploying that change before a production owner membership exists locks the owner out.
- Demo organization settings stay in-memory. Configured Supabase sessions write through `sts_save_business_settings`. Those migrations **have been applied to the disposable local `sts-media` stack** in this Cloud Agent VM. They have **not** been applied to production.
- Legacy `20260911120000_init.sql` is first in the timestamped sequence and **is applied** by a normal `db reset`. It is not the live model. Day 1 extends `organizations` instead of dropping it.
- Opening the dashboard to non-owner roles without memberships and RLS-backed queries would leak workspace data. Day 1 keeps the owner gate.
- `OWNER_EMAIL` default in `.env.example` documents the production mailbox name; production must set the env var explicitly.
- Applying Day 1 SQL to production is safe only as an additive migration; still requires a backup first.

## 16. Decisions that still require owner approval

- Applying migrations to the production Supabase project
- Inviting any non-owner membership (administrator, accountant, employee, contractor, client)
- Applying the Day 2 membership-gate migration to production before an active owner membership exists (see `supabase/manual/provision-owner-membership.sql`)
- Connecting Stripe, payroll, tax filing, e-sign, QuickBooks, Gmail, Calendar, analytics, or Turnstile
- Storing any government identifier or bank account (even encrypted)
- Changing the owner allowlist
- Enabling public signup
- Treating demo/workspace ledgers as production accounting
- Changing the locked Day / Night colors or public comfort-mix chrome

## 17. Environment-variable names (no values)

Required for local demo: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ENABLE_DEMO_MODE`, `DEMO_SESSION_SECRET`.

Required for real auth/persistence: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `OWNER_EMAIL`.

Reserved, unused on Day 1: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `VERCEL_API_TOKEN`, `SPACESHIP_DASHBOARD_URL`, `NEXT_PUBLIC_ANALYTICS_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.

## 18. Tenant-isolation testing plan

This Cloud Agent environment now has a disposable local Supabase stack (`project_id = "sts-media"`). Application-layer Vitest still covers in-memory and mocked sessions. Executable SQL is `supabase/tests/day1_isolation_runtime.sql`, `supabase/tests/day2_isolation_runtime.sql`, `supabase/tests/day3_isolation_runtime.sql`, `supabase/tests/day4_isolation_runtime.sql`, `supabase/tests/day4_aal2_runtime.sql`, `supabase/tests/day5_isolation_runtime.sql`, and `supabase/tests/day6_isolation_runtime.sql` (executed locally as `anon` / `authenticated`). The manual plan remains in `supabase/tests/org_isolation.sql`. Setup notes: `docs/day-1-local-supabase-setup.md`. Evidence: `docs/day-1-foundation-verification.md`, `docs/day-2-hardening-verification.md`, `docs/day-3-finance-operations-verification.md`, `docs/day-4-workspace-invoicing-verification.md`, `docs/day-5-estimates-verification.md`, `docs/day-6-commercial-workflow-verification.md`, and `docs/vercel-preview-safety.md`.

| # | Scenario | Application evidence | SQL evidence (after migrations on a branch DB) |
| --- | --- | --- | --- |
| 1 | Signed-out users cannot read private records | `auth-security.test.ts` (proxy + `getSession` + settings action) | anon `SELECT` denied / 0 rows |
| 2 | Organization A members can access permitted Organization A data | owner settings save + audit in `foundation.test.ts` / `settings-action.test.ts` | org A owner sees org A settings |
| 3 | Organization A members cannot read Organization B data | `listMembersForOrganization` / `listAuditEventsForOrganization` return empty for org B | `SELECT` org B = 0 |
| 4 | Organization A members cannot insert Organization B records | cross-org `updateOrganizationBusinessSettings` throws | `INSERT` settings for org B fails |
| 5 | Members cannot elevate their own roles | `canWriteMembership` + `changeOrganizationMemberRole` | `sts_guard_membership_write` rejects self `role = owner` |
| 6 | Non-owners cannot perform owner-only actions | `canAccessDashboard` rejects client/accountant; accountant lacks `security.ownership` | accountant cannot `UPDATE organizations` or read audit |
| 7 | Unauthorized users cannot modify audit events | `updateOrganizationAuditEvent` / `deleteOrganizationAuditEvent` always deny; no INSERT grant | no INSERT/UPDATE/DELETE policy on `audit_events` |
| 8 | Service-role credentials never reach the browser | `src/lib/supabase/browser.ts` uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` only; acceptance test rejects `SUPABASE_SERVICE_ROLE` in serialized client config | n/a (bundle grep) |

