"use client";

import { AlertTriangle, CalendarRange, CheckCircle2, Clock, Flag, Hourglass, Timer } from "lucide-react";
import { actualDays, useActiveSprint, useSprintTasks } from "@/lib/store";
import { useUI } from "@/lib/ui-store";
import { isLate, isOverdue, remainingEffort, sprintMetrics } from "@/lib/metrics";
import { STATUS_META } from "@/lib/meta";
import { cn, daysDiff, fmtDate, fmtDays, isWeekend, parseDate, today, addDays } from "@/lib/utils";
import { CardHeader, EmptyState, GlassCard, PageHeader, Progress } from "@/components/ui/glass";

export default function TimelinePage() {
  const sprint = useActiveSprint();
  const tasks = useSprintTasks();
  const openDetail = useUI((s) => s.openDetail);
  const m = sprintMetrics(tasks, sprint);
  const t0 = today();

  if (!sprint) return null;

  // Visible range: sprint range, widened to include any task dates outside it.
  const dates = tasks.flatMap((t) => [t.startDate, t.targetDate, t.completedDate].filter(Boolean) as string[]);
  const rangeStart = [sprint.startDate, ...dates].sort()[0];
  const rangeEnd = [sprint.endDate, ...dates].sort().at(-1)!;
  const days: string[] = [];
  for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) days.push(d);
  const col = (d: string) => days.indexOf(d);
  const todayIdx = col(t0);

  const rows = [...tasks].sort(
    (a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") || a.code.localeCompare(b.code),
  );

  const effortDone = m.estimateDone;
  const effortTotal = m.estimateTotal || 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timeline"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-4" /> {sprint.name}: {fmtDate(sprint.startDate, { weekday: "short", month: "short", day: "numeric" })} → {fmtDate(sprint.endDate, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: Hourglass, label: "Estimated remaining", value: fmtDays(m.remaining), color: "var(--st-retest)", p: 1 - m.remaining / effortTotal },
          { icon: Timer, label: "Actual time spent", value: fmtDays(m.actualTotal), color: "var(--series-2)", p: m.actualTotal / effortTotal },
          { icon: CheckCircle2, label: "Completed work", value: fmtDays(effortDone), color: "var(--st-done)", p: effortDone / effortTotal },
          { icon: Clock, label: "Remaining work", value: `${m.pending} tasks`, color: "var(--st-progress)", p: m.total ? m.pending / m.total : 0 },
        ].map((c) => (
          <GlassCard key={c.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-fg-2">
              <c.icon className="size-4" style={{ color: c.color }} /> {c.label}
            </div>
            <p className="my-2 text-2xl font-semibold tracking-tight">{c.value}</p>
            <Progress value={c.p} color={c.color} label={c.label} />
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5">
        <CardHeader
          title="Sprint timeline"
          subtitle={`${m.sprintDays} working days · ${m.sprintDaysLeft} left`}
          icon={CalendarRange}
          action={
            <div className="hidden flex-wrap items-center gap-3 text-[11px] text-fg-3 sm:flex">
              <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full accent-gradient" /> Planned</span>
              <span className="flex items-center gap-1"><Flag className="size-3 text-st-done" /> Completed</span>
              <span className="flex items-center gap-1"><AlertTriangle className="size-3 text-warn" /> Delayed</span>
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No tasks in this sprint" />
        ) : (
          <div className="scroll-thin mt-5 overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Day header */}
              <div className="grid items-end" style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(34px, 1fr))` }}>
                <div />
                {days.map((d) => {
                  const dt = parseDate(d);
                  const inSprint = d >= sprint.startDate && d <= sprint.endDate;
                  return (
                    <div
                      key={d}
                      className={cn(
                        "pb-2 text-center text-[10px] leading-tight",
                        isWeekend(d) ? "text-fg-3/50" : "text-fg-3",
                        d === t0 && "font-bold text-accent",
                        !inSprint && "italic",
                      )}
                    >
                      {dt.toLocaleDateString(undefined, { weekday: "narrow" })}
                      <br />
                      {dt.getDate()}
                    </div>
                  );
                })}
              </div>

              <div className="relative">
                {/* grid background */}
                <div
                  className="pointer-events-none absolute inset-0 grid"
                  style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(34px, 1fr))` }}
                  aria-hidden
                >
                  <div />
                  {days.map((d) => (
                    <div
                      key={d}
                      className={cn(
                        "border-l border-line",
                        isWeekend(d) && "bg-[var(--glass-line)]/40",
                        (d < sprint.startDate || d > sprint.endDate) && "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--glass-line)_4px,var(--glass-line)_5px)]",
                      )}
                    />
                  ))}
                </div>

                {rows.map((t) => {
                  const s = t.startDate ?? t.targetDate;
                  const e = t.targetDate ?? t.startDate;
                  const overdue = isOverdue(t);
                  const late = isLate(t);
                  const color = STATUS_META[t.status].color;
                  const spent = actualDays(t);
                  return (
                    <div
                      key={t.id}
                      className="relative grid h-12 items-center"
                      style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(34px, 1fr))` }}
                    >
                      <button onClick={() => openDetail(t.id)} className="flex min-w-0 items-center gap-2 pr-3 text-left">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium hover:underline">
                            <span className="font-mono text-xs text-fg-3">#{t.code}</span> {t.title}
                          </span>
                          <span className="block text-[10px] text-fg-3">
                            {t.estimateDays}d est · {spent}d actual
                          </span>
                        </span>
                      </button>
                      {s && e && (
                        <button
                          onClick={() => openDetail(t.id)}
                          className={cn(
                            "relative z-[1] mx-0.5 flex h-7 items-center overflow-hidden rounded-full px-2 text-[10px] font-semibold text-white shadow-sm transition hover:brightness-110",
                            t.status === "completed" && "opacity-75",
                          )}
                          style={{
                            gridColumn: `${col(s) + 2} / ${col(e) + 3}`,
                            gridRow: 1,
                            background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, var(--accent-2)))`,
                          }}
                          title={`${fmtDate(s)} → ${fmtDate(e)} · ${STATUS_META[t.status].label}`}
                        >
                          {/* actual progress overlay */}
                          {t.estimateDays > 0 && spent > 0 && (
                            <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${Math.min(100, (spent / t.estimateDays) * 100)}%` }} />
                          )}
                          <span className="relative truncate">{STATUS_META[t.status].label}</span>
                        </button>
                      )}
                      {/* Delay extension: from target to today (or completion) */}
                      {e && (overdue || late) && (
                        <div
                          className="relative z-0 mx-0.5 h-7 rounded-r-full border border-dashed border-warn bg-warn/15"
                          style={{
                            gridColumn: `${col(e) + 3} / ${col(late ? t.completedDate! : t0) + 3}`,
                            gridRow: 1,
                          }}
                          title={`Delayed ${daysDiff(e, late ? t.completedDate! : t0)}d`}
                        >
                          <AlertTriangle className="absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-warn" />
                        </div>
                      )}
                      {t.completedDate && col(t.completedDate) >= 0 && (
                        <Flag
                          className="relative z-[2] size-4 justify-self-center text-st-done drop-shadow"
                          style={{ gridColumn: col(t.completedDate) + 2, gridRow: 1 }}
                          aria-label={`Completed ${fmtDate(t.completedDate)}`}
                        />
                      )}
                    </div>
                  );
                })}

                {/* today line */}
                {todayIdx >= 0 && (
                  <div
                    className="pointer-events-none absolute inset-y-0 grid w-full"
                    style={{ gridTemplateColumns: `220px repeat(${days.length}, minmax(34px, 1fr))` }}
                    aria-hidden
                  >
                    <div className="relative" style={{ gridColumn: todayIdx + 2 }}>
                      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-accent/70" />
                      <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1.5 text-[9px] font-bold text-white">
                        Today
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <CardHeader title="Estimated vs. actual by task" subtitle="Bars over 100% mean the task took longer than planned" icon={Timer} />
        <ul className="mt-4 space-y-3">
          {rows.map((t) => {
            const spent = actualDays(t);
            const ratio = t.estimateDays ? spent / t.estimateDays : 0;
            return (
              <li key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr_150px]">
                <button onClick={() => openDetail(t.id)} className="truncate text-left text-sm hover:underline">
                  <span className="font-mono text-xs text-fg-3">#{t.code}</span> {t.title}
                </button>
                <span className="text-right text-xs tabular-nums text-fg-2 sm:order-last">
                  {spent}d / {t.estimateDays}d · {fmtDays(remainingEffort(t))} left
                </span>
                <div className="col-span-2 sm:col-span-1">
                  <Progress value={Math.min(1, ratio)} color={ratio > 1 ? "var(--warn)" : t.status === "completed" ? "var(--st-done)" : undefined} label={`${t.code} progress`} />
                </div>
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </div>
  );
}
