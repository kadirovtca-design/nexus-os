export type Theme = "dark" | "light" | "system";
export type Accent = "violet" | "blue" | "emerald" | "amber" | "rose" | "cyan";

export interface Preferences {
  theme: Theme;
  accent: Accent;
  currency: string;
  timezone: string;
  week_starts_on: 0 | 1;
  compact_sidebar: boolean;
}

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
  preferences: Preferences;
}

export interface SessionInfo {
  id: number;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  current: boolean;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category: string | null;
  due_date: string | null;
  project_id: number | null;
  project: { id: number; name: string; color: string } | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export type TaskInput = Partial<Pick<Task, "title" | "description" | "status" | "priority" | "category" | "due_date" | "project_id" | "position">>;

export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export interface Project {
  id: number;
  name: string;
  description: string | null;
  color: string;
  status: ProjectStatus;
  deadline: string | null;
  task_count: number;
  completed_count: number;
  progress: number;
  created_at: string;
  updated_at: string;
}

export type TxType = "income" | "expense";
export interface Transaction {
  id: number;
  type: TxType;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  created_at: string;
}

export interface Budget {
  id: number;
  category: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
}

export interface FinanceSummary {
  month: string;
  balance: number;
  income: number;
  expense: number;
  net: number;
  savings_rate: number | null;
  prev_income: number;
  prev_expense: number;
  budget: Budget | null;
  expense_by_category: { category: string; total: number }[];
  income_by_category: { category: string; total: number }[];
  daily_spend: { date: string; amount: number; cumulative: number }[];
  trend: { month: string; income: number; expense: number; net: number }[];
}

export interface Milestone {
  id: number;
  title: string;
  done: boolean;
  due_date: string | null;
  position: number;
  completed_at: string | null;
}

export type GoalStatus = "active" | "completed" | "archived";
export interface Goal {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  deadline: string | null;
  status: GoalStatus;
  manual_progress: number;
  progress: number;
  completed_at: string | null;
  milestones: Milestone[];
  created_at: string;
}

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  target_per_week: number;
  archived: boolean;
  current_streak: number;
  best_streak: number;
  total_completions: number;
  completion_rate_30d: number;
  completed_today: boolean;
  recent: string[];
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  color: string;
  task_id: number | null;
  task: { id: number; title: string; status: TaskStatus } | null;
}

export interface Activity {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  message: string;
  created_at: string;
}

export interface DayStat {
  date: string;
  completed: number;
  created: number;
  missed: number;
  habits_done: number;
  habits_active: number;
  score: number | null;
}

export interface Dashboard {
  greeting: string;
  name: string;
  date: string;
  timezone: string;
  productivity: {
    score: number | null;
    previous: number | null;
    completed_today: number;
    due_today_open: number;
    overdue: number;
    open_total: number;
    in_progress: number;
  };
  habits: { done: number; active: number };
  week: DayStat[];
  focus_tasks: Task[];
  upcoming_events: CalendarEvent[];
  goals: { items: Goal[]; active: number; completed: number; avg_progress: number | null };
  finance: { month: string; income: number; expense: number; net: number; balance: number; budget: Budget | null };
  recent_activity: Activity[];
}

export interface Analytics {
  range: { start: string; end: string; days: number };
  productivity: {
    series: DayStat[];
    avg_score: number | null;
    prev_avg_score: number | null;
    best_day: string | null;
    completed: number;
    created: number;
    prev_completed: number;
  };
  tasks: {
    due_in_range: number;
    on_time: number;
    late: number;
    on_time_rate: number | null;
    completion_rate: number | null;
    status: Partial<Record<TaskStatus, number>>;
    open_by_priority: Partial<Record<TaskPriority, number>>;
    total: number;
  };
  weekday: { day: string; tasks: number; habits: number }[];
  habits: {
    items: { id: number; name: string; color: string; done: number; expected: number; rate: number }[];
    heatmap: { date: string; value: number | null }[];
    avg_rate: number | null;
  };
  goals: {
    active: number;
    completed: number;
    completion_rate: number | null;
    by_category: { category: string; active: number; completed: number }[];
  };
  finance: {
    income: number;
    expense: number;
    net: number;
    transactions: number;
    top_expenses: { category: string; total: number }[];
    trend: { month: string; income: number; expense: number; net: number }[];
  };
  monthly: {
    month: string;
    tasks_completed: number;
    tasks_created: number;
    habit_checkins: number;
    avg_score: number | null;
    income: number;
    expense: number;
  }[];
}

export interface AssistantStatus {
  configured: boolean;
  provider: string;
  model: string | null;
  setup: { env_var: string; steps: string[] } | null;
}

export interface Insight {
  kind: "warning" | "focus" | "habit" | "calendar" | "goal" | "finance" | "trend" | "info";
  title: string;
  body: string;
}
