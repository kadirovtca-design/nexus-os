"use client";

import type { ReactNode } from "react";

/** Categorical slots in fixed order. Color follows the entity, never its rank. */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--chart-${i + 1})`);

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--fg-subtle)", fontSize: 11 },
} as const;

export function ChartTooltip({
  active,
  label,
  payload,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string; payload?: Record<string, unknown> }[];
  formatter?: (v: number, name: string) => ReactNode;
  labelFormatter?: (l: string | number) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-xl border border-line-strong bg-surface-2/95 px-3 py-2 shadow-pop backdrop-blur">
      {label !== undefined ? <p className="mb-1.5 text-[11px] font-medium text-fg-subtle">{labelFormatter ? labelFormatter(label) : label}</p> : null}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-fg-muted">{p.name}</span>
            <span className="tabular ml-auto pl-3 font-medium text-fg">
              {formatter ? formatter(Number(p.value), String(p.name)) : p.value ?? "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-fg-muted">
          <span className="size-2 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined ? <span className="tabular text-fg">{i.value}</span> : null}
        </span>
      ))}
    </div>
  );
}
