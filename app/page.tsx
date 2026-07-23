"use client";

import { useMemo, useState } from "react";
import DueBanner from "@/components/DueBanner";
import EntityForm from "@/components/EntityForm";
import ExportPanel from "@/components/ExportPanel";
import LabelTabs from "@/components/LabelTabs";
import NamePicker from "@/components/NamePicker";
import PushToggle from "@/components/PushToggle";
import TaskCard from "@/components/TaskCard";
import Toast from "@/components/Toast";
import { useBoard } from "@/hooks/useBoard";
import { useDisplayName } from "@/hooks/useDisplayName";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Label, Task } from "@/lib/types";
import { sortByUrgency } from "@/lib/urgency";

/** All labels currently in use, from both tasks and subtasks, unique by id. */
function labelsInUse(tasks: Task[]): Label[] {
  const byId = new Map<string, Label>();
  for (const t of tasks) {
    for (const l of t.labels) byId.set(l.id, l);
    for (const st of t.subtasks) for (const l of st.labels) byId.set(l.id, l);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function Home() {
  const configured = isSupabaseConfigured();
  const { name, loaded: nameLoaded, setName } = useDisplayName();
  const board = useBoard(configured);

  const [activeLabelId, setActiveLabelId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [changingName, setChangingName] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [showFulfilled, setShowFulfilled] = useState(false);

  const labels = useMemo(() => labelsInUse(board.tasks), [board.tasks]);
  // If the active label was deleted or fell out of use, fall back to All.
  const activeId = labels.some((l) => l.id === activeLabelId)
    ? activeLabelId
    : null;

  const fulfilledCount = useMemo(
    () => board.tasks.filter((t) => t.archived_at !== null).length,
    [board.tasks]
  );

  // Filter: fulfilled orders are hidden unless toggled on; a label tab
  // shows tasks where the task OR any subtask has the label; urgency
  // sorting still applies within the filtered set.
  const visibleTasks = useMemo(() => {
    let filtered = showFulfilled
      ? board.tasks
      : board.tasks.filter((t) => t.archived_at === null);
    if (activeId) {
      filtered = filtered.filter(
        (t) =>
          t.labels.some((l) => l.id === activeId) ||
          t.subtasks.some((st) => st.labels.some((l) => l.id === activeId))
      );
    }
    return sortByUrgency(filtered);
  }, [board.tasks, activeId, showFulfilled]);

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!configured) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl bg-white p-6">
          <h1 className="text-lg font-semibold">TaskTracker isn’t configured yet</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Copy <code className="rounded bg-neutral-100 px-1">.env.local.example</code> to{" "}
            <code className="rounded bg-neutral-100 px-1">.env.local</code> and fill in your
            Supabase URL and anon key, then restart the dev server. See the README for
            full setup steps.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header: app name + persistent identity chip */}
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">TaskTracker</h1>
        <div className="flex items-center gap-1.5">
          <PushToggle createdBy={name} />
          <button
            onClick={() => setChangingName(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-medium text-neutral-700 active:bg-neutral-100"
            aria-label="Change your display name"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
              {(name ?? "?").slice(0, 1).toUpperCase()}
            </span>
            {name ?? "Set name"}
          </button>
        </div>
      </header>

      <DueBanner tasks={board.tasks.filter((t) => t.archived_at === null)} />

      <div className="sticky top-0 z-10 -mx-4 mt-3 bg-neutral-100/95 px-4 py-1 backdrop-blur">
        <LabelTabs
          labels={labels}
          activeLabelId={activeId}
          onSelect={setActiveLabelId}
          onRename={board.renameLabel}
          onDelete={board.removeLabel}
        />
      </div>

      {fulfilledCount > 0 && (
        <button
          onClick={() => setShowFulfilled((v) => !v)}
          className="mt-2 min-h-11 text-sm font-medium text-neutral-500 active:text-neutral-700"
        >
          {showFulfilled
            ? "Hide fulfilled orders"
            : `Show ${fulfilledCount} fulfilled order${fulfilledCount === 1 ? "" : "s"}`}
        </button>
      )}

      <ExportPanel />

      {/* Add task */}
      <div className="mt-3">
        {addingTask ? (
          <div className="rounded-2xl bg-white p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
              New task
            </p>
            <EntityForm
              submitLabel="Add task"
              placeholder="What needs doing?"
              showTotal
              autoFocus
              onSubmit={({ title, dueDate, labelNames, total }) => {
                board.addTask(title, dueDate, labelNames, name, total ?? null);
                setAddingTask(false);
              }}
              onCancel={() => setAddingTask(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setAddingTask(true)}
            className="min-h-11 w-full rounded-2xl border-2 border-dashed border-neutral-300 text-sm font-medium text-neutral-500 active:bg-white"
          >
            + New task
          </button>
        )}
      </div>

      {/* Task list */}
      {board.loading ? (
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-3xl">
            {board.tasks.length === 0
              ? "🌱"
              : !showFulfilled && fulfilledCount === board.tasks.length
                ? "✅"
                : "🔍"}
          </p>
          <p className="mt-2 font-medium text-neutral-700">
            {board.tasks.length === 0
              ? "Nothing here yet"
              : !showFulfilled && fulfilledCount === board.tasks.length
                ? "Every order is fulfilled"
                : "No tasks with this label"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {board.tasks.length === 0 ? (
              "Add the first task and get the team rolling."
            ) : !showFulfilled && fulfilledCount === board.tasks.length ? (
              <button
                className="font-medium text-indigo-600 underline"
                onClick={() => setShowFulfilled(true)}
              >
                Show fulfilled orders
              </button>
            ) : (
              <button
                className="font-medium text-indigo-600 underline"
                onClick={() => setActiveLabelId(null)}
              >
                Show all tasks
              </button>
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              expanded={expandedIds.has(task.id)}
              onToggleExpand={() => toggleExpanded(task.id)}
              onEditTask={(patch, labelNames) =>
                board.editTask(task.id, patch, labelNames)
              }
              onDeleteTask={() => board.removeTask(task.id)}
              onArchiveTask={() => board.archiveTask(task.id)}
              onUnarchiveTask={() => board.unarchiveTask(task.id)}
              onAddSubtask={(title, dueDate, labelNames) =>
                board.addSubtask(task.id, title, dueDate, labelNames, name)
              }
              onEditSubtask={(subtaskId, patch, labelNames) =>
                board.editSubtask(subtaskId, patch, labelNames)
              }
              onToggleSubtask={board.toggleSubtask}
              onDeleteSubtask={board.removeSubtask}
            />
          ))}
        </ul>
      )}

      {/* Name picker: forced on first visit, dismissable when changing */}
      {nameLoaded && (!name || changingName) && (
        <NamePicker
          currentName={name}
          onSave={(n) => {
            setName(n);
            setChangingName(false);
          }}
          onCancel={name ? () => setChangingName(false) : undefined}
        />
      )}

      <Toast message={board.error} onDismiss={board.clearError} />
    </main>
  );
}
