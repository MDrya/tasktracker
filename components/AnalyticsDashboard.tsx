"use client";

import { useMemo, useState } from "react";
import {
  allTimeWeeks,
  computeCategoryBreakdown,
  computeCompletionStats,
  computeOnTimeRate,
  computeWeeklyTrends,
  rangeStart,
  type CategorySlice,
  type WeeklyTrend,
} from "@/lib/analytics";
import { openWorkload, stageLoads, type StageLoad } from "@/lib/capacity";
import type { Task } from "@/lib/types";
import { finishedAt, isTaskComplete } from "@/lib/urgency";

type TimeRange = 4 | 8 | null;

const RANGES: { value: TimeRange; label: string }[] = [
  { value: 4, label: "4 weeks" },
  { value: 8, label: "8 weeks" },
  { value: null, label: "All time" },
];

const PIE_COLORS = [
  "#4f46e5",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const MUTED = "#d4d4d4";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
      {children}
    </h3>
  );
}

function Ring({ pct, color }: { pct: number | null; color: string }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const filled = pct === null ? 0 : (Math.min(Math.max(pct, 0), 100) / 100) * circ;
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" className="shrink-0" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e5e5e5" strokeWidth="5" />
      {filled > 0 && (
        // rotate(-90) moves the stroke's starting point to 12 o'clock.
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeLinecap={pct !== null && pct >= 100 ? "butt" : "round"}
          transform="rotate(-90 20 20)"
        />
      )}
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  ring,
  valueClass = "text-neutral-900",
}: {
  label: string;
  value: string;
  sub: string;
  ring?: { pct: number | null; color: string };
  valueClass?: string;
}) {
  return (
    <Card className="flex items-center gap-3">
      {ring && <Ring pct={ring.pct} color={ring.color} />}
      <div className="min-w-0">
        <p className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</p>
        <p className="text-xs font-medium text-neutral-600">{label}</p>
        <p className="text-xs text-neutral-400">{sub}</p>
      </div>
    </Card>
  );
}

function WeeklyChart({ trends }: { trends: WeeklyTrend[] }) {
  const max = Math.max(1, ...trends.map((t) => Math.max(t.ordersCreated, t.ordersCompleted)));
  const n = trends.length;
  const W = 320;
  const gw = W / n;
  const gap = Math.max(1, gw * 0.1);
  const bw = Math.max((gw - gap * 2 - 2) / 2, 2);
  const labelEvery = n > 12 ? Math.ceil(n / 8) : n > 8 ? 2 : 1;

  return (
    <Card>
      <CardTitle>Weekly orders</CardTitle>
      <div className="mt-1 flex items-center gap-4 text-xs text-neutral-400">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-200" />
          Created
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-600" />
          Finished
        </span>
      </div>
      <svg viewBox="0 0 320 160" className="mt-3 w-full" role="img" aria-label="Orders created and finished per week">
        {trends.map((t, i) => {
          const x = i * gw;
          const createdH = (t.ordersCreated / max) * 110;
          const doneH = (t.ordersCompleted / max) * 110;
          const x1 = x + gap;
          const x2 = x1 + bw + 2;
          return (
            <g key={t.weekStart}>
              <rect x={x1} y={130 - createdH} width={bw} height={createdH} rx="2" fill="#c7d2fe" />
              <rect x={x2} y={130 - doneH} width={bw} height={doneH} rx="2" fill="#4f46e5" />
              {t.ordersCreated > 0 && (
                <text x={x1 + bw / 2} y={123 - createdH} textAnchor="middle" className="fill-neutral-500" fontSize="9">
                  {t.ordersCreated}
                </text>
              )}
              {t.ordersCompleted > 0 && (
                <text x={x2 + bw / 2} y={123 - doneH} textAnchor="middle" className="fill-neutral-500" fontSize="9">
                  {t.ordersCompleted}
                </text>
              )}
              {i % labelEvery === 0 && (
                <text x={x + gw / 2} y="148" textAnchor="middle" className="fill-neutral-400" fontSize="9">
                  {t.weekLabel}
                </text>
              )}
            </g>
          );
        })}
        <line x1="0" y1="130" x2="320" y2="130" stroke={MUTED} strokeWidth="1" />
      </svg>
    </Card>
  );
}

function StageBacklog({ stages }: { stages: StageLoad[] }) {
  if (stages.length === 0) {
    return (
      <Card className="flex items-center justify-center">
        <p className="text-sm text-neutral-400">No stage work waiting</p>
      </Card>
    );
  }
  const max = Math.max(1, ...stages.map((s) => s.kaos));
  // Only single out a stage that is strictly ahead; a tie has no busiest.
  const leaders = stages.filter((s) => s.kaos === max);
  const busiest = leaders.length === 1 ? leaders[0] : null;

  return (
    <Card>
      <CardTitle>Stage backlog</CardTitle>
      <ul className="mt-3 flex flex-col gap-2.5">
        {stages.map((s) => (
          <li key={s.label.id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-neutral-700">
                {s.label.name}
                {s === busiest && (
                  <span className="ml-1.5 text-xs font-normal text-indigo-600">busiest</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-neutral-500">
                {s.kaos} <span className="text-xs text-neutral-400">pcs</span>
                {s.overdue > 0 && (
                  <span className="ml-1 text-xs font-medium text-red-500">{s.overdue} late</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-neutral-100">
              <div
                className={`h-2.5 rounded-full ${s.kaos === max ? "bg-indigo-600" : "bg-indigo-300"}`}
                style={{ width: `${(s.kaos / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProductMix({ slices }: { slices: CategorySlice[] }) {
  if (slices.length === 0) {
    return (
      <Card className="flex items-center justify-center">
        <p className="text-sm text-neutral-400">No open product orders</p>
      </Card>
    );
  }

  const r = 50;
  const c = 60;
  let cumulative = 0;
  const arcs = slices.map((s, i) => {
    const a0 = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    cumulative += s.percentage;
    const a1 = (cumulative / 100) * 2 * Math.PI - Math.PI / 2;
    const large = s.percentage > 50 ? 1 : 0;
    return {
      d: `M ${c} ${c} L ${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`,
      color: PIE_COLORS[i % PIE_COLORS.length],
      slice: s,
    };
  });

  return (
    <Card>
      <CardTitle>Product mix (open pcs)</CardTitle>
      <div className="mt-3 flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0" aria-hidden>
          {arcs.length === 1 ? (
            <circle cx={c} cy={c} r={r} fill={arcs[0].color} />
          ) : (
            arcs.map((a) => <path key={a.slice.label.id} d={a.d} fill={a.color} />)
          )}
          <circle cx={c} cy={c} r="26" fill="white" />
        </svg>
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {arcs.map((a) => (
            <li key={a.slice.label.id} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
              <span className="min-w-0 flex-1 truncate text-neutral-700">{a.slice.label.name}</span>
              <span className="shrink-0 tabular-nums text-neutral-400">{a.slice.pieces}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Delivery({ onTime, late }: { onTime: number; late: number }) {
  const total = onTime + late;
  return (
    <Card>
      <CardTitle>Delivery performance</CardTitle>
      {total === 0 ? (
        <p className="mt-3 text-sm text-neutral-400">
          No finished orders with a due date in this period yet.
        </p>
      ) : (
        <>
          <div className="mt-3 flex h-6 overflow-hidden rounded-full">
            {onTime > 0 && (
              <div
                className="flex items-center justify-center bg-emerald-500 text-xs font-medium text-white"
                style={{ width: `${(onTime / total) * 100}%` }}
              >
                {onTime}
              </div>
            )}
            {late > 0 && (
              <div
                className="flex items-center justify-center bg-red-400 text-xs font-medium text-white"
                style={{ width: `${(late / total) * 100}%` }}
              >
                {late}
              </div>
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs text-neutral-500">
            <span>
              <span className="font-medium text-emerald-600">{onTime}</span> on time
            </span>
            <span>
              <span className="font-medium text-red-500">{late}</span> late
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function formatDays(days: number): string {
  const rounded = days < 10 ? Math.round(days * 10) / 10 : Math.round(days);
  return `${rounded}d`;
}

export default function AnalyticsDashboard({ tasks }: { tasks: Task[] }) {
  const [range, setRange] = useState<TimeRange>(8);

  const since = useMemo(() => rangeStart(range), [range]);
  const chartWeeks = range ?? allTimeWeeks(tasks);

  const open = useMemo(() => openWorkload(tasks), [tasks]);
  const stats = useMemo(() => computeCompletionStats(tasks, since), [tasks, since]);
  const onTime = useMemo(() => computeOnTimeRate(tasks, since), [tasks, since]);
  const trends = useMemo(() => computeWeeklyTrends(tasks, chartWeeks), [tasks, chartWeeks]);
  const stages = useMemo(() => stageLoads(tasks), [tasks]);
  const products = useMemo(() => computeCategoryBreakdown(tasks), [tasks]);
  const untimed = useMemo(
    () => tasks.filter((t) => isTaskComplete(t) && finishedAt(t) === null).length,
    [tasks]
  );

  const onTimeColor =
    onTime.rate === null ? MUTED : onTime.rate >= 80 ? "#10b981" : onTime.rate >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-neutral-200/80 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.value)}
              className={`min-h-9 rounded-full px-3 text-xs font-medium transition-colors ${
                range === r.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          Workload figures are always right now.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">
        <StatCard
          label="Pieces in workshop"
          value={String(open.kaos)}
          sub={`${open.orders} order${open.orders === 1 ? "" : "s"} open now`}
          valueClass="text-indigo-600"
        />
        <StatCard
          label="Orders finished"
          value={stats.completionRate === null ? "—" : `${Math.round(stats.completionRate)}%`}
          sub={`${stats.completedOrders} of ${stats.totalOrders} created in period`}
          ring={{ pct: stats.completionRate, color: "#4f46e5" }}
        />
        <StatCard
          label="On-time delivery"
          value={onTime.rate === null ? "—" : `${Math.round(onTime.rate)}%`}
          sub={
            onTime.rate === null
              ? "nothing finished to measure"
              : `${onTime.onTime + onTime.late} finished orders measured`
          }
          ring={{ pct: onTime.rate, color: onTimeColor }}
        />
        <StatCard
          label="Avg time to finish"
          value={stats.avgCompletionDays === null ? "—" : formatDays(stats.avgCompletionDays)}
          sub={
            stats.timedOrders === 0
              ? "no timed orders yet"
              : `order created → last stage, ${stats.timedOrders} order${stats.timedOrders === 1 ? "" : "s"}`
          }
          valueClass="text-amber-600"
        />
      </div>

      {untimed > 0 && (
        <p className="px-1 text-xs text-neutral-400">
          {untimed} finished order{untimed === 1 ? " was" : "s were"} completed before
          finish times were recorded, so {untimed === 1 ? "it isn’t" : "they aren’t"} in
          the timing or on-time figures.
        </p>
      )}

      <WeeklyChart trends={trends} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StageBacklog stages={stages} />
        <ProductMix slices={products} />
      </div>

      <Delivery onTime={onTime.onTime} late={onTime.late} />
    </div>
  );
}
