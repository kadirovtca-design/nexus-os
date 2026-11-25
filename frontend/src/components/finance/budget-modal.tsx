"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useFinanceCategories, useSaveBudget } from "@/lib/queries";
import type { Budget } from "@/lib/types";

export function BudgetModal({ open, onClose, budget }: { open: boolean; onClose: () => void; budget?: Budget | null | "overall" }) {
  return (
    <Modal open={open} onClose={onClose} title={budget && budget !== "overall" ? "Edit budget" : "Set budget"} description="Budgets reset every month." size="sm">
      {open ? <BudgetForm budget={budget} onDone={onClose} /> : null}
    </Modal>
  );
}

function BudgetForm({ budget, onDone }: { budget?: Budget | null | "overall"; onDone: () => void }) {
  const save = useSaveBudget();
  const cats = useFinanceCategories();
  const existing = budget && budget !== "overall" ? budget : null;
  const [scope, setScope] = useState<string>(existing ? existing.category ?? "" : budget === "overall" ? "" : "__cat");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = Number(new FormData(e.currentTarget).get("amount"));
    if (!(amount > 0)) return setError("Enter an amount greater than 0");
    const cat = scope === "" ? null : category.trim();
    if (scope !== "" && !cat) return setError("Choose a category");
    await save.mutateAsync({ category: cat, amount });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!existing ? (
        <div className="flex gap-2 text-[13px]">
          {[["", "Overall monthly"], ["__cat", "Category"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setScope(v!)} className={`flex-1 rounded-lg border px-3 py-2 ${scope === v ? "border-accent/50 bg-accent/10 text-fg" : "border-line text-fg-subtle"}`}>
              {l}
            </button>
          ))}
        </div>
      ) : null}
      {scope !== "" ? (
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} list="budget-cats" placeholder="e.g. Groceries" disabled={!!existing} />
          <datalist id="budget-cats">{cats.data?.expense.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      ) : null}
      <Field label="Monthly limit" error={error}>
        <Input name="amount" type="number" step="0.01" min="0.01" defaultValue={existing?.amount} placeholder="0.00" autoFocus className="tabular" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" loading={save.isPending}>Save budget</Button>
      </div>
    </form>
  );
}
