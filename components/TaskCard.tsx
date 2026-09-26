"use client";

import { useState } from "react";
import type { Label, SubtaskPatch, Task, TaskPatch } from "@/lib/types";
import { effectiveDueDate, isTaskComplete } from "@/lib/urgency";
import ConfirmDialog from "./ConfirmDialog";
import DueBadge from "./DueBadge";
import EntityForm from "./EntityForm";
import LabelChips from "./LabelChips";
import ProgressBar from "./ProgressBar";
import SubtaskRow from "./SubtaskRow";

export default function TaskCard({
  task,
  expanded,
  dimmed = false,
  stages,
  suggestedStages,
  productSuggestions,
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
  /** Recede this card — used for orders that already cleared the
   *  stage whose tab is open. */
  dimmed?: boolean;
  /** Every stage label, in the workshop's usual order. */
  stages: Label[];
  /** Stages other orders of the same product went through; offered first. */
  suggestedStages: Label[];
  productSuggestions: string[];
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
  const complete = isTaskComplete(task);
  const stageNames = stages.map((l) => l.name);

  // Stage chips in the Add subtask form: the stages this order still lacks
  // that its product usually needs come first, then every other stage.
  const present = new Set(
    task.subtasks.flatMap((st) => [
      st.title.trim().toLowerCase(),
      ...st.labels.map((l) => l.name.toLowerCase()),
    ])
  );
  const addStageChips = [
    ...suggestedStages.map((l) => l.name).filter((n) => !present.has(n.toLowerCase())),
    ...stageNames,
  ];

  return (
    <li
      id={`task-${task.id}`}
      className={`scroll-mt-20 rounded-2xl bg-white p-4 ${dimmed && !expanded ? "opacity-50" : ""}`}
    >
      {editing ? (
        <EntityForm
          initialTitle={task.title}
          initialStartDate={task.start_date}
          initialDueDate={task.due_date}
          initialLabels={task.labels.map((l) => l.name)}
          initialTotal={task.total}
          showTotal
          showStartDate
          labelSuggestions={productSuggestions}
          submitLabel="Save"
          placeholder="Task title"
          autoFocus
          onSubmit={({ title, startDate, dueDate, labelNames, total }) => {
            onEditTask({ title, start_date: startDate, due_date: dueDate, total }, labelNames);
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
              <DueBadge date={complete ? task.due_date : effective} done={complete} />
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <LabelChips labels={task.labels} />
              {task.total !== null && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                  {task.total} pcs
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
                      labelSuggestions={stageNames}
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
                  placeholder="Name (optional)"
                  titleOptional
                  labelSuggestions={addStageChips}
                  onSubmit={({ title, dueDate, labelNames }) => {
                    onAddSubtask(title, dueDate, labelNames);
                    // Collapse back to the overview once a subtask is added.
                    onToggleExpand();
                  }}
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
