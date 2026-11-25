"use client";

import { addDays, addWeeks, format, isAfter, isToday, startOfWeek, subDays } from "date-fns";
import { motion } from "framer-motion";
import { Archive, ChevronLeft, ChevronRight, Flame, MoreHorizontal, Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";

import { HabitFormModal } from "@/components/forms/habit-form";
import { HabitIcon } from "@/components/forms/habit-icons";
import { PageHeader } from "@/components/layout/page-header";
import { useQuickActions } from "@/components/layout/quick-actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/modal";
import { useCheckIn, useDeleteHabit, useHabits, useMe, useSaveHabit } from "@/lib/queries";
import type { Habit } from "@/lib/types";
import { cn, toDayString } from "@/lib/utils";

export function HabitsView() {
  const habits = useHabits();
  const qa = useQuickActions();
  const me = useMe();
  const weekStartsOn = (me.data?.preferences.week_starts_on ?? 1) as 0 | 1;
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState<Habit | null>(null);
  const list = habits.data ?? [];
  const doneToday = list.filter((h) => h.completed_today).length;
  const best = list.reduce((m, h) => Math.max(m, h.current_streak), 0);
  const avgRate = list.length ? Math.round((list.reduce((s, h) => s + h.completion_rate_30d, 0) / list.length) * 100) : 0;

  return (
    <>
      <PageHeader title="Habits" description="Small actions, repeated. Check in daily to build streaks." actions={<Button variant="primary" onClick={() => qa.open({ kind: "habit" })}><Plus /> New habit</Button>} />
      {habits.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-[14px]" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line-strong">
          <EmptyState icon={<Flame />} title="Start a habit" description="Track anything you want to do regularly — reading, running, meditation." action={<Button variant="primary" onClick={() => qa.open({ kind: "habit" })}><Plus /> New habit</Button>} />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Summary label="Today" value={`${doneToday}/${list.length}`} sub="checked in" />
            <Summary label="Longest active streak" value={`${best}d`} sub="keep it going" icon={<Flame className="size-4 text-warning" />} />
            <Summary label="30-day consistency" value={`${avgRate}%`} sub="vs. weekly targets" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((h, i) => <HabitCard key={h.id} habit={h} index={i} onEdit={() => setEditing(h)} />)}
          </div>

          <WeekGrid habits={list} weekStartsOn={weekStartsOn} offset={weekOffset} setOffset={setWeekOffset} />
        </div>
      )}
      <HabitFormModal open={!!editing} onClose={() => setEditing(null)} habit={editing} />
    </>
  );
}

const Summary = ({ label, value, sub, icon }: { label: string; value: string; sub: string; icon?: React.ReactNode }) => (
  <Card className="p-4">
    <p className="flex items-center gap-1.5 text-xs text-fg-subtle">{icon}{label}</p>
    <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-fg">{value}</p>
    <p className="text-xs text-fg-faint">{sub}</p>
  </Card>
);

function HabitCard({ habit: h, index, onEdit }: { habit: Habit; index: number; onEdit: () => void }) {
  const check = useCheckIn();
  const del = useDeleteHabit();
  const save = useSaveHabit();
  const confirm = useConfirm();
  const today = toDayString(new Date());
  const set = new Set(h.recent);
  // 12-week heatmap (84 days), oldest → newest, column per week
  const days = Array.from({ length: 84 }, (_, i) => subDays(new Date(), 83 - i));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <Card className="h-full p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${h.color} 18%, transparent)`, color: h.color }}>
            <HabitIcon name={h.icon} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-semibold text-fg">{h.name}</p>
            <p className="text-xs text-fg-subtle">{h.target_per_week === 7 ? "Every day" : `${h.target_per_week}× per week`}</p>
          </div>
          <Menu
            trigger={<Button variant="ghost" size="icon-sm" aria-label="Habit actions"><MoreHorizontal /></Button>}
            items={[
              { label: "Edit", icon: <Pencil />, onSelect: onEdit },
              { label: "Archive", icon: <Archive />, onSelect: () => save.mutate({ id: h.id, archived: true }) },
              { label: "Delete", icon: <Trash2 />, danger: true, onSelect: async () => (await confirm({ title: `Delete “${h.name}”?`, description: "All check-in history will be lost. Archive instead to keep it.", tone: "danger", confirmLabel: "Delete" })) && del.mutate(h.id) },
            ]}
          />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex gap-5">
            <div>
              <p className="flex items-center gap-1 text-[11px] text-fg-subtle"><Flame className="size-3" />Streak</p>
              <p className="tabular text-lg font-semibold text-fg">{h.current_streak}<span className="text-xs font-normal text-fg-subtle">d</span></p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-[11px] text-fg-subtle"><Trophy className="size-3" />Best</p>
              <p className="tabular text-lg font-semibold text-fg">{h.best_streak}<span className="text-xs font-normal text-fg-subtle">d</span></p>
            </div>
            <div>
              <p className="text-[11px] text-fg-subtle">30d</p>
              <p className="tabular text-lg font-semibold text-fg">{Math.round(h.completion_rate_30d * 100)}<span className="text-xs font-normal text-fg-subtle">%</span></p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => check.mutate({ id: h.id, date: today, done: !h.completed_today })}
            className={cn(
              "h-9 rounded-xl px-3.5 text-[13px] font-semibold transition-all",
              h.completed_today ? "text-white" : "border border-line-strong text-fg-muted hover:text-fg",
            )}
            style={h.completed_today ? { background: h.color, boxShadow: `0 6px 20px -8px ${h.color}` } : undefined}
          >
            {h.completed_today ? "Done today ✓" : "Check in"}
          </motion.button>
        </div>

        <div className="mt-4 grid grid-flow-col justify-between gap-[3px]" style={{ gridTemplateRows: "repeat(7, 11px)", gridAutoColumns: "11px" }} aria-label="Last 12 weeks">
          {days.map((d) => {
            const ds = toDayString(d);
            const on = set.has(ds);
            return (
              <span
                key={ds}
                title={`${format(d, "EEE, MMM d")}${on ? " · done" : ""}`}
                className="size-[11px] rounded-[3px]"
                style={{ background: on ? h.color : "var(--surface-3)", opacity: on ? 1 : 0.6 }}
              />
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}

function WeekGrid({ habits, weekStartsOn, offset, setOffset }: { habits: Habit[]; weekStartsOn: 0 | 1; offset: number; setOffset: (n: number) => void }) {
  const check = useCheckIn();
  const start = addWeeks(startOfWeek(new Date(), { weekStartsOn }), offset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Card>
      <CardHeader
        title="Weekly check-ins"
        subtitle={`${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d")}`}
        icon={<Flame />}
        action={
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setOffset(offset - 1)} disabled={offset <= -12} aria-label="Previous week"><ChevronLeft /></Button>
            <Button variant="ghost" size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>This week</Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Next week"><ChevronRight /></Button>
          </div>
        }
      />
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr>
              <th className="w-[38%]" />
              {days.map((d) => (
                <th key={d.toISOString()} className="pb-2 text-center">
                  <p className="text-[11px] font-medium text-fg-subtle uppercase">{format(d, "EEE")}</p>
                  <p className={cn("tabular mx-auto mt-0.5 grid size-6 place-items-center rounded-full text-xs", isToday(d) ? "bg-accent font-semibold text-white" : "text-fg-muted")}>{format(d, "d")}</p>
                </th>
              ))}
              <th className="pb-2 text-right text-[11px] font-medium text-fg-subtle uppercase">Week</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => {
              const set = new Set(h.recent);
              const count = days.filter((d) => set.has(toDayString(d))).length;
              return (
                <tr key={h.id} className="border-t border-line">
                  <td className="py-2 pr-3">
                    <span className="flex items-center gap-2 text-[13px] text-fg">
                      <HabitIcon name={h.icon} className="size-3.5 shrink-0" />
                      <span className="truncate">{h.name}</span>
                    </span>
                  </td>
                  {days.map((d) => {
                    const ds = toDayString(d);
                    const on = set.has(ds);
                    const future = isAfter(d, new Date());
                    return (
                      <td key={ds} className="py-2 text-center">
                        <button
                          disabled={future}
                          onClick={() => check.mutate({ id: h.id, date: ds, done: !on })}
                          aria-label={`${h.name} ${format(d, "EEE")} ${on ? "done" : "not done"}`}
                          aria-pressed={on}
                          className={cn("mx-auto grid size-7 place-items-center rounded-lg border transition-all disabled:opacity-30", on ? "border-transparent" : "border-line hover:border-line-strong")}
                          style={on ? { background: h.color } : undefined}
                        >
                          {on ? <svg viewBox="0 0 24 24" className="size-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 12l5 5L20 7" /></svg> : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="tabular py-2 text-right text-[13px] text-fg-muted">
                    <span className={cn(count >= h.target_per_week && "font-semibold text-success")}>{count}</span>/{h.target_per_week}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
