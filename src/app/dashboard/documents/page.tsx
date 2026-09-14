import { Card, PageHeader } from "@/components/ui";
import { DocumentForm } from "@/components/dashboard/document-form";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Documents" };

export default function DocumentsPage() {
  const docs = getWorkspace().osDocuments;
  return (
    <div>
      <PageHeader title="Documents" description="Private operating documents. Production uploads use the documents bucket with signed URLs. Do not store secrets or an EIN in filenames." />
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add document</h2>
        <DocumentForm />
      </Card>
      <div className="grid gap-3">
        {docs.map((doc) => (
          <Card key={doc.id} className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-xs text-muted">{doc.category} · {doc.relatedType} · {doc.createdAt.slice(0, 10)}</p>
              <p className="mt-2 text-sm">{doc.notes}</p>
            </div>
            <p className="text-xs text-muted">{doc.storagePath ? doc.storagePath : "No file attached yet"}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
