"use client";

import { useState } from "react";
import { actualDays, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { STATUS_META } from "@/lib/meta";
import { STATUSES, type Status } from "@/lib/types";
import { fmtDays, today } from "@/lib/utils";
import { GlassDialog } from "@/components/ui/dialog";
import { Button, Field, Progress } from "@/components/ui/glass";

/** Log time spent on a task and optionally move it forward. */
export function ProgressDialog() {
  const session = useUI((s) => s.session);
  return <ProgressDialogInner key={session} />;
}

function ProgressDialogInner() {
  const { open, taskId } = useUI((s) => s.progressFor);
  const close = useUI((s) => s.closeProgress);
  const openBlocker = useUI((s) => s.openBlocker);
  const tasks = useStore((s) => s.tasks);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const logTime = useStore((s) => s.logTime);
  const setStatus = useStore((s) => s.setStatus);

  const candidates = tasks.filter((t) => t.sprintId === activeSprintId);
  const [selected, setSelected] = useState(
    () =>
      taskId ||
      candidates.find((t) => t.status === "in_progress")?.id ||
      candidates.find((t) => t.status !== "completed")?.id ||
      "",
  );
  const [days, setDays] = useState("0.5");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [status, setStatusVal] = useState<Status | "">("");
  const [error, setError] = useState<string | null>(null);
  const task = tasks.find((t) => t.id === selected);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return setError("Choose a task.");
    const d = Number(days);
    if (!Number.isFinite(d) || d < 0) return setError("Enter time spent in days.");
    if (d === 0 && !status) return setError("Log some time or change the status.");
    if (d > 0) logTime(task.id, d, date, note.trim());
    if (status && status !== task.status) {
      if (status === "blocked") {
        close();
        openBlocker(task.id);
        return;
      }
      setStatus(task.id, status);
    }
    close();
  }

  const spent = task ? actualDays(task) : 0;

  return (
    <GlassDialog
      open={open}
      onOpenChange={(v) => !v && close()}
      title="Update progress"
      description="Log time spent and move the task forward."
      footer={
        <>
          {error && <p className="mr-auto text-xs font-medium text-st-blocked">{error}</p>}
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" type="submit" form="progress-form">Save progress</Button>
        </>
      }
    >
      <form id="progress-form" onSubmit={submit} className="grid gap-4 pb-2 sm:grid-cols-2">
        <Field label="Task" className="sm:col-span-2">
          <select className="field" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select a task…</option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>#{t.code} {t.title} — {STATUS_META[t.status].label}</option>
            ))}
          </select>
        </Field>
        {task && (
          <div className="glass-soft rounded-2xl p-3 sm:col-span-2">
            <div className="mb-2 flex justify-between text-xs text-fg-2">
              <span>Spent {fmtDays(spent)}</span>
              <span>Estimate {fmtDays(task.estimateDays)}</span>
            </div>
            <Progress
              value={task.estimateDays ? spent / task.estimateDays : 0}
              color={spent > task.estimateDays ? "var(--warn)" : undefined}
              label="Time spent vs estimate"
            />
          </div>
        )}
        <Field label="Time spent (days)" hint="0.125 ≈ 1 hour">
          <input className="field" type="number" min="0" step="0.125" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label="Date">
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Move to status" className="sm:col-span-2">
          <select className="field" value={status} onChange={(e) => setStatusVal(e.target.value as Status | "")}>
            <option value="">Keep current status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Note" className="sm:col-span-2">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you do?" />
        </Field>
      </form>
    </GlassDialog>
  );
}
