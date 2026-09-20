# Vercel preview safety (repository-side)

This checklist is for the repository owner. It does **not** claim that any hosted preview is safe. This agent did not open, delete, redeploy, or modify the Vercel preview that GitHub created for draft PR #8, and it did not access production Vercel.

## Repository-side findings

| Check | Finding |
| --- | --- |
| `vercel.json` | Present. `git.deploymentEnabled` is `{ "main": true, "*": false }` so only `main` auto-deploys |
| GitHub Actions deploy workflows | None under `.github/` |
| Tracked `.vercel` project metadata | Ignored by `.gitignore`; not tracked |
| Tracked `.env*` / local Supabase secrets | Ignored; not tracked |
| Preview trigger in this repo | None besides the GitHub/Vercel integration. Non-`main` Git auto-deployments are disabled in `vercel.json` |

This file does not change production domains, environment variables, or dashboard-only project settings. The owner should still confirm the existing PR #8 Preview and Preview environment isolation.

## Manual owner actions

### 1. Remove the existing PR #8 preview

1. Open the Vercel dashboard for the `sts-media-offcl-website` project.
2. Open **Deployments**.
3. Find the Preview deployment associated with `cursor/sts-business-os-day4-workspace-invoicing-a5ed` / PR #8.
4. Use Vercel’s deployment menu to **Delete** that Preview (and any older Previews from the same stacked Day 1–4 branches if they should not stay live).
5. Confirm the Preview URL no longer loads.

This agent must not delete that deployment automatically.

### 2. Disable or limit automatic preview deployments for stacked development branches

In the Vercel project **Settings → Git**:

1. Confirm which GitHub branches create Preview deployments.
2. If stacked Day 1–4 branches should not get public Previews, use Ignored Build Step, branch include/exclude rules, or disable Preview deployments for non-production branches.
3. Keep production deployments on the intended production branch only.
4. Do not change production settings from this task; make the decision in the dashboard after review.

### 3. Confirm Preview environment variables do not point to production Supabase

In **Settings → Environment Variables**, for each Supabase-related **name** (values not recorded here):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OWNER_EMAIL`
- `NEXT_PUBLIC_SITE_URL`

Confirm the **Preview** environment is not the production project. If Preview currently uses production values, rotate any exposed keys after isolating Preview from production.

### 4. Confirm production-only secrets are not available to Preview

For every production secret (service-role key, demo session secret, unused integration tokens):

1. Check the environment scope: Production, Preview, and Development are separate.
2. Production-only secrets should not be assigned to Preview.
3. `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser. The application’s browser client uses only the anon key name.

### 5. Protect Previews with Vercel Authentication when Previews are intentional

If Previews remain enabled:

1. Enable **Deployment Protection** / Vercel Authentication so anonymous internet users cannot open Preview URLs.
2. Restrict access to the team.
3. Re-check that Preview still does not use production Supabase.

Until the owner verifies the five items above, treat the automatic PR #8 Preview as an unverified hosted risk. Do not merge PR #5, #6, #7, or #8 as a production cutover.
