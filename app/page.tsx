"use client";

import { useEffect, useMemo, useState } from "react";
import CalendarView from "@/components/CalendarView";
import CapacityOverview from "@/components/CapacityOverview";
import CategorySummary from "@/components/CategorySummary";
import DueBanner from "@/components/DueBanner";
import EntityForm from "@/components/EntityForm";
import StageSummary from "@/components/StageSummary";
import LabelTabs from "@/components/LabelTabs";
import NamePicker from "@/components/NamePicker";
import PushToggle from "@/components/PushToggle";
import TaskCard from "@/components/TaskCard";
import Toast from "@/components/Toast";
import { useBoard } from "@/hooks/useBoard";
import { useDisplayName } from "@/hooks/useDisplayName";
import {
  categoryLoad,
  categoryLoads,
  openWorkload,
  stageLoad,
  stageLoads,
  stageNeedsWork,
} from "@/lib/capacity";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { Label, Task } from "@/lib/types";
import { isTaskComplete, sortByUrgency } from "@/lib/urgency";

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
  const [view, setView] = useState<"board" | "calendar">("board");
  const [changingName, setChangingName] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "calendar") setView("calendar");
  }, []);

  const changeView = (v: "board" | "calendar") => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === "calendar") url.searchParams.set("view", "calendar");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url.toString());
  };

  const labels = useMemo(() => labelsInUse(board.tasks), [board.tasks]);
  // If the active label was deleted or fell out of use, fall back to All.
  const activeId = labels.some((l) => l.id === activeLabelId)
    ? activeLabelId
    : null;

  // Filter: a label tab shows tasks where the task OR any subtask has the
  // label; urgency sorting still applies within the filtered set.
  const visibleTasks = useMemo(() => {
    const filtered = activeId
      ? board.tasks.filter(
          (t) =>
            t.labels.some((l) => l.id === activeId) ||
            t.subtasks.some((st) => st.labels.some((l) => l.id === activeId))
        )
      : board.tasks;
    return sortByUrgency(filtered);
  }, [board.tasks, activeId]);

  const loads = useMemo(() => stageLoads(board.tasks), [board.tasks]);
  const categories = useMemo(() => categoryLoads(board.tasks), [board.tasks]);
  const open = useMemo(() => openWorkload(board.tasks), [board.tasks]);

  // A label describes either a production step (it sits on subtasks) or a
  // product type (it sits on orders), and the useful summary differs. A
  // label used both ways gets both cards rather than one being guessed at.
  const activeLabel = useMemo(
    () => labels.find((l) => l.id === activeId) ?? null,
    [labels, activeId]
  );

  const activeStage = useMemo(() => {
    if (!activeLabel) return null;
    const load = stageLoad(board.tasks, activeLabel);
    return load.orders > 0 ? load : null;
  }, [activeLabel, board.tasks]);

  const activeCategory = useMemo(() => {
    if (!activeLabel) return null;
    const load = categoryLoad(board.tasks, activeLabel);
    return load.openOrders > 0 || load.doneOrders > 0 ? load : null;
  }, [activeLabel, board.tasks]);

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
          <h1 className="text-lg font-semibold">KonveksiTracker isn’t configured yet</h1>
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
        <h1 className="text-xl font-bold tracking-tight">KonveksiTracker</h1>
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

      <DueBanner tasks={board.tasks} />

      <div className="mt-3 flex gap-1 rounded-full bg-neutral-200/80 p-0.5">
        <button
          onClick={() => changeView("board")}
          className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
            view === "board"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500"
          }`}
        >
          Board
        </button>
        <button
          onClick={() => changeView("calendar")}
          className={`flex-1 rounded-full py-1.5 text-sm font-medium transition-colors ${
            view === "calendar"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-500"
          }`}
        >
          Calendar
        </button>
      </div>

      {view === "board" ? (
      <>
      <div className="sticky top-0 z-10 -mx-4 mt-3 bg-neutral-100/95 px-4 py-1 backdrop-blur">
        <LabelTabs
          labels={labels}
          activeLabelId={activeId}
          onSelect={setActiveLabelId}
          onRename={board.renameLabel}
          onDelete={board.removeLabel}
        />
      </div>

      {activeId === null ? (
        <CapacityOverview
          open={open}
          stages={loads}
          categories={categories}
          onSelectLabel={setActiveLabelId}
        />
      ) : (
        <>
          {activeStage && <StageSummary load={activeStage} />}
          {activeCategory && <CategorySummary load={activeCategory} />}
        </>
      )}

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
              showStartDate
              autoFocus
              onSubmit={({ title, startDate, dueDate, labelNames, total }) => {
                board.addTask(title, dueDate, labelNames, name, total ?? null, startDate ?? null);
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
          <p className="text-3xl">{board.tasks.length === 0 ? "🌱" : "🔍"}</p>
          <p className="mt-2 font-medium text-neutral-700">
            {board.tasks.length === 0
              ? "Nothing here yet"
              : "No tasks with this label"}
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {board.tasks.length === 0 ? (
              "Add the first task and get the team rolling."
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
              // Finished work stays visible but recedes. What counts as
              // finished depends on the tab: on a stage, whether that step
              // is cleared; on a product, whether the whole order is done.
              // Using the stage rule on a product tab would dim every card,
              // since a product label never sits on a subtask.
              dimmed={
                activeStage
                  ? !stageNeedsWork(task, activeStage.label.id)
                  : activeCategory
                    ? isTaskComplete(task)
                    : false
              }
              onToggleExpand={() => toggleExpanded(task.id)}
              onEditTask={(patch, labelNames) =>
                board.editTask(task.id, patch, labelNames)
              }
              onDeleteTask={() => board.removeTask(task.id)}
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
      </>
      ) : (
        <CalendarView
          tasks={board.tasks}
          onSelectTask={(taskId) => {
            changeView("board");
            setExpandedIds((prev) => new Set(prev).add(taskId));
          }}
        />
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
