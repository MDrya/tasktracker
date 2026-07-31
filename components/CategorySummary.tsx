import type { CategoryLoad } from "@/lib/capacity";
import { dueLabel } from "@/lib/urgency";

/**
 * Headline for a product type: what is still to make versus what is
 * finished. Product labels sit on the order rather than on a step, so
 * "work remaining at this stage" would be the wrong question.
 */
export default function CategorySummary({ load }: { load: CategoryLoad }) {
  const urgent = load.overdue > 0;

  return (
    <div
      className={`mt-3 rounded-2xl p-4 ${urgent ? "bg-red-50" : "bg-white"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-neutral-500">
          {load.label.name} still to make
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
          {load.openKaos}
        </span>
        <span className="text-sm text-neutral-500">
          kaos · {load.openOrders} order{load.openOrders === 1 ? "" : "s"} open
          {load.overdue > 0 && (
            <span className="font-medium text-red-600">
              {" "}
              · {load.overdue} overdue
            </span>
          )}
        </span>
      </p>

      {load.doneOrders > 0 && (
        <p className="mt-1 text-sm text-emerald-700">
          {load.doneKaos} kaos finished · {load.doneOrders} order
          {load.doneOrders === 1 ? "" : "s"}
        </p>
      )}

      {load.missingCount > 0 && (
        <p className="mt-1.5 text-xs font-medium text-amber-700">
          + {load.missingCount} open order{load.missingCount === 1 ? "" : "s"}{" "}
          with no kaos count — total is short
        </p>
      )}
    </div>
  );
}
