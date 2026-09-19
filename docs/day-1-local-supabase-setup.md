# Day 1 local Supabase setup (owner computer)

This Cloud Agent environment cannot start a real Auth-capable database: Docker and Podman are missing. Use this procedure on your computer. It creates a disposable local stack only. It does not create a paid project, link a remote project, or apply production migrations.

Do not paste secrets, connection strings, cookie values, or environment-variable values into chat.

## Missing prerequisite

**Docker Desktop (or Podman) must be installed and running.** A plain PostgreSQL install is not enough, because Day 1 verification needs Supabase Auth plus `auth.uid()`.

## Smallest setup

1. Install Docker Desktop for your operating system and start it. Confirm the whale/engine is running.
2. In a terminal, from this repository root, confirm the engine:

   ```bash
   docker info >/dev/null && echo "docker engine ready"
   ```

   Expected: `docker engine ready`. If the command is not found, Docker is not on PATH. If it errors, open Docker Desktop and wait until it is running, then retry.
3. Confirm Node/npm are already available (this repo uses npm and the lockfile):

   ```bash
   node -v && npm -v
   ```
4. Install JavaScript dependencies if `node_modules` is missing:

   ```bash
   npm install
   ```

   Do not run a broad upgrade.
5. Start the disposable local stack:

   ```bash
   npx supabase start
   ```

   Expected: the command exits 0 and reports local API / Studio / DB ports from `supabase/config.toml` (`project_id = "sts-media"`). First run downloads images.
6. Apply **every** timestamped migration, including legacy `20260911120000_init.sql` first:

   ```bash
   npx supabase db reset --yes
   ```

   Expected: exit 0. The normal process applies this order and must not skip `init.sql`:

   1. `supabase/migrations/20260911120000_init.sql` (legacy draft; not the live model, but it **does** run)
   2. `supabase/migrations/20260912060000_phase1_owner_os.sql`
   3. `supabase/migrations/20260918134000_business_os_org_foundation.sql`
   4. `supabase/migrations/20260919033000_day1_audit_result_and_rls_hardening.sql`
   5. `supabase/migrations/20260919041000_day1_settings_save_transaction.sql`
   6. `supabase/migrations/20260919053000_day1_legacy_init_compat_and_rpc_guards.sql`
7. Run the isolation script:

   ```bash
   bash scripts/verify-day1-local-supabase.sh
   ```

   Expected last line: `DAY1_LOCAL_SUPABASE_VERIFY_PASSED`.
8. Copy local URL and key **names** from `npx supabase status` into `.env.local` yourself. Keep `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` only for this local machine if you still want the demo button. Production continues to ignore that flag.
9. In local Studio, create a **new** Auth user for the documented owner mailbox. Choose your own password. This local UUID is not the production owner UUID. Do not invent or reuse a production UUID.
10. Insert the owner membership on this local database only, using that local UUID, following `supabase/manual/provision-owner-membership.sql`. Do not run that file against production.
11. Restart the Next.js app, sign in with that local user, save Business Settings, sign out, confirm `/dashboard` redirects, restart Node, and confirm the settings row and success audit event are still present.

## How to verify the setup succeeded

| Check | Expected |
| --- | --- |
| `docker info` | Engine reachable |
| `npx supabase status` | Local API and DB reported as running (read values yourself; do not paste them) |
| `npx supabase db reset --yes` | Exit 0; all six migration files applied |
| `bash scripts/verify-day1-local-supabase.sh` | Ends with `DAY1_LOCAL_SUPABASE_VERIFY_PASSED` |
| Studio Authentication | Synthetic `@day1.test` users exist after the isolation script |
| App login on local URL | Password sign-in works; demo is optional and separate |
| After Node restart | Same settings row and `business_settings.updated` success audit remain |

If `npx supabase start` fails during “Initialising schema” with a Realtime connection timeout, and container-to-container ping fails while DNS works, the Docker engine is filtering bridged traffic. On a nested or incomplete iptables host this has been unblocked with:

```bash
sudo sysctl -w net.bridge.bridge-nf-call-iptables=0
sudo sysctl -w net.bridge.bridge-nf-call-ip6tables=0
```

Then retry `npx supabase start`. Do not use this as a production host setting.

## Hosted alternative (approval required)

A new hosted Supabase project is free on the current hobby tier while it stays inside that tier. It is not created here. If you want that instead of Docker, say so and approve creating a **new empty** project with no production data. Do not approve using the existing production project.
