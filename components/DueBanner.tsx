"use client";

import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { daysUntil, effectiveDueDate } from "@/lib/urgency";

const DISMISS_KEY = "tasktracker:dueBannerDismissedAt";

/**
 * Summary banner for orders that are overdue or due today, computed from
 * each task's effective due date (own date or soonest open subtask date).
 * Archived (fulfilled) tasks are excluded by the caller.
 *
 * Dismissal is stored per calendar day in sessionStorage, so closing it
 * hides it for the rest of today's session but it reappears tomorrow if
 * something is still due.
 */
export default function DueBanner({ tasks }: { tasks: Task[] }) {
  const [dismissedToday, setDismissedToday] = useState(false);
  const todayKey = new Date().toDateString();

  useEffect(() => {
    setDismissedToday(sessionStorage.getItem(DISMISS_KEY) === todayKey);
  }, [todayKey]);

  const effectiveDays = tasks
    .map((t) => effectiveDueDate(t))
    .filter((d): d is string => d !== null)
    .map(daysUntil);
  const overdue = effectiveDays.filter((d) => d < 0).length;
  const dueToday = effectiveDays.filter((d) => d === 0).length;

  if (dismissedToday || (overdue === 0 && dueToday === 0)) return null;

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${dueToday} due today`);

  return (
    <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-red-50 px-4 py-3">
      <p className="text-sm font-medium text-red-700">{parts.join(" · ")}</p>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, todayKey);
          setDismissedToday(true);
        }}
        aria-label="Dismiss"
        className="flex min-h-11 min-w-11 items-center justify-center text-red-400"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
          <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
