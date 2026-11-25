"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus, Search, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Kbd } from "@/components/ui/misc";
import { Menu } from "@/components/ui/menu";
import type { User } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

import { NAV_INSIGHT, NAV_LIFE, NAV_MAIN, NAV_SETTINGS, type NavItem } from "./nav";
import { useQuickActions } from "./quick-actions";

export function Sidebar({
  user,
  collapsed,
  onToggle,
  onLogout,
  onNavigate,
  mobile,
}: {
  user: User;
  collapsed: boolean;
  onToggle?: () => void;
  onLogout: () => void;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const qa = useQuickActions();
  const c = collapsed && !mobile;
  const navProps = { pathname, collapsed: c, mobile: !!mobile, onNavigate };

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center px-3.5", c ? "justify-center" : "justify-between")}>
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo collapsed={c} />
        </Link>
        {!c && onToggle ? (
          <button onClick={onToggle} className="rounded-md p-1 text-fg-faint hover:bg-surface-2 hover:text-fg-muted" aria-label="Collapse sidebar">
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <div className={cn("space-y-1.5 px-2.5 pt-1", c && "px-2")}>
        <button
          onClick={() => qa.setPalette(true)}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-bg-subtle px-2.5 text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted",
            c && "justify-center px-0",
          )}
          aria-label="Search and commands"
        >
          <Search className="size-3.5" />
          {!c ? (
            <>
              <span className="flex-1 text-left">Search…</span>
              <Kbd>⌘K</Kbd>
            </>
          ) : null}
        </button>
        <button
          onClick={() => {
            qa.open({ kind: "task" });
            onNavigate?.();
          }}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg bg-accent/12 px-2.5 text-[13px] font-medium text-accent-2 transition-colors hover:bg-accent/20",
            c && "justify-center px-0",
          )}
        >
          <Plus className="size-4" />
          {!c ? <span>New task</span> : null}
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto px-2.5 pb-4", c && "px-2")}>
        <NavSection label="Workspace" items={NAV_MAIN} {...navProps} />
        <NavSection label="Life" items={NAV_LIFE} {...navProps} />
        <NavSection label="Insight" items={NAV_INSIGHT} {...navProps} />
      </nav>

      <div className={cn("space-y-1 border-t border-line p-2.5", c && "p-2")}>
        <NavLink item={NAV_SETTINGS} {...navProps} />
        {c && onToggle ? (
          <button onClick={onToggle} className="flex h-8 w-full items-center justify-center rounded-lg text-fg-faint hover:bg-surface-2 hover:text-fg-muted" aria-label="Expand sidebar">
            <PanelLeftOpen className="size-4" />
          </button>
        ) : null}
        <Menu
          align="start"
          side="top"
          trigger={
            <button className={cn("flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-surface-2", c && "justify-center")}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/80 to-accent-2/80 text-[11px] font-semibold text-white">
                {initials(user.name)}
              </span>
              {!c ? (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-fg">{user.name}</span>
                  <span className="block truncate text-[11.5px] text-fg-subtle">{user.email}</span>
                </span>
              ) : null}
            </button>
          }
          items={[
            { label: "Profile & account", icon: <UserIcon />, onSelect: () => {
              router.push("/settings?tab=account");
              onNavigate?.();
            } },
            { label: "Sign out", icon: <LogOut />, onSelect: onLogout, danger: true },
          ]}
        />
      </div>
    </div>
  );
}

interface NavProps {
  pathname: string;
  collapsed: boolean;
  mobile: boolean;
  onNavigate?: () => void;
}

function NavLink({ item, pathname, collapsed: c, mobile, onNavigate }: NavProps & { item: NavItem }) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={c ? item.label : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors",
        active ? "text-fg" : "text-fg-subtle hover:bg-surface-2/70 hover:text-fg-muted",
        c && "justify-center px-0",
      )}
    >
      {active ? (
        <motion.span
          layoutId={mobile ? "nav-active-m" : "nav-active"}
          className="absolute inset-0 rounded-lg border border-line-strong bg-surface-2"
          transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
        />
      ) : null}
      <item.icon className={cn("relative size-[17px] shrink-0", active && "text-accent-2")} strokeWidth={active ? 2.2 : 1.9} />
      {!c ? <span className="relative truncate">{item.label}</span> : null}
    </Link>
  );
}

function NavSection({ label, items, ...props }: NavProps & { label: string; items: NavItem[] }) {
  return (
    <div className="space-y-0.5">
      {!props.collapsed ? (
        <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-medium tracking-wide text-fg-faint uppercase">{label}</p>
      ) : (
        <div className="mx-auto my-3 h-px w-5 bg-line" />
      )}
      {items.map((i) => (
        <NavLink key={i.href} item={i} {...props} />
      ))}
    </div>
  );
}

export function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="absolute inset-y-0 left-0 w-[264px] border-r border-line bg-bg-subtle"
          >
            {children}
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
