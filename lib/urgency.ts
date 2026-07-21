import type { Task, UrgencyLevel } from "./types";

/** Parse an ISO "YYYY-MM-DD" date as local midnight (avoids the UTC
 *  off-by-one you get from `new Date("2026-01-01")` in western zones). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from today (local) to the given date. 0 = today, negative = past. */
export function daysUntil(iso: string): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseDate(iso).getTime() - today.getTime()) / 86_400_000);
}

/**
 * The date that determines a task's position in the list: the soonest of
 * the task's own due date and its subtasks' due dates.
 *
 * Default decision: subtasks that are already done are excluded — a
 * completed subtask shouldn't keep a task looking urgent, and it makes
 * checking a subtask off visibly re-sort the list.
 */
export function effectiveDueDate(task: Task): string | null {
  const dates: string[] = [];
  if (task.due_date) dates.push(task.due_date);
  for (const st of task.subtasks) {
    if (!st.done && st.due_date) dates.push(st.due_date);
  }
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min)); // ISO strings compare lexicographically
}

/** Urgency buckets used for badge coloring. */
export function urgencyLevel(iso: string | null): UrgencyLevel {
  if (!iso) return "none";
  const days = daysUntil(iso);
  if (days < 0) return "overdue";
  if (days <= 2) return "urgent";
  if (days <= 7) return "soon";
  return "later";
}

/** Short human label for a due date, e.g. "Overdue 3d", "Today", "Jul 28". */
export function dueLabel(iso: string): string {
  const days = daysUntil(iso);
  if (days < 0) return `Overdue ${-days}d`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return parseDate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Sort tasks by effective due date, soonest first. Tasks with no date
 * anywhere sort last; ties break by creation time so order is stable.
 */
export function sortByUrgency(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const da = effectiveDueDate(a);
    const db = effectiveDueDate(b);
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (da && !db) return -1;
    if (!da && db) return 1;
    return a.created_at < b.created_at ? -1 : 1;
  });
}
