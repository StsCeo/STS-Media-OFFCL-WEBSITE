import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";
import { formatCurrency } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = getWorkspace();
  const project = workspace.projects.find((item) => item.id === id);
  if (!project) notFound();
  const client = workspace.clients.find((item) => item.id === project.clientId);
  const tasks = workspace.tasks.filter((item) => item.projectId === project.id);
  const miles = workspace.milestones.filter((item) => item.projectId === project.id);
  return (
    <div>
      <PageHeader eyebrow={client?.businessName} title={project.name} description={project.notes} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold">Delivery</h2>
          <p className="mt-2 text-sm">Stage: {project.stage.replaceAll("_", " ")}</p>
          <p className="text-sm">Start {project.startDate} · Deadline {project.deadline}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex justify-between gap-2">
                <span>{task.title}</span>
                <Badge>{task.status.replaceAll("_", " ")}</Badge>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 font-semibold">Milestones</h3>
          <ul className="mt-2 text-sm">
            {miles.map((item) => (
              <li key={item.id}>{item.title} · {item.dueDate} · {item.status}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold">Money</h2>
          <p className="mt-2 font-mono">Budget {formatCurrency(project.budget)}</p>
          <p className="font-mono">Invoiced {formatCurrency(project.amountInvoiced)}</p>
          <p className="font-mono">Collected {formatCurrency(project.amountCollected)}</p>
          <p className="font-mono">Direct cost {formatCurrency(project.directCost)}</p>
          <p className="mt-4 text-sm">Maintenance: {project.maintenancePlan}</p>
          <p className="mt-4 text-xs text-muted">GitHub: {project.githubRepo || "Needs setup"}</p>
          <p className="text-xs text-muted">Vercel: {project.vercelProject || "Needs setup"}</p>
          <p className="text-xs text-muted">URL: {project.productionUrl || "Add after launch"}</p>
          <p className="text-xs text-muted">Domain: {project.domain || "Add after launch"}</p>
          <p className="mt-4 text-xs">Credentials reference: {project.credentialsReference}</p>
        </Card>
      </div>
    </div>
  );
}
