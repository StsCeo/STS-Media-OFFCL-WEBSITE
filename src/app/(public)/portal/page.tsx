import { Badge, Button } from "@/components/ui";
import { IvoryShell, PageKicker, PageLede, PageTitle } from "@/components/public/page-hero";

export const metadata = { title: "Client portal preview" };

const panels = [
  { title: "Projects", body: "Stage, next milestone, and files the client is allowed to see." },
  { title: "Invoices", body: "Amounts, due dates, and paid history — never pending cash presented as collected." },
  { title: "Approvals", body: "Copy, designs, and launch checklists waiting on a yes." },
  { title: "Messages", body: "A single thread instead of a scavenger hunt across inboxes." },
];

export default function PortalPage() {
  return (
    <IvoryShell wide>
      <div className="flex flex-wrap items-center gap-3">
        <PageKicker>Phase 3 preview</PageKicker>
        <Badge tone="warning">Not live</Badge>
      </div>
      <PageTitle>A client portal that will tell the truth.</PageTitle>
      <PageLede>
        This is a design preview, not a login. Client accounts, file storage, and invoicing connect after Supabase Auth is on. Nothing behind this page is a working client session.
      </PageLede>
      <div className="mt-10 overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b border-line bg-canvas px-5 py-3">
          <p className="text-sm font-medium">Client workspace · preview</p>
          <span className="text-xs text-muted">Requires a real invite</span>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {panels.map((panel) => (
            <article key={panel.title} className="rounded-lg border border-dashed border-line p-4">
              <h2 className="font-medium">{panel.title}</h2>
              <p className="mt-2 text-sm text-muted">{panel.body}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href="/contact">Ask about a client workspace</Button>
        <Button href="/legal/client-portal" variant="secondary">
          Portal terms (placeholder)
        </Button>
      </div>
    </IvoryShell>
  );
}
