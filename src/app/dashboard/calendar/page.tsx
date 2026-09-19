import { CalendarBoard } from "./calendar-board";
import { PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Calendar & Automations" };

export default function CalendarPage() {
  return (
    <div>
      <PageHeader
        title="Calendar & Automations"
        description="Meetings, deadlines, follow-ups, content, invoices, and renewals. Calendar automations are planned for a later phase."
      />
      <CalendarBoard events={getWorkspace().events} />
    </div>
  );
}
