import {
  BarChart3, CalendarDays, CheckSquare, FolderKanban, LayoutDashboard, Settings, Sparkles, Target, Wallet, Flame,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
}

export const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, shortcut: "G D" },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, shortcut: "G T" },
  { href: "/projects", label: "Projects", icon: FolderKanban, shortcut: "G P" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, shortcut: "G C" },
];

export const NAV_LIFE: NavItem[] = [
  { href: "/finance", label: "Finance", icon: Wallet, shortcut: "G F" },
  { href: "/goals", label: "Goals", icon: Target, shortcut: "G G" },
  { href: "/habits", label: "Habits", icon: Flame, shortcut: "G H" },
];

export const NAV_INSIGHT: NavItem[] = [
  { href: "/analytics", label: "Analytics", icon: BarChart3, shortcut: "G A" },
  { href: "/assistant", label: "Assistant", icon: Sparkles, shortcut: "G I" },
];

export const NAV_SETTINGS: NavItem = { href: "/settings", label: "Settings", icon: Settings, shortcut: "G S" };

export const ALL_NAV = [...NAV_MAIN, ...NAV_LIFE, ...NAV_INSIGHT, NAV_SETTINGS];
