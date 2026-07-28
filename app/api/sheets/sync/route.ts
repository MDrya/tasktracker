import { NextResponse } from "next/server";
import { fetchBoard } from "@/lib/data";
import { isTaskComplete, sortByUrgency } from "@/lib/urgency";

export const dynamic = "force-dynamic";

const HEADERS = [
  "Order",
  "Order total",
  "Order due",
  "Order status",
  "Subtask",
  "Subtask due",
  "Subtask done",
];

/**
 * Pushes the whole board to a Google Sheet via a Google Apps Script web
 * app (see google-apps-script.gs and the README).
 *
 * The sheet is a mirror, not a log: every sync replaces its contents with
 * the current board, so running it twice is harmless and the sheet can
 * never drift out of sync. One row per subtask, with the parent order
 * repeated on each row so the sheet stays sortable/filterable; orders with
 * no subtasks get a single row with the subtask columns left blank.
 *
 * No-ops quietly when the integration isn't configured, so the app works
 * normally before the Sheet is set up.
 */
export async function POST() {
  const webappUrl = process.env.GOOGLE_SHEETS_WEBAPP_URL;
  const secret = process.env.SHEETS_SHARED_SECRET;
  if (!webappUrl || !secret) {
    return NextResponse.json({ skipped: "not configured" });
  }

  const tasks = sortByUrgency(await fetchBoard());

  const rows: (string | number | null)[][] = [];
  for (const task of tasks) {
    const status = isTaskComplete(task) ? "Done" : "In progress";
    if (task.subtasks.length === 0) {
      rows.push([task.title, task.total, task.due_date, status, "", "", ""]);
      continue;
    }
    for (const st of task.subtasks) {
      rows.push([
        task.title,
        task.total,
        task.due_date,
        status,
        st.title,
        st.due_date,
        st.done ? "Yes" : "No",
      ]);
    }
  }

  const payload = JSON.stringify({ secret, headers: HEADERS, rows });

  // Apps Script answers a POST with a 302 to a one-shot script.google-
  // usercontent.com URL, and that hop fails outright maybe 1 call in 8 —
  // measured, not theoretical. Because a sync is a full overwrite rather
  // than an append, replaying it is harmless, so transport-level failures
  // are simply retried. A refusal from the script itself (bad secret) is
  // NOT retried: the answer would only be the same.
  let lastError = "unknown error";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));

    let body: string;
    try {
      const res = await fetch(webappUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!res.ok) {
        lastError = `Google returned ${res.status}`;
        continue;
      }
      body = await res.text();
    } catch (err) {
      lastError = err instanceof Error ? err.message : "network error";
      continue;
    }

    // Apps Script also answers 200 when it refuses the request, so the
    // body is the only trustworthy success signal.
    let result: { ok?: boolean; error?: string; rows?: number };
    try {
      result = JSON.parse(body);
    } catch {
      lastError = "Google returned an error page instead of a result";
      continue;
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: `Sheet refused the update: ${result.error ?? "unknown error"}` },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      rows: result.rows ?? rows.length,
      attempts: attempt + 1,
    });
  }

  return NextResponse.json(
    { error: `Sheet sync failed after 3 attempts: ${lastError}` },
    { status: 502 }
  );
}
