import { Badge, Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Tasks" };

export default function TasksPage() {
  const tasks = getWorkspace().tasks;
  return (
    <div>
      <PageHeader title="Tasks" description="Owner work queue, including recurring follow-ups and launch blockers." />
      <div className="grid gap-3">
        {tasks.map((task) => (
          <Card key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-muted">{task.assignee} · due {task.dueDate ?? "unscheduled"}</p>
            </div>
            <div className="flex gap-2">
              <Badge tone={task.priority === "high" ? "danger" : "neutral"}>{task.priority}</Badge>
              <Badge>{task.status.replaceAll("_", " ")}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
