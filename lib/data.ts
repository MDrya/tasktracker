// Data-access layer: every Supabase read/write goes through here.
// The UI never talks to Supabase directly, so swapping in Supabase Auth
// later (RLS policies, user ids instead of free-text names) only touches
// this file and lib/supabase.ts.

import { getSupabase } from "./supabase";
import type { Label, Subtask, SubtaskPatch, Task, TaskPatch } from "./types";

// Raw row shapes as returned by the nested board query.
interface LabelJoinRow {
  labels: Label | null;
}
interface SubtaskRow extends Omit<Subtask, "labels"> {
  subtask_labels: LabelJoinRow[];
}
interface TaskRow extends Omit<Task, "labels" | "subtasks"> {
  task_labels: LabelJoinRow[];
  subtasks: SubtaskRow[];
}

function joinedLabels(rows: LabelJoinRow[]): Label[] {
  return rows
    .map((r) => r.labels)
    .filter((l): l is Label => l !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Fetch the whole board (tasks + subtasks + labels) in one query. */
export async function fetchBoard(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from("tasks")
    .select(
      "*, task_labels ( labels (*) ), subtasks ( *, subtask_labels ( labels (*) ) )"
    )
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data as unknown as TaskRow[]).map((t) => ({
    ...t,
    labels: joinedLabels(t.task_labels),
    subtasks: t.subtasks
      .map((st) => ({ ...st, labels: joinedLabels(st.subtask_labels) }))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
  }));
}

/** Trimmed, non-empty names, deduplicated ignoring case (first spelling wins). */
export function cleanLabelNames(names: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name && !byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), name);
  }
  return [...byKey.values()];
}

/**
 * Find-or-create labels by name, ignoring case, so "jahit" reuses an
 * existing "Jahit" instead of starting a second stage with split counts.
 */
async function ensureLabels(names: string[]): Promise<Label[]> {
  const clean = cleanLabelNames(names);
  if (clean.length === 0) return [];
  const supabase = getSupabase();

  const readAll = async () => {
    const { data, error } = await supabase.from("labels").select("*");
    if (error) throw error;
    return new Map((data as Label[]).map((l) => [l.name.toLowerCase(), l]));
  };

  let byKey = await readAll();
  const missing = clean.filter((n) => !byKey.has(n.toLowerCase()));
  if (missing.length > 0) {
    for (const name of missing) {
      const { error } = await supabase.from("labels").insert({ name });
      // 23505: another device created it a moment ago; the re-read finds it.
      if (error && error.code !== "23505") throw error;
    }
    byKey = await readAll();
  }

  return clean
    .map((n) => byKey.get(n.toLowerCase()))
    .filter((l): l is Label => l !== undefined);
}

/** Replace the label set on a task or subtask with the given names. */
async function setLabels(
  joinTable: "task_labels" | "subtask_labels",
  fkColumn: "task_id" | "subtask_id",
  ownerId: string,
  labelNames: string[]
): Promise<void> {
  const supabase = getSupabase();
  const labels = await ensureLabels(labelNames);

  const del = await supabase.from(joinTable).delete().eq(fkColumn, ownerId);
  if (del.error) throw del.error;

  if (labels.length > 0) {
    const ins = await supabase
      .from(joinTable)
      .insert(labels.map((l) => ({ [fkColumn]: ownerId, label_id: l.id })));
    if (ins.error) throw ins.error;
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface NewTask {
  id: string; // generated client-side so optimistic state matches the server row
  title: string;
  due_date: string | null;
  start_date: string | null;
  total: number | null;
  created_by: string | null;
}

export async function createTask(
  task: NewTask,
  labelNames: string[]
): Promise<void> {
  const { error } = await getSupabase().from("tasks").insert(task);
  if (error) throw error;
  if (labelNames.length > 0) {
    await setLabels("task_labels", "task_id", task.id, labelNames);
  }
}

export async function updateTask(
  id: string,
  patch: TaskPatch,
  labelNames?: string[]
): Promise<void> {
  const { error } = await getSupabase().from("tasks").update(patch).eq("id", id);
  if (error) throw error;
  if (labelNames !== undefined) {
    await setLabels("task_labels", "task_id", id, labelNames);
  }
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getSupabase().from("tasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Subtasks
// ---------------------------------------------------------------------------

export interface NewSubtask {
  id: string;
  task_id: string;
  title: string;
  due_date: string | null;
  created_by: string | null;
}

export async function createSubtask(
  subtask: NewSubtask,
  labelNames: string[]
): Promise<void> {
  const { error } = await getSupabase().from("subtasks").insert(subtask);
  if (error) throw error;
  if (labelNames.length > 0) {
    await setLabels("subtask_labels", "subtask_id", subtask.id, labelNames);
  }
}

export async function updateSubtask(
  id: string,
  patch: SubtaskPatch,
  labelNames?: string[]
): Promise<void> {
  const { error } = await getSupabase()
    .from("subtasks")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
  if (labelNames !== undefined) {
    await setLabels("subtask_labels", "subtask_id", id, labelNames);
  }
}

export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await getSupabase().from("subtasks").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** Rename a label everywhere it is referenced (single row update; the
 *  join tables reference it by id). */
export async function renameLabel(id: string, newName: string): Promise<void> {
  const { error } = await getSupabase()
    .from("labels")
    .update({ name: newName.trim() })
    .eq("id", id);
  if (error) throw error;
}

/** Delete a label. Join rows cascade, so tasks/subtasks lose the
 *  association but are otherwise untouched. */
export async function deleteLabel(id: string): Promise<void> {
  const { error } = await getSupabase().from("labels").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Push subscriptions (due-date alerts)
// ---------------------------------------------------------------------------

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  created_by: string | null;
}

/** Upsert by endpoint so re-subscribing on the same device replaces its
 *  row instead of piling up duplicates that all buzz the same phone. */
export async function savePushSubscription(
  sub: PushSubscriptionRow
): Promise<void> {
  const { error } = await getSupabase()
    .from("push_subscriptions")
    .upsert(sub, { onConflict: "endpoint" });
  if (error) throw error;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await getSupabase()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw error;
}
