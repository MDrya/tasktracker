import type { Label, Task } from "./types";
import { isTaskComplete, parseDate } from "./urgency";
import { stageLabels } from "./capacity";

export interface CompletionStats {
  totalOrders: number;
  completedOrders: number;
  completionRate: number;
  totalPieces: number;
  completedPieces: number;
  avgCompletionDays: number;
}

export interface WeeklyTrend {
  weekStart: string;
  weekLabel: string;
  ordersCreated: number;
  ordersCompleted: number;
  piecesCompleted: number;
}

export interface StageBottleneck {
  label: Label;
  avgDaysInStage: number;
  currentLoad: number;
  overdueCount: number;
}

export interface OnTimeStats {
  onTime: number;
  late: number;
  noDueDate: number;
  rate: number;
}

export interface CategorySlice {
  label: Label;
  pieces: number;
  percentage: number;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function lastDoneTimestamp(task: Task): string | null {
  let latest: string | null = null;
  for (const st of task.subtasks) {
    if (!st.done) return null;
    if (latest === null || st.created_at > latest) latest = st.created_at;
  }
  return latest;
}

export function computeCompletionStats(tasks: Task[]): CompletionStats {
  let totalOrders = 0;
  let completedOrders = 0;
  let totalPieces = 0;
  let completedPieces = 0;
  let totalDays = 0;
  let daysCount = 0;

  for (const task of tasks) {
    totalOrders++;
    if (task.total !== null) totalPieces += task.total;

    if (isTaskComplete(task)) {
      completedOrders++;
      if (task.total !== null) completedPieces += task.total;

      const last = lastDoneTimestamp(task);
      if (last) {
        const created = new Date(task.created_at).getTime();
        const finished = new Date(last).getTime();
        const days = Math.max(0, (finished - created) / 86_400_000);
        totalDays += days;
        daysCount++;
      }
    }
  }

  return {
    totalOrders,
    completedOrders,
    completionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
    totalPieces,
    completedPieces,
    avgCompletionDays: daysCount > 0 ? Math.round(totalDays / daysCount) : 0,
  };
}

export function computeWeeklyTrends(
  tasks: Task[],
  weeks: number = 8
): WeeklyTrend[] {
  const now = new Date();
  const currentWeekStart = startOfWeek(now);

  const buckets: WeeklyTrend[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(currentWeekStart);
    ws.setDate(ws.getDate() - i * 7);
    buckets.push({
      weekStart: isoDate(ws),
      weekLabel: weekLabel(ws),
      ordersCreated: 0,
      ordersCompleted: 0,
      piecesCompleted: 0,
    });
  }

  const firstWeek = buckets[0].weekStart;

  for (const task of tasks) {
    const createdDate = new Date(task.created_at);
    const createdWeek = isoDate(startOfWeek(createdDate));
    if (createdWeek >= firstWeek) {
      const bucket = buckets.find((b) => b.weekStart === createdWeek);
      if (bucket) bucket.ordersCreated++;
    }

    if (isTaskComplete(task)) {
      const last = lastDoneTimestamp(task);
      if (last) {
        const doneDate = new Date(last);
        const doneWeek = isoDate(startOfWeek(doneDate));
        if (doneWeek >= firstWeek) {
          const bucket = buckets.find((b) => b.weekStart === doneWeek);
          if (bucket) {
            bucket.ordersCompleted++;
            bucket.piecesCompleted += task.total ?? 0;
          }
        }
      }
    }
  }

  return buckets;
}

export function computeStageBottlenecks(tasks: Task[]): StageBottleneck[] {
  const labels = stageLabels(tasks);
  const results: StageBottleneck[] = [];

  for (const label of labels) {
    let currentLoad = 0;
    let overdueCount = 0;
    let totalDays = 0;
    let doneCount = 0;

    for (const task of tasks) {
      for (const st of task.subtasks) {
        if (!st.labels.some((l) => l.id === label.id)) continue;

        if (st.done) {
          const created = new Date(st.created_at).getTime();
          const now = Date.now();
          const days = Math.max(0, (now - created) / 86_400_000);
          totalDays += days;
          doneCount++;
        } else {
          currentLoad += task.total ?? 0;
          if (st.due_date) {
            const due = parseDate(st.due_date);
            if (due.getTime() < new Date().setHours(0, 0, 0, 0)) overdueCount++;
          }
        }
      }
    }

    results.push({
      label,
      avgDaysInStage: doneCount > 0 ? Math.round(totalDays / doneCount) : 0,
      currentLoad,
      overdueCount,
    });
  }

  return results
    .filter((r) => r.currentLoad > 0 || r.overdueCount > 0)
    .sort((a, b) => b.currentLoad - a.currentLoad);
}

export function computeOnTimeRate(tasks: Task[]): OnTimeStats {
  let onTime = 0;
  let late = 0;
  let noDueDate = 0;

  for (const task of tasks) {
    if (!isTaskComplete(task)) continue;

    if (!task.due_date) {
      noDueDate++;
      continue;
    }

    const dueDate = parseDate(task.due_date);
    const last = lastDoneTimestamp(task);
    if (!last) {
      noDueDate++;
      continue;
    }

    const finishedDate = new Date(last);
    finishedDate.setHours(0, 0, 0, 0);
    if (finishedDate <= dueDate) onTime++;
    else late++;
  }

  const total = onTime + late;
  return {
    onTime,
    late,
    noDueDate,
    rate: total > 0 ? (onTime / total) * 100 : 0,
  };
}

export function computeCategoryBreakdown(tasks: Task[]): CategorySlice[] {
  const totals = new Map<string, { label: Label; pieces: number }>();
  let grandTotal = 0;

  for (const task of tasks) {
    if (isTaskComplete(task)) continue;
    const pieces = task.total ?? 0;
    if (pieces === 0 || task.labels.length === 0) continue;
    for (const label of task.labels) {
      const existing = totals.get(label.id);
      if (existing) existing.pieces += pieces;
      else totals.set(label.id, { label, pieces });
    }
    grandTotal += pieces;
  }

  return [...totals.values()]
    .sort((a, b) => b.pieces - a.pieces)
    .map((entry) => ({
      label: entry.label,
      pieces: entry.pieces,
      percentage: grandTotal > 0 ? (entry.pieces / grandTotal) * 100 : 0,
    }));
}
