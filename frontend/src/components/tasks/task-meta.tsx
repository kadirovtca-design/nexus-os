import { AlertCircle, ArrowDown, ArrowUp, ChevronsUp, Minus } from "lucide-react";

import type { TaskPriority, TaskStatus } from "@/lib/types";
import { cn, isOverdue, relativeDay } from "@/lib/utils";

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "To do", color: "var(--fg-subtle)" },
  in_progress: { label: "In progress", color: "var(--info)" },
  done: { label: "Done", color: "var(--success)" },
};

export const PRIORITY_META: Record<TaskPriority, { label: string; icon: typeof ArrowUp; className: string }> = {
  urgent: { label: "Urgent", icon: ChevronsUp, className: "text-danger" },
  high: { label: "High", icon: ArrowUp, className: "text-warning" },
  medium: { label: "Medium", icon: Minus, className: "text-fg-subtle" },
  low: { label: "Low", icon: ArrowDown, className: "text-fg-faint" },
};

export function PriorityIcon({ priority, withLabel }: { priority: TaskPriority; withLabel?: boolean }) {
  const m = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", m.className)} title={`${m.label} priority`}>
      <m.icon className="size-3.5" strokeWidth={2.4} />
      {withLabel ? m.label : null}
    </span>
  );
}

export function DueLabel({ due, status, className }: { due: string | null; status: TaskStatus; className?: string }) {
  if (!due) return null;
  const overdue = isOverdue(due, status);
  const label = relativeDay(due);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "text-danger" : label === "Today" ? "text-warning" : "text-fg-subtle",
        status === "done" && "text-fg-faint",
        className,
      )}
    >
      {overdue ? <AlertCircle className="size-3" /> : null}
      {label}
    </span>
  );
}
