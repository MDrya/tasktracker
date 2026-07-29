"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { describeDue, summarizeDue } from "@/lib/urgency";

const DISMISS_KEY = "tasktracker:dueBannerDismissedAt";

/**
 * Warning bar for orders that are overdue, due today, or due within the
 * next couple of days. Counts come from the shared summarizeDue helper,
 * so the banner and the daily push digest always agree.
 *
 * Dismissal is stored per calendar day: closing it hides it for the rest
 * of today, but it returns tomorrow if something is still due — a warning
 * you can permanently silence stops being a warning.
 */
export default function DueBanner({ tasks }: { tasks: Task[] }) {
  const [dismissedToday, setDismissedToday] = useState(false);
  const todayKey = new Date().toDateString();

  useEffect(() => {
    setDismissedToday(localStorage.getItem(DISMISS_KEY) === todayKey);
  }, [todayKey]);

  const summary = summarizeDue(tasks);
  if (dismissedToday || summary.total === 0) return null;

  // Overdue work is the more alarming case, so it gets red; purely
  // upcoming work uses amber to match the due-date badges.
  const urgent = summary.overdue > 0 || summary.today > 0;

  return (
    <div
      className={`mt-3 flex items-center justify-between gap-2 rounded-2xl px-4 py-3 ${
        urgent ? "bg-red-50" : "bg-amber-50"
      }`}
      role="status"
    >
      <p
        className={`text-sm font-medium ${
          urgent ? "text-red-700" : "text-amber-800"
        }`}
      >
        {describeDue(summary)}
      </p>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, todayKey);
          setDismissedToday(true);
        }}
        aria-label="Dismiss until tomorrow"
        className={`flex min-h-11 min-w-11 items-center justify-center ${
          urgent ? "text-red-400" : "text-amber-500"
        }`}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path
            d="M5 5l10 10M15 5 5 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
