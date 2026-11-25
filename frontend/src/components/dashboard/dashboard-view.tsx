"use client";

import { format, isSameDay, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  Activity as ActivityIcon, AlertCircle, ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, CalendarPlus,
  CheckCircle2, CheckSquare, Flame, ListTodo, Plus, Target, TrendingDown, TrendingUp, Wallet, Zap,
} from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { axisProps } from "@/components/charts/chart-kit";
import { useQuickActions } from "@/components/layout/quick-actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, CheckCircle, EmptyState, Progress, ProgressRing, Skeleton } from "@/components/ui/misc";
import { useDashboard, useMe, useUpdateTask } from "@/lib/queries";
import type { Activity, Dashboard } from "@/lib/types";
import { cn, isOverdue, money, parseDay, relativeDay, timeAgo } from "@/lib/utils";

const PRIORITY_TONE = { urgent: "danger", high: "warning", medium: "neutral", low: "neutral" } as const;

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const rise = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } } };

export function DashboardView() {
  const { data, isLoading } = useDashboard();
  const me = useMe();
  const qa = useQuickActions();
  const currency = me.data?.preferences.currency ?? "USD";

  if (isLoading || !data) return <DashboardSkeleton />;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={rise} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-fg-subtle">{format(parseDay(data.date), "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-[-0.025em] text-fg sm:text-3xl">
            {data.greeting}, <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">{data.name}</span>
          </h1>
          <p className="mt-1 text-sm text-fg-subtle">{summaryLine(data)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => qa.open({ kind: "event" })}>
            <CalendarPlus /> Event
          </Button>
          <Button size="sm" onClick={() => qa.open({ kind: "transaction", type: "expense" })}>
            <ArrowUpRight /> Expense
          </Button>
          <Button size="sm" variant="primary" onClick={() => qa.open({ kind: "task" })}>
            <Plus /> New task
          </Button>
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div variants={rise} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<CheckCircle2 />} label="Completed today" value={data.productivity.completed_today} sub={`${data.productivity.due_today_open} still due today`} />
        <Kpi
          icon={<ListTodo />}
          label="Open tasks"
          value={data.productivity.open_total}
          sub={data.productivity.overdue ? <span className="text-danger">{data.productivity.overdue} overdue</span> : `${data.productivity.in_progress} in progress`}
        />
        <Kpi icon={<Flame />} label="Habits today" value={`${data.habits.done}/${data.habits.active}`} sub={data.habits.active ? `${Math.round((data.habits.done / data.habits.active) * 100)}% checked in` : "No habits yet"} />
        <Kpi
          icon={<Wallet />}
          label="Net this month"
          value={money(data.finance.net, currency, { compact: Math.abs(data.finance.net) >= 100000 })}
          sub={`${money(data.finance.income, currency, { compact: true })} in · ${money(data.finance.expense, currency, { compact: true })} out`}
          valueClass={data.finance.net < 0 ? "text-danger" : undefined}
        />
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-12">
        <motion.div variants={rise} className="lg:col-span-4">
          <ScoreCard data={data} />
        </motion.div>
        <motion.div variants={rise} className="lg:col-span-8">
          <WeekChart data={data} />
        </motion.div>

        <motion.div variants={rise} className="lg:col-span-5">
          <FocusTasks data={data} />
        </motion.div>
        <motion.div variants={rise} className="lg:col-span-4">
          <UpcomingEvents data={data} />
        </motion.div>
        <motion.div variants={rise} className="lg:col-span-3">
          <FinanceCard data={data} currency={currency} />
        </motion.div>

        <motion.div variants={rise} className="lg:col-span-7">
          <GoalsCard data={data} />
        </motion.div>
        <motion.div variants={rise} className="lg:col-span-5">
          <ActivityCard items={data.recent_activity} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function summaryLine(d: Dashboard) {
  const p = d.productivity;
  const parts: string[] = [];
  if (p.due_today_open) parts.push(`${p.due_today_open} task${p.due_today_open > 1 ? "s" : ""} due today`);
  if (d.upcoming_events.length) {
    const today = d.upcoming_events.filter((e) => isSameDay(parseISO(e.start_at), new Date())).length;
    if (today) parts.push(`${today} event${today > 1 ? "s" : ""} on your calendar`);
  }
  if (d.habits.active - d.habits.done > 0) parts.push(`${d.habits.active - d.habits.done} habit${d.habits.active - d.habits.done > 1 ? "s" : ""} to check in`);
  return parts.length ? `You have ${parts.join(", ")}.` : "Your day is clear. Plan something meaningful.";
}

function Kpi({ icon, label, value, sub, valueClass }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: React.ReactNode; valueClass?: string }) {
  return (
    <Card className="group relative overflow-hidden p-4 transition-colors hover:border-line-strong">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-subtle">{label}</p>
        <span className="text-fg-faint transition-colors group-hover:text-accent-2 [&_svg]:size-4">{icon}</span>
      </div>
      <p className={cn("tabular mt-2 text-[26px] leading-none font-semibold tracking-tight text-fg", valueClass)}>{value}</p>
      {sub ? <p className="mt-2 truncate text-xs text-fg-subtle">{sub}</p> : null}
    </Card>
  );
}

function ScoreCard({ data }: { data: Dashboard }) {
  const { score, previous } = data.productivity;
  const diff = score != null && previous != null ? score - previous : null;
  const label = score == null ? "No data yet" : score >= 80 ? "Exceptional" : score >= 60 ? "On track" : score >= 40 ? "Building momentum" : "Slow start";
  return (
    <Card className="relative h-full overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-accent/15 blur-3xl" />
      <CardHeader title="Productivity score" subtitle="Tasks 60% · Habits 40%" icon={<Zap />} />
      <div className="flex items-center gap-6 px-5 pb-5">
        <ProgressRing value={score} size={128} stroke={11}>
          <div className="text-center">
            <p className="tabular text-[34px] leading-none font-semibold tracking-tight text-fg">{score ?? "—"}</p>
            <p className="mt-1 text-[10.5px] font-medium tracking-wide text-fg-subtle uppercase">of 100</p>
          </div>
        </ProgressRing>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-[15px] font-semibold text-fg">{label}</p>
            {diff != null ? (
              <p className={cn("mt-0.5 flex items-center gap-1 text-xs font-medium", diff >= 0 ? "text-success" : "text-danger")}>
                {diff >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {diff >= 0 ? "+" : ""}
                {diff} vs yesterday
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-fg-subtle">
                {score == null ? "Complete a task or habit to start scoring." : "No score yesterday to compare."}
              </p>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            <Row label="Tasks done" value={data.productivity.completed_today} />
            <Row label="Due & open" value={data.productivity.due_today_open} />
            <Row label="Habits" value={`${data.habits.done}/${data.habits.active}`} />
          </div>
        </div>
      </div>
    </Card>
  );
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-6">
    <span className="text-fg-subtle">{label}</span>
    <span className="tabular font-medium text-fg">{value}</span>
  </div>
);

function WeekChart({ data }: { data: Dashboard }) {
  const rows = data.week.map((d) => ({ ...d, label: format(parseDay(d.date), "EEE"), value: d.score ?? 0 }));
  const avg = data.week.filter((d) => d.score != null);
  const avgScore = avg.length ? Math.round(avg.reduce((s, d) => s + (d.score ?? 0), 0) / avg.length) : null;
  const completed = data.week.reduce((s, d) => s + d.completed, 0);
  return (
    <Card className="h-full">
      <CardHeader
        title="Weekly productivity"
        subtitle="Daily score, last 7 days"
        icon={<ActivityIcon />}
        action={
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-[11px] text-fg-subtle">Avg score</p>
              <p className="tabular text-sm font-semibold text-fg">{avgScore ?? "—"}</p>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle">Tasks done</p>
              <p className="tabular text-sm font-semibold text-fg">{completed}</p>
            </div>
          </div>
        }
      />
      <div className="h-[190px] px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 12, left: -18, bottom: 0 }} barCategoryGap="28%">
            <XAxis dataKey="label" {...axisProps} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} {...axisProps} />
            <Tooltip
              cursor={{ fill: "var(--surface-2)", radius: 6 } as object}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!active || !p) return null;
                return (
                  <div className="rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 text-xs shadow-pop">
                    <p className="mb-1 font-medium text-fg-subtle">{format(parseDay(p.date), "EEEE, MMM d")}</p>
                    <p className="text-fg">Score <b className="tabular">{p.score ?? "—"}</b></p>
                    <p className="text-fg-muted">{p.completed} tasks · {p.habits_done}/{p.habits_active} habits</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {rows.map((r, i) => (
                <Cell key={r.date} fill={i === rows.length - 1 ? "var(--accent)" : "color-mix(in oklab, var(--accent) 45%, var(--surface-3))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function FocusTasks({ data }: { data: Dashboard }) {
  const update = useUpdateTask();
  const qa = useQuickActions();
  return (
    <Card className="h-full">
      <CardHeader
        title="Focus"
        subtitle="Overdue and due in the next 3 days"
        icon={<CheckSquare />}
        action={
          <Link href="/tasks" className="flex items-center gap-1 text-xs whitespace-nowrap text-fg-subtle hover:text-fg">
            All tasks <ArrowRight className="size-3" />
          </Link>
        }
      />
      {data.focus_tasks.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<CheckCircle2 />}
          title="Nothing pressing"
          description="No overdue or soon-due tasks."
          action={<Button size="sm" onClick={() => qa.open({ kind: "task" })}><Plus /> Add task</Button>}
        />
      ) : (
        <ul className="px-2 pb-3">
          {data.focus_tasks.map((t) => {
            const overdue = isOverdue(t.due_date, t.status);
            return (
              <li key={t.id} className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-2/70">
                <CheckCircle checked={t.status === "done"} onChange={(v) => update.mutate({ id: t.id, status: v ? "done" : "todo" })} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[13.5px] text-fg", t.status === "done" && "text-fg-subtle line-through")}>{t.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fg-subtle">
                    {t.project ? (
                      <span className="flex items-center gap-1">
                        <span className="size-1.5 rounded-full" style={{ background: t.project.color }} />
                        {t.project.name}
                      </span>
                    ) : null}
                    <span className={cn(overdue && "flex items-center gap-1 text-danger")}>
                      {overdue ? <AlertCircle className="size-3" /> : null}
                      {relativeDay(t.due_date)}
                    </span>
                  </div>
                </div>
                <Badge tone={PRIORITY_TONE[t.priority]} className="capitalize">{t.priority}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function UpcomingEvents({ data }: { data: Dashboard }) {
  const qa = useQuickActions();
  return (
    <Card className="h-full">
      <CardHeader
        title="Upcoming"
        subtitle="Next 7 days"
        icon={<CalendarDays />}
        action={
          <Link href="/calendar" className="flex items-center gap-1 text-xs whitespace-nowrap text-fg-subtle hover:text-fg">
            Calendar <ArrowRight className="size-3" />
          </Link>
        }
      />
      {data.upcoming_events.length === 0 ? (
        <EmptyState className="py-8" icon={<CalendarDays />} title="Calendar is clear" action={<Button size="sm" onClick={() => qa.open({ kind: "event" })}><Plus /> Schedule</Button>} />
      ) : (
        <ul className="space-y-1 px-3 pb-3">
          {data.upcoming_events.map((e) => {
            const s = parseISO(e.start_at);
            const live = s <= new Date() && parseISO(e.end_at) >= new Date();
            return (
              <li key={e.id} className="flex gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/70">
                <div className="w-12 shrink-0 text-center">
                  <p className="text-[10.5px] font-medium text-fg-subtle uppercase">{format(s, "EEE")}</p>
                  <p className="tabular text-lg leading-tight font-semibold text-fg">{format(s, "d")}</p>
                </div>
                <div className="w-[3px] shrink-0 rounded-full" style={{ background: e.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-fg">{e.title}</p>
                  <p className="text-[11.5px] text-fg-subtle">
                    {e.all_day ? "All day" : `${format(s, "HH:mm")} – ${format(parseISO(e.end_at), "HH:mm")}`}
                    {e.task ? ` · ↳ ${e.task.title}` : ""}
                  </p>
                </div>
                {live ? <Badge tone="success" dot="var(--success)">Now</Badge> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function FinanceCard({ data, currency }: { data: Dashboard; currency: string }) {
  const f = data.finance;
  const b = f.budget;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="Finance" subtitle={format(parseDay(`${f.month}-01`), "MMMM yyyy")} icon={<Wallet />} />
      <div className="flex-1 space-y-4 px-5 pb-5">
        <div>
          <p className="text-xs text-fg-subtle">Balance</p>
          <p className="tabular text-2xl font-semibold tracking-tight text-fg">{money(f.balance, currency)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-bg-subtle p-2.5">
            <p className="flex items-center gap-1 text-[11px] text-fg-subtle"><ArrowDownLeft className="size-3 text-success" />Income</p>
            <p className="tabular mt-0.5 text-sm font-semibold text-fg">{money(f.income, currency, { compact: true })}</p>
          </div>
          <div className="rounded-lg border border-line bg-bg-subtle p-2.5">
            <p className="flex items-center gap-1 text-[11px] text-fg-subtle"><ArrowUpRight className="size-3 text-danger" />Spent</p>
            <p className="tabular mt-0.5 text-sm font-semibold text-fg">{money(f.expense, currency, { compact: true })}</p>
          </div>
        </div>
        {b ? (
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-fg-subtle">Monthly budget</span>
              <span className={cn("tabular font-medium", b.percent > 100 ? "text-danger" : "text-fg")}>{b.percent}%</span>
            </div>
            <Progress value={b.percent} color={b.percent > 100 ? "var(--danger)" : b.percent > 85 ? "var(--warning)" : undefined} />
            <p className="mt-1.5 text-[11.5px] text-fg-subtle">
              {b.remaining >= 0 ? `${money(b.remaining, currency)} left` : `${money(-b.remaining, currency)} over budget`}
            </p>
          </div>
        ) : (
          <Link href="/finance" className="block text-xs text-accent-2 hover:underline">Set a monthly budget →</Link>
        )}
      </div>
    </Card>
  );
}

function GoalsCard({ data }: { data: Dashboard }) {
  const qa = useQuickActions();
  return (
    <Card className="h-full">
      <CardHeader
        title="Goals"
        subtitle={`${data.goals.active} active · ${data.goals.completed} achieved`}
        icon={<Target />}
        action={
          <Link href="/goals" className="flex items-center gap-1 text-xs whitespace-nowrap text-fg-subtle hover:text-fg">
            All goals <ArrowRight className="size-3" />
          </Link>
        }
      />
      {data.goals.items.length === 0 ? (
        <EmptyState className="py-8" icon={<Target />} title="No active goals" description="Set a goal and break it into milestones." action={<Button size="sm" onClick={() => qa.open({ kind: "goal" })}><Plus /> New goal</Button>} />
      ) : (
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2">
          {data.goals.items.map((g) => {
            const next = g.milestones.find((m) => !m.done);
            return (
              <Link key={g.id} href="/goals" className="rounded-xl border border-line bg-bg-subtle p-3.5 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-[13.5px] font-medium text-fg">{g.title}</p>
                  <span className="tabular text-xs font-semibold text-fg">{g.progress}%</span>
                </div>
                <Progress value={g.progress} className="mt-2.5" height={5} />
                <p className="mt-2 truncate text-[11.5px] text-fg-subtle">
                  {next ? `Next: ${next.title}` : g.category ?? "No milestones"}
                  {g.deadline ? ` · ${relativeDay(g.deadline)}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="text-success" />,
  created: <Plus className="text-info" />,
  deleted: <TrendingDown className="text-danger" />,
};

function ActivityCard({ items }: { items: Activity[] }) {
  return (
    <Card className="h-full">
      <CardHeader title="Recent activity" icon={<ActivityIcon />} />
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-fg-subtle">Your activity will show up here.</p>
      ) : (
        <ul className="relative px-5 pb-4">
          <span className="absolute top-2 bottom-6 left-[29px] w-px bg-line" />
          {items.map((a) => (
            <li key={a.id} className="relative flex items-start gap-3 py-1.5">
              <span className="relative z-10 grid size-[18px] shrink-0 place-items-center rounded-full border border-line-strong bg-surface [&_svg]:size-2.5">
                {ACTION_ICON[a.action] ?? <span className="size-1.5 rounded-full bg-fg-faint" />}
              </span>
              <p className="min-w-0 flex-1 truncate text-[13px] text-fg-muted">{a.message}</p>
              <span className="shrink-0 text-[11px] text-fg-faint">{timeAgo(a.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-9 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-[14px]" />)}
      </div>
      <div className="grid gap-5 lg:grid-cols-12">
        <Skeleton className="h-[250px] rounded-[14px] lg:col-span-4" />
        <Skeleton className="h-[250px] rounded-[14px] lg:col-span-8" />
        <Skeleton className="h-[300px] rounded-[14px] lg:col-span-5" />
        <Skeleton className="h-[300px] rounded-[14px] lg:col-span-4" />
        <Skeleton className="h-[300px] rounded-[14px] lg:col-span-3" />
      </div>
    </div>
  );
}
