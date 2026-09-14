import { CalendarBoard } from "./calendar-board";
import { PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data/store";

export const metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <div>
      <PageHeader title="Calendar" description="Meetings, deadlines, follow-ups, content, invoices, and renewals." />
      <CalendarBoard events={getWorkspace().events} />
    </div>
  );
}
