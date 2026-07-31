"use client";

import type { StageLoad } from "@/lib/capacity";
import { dueLabel } from "@/lib/urgency";

/**
 * Every stage's outstanding workload at once — the view to open in a
 * planning meeting, so the whole queue is readable without tapping
 * through each stage in turn.
 */
export default function CapacityOverview({
  loads,
  onSelectStage,
}: {
  loads: StageLoad[];
  onSelectStage: (labelId: string) => void;
}) {
  if (loads.length === 0) return null;

  const totalKaos = loads.reduce((sum, l) => sum + l.kaos, 0);
  const missing = loads.reduce((sum, l) => sum + l.missingCount, 0);

  return (
    <section className="mt-3 rounded-2xl bg-white p-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Workload by stage
      </h2>

      <ul className="mt-2 flex flex-col">
        {loads.map((load) => (
          <li key={load.label.id}>
            <button
              onClick={() => onSelectStage(load.label.id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left active:bg-neutral-50"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
                {load.label.name}
              </span>

              <span className="shrink-0 text-right">
                <span className="text-base font-semibold tabular-nums text-neutral-900">
                  {load.kaos}
                </span>
                <span className="ml-1 text-xs text-neutral-400">kaos</span>
              </span>

              <span className="w-20 shrink-0 text-right text-xs">
                {load.overdue > 0 ? (
                  <span className="font-medium text-red-600">
                    {load.overdue} overdue
                  </span>
                ) : load.soonestDue ? (
                  <span className="text-neutral-500">
                    {dueLabel(load.soonestDue)}
                  </span>
                ) : (
                  <span className="text-neutral-300">no date</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-500">
        {/* Stages are summed independently: one order sits in several
            stages at once, so this total counts pieces per stage of work
            remaining, not distinct shirts. */}
        {totalKaos} kaos of work queued across {loads.length} stage
        {loads.length === 1 ? "" : "s"}
        {missing > 0 && (
          <span className="font-medium text-amber-700">
            {" "}
            · {missing} order{missing === 1 ? "" : "s"} missing a kaos count
          </span>
        )}
      </p>
    </section>
  );
}
