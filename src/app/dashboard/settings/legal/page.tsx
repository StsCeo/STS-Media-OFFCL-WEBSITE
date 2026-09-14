import { saveLegalPage } from "@/app/actions";
import { Badge, Button, Card, PageHeader, textareaClass } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Legal settings" };

export default function LegalSettingsPage() {
  const pages = getWorkspace().legal;
  return (
    <div>
      <PageHeader title="Legal pages" description="Placeholder copy only. A qualified professional must review before these are official." />
      {pages.map((page) => (
        <Card key={page.id} className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{page.title}</h2>
            {page.needsProfessionalReview ? <Badge tone="warning">Needs professional review</Badge> : null}
          </div>
          <form action={saveLegalPage} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={page.id} />
            <textarea name="body" className={textareaClass} defaultValue={page.body} />
            <Button type="submit">Save</Button>
          </form>
        </Card>
      ))}
    </div>
  );
}
