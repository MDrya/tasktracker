"use client";

import { useState } from "react";
import type { SubtaskPatch, Task, TaskPatch } from "@/lib/types";
import { effectiveDueDate } from "@/lib/urgency";
import ConfirmDialog from "./ConfirmDialog";
import DueBadge from "./DueBadge";
import EntityForm from "./EntityForm";
import LabelChips from "./LabelChips";
import ProgressBar from "./ProgressBar";
import SubtaskRow from "./SubtaskRow";

export default function TaskCard({
  task,
  expanded,
  onToggleExpand,
  onEditTask,
  onDeleteTask,
  onArchiveTask,
  onUnarchiveTask,
  onAddSubtask,
  onEditSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: {
  task: Task;
  expanded: boolean;
  onToggleExpand: () => void;
  onEditTask: (patch: TaskPatch, labelNames: string[]) => void;
  onDeleteTask: () => void;
  onArchiveTask: () => void;
  onUnarchiveTask: () => void;
  onAddSubtask: (
    title: string,
    dueDate: string | null,
    labelNames: string[]
  ) => void;
  onEditSubtask: (
    subtaskId: string,
    patch: SubtaskPatch,
    labelNames: string[]
  ) => void;
  onToggleSubtask: (subtaskId: string, done: boolean) => void;
  onDeleteSubtask: (subtaskId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const archived = task.archived_at !== null;
  const doneCount = task.subtasks.filter((st) => st.done).length;
  // The badge shows the task's *effective* urgency (own date or soonest
  // open subtask date) so the collapsed card matches its sort position.
  const effective = effectiveDueDate(task);

  return (
    <li
      className={`rounded-2xl bg-white p-4 ${archived ? "opacity-60" : ""}`}
    >
      {editing ? (
        <EntityForm
          initialTitle={task.title}
          initialDueDate={task.due_date}
          initialLabels={task.labels.map((l) => l.name)}
          initialTotal={task.total}
          showTotal
          submitLabel="Save"
          placeholder="Task title"
          autoFocus
          onSubmit={({ title, dueDate, labelNames, total }) => {
            onEditTask({ title, due_date: dueDate, total }, labelNames);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {/* Collapsed header — the whole area is one big tap target */}
          <button
            onClick={onToggleExpand}
            aria-expanded={expanded}
            className="block w-full text-left"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-base font-medium text-neutral-900">
                {task.title}
              </span>
              {archived ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Fulfilled
                </span>
              ) : (
                <DueBadge date={effective} />
              )}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <LabelChips labels={task.labels} />
              {task.total !== null && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                  Total: {task.total}
                </span>
              )}
            </span>
            <ProgressBar done={doneCount} total={task.subtasks.length} />
          </button>

          {expanded && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              {task.subtasks.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {task.subtasks.map((st) => (
                    <SubtaskRow
                      key={st.id}
                      subtask={st}
                      onToggle={(done) => onToggleSubtask(st.id, done)}
                      onEdit={(patch, labelNames) =>
                        onEditSubtask(st.id, patch, labelNames)
                      }
                      onDelete={() => onDeleteSubtask(st.id)}
                    />
                  ))}
                </ul>
              )}

              <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Add subtask
                </p>
                <EntityForm
                  submitLabel="Add subtask"
                  placeholder="Subtask title"
                  onSubmit={({ title, dueDate, labelNames }) =>
                    onAddSubtask(title, dueDate, labelNames)
                  }
                />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-neutral-400">
                  {task.created_by ? `Added by ${task.created_by}` : " "}
                </p>
                <div className="flex flex-wrap justify-end gap-1">
                  {archived ? (
                    <button
                      onClick={onUnarchiveTask}
                      className="min-h-11 rounded-xl px-3 text-sm font-medium text-neutral-600 active:bg-neutral-100"
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmingArchive(true)}
                      className="min-h-11 rounded-xl px-3 text-sm font-medium text-emerald-600 active:bg-emerald-50"
                    >
                      Mark fulfilled
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="min-h-11 rounded-xl px-3 text-sm font-medium text-indigo-600 active:bg-indigo-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="min-h-11 rounded-xl px-3 text-sm font-medium text-red-600 active:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete task?"
        message={`“${task.title}” and all of its subtasks will be removed. This can't be undone — if you just want it off the board, use "Mark fulfilled" instead.`}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDeleteTask();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />

      <ConfirmDialog
        open={confirmingArchive}
        title="Mark this order fulfilled?"
        message={`“${task.title}” will leave the main board but stays in reports and exports. You can unarchive it later.`}
        confirmLabel="Mark fulfilled"
        onConfirm={() => {
          setConfirmingArchive(false);
          onArchiveTask();
        }}
        onCancel={() => setConfirmingArchive(false)}
      />
    </li>
  );
}
