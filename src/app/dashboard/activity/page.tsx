import { Card, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Activity" };

export default function ActivityPage() {
  const events = getWorkspace().auditLog;
  return (
    <div>
      <PageHeader title="Activity log" description="Owner actions recorded in this workspace. Secrets are never written here." />
      <div className="space-y-3">
        {events.map((event) => (
          <Card key={event.id} className="p-4">
            <p className="text-xs text-muted">{event.at} · {event.actor}</p>
            <p className="mt-1 font-medium">{event.action.replaceAll("_", " ")}</p>
            <p className="text-sm">{event.detail}</p>
            <p className="mt-1 text-xs text-muted">Target: {event.target}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
