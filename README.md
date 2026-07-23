# TaskTracker

A mobile-first, shared team task tracker. Everyone with the link sees and edits
the same board; identity is a lightweight display name stored in localStorage
(no passwords). Built with Next.js (App Router) + TypeScript + Tailwind CSS,
backed by Supabase (Postgres + Realtime), deployable to Vercel.

## Features

- Tasks (orders) with subtasks, due dates, an optional numeric **total**, and
  many-to-many labels
- Label tabs act as workspaces ("All" + one tab per label in use); renaming and
  deleting labels updates everywhere
- Urgency sorting: each task sorts by the soonest of its own due date and its
  **open** subtasks' due dates (computed client-side, never stored)
- Due-date badges: overdue / ≤2 days = red, ≤7 days = amber, later = green,
  none = gray
- Progress bar per task (completed subtasks ÷ total; hidden when a task has no
  subtasks)
- **Mark fulfilled**: archives an order off the main board (with a "Show
  fulfilled" toggle to bring it back) without deleting it, so reports and
  exports keep full history
- **Due-date alerts**: an in-app banner for overdue/due-today orders, plus
  opt-in browser push notifications (bell icon) delivered by a daily digest
- **Reports**: download a month's orders as an .xlsx (opens in Google Sheets,
  Excel, Numbers) or a structured PDF grouped by day with daily/monthly totals
- Live updates via Supabase Realtime — everyone viewing the board sees changes
  as they happen
- Optimistic UI: every change applies instantly and rolls back with a toast if
  the write fails

## Project structure

```
app/
  page.tsx             The whole board UI
  api/push/subscribe/  Save/remove a browser's push subscription
  api/cron/due-digest/ Daily due-date push digest (called by Vercel Cron)
  api/export/xlsx/     Downloadable monthly .xlsx report
  api/export/pdf/      Downloadable monthly PDF report, grouped by day
components/            UI components (TaskCard, SubtaskRow, LabelTabs, dialogs…)
hooks/
  useBoard.ts          Board state + realtime sync + optimistic mutations
  useDisplayName.ts    localStorage identity
  usePushSubscription.ts  Browser push opt-in/out for this device
lib/
  supabase.ts          Supabase client singleton
  data.ts              Data-access layer — ALL reads/writes go through here
  urgency.ts           Effective due date, urgency buckets, sorting
  reportRange.ts        Month parsing + filtering shared by both exports
  types.ts              Shared domain types
public/sw.js            Service worker that displays push notifications
supabase/migrations/     SQL schema (run in the Supabase SQL editor, in order)
vercel.json              Cron schedule for the due-date digest
```

The UI never talks to Supabase directly — everything goes through
`lib/data.ts`. When real auth (Supabase Auth) is added later, only
`lib/data.ts`, `lib/supabase.ts`, and the RLS policies need to change.

## Setup

### 1. Create a Supabase project

1. Sign in at [supabase.com](https://supabase.com) and create a new project
   (any name/region; note the database password, though this app never needs it).
2. Wait for the project to finish provisioning.

### 2. Run the migrations

1. In the Supabase dashboard, open **SQL Editor**.
2. Paste the entire contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   and click **Run**.
3. Do the same for
   [`supabase/migrations/0002_orders_notifications.sql`](supabase/migrations/0002_orders_notifications.sql).
   Run them in order — 0002 depends on tables created in 0001.

Together these create the tables, enable row level security with permissive
policies (the board is intentionally public-with-link in v1), and add every
table to the realtime publication.

### 3. Generate a VAPID keypair (for push notifications)

Due-date alerts use the Web Push standard, which needs its own keypair — free
and self-generated, no external account required:

```bash
npx web-push generate-vapid-keys
```

Keep the public and private key from the output for the next step.

### 4. Set environment variables

1. In the Supabase dashboard, go to **Project Settings → API** and copy the
   **Project URL** and the **anon public** API key.
2. Copy `.env.local.example` to `.env.local` and fill in all values:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key

NEXT_PUBLIC_VAPID_PUBLIC_KEY=the-public-key-from-step-3
VAPID_PRIVATE_KEY=the-private-key-from-step-3
VAPID_SUBJECT=mailto:you@example.com

CRON_SECRET=any-random-string   # e.g. `openssl rand -hex 32`
```

`CRON_SECRET` isn't from Supabase or Vercel — it's a secret you make up
yourself, used to stop anyone but Vercel Cron from triggering the digest
endpoint.

### 5. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be asked for a display name, then you can
start adding tasks. Open a second browser window to see realtime sync.

### 6. Deploy to Vercel

1. Push this repo to GitHub (or GitLab/Bitbucket).
2. In [Vercel](https://vercel.com), **Add New → Project** and import the repo.
   The Next.js defaults are correct — no build settings to change.
3. Under **Environment Variables**, add all six variables from `.env.local`
   (Production, Preview, and Development).
4. Deploy. `vercel.json` registers the daily digest as a Vercel Cron job
   automatically — no extra setup. On the Hobby plan crons run once a day, at
   an unspecified time within the scheduled hour.
5. **Deployment Protection**: new Vercel projects gate deployments behind a
   Vercel login by default. Since this app has no login of its own, go to
   **Project Settings → Deployment Protection** and set Vercel Authentication
   to **Disabled** (or **Only Preview Deployments** to keep previews private
   while production stays open), otherwise teammates can't reach the app.
6. Share the URL with the team.

Note: browser push notifications require a secure context. They work on the
`https://*.vercel.app` production URL; `http://localhost` also qualifies as
secure for local testing.

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
- **Order total is a plain number, tasks only**: no currency symbol or
  formatting is applied, and subtasks don't carry a total — see
  `components/EntityForm.tsx`'s `showTotal` prop.
- **Archive, don't delete**: "Mark fulfilled" sets `archived_at` instead of
  removing the row, so monthly reports stay accurate even after an order
  leaves the main board. Deleting a task is still available and is permanent.
- **Reports use `due_date`, falling back to `created_at`**: an order with no
  due date still shows up in the month it was created, rather than vanishing
  from every report (`lib/reportRange.ts`).
- **Push is per-device, not per-person**: there's no login, so notification
  opt-in is stored per browser/device (`push_subscriptions` table) rather
  than tied to a display name. Everyone subscribed gets the same daily digest.
- **Digest, not per-task alerts**: the cron job sends one summary
  notification ("3 overdue · 1 due today") rather than one push per order, to
  avoid spamming a device with many due dates.

## Out of scope for v1 (planned upgrade path)

- Real authentication (Supabase Auth) — the data-access layer is already
  isolated so this won't require a rewrite
- Manual drag-and-drop ordering
- Currency formatting / multi-currency support on the order total
- A live Google Sheets connection (the .xlsx export covers the same need
  without OAuth setup — open the downloaded file in Sheets and it's there)
