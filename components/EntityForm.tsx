"use client";

import { useState } from "react";

export interface EntityFormValues {
  title: string;
  startDate?: string | null;
  dueDate: string | null;
  labelNames: string[];
  total?: number | null;
}

function splitLabels(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Shared inline form for adding/editing tasks and subtasks: title, dates,
 * comma-separated labels, and (orders only) the number of pieces.
 * `labelSuggestions` shows existing labels as one-tap chips so staff reuse
 * "Jahit" instead of typing a slightly different new one.
 */
export default function EntityForm({
  initialTitle = "",
  initialDueDate = null,
  initialLabels = [],
  initialTotal = null,
  showTotal = false,
  initialStartDate = null,
  showStartDate = false,
  labelSuggestions = [],
  titleOptional = false,
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
  initialStartDate?: string | null;
  showStartDate?: boolean;
  labelSuggestions?: string[];
  /** Allow an empty title; the first label is used as the title instead,
   *  so a subtask can be just "stage + date". */
  titleOptional?: boolean;
  submitLabel: string;
  placeholder: string;
  autoFocus?: boolean;
  onSubmit: (values: EntityFormValues) => void;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [dueDate, setDueDate] = useState(initialDueDate ?? "");
  const [labels, setLabels] = useState(initialLabels.join(", "));
  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [total, setTotal] = useState(
    initialTotal === null ? "" : String(initialTotal)
  );

  const pieces = total.trim() === "" ? null : Number(total);
  const piecesError =
    showTotal && pieces !== null && (!Number.isInteger(pieces) || pieces < 0)
      ? "Enter a whole number of pieces."
      : null;
  const datesError =
    showStartDate && startDate && dueDate && startDate > dueDate
      ? "Start date is after the due date."
      : null;
  const labelNames = splitLabels(labels);
  const finalTitle = title.trim() || (titleOptional ? (labelNames[0] ?? "") : "");
  const canSubmit = finalTitle !== "" && !piecesError && !datesError;

  const typed = new Set(labelNames.map((l) => l.toLowerCase()));
  const suggestions = [
    ...new Map(labelSuggestions.map((s) => [s.toLowerCase(), s])).entries(),
  ]
    .filter(([key]) => !typed.has(key))
    .map(([, name]) => name);

  const addSuggestion = (name: string) => {
    const current = splitLabels(labels);
    setLabels([...current, name].join(", "));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      title: finalTitle,
      ...(showStartDate ? { startDate: startDate || null } : {}),
      dueDate: dueDate || null,
      labelNames,
      ...(showTotal ? { total: pieces } : {}),
    });
    // Reset only in "add" mode (edit forms are closed by the parent).
    if (!onCancel) {
      setTitle("");
      setStartDate("");
      setDueDate("");
      setLabels("");
      setTotal("");
    }
  };

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-base outline-none focus:border-indigo-400";
  const captionClass = "text-xs font-medium text-neutral-500";

  const labelsField = (
    <label className="flex min-w-0 flex-[1.4] flex-col gap-1">
      <span className={captionClass}>Labels</span>
      <input
        value={labels}
        onChange={(e) => setLabels(e.target.value)}
        placeholder="comma, separated"
        className={inputClass}
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input
        autoFocus={autoFocus}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          titleOptional && labelNames[0] ? `${placeholder} — “${labelNames[0]}”` : placeholder
        }
        aria-label="Title"
        className={inputClass}
      />
      <div className="flex gap-2">
        {showStartDate && (
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={captionClass}>Start</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={captionClass}>Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </label>
        {!showStartDate && labelsField}
      </div>
      {datesError && (
        <p className="text-xs font-medium text-red-600">{datesError}</p>
      )}
      {showStartDate && labelsField}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSuggestion(s)}
              className="min-h-9 rounded-full bg-indigo-50 px-3 text-xs font-medium text-indigo-700 active:bg-indigo-100"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      {showTotal && (
        <label className="flex flex-col gap-1">
          <span className={captionClass}>Kaos (pcs)</span>
          <input
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="Number of pieces, e.g. 120"
            className={inputClass}
          />
          {piecesError && (
            <span className="text-xs font-medium text-red-600">{piecesError}</span>
          )}
        </label>
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
          disabled={!canSubmit}
          className="min-h-11 flex-1 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700 disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
