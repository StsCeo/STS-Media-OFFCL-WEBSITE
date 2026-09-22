# Day 11 storage tenant isolation

Staging only. The Phase 2 finding that legacy `receipts` and `documents` buckets were not organization-scoped is closed here. Day 1–10 migrations were not edited. No production project, deploy, merge, GitHub link, Vercel link, custom domain, or Stripe connection.

## Root cause

`20260912060000_phase1_owner_os.sql` created private buckets `receipts` and `documents` with select and insert policies that required only `is_phase1_owner()`. After Day 4, that function is true for any AAL2 owner or administrator and does not read the object path. `org-documents` was already scoped with `sts_storage_org_id(name)`.

Application use:

- `receipts` is used by `uploadExpenseReceipt`. The previous object name was `{expenseId}/{timestamp}-{filename}` and did not include an organization id.
- `documents` has no application upload or download. Dashboard files use `org-documents`.

## Remediation

Forward migration `20260922120000_day11_legacy_bucket_tenant_isolation.sql`:

- `receipts` select and insert require an AAL2 owner or administrator of the organization parsed from the first path segment. Paths must not contain `..`. Authenticated update and delete stay absent. The bucket stays private, with its previous empty MIME and size settings left unchanged.
- `documents` policies were removed and not replaced. The bucket stays private.
- `org-documents` policies were not changed.

`uploadExpenseReceipt` now stores `{organizationId}/{expenseId}/{timestamp}-{filename}` and rejects a path that is not organization scoped.

## Hosted checks

Target remained `sts-media-staging`, `ACTIVE_HEALTHY`, `us-east-1`.

| Check | Result |
| --- | --- |
| Same-organization owner receipt upload and download | PASS |
| Same-organization administrator receipt download | PASS |
| Same-organization receipt delete | Denied |
| Cross-organization upload, download, list, update, and delete | Denied |
| Other organization owner upload inside their own prefix | PASS |
| Org A owner reading an org B receipt | Denied |
| Employee, accountant, client, inactive client, no-membership, anonymous | Denied |
| Unused `documents` bucket upload | Denied |
| `org-documents` same-organization and cross-organization behavior | Unchanged and passing |

Disposable auth users, business rows, and storage objects were removed. Catalog counts returned to 0. Migration history is 28 rows.

## Local quality

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm test` | 36 files, 177 tests passed |
| `npm run build` | exit 0 (Next.js 16.3.4) |
