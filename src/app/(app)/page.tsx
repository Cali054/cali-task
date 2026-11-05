"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarRange,
  CheckCircle2,
  Gauge,
  Hourglass,
  KanbanSquare,
  Layers,
  Loader,
  Plus,
  Rocket,
  Scale,
  Timer,
  TrendingDown,
} from "lucide-react";
import { useActiveSprint, useSprintTasks, useStore } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { burndown, sprintMetrics } from "@/lib/metrics";
import { PRIORITY_META, STATUS_META } from "@/lib/meta";
import { STATUSES } from "@/lib/types";
import { daysDiff, fmtDate, fmtDays, relativeTime, today } from "@/lib/utils";
import { CardHeader, EmptyState, GlassCard, Progress } from "@/components/ui/glass";
import { BurndownChart, Ring } from "@/components/charts";
import { TaskRow } from "@/components/tasks/task-bits";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.45, ease: [0.2, 0.8, 0.2, 1] as const } }),
};

function StatCard({
  i,
  icon: Icon,
  label,
  value,
  sub,
  progress,
  color,
  href,
}: {
  i: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub: string;
  progress: number;
  color: string;
  href: string;
}) {
  return (
    <motion.div custom={i} variants={fadeUp} initial="hidden" animate="show">
      <Link
        href={href}
        className="glass group block h-full rounded-[24px] p-4 transition duration-300 hover:-translate-y-1 hover:bg-[var(--glass-hover)] hover:shadow-[0_20px_40px_-18px_color-mix(in_srgb,var(--accent)_45%,transparent)]"
      >
        <div className="flex items-start justify-between">
          <span
            className="grid size-10 place-items-center rounded-2xl"
            style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
          >
            <Icon className="size-5" />
          </span>
          <ArrowRight className="size-4 -translate-x-1 text-fg-3 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
        </div>
        <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        <p className="mb-3 text-xs text-fg-3">{sub}</p>
        <Progress value={progress} color={color} label={label} />
      </Link>
    </motion.div>
  );
}

export default function OverviewPage() {
  const sprint = useActiveSprint();
  const tasks = useSprintTasks();
  const activity = useStore((s) => s.activity);
  const ui = useUI();
  const m = sprintMetrics(tasks, sprint);
  const t0 = today();

  const blocked = tasks.filter((t) => t.status === "blocked");
  const upNext = tasks
    .filter((t) => t.status !== "completed" && t.status !== "blocked")
    .sort(
      (a, b) =>
        (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") ||
        PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank,
    )
    .slice(0, 5);
  const taskIds = new Set(tasks.map((t) => t.id));
  const recent = activity.filter((a) => !a.taskId || taskIds.has(a.taskId)).slice(0, 6);

  const tMin = sprint?.targetDaysMin ?? null;
  const tMax = sprint?.targetDaysMax ?? null;
  const gap = tMax !== null ? m.estimateTotal - tMax : null;

  const quick = [
    { label: "New Task", icon: Plus, onClick: () => ui.openNewTask(), primary: true },
    { label: "New Sprint", icon: Rocket, onClick: () => ui.openSprintForm() },
    { label: "Update Progress", icon: Timer, onClick: () => ui.openProgress() },
    { label: "Add Blocker", icon: Ban, onClick: () => ui.openBlocker("") },
    { label: "Sprint Board", icon: KanbanSquare, href: "/board" },
  ];

  return (
    <div className="space-y-5">
      {/* Hero: sprint summary + quick actions */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <motion.div custom={0} variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="relative h-full overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,var(--orb-b),transparent_70%)] blur-2xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="self-center"><Ring value={m.completionRate} size={132} label="complete" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="glass-soft rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    Active sprint
                  </span>
                  {m.sprintDaysLeft > 0 ? (
                    <span className="text-xs text-fg-3">{m.sprintDaysLeft} working days left</span>
                  ) : (
                    <span className="text-xs text-warn">Sprint ended</span>
                  )}
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">{sprint?.name}</h1>
                {sprint?.goal && <p className="mt-1 text-sm text-fg-2">{sprint.goal}</p>}
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-fg-2">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-3.5" />
                    {fmtDate(sprint?.startDate)} – {fmtDate(sprint?.endDate)}
                  </span>
                  <span>{fmtDays(m.estimateDone)} of {fmtDays(m.estimateTotal)} delivered</span>
                  <span>{m.completed}/{m.total} tasks done</span>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[11px] text-fg-3">
                    <span>Time elapsed</span>
                    <span>{Math.round(m.sprintElapsed * 100)}%</span>
                  </div>
                  <Progress value={m.sprintElapsed} color="var(--fg-3)" label="Sprint time elapsed" />
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="h-full p-5">
            <CardHeader title="Quick actions" subtitle="Jump straight into the work" icon={Layers} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {quick.map((q) => {
                const Icon = q.icon;
                const cls = `flex h-14 items-center gap-2.5 rounded-2xl px-3.5 text-left text-[13px] font-medium leading-tight sm:text-sm transition active:scale-[0.98] ${
                  q.primary
                    ? "accent-gradient col-span-2 justify-center text-white shadow-[0_10px_24px_-10px_var(--accent)] hover:brightness-110"
                    : "glass-soft hover:bg-[var(--glass-hover)]"
                }`;
                return q.href ? (
                  <Link key={q.label} href={q.href} className={cls}>
                    <Icon className="size-4 text-accent" /> {q.label}
                  </Link>
                ) : (
                  <button key={q.label} onClick={q.onClick} className={cls}>
                    <Icon className={`size-4 ${q.primary ? "" : "text-accent"}`} /> {q.label}
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 2xl:grid-cols-6">
        <StatCard i={2} icon={Layers} label="Total Tasks" value={m.total} sub={`${m.todo} still to start`} progress={1} color="var(--accent)" href="/tasks" />
        <StatCard i={3} icon={CheckCircle2} label="Completed" value={m.completed} sub={`${m.total ? Math.round((m.completed / m.total) * 100) : 0}% of tasks`} progress={m.total ? m.completed / m.total : 0} color="var(--st-done)" href="/tasks" />
        <StatCard i={4} icon={Loader} label="In Progress" value={m.inProgress} sub={`${m.inReview} in retest/testing`} progress={m.total ? (m.inProgress + m.inReview) / m.total : 0} color="var(--st-progress)" href="/board" />
        <StatCard i={5} icon={Ban} label="Blocked" value={m.blocked} sub={m.blocked ? "Needs clarification" : "Nothing blocked"} progress={m.total ? m.blocked / m.total : 0} color="var(--st-blocked)" href="/blocked" />
        <StatCard i={6} icon={Hourglass} label="Est. Remaining" value={<>{Math.round(m.remaining * 100) / 100}<span className="text-base font-medium text-fg-3"> d</span></>} sub={`${m.sprintDaysLeft} sprint days left`} progress={m.estimateTotal ? 1 - m.remaining / m.estimateTotal : 0} color="var(--st-retest)" href="/timeline" />
        <StatCard i={7} icon={Gauge} label="Completion Rate" value={`${Math.round(m.completionRate * 100)}%`} sub="Effort-weighted" progress={m.completionRate} color="var(--st-testing)" href="/reports" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Blocked panel */}
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show" className="xl:col-span-2">
          <GlassCard className={`h-full p-5 ${blocked.length ? "ring-1 ring-st-blocked/30" : ""}`}>
            <CardHeader
              title="Blocked tasks"
              subtitle={blocked.length ? `${blocked.length} waiting on clarification` : "Nothing is blocked right now"}
              icon={Ban}
              action={
                <Link href="/blocked" className="text-xs font-medium text-accent hover:underline">
                  Manage →
                </Link>
              }
            />
            {blocked.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All clear" text="When a task is blocked it shows up here." />
            ) : (
              <ul className="mt-4 space-y-2">
                {blocked.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => ui.openDetail(t.id)}
                      className="flex w-full flex-col gap-2 rounded-2xl border border-st-blocked/25 bg-st-blocked/5 p-4 text-left transition hover:bg-st-blocked/10 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-semibold">
                          <span className="font-mono text-xs text-fg-3">#{t.code}</span> {t.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-fg-2">{t.blocker?.reason}</p>
                        {t.blocker?.requiredAction && (
                          <p className="mt-1 text-xs"><span className="text-fg-3">Action: </span>{t.blocker.requiredAction}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-4 text-xs sm:flex-col sm:items-end sm:gap-1">
                        <span className="rounded-full bg-st-blocked px-2.5 py-1 font-semibold text-white">
                          {t.blocker ? daysDiff(t.blocker.blockedOn, t0) : 0}d blocked
                        </span>
                        <span className="text-fg-3">Waiting on {t.blocker?.waitingOn || "—"}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </motion.div>

        {/* Planning check */}
        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="h-full p-5">
            <CardHeader title="Planning check" subtitle="Committed target vs. task estimates" icon={Scale} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="glass-soft rounded-2xl p-3">
                <p className="text-[11px] text-fg-3">Committed target</p>
                <p className="text-xl font-semibold">{sprint?.targetLabel || "—"}</p>
              </div>
              <div className="glass-soft rounded-2xl p-3">
                <p className="text-[11px] text-fg-3">Sum of estimates</p>
                <p className="text-xl font-semibold">{fmtDays(m.estimateTotal)}</p>
              </div>
            </div>
            {tMax !== null && (
              <div className="mt-4 space-y-2 text-xs">
                <div>
                  <div className="mb-1 flex justify-between text-fg-3">
                    <span>Target {tMin !== tMax ? `${tMin}–${tMax}` : tMax}d</span>
                    <span>Estimates {m.estimateTotal}d</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-[var(--glass-line)]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full accent-gradient"
                      style={{ width: `${Math.min(100, (tMax / Math.max(tMax, m.estimateTotal)) * 100)}%` }}
                    />
                  </div>
                </div>
                {gap !== null && gap > 0 ? (
                  <p className="flex items-start gap-2 rounded-xl bg-warn/12 p-2.5 text-warn">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      Estimates exceed the committed target by {tMin !== null && tMin !== tMax ? `${m.estimateTotal - tMax}–${m.estimateTotal - tMin}` : gap} working days
                      {sprint?.targetLabel.includes("test") ? " — before testing time." : "."}
                    </span>
                  </p>
                ) : (
                  <p className="flex items-center gap-2 rounded-xl bg-st-done/10 p-2.5 text-st-done">
                    <CheckCircle2 className="size-3.5" /> Estimates fit within the committed target.
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 text-[11px] text-fg-3">Actual time logged so far: {fmtDays(m.actualTotal)}</p>
          </GlassCard>
        </motion.div>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <motion.div custom={10} variants={fadeUp} initial="hidden" animate="show" className="xl:col-span-2">
          <GlassCard className="h-full p-5">
            <CardHeader
              title="Sprint burndown"
              subtitle="Remaining estimated effort (days)"
              icon={TrendingDown}
              action={<Link href="/reports" className="text-xs font-medium text-accent hover:underline">Reports →</Link>}
            />
            <div className="mt-4">{sprint && <BurndownChart data={burndown(tasks, sprint)} height={240} />}</div>
          </GlassCard>
        </motion.div>
        <motion.div custom={11} variants={fadeUp} initial="hidden" animate="show">
          <GlassCard className="h-full p-5">
            <CardHeader title="Status breakdown" subtitle={`${m.total} tasks in ${sprint?.name}`} icon={Layers} />
            <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full">
              {STATUSES.map((s) => {
                const n = tasks.filter((t) => t.status === s).length;
                return n ? <div key={s} style={{ flex: n, background: STATUS_META[s].color }} title={`${STATUS_META[s].label}: ${n}`} /> : null;
              })}
            </div>
            <ul className="mt-4 space-y-2">
              {STATUSES.map((s) => {
                const n = tasks.filter((t) => t.status === s).length;
                const Icon = STATUS_META[s].icon;
                return (
                  <li key={s} className="flex items-center gap-2 text-sm">
                    <Icon className="size-4" style={{ color: STATUS_META[s].color }} />
                    <span className="flex-1 text-fg-2">{STATUS_META[s].label}</span>
                    <span className="font-semibold">{n}</span>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </motion.div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <CardHeader
            title="Up next"
            subtitle="Open tasks by target date"
            icon={ArrowRight}
            action={<Link href="/tasks" className="text-xs font-medium text-accent hover:underline">All tasks →</Link>}
          />
          <div className="mt-3 space-y-1">
            {upNext.length === 0 ? (
              tasks.length === 0 ? (
                <EmptyState
                  icon={Plus}
                  title="No tasks yet"
                  text="Add your first task to start tracking this sprint."
                  action={
                    <button
                      onClick={() => ui.openNewTask()}
                      className="accent-gradient inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white"
                    >
                      <Plus className="size-4" /> New task
                    </button>
                  }
                />
              ) : (
                <EmptyState icon={CheckCircle2} title="Nothing queued" text="Every open task is either done or blocked." />
              )
            ) : (
              upNext.map((t) => <TaskRow key={t.id} task={t} onClick={() => ui.openDetail(t.id)} />)
            )}
          </div>
        </GlassCard>
        <GlassCard className="p-5">
          <CardHeader title="Recent activity" subtitle="Latest changes in this sprint" icon={ActivityIcon} />
          <ul className="mt-4 space-y-3">
            {recent.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full accent-gradient" />
                <span className="min-w-0 flex-1 text-fg-2">
                  {a.taskId ? (
                    <button onClick={() => ui.openDetail(a.taskId!)} className="text-left hover:text-fg hover:underline">
                      {a.message}
                    </button>
                  ) : (
                    a.message
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-fg-3">{relativeTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
