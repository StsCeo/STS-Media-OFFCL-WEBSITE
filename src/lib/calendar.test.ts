import { describe, expect, it } from "vitest";
import { calendarDays, calendarPeriodLabel, shiftCalendarCursor } from "./calendar";

describe("calendar week view", () => {
  it("shows the selected week rather than the first week of the month", () => {
    const cursor = new Date(2026, 8, 11);
    const days = calendarDays("week", cursor);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual(new Date(2026, 8, 6));
    expect(days[6]).toEqual(new Date(2026, 8, 12));
    expect(days.some((day) => day.getDate() === 11 && day.getMonth() === 8)).toBe(true);
    expect(calendarPeriodLabel("week", cursor)).toBe("Sep 6 – 12, 2026");
  });

  it("handles a week that crosses a month and year boundary", () => {
    const cursor = new Date(2026, 11, 30);
    const days = calendarDays("week", cursor);
    expect(days[0]).toEqual(new Date(2026, 11, 27));
    expect(days[6]).toEqual(new Date(2027, 0, 2));
    expect(calendarPeriodLabel("week", cursor)).toBe("Dec 27, 2026 – Jan 2, 2027");
  });

  it("moves previous and next week across year boundaries", () => {
    const start = new Date(2027, 0, 1);
    const previous = shiftCalendarCursor(start, "week", -1);
    const next = shiftCalendarCursor(new Date(2026, 11, 30), "week", 1);
    expect(calendarDays("week", previous)[0]).toEqual(new Date(2026, 11, 20));
    expect(calendarDays("week", previous)[6]).toEqual(new Date(2026, 11, 26));
    expect(calendarDays("week", next)[0]).toEqual(new Date(2027, 0, 3));
    expect(calendarDays("week", next)[6]).toEqual(new Date(2027, 0, 9));
  });
});
