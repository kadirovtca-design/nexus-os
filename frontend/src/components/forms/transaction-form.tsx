"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useFinanceCategories, useSaveTransaction } from "@/lib/queries";
import type { Transaction, TxType } from "@/lib/types";
import { toDayString } from "@/lib/utils";

const DEFAULT_CATS: Record<TxType, string[]> = {
  expense: ["Groceries", "Housing", "Dining", "Transport", "Utilities", "Shopping", "Health", "Subscriptions", "Entertainment", "Travel"],
  income: ["Salary", "Freelance", "Investments", "Gifts", "Refunds"],
};

export function TransactionFormModal({
  open,
  onClose,
  tx,
  defaultType = "expense",
}: {
  open: boolean;
  onClose: () => void;
  tx?: Transaction | null;
  defaultType?: TxType;
}) {
  return (
    <Modal open={open} onClose={onClose} title={tx ? "Edit transaction" : "New transaction"}>
      {open ? <TxForm tx={tx} defaultType={defaultType} onDone={onClose} /> : null}
    </Modal>
  );
}

function TxForm({ tx, defaultType, onDone }: { tx?: Transaction | null; defaultType: TxType; onDone: () => void }) {
  const [type, setType] = useState<TxType>(tx?.type ?? defaultType);
  const [category, setCategory] = useState(tx?.category ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cats = useFinanceCategories();
  const save = useSaveTransaction();
  const suggestions = Array.from(new Set([...(cats.data?.[type] ?? []), ...DEFAULT_CATS[type]])).slice(0, 10);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const amount = Number(f.get("amount"));
    const errs: Record<string, string> = {};
    if (!(amount > 0)) errs.amount = "Enter an amount greater than 0";
    if (!category.trim()) errs.category = "Pick or type a category";
    if (!f.get("date")) errs.date = "Date is required";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await save.mutateAsync({
      id: tx?.id,
      type,
      amount: Math.round(amount * 100) / 100,
      category: category.trim(),
      description: String(f.get("description") ?? "").trim() || null,
      date: String(f.get("date")),
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Segmented
        value={type}
        onChange={setType}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
        options={[
          { value: "expense", label: "Expense", icon: <ArrowUpRight /> },
          { value: "income", label: "Income", icon: <ArrowDownLeft /> },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" error={errors.amount}>
          <Input name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" defaultValue={tx?.amount} placeholder="0.00" autoFocus className="tabular" />
        </Field>
        <Field label="Date" error={errors.date}>
          <Input name="date" type="date" defaultValue={tx?.date ?? toDayString(new Date())} />
        </Field>
      </div>
      <Field label="Category" error={errors.category}>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category" maxLength={60} />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggestions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                category === c ? "border-accent/40 bg-accent/10 text-accent-2" : "border-line text-fg-subtle hover:text-fg"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Description">
        <Input name="description" defaultValue={tx?.description ?? ""} placeholder="Optional note" maxLength={255} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {tx ? "Save changes" : `Add ${type}`}
        </Button>
      </div>
    </form>
  );
}
