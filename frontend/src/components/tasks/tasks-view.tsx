"use client";

import { ArrowDownWideNarrow, ArrowUpNarrowWide, CheckSquare, Columns3, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { TaskFormModal } from "@/components/forms/task-form";
import { PageHeader } from "@/components/layout/page-header";
import { useQuickActions } from "@/components/layout/quick-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { EmptyState, Segmented, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { useProjects, useTaskCategories, useTasks, type TaskFilters } from "@/lib/queries";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

import { TaskBoard } from "./task-board";
import { TaskList } from "./task-list";

type View = "list" | "board";
const VIEW_KEY = "nexus:tasks-view";

export function TasksView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const qa = useQuickActions();
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
    } catch {
      return "list";
    }
  });
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "done">("open");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [project, setProject] = useState(params.get("project") ?? "");
  const [sort, setSort] = useState("due_date");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [editing, setEditing] = useState<Task | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 220);
    return () => clearTimeout(t);
  }, [q]);

  // Deep link: /tasks?open=<id>
  const openId = params.get("open");
  useEffect(() => {
    if (!openId) return;
    api<Task>(`/tasks/${openId}`).then(setEditing).catch(() => {});
    router.replace(pathname);
  }, [openId, pathname, router]);

  const filters: TaskFilters = useMemo(() => {
    const f: TaskFilters = { sort: view === "board" ? "position" : sort, order: view === "board" ? "asc" : order };
    if (debounced) f.q = debounced;
    if (view === "list" && statusFilter === "open") f.status = ["todo", "in_progress"];
    if (view === "list" && statusFilter === "done") f.status = ["done"];
    if (priority) f.priority = [priority];
    if (category) f.category = category;
    if (project) f.project_id = Number(project);
    return f;
  }, [debounced, statusFilter, priority, category, project, sort, order, view]);

  const tasks = useTasks(filters);
  const projects = useProjects();
  const cats = useTaskCategories();
  const activeFilters = [priority, category, project, debounced].filter(Boolean).length;

  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description={tasks.data ? `${tasks.data.length} ${statusFilter === "done" && view === "list" ? "completed" : "tasks"} in view` : "Loading…"}
        actions={
          <>
            <Segmented
              value={view}
              onChange={changeView}
              options={[
                { value: "list", label: "List", icon: <List /> },
                { value: "board", label: "Board", icon: <Columns3 /> },
              ]}
            />
            <Button variant="primary" onClick={() => qa.open({ kind: "task", defaults: project ? { project_id: Number(project) } : undefined })}>
              <Plus /> New task
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="lg:w-72">
          <Input icon={<Search />} placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "list" ? (
            <Segmented
              size="sm"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "open", label: "Open" },
                { value: "done", label: "Completed" },
                { value: "all", label: "All" },
              ]}
            />
          ) : null}
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-8 w-[130px] text-[13px]" aria-label="Priority">
            <option value="">Any priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
          <Select value={project} onChange={(e) => setProject(e.target.value)} className="h-8 w-[150px] text-[13px]" aria-label="Project">
            <option value="">All projects</option>
            {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 w-[140px] text-[13px]" aria-label="Category">
            <option value="">All categories</option>
            {cats.data?.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          {view === "list" ? (
            <div className="flex items-center gap-1">
              <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 w-[140px] text-[13px]" aria-label="Sort by">
                <option value="due_date">Due date</option>
                <option value="priority">Priority</option>
                <option value="created_at">Created</option>
                <option value="updated_at">Updated</option>
                <option value="title">Title</option>
              </Select>
              <Button variant="ghost" size="icon-sm" onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))} aria-label="Toggle sort order" title={order === "asc" ? "Ascending" : "Descending"}>
                {order === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
              </Button>
            </div>
          ) : null}
          {activeFilters ? (
            <Button variant="ghost" size="sm" onClick={() => { setPriority(""); setCategory(""); setProject(""); setQ(""); }}>
              <X /> Clear {activeFilters}
            </Button>
          ) : null}
        </div>
      </div>

      {tasks.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : !tasks.data?.length ? (
        <div className="rounded-[14px] border border-dashed border-line-strong">
          {activeFilters || statusFilter !== "open" ? (
            <EmptyState icon={<SlidersHorizontal />} title="No tasks match" description="Try different filters or clear the search." />
          ) : (
            <EmptyState
              icon={<CheckSquare />}
              title="You're all caught up"
              description="Capture what's on your mind — press C anywhere to add a task."
              action={<Button variant="primary" onClick={() => qa.open({ kind: "task" })}><Plus /> New task</Button>}
            />
          )}
        </div>
      ) : (
        <div className={cn("transition-opacity", tasks.isFetching && !tasks.isLoading && "opacity-80")}>
          {view === "board" ? (
            <TaskBoard tasks={tasks.data} onOpen={setEditing} />
          ) : (
            <TaskList tasks={tasks.data} onOpen={setEditing} groupBy={statusFilter === "all" ? "status" : "none"} />
          )}
        </div>
      )}

      <TaskFormModal open={!!editing} onClose={() => setEditing(null)} task={editing} />
    </>
  );
}
