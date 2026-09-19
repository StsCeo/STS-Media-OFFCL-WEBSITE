import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { getSession } from "@/lib/auth/session";
import { briefing } from "@/lib/insights";
import { getWorkspace } from "@/lib/data/store";
import { getBusinessOsContext } from "@/lib/org/context";
import { implementedBusinessOsHrefs } from "@/lib/nav";

export const metadata = { title: "Command Center" };

const implementedLinks = [
  { href: "/dashboard/crm", label: "CRM & Sales" },
  { href: "/dashboard/projects", label: "Projects" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/finance", label: "Finance" },
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
        description="Owner operations shell. Financial totals are not calculated here until Business OS ledgers exist. Existing workspace tools remain in their sections."
      />

      <div className="mb-6">
        <QuickActions />
      </div>

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
            Revenue, profit, tax, and payroll totals are not shown on Command Center until organization-owned financial records exist in the Business OS. Existing Phase 1 ledgers stay on Finance, Income, and Expenses.
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
