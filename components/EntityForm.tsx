"use client";

import { useState } from "react";

export interface EntityFormValues {
  title: string;
  dueDate: string | null;
  labelNames: string[];
  total?: number | null;
}

/**
 * Shared inline form for adding/editing tasks and subtasks:
 * title + optional due date + optional comma-separated labels.
 * `showTotal` adds an order-total field — tasks only, not subtasks.
 */
export default function EntityForm({
  initialTitle = "",
  initialDueDate = null,
  initialLabels = [],
  initialTotal = null,
  showTotal = false,
  submitLabel,
  placeholder,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  initialTitle?: string;
  initialDueDate?: string | null;
  initialLabels?: string[];
  initialTotal?: number | null;
  showTotal?: boolean;
  submitLabel: string;
  placeholder: string;
  autoFocus?: boolean;
  onSubmit: (values: EntityFormValues) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [labels, setLabels] = useState(initialLabels.join(", "));
  const [total, setTotal] = useState(initialTotal === null ? "" : String(initialTotal));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      dueDate: dueDate || null,
      labelNames: labels.split(",").map((s) => s.trim()).filter(Boolean),
      ...(showTotal ? { total: total.trim() === "" ? null : Number(total) } : {}),
    });
    // Reset only in "add" mode (edit forms are closed by the parent).
    if (!onCancel) {
      setTitle("");
      setDueDate("");
      setLabels("");
      setTotal("");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:border-indigo-400";

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        autoFocus={autoFocus}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className={inputClass}
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <input
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          placeholder="labels, comma, separated"
          aria-label="Labels"
          className={`${inputClass} min-w-0 flex-[1.4]`}
        />
      </div>
      {showTotal && (
        <input
          type="number"
          inputMode="decimal"
          step="any"
          min="0"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="Order total (optional)"
          aria-label="Order total"
          className={inputClass}
        />
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-200"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!title.trim()}
          className="min-h-11 flex-1 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
