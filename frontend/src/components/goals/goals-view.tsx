"use client";

import { differenceInCalendarDays, format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, CalendarClock, CheckCircle2, MoreHorizontal, Pencil, Plus, RotateCcw, Target, Trash2, Trophy, X } from "lucide-react";
import { useState } from "react";

import { GoalFormModal } from "@/components/forms/goal-form";
import { PageHeader } from "@/components/layout/page-header";
import { useQuickActions } from "@/components/layout/quick-actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { Badge, CheckCircle, EmptyState, Progress, ProgressRing, Segmented, Skeleton } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/modal";
import { useAddMilestone, useDeleteGoal, useDeleteMilestone, useGoals, useSaveGoal, useUpdateMilestone } from "@/lib/queries";
import type { Goal } from "@/lib/types";
import { cn, parseDay } from "@/lib/utils";

export function GoalsView() {
  const goals = useGoals();
  const qa = useQuickActions();
  const [filter, setFilter] = useState<"active" | "completed" | "all">("active");
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<Goal | null>(null);
  const all = goals.data ?? [];
  const nonArchived = all.filter((g) => g.status !== "archived");
  const categories = Array.from(new Set(nonArchived.map((g) => g.category).filter(Boolean))) as string[];
  const list = all.filter((g) => (filter === "all" ? true : g.status === filter) && (!category || g.category === category));
  const completed = nonArchived.filter((g) => g.status === "completed").length;
  const active = nonArchived.filter((g) => g.status === "active");
  const avg = active.length ? Math.round(active.reduce((s, g) => s + g.progress, 0) / active.length) : 0;
  const rate = nonArchived.length ? Math.round((completed / nonArchived.length) * 100) : 0;

  return (
    <>
      <PageHeader title="Goals" description="Long-term outcomes, broken into milestones." actions={<Button variant="primary" onClick={() => qa.open({ kind: "goal" })}><Plus /> New goal</Button>} />
      {goals.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-[14px]" />)}</div>
      ) : all.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line-strong">
          <EmptyState icon={<Target />} title="Set your first goal" description="Goals with milestones track their own progress as you check them off." action={<Button variant="primary" onClick={() => qa.open({ kind: "goal" })}><Plus /> New goal</Button>} />
        </div>
      ) : (
        <>
          <Card className="mb-5 grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={rate} size={64} stroke={7}><span className="tabular text-sm font-semibold text-fg">{rate}%</span></ProgressRing>
              <div><p className="text-xs text-fg-subtle">Completion rate</p><p className="text-sm font-medium text-fg">{completed} of {nonArchived.length}</p></div>
            </div>
            <Mini label="Active goals" value={active.length} />
            <Mini label="Achieved" value={completed} icon={<Trophy className="size-4 text-warning" />} />
            <Mini label="Avg. progress (active)" value={`${avg}%`} />
          </Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Segmented value={filter} onChange={setFilter} size="sm" options={[{ value: "active", label: "Active" }, { value: "completed", label: "Achieved" }, { value: "all", label: "All" }]} />
            <div className="mx-1 h-5 w-px bg-line" />
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(category === c ? null : c)} className={cn("h-7 rounded-lg border px-2.5 text-xs transition-colors", category === c ? "border-accent/40 bg-accent/10 text-fg" : "border-line text-fg-subtle hover:text-fg")}>
                {c}
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <EmptyState icon={<Target />} title="Nothing here" description="No goals match this filter." />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <AnimatePresence initial={false}>
                {list.map((g) => <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />)}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
      <GoalFormModal open={!!editing} onClose={() => setEditing(null)} goal={editing} />
    </>
  );
}

const Mini = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) => (
  <div>
    <p className="flex items-center gap-1.5 text-xs text-fg-subtle">{icon}{label}</p>
    <p className="tabular mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</p>
  </div>
);

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const save = useSaveGoal();
  const del = useDeleteGoal();
  const add = useAddMilestone();
  const upd = useUpdateMilestone();
  const rm = useDeleteMilestone();
  const confirm = useConfirm();
  const [title, setTitle] = useState("");
  const done = goal.status === "completed";
  const daysLeft = goal.deadline ? differenceInCalendarDays(parseDay(goal.deadline), new Date()) : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
      <Card className={cn("relative h-full overflow-hidden p-5", done && "border-success/25")}>
        {done ? <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-success/15 blur-3xl" /> : null}
        <div className="flex items-start gap-4">
          <ProgressRing value={goal.progress} size={58} stroke={6} color={done ? "var(--success)" : undefined}>
            {done ? <Trophy className="size-5 text-success" /> : <span className="tabular text-[13px] font-semibold text-fg">{goal.progress}%</span>}
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] leading-snug font-semibold text-fg">{goal.title}</h3>
              <Menu
                trigger={<Button variant="ghost" size="icon-sm" aria-label="Goal actions"><MoreHorizontal /></Button>}
                items={[
                  { label: "Edit", icon: <Pencil />, onSelect: onEdit },
                  done
                    ? { label: "Reopen", icon: <RotateCcw />, onSelect: () => save.mutate({ id: goal.id, status: "active" }) }
                    : { label: "Mark achieved", icon: <CheckCircle2 />, onSelect: () => save.mutate({ id: goal.id, status: "completed" }) },
                  { label: goal.status === "archived" ? "Unarchive" : "Archive", icon: <Archive />, onSelect: () => save.mutate({ id: goal.id, status: goal.status === "archived" ? "active" : "archived" }) },
                  { label: "Delete", icon: <Trash2 />, danger: true, onSelect: async () => (await confirm({ title: "Delete goal?", description: `“${goal.title}” and its milestones will be deleted.`, tone: "danger", confirmLabel: "Delete" })) && del.mutate(goal.id) },
                ]}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {goal.category ? <Badge tone="accent">{goal.category}</Badge> : null}
              {done && goal.completed_at ? <Badge tone="success">Achieved {format(new Date(goal.completed_at), "MMM d")}</Badge> : null}
              {!done && goal.deadline ? (
                <Badge tone={daysLeft! < 0 ? "danger" : daysLeft! <= 14 ? "warning" : "neutral"}>
                  <CalendarClock className="size-3" />
                  {daysLeft! < 0 ? `${-daysLeft!}d overdue` : `${daysLeft}d left · ${format(parseDay(goal.deadline), "MMM d")}`}
                </Badge>
              ) : null}
            </div>
            {goal.description ? <p className="mt-2 text-[13px] leading-relaxed text-fg-subtle">{goal.description}</p> : null}
          </div>
        </div>

        {goal.milestones.length ? (
          <ul className="mt-4 space-y-0.5">
            {goal.milestones.map((m) => (
              <li key={m.id} className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2/60">
                <CheckCircle size={16} checked={m.done} onChange={(v) => upd.mutate({ goalId: goal.id, id: m.id, done: v })} />
                <span className={cn("flex-1 text-[13px]", m.done ? "text-fg-subtle line-through" : "text-fg")}>{m.title}</span>
                <button onClick={() => rm.mutate({ goalId: goal.id, id: m.id })} className="text-fg-faint opacity-0 group-hover:opacity-100 hover:text-danger" aria-label="Remove milestone">
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-lg border border-line bg-bg-subtle p-3">
            <div className="mb-2 flex justify-between text-xs"><span className="text-fg-subtle">Manual progress</span><span className="tabular text-fg">{goal.manual_progress}%</span></div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              defaultValue={goal.manual_progress}
              disabled={done}
              onMouseUp={(e) => save.mutate({ id: goal.id, manual_progress: Number((e.target as HTMLInputElement).value) })}
              onKeyUp={(e) => save.mutate({ id: goal.id, manual_progress: Number((e.target as HTMLInputElement).value) })}
              onTouchEnd={(e) => save.mutate({ id: goal.id, manual_progress: Number((e.target as HTMLInputElement).value) })}
              className="w-full accent-[var(--accent)]"
              aria-label="Progress"
            />
          </div>
        )}
        {!done ? (
          <form
            className="mt-2 flex items-center gap-2 px-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!title.trim()) return;
              await add.mutateAsync({ goalId: goal.id, title: title.trim() });
              setTitle("");
            }}
          >
            <Plus className="size-3.5 text-fg-faint" />
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add milestone…" maxLength={200} className="h-8 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-faint" />
          </form>
        ) : null}
        {goal.milestones.length ? <Progress value={goal.progress} className="mt-3" height={4} color={done ? "var(--success)" : undefined} /> : null}
      </Card>
    </motion.div>
  );
}
