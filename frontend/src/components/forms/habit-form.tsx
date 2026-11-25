"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useSaveHabit } from "@/lib/queries";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ColorPicker } from "./color-picker";
import { HABIT_ICONS } from "./habit-icons";

export function HabitFormModal({ open, onClose, habit }: { open: boolean; onClose: () => void; habit?: Habit | null }) {
  return (
    <Modal open={open} onClose={onClose} title={habit ? "Edit habit" : "New habit"}>
      {open ? <HabitForm habit={habit} onDone={onClose} /> : null}
    </Modal>
  );
}

function HabitForm({ habit, onDone }: { habit?: Habit | null; onDone: () => void }) {
  const save = useSaveHabit();
  const [color, setColor] = useState(habit?.color ?? "#7C5CFF");
  const [icon, setIcon] = useState(habit?.icon ?? "sparkles");
  const [target, setTarget] = useState(habit?.target_per_week ?? 7);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return setError("Name is required");
    await save.mutateAsync({
      id: habit?.id,
      name,
      description: String(f.get("description") ?? "").trim() || null,
      color,
      icon,
      target_per_week: target,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Habit" error={error}>
        <Input name="name" defaultValue={habit?.name} placeholder="e.g. Read 30 minutes" autoFocus maxLength={120} />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={habit?.description ?? ""} className="min-h-[60px]" placeholder="Optional" />
      </Field>
      <Field label={`Target — ${target === 7 ? "every day" : `${target}× per week`}`}>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTarget(n)}
              className={cn(
                "h-8 flex-1 rounded-lg border text-[13px] font-medium transition-colors",
                target === n ? "border-accent/50 bg-accent/15 text-fg" : "border-line text-fg-subtle hover:text-fg",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Icon">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(HABIT_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              aria-label={key}
              onClick={() => setIcon(key)}
              className={cn(
                "grid size-9 place-items-center rounded-lg border transition-colors",
                icon === key ? "border-accent/50 bg-accent/15 text-fg" : "border-line text-fg-subtle hover:text-fg",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {habit ? "Save changes" : "Create habit"}
        </Button>
      </div>
    </form>
  );
}
