"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useCreateTask, useProjects, useTaskCategories, useUpdateTask } from "@/lib/queries";
import type { Task, TaskInput } from "@/lib/types";

export function TaskFormModal({
  open,
  onClose,
  task,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  task?: Task | null;
  defaults?: TaskInput;
}) {
  return (
    <Modal open={open} onClose={onClose} title={task ? "Edit task" : "New task"} size="md">
      {open ? <TaskForm task={task} defaults={defaults} onDone={onClose} /> : null}
    </Modal>
  );
}

function TaskForm({ task, defaults, onDone }: { task?: Task | null; defaults?: TaskInput; onDone: () => void }) {
  const projects = useProjects();
  const cats = useTaskCategories();
  const create = useCreateTask();
  const update = useUpdateTask({ silent: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const init = { ...defaults, ...task };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title") ?? "").trim();
    if (!title) return setErrors({ title: "Give your task a title" });
    const body: TaskInput = {
      title,
      description: String(f.get("description") ?? "").trim() || null,
      status: f.get("status") as Task["status"],
      priority: f.get("priority") as Task["priority"],
      category: String(f.get("category") ?? "").trim() || null,
      due_date: String(f.get("due_date") ?? "") || null,
      project_id: f.get("project_id") ? Number(f.get("project_id")) : null,
    };
    if (task) await update.mutateAsync({ id: task.id, ...body });
    else await create.mutateAsync(body);
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title" error={errors.title}>
        <Input name="title" defaultValue={init.title ?? ""} placeholder="What needs to be done?" autoFocus maxLength={200} aria-invalid={!!errors.title} />
      </Field>
      <Field label="Notes">
        <Textarea name="description" defaultValue={init.description ?? ""} placeholder="Add details, links, acceptance criteria…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select name="status" defaultValue={init.status ?? "todo"}>
            <option value="todo">To do</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </Select>
        </Field>
        <Field label="Priority">
          <Select name="priority" defaultValue={init.priority ?? "medium"}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <Field label="Due date">
          <Input type="date" name="due_date" defaultValue={init.due_date ?? ""} />
        </Field>
        <Field label="Project">
          <Select name="project_id" defaultValue={init.project_id ?? ""}>
            <option value="">No project</option>
            {projects.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Category">
        <Input name="category" list="task-categories" defaultValue={init.category ?? ""} placeholder="e.g. Work, Personal" maxLength={60} />
        <datalist id="task-categories">
          {cats.data?.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={create.isPending || update.isPending}>
          {task ? "Save changes" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
