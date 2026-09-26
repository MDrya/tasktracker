// Date helpers shared by the board, calendar and analytics. Dates stored as
// "YYYY-MM-DD" are always handled as local midnight, never as UTC.

const DAY_MS = 86_400_000;

/** Parse "YYYY-MM-DD" as local midnight (`new Date(iso)` would give UTC
 *  midnight, which is the previous day in western time zones). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Local calendar date of `d` as "YYYY-MM-DD". */
export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Whole days from `a` to `b` (both "YYYY-MM-DD"); negative if b is earlier. */
export function dayDiff(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY_MS);
}

/** Monday of the week containing `d`, at local midnight. */
export function startOfWeek(d: Date): Date {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = monday.getDay();
  monday.setDate(monday.getDate() - (dow === 0 ? 6 : dow - 1));
  return monday;
}

/** "11 Sept" style label for a "YYYY-MM-DD" date. */
export function shortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Days (fractional) between two timestamps, never negative. */
export function daysBetween(from: string, to: string): number {
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / DAY_MS);
}
