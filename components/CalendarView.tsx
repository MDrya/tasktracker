"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dayDiff, shortDate, toISODate } from "@/lib/dates";
import type { Task, UrgencyLevel } from "@/lib/types";
import {
  effectiveDueDate,
  isTaskComplete,
  urgencyLevel,
} from "@/lib/urgency";
import LabelChips from "./LabelChips";
import ProgressBar from "./ProgressBar";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Same meaning as the board's due badges: red = overdue or within 2 days,
// amber = within a week, green = later.
const BAR_STYLES: Record<UrgencyLevel, string> = {
  overdue: "bg-red-600 text-white",
  urgent: "bg-red-400 text-white",
  soon: "bg-amber-400 text-amber-950",
  later: "bg-emerald-500 text-white",
  none: "bg-neutral-400 text-white",
};

const LABEL_COLORS = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#22c55e",
];

interface DayInfo {
  date: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

interface TaskBar {
  task: Task;
  start: string;
  end: string;
  urgency: UrgencyLevel;
  complete: boolean;
}

interface BarSegment {
  task: Task;
  startCol: number;
  span: number;
  isStart: boolean;
  isEnd: boolean;
  urgency: UrgencyLevel;
  complete: boolean;
}

function labelColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

function getMonthGrid(year: number, month: number): DayInfo[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const dow = first.getDay();
  const padBefore = dow === 0 ? 6 : dow - 1;
  const endDow = last.getDay();
  const padAfter = endDow === 0 ? 0 : 7 - endDow;
  const totalDays = padBefore + last.getDate() + padAfter;
  const today = toISODate(new Date());
  const current = new Date(year, month, 1 - padBefore);
  const weeks: DayInfo[][] = [];

  for (let d = 0; d < totalDays; d++) {
    if (d % 7 === 0) weeks.push([]);
    const dateStr = toISODate(current);
    weeks[weeks.length - 1].push({
      date: dateStr,
      dayNum: current.getDate(),
      isCurrentMonth:
        current.getMonth() === month && current.getFullYear() === year,
      isToday: dateStr === today,
      isWeekend: current.getDay() === 0 || current.getDay() === 6,
    });
    current.setDate(current.getDate() + 1);
  }

  return weeks;
}

function getTaskBars(tasks: Task[]): TaskBar[] {
  return tasks
    .filter((t) => t.due_date)
    .map((t) => {
      const end = t.due_date!;
      // A start after the due date (entered before the form checked it)
      // would draw a negative-width bar, so it collapses to the due day.
      const start = t.start_date && t.start_date <= end ? t.start_date : end;
      return {
        task: t,
        start,
        end,
        urgency: urgencyLevel(effectiveDueDate(t)),
        complete: isTaskComplete(t),
      };
    });
}

function assignLanes(
  bars: TaskBar[],
  weekStart: string,
  weekEnd: string
): BarSegment[][] {
  const overlapping = bars
    .filter((bar) => bar.start <= weekEnd && bar.end >= weekStart)
    .sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      return dayDiff(b.start, b.end) - dayDiff(a.start, a.end);
    });

  const lanes: BarSegment[][] = [];

  for (const bar of overlapping) {
    const cStart = bar.start < weekStart ? weekStart : bar.start;
    const cEnd = bar.end > weekEnd ? weekEnd : bar.end;
    const startCol = dayDiff(weekStart, cStart);
    const span = dayDiff(cStart, cEnd) + 1;

    const segment: BarSegment = {
      task: bar.task,
      startCol,
      span,
      isStart: bar.start >= weekStart,
      isEnd: bar.end <= weekEnd,
      urgency: bar.urgency,
      complete: bar.complete,
    };

    let placed = false;
    for (const lane of lanes) {
      const hasOverlap = lane.some(
        (s) =>
          s.startCol < segment.startCol + segment.span &&
          s.startCol + s.span > segment.startCol
      );
      if (!hasOverlap) {
        lane.push(segment);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([segment]);
  }

  return lanes;
}

export default function CalendarView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask?: (taskId: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const weeks = useMemo(() => getMonthGrid(year, month), [year, month]);
  const bars = useMemo(() => getTaskBars(tasks), [tasks]);
  const undated = tasks.length - bars.length;

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  // The detail panel sits below the month grid, usually off-screen on a
  // phone, so bring it into view when a bar is tapped.
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedTaskId) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedTaskId]);

  const prev = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const next = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  const goToday = () => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
  };

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mt-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
        <button
          onClick={prev}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg font-medium text-neutral-600 active:bg-neutral-100"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-neutral-900">
            {monthLabel}
          </h2>
          <button
            onClick={goToday}
            className="min-h-9 rounded-lg bg-indigo-50 px-3 text-xs font-medium text-indigo-600 active:bg-indigo-100"
          >
            Today
          </button>
        </div>
        <button
          onClick={next}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-lg font-medium text-neutral-600 active:bg-neutral-100"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Calendar grid */}
      <div className="mt-2 overflow-hidden rounded-2xl bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-neutral-100">
          {DAY_NAMES.map((name) => (
            <div
              key={name}
              className="py-2 text-center text-xs font-medium text-neutral-400"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => {
          const weekStart = week[0].date;
          const weekEnd = week[6].date;
          const lanes = assignLanes(bars, weekStart, weekEnd);

          return (
            <div
              key={wi}
              className="border-b border-neutral-50 last:border-b-0"
            >
              {/* Day numbers */}
              <div className="grid grid-cols-7">
                {week.map((day) => (
                  <div
                    key={day.date}
                    className={`px-1 pb-0.5 pt-1.5 text-center text-xs ${
                      day.isToday
                        ? "font-bold"
                        : day.isCurrentMonth
                          ? day.isWeekend
                            ? "text-neutral-400"
                            : "text-neutral-600"
                          : "text-neutral-300"
                    }`}
                  >
                    <span
                      className={
                        day.isToday
                          ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white"
                          : ""
                      }
                    >
                      {day.dayNum}
                    </span>
                  </div>
                ))}
              </div>

              {/* Event bars */}
              {lanes.length > 0 && (
                <div className="px-0.5 pb-1">
                  {lanes.map((lane, li) => (
                    <div key={li} className="relative mt-0.5 h-7">
                      {lane.map((seg) => (
                        <button
                          key={seg.task.id}
                          onClick={() =>
                            setSelectedTaskId(
                              selectedTaskId === seg.task.id
                                ? null
                                : seg.task.id
                            )
                          }
                          className={`absolute top-0 h-full overflow-hidden text-left text-[11px] font-medium leading-7 ${
                            seg.complete
                              ? "bg-neutral-200 text-neutral-500 line-through opacity-60"
                              : BAR_STYLES[seg.urgency]
                          } ${
                            seg.isStart && seg.isEnd
                              ? "rounded"
                              : seg.isStart
                                ? "rounded-l"
                                : seg.isEnd
                                  ? "rounded-r"
                                  : ""
                          } ${
                            selectedTaskId === seg.task.id
                              ? "ring-2 ring-indigo-600 ring-offset-1"
                              : ""
                          }`}
                          style={{
                            left: `${(seg.startCol / 7) * 100}%`,
                            width: `${(seg.span / 7) * 100}%`,
                          }}
                          title={seg.task.title}
                        >
                          <span className="block truncate px-1">
                            {seg.task.title}
                            {seg.task.total !== null && ` (${seg.task.total})`}
                          </span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {undated > 0 && (
        <p className="mt-2 px-1 text-xs text-neutral-400">
          {undated} order{undated === 1 ? " has" : "s have"} no due date and
          {undated === 1 ? " isn’t" : " aren’t"} shown.
        </p>
      )}

      {/* Selected task detail */}
      {selectedTask && (
        <div ref={detailRef} className="mt-3 scroll-mb-4 rounded-2xl bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-medium text-neutral-900">
              {selectedTask.title}
            </h3>
            <button
              onClick={() => setSelectedTaskId(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 active:bg-neutral-100"
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedTask.start_date && (
              <span className="rounded-lg bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
                Start {shortDate(selectedTask.start_date)}
              </span>
            )}
            {selectedTask.due_date && (
              <span className="rounded-lg bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
                Due {shortDate(selectedTask.due_date)}
              </span>
            )}
            {selectedTask.total !== null && (
              <span className="rounded-lg bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
                {selectedTask.total} pcs
              </span>
            )}
          </div>

          {selectedTask.labels.length > 0 && (
            <div className="mt-2">
              <LabelChips labels={selectedTask.labels} />
            </div>
          )}

          <ProgressBar
            done={selectedTask.subtasks.filter((st) => st.done).length}
            total={selectedTask.subtasks.length}
          />

          {selectedTask.subtasks.length > 0 && (
            <div className="mt-3 border-t border-neutral-100 pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400">
                Subtasks
              </p>
              <ul className="flex flex-col gap-1">
                {selectedTask.subtasks.map((st) => (
                  <li key={st.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: st.done
                          ? "#10b981"
                          : st.labels.length > 0
                            ? labelColor(st.labels[0].name)
                            : "#d4d4d4",
                      }}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        st.done
                          ? "text-neutral-400 line-through"
                          : "text-neutral-700"
                      }`}
                    >
                      {st.title}
                    </span>
                    {st.labels.length > 0 && (
                      <span className="shrink-0 text-xs text-neutral-400">
                        {st.labels.map((l) => l.name).join(", ")}
                      </span>
                    )}
                    {st.due_date && (
                      <span className="shrink-0 text-xs text-neutral-400">
                        {shortDate(st.due_date)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {onSelectTask && (
            <button
              onClick={() => onSelectTask(selectedTask.id)}
              className="mt-3 min-h-11 w-full rounded-xl bg-indigo-50 text-sm font-medium text-indigo-600 active:bg-indigo-100"
            >
              Show in board view
            </button>
          )}
        </div>
      )}
    </div>
  );
}
