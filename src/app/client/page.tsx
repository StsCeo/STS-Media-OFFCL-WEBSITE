import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { loadClientPortalHome } from "@/lib/org/client-portal";
import { moneyLabel } from "@/lib/org/client-portal-model";

export const metadata = { title: "Client portal" };
export const dynamic = "force-dynamic";

function statusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "paid" || status === "accepted" || status === "launched" || status === "completed") return "success";
  if (status === "issued" || status === "ready" || status === "client_review") return "info";
  if (status === "void" || status === "declined" || status === "expired" || status === "on_hold") return "warning";
  return "neutral";
}

export default async function ClientPortalPage() {
  const data = await loadClientPortalHome();
  return (
    <div>
      <PageHeader
        eyebrow="Client portal"
        title={data.profile ? `Welcome, ${data.profile.clientBusinessName}` : "Client portal"}
        description="Published estimates, invoices, projects, and documents for your business. This portal is separate from internal staff tools."
      />
      <Card className="mb-6 space-y-2 text-sm text-muted">
        <p>{data.readonlyNote}</p>
        <p>{data.recordNote}</p>
      </Card>
      {!data.mapped ? (
        <Card className="mb-6">
          <p className="text-sm" role="status">This account is signed in but is not linked to an active client record. Nothing is listed until an owner or administrator creates an active mapping.</p>
        </Card>
      ) : null}
      {data.unavailable ? (
        <Card className="mb-6">
          <p className="text-sm text-muted" role="alert">Published records could not be loaded. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}

      <section id="estimates" className="mb-8 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold">Published estimates</h2>
        {data.estimates.length === 0 ? (
          <Card><p className="text-sm text-muted">No published estimates are visible yet.</p></Card>
        ) : (
          <div className="grid gap-3">
            {data.estimates.map((estimate) => (
              <Card key={estimate.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/client/estimates/${estimate.id}`} className="font-semibold hover:underline">{estimate.estimateNumber}</Link>
                    <p className="text-sm">{estimate.title}</p>
                    <p className="text-xs text-muted">Issue {estimate.issueDate || "—"} · Expires {estimate.expiresOn || "—"}</p>
                    <p className="mt-1 font-mono">{moneyLabel(estimate.totalCents, estimate.currency)}</p>
                  </div>
                  <Badge tone={statusTone(estimate.status)}>{estimate.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="invoices" className="mb-8 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold">Published invoices</h2>
        {data.invoices.length === 0 ? (
          <Card><p className="text-sm text-muted">No published invoices are visible yet.</p></Card>
        ) : (
          <div className="grid gap-3">
            {data.invoices.map((invoice) => (
              <Card key={invoice.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/client/invoices/${invoice.id}`} className="font-semibold hover:underline">{invoice.invoiceNumber}</Link>
                    <p className="text-xs text-muted">Issue {invoice.issueDate || "—"} · Due {invoice.dueDate || "—"}</p>
                    <p className="mt-1 font-mono">{moneyLabel(invoice.totalCents, invoice.currency)}</p>
                  </div>
                  <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="projects" className="mb-8 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold">Published projects</h2>
        {data.projects.length === 0 ? (
          <Card><p className="text-sm text-muted">No published projects are visible yet.</p></Card>
        ) : (
          <div className="grid gap-3">
            {data.projects.map((project) => (
              <Card key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/client/projects/${project.id}`} className="font-semibold hover:underline">{project.name}</Link>
                    <p className="text-xs text-muted">Start {project.startDate || "—"} · Deadline {project.deadline || "—"}</p>
                  </div>
                  <Badge tone={statusTone(project.status)}>{project.status.replaceAll("_", " ")}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="documents" className="scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold">Published documents</h2>
        {data.documents.length === 0 ? (
          <Card><p className="text-sm text-muted">No published documents are visible yet.</p></Card>
        ) : (
          <div className="grid gap-3">
            {data.documents.map((document) => (
              <Card key={document.id}>
                <p className="font-medium">{document.title}</p>
                {document.description ? <p className="mt-1 text-sm text-muted">{document.description}</p> : null}
                <p className="mt-2 text-xs text-muted">Authenticated download only. Storage paths are not shown.</p>
                <Link className="btn-secondary mt-3 inline-flex h-10 items-center rounded-md px-4 text-sm" href={`/client/documents/${document.id}/download`}>
                  Download
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
