"use client";

import type { CategoryLoad, OpenWorkload, StageLoad } from "@/lib/capacity";
import { dueLabel } from "@/lib/urgency";

function Row({
  name,
  value,
  unit,
  right,
  onClick,
}: {
  name: string;
  value: number;
  unit: string;
  right: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left active:bg-neutral-50"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
          {name}
        </span>
        <span className="shrink-0 text-right">
          <span className="text-base font-semibold tabular-nums text-neutral-900">
            {value}
          </span>
          <span className="ml-1 text-xs text-neutral-400">{unit}</span>
        </span>
        <span className="w-20 shrink-0 text-right text-xs">{right}</span>
      </button>
    </li>
  );
}

/**
 * Everything outstanding at a glance — the view to open in a planning
 * meeting, so the whole queue reads without tapping through each tab.
 */
export default function CapacityOverview({
  open,
  stages,
  categories,
  onSelectLabel,
}: {
  open: OpenWorkload;
  stages: StageLoad[];
  categories: CategoryLoad[];
  onSelectLabel: (labelId: string) => void;
}) {
  if (open.orders === 0 && stages.length === 0) return null;

  return (
    <section className="mt-3 rounded-2xl bg-white p-4">
      {/* Each order counted once. Stage figures below cannot be added
          together — one order passes through several stages, so summing
          them would count the same shirts more than once. */}
      <p className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-neutral-900">
          {open.kaos}
        </span>
        <span className="text-sm text-neutral-500">
          kaos in the workshop · {open.orders} order
          {open.orders === 1 ? "" : "s"} open
        </span>
      </p>
      {open.missingCount > 0 && (
        <p className="mt-1 text-xs font-medium text-amber-700">
          + {open.missingCount} order{open.missingCount === 1 ? "" : "s"} with no
          kaos count — total is short
        </p>
      )}

      {stages.length > 0 && (
        <>
          <h2 className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Work left by stage
          </h2>
          <p className="text-xs text-neutral-400">
            An order appears at every stage it still needs, so these don’t add
            up to the figure above.
          </p>
          <ul className="mt-1 flex flex-col">
            {stages.map((load) => (
              <Row
                key={load.label.id}
                name={load.label.name}
                value={load.kaos}
                unit="kaos"
                onClick={() => onSelectLabel(load.label.id)}
                right={
                  load.overdue > 0 ? (
                    <span className="font-medium text-red-600">
                      {load.overdue} overdue
                    </span>
                  ) : load.soonestDue ? (
                    <span className="text-neutral-500">
                      {dueLabel(load.soonestDue)}
                    </span>
                  ) : (
                    <span className="text-neutral-300">no date</span>
                  )
                }
              />
            ))}
          </ul>
        </>
      )}

      {categories.length > 0 && (
        <>
          <h2 className="mt-4 text-xs font-medium uppercase tracking-wide text-neutral-400">
            By product
          </h2>
          <ul className="mt-1 flex flex-col">
            {categories.map((load) => (
              <Row
                key={load.label.id}
                name={load.label.name}
                value={load.openKaos}
                unit="to make"
                onClick={() => onSelectLabel(load.label.id)}
                right={
                  load.doneOrders > 0 ? (
                    <span className="text-emerald-700">
                      {load.doneKaos} done
                    </span>
                  ) : (
                    <span className="text-neutral-300">none done</span>
                  )
                }
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
