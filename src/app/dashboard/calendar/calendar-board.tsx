"use client";

import { useMemo, useState } from "react";
import { format, isSameDay, isSameMonth, parseISO } from "date-fns";
import { Button, Card } from "@/components/ui";
import { calendarDays, calendarPeriodLabel, shiftCalendarCursor, type CalendarView } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";

export function CalendarBoard({ events, now = new Date() }: { events: CalendarEvent[]; now?: Date }) {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(now);
  const days = useMemo(
    () => (view === "agenda" ? [] : calendarDays(view, cursor)),
    [view, cursor],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "month" ? "primary" : "secondary"} onClick={() => setView("month")}>Month</Button>
        <Button size="sm" variant={view === "week" ? "primary" : "secondary"} onClick={() => setView("week")}>Week</Button>
        <Button size="sm" variant={view === "agenda" ? "primary" : "secondary"} onClick={() => setView("agenda")}>Agenda</Button>
        {view !== "agenda" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setCursor(shiftCalendarCursor(cursor, view, -1))}>Previous</Button>
            <Button size="sm" variant="secondary" onClick={() => setCursor(shiftCalendarCursor(cursor, view, 1))}>Next</Button>
          </>
        ) : null}
        <p className="text-sm font-medium" aria-live="polite">{calendarPeriodLabel(view, cursor)}</p>
      </div>
      {view === "agenda" ? (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-md border border-line p-3">
              <p className="font-medium">{event.title}</p>
              <p className="text-xs text-muted">{event.kind.replaceAll("_", " ")} · {event.start} · {event.location || "No location"}</p>
              <p className="text-sm">{event.notes}</p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="p-2 text-muted">{d}</div>)}
          {days.map((day) => {
            const dayEvents = events.filter((event) => isSameDay(parseISO(event.start), day));
            return (
              <div key={day.toISOString()} className={`min-h-24 rounded-md border border-line p-1 ${isSameMonth(day, cursor) ? "bg-card" : "bg-canvas"}`}>
                <p className="text-[11px]">{view === "week" ? format(day, "MMM d") : format(day, "d")}</p>
                {dayEvents.map((event) => (
                  <p key={event.id} className="mt-1 rounded bg-forest/10 px-1 text-[10px]">{event.title}</p>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <Card className="mt-4">
        <p className="text-sm text-muted">Zoom and Calendly remain placeholders until OAuth is approved. Recurring tasks and invoice dates appear as calendar kinds.</p>
      </Card>
    </div>
  );
}
