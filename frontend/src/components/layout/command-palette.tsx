"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft, ArrowUpRight, CalendarPlus, CheckSquare, CornerDownLeft, FolderPlus, Flame, LogOut, Moon, Search,
  Sun, Target,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Kbd } from "@/components/ui/misc";
import { useProjects, useTasks } from "@/lib/queries";
import { cn, relativeDay } from "@/lib/utils";

import { ALL_NAV } from "./nav";
import { useQuickActions } from "./quick-actions";

interface Cmd {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
  keywords?: string;
}

interface PaletteProps {
  onLogout: () => void;
  onToggleTheme: () => void;
  theme: string;
}

export function CommandPalette(props: PaletteProps) {
  const { palette } = useQuickActions();
  return <AnimatePresence>{palette ? <PaletteDialog {...props} /> : null}</AnimatePresence>;
}

function PaletteDialog({ onLogout, onToggleTheme, theme }: PaletteProps) {
  const { setPalette, open } = useQuickActions();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = q.trim();
  const tasks = useTasks(search.length >= 2 ? { q: search, sort: "updated_at", order: "desc" } : { sort: "updated_at", order: "desc", status: ["todo", "in_progress"] });
  const projects = useProjects();


  const close = () => setPalette(false);
  const go = (href: string) => () => {
    router.push(href);
    close();
  };
  const act = (fn: () => void) => () => {
    close();
    setTimeout(fn, 60);
  };

  const commands = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      { id: "new-task", group: "Create", label: "New task", icon: <CheckSquare />, run: act(() => open({ kind: "task" })), hint: "C" },
      { id: "new-event", group: "Create", label: "New event", icon: <CalendarPlus />, run: act(() => open({ kind: "event" })) },
      { id: "new-expense", group: "Create", label: "Add expense", icon: <ArrowUpRight />, run: act(() => open({ kind: "transaction", type: "expense" })) },
      { id: "new-income", group: "Create", label: "Add income", icon: <ArrowDownLeft />, run: act(() => open({ kind: "transaction", type: "income" })) },
      { id: "new-project", group: "Create", label: "New project", icon: <FolderPlus />, run: act(() => open({ kind: "project" })) },
      { id: "new-goal", group: "Create", label: "New goal", icon: <Target />, run: act(() => open({ kind: "goal" })) },
      { id: "new-habit", group: "Create", label: "New habit", icon: <Flame />, run: act(() => open({ kind: "habit" })) },
      ...ALL_NAV.map((n) => ({ id: `nav-${n.href}`, group: "Navigate", label: n.label, icon: <n.icon />, run: go(n.href), hint: n.shortcut })),
      { id: "theme", group: "Preferences", label: theme === "light" ? "Switch to dark theme" : "Switch to light theme", icon: theme === "light" ? <Moon /> : <Sun />, run: act(onToggleTheme) },
      { id: "logout", group: "Account", label: "Sign out", icon: <LogOut />, run: act(onLogout) },
    ];
    const s = search.toLowerCase();
    const filtered = s ? base.filter((c) => `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(s)) : base;
    const taskCmds: Cmd[] = (tasks.data ?? []).slice(0, s ? 8 : 5).map((t) => ({
      id: `task-${t.id}`,
      group: s ? "Tasks" : "Recent tasks",
      label: t.title,
      hint: t.due_date ? relativeDay(t.due_date) : undefined,
      icon: <CheckSquare />,
      run: go(`/tasks?open=${t.id}`),
    }));
    const projCmds: Cmd[] = s
      ? (projects.data ?? []).filter((p) => p.name.toLowerCase().includes(s)).slice(0, 5).map((p) => ({
          id: `proj-${p.id}`,
          group: "Projects",
          label: p.name,
          hint: `${p.progress}%`,
          icon: <span className="size-2.5 rounded-full" style={{ background: p.color }} />,
          run: go(`/projects/${p.id}`),
        }))
      : [];
    return [...filtered, ...projCmds, ...taskCmds];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tasks.data, projects.data, theme]);

  useEffect(() => {
    list.current?.querySelector(`[data-idx="${idx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [idx]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(commands.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[idx]?.run();
    } else if (e.key === "Escape") close();
  }

  const groups: [string, (Cmd & { i: number })[]][] = [];
  commands.forEach((c, i) => {
    const g = groups.find(([name]) => name === c.group);
    if (g) g[1].push({ ...c, i });
    else groups.push([c.group, [{ ...c, i }]]);
  });

  return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.div
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop"
            onKeyDown={onKey}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 text-fg-subtle" />
              <input
                ref={input}
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                placeholder="Search tasks, projects, or type a command…"
                className="h-13 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-fg-faint"
              />
              <Kbd>Esc</Kbd>
            </div>
            <div ref={list} className="max-h-[52vh] overflow-y-auto p-2">
              {commands.length === 0 ? (
                <p className="px-3 py-10 text-center text-sm text-fg-subtle">No results for “{q}”</p>
              ) : (
                groups.map(([name, items]) => (
                  <div key={name} className="mb-1">
                    <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-fg-faint">{name}</p>
                    {items.map((c) => (
                      <button
                        key={c.id}
                        data-idx={c.i}
                        onMouseMove={() => setIdx(c.i)}
                        onClick={c.run}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors [&_svg]:size-4",
                          idx === c.i ? "bg-surface-3 text-fg" : "text-fg-muted",
                        )}
                      >
                        <span className={cn("grid size-4 place-items-center", idx === c.i ? "text-accent-2" : "text-fg-subtle")}>{c.icon}</span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.hint ? <span className="text-[11px] text-fg-faint">{c.hint}</span> : null}
                        {idx === c.i ? <CornerDownLeft className="!size-3.5 text-fg-subtle" /> : null}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center gap-4 border-t border-line bg-bg-subtle/60 px-4 py-2 text-[11px] text-fg-faint">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> select</span>
              <span className="ml-auto">NEXUS OS</span>
            </div>
          </motion.div>
        </div>
  );
}
