# TaskTracker

A mobile-first, shared team task tracker. Everyone with the link sees and edits
the same board; identity is a lightweight display name stored in localStorage
(no passwords). Built with Next.js (App Router) + TypeScript + Tailwind CSS,
backed by Supabase (Postgres + Realtime), deployable to Vercel.

## Features

- Tasks (orders) with subtasks, due dates, an optional **order total**, and
  many-to-many labels
- Label tabs act as workspaces ("All" + one tab per label in use); renaming and
  deleting labels updates everywhere
- Urgency sorting: each task sorts by the soonest of its own due date and its
  **open** subtasks' due dates (computed client-side, never stored)
- Due-date badges: overdue / ≤2 days = red, ≤7 days = amber, later = green,
  none = gray
- Progress bar per task (completed subtasks ÷ total; hidden when a task has no
  subtasks)
- Finished orders (every subtask checked off) drop to the bottom of the board
- Optional **Google Sheets mirror**: the board writes itself into a spreadsheet
  a few seconds after any change
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

## Sync to Google Sheets (optional)

The board can mirror itself into a Google Sheet. This is one-way — the app
writes to the sheet, and edits made in the sheet are overwritten on the next
sync, so keep the app as the place you actually type.

1. Create (or open) the spreadsheet you want to use.
2. **Extensions → Apps Script**. Delete whatever is in the editor and paste
   the contents of [`google-apps-script.gs`](google-apps-script.gs).
3. Replace `PASTE_THE_SAME_SECRET_HERE` with any random string — this is
   your shared secret. Save.
4. **Deploy → New deployment → Web app**, with **Execute as: Me** and
   **Who has access: Anyone**, then Authorize. Copy the deployment URL
   (it looks like `https://script.google.com/macros/s/AKfy…/exec`).

   "Anyone" is required because TaskTracker's server calls that URL without
   a Google login. The shared secret is what actually protects it, so treat
   both the URL and the secret as private.
5. Put both values in `.env.local` (and in Vercel's environment variables
   for the deployed app):

```
GOOGLE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/AKfy…/exec
SHEETS_SHARED_SECRET=the-same-string-you-put-in-the-script
```

6. Restart the dev server (or redeploy). Add or tick something on the board;
   the sheet fills in a few seconds later.

The sheet gets one row per subtask, with the parent order repeated on each
row so you can sort and filter freely:

| Order | Order total | Order due | Order status | Subtask | Subtask due | Subtask done |
|-------|-------------|-----------|--------------|---------|-------------|--------------|

Orders with no subtasks get a single row with the subtask columns blank.

**Only the first sheet is touched** — every sync clears and rewrites it, so
don't keep hand-written notes there. Extra sheets in the same spreadsheet
are left alone.

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
- **Order total is a plain number on main tasks only**: no currency symbol or
  formatting, and subtasks never carry one (`showTotal` in
  `components/EntityForm.tsx`).
- **Adding a subtask collapses the card**, returning you to the board
  overview rather than leaving the card open (`components/TaskCard.tsx`).
- **Finished orders sink to the bottom**: a task counts as finished once
  every subtask is checked. A task with *no* subtasks can never be finished —
  there's nothing to check off — so it keeps its normal urgency position
  (`isTaskComplete` in `lib/urgency.ts`).
- **Sheet sync is a mirror, not a log**: each sync replaces the sheet's
  contents, so it can't drift or double up. It's best-effort and never shows
  an error — the board is the source of truth and the next change re-syncs
  everything anyway.
- **Only the editing client syncs**: the device that made the change pushes
  to the sheet (debounced 3s), rather than every open browser reacting to the
  realtime event and firing duplicate writes.
- **Security posture (v1)**: the anon key + permissive RLS policies mean
  anyone with the URL can edit the board — that is the product intent for v1.
  The upgrade path is Supabase Auth + user-scoped RLS policies.

## Due-date warnings

Two layers, both driven by the same `summarizeDue` helper in
`lib/urgency.ts` so they can never disagree about what counts as urgent:

- **In-app banner** — a bar at the top of the board counting orders that
  are overdue, due today, or due within the next `SOON_DAYS` (2) days.
  Red when something is overdue or due today, amber when it's only
  upcoming. Dismissing hides it for the rest of the day; it returns
  tomorrow if anything is still due.
- **Daily push notification** — opt in per device with the bell button in
  the header. `vercel.json` runs `/api/cron/due-digest` daily and sends
  one summary notification per subscribed device (not one per order).

Finished orders are excluded from both — an order counts as finished when
every one of its subtasks is checked off.

The cron schedule (`0 1 * * *`) is **UTC**, which is 08:00 WIB. Adjust it
if your team is in another timezone. On Vercel's Hobby plan crons fire once
a day at an unspecified minute within the scheduled hour.

Push requires a secure context: it works on the deployed `https://` URL and
on `http://localhost`, but not over plain HTTP elsewhere. iPhones only allow
web push once the site is added to the Home Screen.

Notification setup lives in steps 3–4 of the Setup section
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
`CRON_SECRET`).

## Out of scope for v1 (planned upgrade path)

- Real authentication (Supabase Auth) — the data-access layer is already
  isolated so this won't require a rewrite
- Per-order notifications (the digest is one summary per day)
- Manual drag-and-drop ordering
