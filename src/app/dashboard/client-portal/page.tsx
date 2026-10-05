import { Card, PageHeader } from "@/components/ui";
import { ClientPortalOwnerForms } from "@/app/dashboard/client-portal/owner-forms";
import { loadClientPortalOwnerIndex } from "@/lib/org/client-portal";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Client portal" };
export const dynamic = "force-dynamic";

export default async function ClientPortalOwnerPage() {
  const [index, workspace] = await Promise.all([loadClientPortalOwnerIndex(), loadVisibleWorkspaceRecords()]);
  return (
    <div>
      <PageHeader
        title="Client portal"
        description="Link disposable local client users to CRM records and review publication status. Clients never use this Command Center page."
      />
      <Card className="mb-6 space-y-2 text-sm text-muted">
        <p>{index.mappingNote}</p>
        <p>{index.publishNote}</p>
      </Card>
      {index.unavailable ? (
        <Card className="mb-6">
          <p className="text-sm text-muted">Client portal mappings could not be loaded from the database.</p>
        </Card>
      ) : null}
      <ClientPortalOwnerForms
        identities={index.identities}
        candidates={index.candidates}
        clients={workspace.clients}
        publications={index.publications}
      />
    </div>
  );
}
