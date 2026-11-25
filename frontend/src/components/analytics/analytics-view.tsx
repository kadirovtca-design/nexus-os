"use client";

import { format } from "date-fns";
import { Activity, BarChart3, CalendarRange, CheckSquare, Flame, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { axisProps, ChartTooltip, Legend, SERIES } from "@/components/charts/chart-kit";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Progress, ProgressRing, Segmented, Skeleton } from "@/components/ui/misc";
import { useAnalytics, useMe } from "@/lib/queries";
import type { Analytics } from "@/lib/types";
import { cn, delta, money, parseDay, pct } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "90", label: "90D" },
  { value: "365", label: "1Y" },
] as const;

export function AnalyticsView() {
  const [range, setRange] = useState<"7" | "30" | "90" | "365">("30");
  const a = useAnalytics(Number(range));
  const currency = useMe().data?.preferences.currency ?? "USD";

  return (
    <>
      <PageHeader title="Analytics" description="Trends computed from your tasks, habits, goals and money." actions={<Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ ...r }))} />} />
      {!a.data ? (
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={cn("rounded-[14px]", i < 4 ? "h-28" : "h-72 md:col-span-2")} />)}</div>
      ) : (
        <div className={cn("space-y-5 transition-opacity", a.isFetching && "opacity-70")}>
          <Kpis a={a.data} />
          <div className="grid gap-5 lg:grid-cols-12">
            <ScoreTrend a={a.data} />
            <TaskBreakdown a={a.data} />
            <Throughput a={a.data} />
            <Weekday a={a.data} />
            <HabitConsistency a={a.data} />
            <GoalsBlock a={a.data} />
            <FinanceBlock a={a.data} currency={currency} />
          </div>
          <MonthlyTable a={a.data} currency={currency} />
        </div>
      )}
    </>
  );
}

function Kpis({ a }: { a: Analytics }) {
  const p = a.productivity;
  const items = [
    { label: "Avg. productivity", value: p.avg_score ?? "—", change: delta(p.avg_score, p.prev_avg_score), icon: <Activity /> },
    { label: "Tasks completed", value: p.completed, change: delta(p.completed, p.prev_completed), icon: <CheckSquare /> },
    { label: "On-time rate", value: pct(a.tasks.on_time_rate), sub: `${a.tasks.on_time} of ${a.tasks.due_in_range} due`, icon: <CalendarRange /> },
    { label: "Habit consistency", value: a.habits.avg_rate != null ? `${Math.round(a.habits.avg_rate)}%` : "—", sub: `${a.habits.items.length} habits`, icon: <Flame /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <Card key={k.label} className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">{k.label}<span className="text-fg-faint [&_svg]:size-4">{k.icon}</span></div>
          <p className="tabular mt-2 text-[26px] leading-none font-semibold tracking-tight text-fg">{k.value}</p>
          {"change" in k && k.change !== undefined ? (
            <p className={cn("mt-2 flex items-center gap-1 text-xs", k.change == null ? "text-fg-subtle" : k.change >= 0 ? "text-success" : "text-danger")}>
              {k.change == null ? "No prior data" : <>{k.change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}{(k.change * 100).toFixed(0)}% vs previous period</>}
            </p>
          ) : (
            <p className="mt-2 text-xs text-fg-subtle">{k.sub}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

const dayLabel = (d: string, days: number) => format(parseDay(d), days > 60 ? "MMM d" : days > 7 ? "MMM d" : "EEE");

function ScoreTrend({ a }: { a: Analytics }) {
  const data = a.productivity.series.map((d) => ({ ...d, label: dayLabel(d.date, a.range.days) }));
  return (
    <Card className="lg:col-span-8">
      <CardHeader title="Productivity trend" subtitle={a.productivity.best_day ? `Best day: ${format(parseDay(a.productivity.best_day), "EEE, MMM d")}` : "Daily score (0–100)"} icon={<Activity />} />
      <div className="h-[250px] px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="score" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} {...axisProps} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="score" name="Score" stroke="var(--accent)" strokeWidth={2} fill="url(#score)" connectNulls dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function TaskBreakdown({ a }: { a: Analytics }) {
  const s = a.tasks.status;
  const total = a.tasks.total || 1;
  const rows = [
    { label: "Done", value: s.done ?? 0, color: SERIES[2]! },
    { label: "In progress", value: s.in_progress ?? 0, color: SERIES[0]! },
    { label: "To do", value: s.todo ?? 0, color: "var(--fg-faint)" },
  ];
  const pr = a.tasks.open_by_priority;
  return (
    <Card className="lg:col-span-4">
      <CardHeader title="Task completion" subtitle={`${a.tasks.total} tasks overall`} icon={<CheckSquare />} />
      <div className="px-5 pb-5">
        <div className="flex items-center gap-4">
          <ProgressRing value={(a.tasks.completion_rate ?? 0) * 100} size={88} stroke={8}>
            <span className="tabular text-lg font-semibold text-fg">{pct(a.tasks.completion_rate)}</span>
          </ProgressRing>
          <div className="text-xs text-fg-subtle">Share of all tasks that are done. On-time rate counts tasks due in this period.</div>
        </div>
        <div className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
          {rows.map((r) => <div key={r.label} style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />)}
        </div>
        <div className="mt-2.5"><Legend items={rows.map((r) => ({ label: r.label, color: r.color, value: r.value }))} /></div>
        <p className="mt-5 mb-2 text-xs font-medium text-fg-subtle">Open by priority</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          {(["urgent", "high", "medium", "low"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-line bg-bg-subtle py-2">
              <p className="tabular text-base font-semibold text-fg">{pr[k] ?? 0}</p>
              <p className="text-[10.5px] text-fg-subtle capitalize">{k}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Throughput({ a }: { a: Analytics }) {
  const data = a.productivity.series.map((d) => ({ ...d, label: dayLabel(d.date, a.range.days) }));
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Task throughput" subtitle={`${a.productivity.created} created · ${a.productivity.completed} completed`} icon={<BarChart3 />} action={<Legend items={[{ label: "Completed", color: SERIES[2]! }, { label: "Created", color: SERIES[0]! }]} />} />
      <div className="h-[230px] px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...axisProps} minTickGap={24} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="completed" name="Completed" stroke={SERIES[2]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="created" name="Created" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Weekday({ a }: { a: Analytics }) {
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Weekly activity" subtitle="By day of week" icon={<CalendarRange />} action={<Legend items={[{ label: "Tasks", color: SERIES[0]! }, { label: "Habit check-ins", color: SERIES[3]! }]} />} />
      <div className="h-[230px] px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={a.weekday} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
            <Bar dataKey="tasks" name="Tasks" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="habits" name="Habit check-ins" fill={SERIES[3]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function HabitConsistency({ a }: { a: Analytics }) {
  const heat = a.habits.heatmap;
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Habit consistency" subtitle="Check-ins vs. weekly target in this period" icon={<Flame />} />
      {a.habits.items.length === 0 ? (
        <EmptyState className="py-10" icon={<Flame />} title="No habits tracked" />
      ) : (
        <div className="px-5 pb-5">
          <ul className="space-y-3">
            {a.habits.items.map((h) => (
              <li key={h.id}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span className="text-fg-muted">{h.name}</span>
                  <span className="tabular text-fg">{Math.round(h.rate * 100)}% <span className="text-xs text-fg-subtle">({h.done}/{Math.round(h.expected)})</span></span>
                </div>
                <Progress value={h.rate * 100} color={h.color} height={5} />
              </li>
            ))}
          </ul>
          <p className="mt-5 mb-2 text-xs font-medium text-fg-subtle">Daily completion (share of active habits)</p>
          <div className="flex flex-wrap gap-[3px]">
            {heat.map((d) => (
              <span
                key={d.date}
                title={`${format(parseDay(d.date), "MMM d")}: ${d.value == null ? "no habits" : `${Math.round(d.value * 100)}%`}`}
                className="size-3 rounded-[3px]"
                style={{ background: d.value == null ? "var(--surface-2)" : d.value === 0 ? "var(--surface-3)" : `color-mix(in oklab, var(--accent) ${Math.round(25 + d.value * 75)}%, var(--surface-3))` }}
              />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function GoalsBlock({ a }: { a: Analytics }) {
  const g = a.goals;
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Goal completion" subtitle={`${g.completed} achieved · ${g.active} active`} icon={<Target />} />
      <div className="px-5 pb-5">
        <div className="flex items-center gap-4">
          <ProgressRing value={(g.completion_rate ?? 0) * 100} size={88} stroke={8}>
            <span className="tabular text-lg font-semibold text-fg">{pct(g.completion_rate)}</span>
          </ProgressRing>
          <p className="text-xs text-fg-subtle">Share of all (non-archived) goals you’ve achieved.</p>
        </div>
        {g.by_category.length ? (
          <>
            <ul className="mt-5 space-y-2.5">
              {g.by_category.map((c) => {
                const total = c.active + c.completed;
                return (
                  <li key={c.category}>
                    <div className="mb-1 flex justify-between text-[13px]"><span className="text-fg-muted">{c.category}</span><span className="tabular text-fg-subtle">{c.completed}/{total}</span></div>
                    <div className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-surface-3">
                      <div style={{ width: `${(c.completed / total) * 100}%`, background: SERIES[2] }} />
                      <div style={{ width: `${(c.active / total) * 100}%`, background: SERIES[0] }} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3"><Legend items={[{ label: "Achieved", color: SERIES[2]! }, { label: "Active", color: SERIES[0]! }]} /></div>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function FinanceBlock({ a, currency }: { a: Analytics; currency: string }) {
  const f = a.finance;
  const max = Math.max(1, ...f.top_expenses.map((e) => e.total));
  return (
    <>
      <Card className="lg:col-span-7">
        <CardHeader title="Financial trend" subtitle="Monthly income vs. expenses" icon={<Wallet />} action={<Legend items={[{ label: "Income", color: SERIES[0]! }, { label: "Expenses", color: SERIES[1]! }]} />} />
        <div className="h-[230px] px-2 pb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={f.trend.map((t) => ({ ...t, label: format(parseDay(`${t.month}-01`), "MMM") }))} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} width={52} tickFormatter={(v) => money(v, currency, { compact: true })} />
              <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip formatter={(v) => money(v, currency)} />} />
              <Bar dataKey="income" name="Income" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="expense" name="Expenses" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="lg:col-span-5">
        <CardHeader title="Top expenses" subtitle={`${f.transactions} transactions · net ${money(f.net, currency, { sign: true })}`} icon={<Wallet />} />
        {f.top_expenses.length === 0 ? (
          <EmptyState className="py-10" icon={<Wallet />} title="No expenses in this period" />
        ) : (
          <ul className="space-y-3 px-5 pb-5">
            {f.top_expenses.map((e, i) => (
              <li key={e.category}>
                <div className="mb-1 flex justify-between text-[13px]"><span className="text-fg-muted">{e.category}</span><span className="tabular text-fg">{money(e.total, currency)}</span></div>
                <Progress value={(e.total / max) * 100} color={SERIES[i]} height={5} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function MonthlyTable({ a, currency }: { a: Analytics; currency: string }) {
  return (
    <Card>
      <CardHeader title="Monthly statistics" subtitle="Last 6 months" icon={<CalendarRange />} />
      <div className="overflow-x-auto pb-2">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-y border-line bg-bg-subtle/60 text-[11px] tracking-wide text-fg-subtle uppercase">
              {["Month", "Avg score", "Tasks done", "Tasks created", "Habit check-ins", "Income", "Expenses", "Net"].map((h, i) => (
                <th key={h} className={cn("py-2 font-medium", i === 0 ? "px-5 text-left" : "px-3 text-right")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...a.monthly].reverse().map((m) => {
              const net = m.income - m.expense;
              return (
                <tr key={m.month} className="tabular border-b border-line last:border-b-0">
                  <td className="px-5 py-2.5 text-fg">{format(parseDay(`${m.month}-01`), "MMMM yyyy")}</td>
                  <td className="px-3 py-2.5 text-right text-fg-muted">{m.avg_score ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right text-fg-muted">{m.tasks_completed}</td>
                  <td className="px-3 py-2.5 text-right text-fg-muted">{m.tasks_created}</td>
                  <td className="px-3 py-2.5 text-right text-fg-muted">{m.habit_checkins}</td>
                  <td className="px-3 py-2.5 text-right text-fg-muted">{money(m.income, currency)}</td>
                  <td className="px-3 py-2.5 text-right text-fg-muted">{money(m.expense, currency)}</td>
                  <td className={cn("px-3 py-2.5 text-right font-medium", net < 0 ? "text-danger" : "text-fg")}>{money(net, currency, { sign: true })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
