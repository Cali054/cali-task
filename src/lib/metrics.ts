import type { Sprint, Task } from "./types";
import { actualDays } from "./store";
import { today, workingDaysBetween } from "./utils";

export function isOverdue(t: Task, on = today()) {
  return t.status !== "completed" && !!t.targetDate && t.targetDate < on;
}

/** Completed late = finished after its target date. */
export function isLate(t: Task) {
  return t.status === "completed" && !!t.targetDate && !!t.completedDate && t.completedDate > t.targetDate;
}

export function remainingEffort(t: Task) {
  if (t.status === "completed") return 0;
  return Math.max(0, t.estimateDays - actualDays(t));
}

export function sprintMetrics(tasks: Task[], sprint: Sprint | undefined) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const inReview = tasks.filter((t) => t.status === "for_retest" || t.status === "for_testing").length;
  const blocked = tasks.filter((t) => t.status === "blocked").length;
  const todo = tasks.filter((t) => t.status === "todo").length;

  const estimateTotal = tasks.reduce((a, t) => a + t.estimateDays, 0);
  const estimateDone = tasks.filter((t) => t.status === "completed").reduce((a, t) => a + t.estimateDays, 0);
  const actualTotal = tasks.reduce((a, t) => a + actualDays(t), 0);
  const remaining = tasks.reduce((a, t) => a + remainingEffort(t), 0);
  const overdue = tasks.filter((t) => isOverdue(t)).length;

  const completionRate = estimateTotal > 0 ? estimateDone / estimateTotal : 0;

  let sprintDays = 0;
  let sprintDaysLeft = 0;
  let sprintElapsed = 0;
  if (sprint) {
    const days = workingDaysBetween(sprint.startDate, sprint.endDate);
    sprintDays = days.length;
    const t = today();
    sprintDaysLeft = days.filter((d) => d >= t).length;
    sprintElapsed = sprintDays ? (sprintDays - sprintDaysLeft) / sprintDays : 0;
  }

  return {
    total,
    completed,
    inProgress,
    inReview,
    blocked,
    todo,
    pending: total - completed,
    estimateTotal,
    estimateDone,
    actualTotal,
    remaining,
    overdue,
    completionRate,
    sprintDays,
    sprintDaysLeft,
    sprintElapsed,
  };
}

/** Ideal vs actual remaining effort per working day of the sprint. */
export function burndown(tasks: Task[], sprint: Sprint) {
  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  const total = tasks.reduce((a, t) => a + t.estimateDays, 0);
  const t0 = today();
  const start = { date: "Start", ideal: total, remaining: sprint.startDate <= t0 ? total : null };
  return [start, ...days.map((d, i) => {
    const doneBy = tasks
      .filter((t) => t.status === "completed" && t.completedDate && t.completedDate <= d)
      .reduce((a, t) => a + t.estimateDays, 0);
    return {
      date: d,
      ideal: Math.round((total - (total * (i + 1)) / days.length) * 100) / 100,
      remaining: d <= t0 ? Math.round((total - doneBy) * 100) / 100 : null,
    };
  })];
}

export function dailyProductivity(tasks: Task[], sprint: Sprint) {
  const days = workingDaysBetween(sprint.startDate, sprint.endDate);
  return days.map((d) => ({
    date: d,
    logged: Math.round(tasks.reduce((a, t) => a + t.timeLogs.filter((l) => l.date === d).reduce((x, l) => x + l.days, 0), 0) * 100) / 100,
    completed: tasks.filter((t) => t.completedDate === d).length,
  }));
}
