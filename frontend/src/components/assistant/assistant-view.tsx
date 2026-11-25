"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, ArrowUp, BarChart3, CalendarClock, FolderKanban, Info, KeyRound, ListChecks, RotateCcw, Sparkles,
  Square, Target, TrendingUp, Wallet, Flame,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, Skeleton } from "@/components/ui/misc";
import { ApiError, streamSSE } from "@/lib/api";
import { useAssistantStatus, useInsights } from "@/lib/queries";
import type { Insight } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Markdown } from "./markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const PROMPTS = [
  { icon: CalendarClock, label: "Plan my day", prompt: "Plan my day. Build a time-blocked schedule around my calendar, starting with overdue and urgent work." },
  { icon: ListChecks, label: "Summarize my tasks", prompt: "Summarize my open tasks: what's overdue, what's due soon, and what's blocked or in progress." },
  { icon: Target, label: "Suggest priorities", prompt: "What should I prioritize this week and why? Give me a ranked top 5." },
  { icon: BarChart3, label: "Analyze productivity", prompt: "Analyze my productivity over the last 7 days. What patterns do you see and what should I change?" },
  { icon: FolderKanban, label: "Organize projects", prompt: "Review my active projects and suggest how to organize the next steps for each one." },
];

export function AssistantView() {
  const status = useAssistantStatus();
  const configured = status.data?.configured ?? false;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2.5">Assistant {status.data ? configured ? <Badge tone="success" dot="var(--success)">{status.data.model}</Badge> : <Badge tone="warning">Not configured</Badge> : null}</span>}
        description="Plan, prioritize and reflect — grounded in your own data."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        {status.isLoading ? <Skeleton className="h-[560px] rounded-[14px]" /> : configured ? <Chat /> : <SetupCard steps={status.data?.setup?.steps ?? []} envVar={status.data?.setup?.env_var ?? "ANTHROPIC_API_KEY"} />}
        <InsightsPanel />
      </div>
    </>
  );
}

function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const patch = (fn: (m: Msg) => Msg) => setMessages((ms) => [...ms.slice(0, -1), fn(ms[ms.length - 1]!)]);
    try {
      await streamSSE(
        "/assistant/chat",
        { messages: history.slice(-20).map(({ role, content }) => ({ role, content })) },
        (event, data) => {
          if (event === "delta") patch((m) => ({ ...m, content: m.content + String(data.text ?? "") }));
          if (event === "error") patch((m) => ({ ...m, content: String(data.message ?? "Something went wrong"), error: true }));
        },
        ctrl.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        patch((m) => ({ ...m, content: err instanceof ApiError ? err.message : "Could not reach the assistant.", error: true }));
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <Card className="flex h-[calc(100dvh-210px)] min-h-[520px] flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-2xl bg-accent/30 blur-2xl" />
              <div className="relative grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-pop"><Sparkles className="size-6" /></div>
            </div>
            <h2 className="text-lg font-semibold text-fg">How can I help today?</h2>
            <p className="mt-1 text-sm text-fg-subtle">I can see your tasks, calendar, habits, goals and this month’s finances. I can’t change anything — I’ll tell you what to do.</p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {PROMPTS.map((p) => (
                <button key={p.label} onClick={() => send(p.prompt)} className="flex items-center gap-2.5 rounded-xl border border-line bg-bg-subtle px-3.5 py-3 text-left text-[13px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg">
                  <p.icon className="size-4 text-accent-2" />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", m.role === "user" && "justify-end")}>
                  {m.role === "assistant" ? (
                    <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", m.error ? "bg-danger/15 text-danger" : "bg-gradient-to-br from-accent to-accent-2 text-white")}>
                      {m.error ? <AlertTriangle className="size-3.5" /> : <Sparkles className="size-3.5" />}
                    </span>
                  ) : null}
                  <div className={cn("max-w-[85%]", m.role === "user" ? "rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-[14px] text-fg" : "min-w-0 flex-1")}>
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : m.content ? (
                      m.error ? <p className="text-[14px] text-danger">{m.content}</p> : <Markdown text={m.content} />
                    ) : (
                      <span className="flex gap-1 pt-2">{[0, 1, 2].map((d) => <motion.span key={d} className="size-1.5 rounded-full bg-fg-subtle" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.15 }} />)}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={bottom} />
          </div>
        )}
      </div>
      <div className="border-t border-line bg-bg-subtle/50 p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-line-strong bg-surface p-2 focus-within:border-accent/50"
        >
          <textarea
            ref={area}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about your day, tasks, habits or spending…"
            rows={1}
            maxLength={8000}
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] text-fg outline-none placeholder:text-fg-faint"
          />
          {messages.length && !busy ? <Button variant="ghost" size="icon" onClick={() => setMessages([])} aria-label="New conversation" title="New conversation"><RotateCcw /></Button> : null}
          {busy ? (
            <Button variant="secondary" size="icon" onClick={() => abort.current?.abort()} aria-label="Stop"><Square className="!size-3.5 fill-current" /></Button>
          ) : (
            <Button type="submit" variant="primary" size="icon" disabled={!input.trim()} aria-label="Send"><ArrowUp /></Button>
          )}
        </form>
        <p className="mt-1.5 text-center text-[11px] text-fg-faint">AI can make mistakes. Double-check anything important.</p>
      </div>
    </Card>
  );
}

function SetupCard({ steps, envVar }: { steps: string[]; envVar: string }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative p-6 sm:p-8">
        <div className="grid size-12 place-items-center rounded-2xl border border-line-strong bg-surface-2 text-accent-2"><KeyRound className="size-5" /></div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-fg">Connect an AI model to enable chat</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-fg-subtle">
          The assistant uses Anthropic’s Claude API. No API key is configured on this server, so live AI is switched off — nothing here is simulated.
          The panel on the right shows rule-based insights computed directly from your data in the meantime.
        </p>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] text-fg-muted">
              <span className="tabular grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-xs text-fg">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <pre className="mt-6 overflow-x-auto rounded-xl border border-line bg-bg-subtle p-4 font-mono text-[12.5px] text-fg-muted">
{`# backend/.env
${envVar}=sk-ant-...
AI_MODEL=claude-opus-5-5   # optional
AI_EFFORT=low              # optional: low | medium | high`}
        </pre>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {PROMPTS.map((p) => (
            <div key={p.label} className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-3 text-[13px] text-fg-faint">
              <p.icon className="size-4" /> {p.label}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-faint">These capabilities unlock once a key is configured.</p>
      </div>
    </Card>
  );
}

const INSIGHT_ICON: Record<Insight["kind"], React.ReactNode> = {
  warning: <AlertTriangle className="text-danger" />,
  focus: <Target className="text-accent-2" />,
  habit: <Flame className="text-warning" />,
  calendar: <CalendarClock className="text-info" />,
  goal: <Target className="text-success" />,
  finance: <Wallet className="text-warning" />,
  trend: <TrendingUp className="text-accent-2" />,
  info: <Info className="text-fg-subtle" />,
};

function InsightsPanel() {
  const insights = useInsights();
  return (
    <Card className="h-fit">
      <CardHeader title="Local insights" subtitle="Rule-based from your data — not AI" icon={<Info />} />
      <div className="space-y-2 px-4 pb-4">
        {insights.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          : insights.data?.items.map((it, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-3 rounded-xl border border-line bg-bg-subtle p-3">
                <span className="mt-0.5 [&_svg]:size-4">{INSIGHT_ICON[it.kind]}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fg">{it.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-fg-subtle">{it.body}</p>
                </div>
              </motion.div>
            ))}
      </div>
    </Card>
  );
}
