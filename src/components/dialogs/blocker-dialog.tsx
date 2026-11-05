"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { today } from "@/lib/utils";
import { GlassDialog } from "@/components/ui/dialog";
import { Button, Field } from "@/components/ui/glass";

/** Mark a task as blocked (or edit an existing blocker). */
export function BlockerDialog() {
  const session = useUI((s) => s.session);
  return <BlockerDialogInner key={session} />;
}

function BlockerDialogInner() {
  const taskId = useUI((s) => s.blockerFor);
  const close = () => useUI.getState().openBlocker(null);
  const tasks = useStore((s) => s.tasks);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const blockTask = useStore((s) => s.blockTask);

  const open = taskId !== null;
  const current = tasks.find((x) => x.id === taskId);
  const b = current?.blocker && !current.blocker.resolvedOn ? current.blocker : null;
  const [selected, setSelected] = useState(taskId || "");
  const [reason, setReason] = useState(b?.reason ?? "");
  const [waitingOn, setWaitingOn] = useState(b?.waitingOn ?? "");
  const [action, setAction] = useState(b?.requiredAction ?? "");
  const [blockedOn, setBlockedOn] = useState(b?.blockedOn ?? today());
  const [error, setError] = useState<string | null>(null);

  const task = tasks.find((t) => t.id === (taskId || selected));
  const candidates = tasks.filter((t) => t.sprintId === activeSprintId && t.status !== "completed");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = taskId || selected;
    if (!id) return setError("Choose a task.");
    if (!reason.trim()) return setError("Add a reason for blocking.");
    blockTask(id, {
      reason: reason.trim(),
      waitingOn: waitingOn.trim(),
      requiredAction: action.trim(),
      blockedOn,
    });
    close();
  }

  return (
    <GlassDialog
      open={open}
      onOpenChange={(v) => !v && close()}
      title={task?.status === "blocked" ? "Edit blocker" : "Add blocker"}
      description={task ? `#${task.code} · ${task.title}` : "Flag a task that can't move forward."}
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-st-blocked">{error}</p>}
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" type="submit" form="blocker-form">
            {task?.status === "blocked" ? "Save blocker" : "Mark as blocked"}
          </Button>
        </>
      }
    >
      <form id="blocker-form" onSubmit={submit} className="grid gap-4 pb-2 sm:grid-cols-2">
        {!taskId && (
          <Field label="Task" className="sm:col-span-2">
            <select className="field" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a task…</option>
              {candidates.map((t) => (
                <option key={t.id} value={t.id}>#{t.code} {t.title}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Reason for blocking" className="sm:col-span-2">
          <textarea className="field min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
        <Field label="Waiting for clarification from">
          <input className="field" value={waitingOn} onChange={(e) => setWaitingOn(e.target.value)} placeholder="e.g. Business analyst" />
        </Field>
        <Field label="Date blocked">
          <input className="field" type="date" value={blockedOn} onChange={(e) => setBlockedOn(e.target.value)} />
        </Field>
        <Field label="Required action" className="sm:col-span-2">
          <input className="field" value={action} onChange={(e) => setAction(e.target.value)} placeholder="What unblocks this?" />
        </Field>
      </form>
    </GlassDialog>
  );
}
