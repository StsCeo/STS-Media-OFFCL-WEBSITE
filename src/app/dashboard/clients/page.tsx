import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Clients" };

export default function ClientsPage() {
  const clients = getWorkspace().clients;
  return (
    <div>
      <PageHeader title="Clients" description="Client records are workspace-scoped. Portal access stays off until Phase 3." />
      <div className="grid gap-4 md:grid-cols-2">
        {clients.map((client) => (
          <Card key={client.id}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{client.businessName}</h2>
                <p className="text-sm text-muted">{client.industry}</p>
              </div>
              <Badge>{client.status}</Badge>
            </div>
            <p className="mt-3 text-sm">{client.contactName}</p>
            <p className="text-sm">{client.email}</p>
            <p className="mt-3 text-xs text-muted">{client.notes}</p>
            <p className="mt-2 text-xs">Client portal: {client.portalEnabled ? "enabled" : "prepared, not enabled"}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
