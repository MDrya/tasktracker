// Shared domain types. These mirror the Supabase schema
// (supabase/migrations/0001_init.sql) plus the nested shapes the
// board query returns.

export interface Label {
  id: string;
  name: string;
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  due_date: string | null; // ISO date "YYYY-MM-DD"
  done: boolean;
  created_by: string | null;
  created_at: string;
  labels: Label[];
}

export interface Task {
  id: string;
  title: string;
  due_date: string | null; // ISO date "YYYY-MM-DD"
  total: number | null; // order total; tasks only, subtasks don't carry one
  archived_at: string | null; // set when an order is marked fulfilled
  created_by: string | null;
  created_at: string;
  updated_at: string;
  labels: Label[];
  subtasks: Subtask[];
}

/** Fields the user can edit on a task. */
export interface TaskPatch {
  title?: string;
  due_date?: string | null;
  total?: number | null;
  archived_at?: string | null;
}

/** Fields the user can edit on a subtask. */
export interface SubtaskPatch {
  title?: string;
  due_date?: string | null;
  done?: boolean;
}

export type UrgencyLevel = "overdue" | "urgent" | "soon" | "later" | "none";
