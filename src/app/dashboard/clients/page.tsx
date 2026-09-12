import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Clients" };

export default function ClientsPage() {
  const clients = getWorkspace().clients;
  return (
    <div>
      <PageHeader title="Clients" description="These are your client records. Clients do not receive a login. You manage the work here; they reach you by email or the contact form." />
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
          </Card>
        ))}
      </div>
    </div>
  );
}
