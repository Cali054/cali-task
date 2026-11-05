"use client";

import { useState } from "react";
import { AlertTriangle, CalendarDays, Clock, Link2, Pencil, Trash2, Ban, Timer } from "lucide-react";
import { actualDays, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useChangeStatus } from "@/lib/use-change-status";
import { STATUS_META } from "@/lib/meta";
import { STATUSES, type Status } from "@/lib/types";
import { isOverdue } from "@/lib/metrics";
import { daysDiff, fmtDate, fmtDateTime, fmtDays, today } from "@/lib/utils";
import { ConfirmDialog, GlassDialog } from "@/components/ui/dialog";
import { Button, PriorityBadge, Progress, StatusBadge } from "@/components/ui/glass";

export function TaskDetailDialog() {
  const id = useUI((s) => s.detailId);
  const { openDetail, openEditTask, openProgress, openBlocker } = useUI.getState();
  const task = useStore((s) => s.tasks.find((t) => t.id === id));
  const tasks = useStore((s) => s.tasks);
  const sprints = useStore((s) => s.sprints);
  const deleteTask = useStore((s) => s.deleteTask);
  const removeTimeLog = useStore((s) => s.removeTimeLog);
  const addBlockerUpdate = useStore((s) => s.addBlockerUpdate);
  const changeStatus = useChangeStatus();
  const [confirm, setConfirm] = useState(false);
  const [update, setUpdate] = useState("");

  if (!task) return null;
  const spent = actualDays(task);
  const sprint = sprints.find((s) => s.id === task.sprintId);
  const deps = task.dependencies.map((d) => tasks.find((t) => t.id === d)).filter(Boolean);
  const openDeps = deps.filter((d) => d!.status !== "completed");
  const dependents = tasks.filter((t) => t.dependencies.includes(task.id));
  const overdue = isOverdue(task);

  return (
    <>
      <GlassDialog
        open={!!id}
        onOpenChange={(v) => !v && openDetail(null)}
        title={
          <span className="flex items-center gap-2">
            <span className="font-mono text-fg-3">#{task.code}</span> {task.title}
          </span>
        }
        description={`${sprint?.name ?? "No sprint"} · updated ${fmtDateTime(task.updatedAt)}`}
        className="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" className="mr-auto text-st-blocked" onClick={() => setConfirm(true)}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <Button onClick={() => openProgress(task.id)}>
              <Timer className="size-4" /> Log time
            </Button>
            <Button variant="primary" onClick={() => openEditTask(task.id)}>
              <Pencil className="size-4" /> Edit
            </Button>
          </>
        }
      >
        <div className="space-y-5 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-1 text-[11px] font-semibold text-warn">
                <AlertTriangle className="size-3" /> Overdue {daysDiff(task.targetDate!, today())}d
              </span>
            )}
            <label className="ml-auto flex items-center gap-2 text-xs text-fg-2">
              Status
              <select
                className="field w-auto py-1.5 text-xs"
                value={task.status}
                onChange={(e) => changeStatus(task.id, e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </label>
          </div>

          {task.description && <p className="whitespace-pre-wrap text-sm text-fg-2">{task.description}</p>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Start", fmtDate(task.startDate)],
              ["Target", fmtDate(task.targetDate)],
              ["Completed", fmtDate(task.completedDate)],
              ["Created", fmtDate(task.createdAt.slice(0, 10))],
            ].map(([k, v]) => (
              <div key={k} className="glass-soft rounded-2xl px-3 py-2.5">
                <p className="flex items-center gap-1 text-[11px] text-fg-3"><CalendarDays className="size-3" />{k}</p>
                <p className="text-sm font-medium">{v}</p>
              </div>
            ))}
          </div>

          <div className="glass-soft rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium"><Clock className="size-3.5" /> Time tracking</span>
              <span className="text-fg-2">
                {fmtDays(spent)} actual / {fmtDays(task.estimateDays)} estimated
              </span>
            </div>
            <Progress
              value={task.estimateDays ? spent / task.estimateDays : 0}
              color={spent > task.estimateDays ? "var(--warn)" : undefined}
              label="Actual vs estimated"
            />
            {task.timeLogs.length > 0 && (
              <ul className="mt-3 space-y-1">
                {task.timeLogs.map((l) => (
                  <li key={l.id} className="group flex items-center gap-3 text-xs text-fg-2">
                    <span className="w-14 shrink-0 text-fg-3">{fmtDate(l.date)}</span>
                    <span className="w-14 shrink-0 font-medium text-fg">{l.days}d</span>
                    <span className="truncate">{l.note || "—"}</span>
                    <button
                      className="ml-auto opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:text-st-blocked"
                      onClick={() => removeTimeLog(task.id, l.id)}
                      aria-label="Remove time entry"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {task.blocker && (
            <div className={`rounded-2xl border p-4 ${task.blocker.resolvedOn ? "border-line" : "border-st-blocked/30 bg-st-blocked/5"}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: task.blocker.resolvedOn ? "var(--fg-2)" : "var(--st-blocked)" }}>
                  <Ban className="size-3.5" />
                  {task.blocker.resolvedOn ? `Blocker resolved ${fmtDate(task.blocker.resolvedOn)}` : `Blocked since ${fmtDate(task.blocker.blockedOn)}`}
                </p>
                {!task.blocker.resolvedOn && (
                  <Button size="sm" variant="ghost" onClick={() => openBlocker(task.id)}>Edit blocker</Button>
                )}
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2"><dt className="text-[11px] text-fg-3">Reason</dt><dd>{task.blocker.reason}</dd></div>
                <div><dt className="text-[11px] text-fg-3">Waiting on</dt><dd>{task.blocker.waitingOn || "—"}</dd></div>
                <div><dt className="text-[11px] text-fg-3">Required action</dt><dd>{task.blocker.requiredAction || "—"}</dd></div>
              </dl>
              {task.blocker.updates.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {task.blocker.updates.map((u) => (
                    <li key={u.id} className="text-xs"><span className="text-fg-3">{fmtDateTime(u.at)} · </span>{u.text}</li>
                  ))}
                </ul>
              )}
              {!task.blocker.resolvedOn && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!update.trim()) return;
                    addBlockerUpdate(task.id, update.trim());
                    setUpdate("");
                  }}
                >
                  <input className="field py-1.5 text-xs" value={update} onChange={(e) => setUpdate(e.target.value)} placeholder="Add an update…" />
                  <Button size="sm" type="submit">Add</Button>
                </form>
              )}
            </div>
          )}

          {(deps.length > 0 || dependents.length > 0) && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium"><Link2 className="size-3.5" /> Dependencies</p>
              {openDeps.length > 0 && (
                <p className="text-xs text-warn">Waiting on {openDeps.length} unfinished {openDeps.length === 1 ? "task" : "tasks"}.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {deps.map((d) => (
                  <button key={d!.id} onClick={() => openDetail(d!.id)} className="glass-soft glass-hover rounded-full px-3 py-1 text-xs">
                    Depends on <span className="font-mono">#{d!.code}</span> · {STATUS_META[d!.status].label}
                  </button>
                ))}
                {dependents.map((d) => (
                  <button key={d.id} onClick={() => openDetail(d.id)} className="glass-soft glass-hover rounded-full px-3 py-1 text-xs">
                    Blocks <span className="font-mono">#{d.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {task.notes && (
            <div>
              <p className="mb-1 text-xs font-medium">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-fg-2">{task.notes}</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-medium">History</p>
            <ul className="space-y-1 text-xs text-fg-2">
              {[...task.history].reverse().map((h, i) => (
                <li key={i}>
                  <span className="text-fg-3">{fmtDateTime(h.at)} · </span>
                  {h.from ? `${STATUS_META[h.from].label} → ${STATUS_META[h.to].label}` : `Created as ${STATUS_META[h.to].label}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GlassDialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Delete task?"
        text={<>Task <b>#{task.code}</b> “{task.title}” and its time logs will be permanently removed.</>}
        onConfirm={() => {
          openDetail(null);
          deleteTask(task.id);
        }}
      />
    </>
  );
}
