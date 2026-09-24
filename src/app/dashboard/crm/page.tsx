import { Badge, Button, Card, PageHeader } from "@/components/ui";
import { CrmSubnav } from "@/components/dashboard/crm-subnav";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";
import { compactPipelineSummary } from "@/lib/org/command-center";

export const metadata = { title: "CRM & Sales" };

export default async function CrmPage() {
  const { leads, clients, icps, source } = await loadVisibleCrmRecords();
  const pipeline = compactPipelineSummary(leads);
  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title="CRM & Sales"
        description="Pipeline, clients, ICPs, and a thin sales view on the existing CRM records."
      />
      <CrmSubnav current="/dashboard/crm" />
      {source === "postgres" ? (
        <p className="mb-4 text-xs text-muted">These records are stored on the organization. Demo workspace numbers are not mixed in.</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Badge tone="success">Pipeline</Badge>
          <h2 className="mt-3 font-semibold">Sales pipeline</h2>
          <p className="mt-2 text-sm text-muted">Kanban on the existing lead stages. Winning a deal does not create a client until you convert.</p>
          <dl className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
            {pipeline.map((column) => (
              <div key={column.key}>
                <dt className="text-muted">{column.label}</dt>
                <dd className="font-mono text-lg">{column.count}</dd>
              </div>
            ))}
          </dl>
          <Button href="/dashboard/leads" size="sm" className="mt-4">
            Open pipeline
          </Button>
        </Card>
        <Card>
          <Badge tone="success">Clients</Badge>
          <h2 className="mt-3 font-semibold">Clients</h2>
          <p className="mt-2 text-sm text-muted">{clients.length ? `${clients.length} client records.` : "No clients yet. Convert a lead or add a client directly."}</p>
          <Button href="/dashboard/clients" size="sm" className="mt-4">
            Open clients
          </Button>
        </Card>
        <Card>
          <Badge tone="success">ICPs</Badge>
          <h2 className="mt-3 font-semibold">Ideal customer profiles</h2>
          <p className="mt-2 text-sm text-muted">
            {icps.length
              ? `${icps.filter((item) => item.status === "active").length} active ICPs.`
              : "Define your ideal customers so STS can measure which markets generate the strongest opportunities."}
          </p>
          <Button href="/dashboard/crm/icps" size="sm" className="mt-4">
            {icps.length ? "Open ICPs" : "Create ICP"}
          </Button>
        </Card>
        <Card>
          <Badge tone="info">Analytics</Badge>
          <h2 className="mt-3 font-semibold">Sales analytics</h2>
          <p className="mt-2 text-sm text-muted">Close rate and conversion only when there is enough data. Zero denominators are not shown as 0%.</p>
          <Button href="/dashboard/crm/analytics" size="sm" className="mt-4">
            Open analytics
          </Button>
        </Card>
      </div>
    </div>
  );
}
