"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { STATUS_META, PRIORITY_META } from "@/lib/meta";
import { PRIORITIES, STATUSES, type Priority, type Status, type TaskInput } from "@/lib/types";
import { addWorkingDays, today } from "@/lib/utils";
import { GlassDialog } from "@/components/ui/dialog";
import { Button, Field } from "@/components/ui/glass";
import { X } from "lucide-react";

interface FormState {
  code: string;
  title: string;
  description: string;
  sprintId: string;
  estimateDays: string;
  status: Status;
  priority: Priority;
  startDate: string;
  targetDate: string;
  completedDate: string;
  notes: string;
  assignee: string;
  dependencies: string[];
  blockReason: string;
  blockWaitingOn: string;
  blockAction: string;
}

export function TaskFormDialog() {
  const session = useUI((s) => s.session);
  return <TaskFormDialogInner key={session} />;
}

function TaskFormDialogInner() {
  const { open, editId, defaultStatus } = useUI((s) => s.taskForm);
  const close = useUI((s) => s.closeTaskForm);
  const tasks = useStore((s) => s.tasks);
  const sprints = useStore((s) => s.sprints);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);

  const editing = editId ? tasks.find((t) => t.id === editId) : undefined;
  const [f, setF] = useState<FormState>(() => {
    if (editing)
      return {
        code: editing.code,
        title: editing.title,
        description: editing.description,
        sprintId: editing.sprintId,
        estimateDays: String(editing.estimateDays),
        status: editing.status,
        priority: editing.priority,
        startDate: editing.startDate ?? "",
        targetDate: editing.targetDate ?? "",
        completedDate: editing.completedDate ?? "",
        notes: editing.notes,
        assignee: editing.assignee ?? "",
        dependencies: editing.dependencies,
        blockReason: editing.blocker?.reason ?? "",
        blockWaitingOn: editing.blocker?.waitingOn ?? "",
        blockAction: editing.blocker?.requiredAction ?? "",
      };
    const start = today();
    return {
      code: "",
      title: "",
      description: "",
      sprintId: activeSprintId,
      estimateDays: "1",
      status: defaultStatus ?? "todo",
      priority: "medium",
      startDate: start,
      targetDate: addWorkingDays(start, 1),
      completedDate: "",
      notes: "",
      assignee: "",
      dependencies: [],
      blockReason: "",
      blockWaitingOn: "",
      blockAction: "",
    };
  });
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF({ ...f, [k]: v });

  const depOptions = tasks.filter((t) => t.id !== editId && !f.dependencies.includes(t.id));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = f.code.trim();
    const title = f.title.trim();
    const est = Number(f.estimateDays);
    if (!code) return setError("Task ID is required.");
    if (tasks.some((t) => t.code === code && t.id !== editId)) return setError(`Task ID ${code} already exists.`);
    if (!title) return setError("Title is required.");
    if (!Number.isFinite(est) || est < 0) return setError("Estimated duration must be a positive number.");
    if (f.startDate && f.targetDate && f.targetDate < f.startDate)
      return setError("Target date can't be before the start date.");
    if (f.status === "blocked" && !f.blockReason.trim()) return setError("Add a reason for blocking.");

    const blocker =
      f.status === "blocked"
        ? {
            reason: f.blockReason.trim(),
            waitingOn: f.blockWaitingOn.trim(),
            requiredAction: f.blockAction.trim(),
            blockedOn: editing?.blocker && !editing.blocker.resolvedOn ? editing.blocker.blockedOn : today(),
            updates: editing?.blocker && !editing.blocker.resolvedOn ? editing.blocker.updates : [],
          }
        : editing?.blocker ?? null;

    const input: TaskInput = {
      code,
      title,
      description: f.description.trim(),
      sprintId: f.sprintId,
      estimateDays: est,
      status: f.status,
      priority: f.priority,
      startDate: f.startDate || null,
      targetDate: f.targetDate || null,
      completedDate: f.status === "completed" ? f.completedDate || today() : null,
      notes: f.notes,
      assignee: f.assignee.trim().slice(0, 80) || undefined,
      dependencies: f.dependencies,
      blocker,
    };
    if (editing) updateTask(editing.id, input);
    else addTask(input);
    close();
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={(v) => !v && close()}
      title={editing ? `Edit task #${editing.code}` : "New task"}
      description={editing ? editing.title : "Add a task to your sprint."}
      className="max-w-2xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-st-blocked">{error}</p>}
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form="task-form">
            {editing ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-6">
        <Field label="Task ID" className="sm:col-span-2">
          <input className="field font-mono" value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="42030" autoFocus />
        </Field>
        <Field label="Title" className="sm:col-span-4">
          <input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="What needs to be done?" />
        </Field>
        <Field label="Description" className="sm:col-span-6">
          <textarea className="field min-h-20 resize-y" value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <select className="field" value={f.status} onChange={(e) => set("status", e.target.value as Status)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Priority" className="sm:col-span-2">
          <select className="field" value={f.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_META[p].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Sprint" className="sm:col-span-2">
          <select className="field" value={f.sprintId} onChange={(e) => set("sprintId", e.target.value)}>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>

        {f.status === "blocked" && (
          <div className="grid gap-3 rounded-2xl border border-st-blocked/30 bg-st-blocked/5 p-4 sm:col-span-6 sm:grid-cols-2">
            <Field label="Reason for blocking" className="sm:col-span-2">
              <input className="field" value={f.blockReason} onChange={(e) => set("blockReason", e.target.value)} />
            </Field>
            <Field label="Waiting for clarification from">
              <input className="field" value={f.blockWaitingOn} onChange={(e) => set("blockWaitingOn", e.target.value)} />
            </Field>
            <Field label="Required action">
              <input className="field" value={f.blockAction} onChange={(e) => set("blockAction", e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Estimated duration (days)" className="sm:col-span-2" hint="Half-days allowed, e.g. 0.5">
          <input className="field" type="number" step="0.25" min="0" value={f.estimateDays} onChange={(e) => set("estimateDays", e.target.value)} />
        </Field>
        <Field label="Start date" className="sm:col-span-2">
          <input className="field" type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="Target completion" className="sm:col-span-2">
          <input className="field" type="date" value={f.targetDate} onChange={(e) => set("targetDate", e.target.value)} />
        </Field>
        {f.status === "completed" && (
          <Field label="Completion date" className="sm:col-span-2">
            <input className="field" type="date" value={f.completedDate || today()} onChange={(e) => set("completedDate", e.target.value)} />
          </Field>
        )}

        <Field label="Dependencies" className="sm:col-span-6" hint="Tasks that must finish before this one can.">
          <div className="flex flex-wrap items-center gap-2">
            {f.dependencies.map((id) => {
              const d = tasks.find((t) => t.id === id);
              if (!d) return null;
              return (
                <span key={id} className="glass-soft inline-flex items-center gap-1.5 rounded-full py-1 pl-3 pr-1.5 text-xs">
                  <span className="font-mono">#{d.code}</span> {d.title}
                  <button
                    type="button"
                    aria-label={`Remove dependency ${d.code}`}
                    onClick={() => set("dependencies", f.dependencies.filter((x) => x !== id))}
                    className="grid size-5 place-items-center rounded-full hover:bg-[var(--glass-hover)]"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            {depOptions.length > 0 && (
              <select
                className="field w-auto min-w-48 py-1.5 text-xs"
                value=""
                onChange={(e) => e.target.value && set("dependencies", [...f.dependencies, e.target.value])}
              >
                <option value="">+ Add dependency…</option>
                {depOptions.map((t) => (
                  <option key={t.id} value={t.id}>#{t.code} {t.title}</option>
                ))}
              </select>
            )}
          </div>
        </Field>

        <Field label="Assignee" className="sm:col-span-6" hint="Leave empty to keep it assigned to you.">
          <input className="field" value={f.assignee} maxLength={80} onChange={(e) => set("assignee", e.target.value)} placeholder="You" />
        </Field>
        <Field label="Notes" className="sm:col-span-6">
          <textarea className="field min-h-20 resize-y" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </GlassDialog>
  );
}
