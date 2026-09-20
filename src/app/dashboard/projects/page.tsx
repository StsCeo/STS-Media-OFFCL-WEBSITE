import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ProjectEditor } from "@/components/dashboard/project-editor";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { formatCurrency } from "@/lib/utils";
import { PROJECT_STAGES } from "@/lib/types";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { projects, clients, tasks, source, unavailable, estimateNote } = await loadVisibleOpsRecords();
  return (
    <div>
      <PageHeader title="Projects" description="Delivery stages, money, and risk. Credentials are stored as a vault location reference only." />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Projects could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">{estimateNote}</p> : null}
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add project</h2>
        <ProjectEditor clients={clients} />
      </Card>
      <div className="flex gap-2 overflow-x-auto pb-3 text-xs">
        {PROJECT_STAGES.map((stage) => (
          <div key={stage} className="rounded-md border border-line px-3 py-2">
            {stage.replaceAll("_", " ")} · {projects.filter((p) => p.stage === stage).length}
          </div>
        ))}
      </div>
      <div className="grid gap-4">
        {projects.map((project) => {
          const client = clients.find((c) => c.id === project.clientId);
          const open = tasks.filter((t) => t.projectId === project.id && t.status !== "done");
          return (
            <Card key={project.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/dashboard/projects/${project.id}`} className="text-lg font-semibold hover:underline">{project.name}</Link>
                  <p className="text-sm text-muted">{client?.businessName || "No client"} · {project.stage.replaceAll("_", " ")}</p>
                </div>
                {project.atRisk ? <Badge tone="warning">At risk</Badge> : <Badge tone="success">Tracked</Badge>}
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
                <div><dt className="text-muted">Budget</dt><dd className="font-mono">{formatCurrency(project.budget)}</dd></div>
                <div><dt className="text-muted">Invoiced</dt><dd className="font-mono">{formatCurrency(project.amountInvoiced)}</dd></div>
                <div><dt className="text-muted">Collected</dt><dd className="font-mono">{formatCurrency(project.amountCollected)}</dd></div>
                <div><dt className="text-muted">Profit</dt><dd className="font-mono">{formatCurrency(project.amountCollected - project.directCost)}</dd></div>
              </dl>
              <p className="mt-2 text-sm">{open.length} open tasks · deadline {project.deadline || "none"}</p>
              <div className="mt-4 border-t border-line pt-4">
                <ProjectEditor project={project} clients={clients} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
