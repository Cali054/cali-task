"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "motion/react";
import { GripVertical, Plus } from "lucide-react";
import { useActiveSprint, useSprintTasks } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useChangeStatus } from "@/lib/use-change-status";
import { PRIORITY_META, STATUS_META } from "@/lib/meta";
import { STATUSES, type Status, type Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, PageHeader, PriorityBadge } from "@/components/ui/glass";
import { TaskFlags } from "@/components/tasks/task-bits";

function CardBody({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "glass rounded-[18px] p-3.5 transition-shadow",
        task.status === "blocked" && "ring-1 ring-st-blocked/40",
        dragging && "rotate-[2deg] shadow-[0_24px_48px_-12px_rgba(60,70,160,0.45)]",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold text-fg-3">#{task.code}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <p className="mb-2 text-sm font-medium leading-snug">{task.title}</p>
      {task.status === "blocked" && task.blocker?.reason && (
        <p className="mb-2 line-clamp-2 rounded-lg bg-st-blocked/8 px-2 py-1 text-[11px] text-st-blocked">{task.blocker.reason}</p>
      )}
      <TaskFlags task={task} compact />
    </div>
  );
}

function DraggableCard({ task }: { task: Task }) {
  const openDetail = useUI((s) => s.openDetail);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, data: { status: task.status } });
  return (
    <motion.div
      layout
      layoutId={task.id}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => openDetail(task.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") openDetail(task.id);
      }}
      aria-label={`#${task.code} ${task.title}. Press space to pick up, Enter to open.`}
      className={cn(
        "group relative cursor-grab touch-none rounded-[18px] outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing",
        isDragging && "opacity-30",
      )}
    >
      <GripVertical className="absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3 opacity-0 transition group-hover:opacity-60" />
      <CardBody task={task} />
    </motion.div>
  );
}

function Column({ status, tasks }: { status: Status; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const openNewTask = useUI((s) => s.openNewTask);
  const m = STATUS_META[status];
  const Icon = m.icon;
  const effort = tasks.reduce((a, t) => a + t.estimateDays, 0);
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "glass-soft flex w-[280px] shrink-0 flex-col rounded-[24px] p-3 transition-colors duration-200 2xl:w-auto 2xl:min-w-0",
        isOver && "bg-[var(--glass-hover)] ring-2",
      )}
      style={isOver ? ({ "--tw-ring-color": m.color } as React.CSSProperties) : undefined}
      aria-label={`${m.label} column`}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className="grid size-7 place-items-center rounded-lg" style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 15%, transparent)` }}>
          <Icon className="size-3.5" />
        </span>
        <h2 className="text-sm font-semibold">{m.label}</h2>
        <span className="rounded-full bg-[var(--glass-line)] px-2 text-[11px] font-semibold text-fg-2">{tasks.length}</span>
        <span className="ml-auto text-[11px] text-fg-3">{effort}d</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2.5">
        {tasks.map((t) => <DraggableCard key={t.id} task={t} />)}
        {tasks.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-[18px] border border-dashed border-line py-6 text-xs text-fg-3">
            Drop tasks here
          </div>
        )}
      </div>
      {status !== "blocked" && (
        <button
          onClick={() => openNewTask(status)}
          className="mt-2.5 flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-fg-3 transition hover:bg-[var(--glass-soft)] hover:text-fg"
        >
          <Plus className="size-3.5" /> Add task
        </button>
      )}
    </section>
  );
}

export default function BoardPage() {
  const sprint = useActiveSprint();
  const tasks = useSprintTasks();
  const changeStatus = useChangeStatus();
  const openNewTask = useUI((s) => s.openNewTask);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = (s: Status) =>
    tasks
      .filter((t) => t.status === s)
      .sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank || a.code.localeCompare(b.code));

  const active = tasks.find((t) => t.id === activeId);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const to = e.over?.id as Status | undefined;
    const id = String(e.active.id);
    const from = tasks.find((t) => t.id === id)?.status;
    if (to && from && to !== from) changeStatus(id, to);
  }

  return (
    <div>
      <PageHeader
        title="Sprint Board"
        subtitle={`${sprint?.name} · drag cards between columns to update their status`}
        actions={<Button variant="primary" onClick={() => openNewTask()}><Plus className="size-4" /> New task</Button>}
      />
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="scroll-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-3 2xl:grid 2xl:grid-cols-6 2xl:overflow-visible">
          {STATUSES.map((s) => <Column key={s} status={s} tasks={byStatus(s)} />)}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
          {active ? <CardBody task={active} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
