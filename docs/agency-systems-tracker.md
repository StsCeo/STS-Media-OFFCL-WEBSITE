# STS Media agency systems tracker

Status is recorded only for behavior that exists in this branch. The Phase 1 migration is applied on sts-media-staging.

## Phase 1 — public inquiry to Command Center

| Field | Value |
| --- | --- |
| System | Public inquiry, CRM lead, follow-up task, Command Center agenda |
| Phase | 1 |
| Status | Source security-corrected. Staging migration applied. One synthetic inquiry verified, including replay. |
| Code | `/contact`, `submitContact`, `src/lib/org/public-intake.ts`, `src/lib/org/command-center.ts` |
| Migration | `supabase/migrations/20261003010000_phase1_public_intake.sql` |
| Tests | `src/lib/org/public-intake.test.ts` plus the existing contact, portal, accountant, and estimate suites |
| Manual gaps | The server environment needs the service-role key, kept server-only. The organization slug must remain `sts-media`. No mail, Stripe, booking, or e-sign provider is configured. Optional files are checked and not stored. |
| Limitations | The intake function is executable only by `service_role`. `submitContact` calls it from the server-only client. A missing service-role key fails closed and writes nothing. Anonymous callers cannot invoke the function through the Data API. Staff still edit leads in the existing CRM. Questionnaires stay absent. Client portal writes stay off. |
| Next action | Keep the synthetic staging inquiry. Do not send mail, charge, book, or sign from this workflow. |
| Agenda | The Command Center shows one follow-up task. A generated task-due calendar row stays on the schedule and is not a second agenda card. Agenda dates use the America/New_York business day. |

## Later phases

| Phase | Scope | Status |
| --- | --- | --- |
| 2 | Project templates, assets, SOPs, teammate dashboard, kickoff links | Not started |
| 3 | Content planner, approvals, script templates, optional AI | Not started |
| 4 | Project economics, reports, offboarding, provider integrations | Not started |
