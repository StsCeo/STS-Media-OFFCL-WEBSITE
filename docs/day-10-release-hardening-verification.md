# Day 10 consolidation and security audit

Audit of the complete Day 1–9 stack plus leftover-table lockdown. Isolated local `project_id = "sts-media"` only. No production inspect, migrate, merge, or deploy.

**Starting commit:** `246a3d9` (`cursor/sts-business-os-day9-client-portal-a5ed`).  
**Day 10 branch:** `cursor/sts-business-os-day10-release-hardening-a5ed`.  
**Verdict recorded in the agent report:** see section 19–20 after verification commands.

`vercel.json` remains `{ "main": true, "*": false }` (sha256 `212ced7130515fb7925078dac17826205bea0e9d875ecaeacfb440237ea1e61d`).

Day 10 changes (hardening only):

- Forward migration `20260921120000_day10_legacy_table_lockdown.sql` FORCE RLS + revoke anon/public on leftover init-era tables
- `import "server-only"` on the service-role client
- Owner document download streams bytes (`private, no-store`) instead of redirecting to a signed URL
- MFA `next` is sanitized before it is passed to the challenge form
- Catalog integrity SQL, Auth consolidator, Vitest, and this documentation

Do not copy local secrets, users, or UUIDs to production. Full stacked order and rollback: `docs/day-10-pre-production-readiness.md`.
