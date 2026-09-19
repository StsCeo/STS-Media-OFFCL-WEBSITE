import { Badge, Card, PageHeader } from "@/components/ui";
import { ClientEditor } from "@/components/dashboard/client-editor";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { clients, source, unavailable } = await loadVisibleCrmRecords();
  return (
    <div>
      <PageHeader title="Clients" description="These are your client records. Clients do not receive a login. You manage the work here; they reach you by email or the contact form." />
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
            <div className="mt-4 border-t border-line pt-4">
              <ClientEditor client={client} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
