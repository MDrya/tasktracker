"use client";

import { useState } from "react";

/** Month picker + download links for the .xlsx and PDF monthly reports. */
export default function ExportPanel() {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 text-sm font-medium text-neutral-500 active:text-neutral-700"
      >
        {open ? "Hide export" : "Export monthly report"}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Report month"
            className="min-h-11 rounded-xl border border-neutral-200 px-3 text-base outline-none focus:border-indigo-400"
          />
          <a
            href={`/api/export/xlsx?month=${month}`}
            className="flex min-h-11 items-center rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-200"
          >
            Download Excel
          </a>
          <a
            href={`/api/export/pdf?month=${month}`}
            className="flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700"
          >
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
