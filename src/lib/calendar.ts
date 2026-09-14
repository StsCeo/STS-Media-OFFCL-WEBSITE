import { addDays, addMonths, addWeeks, format, startOfMonth, startOfWeek } from "date-fns";

export type CalendarView = "month" | "week" | "agenda";

export function calendarDays(view: Exclude<CalendarView, "agenda">, cursor: Date, weekStartsOn: 0 | 1 = 0) {
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn });
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function shiftCalendarCursor(cursor: Date, view: CalendarView, direction: -1 | 1) {
  if (view === "week") return addWeeks(cursor, direction);
  return addMonths(cursor, direction);
}

export function calendarPeriodLabel(view: CalendarView, cursor: Date) {
  if (view === "week") {
    const days = calendarDays("week", cursor);
    const start = days[0];
    const end = days[6];
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) return `${format(start, "MMM d")} – ${format(end, "d, yyyy")}`;
    if (sameYear) return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }
  return format(cursor, "MMMM yyyy");
}
