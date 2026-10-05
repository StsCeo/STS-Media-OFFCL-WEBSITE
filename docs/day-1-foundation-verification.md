# Day 1 foundation verification

This report is the evidence log for the STS Business OS Day 1 checkpoint after isolated local Supabase verification. It does not claim production readiness.

**Verdict: DAY 1 COMPLETE IN ISOLATED TEST ENV — local Auth, TOTP MFA through the app, Business Settings UI save, and restart persistence PASS. Not production-ready.**

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. PR #5 was not merged.

## 1. Files created and modified this continuation

- `src/lib/auth/session.ts` — trusted AAL (`currentLevel === "aal2"`) and cookie logout of `*-auth-token`
- `src/app/actions.ts` — `verifyMfaCode` challenges and verifies a TOTP factor; no code is logged
- `src/app/mfa/verify/page.tsx` — form only for a `needs_mfa` session; signed-out visitors go to login
- `src/components/auth/recovery-forms.tsx` — MFA form posts `next` and no longer shows a permanent “Not configured” helper
- `src/lib/auth/mfa-session.test.ts` — AAL and verify-action unit tests
- `src/lib/auth/auth-security.test.ts` / `src/lib/phase1-qa-repair.test.ts` — MFA mocks and cookie-clear coverage
- `supabase/config.toml` — local TOTP enroll/verify enabled
- `docs/day-1-local-supabase-setup.md`
- `docs/day-1-foundation-verification.md`

Enrollment stays off `/mfa/enroll` so the TOTP secret is never rendered. The factor was enrolled privately under `/tmp/sts-local/` (gitignored host path, mode `0600`). `.env.local` remains gitignored.

## 2. Database setup (no secret values)

| Question | Finding |
| --- | --- |
| Supabase configuration | Local `config.toml` present. This VM’s `.env.local` has local URL/key **names** set (values not recorded). No `.supabase` remote link. |
| Configured target | **Local / disposable.** API and DB containers named `*_sts-media`. |
| Isolated test DB | **Yes.** Nested-engine ICC required `net.bridge.bridge-nf-call-iptables=0`. |
| Production | Untouched. |

## 3. Migrations applied (local only)

`npx supabase db reset --yes` was applied earlier in this Day 1 branch (exit 0). Order actually applied:

1. `20260911120000_init.sql` (legacy draft; **not skipped**)
2. `20260912060000_phase1_owner_os.sql`
3. `20260918134000_business_os_org_foundation.sql`
4. `20260919033000_day1_audit_result_and_rls_hardening.sql`
5. `20260919041000_day1_settings_save_transaction.sql`
6. `20260919053000_day1_legacy_init_compat_and_rpc_guards.sql`

This continuation restarted the local stack **from backup** (no second reset) so MFA and settings data could be rechecked.

## 4. RLS results (authenticated / anonymous, not superuser proof)

`day1_isolation_runtime.sql` via `psql` inside `supabase_db_sts-media` as `anon` / `authenticated` impersonation. Ended with `DAY1_ISOLATION_RUNTIME_PASSED` after the MFA/settings work.

Passed: anon denied; owner A allowed; owner B cannot read/write org A; org-id freeze; no self-promotion; inactive denied; accountant/client/contractor restrictions; audit insert denied and update/delete wrote 0 rows with the pre-tamper row still present; invalid RPC leaves prefix unchanged; forged org RPC denied; owner A RPC save stamps `actor_user_id = auth.uid()` and `result = success`.

Postgres contrast count of 2 was recorded only as a contrast, not as RLS proof.

## 5. Real Auth / REST and in-app MFA (not mocked, not demo)

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
- **Expected Supabase behavior:** an already-issued bearer access token still read org rows after logout until JWT expiry

App HTTP against the local production `next start` on `:3000` (demo flag false):

| Check | Result |
| --- | --- |
| `GET /` | 200 |
| `GET /login` | 200, no demo button |
| Signed-out `GET /dashboard` | 307 `/login` |
| Signed-out `GET /mfa/verify` | 307 `/login` |
| Signed-out settings POST | 307 `/login` |
| Allowlisted local password login | MFA challenge form (empty; no secret/QR) |
| MFA verify through the app UI | Command Center after trusted AAL2 |
| Business Settings form submit | Success banner; invoice prefix `STSY` |
| Confirmed Sign out, then `/dashboard` | 307 / rendered `/login` (cookie path fail-closed) |

TOTP was enrolled for the disposable allowlisted mailbox using a private local helper. The secret was never displayed, logged, or committed.

## 6. Settings and audit after Next.js + local Supabase restart

Immediately after the in-app save, org A `invoice_prefix` was `STSY` and `business_settings.updated` success audits were **3**.

Both Next.js (`next start` on :3000) and the local `sts-media` stack were stopped and started from backup (no `db reset`). After that restart:

- prefix still `STSY`
- `business_settings.updated` success count still **3**

A later isolation-SQL RPC proof rewrote owner A settings (prefix observed as `STSX` after that script). That mutation is the isolation harness, not a persistence failure. Restart persistence was recorded **before** that harness ran.

## 7. Logout vs JWT lifetime

Local `supabase/config.toml` sets `jwt_expiry = 3600` (one hour). Refresh-token rotation is enabled.

| Path | Behavior |
| --- | --- |
| Browser cookie session | `clearCurrentAuth()` calls `supabase.auth.signOut()` and deletes `*-auth-token` cookies. After confirmed Sign out, `/dashboard` requires login. **Fail-closed.** |
| Raw bearer access token | Remains valid until `exp`. REST still returned org rows after GoTrue logout in the auth script. **Expected Supabase JWT behavior**, not an app cookie bug. |

Security implication: any client that copied the access token (script, proxy, leaked `Authorization` header) can keep calling the Data API for up to **3600 seconds** after logout. Cookie-authenticated browser tabs do not. Shortening JWT lifetime, using a server-side session denylist, or relying on refresh-token reuse detection are later hardening options. Do not treat bearer validity-until-expiry as an app regression.

Idle expiration uses the same `clearCurrentAuth()` path as Sign out (`expireIdleSession`). An hour-long wait for natural JWT expiry was not performed.

## 8. Commands

| Command | Exit | Notes |
| --- | --- | --- |
| Local TOTP enroll (private helper) | 0 | `PASS totp_enrolled_and_verified`; secret file mode `0600` |
| In-app MFA + settings UI | 0 | `PASS ui_mfa_settings`; prefix `STSY` |
| Confirmed Sign out | 0 | `PASS cookie_logout path=/login` |
| Isolation SQL (no reset) | 0 | `DAY1_ISOLATION_RUNTIME_PASSED` |
| `python3 scripts/verify-day1-local-auth.py` | 0 | `DAY1_LOCAL_AUTH_REST_PASSED` |
| `npm run lint` | 0 | 1 pre-existing unused-var warning |
| `npm run typecheck` | 0 | |
| `npm test` | 0 | **120** tests, 26 files |
| `npm run build` | 0 | Next.js 16.3.4 |

## 9. Remaining gaps

1. `is_phase1_owner()` is still the Phase 1 email check. Local membership bootstrap used a **new local UUID** for the allowlisted mailbox. Do not copy that UUID to production. Do not replace `is_phase1_owner()` until legitimate production owner access is preserved.
2. Bearer access tokens are not revoked immediately on GoTrue logout. Cookie logout fails closed. JWT lifetime is 3600s.
3. `/mfa/enroll` stays unavailable so the secret is never shown. Production enrollment needs a private authenticator-app flow, not a page that renders the secret.
4. Nested Docker ICC workaround is VM-specific (`bridge-nf-call-iptables=0`).
5. Many Command Center ledgers remain in-process memory. Only organization business settings use the transactional RPC.
6. Production migrations were not applied and must not be inferred from this local stack.
7. Isolation SQL mutates owner A settings as part of its RPC proof; use it after persistence snapshots, not as the persistence snapshot.

## 10. Production

Untouched. No production configuration, Auth UUID, or migration was copied or applied. Do not merge PR #5 as a production cutover.
