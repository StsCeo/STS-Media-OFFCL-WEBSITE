import { CalendarBoard } from "./calendar-board";
import { CalendarForm } from "@/components/dashboard/calendar-form";
import { Card, PageHeader } from "@/components/ui";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Calendar & Automations" };

export default async function CalendarPage() {
  const { events, clients, projects, source, unavailable, recordNote } = await loadVisibleWorkspaceRecords();
  return (
    <div>
      <PageHeader
        title="Calendar & Automations"
        description="Internal meetings and deadlines. Times are stored in UTC and shown in the event timezone. External Google/Outlook sync, email, and reminders are not implemented."
      />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Calendar events could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">{recordNote}</p> : null}
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add event</h2>
        <CalendarForm clients={clients} projects={projects} />
      </Card>
      <CalendarBoard events={events} />
      <div className="mt-6 grid gap-4">
        {events.map((event) => (
          <Card key={event.id}>
            <h2 className="mb-3 font-semibold">{event.title}</h2>
            <CalendarForm event={event} clients={clients} projects={projects} />
          </Card>
        ))}
      </div>
    </div>
  );
}
