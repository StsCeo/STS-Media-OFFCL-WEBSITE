import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getSession } from "@/lib/auth/session";
import { briefing } from "@/lib/insights";
import { getWorkspace } from "@/lib/data/store";
import { getBusinessOsContext } from "@/lib/org/context";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { implementedBusinessOsHrefs } from "@/lib/nav";
import { formatCurrency } from "@/lib/utils";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";
import { loadVisibleEstimates } from "@/lib/org/estimates-context";

export const metadata = { title: "Command Center" };

const implementedLinks = [
  { href: "/dashboard/crm", label: "CRM & Sales" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/estimates", label: "Estimates" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/taxes", label: "Taxes" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/security", label: "Security" },
  { href: "/dashboard/settings/business", label: "Business Settings" },
].filter((item) => implementedBusinessOsHrefs.includes(item.href));

export default async function OverviewPage() {
  const workspace = getWorkspace();
  const today = briefing(workspace);
  const session = await getSession();
  const os = await getBusinessOsContext(session.user);
  const { totals, source, estimateNote, unavailable } = await loadVisibleOpsRecords();
  const workspaceRecords = await loadVisibleWorkspaceRecords();
  const estimates = await loadVisibleEstimates();
  const organization = os.organization;
  const settings = os.settings;
  const orgActivity = os.audit;
  const workspaceActivity = workspace.auditLog.slice(0, 6);
  const actionItems = [
    ...today.overdue.map((task) => ({ label: `Overdue: ${task.title}`, href: "/dashboard/tasks" })),
    ...today.followUps.map((lead) => ({ label: `Follow up: ${lead.businessName}`, href: "/dashboard/leads" })),
    ...today.atRisk.map((project) => ({ label: `At risk: ${project.name}`, href: `/dashboard/projects/${project.id}` })),
    ...today.missingReceipts.map((expense) => ({ label: `Missing receipt: ${expense.vendor}`, href: "/dashboard/expenses?view=missing" })),
  ].slice(0, 8);

  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title="Command Center"
        description="Owner operations shell. Finance and operations totals below are operational estimates for the current organization, not formal accounting or tax reports."
      />

      <div className="mb-6">
        <QuickActions />
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Operational estimates</h2>
          <Badge tone="info">{source === "postgres" ? "Organization ledger" : "Workspace"}</Badge>
        </div>
        {unavailable ? (
          <p className="text-sm text-muted">Organization ledgers could not be loaded. Totals were not taken from local fallback data.</p>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Total revenue</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.totalRevenue)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Total expenses</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.totalExpenses)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Net income</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.netIncome)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Outstanding revenue</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.outstandingRevenue)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Unreimbursed expenses</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.unreimbursedExpenses)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Active projects</dt>
                <dd className="mt-1 font-mono text-lg">{totals.activeProjects}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Open tasks</dt>
                <dd className="mt-1 font-mono text-lg">{totals.openTasks}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Overdue tasks</dt>
                <dd className="mt-1 font-mono text-lg">{totals.overdueTasks}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">{estimateNote}</p>
          </>
        )}
      </Card>

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Workspace records</h2>
          <Badge tone="info">{workspaceRecords.source === "postgres" ? "Organization records" : "Workspace"}</Badge>
        </div>
        {workspaceRecords.unavailable ? (
          <p className="text-sm text-muted">Notes, documents, calendar, and invoices could not be loaded. Totals were not taken from local fallback data.</p>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Upcoming events</dt>
                <dd className="mt-1 font-mono text-lg">{workspaceRecords.summaries.upcomingEvents.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Recent notes</dt>
                <dd className="mt-1 font-mono text-lg">{workspaceRecords.summaries.recentNotes.length}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Documents</dt>
                <dd className="mt-1 font-mono text-lg">{workspaceRecords.summaries.documentCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Draft invoices</dt>
                <dd className="mt-1 font-mono text-lg">{workspaceRecords.summaries.draftInvoices}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Outstanding invoices</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(workspaceRecords.summaries.outstandingInvoiceTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Overdue invoices</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(workspaceRecords.summaries.overdueInvoiceTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Paid recorded</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(workspaceRecords.summaries.paidInvoiceTotal)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Draft estimates</dt>
                <dd className="mt-1 font-mono text-lg">{estimates.unavailable ? "—" : estimates.summaries.draftEstimates}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Ready estimates</dt>
                <dd className="mt-1 font-mono text-lg">{estimates.unavailable ? "—" : estimates.summaries.readyEstimates}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">{workspaceRecords.recordNote} Invoice figures are operational records, not formal accounting or tax reports.</p>
            {workspaceRecords.summaries.upcomingEvents.length ? (
              <ul className="mt-4 space-y-1 text-sm">
                {workspaceRecords.summaries.upcomingEvents.map((event) => (
                  <li key={event.id}>{event.title}</li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Action Needed</h2>
            <Badge tone="info">Operational</Badge>
          </div>
          {actionItems.length ? (
            <ul className="space-y-2 text-sm">
              {actionItems.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <Link href={item.href} className="underline-offset-2 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No operational follow-ups"
              body="Open tasks, at-risk projects, and lead follow-ups will appear here. This is not a tax, payroll, or profit dashboard."
            />
          )}
          <p className="mt-4 text-sm">
            <Link href="/dashboard/expenses?view=missing" className="underline-offset-2 hover:underline">
              Review missing receipts
            </Link>
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Business Summary</h2>
            <Badge>Placeholder</Badge>
          </div>
          <p className="text-sm text-muted">
            Organization identity and invoice defaults. Ledger totals are operational estimates in the card above, not tax, payroll, or audited financial statements.
          </p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Organization</dt>
              <dd className="mt-1 font-medium">{organization?.displayName ?? (os.unavailable ? "Temporarily unavailable" : "Not provisioned")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Legal name</dt>
              <dd className="mt-1 font-medium">{organization?.legalName ?? "Not provisioned"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Time zone</dt>
              <dd className="mt-1 font-medium">{organization?.timezone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Base currency</dt>
              <dd className="mt-1 font-medium">{organization?.baseCurrency ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Invoice prefix</dt>
              <dd className="mt-1 font-mono">{settings?.invoicePrefix ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Payment terms</dt>
              <dd className="mt-1">{settings?.defaultPaymentTerms ?? "—"}</dd>
            </div>
          </dl>
          <Button href="/dashboard/settings/business" size="sm" variant="secondary" className="mt-4">
            Open Business Settings
          </Button>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        {orgActivity.length || workspaceActivity.length ? (
          <ul className="mt-4 space-y-3 text-sm">
            {orgActivity.slice(0, 5).map((event) => (
              <li key={event.id} className="rounded-md border border-line p-3">
                <p className="font-medium">{event.action.replaceAll(".", " ")}</p>
                <p className="mt-1 text-xs text-muted">
                  {event.entityType}
                  {event.entityId ? ` · ${event.entityId}` : ""} · {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
            {workspaceActivity.map((event) => (
              <li key={event.id} className="rounded-md border border-line p-3">
                <p className="font-medium">{event.action.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-muted">
                  {event.target} · {event.detail}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No activity recorded yet"
            body="Saving Business Settings or using workspace tools will list a safe activity trail here. Secrets and government identifiers are never stored in audit metadata."
          />
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="text-lg font-semibold">Implemented sections</h2>
        <p className="mt-1 text-sm text-muted">Command Center only links to sections that already have a working foundation.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {implementedLinks.map((item) => (
            <Button key={item.href} href={item.href} size="sm" variant="secondary">
              {item.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
