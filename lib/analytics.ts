import { categoryLoads } from "./capacity";
import { daysBetween, startOfWeek, toISODate } from "./dates";
import type { Label, Task } from "./types";
import { finishedAt, isTaskComplete } from "./urgency";

/**
 * Production analytics derived from the board. Finish times come from
 * `subtasks.done_at`; orders finished before that was recorded have no
 * finish time and are left out of timing figures rather than guessed at.
 */

const WEEK_MS = 7 * 86_400_000;

/** Start of the analysed period: the Monday `weeks - 1` weeks before this
 *  week's, matching the chart's buckets. Null means all time. */
export function rangeStart(weeks: number | null, now = new Date()): Date | null {
  if (weeks === null) return null;
  const start = startOfWeek(now);
  start.setDate(start.getDate() - (weeks - 1) * 7);
  return start;
}

function inRange(timestamp: string, since: Date | null): boolean {
  return since === null || Date.parse(timestamp) >= since.getTime();
}

export interface CompletionStats {
  /** Orders created in the period. */
  totalOrders: number;
  /** Of those, how many are finished. */
  completedOrders: number;
  /** Percentage, or null when there are no orders to measure. */
  completionRate: number | null;
  /** Average days from order created to last stage ticked, for orders
   *  finished in the period; null when none have a recorded finish time. */
  avgCompletionDays: number | null;
  /** Orders finished in the period that have a recorded finish time. */
  timedOrders: number;
}

export function computeCompletionStats(
  tasks: Task[],
  since: Date | null
): CompletionStats {
  let totalOrders = 0;
  let completedOrders = 0;
  let totalDays = 0;
  let timedOrders = 0;

  for (const task of tasks) {
    if (inRange(task.created_at, since)) {
      totalOrders++;
      if (isTaskComplete(task)) completedOrders++;
    }
    const done = finishedAt(task);
    if (done && inRange(done, since)) {
      totalDays += daysBetween(task.created_at, done);
      timedOrders++;
    }
  }

  return {
    totalOrders,
    completedOrders,
    completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : null,
    avgCompletionDays: timedOrders > 0 ? totalDays / timedOrders : null,
    timedOrders,
  };
}

export interface OnTimeStats {
  onTime: number;
  late: number;
  /** Percentage on time, or null when nothing could be measured. */
  rate: number | null;
}

/** Finished orders in the period, judged by the day their last stage was
 *  ticked against the order's due date. Orders with no due date or no
 *  recorded finish time can't be judged and are skipped. */
export function computeOnTimeRate(tasks: Task[], since: Date | null): OnTimeStats {
  let onTime = 0;
  let late = 0;

  for (const task of tasks) {
    const done = finishedAt(task);
    if (!done || !task.due_date || !inRange(done, since)) continue;
    if (toISODate(new Date(done)) <= task.due_date) onTime++;
    else late++;
  }

  const judged = onTime + late;
  return { onTime, late, rate: judged > 0 ? (onTime / judged) * 100 : null };
}

export interface WeeklyTrend {
  weekStart: string;
  weekLabel: string;
  ordersCreated: number;
  ordersCompleted: number;
  piecesCompleted: number;
}

export function computeWeeklyTrends(
  tasks: Task[],
  weeks: number,
  now = new Date()
): WeeklyTrend[] {
  const first = rangeStart(weeks, now)!;
  const buckets: WeeklyTrend[] = [];
  const byWeek = new Map<string, WeeklyTrend>();

  for (let i = 0; i < weeks; i++) {
    const ws = new Date(first);
    ws.setDate(ws.getDate() + i * 7);
    const bucket: WeeklyTrend = {
      weekStart: toISODate(ws),
      weekLabel: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      ordersCreated: 0,
      ordersCompleted: 0,
      piecesCompleted: 0,
    };
    buckets.push(bucket);
    byWeek.set(bucket.weekStart, bucket);
  }

  const weekOf = (timestamp: string) => toISODate(startOfWeek(new Date(timestamp)));

  for (const task of tasks) {
    const created = byWeek.get(weekOf(task.created_at));
    if (created) created.ordersCreated++;

    const done = finishedAt(task);
    const completed = done ? byWeek.get(weekOf(done)) : undefined;
    if (completed) {
      completed.ordersCompleted++;
      completed.piecesCompleted += task.total ?? 0;
    }
  }

  return buckets;
}

/** Weeks from the oldest order to now, so "All time" draws only real
 *  history. Capped so bars stay readable on a phone. */
export function allTimeWeeks(tasks: Task[], now = new Date(), cap = 26): number {
  if (tasks.length === 0) return 1;
  const oldest = Math.min(...tasks.map((t) => Date.parse(t.created_at)));
  const weeks =
    Math.round(
      (startOfWeek(now).getTime() - startOfWeek(new Date(oldest)).getTime()) / WEEK_MS
    ) + 1;
  return Math.min(Math.max(weeks, 1), cap);
}

export interface CategorySlice {
  label: Label;
  pieces: number;
  percentage: number;
}

/**
 * Open pieces per product label. An order carrying two product labels
 * counts toward both, so shares are taken of the per-label sum; that keeps
 * the slices adding up to exactly 100%.
 */
export function computeCategoryBreakdown(tasks: Task[]): CategorySlice[] {
  const loads = categoryLoads(tasks).filter((l) => l.openKaos > 0);
  const sum = loads.reduce((s, l) => s + l.openKaos, 0);
  return loads.map((l) => ({
    label: l.label,
    pieces: l.openKaos,
    percentage: sum > 0 ? (l.openKaos / sum) * 100 : 0,
  }));
}
