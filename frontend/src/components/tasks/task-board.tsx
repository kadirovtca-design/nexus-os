"use client";

import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useQuickActions } from "@/components/layout/quick-actions";
import { Badge } from "@/components/ui/misc";
import { useUpdateTask } from "@/lib/queries";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DueLabel, PriorityIcon, STATUS_META } from "./task-meta";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];
type Columns = Record<TaskStatus, Task[]>;

function group(tasks: Task[]): Columns {
  const cols: Columns = { todo: [], in_progress: [], done: [] };
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) cols[t.status].push(t);
  return cols;
}

export function TaskBoard({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) {
  const update = useUpdateTask({ silent: true });
  // While dragging we work on a local copy; otherwise columns derive straight from server data.
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const [active, setActive] = useState<Task | null>(null);
  const grouped = useMemo(() => group(tasks), [tasks]);
  const cols = dragCols ?? grouped;
  // Drop the local copy once fresh server data arrives (React's "adjust state on prop change" pattern).
  const [seen, setSeen] = useState(tasks);
  if (seen !== tasks) {
    setSeen(tasks);
    if (!active) setDragCols(null);
  }
  const setCols = (fn: Columns | ((c: Columns) => Columns)) =>
    setDragCols((prev) => (typeof fn === "function" ? fn(prev ?? grouped) : fn));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const findCol = (id: string | number): TaskStatus | null => {
    if (typeof id === "string" && id.startsWith("col:")) return id.slice(4) as TaskStatus;
    return COLUMNS.find((c) => cols[c].some((t) => t.id === id)) ?? null;
  };

  function onDragStart(e: DragStartEvent) {
    setActive(tasks.find((t) => t.id === e.active.id) ?? null);
    setDragCols(grouped);
  }

  // Move the card between columns while dragging so the drop target previews correctly.
  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over) return;
    const from = findCol(a.id);
    const to = findCol(over.id);
    if (!from || !to || from === to) return;
    setCols((prev) => {
      const moving = prev[from].find((t) => t.id === a.id);
      if (!moving) return prev;
      const overIdx = prev[to].findIndex((t) => t.id === over.id);
      const idx = overIdx >= 0 ? overIdx : prev[to].length;
      const next = { ...prev, [from]: prev[from].filter((t) => t.id !== a.id), [to]: [...prev[to]] };
      next[to].splice(idx, 0, { ...moving, status: to });
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    setActive(null);
    if (!over) return setDragCols(null);
    const col = findCol(a.id);
    if (!col) return setDragCols(null);
    const list = [...cols[col]];
    const from = list.findIndex((t) => t.id === a.id);
    let to = list.findIndex((t) => t.id === over.id);
    if (to < 0) to = from;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved!);
    setDragCols((prev) => ({ ...(prev ?? grouped), [col]: list }));
    const before = list[to - 1]?.position;
    const after = list[to + 1]?.position;
    const position = before === undefined && after === undefined ? 1024 : before === undefined ? after! - 1024 : after === undefined ? before + 1024 : (before + after) / 2;
    const original = tasks.find((t) => t.id === a.id);
    if (original && (original.status !== col || original.position !== position)) {
      update.mutate({ id: moved!.id, status: col, position });
    } else {
      setDragCols(null);
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActive(null); setDragCols(null); }}>
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((c) => <Column key={c} status={c} tasks={cols[c]} onOpen={onOpen} />)}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {active ? <Card task={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, onOpen }: { status: TaskStatus; tasks: Task[]; onOpen: (t: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  const qa = useQuickActions();
  const ids = useMemo(() => tasks.map((t) => t.id), [tasks]);
  return (
    <div className={cn("flex min-h-[420px] flex-col rounded-[14px] border border-line bg-bg-subtle/70 transition-colors", isOver && "border-accent/40 bg-accent/[0.03]")}>
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: STATUS_META[status].color }} />
          <span className="text-[13px] font-semibold text-fg">{STATUS_META[status].label}</span>
          <span className="tabular rounded-md bg-surface-3 px-1.5 text-[11px] text-fg-subtle">{tasks.length}</span>
        </div>
        <button onClick={() => qa.open({ kind: "task", defaults: { status } })} className="rounded-md p-1 text-fg-faint hover:bg-surface-3 hover:text-fg" aria-label={`Add task to ${STATUS_META[status].label}`}>
          <Plus className="size-4" />
        </button>
      </div>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 px-2.5 pb-3">
          {tasks.map((t) => <SortableCard key={t.id} task={t} onOpen={onOpen} />)}
          {tasks.length === 0 ? <p className="mt-6 text-center text-xs text-fg-faint">Drop tasks here</p> : null}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={cn(isDragging && "opacity-30")}
    >
      <Card task={task} />
    </div>
  );
}

function Card({ task, overlay }: { task: Task; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "cursor-grab rounded-xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-line-strong active:cursor-grabbing",
        overlay && "rotate-[1.5deg] border-accent/40 shadow-pop",
      )}
    >
      <div className="flex items-start gap-2">
        <p className={cn("flex-1 text-[13.5px] leading-snug text-fg", task.status === "done" && "text-fg-subtle line-through")}>{task.title}</p>
        <PriorityIcon priority={task.priority} />
      </div>
      {task.description ? <p className="mt-1 line-clamp-2 text-xs text-fg-subtle">{task.description}</p> : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {task.project ? <Badge dot={task.project.color}>{task.project.name}</Badge> : null}
        {task.category ? <Badge>{task.category}</Badge> : null}
        <DueLabel due={task.due_date} status={task.status} className="ml-auto" />
      </div>
    </div>
  );
}
