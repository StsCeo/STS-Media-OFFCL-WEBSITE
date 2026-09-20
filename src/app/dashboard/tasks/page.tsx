import { Badge, Card, PageHeader } from "@/components/ui";
import { TaskEditor } from "@/components/dashboard/task-editor";
import { loadVisibleOpsRecords } from "@/lib/org/operations-context";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const { tasks, clients, projects, source, unavailable } = await loadVisibleOpsRecords();
  return (
    <div>
      <PageHeader title="Tasks" description="Owner work queue, including recurring follow-ups and launch blockers." />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Tasks could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">Tasks are stored on the organization record.</p> : null}
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add task</h2>
        <TaskEditor clients={clients} projects={projects} />
      </Card>
      <div className="grid gap-3">
        {tasks.map((task) => (
          <Card key={task.id} className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-xs text-muted">{task.assignee} · due {task.dueDate ?? "unscheduled"}</p>
              </div>
              <div className="flex gap-2">
                <Badge tone={task.priority === "high" ? "danger" : "neutral"}>{task.priority}</Badge>
                <Badge>{task.status.replaceAll("_", " ")}</Badge>
              </div>
            </div>
            <TaskEditor task={task} clients={clients} projects={projects} />
          </Card>
        ))}
      </div>
    </div>
  );
}
