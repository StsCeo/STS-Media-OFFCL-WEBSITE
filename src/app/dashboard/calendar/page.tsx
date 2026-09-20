import { CalendarBoard } from "./calendar-board";
import { CalendarForm } from "@/components/dashboard/calendar-form";
import { ReconcileScheduleForm } from "@/components/dashboard/reconcile-schedule-form";
import { Card, PageHeader } from "@/components/ui";
import { loadVisibleWorkspaceRecords } from "@/lib/org/workspace-context";

export const metadata = { title: "Calendar & Automations" };

export default async function CalendarPage() {
  const { events, schedule, clients, projects, source, unavailable, scheduleNote } = await loadVisibleWorkspaceRecords();
  const manualEvents = events.filter((event) => !event.generated);
  return (
    <div>
      <PageHeader
        title="Calendar & Automations"
        description="Internal meetings, source dates, and system-generated schedule rows. Times are stored in UTC. External Google/Outlook/Apple sync, email, SMS, push, cron, and reminders are not implemented."
      />
      {unavailable ? (
        <Card className="mb-4">
          <p className="text-sm text-muted">Calendar events could not be loaded from the database. Nothing was written to a local fallback.</p>
        </Card>
      ) : null}
      {source === "postgres" ? <p className="mb-4 text-xs text-muted">{scheduleNote}</p> : <p className="mb-4 text-xs text-muted">{scheduleNote} Demo sessions derive generated rows in memory.</p>}
      <Card className="mb-6">
        <h2 className="mb-3 font-semibold">Reconcile generated entries</h2>
        <p className="mb-3 text-sm text-muted">Owner/administrator action. Repeating this does not create duplicates. It does not email anyone or sync an outside calendar.</p>
        <ReconcileScheduleForm />
      </Card>
      <Card id="add" className="mb-6">
        <h2 className="mb-4 font-semibold">Add manual event</h2>
        <CalendarForm clients={clients} projects={projects} />
      </Card>
      <CalendarBoard events={events} schedule={schedule} />
      <div className="mt-6 grid gap-4">
        {manualEvents.map((event) => (
          <Card key={event.id}>
            <h2 className="mb-3 font-semibold">{event.title}</h2>
            <CalendarForm event={event} clients={clients} projects={projects} />
          </Card>
        ))}
        {events.filter((event) => event.generated).map((event) => (
          <Card key={event.id}>
            <CalendarForm event={event} clients={clients} projects={projects} />
          </Card>
        ))}
      </div>
    </div>
  );
}
