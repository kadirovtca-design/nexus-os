"use client";

import {
  addDays, addMonths, addWeeks, differenceInMinutes, endOfDay, format, isSameDay, isSameMonth,
  isToday, max as maxDate, min as minDate, parseISO, startOfDay, startOfMonth, startOfWeek,
} from "date-fns";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Link2, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EventFormModal, type EventDefaults } from "@/components/forms/event-form";
import { PageHeader } from "@/components/layout/page-header";
import { DueLabel } from "@/components/tasks/task-meta";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { useEvents, useMe, useTasks } from "@/lib/queries";
import type { CalendarEvent } from "@/lib/types";
import { cn, toDayString } from "@/lib/utils";

type View = "month" | "week" | "day";
const HOUR_PX = 52;

export function CalendarView() {
  const me = useMe();
  const weekStartsOn = (me.data?.preferences.week_starts_on ?? 1) as 0 | 1;
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState<EventDefaults | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      const s = startOfWeek(startOfMonth(cursor), { weekStartsOn });
      return { start: s, end: addDays(s, 42) };
    }
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn });
      return { start: s, end: addDays(s, 7) };
    }
    return { start: startOfDay(cursor), end: addDays(startOfDay(cursor), 1) };
  }, [view, cursor, weekStartsOn]);

  const events = useEvents(range.start.toISOString(), range.end.toISOString());
  const list = events.data ?? [];

  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, dir) : view === "week" ? addWeeks(c, dir) : addDays(c, dir)));

  const title =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : view === "week"
        ? `${format(range.start, "MMM d")} – ${format(addDays(range.end, -1), isSameMonth(range.start, addDays(range.end, -1)) ? "d, yyyy" : "MMM d, yyyy")}`
        : format(cursor, "EEEE, MMMM d, yyyy");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName) || document.querySelector('[role="dialog"]')) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
      if (e.key.toLowerCase() === "t") setCursor(new Date());
      if (e.key.toLowerCase() === "m") setView("month");
      if (e.key.toLowerCase() === "w") setView("week");
      if (e.key.toLowerCase() === "d") setView("day");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Plan time, not just tasks."
        actions={
          <>
            <Segmented value={view} onChange={setView} options={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }]} />
            <Button variant="primary" onClick={() => setCreating({ date: toDayString(cursor) })}>
              <Plus /> New event
            </Button>
          </>
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="icon" onClick={() => step(-1)} aria-label="Previous"><ChevronLeft /></Button>
        <Button variant="secondary" size="icon" onClick={() => step(1)} aria-label="Next"><ChevronRight /></Button>
        <Button variant="secondary" size="md" onClick={() => setCursor(new Date())}>Today</Button>
        <h2 className="ml-2 text-lg font-semibold tracking-tight text-fg">{title}</h2>
        {events.isFetching ? <span className="ml-2 size-1.5 animate-pulse rounded-full bg-accent" /> : null}
      </div>

      {view === "month" ? (
        <MonthGrid
          start={range.start}
          cursor={cursor}
          events={list}
          weekStartsOn={weekStartsOn}
          onOpen={setEditing}
          onDay={(d) => { setCursor(d); setView("day"); }}
          onCreate={(d) => setCreating({ date: toDayString(d) })}
        />
      ) : (
        <div className={cn("grid gap-5", view === "day" && "xl:grid-cols-[1fr_320px]")}>
          <TimeGrid
            days={Array.from({ length: view === "week" ? 7 : 1 }, (_, i) => addDays(range.start, i))}
            events={list}
            onOpen={setEditing}
            onCreate={(d, h) => setCreating({ date: toDayString(d), start: `${String(h).padStart(2, "0")}:00`, end: `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${h + 1 > 23 ? "59" : "00"}` })}
          />
          {view === "day" ? <DayTasks day={cursor} onSchedule={(taskId, title) => setCreating({ date: toDayString(cursor), task_id: taskId, title, start: "10:00", end: "11:00" })} /> : null}
        </div>
      )}

      <EventFormModal open={!!editing} onClose={() => setEditing(null)} event={editing} />
      <EventFormModal open={!!creating} onClose={() => setCreating(null)} defaults={creating ?? undefined} />
    </>
  );
}

function eventsOn(day: Date, events: CalendarEvent[]) {
  return events.filter((e) => parseISO(e.start_at) <= endOfDay(day) && parseISO(e.end_at) >= startOfDay(day));
}

function MonthGrid({
  start, cursor, events, weekStartsOn, onOpen, onDay, onCreate,
}: {
  start: Date; cursor: Date; events: CalendarEvent[]; weekStartsOn: 0 | 1;
  onOpen: (e: CalendarEvent) => void; onDay: (d: Date) => void; onCreate: (d: Date) => void;
}) {
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weekdays = Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(new Date(), { weekStartsOn }), i), "EEE"));
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-bg-subtle/60">
        {weekdays.map((w) => <div key={w} className="px-3 py-2 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const items = eventsOn(d, events).sort((a, b) => Number(b.all_day) - Number(a.all_day) || a.start_at.localeCompare(b.start_at));
          const muted = !isSameMonth(d, cursor);
          return (
            <div
              key={i}
              onDoubleClick={() => onCreate(d)}
              className={cn(
                "group relative min-h-[84px] border-r border-b border-line p-1.5 sm:min-h-[112px]",
                (i + 1) % 7 === 0 && "border-r-0",
                i >= 35 && "border-b-0",
                muted && "bg-bg-subtle/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => onDay(d)}
                  className={cn(
                    "tabular grid size-6 place-items-center rounded-full text-xs transition-colors hover:bg-surface-3",
                    isToday(d) ? "bg-accent font-semibold text-white hover:bg-accent" : muted ? "text-fg-faint" : "text-fg-muted",
                  )}
                >
                  {format(d, "d")}
                </button>
                <button onClick={() => onCreate(d)} className="rounded p-0.5 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-fg" aria-label={`Add event on ${format(d, "MMM d")}`}>
                  <Plus className="size-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onOpen(e)}
                    className="flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] transition-colors hover:brightness-125"
                    style={{ background: `color-mix(in oklab, ${e.color} 16%, transparent)`, color: "var(--fg)" }}
                    title={e.title}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                    {!e.all_day ? <span className="tabular hidden text-fg-subtle sm:inline">{format(parseISO(e.start_at), "HH:mm")}</span> : null}
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
                {items.length > 3 ? (
                  <button onClick={() => onDay(d)} className="px-1.5 text-[11px] text-fg-subtle hover:text-fg">+{items.length - 3} more</button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

interface Placed { ev: CalendarEvent; top: number; height: number; lane: number; lanes: number }

function layoutDay(day: Date, events: CalendarEvent[]): Placed[] {
  const dayStart = startOfDay(day);
  const items = eventsOn(day, events)
    .filter((e) => !e.all_day)
    .map((ev) => {
      const s = maxDate([parseISO(ev.start_at), dayStart]);
      const e = minDate([parseISO(ev.end_at), endOfDay(day)]);
      return { ev, s, e };
    })
    .sort((a, b) => a.s.getTime() - b.s.getTime());
  const placed: Placed[] = [];
  let cluster: (Placed & { end: Date })[] = [];
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => placed.push({ ...c, lanes }));
    cluster = [];
  };
  for (const it of items) {
    if (cluster.length && cluster.every((c) => c.end <= it.s)) flush();
    const used = new Set(cluster.filter((c) => c.end > it.s).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const top = (differenceInMinutes(it.s, dayStart) / 60) * HOUR_PX;
    const height = Math.max(22, (differenceInMinutes(it.e, it.s) / 60) * HOUR_PX - 2);
    cluster.push({ ev: it.ev, top, height, lane, lanes: 1, end: it.e });
  }
  flush();
  return placed;
}

function TimeGrid({ days, events, onOpen, onCreate }: { days: Date[]; events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void; onCreate: (d: Date, hour: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    scroller.current?.scrollTo({ top: HOUR_PX * 7.5 });
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const allDay = days.map((d) => eventsOn(d, events).filter((e) => e.all_day));
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <Card className="overflow-hidden">
      <div className="grid border-b border-line bg-bg-subtle/60" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="border-l border-line px-2 py-2 text-center">
            <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{format(d, "EEE")}</p>
            <p className={cn("tabular mx-auto mt-0.5 grid size-7 place-items-center rounded-full text-sm font-semibold", isToday(d) ? "bg-accent text-white" : "text-fg")}>{format(d, "d")}</p>
          </div>
        ))}
      </div>
      {allDay.some((a) => a.length) ? (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div className="py-1.5 pr-2 text-right text-[10px] text-fg-faint">all-day</div>
          {allDay.map((items, i) => (
            <div key={i} className="space-y-0.5 border-l border-line p-1">
              {items.map((e) => (
                <button key={e.id} onClick={() => onOpen(e)} className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11.5px] text-fg" style={{ background: `color-mix(in oklab, ${e.color} 22%, transparent)` }}>
                  {e.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <div ref={scroller} className="relative max-h-[640px] overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: cols, height: HOUR_PX * 24 }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="tabular absolute right-2 -translate-y-1/2 text-[10.5px] text-fg-faint" style={{ top: h * HOUR_PX }}>
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d.toISOString()} className="relative border-l border-line">
              {Array.from({ length: 24 }, (_, h) => (
                <button
                  key={h}
                  onClick={() => onCreate(d, h)}
                  className="absolute inset-x-0 border-t border-line/70 transition-colors hover:bg-accent/[0.05]"
                  style={{ top: h * HOUR_PX, height: HOUR_PX }}
                  aria-label={`Create event ${format(d, "MMM d")} ${h}:00`}
                />
              ))}
              {layoutDay(d, events).map(({ ev, top, height, lane, lanes }) => (
                <button
                  key={ev.id}
                  onClick={() => onOpen(ev)}
                  className="absolute overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left shadow-card transition-[filter] hover:brightness-125"
                  style={{
                    top: top + 1,
                    height,
                    left: `calc(${(lane / lanes) * 100}% + 3px)`,
                    width: `calc(${100 / lanes}% - 6px)`,
                    borderColor: ev.color,
                    background: `color-mix(in oklab, ${ev.color} 20%, var(--surface))`,
                  }}
                >
                  <p className="truncate text-[12px] font-medium text-fg">{ev.title}</p>
                  {height > 34 ? (
                    <p className="tabular truncate text-[10.5px] text-fg-muted">
                      {format(parseISO(ev.start_at), "HH:mm")} – {format(parseISO(ev.end_at), "HH:mm")}
                      {ev.task ? " · task" : ""}
                    </p>
                  ) : null}
                </button>
              ))}
              {isSameDay(d, now) ? (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (differenceInMinutes(now, startOfDay(now)) / 60) * HOUR_PX }}>
                  <div className="relative h-px bg-danger">
                    <span className="absolute -top-[4px] -left-[4px] size-[9px] rounded-full bg-danger" />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DayTasks({ day, onSchedule }: { day: Date; onSchedule: (taskId: number, title: string) => void }) {
  const ds = toDayString(day);
  const tasks = useTasks({ status: ["todo", "in_progress"], sort: "priority" });
  const due = (tasks.data ?? []).filter((t) => t.due_date === ds);
  const overdue = isToday(day) ? (tasks.data ?? []).filter((t) => t.due_date && t.due_date < ds) : [];
  const items = [...overdue, ...due];
  return (
    <Card className="h-fit">
      <CardHeader title="Tasks for this day" subtitle="Turn a task into a time block" icon={<CalendarClock />} />
      {items.length === 0 ? (
        <EmptyState className="py-8" icon={<CalendarDays />} title="No tasks due" />
      ) : (
        <ul className="px-2 pb-3">
          {items.map((t) => (
            <li key={t.id} className="group flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-2/70">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{t.title}</p>
                <DueLabel due={t.due_date} status={t.status} />
              </div>
              <Button size="sm" variant="ghost" onClick={() => onSchedule(t.id, t.title)} title="Schedule as event">
                <Link2 /> Schedule
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
