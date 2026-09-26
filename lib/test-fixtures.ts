import type { Label, Subtask, Task } from "./types";

let seq = 0;

export function label(name: string): Label {
  return { id: `label-${name}`, name };
}

/** Local-time timestamp, so tests behave the same in every time zone. */
export function at(y: number, m: number, d: number, h = 12): string {
  return new Date(y, m - 1, d, h).toISOString();
}

export function subtask(over: Partial<Subtask> = {}): Subtask {
  seq++;
  return {
    id: `st-${seq}`,
    task_id: "t",
    title: `Subtask ${seq}`,
    due_date: null,
    done: false,
    done_at: null,
    created_by: null,
    created_at: at(2026, 9, 1),
    labels: [],
    ...over,
  };
}

export function task(over: Partial<Task> = {}): Task {
  seq++;
  return {
    id: `task-${seq}`,
    title: `Order ${seq}`,
    due_date: null,
    start_date: null,
    total: null,
    created_by: null,
    created_at: at(2026, 9, 1),
    updated_at: at(2026, 9, 1),
    labels: [],
    subtasks: [],
    ...over,
  };
}
