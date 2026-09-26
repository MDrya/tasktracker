"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as db from "@/lib/data";
import { getSupabase } from "@/lib/supabase";
import type { Label, Subtask, SubtaskPatch, Task, TaskPatch } from "@/lib/types";

const BOARD_TABLES = [
  "tasks",
  "subtasks",
  "labels",
  "task_labels",
  "subtask_labels",
] as const;

/** Placeholder Label objects for names the user just typed, shown until
 *  the next refresh swaps in the real rows (chips render by name only). */
function pendingLabels(names: string[]): Label[] {
  return db.cleanLabelNames(names).map((name) => ({ id: `pending:${name}`, name }));
}

/**
 * Board state + realtime sync + optimistic mutations.
 *
 * Mutations apply to local state immediately and write to Supabase in the
 * background. Reloads from the server are coordinated: they wait until no
 * write is in flight, and a reload that started before a newer write is
 * discarded. Without that, ticking several boxes quickly makes them flicker
 * back as an older reload lands on top of newer optimistic state.
 */
export function useBoard(enabled: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Stable, so the toast's auto-dismiss timer isn't restarted every render.
  const clearError = useCallback(() => setError(null), []);

  const tasksRef = useRef<Task[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const inFlight = useRef(0);
  const writeSeq = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    const seq = writeSeq.current;
    const data = await db.fetchBoard();
    // A write started meanwhile; its own completion schedules a fresh load.
    if (inFlight.current > 0 || seq !== writeSeq.current) return;
    setTasks(data);
  }, []);

  // Local writes and the realtime echo of those same writes arrive close
  // together, so one debounced load covers both.
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      if (inFlight.current > 0) return;
      load().catch(() => {
        /* transient failure; the next change retries */
      });
    }, 300);
  }, [load]);

  // Google Sheets mirror. Only the client that made the change syncs, and
  // rapid edits collapse into one push. If the app is hidden or closed
  // before the delay runs out, the pending sync is sent immediately with
  // keepalive so it survives the page going away.
  const sheetSyncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sheetSyncPending = useRef(false);

  const syncSheetNow = useCallback(() => {
    clearTimeout(sheetSyncTimer.current);
    if (!sheetSyncPending.current) return;
    sheetSyncPending.current = false;
    fetch("/api/sheets/sync", { method: "POST", keepalive: true }).catch(() => {});
  }, []);

  const scheduleSheetSync = useCallback(() => {
    sheetSyncPending.current = true;
    clearTimeout(sheetSyncTimer.current);
    sheetSyncTimer.current = setTimeout(syncSheetNow, 3000);
  }, [syncSheetNow]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") syncSheetNow();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", syncSheetNow);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", syncSheetNow);
      syncSheetNow();
    };
  }, [syncSheetNow]);

  // Initial load + realtime. Only the board tables are watched, so push
  // subscriptions and other tables never trigger a reload.
  useEffect(() => {
    if (!enabled) return;

    load()
      .catch(() => setError("Couldn't load the board. Check your connection."))
      .finally(() => setLoading(false));

    const supabase = getSupabase();
    let channel = supabase.channel("board-changes");
    for (const table of BOARD_TABLES) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh
      );
    }
    channel.subscribe();

    return () => {
      clearTimeout(refreshTimer.current);
      supabase.removeChannel(channel);
    };
  }, [enabled, load, scheduleRefresh]);

  const mutate = useCallback(
    async (
      optimistic: (prev: Task[]) => Task[],
      persist: () => Promise<void>,
      failMessage: string
    ) => {
      const snapshot = tasksRef.current;
      writeSeq.current++;
      inFlight.current++;
      setTasks(optimistic);

      let failed = false;
      try {
        await persist();
      } catch {
        failed = true;
      } finally {
        inFlight.current--;
      }

      if (!failed) {
        scheduleSheetSync();
        scheduleRefresh();
        return;
      }

      setError(failMessage);
      // Undo by reloading server truth, which keeps any other writes that
      // succeeded meanwhile. Only if that fails too (offline) fall back to
      // the pre-change snapshot.
      if (inFlight.current > 0) return;
      try {
        setTasks(await db.fetchBoard());
      } catch {
        setTasks(snapshot);
      }
    },
    [scheduleRefresh, scheduleSheetSync]
  );

  // ----- tasks ------------------------------------------------------------

  const addTask = useCallback(
    (
      title: string,
      dueDate: string | null,
      labelNames: string[],
      createdBy: string | null,
      total: number | null = null,
      startDate: string | null = null
    ) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: crypto.randomUUID(),
        title,
        start_date: startDate,
        due_date: dueDate,
        total,
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
            {
              id: task.id,
              title,
              start_date: startDate,
              due_date: dueDate,
              total,
              created_by: createdBy,
            },
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
        done_at: null,
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
            { id: subtask.id, task_id: taskId, title, due_date: dueDate, created_by: createdBy },
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
                      labelNames !== undefined ? pendingLabels(labelNames) : st.labels,
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
              st.id === id
                ? { ...st, done, done_at: done ? new Date().toISOString() : null }
                : st
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
    clearError,
    addTask,
    editTask,
    removeTask,
    addSubtask,
    editSubtask,
    toggleSubtask,
    removeSubtask,
    renameLabel,
    removeLabel,
  };
}
