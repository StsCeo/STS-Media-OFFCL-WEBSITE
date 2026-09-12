import { Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Files" };

export default function FilesPage() {
  const files = getWorkspace().files;
  return (
    <div>
      <PageHeader title="Files" description="Private receipts and operating files. Production uses the receipts and documents buckets with signed URLs. Never store secrets in filenames." />
      <div className="grid gap-3">
        {files.map((file) => (
          <Card key={file.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted">{file.kind} · {file.visibility} · {file.relatedTo}</p>
            </div>
            <p className="text-xs">Short-lived signed URL — not issued in demo</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
