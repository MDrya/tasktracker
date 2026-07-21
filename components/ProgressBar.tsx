// Progress = completed / total subtasks. Decision for zero subtasks:
// the bar (and percentage) is hidden entirely — showing "0%" for a task
// that has nothing to check off reads as "no progress" when it really
// means "not broken down yet".
export default function ProgressBar({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            pct === 100 ? "bg-emerald-500" : "bg-indigo-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {pct}% · {done}/{total} done
      </p>
    </div>
  );
}
