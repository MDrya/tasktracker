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
 * A task counts as finished once every one of its subtasks is checked off.
 *
 * A task with no subtasks can never be "complete" — there's nothing to
 * check off — so it keeps its normal urgency position rather than being
 * treated as done and sent to the bottom.
 */
export function isTaskComplete(task: Task): boolean {
  return task.subtasks.length > 0 && task.subtasks.every((st) => st.done);
}

export interface DueSummary {
  overdue: number;
  today: number;
  soon: number; // due within SOON_DAYS, not counting today
  total: number;
}

/** How many days ahead still counts as "warn me about this". */
export const SOON_DAYS = 2;

/**
 * Counts of orders needing attention, by effective due date.
 *
 * Finished orders are excluded — warning about work that is already done
 * is just noise, and it would make the banner impossible to clear.
 *
 * Shared by the in-app banner and the daily push digest so the two can
 * never drift into disagreeing about what counts as urgent.
 */
export function summarizeDue(tasks: Task[]): DueSummary {
  let overdue = 0;
  let today = 0;
  let soon = 0;

  for (const task of tasks) {
    if (isTaskComplete(task)) continue;
    const due = effectiveDueDate(task);
    if (!due) continue;
    const days = daysUntil(due);
    if (days < 0) overdue++;
    else if (days === 0) today++;
    else if (days <= SOON_DAYS) soon++;
  }

  return { overdue, today, soon, total: overdue + today + soon };
}

/** Human phrase for a summary, e.g. "2 overdue · 1 due today". */
export function describeDue(summary: DueSummary): string {
  const parts: string[] = [];
  if (summary.overdue > 0) parts.push(`${summary.overdue} overdue`);
  if (summary.today > 0) parts.push(`${summary.today} due today`);
  if (summary.soon > 0) parts.push(`${summary.soon} due soon`);
  return parts.join(" · ");
}

/**
 * Sort tasks by effective due date, soonest first. Tasks with no date
 * anywhere sort last; ties break by creation time so order is stable.
 *
 * Finished tasks always sink below unfinished ones, so checking off the
 * last subtask visibly drops the task to the bottom of the board. Urgency
 * ordering still applies within each group.
 */
export function sortByUrgency(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ca = isTaskComplete(a);
    const cb = isTaskComplete(b);
    if (ca !== cb) return ca ? 1 : -1;

    const da = effectiveDueDate(a);
    const db = effectiveDueDate(b);
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (da && !db) return -1;
    if (!da && db) return 1;
    return a.created_at < b.created_at ? -1 : 1;
  });
}
