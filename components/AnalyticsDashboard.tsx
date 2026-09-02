"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { openWorkload } from "@/lib/capacity";
import {
  computeCompletionStats,
  computeWeeklyTrends,
  computeStageBottlenecks,
  computeOnTimeRate,
  computeCategoryBreakdown,
} from "@/lib/analytics";

type TimeRange = 4 | 8 | 0;

const RANGE_LABELS: { value: TimeRange; label: string }[] = [
  { value: 4, label: "4 weeks" },
  { value: 8, label: "8 weeks" },
  { value: 0, label: "All time" },
];

const PIE_COLORS = [
  "#4f46e5", // indigo-600
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
];

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "red" | "indigo" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "red"
        ? "text-red-600"
        : accent === "amber"
          ? "text-amber-600"
          : "text-indigo-600";

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-neutral-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}

function MiniRing({ pct, color }: { pct: number; color: string }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0">
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#e5e5e5"
        strokeWidth="5"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

function RingKpiCard({
  label,
  pct,
  color,
  sub,
}: {
  label: string;
  pct: number;
  color: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <MiniRing pct={pct} color={color} />
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums text-neutral-900">
          {Math.round(pct)}%
        </p>
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {sub && (
          <p className="truncate text-xs text-neutral-400">{sub}</p>
        )}
      </div>
    </div>
  );
}

function BarChart({
  trends,
}: {
  trends: ReturnType<typeof computeWeeklyTrends>;
}) {
  const max = Math.max(
    1,
    ...trends.map((t) => Math.max(t.ordersCreated, t.ordersCompleted))
  );
  const barW = 100 / trends.length;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Weekly orders
      </h3>
      <div className="mt-1 flex items-center gap-4 text-xs text-neutral-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-200" />
          Created
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" />
          Completed
        </span>
      </div>
      <svg
        viewBox="0 0 320 160"
        className="mt-3 w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {trends.map((t, i) => {
          const x = i * (320 / trends.length);
          const gw = 320 / trends.length;
          const bw = gw * 0.35;
          const createdH = (t.ordersCreated / max) * 120;
          const completedH = (t.ordersCompleted / max) * 120;
          return (
            <g key={t.weekStart}>
              <rect
                x={x + gw * 0.1}
                y={130 - createdH}
                width={bw}
                height={createdH}
                rx="3"
                fill="#c7d2fe"
              />
              <rect
                x={x + gw * 0.1 + bw + 2}
                y={130 - completedH}
                width={bw}
                height={completedH}
                rx="3"
                fill="#4f46e5"
              />
              {t.ordersCreated > 0 && (
                <text
                  x={x + gw * 0.1 + bw / 2}
                  y={125 - createdH}
                  textAnchor="middle"
                  className="fill-neutral-500"
                  fontSize="9"
                >
                  {t.ordersCreated}
                </text>
              )}
              {t.ordersCompleted > 0 && (
                <text
                  x={x + gw * 0.1 + bw + 2 + bw / 2}
                  y={125 - completedH}
                  textAnchor="middle"
                  className="fill-neutral-500"
                  fontSize="9"
                >
                  {t.ordersCompleted}
                </text>
              )}
              <text
                x={x + gw / 2}
                y="150"
                textAnchor="middle"
                className="fill-neutral-400"
                fontSize="9"
              >
                {t.weekLabel}
              </text>
            </g>
          );
        })}
        <line
          x1="0"
          y1="130"
          x2="320"
          y2="130"
          stroke="#d4d4d4"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

function StageChart({
  bottlenecks,
}: {
  bottlenecks: ReturnType<typeof computeStageBottlenecks>;
}) {
  const max = Math.max(1, ...bottlenecks.map((b) => b.currentLoad));

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Stage backlog
      </h3>
      <ul className="mt-3 flex flex-col gap-2.5">
        {bottlenecks.map((b, i) => {
          const pct = (b.currentLoad / max) * 100;
          return (
            <li key={b.label.id}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-neutral-700">
                  {b.label.name}
                </span>
                <span className="tabular-nums text-neutral-500">
                  {b.currentLoad}{" "}
                  <span className="text-xs text-neutral-400">pcs</span>
                  {b.overdueCount > 0 && (
                    <span className="ml-1 text-xs font-medium text-red-500">
                      {b.overdueCount} late
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-2.5 rounded-full bg-neutral-100">
                <div
                  className={`h-2.5 rounded-full ${i === 0 ? "bg-indigo-600" : "bg-indigo-300"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PieChart({
  slices,
}: {
  slices: ReturnType<typeof computeCategoryBreakdown>;
}) {
  if (slices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-400">No product data</p>
      </div>
    );
  }

  const r = 50;
  const cx = 65;
  const cy = 65;
  let cumulative = 0;

  const arcs = slices.map((s, i) => {
    const start = cumulative;
    cumulative += s.percentage;
    const startAngle = (start / 100) * 2 * Math.PI - Math.PI / 2;
    const endAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    const large = s.percentage > 50 ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    return {
      d:
        slices.length === 1
          ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy + 0.01} Z`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
      color: PIE_COLORS[i % PIE_COLORS.length],
      label: s.label.name,
      pieces: s.pieces,
      pct: s.percentage,
    };
  });

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Product mix
      </h3>
      <div className="mt-3 flex items-center gap-4">
        <svg width="130" height="130" viewBox="0 0 130 130" className="shrink-0">
          {arcs.map((a, i) => (
            <path key={i} d={a.d} fill={a.color} />
          ))}
          <circle cx={cx} cy={cy} r="28" fill="white" />
        </svg>
        <ul className="flex min-w-0 flex-col gap-1.5">
          {arcs.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: a.color }}
              />
              <span className="truncate text-neutral-700">{a.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-neutral-400">
                {a.pieces}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OnTimeBar({ stats }: { stats: ReturnType<typeof computeOnTimeRate> }) {
  const total = stats.onTime + stats.late;
  const onTimePct = total > 0 ? (stats.onTime / total) * 100 : 0;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
        Delivery performance
      </h3>
      {total === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">
          No completed orders with due dates yet
        </p>
      ) : (
        <>
          <div className="mt-3 flex h-6 overflow-hidden rounded-full">
            {stats.onTime > 0 && (
              <div
                className="flex items-center justify-center bg-emerald-500 text-xs font-medium text-white"
                style={{ width: `${onTimePct}%` }}
              >
                {stats.onTime}
              </div>
            )}
            {stats.late > 0 && (
              <div
                className="flex items-center justify-center bg-red-400 text-xs font-medium text-white"
                style={{ width: `${100 - onTimePct}%` }}
              >
                {stats.late}
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs text-neutral-500">
            <span>
              <span className="font-medium text-emerald-600">{stats.onTime}</span>{" "}
              on time
            </span>
            <span>
              <span className="font-medium text-red-500">{stats.late}</span> late
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsDashboard({ tasks }: { tasks: Task[] }) {
  const [range, setRange] = useState<TimeRange>(8);

  const stats = useMemo(() => computeCompletionStats(tasks), [tasks]);
  const trends = useMemo(
    () => computeWeeklyTrends(tasks, range === 0 ? 52 : range),
    [tasks, range]
  );
  const bottlenecks = useMemo(() => computeStageBottlenecks(tasks), [tasks]);
  const onTime = useMemo(() => computeOnTimeRate(tasks), [tasks]);
  const categories = useMemo(() => computeCategoryBreakdown(tasks), [tasks]);
  const open = useMemo(() => openWorkload(tasks), [tasks]);

  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* Time range selector */}
      <div className="flex gap-1 rounded-full bg-neutral-200/80 p-0.5 self-start">
        {RANGE_LABELS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              range === r.value
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          label="Pieces in workshop"
          value={String(open.kaos)}
          sub={`${open.orders} order${open.orders === 1 ? "" : "s"} open`}
          accent="indigo"
        />
        <RingKpiCard
          label="Completion rate"
          pct={stats.completionRate}
          color="#4f46e5"
          sub={`${stats.completedOrders}/${stats.totalOrders} orders`}
        />
        <RingKpiCard
          label="On-time delivery"
          pct={onTime.rate}
          color={onTime.rate >= 80 ? "#10b981" : onTime.rate >= 50 ? "#f59e0b" : "#ef4444"}
          sub={`${onTime.onTime + onTime.late} tracked`}
        />
        <KpiCard
          label="Avg completion"
          value={stats.avgCompletionDays > 0 ? `${stats.avgCompletionDays}d` : "—"}
          sub="days per order"
          accent="amber"
        />
      </div>

      {/* Weekly trends */}
      <BarChart trends={trends} />

      {/* Stage + Category row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {bottlenecks.length > 0 ? (
          <StageChart bottlenecks={bottlenecks} />
        ) : (
          <div className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-neutral-400">No stage data yet</p>
          </div>
        )}
        <PieChart slices={categories} />
      </div>

      {/* On-time vs late */}
      <OnTimeBar stats={onTime} />
    </div>
  );
}
