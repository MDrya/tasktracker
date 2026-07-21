import type { Label } from "@/lib/types";

export default function LabelChips({ labels }: { labels: Label[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {labels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600"
        >
          {l.name}
        </span>
      ))}
    </span>
  );
}
