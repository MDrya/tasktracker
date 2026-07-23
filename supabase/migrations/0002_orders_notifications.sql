-- Adds order tracking (total, archiving) and web-push notification support.
-- Run this after 0001_init.sql, in the Supabase SQL editor.

-- ============================================================
-- Orders: a plain-number total on main tasks only (subtasks
-- don't carry a total), and archiving so fulfilled orders can
-- leave the board without losing report history.
-- ============================================================

alter table public.tasks
  add column total numeric,
  add column archived_at timestamptz;

-- ============================================================
-- Push subscriptions: one row per browser/device that opted in
-- to due-date alerts. No user accounts, so subscriptions aren't
-- tied to a person — the daily digest broadcasts to all of them.
-- ============================================================

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "anon full access" on public.push_subscriptions
  for all using (true) with check (true);

alter publication supabase_realtime add table public.push_subscriptions;
