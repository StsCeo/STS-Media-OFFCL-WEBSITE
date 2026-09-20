"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format, isSameMonth } from "date-fns";
import { Button, Badge, Card } from "@/components/ui";
import { calendarDays, calendarPeriodLabel, shiftCalendarCursor, type CalendarView } from "@/lib/calendar";
import { eventFallsOnDay, formatEventInstant } from "@/lib/org/workspace-model";
import {
  filterCalendarEvents,
  filterSchedule,
  scheduleBucket,
  scheduleItemHref,
  scheduleSourceLabel,
} from "@/lib/org/schedule-model";
import type { CalendarEvent, InternalScheduleItem, ScheduleViewFilter } from "@/lib/types";

function bucketTone(bucket: ReturnType<typeof scheduleBucket>): "info" | "warning" | "danger" {
  if (bucket === "today") return "info";
  if (bucket === "overdue") return "danger";
  return "warning";
}

export function CalendarBoard({
  events,
  schedule,
  now = new Date(),
}: {
  events: CalendarEvent[];
  schedule: InternalScheduleItem[];
  now?: Date;
}) {
  const [view, setView] = useState<CalendarView>("month");
  const [filter, setFilter] = useState<ScheduleViewFilter>("all");
  const [cursor, setCursor] = useState(now);
  const today = now.toISOString().slice(0, 10);
  const days = useMemo(
    () => (view === "agenda" ? [] : calendarDays(view, cursor)),
    [view, cursor],
  );
  const visibleEvents = useMemo(() => filterCalendarEvents(events, filter, today), [events, filter, today]);
  const visibleSchedule = useMemo(() => filterSchedule(schedule, filter, today), [schedule, filter, today]);

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
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Schedule filters">
        <Button size="sm" variant={filter === "all" ? "primary" : "secondary"} onClick={() => setFilter("all")}>All</Button>
        <Button size="sm" variant={filter === "today" ? "primary" : "secondary"} onClick={() => setFilter("today")}>Today</Button>
        <Button size="sm" variant={filter === "upcoming" ? "primary" : "secondary"} onClick={() => setFilter("upcoming")}>Upcoming</Button>
        <Button size="sm" variant={filter === "overdue" ? "primary" : "secondary"} onClick={() => setFilter("overdue")}>Overdue</Button>
      </div>
      <Card className="mb-4">
        <h2 className="mb-3 font-semibold">Unified schedule</h2>
        {visibleSchedule.length ? (
          <ul className="space-y-2">
            {visibleSchedule.map((item) => {
              const bucket = scheduleBucket(item.occursOn, today);
              return (
                <li key={item.id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-xs text-muted">{item.occursOn} · {item.sourceStatus.replaceAll("_", " ")}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone="info">{scheduleSourceLabel(item.sourceType)}</Badge>
                      <Badge tone={bucketTone(bucket)}>{bucket}</Badge>
                      {item.generated ? <Badge>System</Badge> : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm">
                    <Link className="underline-offset-2 hover:underline" href={scheduleItemHref(item)}>Open source</Link>
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No schedule items in this view.</p>
        )}
      </Card>
      {view === "agenda" ? (
        <ul className="space-y-2">
          {visibleEvents.map((event) => (
            <li key={event.id} className="rounded-md border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{event.title}</p>
                {event.generated ? <Badge>System</Badge> : <Badge tone="neutral">Manual</Badge>}
                <Badge tone="info">{scheduleSourceLabel(event.sourceType || "manual")}</Badge>
              </div>
              <p className="text-xs text-muted">
                {event.kind.replaceAll("_", " ")} · {formatEventInstant(event.start, event.timezone || "UTC", event.allDay)} · {event.timezone || "UTC"} · {event.location || "No location"}
              </p>
              {event.notes ? <p className="text-sm">{event.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[40rem] grid-cols-7 gap-1 text-xs md:min-w-0">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="p-2 text-muted">{d}</div>)}
            {days.map((day) => {
              const dayEvents = visibleEvents.filter((event) => eventFallsOnDay(event, day));
              return (
                <div key={day.toISOString()} className={`min-h-24 rounded-md border border-line p-1 ${isSameMonth(day, cursor) ? "bg-card" : "bg-canvas"}`}>
                  <p className="text-[11px]">{view === "week" ? format(day, "MMM d") : format(day, "d")}</p>
                  {dayEvents.map((event) => (
                    <p key={event.id} className="mt-1 rounded bg-forest/10 px-1 text-[10px]">
                      {event.generated ? "Sys · " : ""}{event.title}
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Card className="mt-4">
        <p className="text-sm text-muted">Internal calendar only. Google, Apple, Outlook, Zoom, Calendly, email, SMS, push, recurrence, and reminders are not connected. System-generated rows stay linked to their source record.</p>
      </Card>
    </div>
  );
}
