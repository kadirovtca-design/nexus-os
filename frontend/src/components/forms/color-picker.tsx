"use client";

import { Check } from "lucide-react";

import { cn, PROJECT_COLORS } from "@/lib/utils";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className={cn(
            "grid size-7 place-items-center rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110",
            value.toLowerCase() === c.toLowerCase() && "ring-2 ring-fg/60",
          )}
          style={{ background: c }}
        >
          {value.toLowerCase() === c.toLowerCase() ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
        </button>
      ))}
    </div>
  );
}
