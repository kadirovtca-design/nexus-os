"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";

import { celebrate, celebrateAtCursor } from "@/components/fx/confetti";

import { api, ApiError } from "./api";
import type {
  Activity, Analytics, AssistantStatus, Budget, CalendarEvent, Dashboard, FinanceSummary, Goal, Habit, Insight,
  Milestone, Project, SessionInfo, Task, TaskInput, Transaction, User,
} from "./types";

/* ───────── query keys ───────── */
export const qk = {
  me: ["me"] as const,
  tasks: (params?: object) => ["tasks", params ?? {}] as const,
  taskCategories: ["tasks", "categories"] as const,
  projects: ["projects"] as const,
  project: (id: number) => ["projects", id] as const,
  transactions: (params?: object) => ["finance", "transactions", params ?? {}] as const,
  financeSummary: (month?: string) => ["finance", "summary", month ?? "current"] as const,
  financeCategories: ["finance", "categories"] as const,
  budgets: ["finance", "budgets"] as const,
  goals: ["goals"] as const,
  habits: ["habits"] as const,
  events: (start: string, end: string) => ["events", start, end] as const,
  dashboard: ["dashboard"] as const,
  analytics: (days: number) => ["analytics", days] as const,
  activity: ["activity"] as const,
  sessions: ["sessions"] as const,
  assistantStatus: ["assistant", "status"] as const,
  insights: ["assistant", "insights"] as const,
};

/* Everything that aggregates other data — refreshed after any mutation. */
const DERIVED: QueryKey[] = [["dashboard"], ["analytics"], ["activity"], ["assistant", "insights"]];

export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  opts: {
    invalidate?: QueryKey[];
    success?: string | ((r: TResult, v: TVars) => string | undefined);
    onSuccess?: (r: TResult, v: TVars) => void;
    silentError?: boolean;
  } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => {
      for (const key of [...(opts.invalidate ?? []), ...DERIVED]) qc.invalidateQueries({ queryKey: key });
      const msg = typeof opts.success === "function" ? opts.success(result, vars) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(result, vars);
    },
    onError: (err) => {
      if (!opts.silentError) toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    },
  });
}

/* ───────── auth / account ───────── */
export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: () => api<User>("/auth/me"), retry: false, staleTime: 5 * 60_000 });

export const useSessions = () => useQuery({ queryKey: qk.sessions, queryFn: () => api<SessionInfo[]>("/users/me/sessions") });

/* ───────── tasks ───────── */
export interface TaskFilters {
  q?: string;
  status?: string[];
  priority?: string[];
  category?: string;
  project_id?: number;
  sort?: string;
  order?: "asc" | "desc";
  overdue?: boolean;
}

export const useTasks = (filters: TaskFilters = {}) =>
  useQuery({
    queryKey: qk.tasks(filters),
    queryFn: () => api<Task[]>("/tasks", { query: filters as Record<string, string> }),
    placeholderData: (prev) => prev,
  });

export const useTaskCategories = () => useQuery({ queryKey: qk.taskCategories, queryFn: () => api<string[]>("/tasks/categories") });

const TASK_KEYS: QueryKey[] = [["tasks"], ["projects"], ["events"]];

export const useCreateTask = () =>
  useApiMutation((body: TaskInput) => api<Task>("/tasks", { method: "POST", body }), {
    invalidate: TASK_KEYS,
    success: "Task created",
  });

export function useUpdateTask(opts: { silent?: boolean } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: TaskInput & { id: number }) => api<Task>(`/tasks/${id}`, { method: "PATCH", body }),
    // Optimistic update so checkboxes and kanban moves feel instant.
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshots = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      for (const [key, data] of snapshots) {
        if (!Array.isArray(data)) continue;
        qc.setQueryData<Task[]>(key, data.map((t) => (t.id === id ? { ...t, ...patch } as Task : t)));
      }
      return { snapshots };
    },
    onError: (err, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      toast.error(err instanceof ApiError ? err.message : "Could not update task");
    },
    onSuccess: (task, vars) => {
      if (vars.status === "done") celebrateAtCursor(55);
      if (!opts.silent && vars.status === "done") toast.success(`Completed “${task.title}”`);
    },
    onSettled: () => {
      for (const key of [...TASK_KEYS, ...DERIVED]) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export const useDeleteTask = () =>
  useApiMutation((id: number) => api(`/tasks/${id}`, { method: "DELETE" }), { invalidate: TASK_KEYS, success: "Task deleted" });

/* ───────── projects ───────── */
export const useProjects = (includeArchived = false) =>
  useQuery({
    queryKey: [...qk.projects, { includeArchived }],
    queryFn: () => api<Project[]>("/projects", { query: { include_archived: includeArchived } }),
  });

export const useProject = (id: number) => useQuery({ queryKey: qk.project(id), queryFn: () => api<Project>(`/projects/${id}`) });

export const useSaveProject = () =>
  useApiMutation(
    ({ id, ...body }: Partial<Project> & { id?: number }) =>
      api<Project>(id ? `/projects/${id}` : "/projects", { method: id ? "PATCH" : "POST", body }),
    { invalidate: [["projects"], ["tasks"]], success: (_r, v) => (v.id ? "Project updated" : "Project created") },
  );

export const useDeleteProject = () =>
  useApiMutation(
    ({ id, deleteTasks }: { id: number; deleteTasks: boolean }) =>
      api(`/projects/${id}`, { method: "DELETE", query: { delete_tasks: deleteTasks } }),
    { invalidate: [["projects"], ["tasks"]], success: "Project deleted" },
  );

/* ───────── finance ───────── */
export const useTransactions = (params: { type?: string; category?: string; q?: string; month?: string } = {}) =>
  useQuery({
    queryKey: qk.transactions(params),
    queryFn: () => api<Transaction[]>("/finance/transactions", { query: params }),
    placeholderData: (prev) => prev,
  });

export const useFinanceSummary = (month?: string) =>
  useQuery({
    queryKey: qk.financeSummary(month),
    queryFn: () => api<FinanceSummary>("/finance/summary", { query: { month } }),
    placeholderData: (prev) => prev,
  });

export const useFinanceCategories = () =>
  useQuery({ queryKey: qk.financeCategories, queryFn: () => api<{ income: string[]; expense: string[] }>("/finance/categories") });

export const useBudgets = () => useQuery({ queryKey: qk.budgets, queryFn: () => api<Budget[]>("/finance/budgets") });

export const useSaveTransaction = () =>
  useApiMutation(
    ({ id, ...body }: Partial<Transaction> & { id?: number }) =>
      api<Transaction>(id ? `/finance/transactions/${id}` : "/finance/transactions", { method: id ? "PATCH" : "POST", body }),
    { invalidate: [["finance"]], success: (_r, v) => (v.id ? "Transaction updated" : "Transaction added") },
  );

export const useDeleteTransaction = () =>
  useApiMutation((id: number) => api(`/finance/transactions/${id}`, { method: "DELETE" }), {
    invalidate: [["finance"]],
    success: "Transaction deleted",
  });

export const useSaveBudget = () =>
  useApiMutation((body: { category: string | null; amount: number }) => api<Budget>("/finance/budgets", { method: "PUT", body }), {
    invalidate: [["finance"]],
    success: "Budget saved",
  });

export const useDeleteBudget = () =>
  useApiMutation((id: number) => api(`/finance/budgets/${id}`, { method: "DELETE" }), { invalidate: [["finance"]], success: "Budget removed" });

/* ───────── goals ───────── */
export const useGoals = () => useQuery({ queryKey: qk.goals, queryFn: () => api<Goal[]>("/goals") });

export const useSaveGoal = () =>
  useApiMutation(
    ({ id, ...body }: Partial<Omit<Goal, "milestones">> & { id?: number; milestones?: { title: string }[] }) =>
      api<Goal>(id ? `/goals/${id}` : "/goals", { method: id ? "PATCH" : "POST", body }),
    {
      invalidate: [["goals"]],
      success: (g, v) => (v.id ? (v.status === "completed" ? `Goal achieved 🎉` : "Goal updated") : "Goal created"),
      onSuccess: (g) => g.status === "completed" && celebrate(undefined, 160),
    },
  );

export const useDeleteGoal = () =>
  useApiMutation((id: number) => api(`/goals/${id}`, { method: "DELETE" }), { invalidate: [["goals"]], success: "Goal deleted" });

export const useAddMilestone = () =>
  useApiMutation(({ goalId, title }: { goalId: number; title: string }) =>
    api<Milestone>(`/goals/${goalId}/milestones`, { method: "POST", body: { title } }), { invalidate: [["goals"]] });

export const useUpdateMilestone = () =>
  useApiMutation(
    ({ goalId, id, ...body }: { goalId: number; id: number; done?: boolean; title?: string }) =>
      api<Milestone>(`/goals/${goalId}/milestones/${id}`, { method: "PATCH", body }),
    { invalidate: [["goals"]], onSuccess: (m) => m.done && celebrateAtCursor(40) },
  );

export const useDeleteMilestone = () =>
  useApiMutation(({ goalId, id }: { goalId: number; id: number }) =>
    api(`/goals/${goalId}/milestones/${id}`, { method: "DELETE" }), { invalidate: [["goals"]] });

/* ───────── habits ───────── */
export const useHabits = (includeArchived = false) =>
  useQuery({
    queryKey: [...qk.habits, { includeArchived }],
    queryFn: () => api<Habit[]>("/habits", { query: { include_archived: includeArchived } }),
  });

export const useSaveHabit = () =>
  useApiMutation(
    ({ id, ...body }: Partial<Habit> & { id?: number }) =>
      api<Habit>(id ? `/habits/${id}` : "/habits", { method: id ? "PATCH" : "POST", body }),
    { invalidate: [["habits"]], success: (_r, v) => (v.id ? "Habit updated" : "Habit created") },
  );

export const useDeleteHabit = () =>
  useApiMutation((id: number) => api(`/habits/${id}`, { method: "DELETE" }), { invalidate: [["habits"]], success: "Habit deleted" });

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date, done }: { id: number; date: string; done: boolean }) =>
      api<Habit>(`/habits/${id}/check-in`, { method: "POST", body: { date, done } }),
    onMutate: async ({ id, date, done }) => {
      await qc.cancelQueries({ queryKey: ["habits"] });
      const snaps = qc.getQueriesData<Habit[]>({ queryKey: ["habits"] });
      const today = new Date().toLocaleDateString("en-CA");
      for (const [key, data] of snaps) {
        if (!Array.isArray(data)) continue;
        qc.setQueryData<Habit[]>(key, data.map((h) => {
          if (h.id !== id) return h;
          const recent = done ? Array.from(new Set([...h.recent, date])).sort() : h.recent.filter((d) => d !== date);
          return { ...h, recent, completed_today: date === today ? done : h.completed_today };
        }));
      }
      return { snaps };
    },
    onError: (err, _v, ctx) => {
      ctx?.snaps.forEach(([k, d]) => qc.setQueryData(k, d));
      toast.error(err instanceof ApiError ? err.message : "Could not save check-in");
    },
    onSuccess: (_h, vars) => {
      if (vars.done) celebrateAtCursor(35);
    },
    onSettled: () => {
      for (const key of [["habits"], ...DERIVED]) qc.invalidateQueries({ queryKey: key });
    },
  });
}

/* ───────── calendar ───────── */
export const useEvents = (start: string, end: string) =>
  useQuery({
    queryKey: qk.events(start, end),
    queryFn: () => api<CalendarEvent[]>("/events", { query: { start, end } }),
    placeholderData: (prev) => prev,
  });

export const useSaveEvent = () =>
  useApiMutation(
    ({ id, ...body }: Partial<CalendarEvent> & { id?: number }) =>
      api<CalendarEvent>(id ? `/events/${id}` : "/events", { method: id ? "PATCH" : "POST", body }),
    { invalidate: [["events"]], success: (_r, v) => (v.id ? "Event updated" : "Event created") },
  );

export const useDeleteEvent = () =>
  useApiMutation((id: number) => api(`/events/${id}`, { method: "DELETE" }), { invalidate: [["events"]], success: "Event deleted" });

/* ───────── aggregates ───────── */
export const useDashboard = () => useQuery({ queryKey: qk.dashboard, queryFn: () => api<Dashboard>("/dashboard") });
export const useAnalytics = (days: number) =>
  useQuery({ queryKey: qk.analytics(days), queryFn: () => api<Analytics>("/analytics", { query: { days } }), placeholderData: (p) => p });
export const useActivity = (limit = 30) =>
  useQuery({ queryKey: [...qk.activity, limit], queryFn: () => api<Activity[]>("/activity", { query: { limit } }) });

/* ───────── assistant ───────── */
export const useAssistantStatus = () =>
  useQuery({ queryKey: qk.assistantStatus, queryFn: () => api<AssistantStatus>("/assistant/status"), staleTime: 60_000 });
export const useInsights = () =>
  useQuery({ queryKey: qk.insights, queryFn: () => api<{ source: string; items: Insight[] }>("/assistant/insights") });
