"use client";

import { useState } from "react";
import type { Subtask, SubtaskPatch } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";
import DueBadge from "./DueBadge";
import EntityForm from "./EntityForm";
import LabelChips from "./LabelChips";

export default function SubtaskRow({
  subtask,
  onToggle,
  onEdit,
  onDelete,
}: {
  subtask: Subtask;
  onToggle: (done: boolean) => void;
  onEdit: (patch: SubtaskPatch, labelNames: string[]) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <li className="rounded-xl bg-neutral-50 p-3">
        <EntityForm
          initialTitle={subtask.title}
          initialDueDate={subtask.due_date}
          initialLabels={subtask.labels.map((l) => l.name)}
          submitLabel="Save"
          placeholder="Subtask title"
          autoFocus
          onSubmit={({ title, dueDate, labelNames }) => {
            onEdit({ title, due_date: dueDate }, labelNames);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start gap-1">
      {/* Checkbox with a full 44px tap target around it */}
      <button
        onClick={() => onToggle(!subtask.done)}
        aria-label={subtask.done ? "Mark as not done" : "Mark as done"}
        className="flex min-h-11 min-w-11 items-center justify-center"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
            subtask.done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-neutral-300 bg-white"
          }`}
        >
          {subtask.done && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path
                d="M2 6.5 4.5 9 10 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1 py-2.5">
        <p
          className={`text-sm ${
            subtask.done ? "text-neutral-400 line-through" : "text-neutral-800"
          }`}
        >
          {subtask.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {subtask.due_date && <DueBadge date={subtask.due_date} />}
          <LabelChips labels={subtask.labels} />
        </div>
      </div>

      <button
        onClick={() => setEditing(true)}
        aria-label="Edit subtask"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-400 active:bg-neutral-100"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-8.7 8.7-3.4.6.6-3.4 8.7-8.7Z" />
        </svg>
      </button>
      <button
        onClick={() => setConfirmingDelete(true)}
        aria-label="Delete subtask"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-400 active:bg-red-50 active:text-red-600"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M8 2h4l.5 1H16v2H4V3h3.5L8 2ZM5 6h10l-.7 11.1A1 1 0 0 1 13.3 18H6.7a1 1 0 0 1-1-.9L5 6Z" />
        </svg>
      </button>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete subtask?"
        message={`“${subtask.title}” will be removed.`}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </li>
  );
}
