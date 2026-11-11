"use client";

import type { ReactNode } from "react";
import {
  Activity as ActivityIcon,
  Ban,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock,
  GanttChartSquare,
  Gauge,
  Hourglass,
  KanbanSquare,
  LayoutDashboard,
  Layers,
  ListTodo,
  Loader,
  Search,
  Settings,
  TrendingUp,
} from "lucide-react";
import { STATUS_META } from "@/lib/meta";
import { STATUSES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CaliLogoIcon } from "@/components/brand/cali-logo";
import { GlassCard, PriorityBadge, Progress, StatusBadge } from "@/components/ui/glass";
import { BurndownChart, CompletionsChart, EstimateVsActualChart, Ring } from "@/components/charts";
import {
  PREVIEW_ACTIVITY,
  PREVIEW_BURNDOWN,
  PREVIEW_COMPLETIONS,
  PREVIEW_ESTIMATES,
  PREVIEW_METRICS as M,
  PREVIEW_SPRINT,
  PREVIEW_TASKS,
} from "./preview-data";

/*
 * Visual previews of the real app, built from the same primitives the
 * dashboard uses (GlassCard, Progress, StatusBadge, Ring, the Recharts charts)
 * so the landing page always looks like the product. They are inert pictures:
 * nothing inside can be focused or clicked.
 */

const RAIL = [LayoutDashboard, ListTodo, KanbanSquare, GanttChartSquare, Ban, BarChart3, Settings];

/** App window: slim sidebar rail + top bar, like the dashboard shell. */
export function PreviewFrame({
  label,
  active = 0,
  title,
  children,
  className,
}: {
  label: string;
  active?: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={cn("glass-strong overflow-hidden rounded-[28px] p-2 sm:p-3", className)}>
      <div inert className="flex gap-3 select-none">
        <div className="glass hidden w-14 shrink-0 flex-col items-center gap-2 rounded-[22px] py-3 sm:flex">
          <CaliLogoIcon size={26} />
          <div className="mt-2 flex flex-col gap-1.5">
            {RAIL.map((Icon, i) => (
              <span
                key={i}
                className={cn(
                  "grid size-9 place-items-center rounded-xl",
                  i === active ? "glass text-accent" : "text-fg-3",
                )}
              >
                <Icon className="size-4" />
              </span>
            ))}
          </div>
        </div>
        <div className="glass-soft min-w-0 flex-1 rounded-[22px] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-fg-3">Welcome back, Cali</p>
              <p className="truncate text-sm font-semibold tracking-tight">{title}</p>
            </div>
            <div className="glass-soft hidden h-8 w-44 items-center gap-2 rounded-xl px-3 text-[11px] text-fg-3 md:flex">
              <Search className="size-3.5" /> Search tasks…
            </div>
            <span className="accent-gradient grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-on-accent">
              C
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  progress,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  progress: number;
  color: string;
}) {
  return (
    <div className="glass rounded-[18px] p-3">
      <span
        className="grid size-7 place-items-center rounded-xl"
        style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <Icon className="size-3.5" />
      </span>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mb-2 truncate text-[11px] text-fg-2">{label}</p>
      <Progress value={progress} color={color} className="h-1.5" />
    </div>
  );
}

export const PREVIEW_STATS = [
  { icon: Layers, label: "Total Tasks", value: M.total, progress: 1, color: "var(--accent)" },
  { icon: CheckCircle2, label: "Completed", value: M.completed, progress: M.completed / M.total, color: "var(--st-done)" },
  { icon: Loader, label: "In Progress", value: M.inProgress + M.inReview, progress: (M.inProgress + M.inReview) / M.total, color: "var(--st-progress)" },
  { icon: Ban, label: "Blocked", value: M.blocked, progress: M.blocked / M.total, color: "var(--st-blocked)" },
  { icon: Hourglass, label: "Est. Remaining", value: `${M.remaining}d`, progress: 1 - M.remaining / M.estimateTotal, color: "var(--st-retest)" },
  { icon: Gauge, label: "Completion", value: `${Math.round(M.completionRate * 100)}%`, progress: M.completionRate, color: "var(--st-testing)" },
];

export function SprintHeroCard({ compact }: { compact?: boolean }) {
  return (
    <GlassCard className="relative overflow-hidden p-4">
      <div className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-[radial-gradient(circle,var(--orb-b),transparent_70%)] blur-2xl" />
      <div className="relative flex items-center gap-4">
        <Ring value={M.completionRate} size={compact ? 76 : 96} stroke={compact ? 8 : 9} label="complete" />
        <div className="min-w-0 flex-1">
          <span className="glass-soft rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            Active sprint
          </span>
          <p className="mt-1.5 text-lg font-semibold tracking-tight">{PREVIEW_SPRINT.name}</p>
          {!compact && <p className="truncate text-xs text-fg-2">{PREVIEW_SPRINT.goal}</p>}
          <p className="mt-2 flex items-center gap-1.5 truncate text-[11px] text-fg-3">
            <CalendarRange className="size-3 shrink-0" /> {PREVIEW_SPRINT.range} · {PREVIEW_SPRINT.daysLeft} days left
          </p>
          <Progress value={M.completionRate} className="mt-2 h-1.5" />
        </div>
      </div>
    </GlassCard>
  );
}

export function ActivityList({ items = PREVIEW_ACTIVITY.length }: { items?: number }) {
  return (
    <ul className="space-y-2.5">
      {PREVIEW_ACTIVITY.slice(0, items).map((a) => (
        <li key={a.text} className="flex items-start gap-2.5 text-xs">
          <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: a.color }} />
          <span className="min-w-0 flex-1 truncate text-fg-2">{a.text}</span>
          <span className="shrink-0 text-[10px] text-fg-3">{a.when}</span>
        </li>
      ))}
    </ul>
  );
}

function PanelTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold">
      <span className="glass-soft grid size-6 place-items-center rounded-lg text-accent">
        <Icon className="size-3.5" />
      </span>
      {children}
    </p>
  );
}

/** Overview page: sprint summary, six stat cards, completion chart, recent activity. */
export function DashboardPreview() {
  return (
    <div className="space-y-3">
      <SprintHeroCard />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {PREVIEW_STATS.map((s) => (
          <MiniStat key={s.label} {...s} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="p-3">
          <PanelTitle icon={TrendingUp}>Task completion</PanelTitle>
          <CompletionsChart data={PREVIEW_COMPLETIONS} height={150} />
        </GlassCard>
        <GlassCard className="p-3">
          <PanelTitle icon={ActivityIcon}>Recent activity</PanelTitle>
          <ActivityList />
        </GlassCard>
      </div>
    </div>
  );
}

/** Sprint board: the six status columns with task cards. */
export function BoardPreview() {
  return (
    <div className="scroll-thin -mx-1 flex gap-2.5 overflow-hidden px-1 pb-1">
      {STATUSES.map((s) => {
        const meta = STATUS_META[s];
        const items = PREVIEW_TASKS.filter((t) => t.status === s);
        return (
          <div key={s} className="glass min-w-[150px] flex-1 rounded-[18px] p-2">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold">
              <span className="size-2 rounded-full" style={{ background: meta.color }} />
              {meta.label}
              <span className="ml-auto text-fg-3">{items.length}</span>
            </p>
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.code} className="glass-soft rounded-xl p-2.5">
                  <p className="font-mono text-[10px] text-fg-3">#{t.code}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug">{t.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <PriorityBadge priority={t.priority} className="text-[10px]" />
                    <span className="flex items-center gap-1 text-[10px] text-fg-3">
                      <Clock className="size-2.5" /> {t.estimate}d
                    </span>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-fg-3">No tasks</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Task detail dialog for the blocked task. */
export function TaskDetailPreview() {
  const t = PREVIEW_TASKS.find((x) => x.status === "blocked")!;
  return (
    <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
      <GlassCard className="p-4">
        <p className="font-mono text-xs text-fg-3">#{t.code}</p>
        <p className="mt-1 text-base font-semibold tracking-tight">{t.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Estimate", `${t.estimate}d`],
            ["Logged", `${t.actual}d`],
            ["Due", t.due],
          ].map(([k, v]) => (
            <div key={k} className="glass-soft rounded-xl p-2">
              <p className="text-[10px] text-fg-3">{k}</p>
              <p className="text-sm font-semibold">{v}</p>
            </div>
          ))}
        </div>
        <Progress value={t.actual / t.estimate} className="mt-4 h-1.5" label="Effort used" />
        <p className="mt-1.5 text-[10px] text-fg-3">25% of the estimate used</p>
      </GlassCard>
      <GlassCard className="p-4" style={{ borderColor: "color-mix(in srgb, var(--st-blocked) 35%, var(--glass-border))" }}>
        <PanelTitle icon={Ban}>Blocker</PanelTitle>
        <dl className="space-y-2 text-xs">
          {[
            ["Reason", "Expected totals differ from the incident report"],
            ["Waiting on", "Finance team"],
            ["Required action", "Confirm which budget period applies"],
            ["Blocked for", "2 days"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wider text-fg-3">{k}</dt>
              <dd className="text-fg-2">{v}</dd>
            </div>
          ))}
        </dl>
      </GlassCard>
    </div>
  );
}

/** Timeline: planned bars across the sprint's working days. */
export function TimelinePreview() {
  const cols = PREVIEW_SPRINT.days.length;
  const todayCol = 3;
  return (
    <GlassCard className="overflow-hidden p-3">
      <div className="grid gap-y-1.5" style={{ gridTemplateColumns: `minmax(92px,150px) repeat(${cols}, minmax(0,1fr))` }}>
        <span />
        {PREVIEW_SPRINT.days.map((d, i) => (
          <span key={i} className={cn("text-center text-[10px] text-fg-3", i === todayCol && "font-semibold text-accent")}>
            {d}
          </span>
        ))}
        {PREVIEW_TASKS.map((t, row) => {
          const meta = STATUS_META[t.status];
          return (
            <div key={t.code} className="contents">
              <span className="truncate pr-2 text-[11px] text-fg-2" style={{ gridColumn: 1, gridRow: row + 2 }}>
                <span className="font-mono text-fg-3">#{t.code}</span> {t.title}
              </span>
              <span
                className="relative h-6 rounded-lg"
                style={{ gridRow: row + 2, gridColumn: `${t.start + 2} / span ${t.days}`, background: `color-mix(in srgb, ${meta.color} 22%, transparent)` }}
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-lg"
                  style={{ width: `${Math.min(1, t.actual / t.estimate) * 100}%`, background: meta.color, opacity: 0.85 }}
                />
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-fg-3">
        {STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: STATUS_META[s].color }} /> {STATUS_META[s].label}
          </span>
        ))}
      </div>
    </GlassCard>
  );
}

/** Reports: burndown and estimate-vs-actual. */
export function ReportsPreview() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <GlassCard className="p-3">
        <PanelTitle icon={TrendingUp}>Burndown</PanelTitle>
        <BurndownChart data={PREVIEW_BURNDOWN} height={190} />
      </GlassCard>
      <GlassCard className="p-3">
        <PanelTitle icon={BarChart3}>Estimated vs actual</PanelTitle>
        <EstimateVsActualChart data={PREVIEW_ESTIMATES} height={190} />
      </GlassCard>
    </div>
  );
}
