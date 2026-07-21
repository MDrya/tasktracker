# TaskTracker

A mobile-first, shared team task tracker. Everyone with the link sees and edits
the same board; identity is a lightweight display name stored in localStorage
(no passwords). Built with Next.js (App Router) + TypeScript + Tailwind CSS,
backed by Supabase (Postgres + Realtime), deployable to Vercel.

## Features

- Tasks with subtasks, due dates, and many-to-many labels
- Label tabs act as workspaces ("All" + one tab per label in use); renaming and
  deleting labels updates everywhere
- Urgency sorting: each task sorts by the soonest of its own due date and its
  **open** subtasks' due dates (computed client-side, never stored)
- Due-date badges: overdue / ≤2 days = red, ≤7 days = amber, later = green,
  none = gray
- Progress bar per task (completed subtasks ÷ total; hidden when a task has no
  subtasks)
- Live updates via Supabase Realtime — everyone viewing the board sees changes
  as they happen
- Optimistic UI: every change applies instantly and rolls back with a toast if
  the write fails

## Project structure

```
app/                  Next.js App Router pages (page.tsx is the whole board UI)
components/           UI components (TaskCard, SubtaskRow, LabelTabs, dialogs…)
hooks/
  useBoard.ts         Board state + realtime sync + optimistic mutations
  useDisplayName.ts   localStorage identity
lib/
  supabase.ts         Supabase client singleton
  data.ts             Data-access layer — ALL reads/writes go through here
  urgency.ts          Effective due date, urgency buckets, sorting
  types.ts            Shared domain types
supabase/migrations/  SQL schema (run in the Supabase SQL editor)
```

The UI never talks to Supabase directly — everything goes through
`lib/data.ts`. When real auth (Supabase Auth) is added later, only
`lib/data.ts`, `lib/supabase.ts`, and the RLS policies need to change.

## Setup

### 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) and create a new project
   (any name/region; note the database password, though this app never needs it).
2. Wait for the project to finish provisioning.

### 2. Run the migration

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   and click **Run**.

This creates the five tables, enables row level security with permissive
policies (the board is intentionally public-with-link in v1), and adds all
tables to the realtime publication.

### 3. Set environment variables

1. In the Supabase dashboard, go to **Project Settings → API** and copy the
   **Project URL** and the **anon public** API key.
2. Copy `.env.local.example` to `.env.local` and fill both values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be asked for a display name, then you can
start adding tasks. Open a second browser window to see realtime sync.

### 5. Deploy to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In [Vercel](https://vercel.com), **Add New → Project** and import the repo.
   The Next.js defaults are correct — no build settings to change.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values as `.env.local`.
4. Deploy, then share the URL with the team.

## Design decisions / defaults chosen

- **Zero-subtask progress**: the progress bar is hidden (not shown as 0%) —
  see the comment in `components/ProgressBar.tsx`.
- **Effective due date ignores completed subtasks**: a checked-off subtask no
  longer drags a task up the urgency order, which also makes toggling a
  checkbox visibly re-sort the list (`lib/urgency.ts`).
- **Task badge shows effective urgency**: the collapsed card's date badge uses
  the effective due date so what you see matches the sort order.
- **Realtime = refetch**: any change to any board table triggers one debounced
  board refetch. Simple, always consistent, and cheap at team-board scale.
- **Deleting a label** removes it from every task/subtask (join rows cascade)
  but never deletes tasks.
- **Security posture (v1)**: the anon key + permissive RLS policies mean
  anyone with the URL can edit the board — that is the product intent for v1.
  The upgrade path is Supabase Auth + user-scoped RLS policies.

## Out of scope for v1 (planned upgrade path)

- Real authentication (Supabase Auth) — the data-access layer is already
  isolated so this won't require a rewrite
- Due-date notifications/reminders
- Manual drag-and-drop ordering
