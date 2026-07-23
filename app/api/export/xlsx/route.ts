import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { fetchBoard } from "@/lib/data";
import { reportDate, resolveMonth, tasksInRange } from "@/lib/reportRange";

export const dynamic = "force-dynamic";

/** Downloadable .xlsx of a month's orders — opens directly in Google
 *  Sheets, Excel, or Numbers. Includes both active and fulfilled
 *  (archived) orders so nothing drops out of the historical record. */
export async function GET(req: NextRequest) {
  const { month, start, end } = resolveMonth(
    req.nextUrl.searchParams.get("month")
  );

  const tasks = await fetchBoard();
  const rows = tasksInRange(tasks, start, end);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Orders ${month}`);
  sheet.columns = [
    { header: "Order", key: "title", width: 32 },
    { header: "Date", key: "date", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Fulfilled", key: "fulfilled", width: 12 },
    { header: "Labels", key: "labels", width: 24 },
    { header: "Subtasks done", key: "subtasks", width: 14 },
    { header: "Added by", key: "createdBy", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  let grandTotal = 0;
  for (const t of rows) {
    if (t.total !== null) grandTotal += t.total;
    sheet.addRow({
      title: t.title,
      date: reportDate(t),
      total: t.total,
      status: t.archived_at ? "Fulfilled" : "Active",
      fulfilled: t.archived_at ? t.archived_at.slice(0, 10) : "",
      labels: t.labels.map((l) => l.name).join(", "),
      subtasks: `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`,
      createdBy: t.created_by ?? "",
    });
  }
  sheet.addRow({});
  const totalRow = sheet.addRow({ title: "Grand total", total: grandTotal });
  totalRow.font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-${month}.xlsx"`,
    },
  });
}
