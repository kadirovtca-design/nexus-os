"use client";

import { format } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarPlus, Flame, ListChecks, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { useQuickActions } from "@/components/layout/quick-actions";
import { Button } from "@/components/ui/button";
import type { Dashboard } from "@/lib/types";
import { cn } from "@/lib/utils";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return now;
}

function MiniRing({ value, label, sub, icon, color }: { value: number; label: string; sub: string; icon: React.ReactNode; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/20 px-3 py-2.5 backdrop-blur-md [data-theme=light]_&:bg-white/50">
      <div className="relative size-[60px] shrink-0">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
          <motion.circle
            cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (v / 100) * c }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-fg-muted [&_svg]:size-4">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="tabular text-lg leading-tight font-semibold text-fg">{label}</p>
        <p className="truncate text-[11.5px] text-fg-subtle">{sub}</p>
      </div>
    </div>
  );
}

export function DashboardHero({ data, summary }: { data: Dashboard; summary: string }) {
  const qa = useQuickActions();
  const now = useClock();
  const p = data.productivity;
  const tasksTotal = p.completed_today + p.due_today_open;
  const taskPct = tasksTotal ? (p.completed_today / tasksTotal) * 100 : p.completed_today ? 100 : 0;
  const habitPct = data.habits.active ? (data.habits.done / data.habits.active) * 100 : 0;
  const budget = data.finance.budget;

  return (
    <div className="border-flow relative overflow-hidden rounded-[22px]">
      <div className="mesh relative overflow-hidden rounded-[22px] border border-line px-6 py-7 sm:px-8 sm:py-8">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
        {/* floating orbs */}
        <motion.div
          className="pointer-events-none absolute -top-10 right-[22%] size-40 rounded-full bg-accent/25 blur-3xl"
          animate={{ y: [0, 18, 0], x: [0, -10, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-16 left-[30%] size-48 rounded-full bg-[var(--chart-1)]/20 blur-3xl"
          animate={{ y: [0, -14, 0], x: [0, 14, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 text-[13px] font-medium text-fg-muted">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <span>{format(new Date(`${data.date}T12:00:00`), "EEEE, MMMM d")}</span>
              <span className="text-fg-faint">·</span>
              <span className="tabular text-fg">{now ? format(now, "HH:mm:ss") : "--:--:--"}</span>
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] text-fg sm:text-[44px]"
            >
              {data.greeting},<br className="sm:hidden" /> <span className="text-shine">{data.name}</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="mt-2.5 max-w-xl text-[15px] text-fg-muted">
              {summary}
            </motion.p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => qa.open({ kind: "task" })}>
                <Plus /> New task
              </Button>
              <Button className="bg-white/[0.04] backdrop-blur" onClick={() => qa.open({ kind: "event" })}>
                <CalendarPlus /> Event
              </Button>
              <Button className="bg-white/[0.04] backdrop-blur" onClick={() => qa.open({ kind: "transaction", type: "expense" })}>
                <ArrowUpRight /> Expense
              </Button>
            </div>
          </div>

          <div className={cn("grid gap-2.5 sm:grid-cols-3 xl:w-[540px]")}>
            <MiniRing value={taskPct} label={`${p.completed_today}/${tasksTotal || p.completed_today}`} sub="tasks today" icon={<ListChecks />} color="var(--accent)" />
            <MiniRing value={habitPct} label={`${data.habits.done}/${data.habits.active}`} sub="habits" icon={<Flame />} color="var(--chart-4)" />
            <MiniRing
              value={budget ? Math.min(100, budget.percent) : 0}
              label={budget ? `${budget.percent}%` : "—"}
              sub={budget ? "budget used" : "no budget"}
              icon={<Wallet />}
              color={budget && budget.percent > 100 ? "var(--danger)" : "var(--chart-3)"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
