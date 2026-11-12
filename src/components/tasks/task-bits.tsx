"use client";

import { AlertTriangle, Ban, Clock, Link2 } from "lucide-react";
import { actualDays, useStore } from "@/lib/store";
import { isOverdue } from "@/lib/metrics";
import { STATUS_META } from "@/lib/meta";
import type { Task } from "@/lib/types";
import { cn, daysDiff, fmtDate, today } from "@/lib/utils";
import { PriorityBadge } from "@/components/ui/glass";

/** Small inline indicators: blocked, overdue, open dependencies, time. */
export function TaskFlags({ task, compact }: { task: Task; compact?: boolean }) {
  const tasks = useStore((s) => s.tasks);
  const openDeps = task.dependencies.filter((d) => tasks.find((t) => t.id === d && t.status !== "completed")).length;
  const overdue = isOverdue(task);
  const spent = actualDays(task);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-3">
      <span className="inline-flex items-center gap-1" title="Actual / estimated">
        <Clock className="size-3" />
        {spent > 0 ? `${spent}/` : ""}
        {task.estimateDays}d
      </span>
      {task.targetDate && !compact && <span>Due {fmtDate(task.targetDate)}</span>}
      {task.status === "blocked" && (
        <span className="inline-flex items-center gap-1 font-semibold text-st-blocked">
          <Ban className="size-3" /> Blocked
          {task.blocker && ` ${daysDiff(task.blocker.blockedOn, today())}d`}
        </span>
      )}
      {overdue && task.status !== "blocked" && (
        <span className="inline-flex items-center gap-1 font-semibold text-warn">
          <AlertTriangle className="size-3" /> Overdue
        </span>
      )}
      {(task.labels ?? []).slice(0, 3).map((l) => (
        <span key={l} className="rounded-full bg-accent/12 px-1.5 py-px text-[10px] font-semibold text-accent">
          {l}
        </span>
      ))}
      {openDeps > 0 && (
        <span className="inline-flex items-center gap-1" title="Unfinished dependencies">
          <Link2 className="size-3" /> {openDeps}
        </span>
      )}
    </div>
  );
}

/** Compact clickable task row used in lists across the app. */
export function TaskRow({ task, onClick, className }: { task: Task; onClick?: () => void; className?: string }) {
  const m = STATUS_META[task.status];
  return (
    <button
      onClick={onClick}
      className={cn(
        "glass-hover flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-[var(--glass-hover)]",
        className,
      )}
    >
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="font-mono text-xs text-fg-3">#{task.code}</span>
          <span className="truncate">{task.title}</span>
        </p>
        <TaskFlags task={task} />
      </div>
      <PriorityBadge priority={task.priority} className="hidden sm:inline-flex" />
    </button>
  );
}
