"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Menu as MenuIcon, Plus, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { LogoMark } from "@/components/brand/logo";
import { Aurora, SpotlightTracker } from "@/components/fx/fx";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/api";
import { qk, useMe } from "@/lib/queries";
import { applyTheme } from "@/lib/theme";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { ALL_NAV } from "./nav";
import { QuickActionsProvider, useQuickActions } from "./quick-actions";
import { MobileDrawer, Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onUnauthorized = () => router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    window.addEventListener("nexus:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nexus:unauthorized", onUnauthorized);
  }, [router, pathname]);

  useEffect(() => {
    if (me.isError) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [me.isError, router, pathname]);

  useEffect(() => {
    if (me.data) applyTheme(me.data.preferences.theme, me.data.preferences.accent);
  }, [me.data]);

  if (!me.data) return <ShellSkeleton />;
  return (
    <QuickActionsProvider>
      <Shell user={me.data}>{children}</Shell>
    </QuickActionsProvider>
  );
}

function Shell({ user, children }: { user: User; children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const qa = useQuickActions();
  const [collapsed, setCollapsed] = useState(user.preferences.compact_sidebar);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pendingG = useRef<number | null>(null);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      qc.clear();
      router.replace("/login");
    }
  }, [qc, router]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    api<User>("/users/me/preferences", { method: "PATCH", body: { compact_sidebar: next } })
      .then((u) => qc.setQueryData(qk.me, u))
      .catch(() => {});
  };

  const toggleTheme = useCallback(() => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next, user.preferences.accent);
    api<User>("/users/me/preferences", { method: "PATCH", body: { theme: next } })
      .then((u) => qc.setQueryData(qk.me, u))
      .catch(() => toast.error("Could not save theme"));
  }, [qc, user.preferences.accent]);

  // Global keyboard shortcuts: ⌘K palette, C new task, G+<key> navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        qa.setPalette(!qa.palette);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (pendingG.current) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const nav = ALL_NAV.find((n) => n.shortcut?.toLowerCase() === `g ${k}`);
        if (nav) {
          e.preventDefault();
          router.push(nav.href);
        }
        return;
      }
      if (k === "g") pendingG.current = window.setTimeout(() => (pendingG.current = null), 900);
      else if (k === "c") {
        e.preventDefault();
        qa.open({ kind: "task" });
      } else if (k === "/") {
        e.preventDefault();
        qa.setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qa, router]);

  return (
    <div className="canvas-glow min-h-dvh">
      <Aurora />
      <SpotlightTracker />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-line bg-bg-subtle/80 backdrop-blur-xl transition-[width] duration-300 ease-out lg:block",
          collapsed ? "w-[64px]" : "w-[244px]",
        )}
      >
        <Sidebar user={user} collapsed={collapsed} onToggle={toggleCollapsed} onLogout={logout} />
      </aside>
      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Sidebar user={user} collapsed={false} mobile onLogout={logout} onNavigate={() => setMobileOpen(false)} />
      </MobileDrawer>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </Button>
        <LogoMark className="size-7" />
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => qa.setPalette(true)} aria-label="Search">
          <Search />
        </Button>
        <Button variant="primary" size="icon" onClick={() => qa.open({ kind: "task" })} aria-label="New task">
          <Plus />
        </Button>
      </header>

      <main className={cn("relative z-[2] transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[64px]" : "lg:pl-[244px]")}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</div>
      </main>

      <CommandPalette onLogout={logout} onToggleTheme={toggleTheme} theme={user.preferences.theme} />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="canvas-glow min-h-dvh">
      <aside className="fixed inset-y-0 left-0 hidden w-[244px] border-r border-line bg-bg-subtle/80 p-3 lg:block">
        <Skeleton className="mb-6 h-8 w-28" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-7 w-full" />
        ))}
      </aside>
      <main className="lg:pl-[244px]">
        <div className="mx-auto max-w-[1400px] px-4 py-9 sm:px-6 lg:px-10">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-3 h-4 w-40" />
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
