# Scars to Stars Media

Public website for [stsmedia.co](https://stsmedia.co) and the private **STS Media Command Center**.

This repository started as an empty README-only project. Phase 1 is implemented on Next.js 16, React 19, TypeScript, Tailwind CSS v4, and a Supabase-ready schema. The live brand color system is **Charcoal Sage** (charcoal field, sage and white paper, Celsius blue on charts). Working demo data is labeled draft/demo. No integration is shown as connected without credentials.

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

Sign in to the Command Center with **Explore demo workspace** while `NEXT_PUBLIC_ENABLE_DEMO_MODE=true`. Disable that flag in production. There is no default production password and no hidden auth bypass.

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
5. Run `supabase/migrations/20260911120000_init.sql`.
6. Create private storage buckets `receipts` and `client-files`.
7. Auth redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`
   - `http://localhost:3000/invite/accept`
   - `http://localhost:3000/mfa/verify`
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
- HTTP-only demo cookie for local exploration only
- Rate limits on login, OTP, and contact
- Generic auth errors
- Legal pages are placeholders for professional review
- Tax labels are not tax advice
- Client passwords and API keys must never be stored in ordinary fields — only a vault location reference
