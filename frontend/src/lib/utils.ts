import { clsx, type ClassValue } from "clsx";
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a YYYY-MM-DD date as a local calendar date (no timezone shift). */
export function parseDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDayString(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function relativeDay(s: string | null | undefined) {
  if (!s) return "";
  const d = parseDay(s);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  const diff = differenceInCalendarDays(d, new Date());
  if (diff > 0 && diff < 7) return format(d, "EEEE");
  return format(d, diff > 300 || diff < -300 ? "MMM d, yyyy" : "MMM d");
}

export function isOverdue(due: string | null, status?: string) {
  if (!due || status === "done") return false;
  return differenceInCalendarDays(parseDay(due), new Date()) < 0;
}

export function timeAgo(iso: string) {
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });
}

export function money(value: number, currency = "USD", opts: { compact?: boolean; sign?: boolean } = {}) {
  const fmt = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
    signDisplay: opts.sign ? "exceptZero" : "auto",
  });
  return fmt.format(value);
}

export function pct(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const PROJECT_COLORS = ["#7C5CFF", "#3B82F6", "#06B6D4", "#10B981", "#84CC16", "#F59E0B", "#F97316", "#EF4444", "#EC4899", "#A855F7"];

export function delta(curr: number | null | undefined, prev: number | null | undefined) {
  if (curr == null || prev == null) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return (curr - prev) / Math.abs(prev);
}
