import type { StageLoad } from "@/lib/capacity";
import { dueLabel, urgencyLevel } from "@/lib/urgency";

/**
 * Headline workload for the selected stage: how many pieces are still
 * queued behind it, and how soon they are due.
 */
export default function StageSummary({ load }: { load: StageLoad }) {
  const urgent =
    load.overdue > 0 || urgencyLevel(load.soonestDue) === "urgent";

  return (
    <div
      className={`mt-3 rounded-2xl p-4 ${urgent ? "bg-red-50" : "bg-white"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-neutral-500">
          Still need {load.label.name}
        </p>
        {load.soonestDue && (
          <p
            className={`text-xs font-medium ${
              load.overdue > 0 ? "text-red-600" : "text-neutral-500"
            }`}
          >
            soonest {dueLabel(load.soonestDue)}
          </p>
        )}
      </div>

      <p className="mt-1 flex items-baseline gap-2">
        <span
          className={`text-3xl font-bold tabular-nums ${
            urgent ? "text-red-700" : "text-neutral-900"
          }`}
        >
          {load.kaos}
        </span>
        <span className="text-sm text-neutral-500">
          kaos · {load.orders} order{load.orders === 1 ? "" : "s"}
          {load.overdue > 0 && (
            <span className="font-medium text-red-600">
              {" "}
              · {load.overdue} overdue
            </span>
          )}
        </span>
      </p>

      {/* Orders with no piece count would otherwise quietly understate the
          figure, so they are called out rather than folded into the total. */}
      {load.missingCount > 0 && (
        <p className="mt-1.5 text-xs font-medium text-amber-700">
          + {load.missingCount} order{load.missingCount === 1 ? "" : "s"} with no
          kaos count — total is short
        </p>
      )}
    </div>
  );
}
