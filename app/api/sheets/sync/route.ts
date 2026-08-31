import { NextResponse } from "next/server";
import { categoryLoads, openWorkload, stageLoads } from "@/lib/capacity";
import { fetchBoard } from "@/lib/data";
import { isTaskComplete, sortByUrgency } from "@/lib/urgency";

export const dynamic = "force-dynamic";

const HEADERS = [
  "Order",
  "Order labels",
  "Order total",
  "Order start",
  "Order due",
  "Order status",
  "Subtask",
  "Subtask due",
  "Subtask done",
];

// Columns that describe the order itself, so they repeat for each of its
// subtasks and get merged into one block. The rest describe the subtask.
const ORDER_COLUMNS = 6;
// 1-based, the "Subtask done" column that gets the green/red fill.
const DONE_COLUMN = HEADERS.length;

/**
 * Number format per column, applied on every sync.
 *
 * Sheets keeps a column's old number format when the data underneath it
 * changes, so a column that once held dates will render a plain number
 * as a date — a total of 250 becomes 1900-09-06. Stating the format
 * explicitly every time makes the sheet independent of whatever the
 * column used to contain.
 *
 * Text columns are pinned to "@" so free-typed titles like "1/2" or
 * "10-12" stay as written instead of being parsed into dates.
 */
const TEXT = "@";
const DATE = "yyyy-mm-dd";
const NUMBER = "#,##0.##";
const COLUMN_FORMATS = [
  TEXT, // Order
  TEXT, // Order labels
  NUMBER, // Order total
  DATE, // Order start
  DATE, // Order due
  TEXT, // Order status
  TEXT, // Subtask
  DATE, // Subtask due
  TEXT, // Subtask done
];

/**
 * Outstanding workload per production stage, written to its own tab.
 *
 * It lives on a separate sheet because the data tab is wiped and rewritten
 * on every sync — anything sharing that tab would be destroyed.
 */
const SUMMARY_SHEET = "Kapasitas";
const SUMMARY_HEADERS = [
  "Kind",
  "Name",
  "Kaos left",
  "Orders",
  "Overdue",
  "Soonest due",
  "Missing kaos count",
];
const SUMMARY_FORMATS = [TEXT, TEXT, NUMBER, NUMBER, NUMBER, DATE, NUMBER];

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
  // Which row runs belong to one order, so the sheet can merge the order
  // columns vertically. Grouping is by identity, not by matching text:
  // two different orders can share a title, total and due date, and
  // merging those into one block would misrepresent them as a single order.
  const groups: { start: number; count: number }[] = [];

  for (const task of tasks) {
    const start = rows.length;
    const status = isTaskComplete(task) ? "Done" : "In progress";
    const labels = task.labels.map((l) => l.name).join(", ");
    const order = [task.title, labels, task.total, task.start_date, task.due_date, status];

    if (task.subtasks.length === 0) {
      rows.push([...order, "", "", ""]);
    } else {
      for (const st of task.subtasks) {
        rows.push([
          ...order,
          st.title,
          st.due_date,
          st.done ? "Yes" : "No",
        ]);
      }
    }
    groups.push({ start, count: rows.length - start });
  }

  // Stage rows count work remaining at a step; product rows count orders
  // of a type. They are kept in one table but labelled, because the two
  // kinds must never be added together — an order appears in several
  // stages at once, so summing them would count the same shirts twice.
  const open = openWorkload(tasks);
  const summaryRows: (string | number | null)[][] = [
    ["Total", "Kaos in workshop", open.kaos, open.orders, "", "", open.missingCount],
    ...stageLoads(tasks).map((load) => [
      "Stage",
      load.label.name,
      load.kaos,
      load.orders,
      load.overdue,
      load.soonestDue,
      load.missingCount,
    ]),
    ...categoryLoads(tasks).map((load) => [
      "Product",
      load.label.name,
      load.openKaos,
      load.openOrders,
      load.overdue,
      load.soonestDue,
      load.missingCount,
    ]),
  ];

  const payload = JSON.stringify({
    secret,
    headers: HEADERS,
    rows,
    groups,
    // The sheet layout travels with the data, so adding or reordering
    // columns here never needs the Apps Script redeployed to match.
    orderColumns: ORDER_COLUMNS,
    doneColumn: DONE_COLUMN,
    formats: COLUMN_FORMATS,
    summary: {
      sheetName: SUMMARY_SHEET,
      headers: SUMMARY_HEADERS,
      rows: summaryRows,
      formats: SUMMARY_FORMATS,
    },
  });

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
    let result: {
      ok?: boolean;
      error?: string;
      rows?: number;
      merged?: number;
    };
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
      // Absent when the Sheet is still running an older deployed version
      // of the script, which is the usual reason merging/colour go missing.
      merged: result.merged,
      attempts: attempt + 1,
    });
  }

  return NextResponse.json(
    { error: `Sheet sync failed after 3 attempts: ${lastError}` },
    { status: 502 }
  );
}
