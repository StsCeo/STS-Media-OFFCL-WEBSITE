# Day 8 read-only Accountant Center

This report is the evidence log for Day 8 work on top of the completed isolated Day 7 closure. It does not claim production readiness, accounting compliance, tax compliance, legal compliance, or that tax returns, bank balances, or audited statements are produced.

**Verdict: pending local verification.** Not production-ready. Do not merge or deploy.

Target used: disposable local stack `supabase/config.toml` `project_id = "sts-media"`. No hosted or production project was linked, queried, reset, or migrated. Prior stacked PRs remain unmerged.

## 1. Implementation plan

Branched from Day 7 HEAD `2a86f419fbab76bae7e860667e0d6929940ae176` as `cursor/sts-business-os-day8-accountant-read-center-a5ed`. `vercel.json` was left unchanged (`main` true, `*` false).

Owner-approved scope: dedicated `/accountant` surface, read-only operational figures, minimized views, authenticated CSV, sanitized `accountant.exported` audits. Explicitly excluded: tax, payroll, banking, payments, Stripe, QuickBooks, accountant invitations, production memberships, sharing links, email, editable spreadsheets, production Supabase, and deployment.

## 2. Accountant Center functionality

- Dedicated `/accountant` with its own session loader (`canAccessAccountantCenter`). Command Center remains owner/administrator + AAL2.
- Accountants at AAL2 are bounced from `/dashboard` to `/accountant`.
- Owner/administrator may open `/accountant` for oversight; the surface stays read-only.
- Operational totals, monthly summary, invoice and expense lists, sanitized finance audit, and CSV downloads.

## 3. Data exposed and withheld

Exposed: invoice number/status/dates/totals/client business name; expense date/category/amount/reimbursement/safe description; operational revenue date/type/description/amount/payment status; finance-related audit action/entity/result; export type and row count.

Withheld: notes, payment instructions, emails, phones, contact names, payment accounts/methods, project/task/calendar/estimate/document contents, payroll, bank balances, secrets.

## 4. Migrations, views, helpers, and RPCs

- `20260920190000_day8_accountant_center.sql` — `sts_can_read_accountant_center`, `sts_accountant_session_organization`, security_invoker views, `sts_list_accountant_finance_audit`, `sts_record_accountant_export`.

## 5–16. Verification

Filled after isolated local SQL, Auth/REST, UI, lint, type-check, tests, and production build.
