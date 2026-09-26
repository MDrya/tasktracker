-- Piece count on orders, and web-push subscriptions for due-date alerts.
-- Run after 0001_init.sql. Safe to re-run: every step checks first, so it
-- is harmless on a database that already has these objects.

-- Number of pieces (kaos) in the order. Main tasks only; subtasks have none.
alter table public.tasks add column if not exists total numeric;

-- One row per browser/device that opted in to due-date alerts. There are no
-- user accounts, so the daily digest goes to every subscribed device.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'anon full access'
  ) then
    create policy "anon full access" on public.push_subscriptions
      for all using (true) with check (true);
  end if;
end $$;
