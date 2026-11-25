"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Badge, CheckCircle } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/modal";
import { useDeleteTask, useUpdateTask } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DueLabel, PriorityIcon, STATUS_META } from "./task-meta";

export function TaskRow({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const update = useUpdateTask();
  const del = useDeleteTask();
  const confirm = useConfirm();
  const done = task.status === "done";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onOpen(task)}
      className="group flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 hover:bg-surface-2/60"
    >
      <CheckCircle checked={done} onChange={(v) => update.mutate({ id: task.id, status: v ? "done" : "todo" })} />
      <PriorityIcon priority={task.priority} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[13.5px] text-fg transition-colors", done && "text-fg-subtle line-through decoration-fg-faint")}>{task.title}</p>
        {task.description ? <p className="truncate text-xs text-fg-faint">{task.description}</p> : null}
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {task.status === "in_progress" ? <Badge tone="info" dot={STATUS_META.in_progress.color}>In progress</Badge> : null}
        {task.category ? <Badge>{task.category}</Badge> : null}
        {task.project ? (
          <Badge dot={task.project.color} className="max-w-[160px]">
            <span className="truncate">{task.project.name}</span>
          </Badge>
        ) : null}
      </div>
      <DueLabel due={task.due_date} status={task.status} className="w-20 justify-end text-right" />
      <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Menu
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Task actions">
              <MoreHorizontal />
            </Button>
          }
          items={[
            { label: "Edit", icon: <Pencil />, onSelect: () => onOpen(task) },
            {
              label: "Delete",
              icon: <Trash2 />,
              danger: true,
              onSelect: async () => {
                if (await confirm({ title: "Delete task?", description: `“${task.title}” will be permanently deleted.`, tone: "danger", confirmLabel: "Delete" }))
                  del.mutate(task.id);
              },
            },
          ]}
        />
      </div>
    </motion.li>
  );
}

export function TaskList({ tasks, onOpen, groupBy }: { tasks: Task[]; onOpen: (t: Task) => void; groupBy: "none" | "status" }) {
  if (groupBy === "status") {
    return (
      <div className="space-y-4">
        {(["in_progress", "todo", "done"] as const).map((s) => {
          const items = tasks.filter((t) => t.status === s);
          if (!items.length) return null;
          return (
            <div key={s} className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
              <div className="flex items-center gap-2 border-b border-line bg-bg-subtle/60 px-4 py-2">
                <span className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                <span className="text-xs font-semibold text-fg-muted">{STATUS_META[s].label}</span>
                <span className="tabular text-xs text-fg-faint">{items.length}</span>
              </div>
              <ul>
                <AnimatePresence initial={false}>
                  {items.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}
                </AnimatePresence>
              </ul>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <ul className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-card">
      <AnimatePresence initial={false}>
        {tasks.map((t) => <TaskRow key={t.id} task={t} onOpen={onOpen} />)}
      </AnimatePresence>
    </ul>
  );
}
