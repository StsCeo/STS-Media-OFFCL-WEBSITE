import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { ClientEditor } from "@/components/dashboard/client-editor";
import { CrmSubnav } from "@/components/dashboard/crm-subnav";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";
import { clientHealth } from "@/lib/org/client-health";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { clients, leads, source, unavailable } = await loadVisibleCrmRecords();
  const ops = await loadVisibleOpsRecords();
  const workspace = await loadVisibleWorkspaceRecords();
  return (
    <div>
      <PageHeader title="Clients" description="Client records stay separate from leads. Conversion is explicit and preserves the original inquiry." />
      <CrmSubnav current="/dashboard/clients" />
      {unavailable ? (
        <Card className="mb-6">
          <p className="text-sm text-muted">Clients could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? (
        <p className="mb-4 text-xs text-muted">These clients are stored on the organization record. In-memory demo clients are not mixed in.</p>
      ) : null}
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add client</h2>
        <ClientEditor />
      </Card>
      {clients.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {clients.map((client) => {
            const relatedLead = leads.find((lead) => lead.convertedClientId === client.id);
            const health = clientHealth({
              invoices: workspace.invoices.filter((item) => item.clientId === client.id),
              projects: ops.projects.filter((item) => item.clientId === client.id),
              tasks: ops.tasks.filter((item) => item.clientId === client.id),
              lead: relatedLead,
            });
            return (
              <Card key={client.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      <Link href={`/dashboard/clients/${client.id}`} className="underline-offset-2 hover:underline">
                        {client.businessName}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted">{client.industry}</p>
                  </div>
                  <Badge>{client.status}</Badge>
                </div>
                <p className="mt-3 text-sm">{client.contactName}</p>
                <p className="text-sm">{client.email}</p>
                <p className="mt-3 text-sm">
                  <Badge tone={health.tone}>{health.label}</Badge>
                  <span className="ml-2 text-xs text-muted">{health.reason}</span>
                </p>
                <Button href={`/dashboard/clients/${client.id}`} size="sm" variant="secondary" className="mt-4">
                  Open profile
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No clients yet" body="Convert a won lead or add a client record when work actually starts." />
      )}
    </div>
  );
}
