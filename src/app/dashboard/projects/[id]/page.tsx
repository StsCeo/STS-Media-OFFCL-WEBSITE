import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ProjectEditor } from "@/components/dashboard/project-editor";
import { getWorkspace } from "@/lib/data/store";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";
import { formatCurrency } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { projects, clients, tasks, source } = await loadVisibleOpsRecords();
  const project = projects.find((item) => item.id === id);
  if (!project) notFound();
  const client = clients.find((item) => item.id === project.clientId);
  const projectTasks = tasks.filter((item) => item.projectId === project.id);
  const miles = source === "demo-memory"
    ? getWorkspace().milestones.filter((item) => item.projectId === project.id)
    : [];
  return (
    <div>
      <PageHeader eyebrow={client?.businessName || "Project"} title={project.name} description={project.notes} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Delivery</h2>
          <p className="mt-2 text-sm">Stage: {project.stage.replaceAll("_", " ")}</p>
          <p className="text-sm">Start {project.startDate || "n/a"} · Deadline {project.deadline || "n/a"}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {projectTasks.map((task) => (
              <li key={task.id} className="flex justify-between gap-2">
                <span>{task.title}</span>
                <Badge>{task.status.replaceAll("_", " ")}</Badge>
              </li>
            ))}
          </ul>
          {miles.length ? (
            <>
              <h3 className="mt-6 font-semibold">Milestones</h3>
              <ul className="mt-2 text-sm">
                {miles.map((item) => (
                  <li key={item.id}>{item.title} · {item.dueDate} · {item.status}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Card>
        <Card>
          <h2 className="font-semibold">Money</h2>
          <p className="mt-2 font-mono">Budget {formatCurrency(project.budget)}</p>
          <p className="font-mono">Invoiced {formatCurrency(project.amountInvoiced)}</p>
          <p className="font-mono">Collected {formatCurrency(project.amountCollected)}</p>
          <p className="font-mono">Direct cost {formatCurrency(project.directCost)}</p>
          <p className="mt-4 text-sm">Maintenance: {project.maintenancePlan || "n/a"}</p>
          <p className="mt-4 text-xs">Credentials reference: {project.credentialsReference}</p>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="mb-4 font-semibold">Edit project</h2>
        <ProjectEditor project={project} clients={clients} />
      </Card>
    </div>
  );
}
