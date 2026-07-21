import { dueLabel, urgencyLevel } from "@/lib/urgency";
import type { UrgencyLevel } from "@/lib/types";

// Flat pill colors per urgency bucket:
// overdue / due within 2 days = red, within 7 days = amber,
// further out = green, no due date = gray.
const STYLES: Record<UrgencyLevel, string> = {
  overdue: "bg-red-100 text-red-700",
  urgent: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  later: "bg-emerald-100 text-emerald-700",
  none: "bg-neutral-100 text-neutral-500",
};

export default function DueBadge({ date }: { date: string | null }) {
  const level = urgencyLevel(date);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[level]}`}
    >
      {date ? dueLabel(date) : "No date"}
    </span>
  );
}
