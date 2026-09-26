-- 1. Record when each subtask was finished, so analytics can measure
--    completion time and on-time delivery.
-- 2. Make label names case-insensitive, merging existing duplicates such as
--    "Jahit" and "jahit" into one label first.
-- Run after 0003_start_date.sql. Safe to re-run.

-- ============================================================
-- 1. subtasks.done_at, maintained by the database
-- ============================================================

alter table public.subtasks add column if not exists done_at timestamptz;

-- Subtasks ticked before this migration have no known finish time, so they
-- are left null rather than guessed; analytics skips orders without one.

create or replace function public.set_subtask_done_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.done_at := case when new.done then now() else null end;
  elsif new.done and not old.done then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists subtasks_set_done_at on public.subtasks;
create trigger subtasks_set_done_at
  before insert or update of done on public.subtasks
  for each row
  execute function public.set_subtask_done_at();

-- ============================================================
-- 2. Case-insensitive label names
-- ============================================================

-- For each group of names that differ only by case or surrounding spaces,
-- keep one label (capitalised spelling first) and move every order and
-- subtask onto it.
drop table if exists label_dups;
create temp table label_dups as
select id, keep_id
from (
  select
    id,
    first_value(id) over (
      partition by lower(btrim(name))
      order by name collate "C", id
    ) as keep_id
  from public.labels
) ranked
where id <> keep_id;

insert into public.task_labels (task_id, label_id)
select tl.task_id, d.keep_id
from public.task_labels tl
join label_dups d on d.id = tl.label_id
on conflict do nothing;

insert into public.subtask_labels (subtask_id, label_id)
select sl.subtask_id, d.keep_id
from public.subtask_labels sl
join label_dups d on d.id = sl.label_id
on conflict do nothing;

-- Join rows pointing at the duplicates cascade away with them.
delete from public.labels where id in (select id from label_dups);

drop table label_dups;

update public.labels set name = btrim(name) where name <> btrim(name);

create unique index if not exists labels_name_lower_key
  on public.labels (lower(name));
