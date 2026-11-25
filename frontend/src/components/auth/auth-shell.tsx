"use client";

import { motion } from "framer-motion";
import { BarChart3, CheckCircle2, Flame, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { Aurora } from "@/components/fx/fx";

import { ModuleOrbit } from "./orbit";

const FEATURES = [
  { icon: CheckCircle2, title: "Tasks & projects", body: "List and Kanban views, priorities, deadlines." },
  { icon: Wallet, title: "Money, clearly", body: "Budgets, cash flow and monthly reports." },
  { icon: Flame, title: "Habits & goals", body: "Streaks, milestones, real progress." },
  { icon: BarChart3, title: "Analytics", body: "A daily productivity score built from your data." },
];

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="canvas-glow relative grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <Aurora />
      <div className="grid-lines pointer-events-none absolute inset-0 opacity-60" />
      <aside className="relative z-[2] hidden flex-col justify-between overflow-hidden border-r border-line p-10 lg:flex">
        <Logo />
        <div className="max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg"
          >
            One place to run
            <br />
            <span className="text-shine">your entire life.</span>
          </motion.h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted">
            NEXUS OS connects your work, money, habits and ambitions — so every day starts with clarity.
          </p>
          <div className="relative mt-6 -ml-6 scale-[0.82] xl:scale-90 2xl:scale-100">
            <ModuleOrbit />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEATURES.map((f, i) => (
              <motion.span
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.07 }}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs text-fg-muted backdrop-blur"
              >
                <f.icon className="size-3.5 text-accent-2" />
                {f.title}
              </motion.span>
            ))}
          </div>
        </div>
        <p className="text-xs text-fg-faint">© {new Date().getFullYear()} NEXUS OS</p>
      </aside>
      <main className="relative z-[2] flex items-center justify-center px-4 py-12 sm:px-8">
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
