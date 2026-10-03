# Day 11 Phase 1: hosted staging database

Staging database bring-up only. Existing Day 1–10 migration files were not edited. No production project, deploy, merge, GitHub link, Vercel link, custom domain, or Stripe connection.

**Start:** `cursor/sts-business-os-day10-release-hardening-a5ed` at `88a72e4251a6901671e6c2f04bf0f73681596e3e`.  
**Work branch:** `cursor/sts-business-os-day11-hosted-staging-a5ed`.

## Confirmed target

Checked with Supabase tooling before and after the migration apply:

| Field | Value |
| --- | --- |
| Name | `sts-media-staging` |
| Status | `ACTIVE_HEALTHY` |
| Region | `us-east-1` |
| Postgres | 17 (17.6.1.166), release channel `ga` |

The organization project list contained only this staging project. No connection string, key, token, or environment value is recorded here.

Hosted migration history was empty before the first apply.

## Migrations applied

All 27 files in `supabase/migrations/`, lexicographic filename order. Each `apply_migration` call used the filename stem as the history name and the file body unchanged. Every call returned success. Hosted version numbers are apply-time timestamps; completeness is the ordered name list, which matches the repository filenames exactly.

1. `20260911120000_init`
2. `20260912060000_phase1_owner_os`
3. `20260918134000_business_os_org_foundation`
4. `20260919033000_day1_audit_result_and_rls_hardening`
5. `20260919041000_day1_settings_save_transaction`
6. `20260919053000_day1_legacy_init_compat_and_rpc_guards`
7. `20260919120000_day2_membership_owner_gate`
8. `20260919123000_day2_crm_leads_clients`
9. `20260920120000_day3_finance_operations`
10. `20260920121000_day3_finance_operations_rpcs`
11. `20260920130000_day3_ops_no_hard_delete`
12. `20260920140000_day4_workspace_tools`
13. `20260920141000_day4_workspace_rpcs`
14. `20260920142000_day4_storage_documents`
15. `20260920143000_day4_no_hard_delete`
16. `20260920144000_day4_storage_extension_guard`
17. `20260920150000_day4_aal2_session_gate`
18. `20260920160000_day5_estimates`
19. `20260920161000_day5_estimates_rpcs`
20. `20260920162000_day5_estimates_no_hard_delete`
21. `20260920170000_day6_estimate_to_invoice`
22. `20260920180000_day7_schedule_automations`
23. `20260920181000_day7_schedule_rpcs`
24. `20260920190000_day8_accountant_center`
25. `20260920191000_day8_accountant_base_table_lockdown`
26. `20260920200000_day9_client_portal`
27. `20260921120000_day10_legacy_table_lockdown`

## Hosted integrity (read-only catalog queries)

| Check | Result |
| --- | --- |
| Expected organization, CRM, operations, workspace, portal, and phase-1 tables present | 26/26 |
| Public tables missing RLS or FORCE RLS | none |
| `sts_%` SECURITY DEFINER functions | 101, all with `search_path` |
| `anon` grants on public tables | none |
| `public` role grants on public tables | none |
| `anon` EXECUTE on `sts_%` | none |
| `sts_client_portal_document_object_name` EXECUTE grantees | owner role and `service_role` only |
| Buckets | `receipts` private, `documents` private, `org-documents` private, 8388608 bytes, pdf/png/jpeg/text/plain |
| Storage object policies | `receipts_owner_select`, `receipts_owner_write`, `documents_owner_select`, `documents_owner_write`, `org_documents_select_scoped`, `org_documents_insert_scoped` |
| Migration history | 27 names, same order as the repository |
| Rows in organizations, members, CRM, portal identities, and auth users | 0 |

No client, employee, accountant, or owner records were created.

## Local quality

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 35 files, 174 tests passed |
| `npm run build` | exit 0 (Next.js 16.3.4) |

## Not done in Phase 1

- Production database
- Pull request, merge, or deploy
- GitHub, Vercel, custom domain, or Stripe connection
- Real membership or CRM records

Phase 2 hosted Auth, REST, RLS, and storage evidence: `docs/day-11-phase2-hosted-security.md`.
