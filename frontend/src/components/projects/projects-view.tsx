"use client";

import { differenceInCalendarDays } from "date-fns";
import { motion } from "framer-motion";
import { Archive, CalendarClock, FolderKanban, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProjectFormModal } from "@/components/forms/project-form";
import { PageHeader } from "@/components/layout/page-header";
import { useQuickActions } from "@/components/layout/quick-actions";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Badge, EmptyState, Progress, Segmented, Skeleton } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/modal";
import { useDeleteProject, useProjects, useSaveProject } from "@/lib/queries";
import type { Project } from "@/lib/types";
import { parseDay } from "@/lib/utils";

export const PROJECT_STATUS: Record<Project["status"], { label: string; tone: "accent" | "warning" | "success" | "neutral" }> = {
  active: { label: "Active", tone: "accent" },
  on_hold: { label: "On hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};

export function deadlineText(deadline: string | null, status: Project["status"]) {
  if (!deadline) return { text: "No deadline", tone: "text-fg-subtle" };
  const d = differenceInCalendarDays(parseDay(deadline), new Date());
  if (status === "completed") return { text: "Delivered", tone: "text-success" };
  if (d < 0) return { text: `${-d}d overdue`, tone: "text-danger" };
  if (d === 0) return { text: "Due today", tone: "text-warning" };
  return { text: `${d} day${d === 1 ? "" : "s"} left`, tone: d <= 7 ? "text-warning" : "text-fg-subtle" };
}

export function useProjectActions() {
  const confirm = useConfirm();
  const del = useDeleteProject();
  const save = useSaveProject();
  return {
    remove: async (p: Project) => {
      const r = await confirm({
        title: `Delete “${p.name}”?`,
        description: "This cannot be undone. Tasks are kept and moved to “No project” unless you choose otherwise.",
        tone: "danger",
        confirmLabel: "Delete project",
        checkbox: p.task_count ? `Also delete its ${p.task_count} task${p.task_count > 1 ? "s" : ""}` : undefined,
      });
      if (r) await del.mutateAsync({ id: p.id, deleteTasks: r.checked });
      return !!r;
    },
    archive: (p: Project) => save.mutate({ id: p.id, status: p.status === "archived" ? "active" : "archived" }),
  };
}

export function ProjectsView() {
  const [filter, setFilter] = useState<"active" | "all">("active");
  const projects = useProjects(filter === "all");
  const qa = useQuickActions();
  const [editing, setEditing] = useState<Project | null>(null);
  const actions = useProjectActions();
  const list = (projects.data ?? []).filter((p) => filter === "all" || p.status !== "completed");

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group related work and watch it move."
        actions={
          <>
            <Segmented value={filter} onChange={setFilter} options={[{ value: "active", label: "In flight" }, { value: "all", label: "All" }]} />
            <Button variant="primary" onClick={() => qa.open({ kind: "project" })}>
              <Plus /> New project
            </Button>
          </>
        }
      />
      {projects.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[196px] rounded-[14px]" />)}</div>
      ) : list.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line-strong">
          <EmptyState icon={<FolderKanban />} title="No projects yet" description="Projects bundle tasks, deadlines and progress in one place." action={<Button variant="primary" onClick={() => qa.open({ kind: "project" })}><Plus /> Create project</Button>} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => {
            const dl = deadlineText(p.deadline, p.status);
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group relative block overflow-hidden rounded-[14px] border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full opacity-[0.12] blur-2xl transition-opacity group-hover:opacity-25" style={{ background: p.color }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-semibold text-white" style={{ background: p.color }}>
                        {p.name[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-semibold text-fg">{p.name}</p>
                        <Badge tone={PROJECT_STATUS[p.status].tone} className="mt-0.5">{PROJECT_STATUS[p.status].label}</Badge>
                      </div>
                    </div>
                    <div onClick={(e) => e.preventDefault()}>
                      <Menu
                        trigger={<Button variant="ghost" size="icon-sm" aria-label="Project actions"><MoreHorizontal /></Button>}
                        items={[
                          { label: "Edit", icon: <Pencil />, onSelect: () => setEditing(p) },
                          { label: p.status === "archived" ? "Unarchive" : "Archive", icon: <Archive />, onSelect: () => actions.archive(p) },
                          { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => actions.remove(p) },
                        ]}
                      />
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[38px] text-[13px] leading-relaxed text-fg-subtle">{p.description || "No description"}</p>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-fg-subtle">{p.completed_count}/{p.task_count} tasks</span>
                      <span className="tabular font-semibold text-fg">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} color={p.color} height={5} />
                  </div>
                  <p className={`mt-3.5 flex items-center gap-1.5 text-xs ${dl.tone}`}>
                    <CalendarClock className="size-3.5" /> {dl.text}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
      <ProjectFormModal open={!!editing} onClose={() => setEditing(null)} project={editing} />
    </>
  );
}
