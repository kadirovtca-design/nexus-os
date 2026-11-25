"use client";

import { format, parseISO } from "date-fns";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, useConfirm } from "@/components/ui/modal";
import { useDeleteEvent, useSaveEvent, useTasks } from "@/lib/queries";
import type { CalendarEvent } from "@/lib/types";

import { ColorPicker } from "./color-picker";

export interface EventDefaults {
  date?: string;
  start?: string;
  end?: string;
  task_id?: number;
  title?: string;
}

export function EventFormModal({
  open,
  onClose,
  event,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaults?: EventDefaults;
}) {
  return (
    <Modal open={open} onClose={onClose} title={event ? "Edit event" : "New event"}>
      {open ? <EventForm event={event} defaults={defaults} onDone={onClose} /> : null}
    </Modal>
  );
}

function EventForm({ event, defaults, onDone }: { event?: CalendarEvent | null; defaults?: EventDefaults; onDone: () => void }) {
  const save = useSaveEvent();
  const del = useDeleteEvent();
  const confirm = useConfirm();
  const tasks = useTasks({ status: ["todo", "in_progress"], sort: "due_date" });
  const start = event ? parseISO(event.start_at) : null;
  const end = event ? parseISO(event.end_at) : null;
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [color, setColor] = useState(event?.color ?? "#3B82F6");
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    const date = String(f.get("date") ?? "");
    const endDate = String(f.get("end_date") || date);
    if (!title) return setError("Title is required");
    if (!date) return setError("Date is required");
    const s = allDay ? new Date(`${date}T00:00`) : new Date(`${date}T${f.get("start_time") || "09:00"}`);
    const en = allDay ? new Date(`${endDate}T23:59`) : new Date(`${endDate}T${f.get("end_time") || "10:00"}`);
    if (en < s) return setError("End must be after start");
    await save.mutateAsync({
      id: event?.id,
      title,
      start_at: s.toISOString(),
      end_at: en.toISOString(),
      all_day: allDay,
      color,
      location: String(f.get("location") ?? "").trim() || null,
      description: String(f.get("description") ?? "").trim() || null,
      task_id: f.get("task_id") ? Number(f.get("task_id")) : null,
    });
    onDone();
  }

  async function remove() {
    if (!event) return;
    if (await confirm({ title: "Delete event?", description: `“${event.title}” will be removed from your calendar.`, tone: "danger", confirmLabel: "Delete" })) {
      await del.mutateAsync(event.id);
      onDone();
    }
  }

  const linkedTasks = tasks.data ?? [];
  const currentTask = event?.task && !linkedTasks.some((t) => t.id === event.task!.id) ? event.task : null;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" error={error}>
        <Input name="title" defaultValue={event?.title ?? defaults?.title} placeholder="Meeting, focus block, workout…" autoFocus maxLength={200} />
      </Field>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-fg-muted">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[var(--accent)]" />
        All-day
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts">
          <Input type="date" name="date" defaultValue={start ? format(start, "yyyy-MM-dd") : defaults?.date} required />
        </Field>
        <Field label="Ends">
          <Input type="date" name="end_date" defaultValue={end ? format(end, "yyyy-MM-dd") : defaults?.date} />
        </Field>
        {!allDay ? (
          <>
            <Field label="Start time">
              <Input type="time" name="start_time" defaultValue={start ? format(start, "HH:mm") : defaults?.start ?? "09:00"} />
            </Field>
            <Field label="End time">
              <Input type="time" name="end_time" defaultValue={end ? format(end, "HH:mm") : defaults?.end ?? "10:00"} />
            </Field>
          </>
        ) : null}
      </div>
      <Field label="Linked task" hint="Connect this time block to a task.">
        <Select name="task_id" defaultValue={event?.task_id ?? defaults?.task_id ?? ""}>
          <option value="">None</option>
          {currentTask ? <option value={currentTask.id}>{currentTask.title}</option> : null}
          {linkedTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Location">
        <Input name="location" defaultValue={event?.location ?? ""} placeholder="Optional" maxLength={200} />
      </Field>
      <Field label="Notes">
        <Textarea name="description" defaultValue={event?.description ?? ""} className="min-h-[64px]" />
      </Field>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <div className="flex items-center justify-between gap-2 pt-2">
        {event ? (
          <Button variant="danger" onClick={remove} loading={del.isPending}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.isPending}>
            {event ? "Save" : "Create event"}
          </Button>
        </div>
      </div>
    </form>
  );
}
