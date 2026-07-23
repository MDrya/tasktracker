import type { Task } from "./types";

/** The date a task counts under for a report: its own due date, falling
 *  back to when it was created for orders that never got one. */
export function reportDate(task: Task): string {
  return task.due_date ?? task.created_at.slice(0, 10);
}

/** Parse a "YYYY-MM" query param, defaulting to the current month.
 *  Returns the month plus its inclusive start/end ISO dates. */
export function resolveMonth(monthParam: string | null): {
  month: string;
  start: string;
  end: string;
} {
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, "0")}`;
  return { month, start, end };
}

/** Tasks whose report date falls within [start, end], sorted by that date. */
export function tasksInRange(tasks: Task[], start: string, end: string): Task[] {
  return tasks
    .filter((t) => {
      const d = reportDate(t);
      return d >= start && d <= end;
    })
    .sort((a, b) => (reportDate(a) < reportDate(b) ? -1 : 1));
}
