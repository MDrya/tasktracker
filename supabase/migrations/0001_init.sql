-- TaskTracker v1 schema
-- Run this file in the Supabase SQL editor (or via `supabase db push`).

-- ============================================================
-- Tables
-- ============================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  due_date date,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.task_labels (
  task_id uuid not null references public.tasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (task_id, label_id)
);

create table public.subtask_labels (
  subtask_id uuid not null references public.subtasks (id) on delete cascade,
  label_id uuid not null references public.labels (id) on delete cascade,
  primary key (subtask_id, label_id)
);

create index subtasks_task_id_idx on public.subtasks (task_id);
create index task_labels_label_id_idx on public.task_labels (label_id);
create index subtask_labels_label_id_idx on public.subtask_labels (label_id);

-- ============================================================
-- Keep tasks.updated_at fresh on every update
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
--
-- v1 has no auth: the board is shared by everyone with the link,
-- so every table gets a permissive anon policy. When Supabase Auth
-- is added later, replace these policies with user-scoped ones —
-- the app code goes through lib/data.ts, so no frontend rewrite
-- is needed.
-- ============================================================

alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.subtask_labels enable row level security;

create policy "anon full access" on public.tasks
  for all using (true) with check (true);
create policy "anon full access" on public.subtasks
  for all using (true) with check (true);
create policy "anon full access" on public.labels
  for all using (true) with check (true);
create policy "anon full access" on public.task_labels
  for all using (true) with check (true);
create policy "anon full access" on public.subtask_labels
  for all using (true) with check (true);

-- ============================================================
-- Realtime: broadcast changes on all board tables
-- ============================================================

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.subtasks;
alter publication supabase_realtime add table public.labels;
alter publication supabase_realtime add table public.task_labels;
alter publication supabase_realtime add table public.subtask_labels;
