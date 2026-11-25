"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useSaveGoal } from "@/lib/queries";
import type { Goal } from "@/lib/types";

const CATEGORIES = ["Career", "Health", "Finance", "Learning", "Personal", "Relationships"];

export function GoalFormModal({ open, onClose, goal }: { open: boolean; onClose: () => void; goal?: Goal | null }) {
  return (
    <Modal open={open} onClose={onClose} title={goal ? "Edit goal" : "New goal"} description={goal ? undefined : "Break it into milestones to track progress automatically."}>
      {open ? <GoalForm goal={goal} onDone={onClose} /> : null}
    </Modal>
  );
}

function GoalForm({ goal, onDone }: { goal?: Goal | null; onDone: () => void }) {
  const save = useSaveGoal();
  const [milestones, setMilestones] = useState<string[]>(goal ? [] : ["", ""]);
  const [category, setCategory] = useState(goal?.category ?? "");
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (!title) return setError("Title is required");
    const base = {
      title,
      description: String(f.get("description") ?? "").trim() || null,
      category: category.trim() || null,
      deadline: String(f.get("deadline") ?? "") || null,
    };
    if (goal) await save.mutateAsync({ id: goal.id, ...base });
    else await save.mutateAsync({ ...base, milestones: milestones.map((m) => m.trim()).filter(Boolean).map((title) => ({ title })) });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Goal" error={error}>
        <Input name="title" defaultValue={goal?.title} placeholder="e.g. Run a half marathon" autoFocus maxLength={200} />
      </Field>
      <Field label="Why it matters">
        <Textarea name="description" defaultValue={goal?.description ?? ""} className="min-h-[64px]" placeholder="Optional" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} list="goal-cats" placeholder="Category" maxLength={60} />
          <datalist id="goal-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Deadline">
          <Input type="date" name="deadline" defaultValue={goal?.deadline ?? ""} />
        </Field>
      </div>
      {!goal ? (
        <Field label="Milestones">
          <div className="space-y-2">
            {milestones.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={m}
                  onChange={(e) => setMilestones((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Milestone ${i + 1}`}
                  maxLength={200}
                />
                <Button variant="ghost" size="icon" onClick={() => setMilestones((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove milestone">
                  <X />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setMilestones((a) => [...a, ""])}>
              <Plus /> Add milestone
            </Button>
          </div>
        </Field>
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {goal ? "Save changes" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}
