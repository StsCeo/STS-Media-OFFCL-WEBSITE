# Day 11 Phase 2: hosted staging Auth, REST, RLS, and storage

Staging only. Disposable `@day11.test` identities. No real client, employee, accountant, owner, or customer records. No email or invitation was sent. Application routes were not tested. Day 1–10 migration files were not edited. No production project, deploy, merge, GitHub link, Vercel link, custom domain, or Stripe connection.

**Start:** `cursor/sts-business-os-day11-hosted-staging-a5ed` at `8ed23703b47d9a90944497abf0228e4cfd18aa19`.

The hosted script is `scripts/verify-day11-hosted-security.py`. It reuses `scripts/local_aal.py` for password login and TOTP. Credentials stay in the process environment. The script ended with `DAY11_HOSTED_SECURITY_PASSED`.

## Confirmed target

| Field | Value |
| --- | --- |
| Name | `sts-media-staging` |
| Status | `ACTIVE_HEALTHY` |
| Region | `us-east-1` |

It remained the only project in the organization. No key, token, password, or connection string is recorded here.

## Role matrix

| Actor | Result |
| --- | --- |
| Anonymous REST and storage | Denied |
| Authenticated user with no membership, AAL1 and AAL2 | Denied |
| Owner AAL1 note RPC, org-documents upload, receipts upload | Denied |
| Accountant AAL1 invoice RPC | Denied |
| Mapped client AAL1 invoice RPC | Denied |
| Owner and administrator AAL2 | Organization writes and allowlisted accountant reads succeeded |
| Employee AAL2 | Note save inside the organization succeeded; invoice save, client-link, and cross-organization note denied |
| Accountant AAL2 | Allowlisted invoice and expense RPCs and export succeeded; base-table REST and invoice write denied |
| Mapped client AAL2 | Published own invoice and document only; base tables, publication, and object-name RPC denied |
| Inactive client | Invoice and document RPCs denied |
| Other-organization client and owner | Org A invoice, publication, and org-documents object denied |

Unpublishing an invoice removed it from the mapped client list.

## Storage

`org-documents` is path-scoped. Owner and employee AAL2 uploads and the owner download succeeded. Anonymous, no-membership, accountant, client, inactive client, and other-organization downloads and uploads were denied. HTML upload was rejected.

`receipts` and `documents` originally used `is_phase1_owner()`, which is an AAL2 owner or administrator check and was not limited to an object-path organization. Another synthetic organization's AAL2 owner could use `receipts`. That tenant-isolation gap is closed by `20260922120000_day11_legacy_bucket_tenant_isolation.sql`. See `docs/day-11-storage-tenant-isolation.md`.

## Cleanup

After the checks, synthetic storage objects, organizations, memberships, CRM rows, invoices, documents, notes, expenses, portal rows, audit events, MFA factors, sessions, identities, and auth users were removed.

| Catalog | Count |
| --- | --- |
| Auth users, identities, sessions, factors | 0 |
| Organizations, members, settings, profiles | 0 |
| CRM, invoices, estimates, documents, notes, expenses, revenue, projects | 0 |
| Portal identities and publications, audit events | 0 |
| Storage objects | 0 |
| Migration history rows | 27 |

## Local quality

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 35 files, 174 tests passed |
| `npm run build` | exit 0 (Next.js 16.3.4) |

## Not done in Phase 2

- Production database
- Pull request, merge, or deploy
- GitHub, Vercel, custom domain, or Stripe connection
- Application-route checks that need a deployment
- Real membership or CRM records
