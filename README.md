# Scars to Stars Media

Public website for [stsmedia.co](https://stsmedia.co) and the private **STS Media Command Center** / Business OS.

This repository started as an empty README-only project. Phase 1 and Day 1 run on Next.js 16, React 19, TypeScript, Tailwind CSS v4, and a Supabase-ready schema. Live chrome is the locked **Day** / **Night** pair (not the lookbook palettes). Working demo data is labeled draft/demo. No integration is shown as connected without credentials.

## Implementation plan

### Phase 1 (this release)

- Public marketing site
- State Collision Pro case study (editable, no invented results)
- Invite-only authentication screens and route protection
- Command Center shell with working sidebar
- Overview, expenses, revenue, CRM, projects, calendar, content studio, brand settings
- Relational SQL migrations and RLS policies
- Demo workspace when Supabase env vars are absent (`NEXT_PUBLIC_ENABLE_DEMO_MODE=true`)

### Phase 2

- Stripe, Gmail, Google Calendar, Calendly, Zoom, GitHub, Vercel, analytics
- Automated reminders
- Secure report share links and accountant email delivery

### Phase 3

- Team approval workflows
- Social publishing
- AI-assisted briefings and forecasting

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Sign in to the Command Center with **Explore demo workspace** while `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` and `DEMO_SESSION_SECRET` is set (32+ characters). Disable demo mode in production. There is no default production password and no hidden auth bypass.

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Connect Supabase

1. Create a project at supabase.com.
2. Disable public signup (Authentication → Providers → Email → Confirm email, disable new user signups / allow only invites).
3. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel and `.env.local`.
4. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never expose it to the browser.
5. Apply migrations **only to a disposable local stack or an approved non-production project**:
   - Local Docker setup: `docs/day-1-local-supabase-setup.md`
   - Normal `npx supabase db reset` applies every timestamped file, including legacy `20260911120000_init.sql` first. That file is not the live model, but it is not skipped.
   - Phase 1 owner OS: `supabase/migrations/20260912060000_phase1_owner_os.sql`
   - Day 1 organization foundation: `supabase/migrations/20260918134000_business_os_org_foundation.sql`
   - Day 1 hardening: `supabase/migrations/20260919033000_day1_audit_result_and_rls_hardening.sql`
   - Settings RPC: `supabase/migrations/20260919041000_day1_settings_save_transaction.sql`
   - Legacy init compatibility + RPC guards: `supabase/migrations/20260919053000_day1_legacy_init_compat_and_rpc_guards.sql`
   - Day 2 membership gate: `supabase/migrations/20260919120000_day2_membership_owner_gate.sql`
   - Day 2 CRM leads/clients: `supabase/migrations/20260919123000_day2_crm_leads_clients.sql`
   - Day 3 finance/operations: `supabase/migrations/20260920120000_day3_finance_operations.sql` and `20260920121000_day3_finance_operations_rpcs.sql`
   - Day 4 workspace/invoices: `supabase/migrations/20260920140000_day4_workspace_tools.sql` through `20260920150000_day4_aal2_session_gate.sql`
   - Day 5 estimates: `supabase/migrations/20260920160000_day5_estimates.sql`, `20260920161000_day5_estimates_rpcs.sql`, `20260920162000_day5_estimates_no_hard_delete.sql`
   - Day 6 conversion and print: `supabase/migrations/20260920170000_day6_estimate_to_invoice.sql`
   - Do not apply Day 2 or later to production until an active owner membership exists and each prior day is reviewed.
6. Create private storage buckets `receipts` and `documents`. Do not create a public `client-files` bucket.
7. Auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - `http://localhost:3000/invite/accept`
   - `http://localhost:3000/mfa/verify`
   - `http://localhost:3000/mfa/enroll`
   - the same paths on `https://stsmedia.co`
8. Invite the owner user. Require TOTP MFA for owner/admin.
9. Invite-only: do not enable “allow new users to sign up”.

## Connect Vercel

1. Import this GitHub repository.
2. Set the environment variables from `.env.example` (values only in the Vercel dashboard).
3. Production domain: `stsmedia.co`.
4. Set `NEXT_PUBLIC_ENABLE_DEMO_MODE=false` in production.
5. Set `NEXT_PUBLIC_SITE_URL=https://stsmedia.co`.

## Integrations

| Integration | Phase 1 status |
| --- | --- |
| Public site, contact form, demo data | Functional |
| Expense / revenue / CRM / projects / calendar / content | Functional against workspace data |
| Supabase Auth / database / storage | Needs credentials |
| Stripe, Gmail, Calendar, Calendly, Zoom, GitHub, Vercel, analytics | Needs setup (Phase 2) |
| Spaceship | Secure quick link until a supported API is verified |
| Social publishing | Coming soon (Phase 3) |

## Security notes

- No secrets in source, logs, or ordinary localStorage
- Signed HTTP-only demo cookie for local exploration only (`DEMO_SESSION_SECRET` stays server-side)
- Rate limits on login, OTP, and contact
- Generic auth errors
- Legal pages are placeholders for professional review
- Tax labels are not tax advice
- Client passwords and API keys must never be stored in ordinary fields — only a vault location reference
