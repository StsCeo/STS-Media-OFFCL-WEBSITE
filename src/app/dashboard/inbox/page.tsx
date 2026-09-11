import { Badge, Card, PageHeader, inputClass } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Inbox" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q ?? "";
  const { contacts, emailTemplates } = getWorkspace();
  const folders = ["Inbox", "Sent", "Drafts", "Starred", "Client labels", "Project labels"];
  return (
    <div>
      <PageHeader title="Inbox" description="Prepared for Gmail / Google Workspace OAuth. Nothing is claimed as connected." />
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <Card className="p-3">
          {folders.map((folder) => (
            <p key={folder} className="rounded-md px-2 py-2 text-sm hover:bg-canvas">{folder}</p>
          ))}
        </Card>
        <div className="space-y-4">
          <Card className="border-warning/30">
            <Badge tone="warning">Needs setup</Badge>
            <p className="mt-2 text-sm">Connect Google Workspace in Integrations to sync live mail. Search, attachments, and labels are ready in the interface.</p>
          </Card>
          <input className={inputClass} defaultValue={q} placeholder="Search mail (local submissions until OAuth)" readOnly />
          <Card>
            <h2 className="font-semibold">Contact-form inquiries</h2>
            {contacts.length === 0 ? <p className="mt-2 text-sm text-muted">No messages yet. Public contact submissions appear here.</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {contacts.map((item) => (
                  <li key={item.id} className="rounded-md border border-line p-3">
                    <p className="font-medium">{item.name} · {item.businessName}</p>
                    <p>{item.email} · {item.service}</p>
                    <p className="text-muted">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Templates (manual review required)</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {emailTemplates.map((tpl) => (
                <li key={tpl.id} className="rounded-md border border-line p-3">
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-muted">{tpl.subject}</p>
                  <p className="mt-1 text-xs">Automation is off. Sending requires owner review.</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
