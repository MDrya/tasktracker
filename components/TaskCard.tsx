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

  const doneCount = task.subtasks.filter((st) => st.done).length;
  // The badge shows the task's *effective* urgency (own date or soonest
  // open subtask date) so the collapsed card matches its sort position.
  const effective = effectiveDueDate(task);

  return (
    <li className="rounded-2xl bg-white p-4">
      {editing ? (
        <EntityForm
          initialTitle={task.title}
          initialDueDate={task.due_date}
          initialLabels={task.labels.map((l) => l.name)}
          submitLabel="Save"
          placeholder="Task title"
          autoFocus
          onSubmit={({ title, dueDate, labelNames }) => {
            onEditTask({ title, due_date: dueDate }, labelNames);
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
              <DueBadge date={effective} />
            </span>
            <span className="mt-1.5 block">
              <LabelChips labels={task.labels} />
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
                  {task.created_by ? `Added by ${task.created_by}` : " "}
                </p>
                <div className="flex gap-1">
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
        message={`“${task.title}” and all of its subtasks will be removed.`}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDeleteTask();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </li>
  );
}
