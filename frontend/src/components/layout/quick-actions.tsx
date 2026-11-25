"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { EventFormModal, type EventDefaults } from "@/components/forms/event-form";
import { GoalFormModal } from "@/components/forms/goal-form";
import { HabitFormModal } from "@/components/forms/habit-form";
import { ProjectFormModal } from "@/components/forms/project-form";
import { TaskFormModal } from "@/components/forms/task-form";
import { TransactionFormModal } from "@/components/forms/transaction-form";
import type { TaskInput, TxType } from "@/lib/types";

type Action =
  | { kind: "task"; defaults?: TaskInput }
  | { kind: "project" }
  | { kind: "event"; defaults?: EventDefaults }
  | { kind: "transaction"; type?: TxType }
  | { kind: "goal" }
  | { kind: "habit" };

const Ctx = createContext<{ open: (a: Action) => void; palette: boolean; setPalette: (v: boolean) => void }>({
  open: () => {},
  palette: false,
  setPalette: () => {},
});

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<Action | null>(null);
  const [palette, setPalette] = useState(false);
  const open = useCallback((a: Action) => setAction(a), []);
  const close = useCallback(() => setAction(null), []);

  return (
    <Ctx.Provider value={{ open, palette, setPalette }}>
      {children}
      <TaskFormModal open={action?.kind === "task"} onClose={close} defaults={action?.kind === "task" ? action.defaults : undefined} />
      <ProjectFormModal open={action?.kind === "project"} onClose={close} />
      <EventFormModal open={action?.kind === "event"} onClose={close} defaults={action?.kind === "event" ? action.defaults : undefined} />
      <TransactionFormModal open={action?.kind === "transaction"} onClose={close} defaultType={action?.kind === "transaction" ? action.type : undefined} />
      <GoalFormModal open={action?.kind === "goal"} onClose={close} />
      <HabitFormModal open={action?.kind === "habit"} onClose={close} />
    </Ctx.Provider>
  );
}

export const useQuickActions = () => useContext(Ctx);
