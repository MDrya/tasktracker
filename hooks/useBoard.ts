"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import type { Label, Subtask, SubtaskPatch, Task, TaskPatch } from "@/lib/types";

/** Placeholder Label objects for names the user just typed, shown until
 *  the next refresh swaps in the real rows (chips render by name only). */
function pendingLabels(names: string[]): Label[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].map(
    (name) => ({ id: `pending:${name}`, name })
  );
}

/**
 * Board state + realtime sync + optimistic mutations.
 *
 * Every mutation follows the same pattern: apply the change to local
 * state immediately, write to Supabase in the background, refetch on
 * success (server truth), and roll back to a snapshot on failure.
 * Changes made by other people arrive via a realtime subscription that
 * triggers a debounced refetch.
 */
export function useBoard(enabled: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const refresh = useCallback(async () => {
    setTasks(await db.fetchBoard());
  }, []);

  // Initial load + realtime subscription (any change on any board table
  // triggers one debounced refetch — simple and always consistent).
  useEffect(() => {
    if (!enabled) return;

    refresh()
      .catch(() => setError("Couldn't load the board. Check your connection."))
      .finally(() => setLoading(false));

    let timer: ReturnType<typeof setTimeout> | undefined;
    const supabase = getSupabase();
    const channel = supabase
      .channel("board-changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          refresh().catch(() => {
            /* transient refetch failure; next event retries */
          });
        }, 150);
      })
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  /** Optimistic-apply, persist, refetch; roll back and surface a message
   *  on failure. */
  const mutate = useCallback(
    async (
      optimistic: (prev: Task[]) => Task[],
      persist: () => Promise<void>,
      failMessage: string
    ) => {
      const snapshot = tasksRef.current;
      setTasks(optimistic(snapshot));
      try {
        await persist();
        await refresh();
      } catch {
        setTasks(snapshot);
        setError(failMessage);
      }
    },
    [refresh]
  );

  // ----- tasks ------------------------------------------------------------

  const addTask = useCallback(
    (
      title: string,
      dueDate: string | null,
      labelNames: string[],
      createdBy: string | null,
      total: number | null = null
    ) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: crypto.randomUUID(),
        title,
        due_date: dueDate,
        total,
        archived_at: null,
        created_by: createdBy,
        created_at: now,
        updated_at: now,
        labels: pendingLabels(labelNames),
        subtasks: [],
      };
      return mutate(
        (prev) => [...prev, task],
        () =>
          db.createTask(
            { id: task.id, title, due_date: dueDate, total, created_by: createdBy },
            labelNames
          ),
        "Couldn't add the task."
      );
    },
    [mutate]
  );

  const editTask = useCallback(
    (id: string, patch: TaskPatch, labelNames?: string[]) =>
      mutate(
        (prev) =>
          prev.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...patch,
                  labels:
                    labelNames !== undefined ? pendingLabels(labelNames) : t.labels,
                }
              : t
          ),
        () => db.updateTask(id, patch, labelNames),
        "Couldn't save the task."
      ),
    [mutate]
  );

  const removeTask = useCallback(
    (id: string) =>
      mutate(
        (prev) => prev.filter((t) => t.id !== id),
        () => db.deleteTask(id),
        "Couldn't delete the task."
      ),
    [mutate]
  );

  const archiveTask = useCallback(
    (id: string) =>
      mutate(
        (prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, archived_at: new Date().toISOString() } : t
          ),
        () => db.archiveTask(id),
        "Couldn't mark the order fulfilled."
      ),
    [mutate]
  );

  const unarchiveTask = useCallback(
    (id: string) =>
      mutate(
        (prev) => prev.map((t) => (t.id === id ? { ...t, archived_at: null } : t)),
        () => db.unarchiveTask(id),
        "Couldn't unarchive the order."
      ),
    [mutate]
  );

  // ----- subtasks ---------------------------------------------------------

  const addSubtask = useCallback(
    (
      taskId: string,
      title: string,
      dueDate: string | null,
      labelNames: string[],
      createdBy: string | null
    ) => {
      const subtask: Subtask = {
        id: crypto.randomUUID(),
        task_id: taskId,
        title,
        due_date: dueDate,
        done: false,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        labels: pendingLabels(labelNames),
      };
      return mutate(
        (prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t
          ),
        () =>
          db.createSubtask(
            {
              id: subtask.id,
              task_id: taskId,
              title,
              due_date: dueDate,
              created_by: createdBy,
            },
            labelNames
          ),
        "Couldn't add the subtask."
      );
    },
    [mutate]
  );

  const editSubtask = useCallback(
    (id: string, patch: SubtaskPatch, labelNames?: string[]) =>
      mutate(
        (prev) =>
          prev.map((t) => ({
            ...t,
            subtasks: t.subtasks.map((st) =>
              st.id === id
                ? {
                    ...st,
                    ...patch,
                    labels:
                      labelNames !== undefined
                        ? pendingLabels(labelNames)
                        : st.labels,
                  }
                : st
            ),
          })),
        () => db.updateSubtask(id, patch, labelNames),
        "Couldn't save the subtask."
      ),
    [mutate]
  );

  const toggleSubtask = useCallback(
    (id: string, done: boolean) =>
      mutate(
        (prev) =>
          prev.map((t) => ({
            ...t,
            subtasks: t.subtasks.map((st) =>
              st.id === id ? { ...st, done } : st
            ),
          })),
        () => db.updateSubtask(id, { done }),
        "Couldn't update the subtask."
      ),
    [mutate]
  );

  const removeSubtask = useCallback(
    (id: string) =>
      mutate(
        (prev) =>
          prev.map((t) => ({
            ...t,
            subtasks: t.subtasks.filter((st) => st.id !== id),
          })),
        () => db.deleteSubtask(id),
        "Couldn't delete the subtask."
      ),
    [mutate]
  );

  // ----- labels -----------------------------------------------------------

  const renameLabel = useCallback(
    (labelId: string, newName: string) =>
      mutate(
        (prev) =>
          prev.map((t) => ({
            ...t,
            labels: t.labels.map((l) =>
              l.id === labelId ? { ...l, name: newName } : l
            ),
            subtasks: t.subtasks.map((st) => ({
              ...st,
              labels: st.labels.map((l) =>
                l.id === labelId ? { ...l, name: newName } : l
              ),
            })),
          })),
        () => db.renameLabel(labelId, newName),
        "Couldn't rename the label (names must be unique)."
      ),
    [mutate]
  );

  const removeLabel = useCallback(
    (labelId: string) =>
      mutate(
        (prev) =>
          prev.map((t) => ({
            ...t,
            labels: t.labels.filter((l) => l.id !== labelId),
            subtasks: t.subtasks.map((st) => ({
              ...st,
              labels: st.labels.filter((l) => l.id !== labelId),
            })),
          })),
        () => db.deleteLabel(labelId),
        "Couldn't delete the label."
      ),
    [mutate]
  );

  return {
    tasks,
    loading,
    error,
    clearError: () => setError(null),
    addTask,
    editTask,
    removeTask,
    archiveTask,
    unarchiveTask,
    addSubtask,
    editSubtask,
    toggleSubtask,
    removeSubtask,
    renameLabel,
    removeLabel,
  };
}
