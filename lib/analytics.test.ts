import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  allTimeWeeks,
  computeCategoryBreakdown,
  computeCompletionStats,
  computeOnTimeRate,
  computeWeeklyTrends,
  rangeStart,
} from "./analytics";
import { at, label, subtask, task } from "./test-fixtures";
import { finishedAt } from "./urgency";

const NOW = new Date(2026, 8, 24, 12); // Thursday 24 Sept 2026

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function finishedOrder(opts: { created: string; doneAt: string | null; due?: string; total?: number }) {
  return task({
    created_at: opts.created,
    due_date: opts.due ?? null,
    total: opts.total ?? null,
    subtasks: [
      // Created early; the old code wrongly used this as the finish time.
      subtask({ created_at: opts.created, done: true, done_at: opts.doneAt }),
    ],
  });
}

describe("finishedAt", () => {
  it("is the latest done_at, and null if any stage lacks one", () => {
    const t = task({
      subtasks: [
        subtask({ done: true, done_at: at(2026, 9, 5) }),
        subtask({ done: true, done_at: at(2026, 9, 9) }),
      ],
    });
    expect(finishedAt(t)).toBe(at(2026, 9, 9));
    t.subtasks.push(subtask({ done: true, done_at: null }));
    expect(finishedAt(t)).toBeNull();
  });

  it("is null while any stage is open", () => {
    expect(finishedAt(task({ subtasks: [subtask({ done: false })] }))).toBeNull();
  });
});

describe("computeOnTimeRate", () => {
  it("judges by when the last stage was ticked, not when it was created", () => {
    const late = finishedOrder({ created: at(2026, 9, 1), doneAt: at(2026, 9, 12), due: "2026-09-10" });
    const onTime = finishedOrder({ created: at(2026, 9, 1), doneAt: at(2026, 9, 10), due: "2026-09-10" });
    expect(computeOnTimeRate([late, onTime], null)).toEqual({ onTime: 1, late: 1, rate: 50 });
  });

  it("skips orders with no recorded finish time and reports nothing measurable", () => {
    const legacy = finishedOrder({ created: at(2026, 9, 1), doneAt: null, due: "2026-09-10" });
    expect(computeOnTimeRate([legacy], null).rate).toBeNull();
  });
});

describe("computeCompletionStats", () => {
  it("averages days from creation to the last tick", () => {
    const a = finishedOrder({ created: at(2026, 9, 1), doneAt: at(2026, 9, 5) });
    const b = finishedOrder({ created: at(2026, 9, 1), doneAt: at(2026, 9, 11) });
    const stats = computeCompletionStats([a, b], null);
    expect(stats.avgCompletionDays).toBeCloseTo(7);
    expect(stats.completionRate).toBe(100);
  });

  it("applies the time range to every figure", () => {
    const old = finishedOrder({ created: at(2026, 6, 1), doneAt: at(2026, 6, 20) });
    const recent = task({ created_at: at(2026, 9, 22), subtasks: [subtask()] });
    const stats = computeCompletionStats([old, recent], rangeStart(4));
    expect(stats.totalOrders).toBe(1);
    expect(stats.completionRate).toBe(0);
    expect(stats.avgCompletionDays).toBeNull();
  });
});

describe("computeWeeklyTrends", () => {
  it("puts a finished order in the week it was finished", () => {
    const order = finishedOrder({ created: at(2026, 9, 8), doneAt: at(2026, 9, 23), total: 40 });
    const weeks = computeWeeklyTrends([order], 3);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
    expect(weeks.map((w) => w.ordersCreated)).toEqual([1, 0, 0]);
    expect(weeks.map((w) => w.ordersCompleted)).toEqual([0, 0, 1]);
    expect(weeks[2].piecesCompleted).toBe(40);
  });

  it("sizes 'All time' to the real history", () => {
    expect(allTimeWeeks([task({ created_at: at(2026, 9, 15) })])).toBe(2);
    expect(allTimeWeeks([task({ created_at: at(2024, 1, 1) })])).toBe(26);
  });
});

describe("computeCategoryBreakdown", () => {
  it("adds up to 100% even when an order has two product labels", () => {
    const tshirt = label("T-shirt");
    const kaos20 = label("Kaos 20s");
    const tasks = [
      task({ total: 100, labels: [tshirt, kaos20], subtasks: [subtask()] }),
      task({ total: 50, labels: [tshirt], subtasks: [subtask()] }),
    ];
    const slices = computeCategoryBreakdown(tasks);
    expect(slices.reduce((s, x) => s + x.percentage, 0)).toBeCloseTo(100);
    expect(slices.find((s) => s.label.name === "T-shirt")?.pieces).toBe(150);
  });
});
