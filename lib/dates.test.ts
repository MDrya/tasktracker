import { describe, expect, it } from "vitest";
import { dayDiff, parseDate, startOfWeek, toISODate } from "./dates";

describe("dates", () => {
  it("parses ISO dates as local midnight", () => {
    const d = parseDate("2026-09-11");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 11, 0]);
    expect(toISODate(d)).toBe("2026-09-11");
  });

  it("counts whole days between dates", () => {
    expect(dayDiff("2026-09-09", "2026-09-11")).toBe(2);
    expect(dayDiff("2026-09-11", "2026-09-09")).toBe(-2);
    expect(dayDiff("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("starts weeks on Monday, including for Sundays", () => {
    expect(toISODate(startOfWeek(new Date(2026, 8, 13)))).toBe("2026-09-07"); // Sunday
    expect(toISODate(startOfWeek(new Date(2026, 8, 7)))).toBe("2026-09-07"); // Monday
  });
});
