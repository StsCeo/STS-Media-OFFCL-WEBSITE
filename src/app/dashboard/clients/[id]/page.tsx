import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ClientEditor } from "@/components/dashboard/client-editor";
import { ClientJourney } from "@/components/dashboard/client-journey";
import { CrmSubnav } from "@/components/dashboard/crm-subnav";
import { loadVisibleCrmRecords } from "@/lib/org/crm-context";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";
import { loadVisibleEstimates } from "@/lib/org/estimates-context";
import { loadClientPortalOwnerIndex } from "@/lib/org/client-portal";
import { deriveClientJourney } from "@/lib/org/client-journey";
import { clientHealth } from "@/lib/org/client-health";
import { formatCurrency } from "@/lib/utils";
import { centsToDollars } from "@/lib/money";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const crm = await loadVisibleCrmRecords();
  const client = crm.clients.find((item) => item.id === id);
  if (!client) notFound();
  const ops = await loadVisibleOpsRecords();
  const workspace = await loadVisibleWorkspaceRecords();
  const estimatesCtx = await loadVisibleEstimates();
  const portal = await loadClientPortalOwnerIndex();
  const projects = ops.projects.filter((item) => item.clientId === client.id);
  const invoices = workspace.invoices.filter((item) => item.clientId === client.id);
  const estimates = estimatesCtx.estimates.filter((item) => item.clientId === client.id);
  const tasks = ops.tasks.filter((item) => item.clientId === client.id);
  const lead = crm.leads.find((item) => item.convertedClientId === client.id);
  const icp = lead?.icpId ? crm.icps.find((item) => item.id === lead.icpId) : undefined;
  const portalPublished = portal.publications.some((item) => item.crmClientId === client.id && item.published);
  const identity = portal.identities.find((item) => item.crmClientId === client.id && item.status === "active");
  const paid = invoices.filter((item) => item.status === "paid").reduce((sum, item) => sum + centsToDollars(item.amountPaidCents), 0);
  const health = clientHealth({ invoices, projects, tasks, lead });
  const journey = deriveClientJourney({
    lead,
    estimates,
    invoices,
    projects,
    portalPublished: portalPublished || Boolean(identity),
    events: workspace.events.filter((event) => event.clientId === client.id),
  });

  return (
    <div>
      <PageHeader eyebrow={client.industry || "Client"} title={client.businessName} description={client.notes} />
      <CrmSubnav current="/dashboard/clients" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{client.status}</Badge>
        <Badge tone={health.tone}>{health.label}</Badge>
      </div>
      <p className="mb-6 text-sm text-muted">{health.reason}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Client journey</h2>
          <p className="mb-4 mt-1 text-xs text-muted">Stages complete only when a supporting record exists. Later phases stay future until those systems ship.</p>
          <ClientJourney steps={journey} />
        </Card>
        <Card>
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-3 text-sm">{client.contactName || "No contact name"}</p>
          <p className="text-sm">{client.email || "No email"}</p>
          <p className="text-sm">{client.phone || "No phone"}</p>
          <p className="mt-4 text-sm">Portal: {identity ? "Mapped" : portalPublished ? "Published records" : "Not enabled"}</p>
          {lead ? (
            <p className="mt-4 text-sm">
              Original lead: {lead.businessName} · {lead.stage.replaceAll("_", " ")}
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">No associated original lead.</p>
          )}
          {icp ? <p className="mt-2 text-sm">ICP: {icp.name}</p> : null}
          <p className="mt-4 font-mono text-sm">Collected {formatCurrency(paid)}</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="font-semibold">Projects</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {projects.map((project) => (
              <li key={project.id}>
                <a className="underline-offset-2 hover:underline" href={`/dashboard/projects/${project.id}`}>{project.name}</a>
                <span className="text-muted"> · {project.stage.replaceAll("_", " ")}</span>
              </li>
            ))}
          </ul>
          {!projects.length ? <p className="mt-3 text-sm text-muted">No projects yet.</p> : null}
        </Card>
        <Card>
          <h2 className="font-semibold">Estimates</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {estimates.map((estimate) => (
              <li key={estimate.id}>
                {estimate.estimateNumber} · {estimate.status} · {formatCurrency(centsToDollars(estimate.totalCents))}
              </li>
            ))}
          </ul>
          {!estimates.length ? <p className="mt-3 text-sm text-muted">No estimates yet.</p> : null}
        </Card>
        <Card>
          <h2 className="font-semibold">Invoices</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                {invoice.invoiceNumber} · {invoice.status} · {formatCurrency(centsToDollars(invoice.totalCents))}
              </li>
            ))}
          </ul>
          {!invoices.length ? <p className="mt-3 text-sm text-muted">No invoices yet.</p> : null}
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 font-semibold">Edit client</h2>
        <ClientEditor client={client} />
      </Card>
    </div>
  );
}
