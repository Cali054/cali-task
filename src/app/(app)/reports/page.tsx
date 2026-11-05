"use client";

import { useState } from "react";
import { BarChart3, Ban, CheckCircle2, Clock, Gauge, History, ListChecks, Table2, TrendingDown, CalendarDays } from "lucide-react";
import { actualDays, useActiveSprint, useSprintTasks, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { burndown, dailyProductivity, sprintMetrics } from "@/lib/metrics";
import { fmtDate, fmtDateTime, fmtDays } from "@/lib/utils";
import { CardHeader, EmptyState, GlassCard, PageHeader, StatusBadge } from "@/components/ui/glass";
import { BurndownChart, CompletionsChart, DailyChart, EstimateVsActualChart, Ring } from "@/components/charts";

function TableToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="glass-soft flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-fg-2 hover:text-fg"
      aria-pressed={on}
    >
      {on ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
      {on ? "Chart" : "Table"}
    </button>
  );
}

export default function ReportsPage() {
  const sprint = useActiveSprint();
  const tasks = useSprintTasks();
  const activity = useStore((s) => s.activity);
  const openDetail = useUI((s) => s.openDetail);
  const m = sprintMetrics(tasks, sprint);
  const [tables, setTables] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setTables((t) => ({ ...t, [k]: !t[k] }));

  if (!sprint) return null;

  const bd = burndown(tasks, sprint);
  const daily = dailyProductivity(tasks, sprint);
  const cumulative = daily.map((d, i) => ({
    date: d.date,
    completed: daily.slice(0, i + 1).reduce((a, x) => a + x.completed, 0),
  }));
  const eva = tasks.map((t) => ({ label: `#${t.code}`, estimate: t.estimateDays, actual: actualDays(t) }));
  const completedTasks = tasks
    .filter((t) => t.status === "completed")
    .sort((a, b) => (b.completedDate ?? "").localeCompare(a.completedDate ?? ""));
  const taskIds = new Set(tasks.map((t) => t.id));
  const statusHistory = activity.filter((a) => a.kind === "status" && a.taskId && taskIds.has(a.taskId)).slice(0, 12);
  const variance = m.actualTotal - tasks.filter((t) => actualDays(t) > 0).reduce((a, t) => a + t.estimateDays, 0);

  const kpis = [
    { icon: Gauge, label: "Sprint completion", value: `${Math.round(m.completionRate * 100)}%`, sub: "effort-weighted" },
    { icon: CheckCircle2, label: "Completed tasks", value: m.completed, sub: `of ${m.total}` },
    { icon: ListChecks, label: "Pending tasks", value: m.pending, sub: `${m.inProgress} in progress` },
    { icon: Ban, label: "Blocked tasks", value: m.blocked, sub: m.blocked ? "needs clarification" : "none" },
    { icon: Clock, label: "Estimated vs actual", value: `${m.actualTotal}/${m.estimateTotal}d`, sub: variance > 0 ? `+${variance}d over on started tasks` : variance < 0 ? `${variance}d under on started tasks` : "on estimate" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle={`${sprint.name} · ${fmtDate(sprint.startDate)} – ${fmtDate(sprint.endDate)}`} />

      <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
        <GlassCard className="flex items-center justify-center p-6">
          <Ring value={m.completionRate} size={156} stroke={12} label="sprint complete" />
        </GlassCard>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => (
            <GlassCard key={k.label} className="p-4">
              <k.icon className="size-5 text-accent" />
              <p className="mt-3 text-2xl font-semibold tracking-tight">{k.value}</p>
              <p className="text-xs font-medium">{k.label}</p>
              <p className="text-[11px] text-fg-3">{k.sub}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <CardHeader title="Sprint burndown" subtitle="Remaining estimated effort (days)" icon={TrendingDown} action={<TableToggle on={!!tables.bd} onToggle={() => toggle("bd")} />} />
          <div className="mt-4">
            {tables.bd ? (
              <DataTable cols={["Day", "Ideal", "Actual"]} rows={bd.map((r) => [r.date === "Start" ? "Start" : fmtDate(r.date), r.ideal, r.remaining ?? "—"])} />
            ) : (
              <BurndownChart data={bd} />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <CardHeader title="Estimated vs. actual" subtitle="Per task, in days" icon={Clock} action={<TableToggle on={!!tables.eva} onToggle={() => toggle("eva")} />} />
          <div className="mt-4">
            {tables.eva ? (
              <DataTable cols={["Task", "Estimated", "Actual"]} rows={eva.map((r) => [r.label, r.estimate, r.actual])} />
            ) : (
              <EstimateVsActualChart data={eva} height={260} />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <CardHeader title="Daily productivity" subtitle="Days of effort logged per working day" icon={CalendarDays} action={<TableToggle on={!!tables.daily} onToggle={() => toggle("daily")} />} />
          <div className="mt-4">
            {tables.daily ? (
              <DataTable cols={["Day", "Logged", "Completed"]} rows={daily.map((r) => [fmtDate(r.date), r.logged, r.completed])} />
            ) : m.actualTotal === 0 ? (
              <EmptyState icon={CalendarDays} title="No time logged yet" text="Use “Update Progress” to log time against tasks." />
            ) : (
              <DailyChart data={daily} />
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <CardHeader title="Task completion history" subtitle="Cumulative tasks completed" icon={History} action={<TableToggle on={!!tables.cum} onToggle={() => toggle("cum")} />} />
          <div className="mt-4">
            {tables.cum ? (
              <DataTable cols={["Day", "Cumulative completed"]} rows={cumulative.map((r) => [fmtDate(r.date), r.completed])} />
            ) : (
              <CompletionsChart data={cumulative} />
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <CardHeader title="Completed tasks" subtitle={`${completedTasks.length} delivered`} icon={CheckCircle2} />
          {completedTasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing completed yet" text="Move a card to Completed on the Sprint Board." />
          ) : (
            <ul className="mt-3 space-y-1">
              {completedTasks.map((t) => {
                const a = actualDays(t);
                return (
                  <li key={t.id}>
                    <button onClick={() => openDetail(t.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm hover:bg-[var(--glass-hover)]">
                      <span className="w-14 shrink-0 text-xs text-fg-3">{fmtDate(t.completedDate)}</span>
                      <span className="font-mono text-xs text-fg-3">#{t.code}</span>
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className={`text-xs tabular-nums ${a > t.estimateDays ? "text-warn" : "text-fg-2"}`}>
                        {fmtDays(a)} / {t.estimateDays}d
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
        <GlassCard className="p-5">
          <CardHeader title="Status changes" subtitle="Most recent first" icon={History} />
          {statusHistory.length === 0 ? (
            <EmptyState icon={History} title="No status changes yet" />
          ) : (
            <ul className="mt-3 space-y-2">
              {statusHistory.map((a) => {
                const t = tasks.find((x) => x.id === a.taskId);
                return (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 text-xs text-fg-3">{fmtDateTime(a.at)}</span>
                    <span className="flex-1 truncate text-fg-2">{a.message}</span>
                    {t && <StatusBadge status={t.status} className="hidden sm:inline-flex" />}
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function DataTable({ cols, rows }: { cols: string[]; rows: (string | number)[][] }) {
  return (
    <div className="scroll-thin max-h-[260px] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[var(--glass-strong)] backdrop-blur">
          <tr>
            {cols.map((c, i) => (
              <th key={c} className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-fg-3 ${i ? "text-right" : "text-left"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((v, j) => (
                <td key={j} className={`px-3 py-1.5 ${j ? "text-right tabular-nums" : ""}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
