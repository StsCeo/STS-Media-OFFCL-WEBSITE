# Day 1 foundation verification

This report is the evidence log for the STS Business OS Day 1 checkpoint after isolated local Supabase verification. It does not claim production readiness.

**Verdict: DAY 1 PARTIALLY COMPLETE — isolated local database, RLS, and Auth data-plane PASS; in-app settings save still blocked by MFA**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated.

## 1. Files created and modified this continuation

- `supabase/tests/day1_isolation_runtime.sql` (runtime RLS assertions)
- `scripts/verify-day1-local-supabase.sh`
- `scripts/verify-day1-local-auth.py`
- `docs/day-1-foundation-verification.md`
- `docs/sts-business-os-architecture.md`

Earlier Day 1 source on this tree is preserved (public pages, auth, locked Day/Night colors). `.env.local` now points at **local** Supabase for this VM and remains gitignored.

## 2. Database setup (no secret values)

| Question | Finding |
| --- | --- |
| Supabase configuration | Local `config.toml` present. This VM’s `.env.local` now has local URL/key **names** set (values not recorded). No `.supabase` remote link. |
| Configured target | **Local / disposable.** API and DB containers named `*_sts-media`. |
| Isolated test DB | **Yes**, after installing Ubuntu `docker.io` in this Cloud VM (the agent host had no Docker Desktop socket). Nested-engine ICC required `net.bridge.bridge-nf-call-iptables=0`. |
| Production | Untouched. |

## 3. Migrations applied (local only)

`npx supabase db reset --yes` exit 0. Order actually applied:

1. `20260911120000_init.sql` (legacy draft; **not skipped**)
2. `20260912060000_phase1_owner_os.sql`
3. `20260918134000_business_os_org_foundation.sql`
4. `20260919033000_day1_audit_result_and_rls_hardening.sql`
5. `20260919041000_day1_settings_save_transaction.sql`
6. `20260919053000_day1_legacy_init_compat_and_rpc_guards.sql`

## 4. RLS results (authenticated / anonymous, not superuser proof)

`day1_isolation_runtime.sql` via `psql` inside `supabase_db_sts-media` as `anon` / `authenticated` impersonation. Ended with `DAY1_ISOLATION_RUNTIME_PASSED`.

Passed: anon denied; owner A allowed; owner B cannot read/write org A; org-id freeze; no self-promotion; inactive denied; accountant/client/contractor restrictions; audit insert denied and update/delete wrote 0 rows with the pre-tamper row still present; invalid RPC leaves prefix unchanged; forged org RPC denied; owner A RPC save stamps `actor_user_id = auth.uid()` and `result = success`.

Postgres contrast count of 2 was recorded only as a contrast, not as RLS proof.

## 5. Real Auth / REST (not mocked, not demo)

`scripts/verify-day1-local-auth.py` → `DAY1_LOCAL_AUTH_REST_PASSED`.

- Wrong password rejected
- owner A / owner B / stranger password login succeeded
- Anon REST denied or empty
- Owner A sees one org; cannot read org B
- Owner B cannot read org A
- Stranger sees zero orgs
- Owner A REST RPC save succeeded; cannot save org B (HTTP 400)
- Stranger cannot save org A (HTTP 400)
- GoTrue logout succeeded
- **GAP:** an already-issued access token still read org rows after logout (JWT expiry, not cookie clearing)

App HTTP against `next dev :3000` with local Supabase and demo flag false:

- `GET /` 200
- `GET /login` 200, no demo button
- Signed-out `GET /dashboard` 307 `/login`
- Signed-out settings POST 307 `/login`
- Real allowlisted local password login + `sb-127-auth-token` cookie: dashboard 307 `/mfa` (session recognized; no TOTP enrolled)
- After GoTrue logout, same cookie: dashboard 307 `/login`

**Not done:** completing Business Settings through the HTML form, because MFA blocks `/dashboard`. The same RPC the app calls was proven over REST and SQL.

## 6. Settings and audit after Node restart

Before restart: invoice prefix `STSX`; 2 success `business_settings.updated` audit rows for the test org.

After killing and restarting `next dev`: prefix still `STSX`; audit count still 2; owner A REST still returns `STSX`.

## 7. Commands

| Command | Exit | Notes |
| --- | --- | --- |
| `npx supabase start` (after ICC fix) | 0 | Local Auth/DB/REST healthy |
| `npx supabase db reset --yes` | 0 | All six migrations applied locally |
| Isolation SQL | 0 | `DAY1_ISOLATION_RUNTIME_PASSED` |
| `python3 scripts/verify-day1-local-auth.py` | 0 | `DAY1_LOCAL_AUTH_REST_PASSED` |
| `npm run lint` | 0 | 1 pre-existing unused-var warning |
| `npm run typecheck` | 0 | |
| `npm test` | 0 | **114** tests, 25 files (unit + mocked) |
| `npm run build` | 0 | Next.js 16.3.4 |

## 8. Remaining gaps

1. In-app Business Settings form was not submitted (MFA required; no TOTP on the synthetic local owner).
2. Access tokens are not revoked immediately on GoTrue logout; the Next.js cookie path did deny `/dashboard` after logout.
3. `is_phase1_owner()` is still the Phase 1 email check. Local membership bootstrap was tested with a **new local UUID** for the allowlisted mailbox. Do not copy that UUID to production.
4. Nested Docker ICC workaround is VM-specific (`bridge-nf-call-iptables=0`).
5. Headed keyboard / mobile menu pass was not re-run this turn.
6. Production migrations were not applied and must not be inferred from this local stack.

## 9. Production

Untouched.
