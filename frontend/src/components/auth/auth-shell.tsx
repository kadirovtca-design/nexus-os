"use client";

import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Flame, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: CheckCircle2, title: "Tasks & projects", body: "List and Kanban views, priorities, deadlines." },
  { icon: Wallet, title: "Money, clearly", body: "Budgets, cash flow and monthly reports." },
  { icon: Flame, title: "Habits & goals", body: "Streaks, milestones, real progress." },
  { icon: BarChart3, title: "Analytics", body: "A daily productivity score built from your data." },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="canvas-glow relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      <aside className="relative hidden flex-col justify-between border-r border-line p-10 lg:flex">
        <Logo />
        <div className="max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg"
          >
            One place to run
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">your entire life.</span>
          </motion.h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
            NEXUS OS connects your work, money, habits and ambitions — so every day starts with clarity.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="rounded-xl border border-line bg-surface/60 p-4 backdrop-blur"
              >
                <f.icon className="size-4 text-accent-2" />
                <p className="mt-3 text-[13px] font-medium text-fg">{f.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <p className="text-xs text-fg-faint">© {new Date().getFullYear()} NEXUS OS</p>
      </aside>
      <main className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
