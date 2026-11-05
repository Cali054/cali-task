"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpDown, ListTodo, Pencil, Plus, Search, Timer, Trash2 } from "lucide-react";
import { actualDays, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { useChangeStatus } from "@/lib/use-change-status";
import { PRIORITY_META, STATUS_META } from "@/lib/meta";
import { PRIORITIES, STATUSES, type Priority, type Status, type Task } from "@/lib/types";
import { isOverdue } from "@/lib/metrics";
import { fmtDate } from "@/lib/utils";
import { Button, EmptyState, GlassCard, PageHeader, PriorityBadge } from "@/components/ui/glass";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TaskFlags } from "@/components/tasks/task-bits";

type SortKey = "priority" | "deadline" | "status" | "id" | "updated";

const SORTS: Record<SortKey, { label: string; cmp: (a: Task, b: Task) => number }> = {
  priority: { label: "Priority", cmp: (a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank },
  deadline: {
    label: "Deadline",
    cmp: (a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999"),
  },
  status: { label: "Status", cmp: (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) },
  id: { label: "Task ID", cmp: (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }) },
  updated: { label: "Last updated", cmp: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
};

export default function TasksPage() {
  const tasks = useStore((s) => s.tasks);
  const sprints = useStore((s) => s.sprints);
  const activeSprintId = useStore((s) => s.activeSprintId);
  const deleteTask = useStore((s) => s.deleteTask);
  const { search, setSearch, openNewTask, openDetail, openEditTask, openProgress } = useUI();
  const changeStatus = useChangeStatus();

  const [sprintFilter, setSprintFilter] = useState<string>("active");
  const [statusFilter, setStatusFilter] = useState<Status | "all" | "open">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [sort, setSort] = useState<SortKey>("deadline");
  const [desc, setDesc] = useState(false);
  const [toDelete, setToDelete] = useState<Task | null>(null);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sid = sprintFilter === "active" ? activeSprintId : sprintFilter;
    const out = tasks.filter(
      (t) =>
        (sid === "all" || t.sprintId === sid) &&
        (statusFilter === "all" || (statusFilter === "open" ? t.status !== "completed" : t.status === statusFilter)) &&
        (priorityFilter === "all" || t.priority === priorityFilter) &&
        (!onlyOverdue || isOverdue(t)) &&
        (!q || `${t.code} ${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q)),
    );
    out.sort((a, b) => SORTS[sort].cmp(a, b) || a.code.localeCompare(b.code, undefined, { numeric: true }));
    if (desc) out.reverse();
    return out;
  }, [tasks, search, sprintFilter, activeSprintId, statusFilter, priorityFilter, onlyOverdue, sort, desc]);

  const filtersActive = search || statusFilter !== "all" || priorityFilter !== "all" || onlyOverdue || sprintFilter !== "active";

  return (
    <div>
      <PageHeader
        title="My Tasks"
        subtitle={`${list.length} ${list.length === 1 ? "task" : "tasks"} shown`}
        actions={
          <>
            <Button onClick={() => openProgress()}><Timer className="size-4" /> Log time</Button>
            <Button variant="primary" onClick={() => openNewTask()}><Plus className="size-4" /> New task</Button>
          </>
        }
      />

      <GlassCard className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="glass-soft flex h-10 min-w-48 flex-1 items-center gap-2 rounded-2xl px-3">
          <Search className="size-4 text-fg-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by ID, title, notes…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-fg-3"
            aria-label="Filter tasks"
          />
        </div>
        <select className="field h-10 w-auto py-0" value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)} aria-label="Sprint">
          <option value="active">Active sprint</option>
          <option value="all">All sprints</option>
          {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="field h-10 w-auto py-0" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="open">Open (not completed)</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select className="field h-10 w-auto py-0" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)} aria-label="Priority">
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
        <label className="glass-soft flex h-10 cursor-pointer items-center gap-2 rounded-2xl px-3 text-sm">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} className="accent-[var(--accent)]" />
          Overdue
        </label>
        <div className="flex items-center gap-1">
          <select className="field h-10 w-auto py-0" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
            {(Object.keys(SORTS) as SortKey[]).map((k) => <option key={k} value={k}>Sort: {SORTS[k].label}</option>)}
          </select>
          <Button size="icon" onClick={() => setDesc((d) => !d)} aria-label={desc ? "Sort ascending" : "Sort descending"} title="Reverse order">
            <ArrowUpDown className={`size-4 transition ${desc ? "rotate-180" : ""}`} />
          </Button>
        </div>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setPriorityFilter("all");
              setOnlyOverdue(false);
              setSprintFilter("active");
            }}
          >
            Clear
          </Button>
        )}
      </GlassCard>

      <GlassCard className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks found"
            text={filtersActive ? "Try clearing filters." : "Create your first task to get started."}
            action={<Button variant="primary" onClick={() => openNewTask()}><Plus className="size-4" /> New task</Button>}
          />
        ) : (
          <>
            {/* Table on wide screens */}
            <div className="scroll-thin hidden overflow-x-auto xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-fg-3">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-2 py-3 font-medium">Task</th>
                    <th className="px-2 py-3 font-medium">Status</th>
                    <th className="px-2 py-3 font-medium">Priority</th>
                    <th className="px-2 py-3 text-right font-medium">Est.</th>
                    <th className="px-2 py-3 text-right font-medium">Actual</th>
                    <th className="px-2 py-3 font-medium">Target</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {list.map((t) => {
                      const spent = actualDays(t);
                      return (
                        <motion.tr
                          key={t.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="group cursor-pointer border-b border-line last:border-0 hover:bg-[var(--glass-soft)]"
                          onClick={() => openDetail(t.id)}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-fg-2">#{t.code}</td>
                          <td className="max-w-[320px] px-2 py-3">
                            <p className="truncate font-medium">{t.title}</p>
                            <TaskFlags task={t} compact />
                          </td>
                          <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={t.status}
                              onChange={(e) => changeStatus(t.id, e.target.value as Status)}
                              className="cursor-pointer rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold outline-none"
                              style={{
                                color: STATUS_META[t.status].color,
                                background: `color-mix(in srgb, ${STATUS_META[t.status].color} 14%, transparent)`,
                              }}
                              aria-label={`Status of ${t.code}`}
                            >
                              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-3"><PriorityBadge priority={t.priority} /></td>
                          <td className="px-2 py-3 text-right tabular-nums">{t.estimateDays}d</td>
                          <td className={`px-2 py-3 text-right tabular-nums ${spent > t.estimateDays ? "text-warn" : ""}`}>{spent ? `${spent}d` : "—"}</td>
                          <td className={`px-2 py-3 text-xs ${isOverdue(t) ? "font-semibold text-warn" : "text-fg-2"}`}>{fmtDate(t.targetDate)}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1 opacity-60 transition group-hover:opacity-100">
                              <Button size="icon" variant="ghost" className="size-8" onClick={() => openProgress(t.id)} aria-label={`Log time on ${t.code}`}><Timer className="size-4" /></Button>
                              <Button size="icon" variant="ghost" className="size-8" onClick={() => openEditTask(t.id)} aria-label={`Edit ${t.code}`}><Pencil className="size-4" /></Button>
                              <Button size="icon" variant="ghost" className="size-8 hover:text-st-blocked" onClick={() => setToDelete(t)} aria-label={`Delete ${t.code}`}><Trash2 className="size-4" /></Button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Cards on phones, tablets and small laptops */}
            <ul className="divide-y divide-[var(--glass-line)] xl:hidden">
              {list.map((t) => (
                <li key={t.id} className="p-3">
                  <button className="w-full text-left" onClick={() => openDetail(t.id)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-fg-3">#{t.code}</span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <p className="mt-0.5 font-medium">{t.title}</p>
                    <TaskFlags task={t} />
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={t.status}
                      onChange={(e) => changeStatus(t.id, e.target.value as Status)}
                      className="field w-auto flex-1 py-1.5 text-xs"
                      aria-label={`Status of ${t.code}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                    <Button size="icon" variant="ghost" className="size-9" onClick={() => openEditTask(t.id)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-9" onClick={() => setToDelete(t)} aria-label="Delete"><Trash2 className="size-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </GlassCard>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="Delete task?"
        text={toDelete && <>Task <b>#{toDelete.code}</b> “{toDelete.title}” and its time logs will be permanently removed.</>}
        onConfirm={() => toDelete && deleteTask(toDelete.id)}
      />
    </div>
  );
}
