import type { Label, Task } from "./types";
import { daysUntil, effectiveDueDate } from "./urgency";

/**
 * Production-stage workload, measured in pieces rather than orders.
 *
 * The question this answers is "how many kaos are still queued at this
 * stage", which is what decides whether the workshop can take more work.
 * Counting orders instead would treat a 5-piece order and a 500-piece
 * order as the same load.
 */
export interface StageLoad {
  label: Label;
  /** Orders that still need this stage. */
  orders: number;
  /** Pieces across those orders. */
  kaos: number;
  /** Orders counted above that have no piece count recorded. */
  missingCount: number;
  /** How many of those orders are already past their due date. */
  overdue: number;
  /** Soonest effective due date among them, ISO, or null if none have one. */
  soonestDue: string | null;
}

/**
 * Whether an order still has work to do at this stage.
 *
 * A stage is represented by a label carried on a *subtask* — the subtask
 * is the actual unit of work. An order that has no subtask for a stage
 * simply doesn't pass through it and is never counted, which is what
 * keeps the totals honest for orders that skip steps.
 */
export function stageNeedsWork(task: Task, labelId: string): boolean {
  return task.subtasks.some(
    (st) => !st.done && st.labels.some((l) => l.id === labelId)
  );
}

/** Whether this order passes through the stage at all, done or not. */
export function stageApplies(task: Task, labelId: string): boolean {
  return task.subtasks.some((st) => st.labels.some((l) => l.id === labelId));
}

/**
 * Labels that represent production stages.
 *
 * Only labels that appear on at least one subtask qualify. A label used
 * purely to tag whole orders isn't a step in the process, so reporting a
 * "remaining workload" for it would be meaningless.
 */
export function stageLabels(tasks: Task[]): Label[] {
  const byId = new Map<string, Label>();
  for (const task of tasks) {
    for (const st of task.subtasks) {
      for (const label of st.labels) byId.set(label.id, label);
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Outstanding workload for one stage. */
export function stageLoad(tasks: Task[], label: Label): StageLoad {
  let orders = 0;
  let kaos = 0;
  let missingCount = 0;
  let overdue = 0;
  let soonestDue: string | null = null;

  for (const task of tasks) {
    if (!stageNeedsWork(task, label.id)) continue;
    orders++;

    // A missing total is reported rather than silently treated as zero:
    // an understated capacity figure gets acted on in a planning meeting.
    if (task.total === null) missingCount++;
    else kaos += task.total;

    const due = effectiveDueDate(task);
    if (due) {
      if (daysUntil(due) < 0) overdue++;
      if (soonestDue === null || due < soonestDue) soonestDue = due;
    }
  }

  return { label, orders, kaos, missingCount, overdue, soonestDue };
}

/** Outstanding workload for every stage, busiest first. */
export function stageLoads(tasks: Task[]): StageLoad[] {
  return stageLabels(tasks)
    .map((label) => stageLoad(tasks, label))
    .filter((load) => load.orders > 0)
    .sort((a, b) => b.kaos - a.kaos || a.label.name.localeCompare(b.label.name));
}
