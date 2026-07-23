import PDFDocument from "pdfkit";
import { NextRequest, NextResponse } from "next/server";
import { fetchBoard } from "@/lib/data";
import type { Task } from "@/lib/types";
import { reportDate, resolveMonth, tasksInRange } from "@/lib/reportRange";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** Structured monthly PDF report, orders grouped by day, with daily and
 *  month-level totals. Includes fulfilled (archived) orders too. */
export async function GET(req: NextRequest) {
  const { month, start, end } = resolveMonth(
    req.nextUrl.searchParams.get("month")
  );
  const tasks = await fetchBoard();
  const rows = tasksInRange(tasks, start, end);

  const byDay = new Map<string, Task[]>();
  for (const t of rows) {
    const d = reportDate(t);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(t);
  }

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(20).fillColor("#000").text(`Order Report — ${monthLabel(month)}`);
  doc.moveDown();

  let grandTotal = 0;

  if (rows.length === 0) {
    doc.fontSize(12).fillColor("#666").text("No orders recorded this month.");
  }

  for (const [day, dayTasks] of [...byDay.entries()].sort()) {
    doc.moveDown(0.5);
    doc.fontSize(13).fillColor("#000").text(dayLabel(day), { underline: true });
    doc.moveDown(0.2);

    let daySubtotal = 0;
    for (const t of dayTasks) {
      if (t.total !== null) {
        daySubtotal += t.total;
        grandTotal += t.total;
      }
      const status = t.archived_at ? "Fulfilled" : "Active";
      const totalStr = t.total !== null ? ` — ${t.total}` : "";
      doc.fontSize(11).fillColor("#333").text(`• ${t.title}${totalStr}  [${status}]`);
    }
    if (daySubtotal > 0) {
      doc.fontSize(10).fillColor("#666").text(`Day subtotal: ${daySubtotal}`, {
        align: "right",
      });
    }
  }

  doc.moveDown();
  doc.fontSize(13).fillColor("#000").text(`Month grand total: ${grandTotal}`, {
    align: "right",
  });

  doc.end();
  const buffer = await finished;

  return new NextResponse(Uint8Array.from(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="orders-${month}.pdf"`,
    },
  });
}
