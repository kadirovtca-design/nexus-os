"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useSaveProject } from "@/lib/queries";
import type { Project } from "@/lib/types";

import { ColorPicker } from "./color-picker";

export function ProjectFormModal({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project | null }) {
  return (
    <Modal open={open} onClose={onClose} title={project ? "Edit project" : "New project"}>
      {open ? <ProjectForm project={project} onDone={onClose} /> : null}
    </Modal>
  );
}

function ProjectForm({ project, onDone }: { project?: Project | null; onDone: () => void }) {
  const save = useSaveProject();
  const [color, setColor] = useState(project?.color ?? "#7C5CFF");
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    if (!name) return setError("Name is required");
    await save.mutateAsync({
      id: project?.id,
      name,
      description: String(f.get("description") ?? "").trim() || null,
      deadline: String(f.get("deadline") ?? "") || null,
      status: f.get("status") as Project["status"],
      color,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" error={error}>
        <Input name="name" defaultValue={project?.name} placeholder="e.g. Website relaunch" autoFocus maxLength={120} />
      </Field>
      <Field label="Description">
        <Textarea name="description" defaultValue={project?.description ?? ""} placeholder="What does success look like?" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deadline">
          <Input type="date" name="deadline" defaultValue={project?.deadline ?? ""} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={project?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </Select>
        </Field>
      </div>
      <Field label="Color">
        <ColorPicker value={color} onChange={setColor} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={save.isPending}>
          {project ? "Save changes" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
