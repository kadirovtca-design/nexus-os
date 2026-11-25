"use client";

import { format } from "date-fns";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleDashed, ListTodo, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ProjectFormModal } from "@/components/forms/project-form";
import { TaskFormModal } from "@/components/forms/task-form";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge, EmptyState, ProgressRing, Segmented, Skeleton, Stat } from "@/components/ui/misc";
import { useCreateTask, useProject, useTasks } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { parseDay } from "@/lib/utils";

import { deadlineText, PROJECT_STATUS, useProjectActions } from "./projects-view";

export function ProjectDetail({ id }: { id: number }) {
  const router = useRouter();
  const project = useProject(id);
  const [show, setShow] = useState<"open" | "all">("open");
  const tasks = useTasks({ project_id: id, sort: "due_date", status: show === "open" ? ["todo", "in_progress"] : undefined });
  const create = useCreateTask();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const actions = useProjectActions();

  if (project.isError) {
    return <EmptyState icon={<ListTodo />} title="Project not found" action={<Link href="/projects"><Button>Back to projects</Button></Link>} />;
  }
  if (!project.data) return <Skeleton className="h-64 rounded-[14px]" />;
  const p = project.data;
  const dl = deadlineText(p.deadline, p.status);

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await create.mutateAsync({ title: title.trim(), project_id: id });
    setTitle("");
  }

  return (
    <>
      <Link href="/projects" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-subtle hover:text-fg">
        <ArrowLeft className="size-3.5" /> Projects
      </Link>
      <Card className="relative mb-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1" style={{ background: p.color }} />
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full opacity-10 blur-3xl" style={{ background: p.color }} />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center">
          <ProgressRing value={p.progress} size={104} stroke={9} color={p.color}>
            <span className="tabular text-2xl font-semibold text-fg">{p.progress}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{p.name}</h1>
              <Badge tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Badge>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-fg-subtle">{p.description || "No description yet."}</p>
            <div className="mt-4 grid max-w-xl grid-cols-3 gap-4">
              <Stat label="Tasks" value={p.task_count} />
              <Stat label="Completed" value={p.completed_count} />
              <Stat label="Deadline" value={p.deadline ? format(parseDay(p.deadline), "MMM d") : "—"} sub={<span className={dl.tone}>{dl.text}</span>} />
            </div>
          </div>
          <div className="flex gap-2 md:self-start">
            <Button size="sm" onClick={() => setEditing(true)}><Pencil /> Edit</Button>
            <Button size="sm" variant="danger" onClick={async () => (await actions.remove(p)) && router.push("/projects")}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </Card>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg"><CalendarClock className="size-4 text-fg-subtle" /> Tasks</h2>
        <Segmented size="sm" value={show} onChange={setShow} options={[{ value: "open", label: "Open", icon: <CircleDashed /> }, { value: "all", label: "All", icon: <CheckCircle2 /> }]} />
      </div>
      <form onSubmit={quickAdd} className="mb-3 flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Add a task to ${p.name}…`} icon={<Plus />} maxLength={200} />
        <Button type="submit" variant="primary" loading={create.isPending} disabled={!title.trim()}>Add</Button>
      </form>
      {tasks.isLoading ? (
        <Skeleton className="h-40 rounded-[14px]" />
      ) : tasks.data?.length ? (
        <TaskList tasks={tasks.data} onOpen={setEditingTask} groupBy={show === "all" ? "status" : "none"} />
      ) : (
        <div className="rounded-[14px] border border-dashed border-line-strong">
          <EmptyState icon={<ListTodo />} title={show === "open" ? "No open tasks" : "No tasks yet"} description="Use the field above to add the first one." />
        </div>
      )}
      <ProjectFormModal open={editing} onClose={() => setEditing(false)} project={p} />
      <TaskFormModal open={!!editingTask} onClose={() => setEditingTask(null)} task={editingTask} />
    </>
  );
}
