import { shortDate } from "@/lib/dates";
import { dueLabel, urgencyLevel } from "@/lib/urgency";
import type { UrgencyLevel } from "@/lib/types";

// Flat pill colors per urgency bucket:
// overdue / due within 2 days = red, within 7 days = amber,
// further out = green, no due date = gray.
export const DUE_STYLES: Record<UrgencyLevel, string> = {
  overdue: "bg-red-100 text-red-700",
  urgent: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  later: "bg-emerald-100 text-emerald-700",
  none: "bg-neutral-100 text-neutral-500",
};

/** `done` turns the badge neutral: finished work is never "overdue". */
export default function DueBadge({
  date,
  done = false,
}: {
  date: string | null;
  done?: boolean;
}) {
  const style = done ? DUE_STYLES.none : DUE_STYLES[urgencyLevel(date)];
  const text = done
    ? date
      ? `Done · ${shortDate(date)}`
      : "Done"
    : date
      ? dueLabel(date)
      : "No date";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {text}
    </span>
  );
}
