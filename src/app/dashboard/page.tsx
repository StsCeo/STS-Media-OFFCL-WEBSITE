import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { CommandCenterPeriodForm } from "@/components/dashboard/command-center-period";
import { OperationalAgenda } from "@/components/dashboard/operational-agenda";
import { getSession } from "@/lib/auth/session";
import { getBusinessOsContext } from "@/lib/org/context";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { implementedBusinessOsHrefs } from "@/lib/nav";
import { formatCurrency } from "@/lib/utils";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";
import { loadVisibleEstimates } from "@/lib/org/estimates-context";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";
import {
  businessHealthMetrics,
  commandCenterSnapshot,
  compactPipelineSummary,
  deriveOperationalAgenda,
  parseCommandCenterPeriod,
} from "@/lib/org/command-center";

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

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = parseCommandCenterPeriod(params.period);
  const customFrom = params.from ? new Date(`${params.from}T00:00:00`) : undefined;
  const customTo = params.to ? new Date(`${params.to}T23:59:59`) : undefined;
  const session = await getSession();
  const os = await getBusinessOsContext(session.user);
  const { totals, source, estimateNote, unavailable, expenses, revenue, projects, tasks, clients } = await loadVisibleOpsRecords();
  const workspaceRecords = await loadVisibleWorkspaceRecords();
  const estimates = await loadVisibleEstimates();
  const crm = await loadVisibleCrmRecords();
  const organization = os.organization;
  const settings = os.settings;
  const orgActivity = os.audit;
  const snapshot = commandCenterSnapshot({
    expenses,
    revenue,
    invoices: workspaceRecords.invoices,
    projects,
    tasks,
    activeClients: clients.filter((client) => client.status === "active").length,
    source,
    period,
    customFrom,
    customTo,
  });
  const agenda = deriveOperationalAgenda({
    tasks,
    leads: crm.leads,
    invoices: workspaceRecords.invoices,
    projects,
    events: workspaceRecords.events,
  });
  const pipeline = compactPipelineSummary(crm.leads);
  const health = businessHealthMetrics({
    leads: crm.leads,
    invoices: workspaceRecords.invoices,
    activeClients: clients.filter((client) => client.status === "active").length,
    range: snapshot.range,
  });
  const ledgersUnavailable = unavailable || workspaceRecords.unavailable || crm.unavailable;

  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title="Command Center"
        description="How much money is coming in, who needs attention, what work is due, and where the next client is coming from. Totals are operational estimates for this organization, not formal accounting."
        actions={<CommandCenterPeriodForm period={period} from={params.from} to={params.to} />}
      />

      <div className="mb-6">
        <QuickActions />
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Snapshot</h2>
          <Badge tone="info">{source === "postgres" ? "Organization ledger" : "Workspace"}</Badge>
        </div>
        {ledgersUnavailable ? (
          <p className="text-sm text-muted">Organization records could not be loaded. Totals were not taken from local fallback data.</p>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Revenue</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(snapshot.revenue)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Outstanding invoices</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(snapshot.outstandingInvoices)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Expenses</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(snapshot.expenses)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Profit</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(snapshot.profit)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">MRR</dt>
                <dd className="mt-1 text-sm text-muted">Unavailable</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Active clients</dt>
                <dd className="mt-1 font-mono text-lg">{snapshot.activeClients}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">{snapshot.mrrNote} Revenue, expenses, and profit use the selected period. Outstanding invoices and active clients are current, not period-sliced.</p>
          </>
        )}
      </Card>

      <div className="mb-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Today / Upcoming / Overdue</h2>
          <OperationalAgenda items={agenda} />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Sales pipeline</h2>
          {crm.leads.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {pipeline.map((column) => (
                <Link key={column.key} href={column.href} className="rounded-md border border-line p-3 hover:bg-canvas">
                  <p className="text-xs text-muted">{column.label}</p>
                  <p className="font-mono text-2xl">{column.count}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No leads yet" body="The pipeline summary appears after the first inquiry is captured." action={<Button href="/dashboard/leads" size="sm">Open pipeline</Button>} />
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-semibold">Business health</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Leads this period</dt>
            <dd className="mt-1 font-mono text-lg">{health.leadsThisPeriod}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Conversion rate</dt>
            <dd className="mt-1 font-mono text-lg">{health.conversionRate == null ? "Not enough data" : `${health.conversionRate}%`}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Average deal value</dt>
            <dd className="mt-1 font-mono text-lg">{health.averageDealValue == null ? "Not enough data" : formatCurrency(health.averageDealValue)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Outstanding invoices</dt>
            <dd className="mt-1 font-mono text-lg">{formatCurrency(health.outstandingInvoices)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Active clients</dt>
            <dd className="mt-1 font-mono text-lg">{health.activeClients}</dd>
          </div>
        </dl>
      </Card>

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
                <dt className="text-xs uppercase tracking-wide text-muted">All-time revenue</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.totalRevenue)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">All-time expenses</dt>
                <dd className="mt-1 font-mono text-lg">{formatCurrency(totals.totalExpenses)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Active projects</dt>
                <dd className="mt-1 font-mono text-lg">{totals.activeProjects}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Overdue tasks</dt>
                <dd className="mt-1 font-mono text-lg">{totals.overdueTasks}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted">{estimateNote} Ready estimates: {estimates.unavailable ? "—" : estimates.summaries.readyEstimates}.</p>
            <p className="mt-3 text-sm">
              <Link href="/dashboard/expenses?view=missing" className="underline-offset-2 hover:underline">
                Review missing receipts
              </Link>
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Business identity</h2>
            <Badge>Organization</Badge>
          </div>
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
        <Card>
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          {orgActivity.length ? (
            <ul className="mt-4 space-y-3 text-sm">
              {orgActivity.slice(0, 6).map((event) => (
                <li key={event.id} className="rounded-md border border-line p-3">
                  <p className="font-medium">{event.action.replaceAll(".", " ")}</p>
                  <p className="mt-1 text-xs text-muted">
                    {event.entityType}
                    {event.entityId ? ` · ${event.entityId}` : ""} · {new Date(event.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No activity recorded yet"
              body="Saving records writes a safe activity trail here. Secrets and government identifiers are never stored in audit metadata."
            />
          )}
        </Card>
      </div>

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
