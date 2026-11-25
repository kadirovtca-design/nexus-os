import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-fg-muted [&_svg]:size-[15px]">{icon}</span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-fg">{title}</h3>
          {subtitle ? <p className="truncate text-xs text-fg-subtle">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}
