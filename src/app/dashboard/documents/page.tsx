import { archiveDocumentPageForm } from "@/app/actions";
import { DocumentForm } from "@/components/dashboard/document-form";
import { Button, Card, PageHeader } from "@/components/ui";
import { DOCUMENT_SCAN_NOTE } from "@/lib/org/workspace";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { documents, clients, projects, source, unavailable } = await loadVisibleWorkspaceRecords();
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Private organization files. Uploads use a private bucket and short-lived signed downloads. Do not store secrets or an EIN in filenames."
      />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Documents could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      <p className="mb-4 text-xs text-muted">{DOCUMENT_SCAN_NOTE}</p>
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">Files are stored in the private org-documents bucket. Paths are generated on the server.</p> : null}
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add document</h2>
        <DocumentForm clients={clients} projects={projects} />
      </Card>
      <div className="grid gap-3">
        {documents.map((doc) => (
          <Card key={doc.id} className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted">{doc.category} · {doc.relatedType} · {doc.createdAt.slice(0, 10)} · {doc.byteSize ?? 0} bytes</p>
                <p className="mt-2 text-sm">{doc.notes}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {doc.storagePath ? (
                  <Button href={`/dashboard/documents/${doc.id}/download`} size="sm" variant="secondary">Download</Button>
                ) : (
                  <p className="text-xs text-muted">No file attached yet</p>
                )}
                <form action={archiveDocumentPageForm}>
                  <input type="hidden" name="id" value={doc.id} />
                  <Button type="submit" size="sm" variant="secondary">Archive</Button>
                </form>
              </div>
            </div>
            <DocumentForm document={doc} clients={clients} projects={projects} />
          </Card>
        ))}
      </div>
    </div>
  );
}
