"use client";

import { useMemo, useState } from "react";
import { addDays, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { Button, Card } from "@/components/ui";
import type { CalendarEvent } from "@/lib/types";

export function CalendarBoard({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = useState(new Date("2026-09-11"));
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(start, i)), [start]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant={view === "month" ? "primary" : "secondary"} onClick={() => setView("month")}>Month</Button>
        <Button size="sm" variant={view === "week" ? "primary" : "secondary"} onClick={() => setView("week")}>Week</Button>
        <Button size="sm" variant={view === "agenda" ? "primary" : "secondary"} onClick={() => setView("agenda")}>Agenda</Button>
        <Button size="sm" variant="secondary" onClick={() => setCursor(addDays(cursor, view === "month" ? 30 : 7))}>Next</Button>
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
          {(view === "week" ? days.slice(0, 7) : days).map((day) => {
            const dayEvents = events.filter((event) => isSameDay(parseISO(event.start), day));
            return (
              <div key={day.toISOString()} className={`min-h-24 rounded-md border border-line p-1 ${isSameMonth(day, cursor) ? "bg-card" : "bg-canvas"}`}>
                <p className="text-[11px]">{format(day, "d")}</p>
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
