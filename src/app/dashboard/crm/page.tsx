import { Badge, Button, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "CRM & Sales" };

export default function CrmPage() {
  return (
    <div>
      <PageHeader
        eyebrow="STS Media Business OS"
        title="CRM & Sales"
        description="Working Phase 1 lead and client records. Estimates, proposals, and a full pipeline board are planned for a later phase."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Badge tone="success">Available</Badge>
          <h2 className="mt-3 font-semibold">Leads</h2>
          <p className="mt-2 text-sm text-muted">Inquiry pipeline, follow-ups, and stage tracking from the existing workspace.</p>
          <Button href="/dashboard/leads" size="sm" className="mt-4">
            Open leads
          </Button>
        </Card>
        <Card>
          <Badge tone="success">Available</Badge>
          <h2 className="mt-3 font-semibold">Clients</h2>
          <p className="mt-2 text-sm text-muted">Active client records. Clients do not receive a login from this screen.</p>
          <Button href="/dashboard/clients" size="sm" className="mt-4">
            Open clients
          </Button>
        </Card>
      </div>
    </div>
  );
}
