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
| Hosting (intended) | Vercel + domain `stsmedia.co` | No `vercel.json` in repo; project settings live in the Vercel dashboard. |

**Day 1 baseline (before these changes):** `npm run lint` exited 0 with one existing unused-import warning in `src/lib/phase1-acceptance.test.ts`; `npm run typecheck`, `npm test` (78 tests), and `npm run build` passed.

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

Live chrome ignores the saved lookbook palette. Sun / Moon in the public header, auth shell, and Command Center writes `sts_theme` (`light` = Day, `dark` = Night) for a year. A blocking script in the root layout reads that cookie before paint so Night does not flash Day. Lookbook preview cookies still override for an hour.

- **Day (`sts-day`)**: page `#F8F7FC`, type `#20202B`, buttons `#7047EB` / hover `#5B35D4`, selected nav `#EDE6FF`, blue `#2563EB` only on chart lines and links.
- **Night (`midnight-navy`)**: navy field `#0B1020`, cream type, violet actions.

## 4. Authentication flow

1. Browser hits `/login`.
2. If `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` and `DEMO_SESSION_SECRET` (32+ chars) is set, “Explore demo workspace” signs an HTTP-only cookie (`sts_demo_session`). Demo mode must be `false` in production.
3. If Supabase is configured, password / OTP / magic-link go through Supabase Auth. Public signup must stay disabled (invite-only).
4. `src/proxy.ts` blocks `/dashboard` unless a verified demo cookie or a Supabase auth cookie is present.
5. `getSession()` then `canAccessDashboard()` require:
   - a session user
   - `role === "owner"`
   - email on the `OWNER_EMAIL` allowlist (default documented mailbox is configured by env, not hardcoded into Day 1 SQL)
   - MFA verified, except demo sessions
6. Server actions that mutate workspace data call `assertSameOrigin()` and `requireOwnerWrite()`.
7. Sign-out and idle expiry clear the demo cookie and call Supabase `signOut` when configured.

Day 1 adds organization role metadata on the session (`organizationId`, `organizationRole`, `membershipStatus`) and a permission matrix. It does **not** open the dashboard to accountants, employees, contractors, or clients. Those roles are denied by default until memberships exist and owner approval is given to invite them.

## 5. Database architecture

Portability rule: standard PostgreSQL, numbered SQL migrations in `supabase/migrations/`, no vendor lock-in beyond documented env vars and replaceable providers.

### 5.1 Phase 1 live owner schema (`os_*`)

Owner-scoped tables keyed by `owner_id` → `auth.users`. Integer cents. RLS: `owner_id = auth.uid() and public.is_phase1_owner()`. Known risk: `is_phase1_owner()` currently compares JWT email to a hardcoded mailbox. Replacing that function with `OWNER_EMAIL` / membership checks requires owner approval (see §15).

### 5.2 Day 1 Business OS tenant schema

Migration `supabase/migrations/20260918134000_business_os_org_foundation.sql` is **additive**. It does not drop `os_*` tables or rewrite historical documents.

| Table | Purpose |
| --- | --- |
| `organizations` | Tenant: legal name, display name, slug, base currency, timezone, fiscal-year start month |
| `organization_members` | `user_id` + role + status (invited / active / disabled / removed) |
| `business_settings` | Invoice / estimate prefixes, default payment terms, structured brand and notification JSON |
| `audit_events` | Who / what / when / entity + sanitized metadata JSON |

UUID primary keys. Every organization-owned row includes `organization_id`.

If the legacy `organizations` table from the unused init migration already exists, the Day 1 migration adds missing columns instead of creating a duplicate tenant table.

**Application persistence (honest):** Phase 1 still reads/writes the in-memory workspace. Day 1 organization settings follow the same pattern (`src/lib/org/store.ts`) so the public site and owner tools keep working before the migration is applied to a live Supabase project. Wiring these tables to Supabase from the Next.js app is a later-day task after credentials exist.

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

Phase 1 `canAccessDashboard()` remains owner-only so existing invite-only behavior is preserved.

## 9. Planned financial-data model

Not implemented on Day 1. Future organization-owned ledgers should:

- Store money as integer **cents** (already the Phase 1 `os_transactions` convention)
- Include `organization_id` on every row
- Separate invoices, payments, expenses, payroll, and tax **records** from filings
- Treat unpaid invoices as not cash
- Keep Stripe / QuickBooks / payroll provider ids as opaque references only
- Never store PAN, CVV, banking passwords, EINs, or SSNs
- Apply invoice/estimate prefixes to **new** documents only

Command Center does not calculate revenue, profit, tax, or payroll totals until those organization ledgers exist. Existing Phase 1 finance pages remain available as workspace tools and stay labeled as such.

## 10. Security boundaries

- Dashboard layout + proxy: signed-out users cannot use private routes.
- Owner allowlist + `canAccessDashboard`: non-owners cannot use owner routes.
- Permission helper `canAccessOrganizationResource`: cross-org requests fail.
- RLS enabled **and forced** on the four Day 1 tables; policies use `security definer` membership helpers to avoid recursive RLS.
- No `using (true)` authenticated-wide policies on Day 1 tables.
- `sts_record_audit_event()` stamps `actor_user_id = auth.uid()` and strips secret-like JSON keys.
- Server actions return generic errors; dashboard `error.tsx` does not render `error.message`.
- CSP, frame denial, HSTS in production, and `poweredByHeader: false` remain in `next.config.ts`.

Manual SQL isolation plan: `supabase/tests/org_isolation.sql`.

## 11. Integration boundaries

| Integration | Day 1 status |
| --- | --- |
| Stripe charges / webhooks | Env names reserved; **not activated** |
| Gmail / Google Calendar / Calendly / Zoom | Env names reserved; not activated |
| GitHub / Vercel APIs | Env names reserved; not activated |
| Analytics | `NEXT_PUBLIC_ANALYTICS_ID` unused until approved |
| QuickBooks / tax filing / payroll processors / e-sign | **Out of scope; do not enable** |
| Spaceship | Secure quick link only |

## 12. Backup and portability

- Owner JSON backup remains at `/dashboard/export` (Phase 1 workspace).
- Schema lives in ordinary `.sql` migrations that can be applied to any Postgres 15-compatible host.
- Replace Supabase Auth later by swapping the session adapter; keep membership tables on Postgres.
- Do not rely on dashboard-only UI as the system of record once Postgres writes are connected.
- Demo data must never be copied into production books.

## 13. Route map for the 18 sections

| # | Section | Route | Day 1 status |
| --- | --- | --- | --- |
| 1 | Command Center | `/dashboard` | Shell + honest placeholders; no calculated books |
| 2 | CRM & Sales | `/dashboard/crm` | Hub to existing leads/clients |
| 3 | Estimates & Proposals | `/dashboard/estimates` | Planned |
| 4 | Contracts & Signatures | `/dashboard/contracts` | Planned; e-sign not activated |
| 5 | Projects | `/dashboard/projects` | Existing Phase 1 |
| 6 | Invoices & Payments | `/dashboard/invoices` | Planned; Stripe not activated |
| 7 | Finance & Accounting | `/dashboard/finance` | Existing Phase 1 workspace tools |
| 8 | STS Sheets & Charts | `/dashboard/sheets` | Planned |
| 9 | Taxes | `/dashboard/taxes` | Existing checklist; not a filing product |
| 10 | Payroll & Contractors | `/dashboard/payroll` | Planned; payroll processing not activated |
| 11 | Documents & Receipts | `/dashboard/documents` | Existing Phase 1 |
| 12 | Calendar & Automations | `/dashboard/calendar` | Existing calendar; automations planned |
| 13 | Client Portal | `/dashboard/client-portal` | Planned staff view; public `/portal` unchanged |
| 14 | Accountant Center | `/dashboard/accountant` | Planned |
| 15 | Reports | `/dashboard/reports` | Existing Phase 1 |
| 16 | Integrations | `/dashboard/integrations` | Existing “needs setup” cards |
| 17 | Security & Ownership | `/dashboard/security` | Hub to existing security settings |
| 18 | Business Settings | `/dashboard/settings/business` | Day 1 org defaults + remaining Phase 1 profile |

Existing extra routes (inbox, tasks, notes, content studio, and so on) stay in the sidebar under **Workspace tools**.

## 14. Recommended implementation phases

1. **Day 1 (this checkpoint)** — Audit, architecture, org/role/RLS foundation, dashboard shell, Command Center shell, Business Settings + audit.
2. **Day 2** — Wire organization tables to Supabase (when credentials exist), provision the first owner membership, persist settings, add SQL integration tests against a branch database.
3. **CRM completion** — Organization-owned leads/clients/activities; no fake pipeline metrics.
4. **Commercial documents** — Estimates then invoices as drafts; prefixes from settings; no live charges.
5. **Projects + calendar automations** — Assigned-work rules for contractors.
6. **Documents/receipts on org-scoped storage**.
7. **Accountant read center** after a real accountant membership exists.
8. **Client portal** on a separate auth path.
9. **Integrations** only after owner approval, credentials, and a disconnect/revoke design.
10. **Payroll / tax filing / e-sign / QuickBooks** only as explicit later programs, never as silent add-ons.

## 15. Known risks

- Phase 1 `os_*` RLS helper hardcodes an owner email in SQL. Day 1 policies do not repeat that. Changing the Phase 1 helper needs owner approval.
- Phase 1 and Day 1 still use in-memory persistence until Supabase writes are wired. Data resets on server restart. Do not treat demo totals as filed books.
- Legacy `20260911120000_init.sql` must not be applied as the live model. If it was already applied in an environment, Day 1 extends `organizations` instead of dropping it.
- Opening the dashboard to non-owner roles without memberships and RLS-backed queries would leak workspace data. Day 1 keeps the owner gate.
- `OWNER_EMAIL` default in `.env.example` documents the production mailbox name; production must set the env var explicitly.
- Applying Day 1 SQL to production is safe only as an additive migration; still requires a backup first.

## 16. Decisions that still require owner approval

- Applying migrations to the production Supabase project
- Inviting any non-owner membership (administrator, accountant, employee, contractor, client)
- Replacing `is_phase1_owner()` hardcoded email comparison
- Connecting Stripe, payroll, tax filing, e-sign, QuickBooks, Gmail, Calendar, analytics, or Turnstile
- Storing any government identifier or bank account (even encrypted)
- Changing the owner allowlist
- Enabling public signup
- Treating demo/workspace ledgers as production accounting

## 17. Environment-variable names (no values)

Required for local demo: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ENABLE_DEMO_MODE`, `DEMO_SESSION_SECRET`.

Required for real auth/persistence: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `OWNER_EMAIL`.

Reserved, unused on Day 1: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `VERCEL_API_TOKEN`, `SPACESHIP_DASHBOARD_URL`, `NEXT_PUBLIC_ANALYTICS_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
