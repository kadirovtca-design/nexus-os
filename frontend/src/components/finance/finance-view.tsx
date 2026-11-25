"use client";

import { format } from "date-fns";
import {
  ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, FileBarChart, MoreHorizontal, Pencil, PiggyBank,
  Plus, Receipt, Search, Target, Trash2, Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { axisProps, ChartTooltip, Legend, SERIES } from "@/components/charts/chart-kit";
import { TransactionFormModal } from "@/components/forms/transaction-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { EmptyState, Progress, Segmented, Skeleton } from "@/components/ui/misc";
import { useConfirm } from "@/components/ui/modal";
import { useBudgets, useDeleteBudget, useDeleteTransaction, useFinanceSummary, useMe, useTransactions } from "@/lib/queries";
import type { Budget, FinanceSummary, Transaction, TxType } from "@/lib/types";
import { cn, delta, money, parseDay, pct } from "@/lib/utils";

import { BudgetModal } from "./budget-modal";

const shiftMonth = (m: string, n: number) => {
  const d = parseDay(`${m}-01`);
  d.setMonth(d.getMonth() + n);
  return format(d, "yyyy-MM");
};

export function FinanceView() {
  const currency = useMe().data?.preferences.currency ?? "USD";
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const isCurrent = month === format(new Date(), "yyyy-MM");
  const summary = useFinanceSummary(month);
  const [txModal, setTxModal] = useState<{ tx?: Transaction | null; type?: TxType } | null>(null);
  const fmt = (v: number, compact = false) => money(v, currency, { compact });
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Finance"
        description="Cash flow, budgets and where your money goes."
        actions={
          <>
            <Button onClick={() => setTxModal({ type: "income" })}><ArrowDownLeft /> Income</Button>
            <Button variant="primary" onClick={() => setTxModal({ type: "expense" })}><Plus /> Expense</Button>
          </>
        }
      />
      <div className="mb-5 flex items-center gap-2">
        <Button size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month"><ChevronLeft /></Button>
        <Button size="icon" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrent} aria-label="Next month"><ChevronRight /></Button>
        <h2 className="ml-2 text-lg font-semibold tracking-tight text-fg">{format(parseDay(`${month}-01`), "MMMM yyyy")}</h2>
        {!isCurrent ? <Button variant="ghost" size="sm" onClick={() => setMonth(format(new Date(), "yyyy-MM"))}>This month</Button> : null}
      </div>

      {!s ? (
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-[14px]" />)}</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={<Wallet />} label="Balance" value={fmt(s.balance)} sub="All-time income − expenses" />
            <KpiCard icon={<ArrowDownLeft />} label="Income" value={fmt(s.income)} change={delta(s.income, s.prev_income)} goodWhenUp />
            <KpiCard icon={<ArrowUpRight />} label="Expenses" value={fmt(s.expense)} change={delta(s.expense, s.prev_expense)} goodWhenUp={false} />
            <KpiCard icon={<PiggyBank />} label="Savings rate" value={pct(s.savings_rate)} sub={`Net ${money(s.net, currency, { sign: true })}`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-12">
            <Card className="lg:col-span-7">
              <CardHeader title="Cash flow" subtitle="Income vs expenses, last 6 months" icon={<FileBarChart />} action={<Legend items={[{ label: "Income", color: SERIES[0]! }, { label: "Expenses", color: SERIES[1]! }]} />} />
              <div className="h-[240px] px-2 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.trend.map((t) => ({ ...t, label: format(parseDay(`${t.month}-01`), "MMM") }))} margin={{ top: 8, right: 12, left: 4, bottom: 0 }} barGap={2} barCategoryGap="26%">
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} width={52} tickFormatter={(v) => money(v, currency, { compact: true })} />
                    <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip formatter={(v) => fmt(v)} />} />
                    <Bar dataKey="income" name="Income" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="expense" name="Expenses" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <CategoryCard s={s} currency={currency} />

            <BudgetsCard currency={currency} isCurrent={isCurrent} summary={s} />
            <SpendPace s={s} currency={currency} />
          </div>

          <MonthlyReport s={s} currency={currency} />
          <TransactionsCard month={month} currency={currency} onEdit={(tx) => setTxModal({ tx })} onAdd={() => setTxModal({ type: "expense" })} />
        </div>
      )}
      <TransactionFormModal open={!!txModal} onClose={() => setTxModal(null)} tx={txModal?.tx} defaultType={txModal?.type} />
    </>
  );
}

function KpiCard({ icon, label, value, sub, change, goodWhenUp }: { icon: React.ReactNode; label: string; value: string; sub?: string; change?: number | null; goodWhenUp?: boolean }) {
  const good = change != null && (goodWhenUp ? change >= 0 : change <= 0);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs font-medium text-fg-subtle">
        {label}
        <span className="text-fg-faint [&_svg]:size-4">{icon}</span>
      </div>
      <p className="tabular mt-2 truncate text-[22px] font-semibold tracking-tight text-fg">{value}</p>
      {change !== undefined ? (
        <p className={cn("mt-1 text-xs", change == null ? "text-fg-subtle" : good ? "text-success" : "text-danger")}>
          {change == null ? "No data last month" : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change * 100).toFixed(1)}% vs last month`}
        </p>
      ) : (
        <p className="mt-1 truncate text-xs text-fg-subtle">{sub}</p>
      )}
    </Card>
  );
}

function CategoryCard({ s, currency }: { s: FinanceSummary; currency: string }) {
  // Fixed-order slots; anything past 7 folds into "Other" (never a generated 9th hue).
  const data = useMemo(() => {
    const rows = s.expense_by_category;
    const top = rows.slice(0, 7).map((r, i) => ({ ...r, color: SERIES[i]! }));
    const rest = rows.slice(7).reduce((sum, r) => sum + r.total, 0);
    return rest > 0 ? [...top, { category: "Other", total: rest, color: "var(--fg-faint)" }] : top;
  }, [s.expense_by_category]);
  const total = data.reduce((a, r) => a + r.total, 0);
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Spending by category" subtitle={`${data.length} categories`} icon={<Receipt />} />
      {data.length === 0 ? (
        <EmptyState className="py-10" icon={<Receipt />} title="No expenses this month" />
      ) : (
        <div className="flex flex-col items-center gap-5 px-5 pb-5 sm:flex-row">
          <div className="relative size-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="total" nameKey="category" innerRadius={56} outerRadius={80} paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2} isAnimationActive>
                  {data.map((d) => <Cell key={d.category} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip formatter={(v) => `${money(v, currency)} · ${((v / total) * 100).toFixed(0)}%`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[10.5px] text-fg-subtle uppercase">Spent</p>
                <p className="tabular text-sm font-semibold text-fg">{money(total, currency, { compact: true })}</p>
              </div>
            </div>
          </div>
          <ul className="w-full min-w-0 space-y-1.5">
            {data.map((d) => (
              <li key={d.category} className="flex items-center gap-2 text-[13px]">
                <span className="size-2 shrink-0 rounded-[3px]" style={{ background: d.color }} />
                <span className="truncate text-fg-muted">{d.category}</span>
                <span className="tabular ml-auto text-fg">{money(d.total, currency)}</span>
                <span className="tabular w-10 text-right text-xs text-fg-subtle">{((d.total / total) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function BudgetsCard({ currency, isCurrent, summary }: { currency: string; isCurrent: boolean; summary: FinanceSummary }) {
  const budgets = useBudgets();
  const del = useDeleteBudget();
  const confirm = useConfirm();
  const [modal, setModal] = useState<Budget | "overall" | null | undefined>(undefined);
  // Budgets endpoint reports the current month; for past months derive spend from the summary.
  const rows = (budgets.data ?? []).map((b) => {
    if (isCurrent) return b;
    const spent = b.category ? summary.expense_by_category.find((c) => c.category === b.category)?.total ?? 0 : summary.expense;
    return { ...b, spent, remaining: b.amount - spent, percent: Math.floor((spent * 100) / b.amount) };
  });
  return (
    <Card className="lg:col-span-5">
      <CardHeader title="Budgets" subtitle="Monthly limits" icon={<Target />} action={<Button size="sm" variant="ghost" onClick={() => setModal(null)}><Plus /> Add</Button>} />
      {budgets.isLoading ? (
        <Skeleton className="mx-5 mb-5 h-32" />
      ) : rows.length === 0 ? (
        <EmptyState className="py-8" icon={<Target />} title="No budgets yet" description="Set an overall cap or per-category limits." action={<Button size="sm" onClick={() => setModal("overall")}>Set monthly budget</Button>} />
      ) : (
        <ul className="space-y-4 px-5 pb-5">
          {rows.map((b) => {
            const color = b.percent > 100 ? "var(--danger)" : b.percent >= 85 ? "var(--warning)" : undefined;
            return (
              <li key={b.id} className="group">
                <div className="mb-1.5 flex items-center gap-2 text-[13px]">
                  <span className={cn("font-medium", b.category ? "text-fg-muted" : "text-fg")}>{b.category ?? "Overall"}</span>
                  <span className="tabular ml-auto text-fg-subtle">
                    <span className="text-fg">{money(b.spent, currency)}</span> / {money(b.amount, currency)}
                  </span>
                  <Menu
                    trigger={<button className="rounded p-0.5 text-fg-faint opacity-0 group-hover:opacity-100 hover:text-fg" aria-label="Budget actions"><MoreHorizontal className="size-4" /></button>}
                    items={[
                      { label: "Edit limit", icon: <Pencil />, onSelect: () => setModal(b) },
                      { label: "Remove", icon: <Trash2 />, danger: true, onSelect: async () => (await confirm({ title: "Remove budget?", tone: "danger", confirmLabel: "Remove" })) && del.mutate(b.id) },
                    ]}
                  />
                </div>
                <Progress value={b.percent} color={color} height={b.category ? 5 : 7} />
                <p className={cn("mt-1 text-[11.5px]", b.remaining < 0 ? "text-danger" : "text-fg-subtle")}>
                  {b.remaining < 0 ? `${money(-b.remaining, currency)} over` : `${money(b.remaining, currency)} left · ${b.percent}% used`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <BudgetModal open={modal !== undefined} onClose={() => setModal(undefined)} budget={modal} />
    </Card>
  );
}

function SpendPace({ s, currency }: { s: FinanceSummary; currency: string }) {
  const limit = s.budget?.amount;
  const data = s.daily_spend.map((d) => ({ ...d, label: format(parseDay(d.date), "d") }));
  const today = format(new Date(), "yyyy-MM-dd");
  const visible = data.filter((d) => d.date <= today);
  return (
    <Card className="lg:col-span-7">
      <CardHeader title="Spending pace" subtitle={limit ? "Cumulative spend vs. monthly budget" : "Cumulative spend this month"} icon={<ArrowUpRight />} />
      <div className="h-[230px] px-2 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visible} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[1]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...axisProps} width={52} tickFormatter={(v) => money(v, currency, { compact: true })} domain={[0, (max: number) => Math.max(max, limit ?? 0) * 1.08]} />
            <Tooltip content={<ChartTooltip labelFormatter={(l) => `Day ${l}`} formatter={(v) => money(v, currency)} />} />
            {limit ? <ReferenceLine y={limit} stroke="var(--fg-subtle)" strokeDasharray="4 4" label={{ value: "Budget", position: "insideTopRight", fill: "var(--fg-subtle)", fontSize: 11 }} /> : null}
            <Area type="monotone" dataKey="cumulative" name="Spent so far" stroke={SERIES[1]} strokeWidth={2} fill="url(#spend)" dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function MonthlyReport({ s, currency }: { s: FinanceSummary; currency: string }) {
  const top = s.expense_by_category[0];
  const dExp = delta(s.expense, s.prev_expense);
  const days = s.daily_spend.filter((d) => d.date <= format(new Date(), "yyyy-MM-dd")).length || 1;
  const lines = [
    `You earned ${money(s.income, currency)} and spent ${money(s.expense, currency)}, a net of ${money(s.net, currency, { sign: true })}.`,
    dExp != null ? `Spending is ${dExp >= 0 ? "up" : "down"} ${Math.abs(dExp * 100).toFixed(1)}% compared with last month.` : null,
    top ? `Largest category: ${top.category} (${money(top.total, currency)}, ${((top.total / Math.max(1, s.expense)) * 100).toFixed(0)}% of spending).` : null,
    `Average daily spend: ${money(s.expense / days, currency)}.`,
    s.budget ? (s.budget.remaining >= 0 ? `You're within budget with ${money(s.budget.remaining, currency)} remaining.` : `You're ${money(-s.budget.remaining, currency)} over your monthly budget.`) : null,
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader title="Monthly report" subtitle={format(parseDay(`${s.month}-01`), "MMMM yyyy")} icon={<FileBarChart />} />
      <ul className="grid gap-x-8 gap-y-2 px-5 pb-5 text-[13.5px] text-fg-muted md:grid-cols-2">
        {lines.map((l) => (
          <li key={l} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-accent" />{l}</li>
        ))}
      </ul>
    </Card>
  );
}

function TransactionsCard({ month, currency, onEdit, onAdd }: { month: string; currency: string; onEdit: (t: Transaction) => void; onAdd: () => void }) {
  const [type, setType] = useState<"all" | TxType>("all");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const tx = useTransactions({ month, type: type === "all" ? undefined : type, q: q.trim() || undefined, category: category || undefined });
  const del = useDeleteTransaction();
  const confirm = useConfirm();
  const cats = useMemo(() => Array.from(new Set((tx.data ?? []).map((t) => t.category))).sort(), [tx.data]);

  function exportCsv() {
    const rows = [["date", "type", "category", "description", "amount"], ...(tx.data ?? []).map((t) => [t.date, t.type, t.category, t.description ?? "", t.amount.toFixed(2)])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `nexus-transactions-${month}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader
        title="Transactions"
        subtitle={tx.data ? `${tx.data.length} this month` : undefined}
        icon={<Receipt />}
        action={<Button size="sm" variant="ghost" onClick={exportCsv} disabled={!tx.data?.length}><Download /> CSV</Button>}
      />
      <div className="flex flex-col gap-2 px-5 pb-3 sm:flex-row sm:items-center">
        <Segmented size="sm" value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "expense", label: "Expenses" }, { value: "income", label: "Income" }]} />
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-[13px] sm:w-44" aria-label="Category filter">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <div className="sm:ml-auto sm:w-60">
          <Input icon={<Search />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-8" />
        </div>
      </div>
      {tx.isLoading ? (
        <Skeleton className="mx-5 mb-5 h-40" />
      ) : !tx.data?.length ? (
        <EmptyState className="py-10" icon={<Receipt />} title="No transactions" description="Add income or an expense to see it here." action={<Button size="sm" onClick={onAdd}><Plus /> Add transaction</Button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="border-y border-line bg-bg-subtle/60 text-left text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {tx.data.map((t) => (
                <tr key={t.id} onClick={() => onEdit(t)} className="group cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2/60">
                  <td className="tabular px-5 py-2.5 whitespace-nowrap text-fg-subtle">{format(parseDay(t.date), "MMM d")}</td>
                  <td className="max-w-[280px] truncate px-3 py-2.5 text-fg">{t.description || <span className="text-fg-faint">—</span>}</td>
                  <td className="px-3 py-2.5 text-fg-muted">{t.category}</td>
                  <td className={cn("tabular px-3 py-2.5 text-right font-medium whitespace-nowrap", t.type === "income" ? "text-success" : "text-fg")}>
                    {t.type === "income" ? "+" : "−"}{money(t.amount, currency)}
                  </td>
                  <td className="pr-3" onClick={(e) => e.stopPropagation()}>
                    <Menu
                      trigger={<Button variant="ghost" size="icon-sm" className="opacity-0 group-hover:opacity-100" aria-label="Transaction actions"><MoreHorizontal /></Button>}
                      items={[
                        { label: "Edit", icon: <Pencil />, onSelect: () => onEdit(t) },
                        { label: "Delete", icon: <Trash2 />, danger: true, onSelect: async () => (await confirm({ title: "Delete transaction?", description: `${t.category} · ${money(t.amount, currency)}`, tone: "danger", confirmLabel: "Delete" })) && del.mutate(t.id) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
