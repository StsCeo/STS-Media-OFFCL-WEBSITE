import { notFound } from "next/navigation";
import { Badge, Card, PageHeader } from "@/components/ui";
import { loadClientPortalProject } from "@/lib/org/client-portal";

export const metadata = { title: "Project" };
export const dynamic = "force-dynamic";

export default async function ClientProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadClientPortalProject(id);
  if (!data.project) notFound();
  const project = data.project;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Published project" title={project.name} description="Client-facing project status only. Budgets, assignments, tasks, and internal notes are not shown." />
      <Card className="space-y-3">
        <Badge>{project.status.replaceAll("_", " ")}</Badge>
        <p className="text-sm">Start {project.startDate || "—"} · Deadline {project.deadline || "—"}</p>
        {project.description ? <p className="whitespace-pre-wrap text-sm">{project.description}</p> : <p className="text-sm text-muted">No client-facing description was published.</p>}
      </Card>
    </div>
  );
}
