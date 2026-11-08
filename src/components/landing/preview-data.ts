import type { Priority, Status } from "@/lib/types";

/**
 * Fixed showcase data for the landing page previews. It is deliberately static
 * (no dates computed from "today") so the server and client render the same
 * markup, and it never touches a visitor's real workspace.
 */
export interface PreviewTask {
  code: string;
  title: string;
  status: Status;
  priority: Priority;
  estimate: number;
  actual: number;
  start: number; // working-day index within the sprint (0-based)
  days: number; // planned duration in working days
  due: string;
}

export const PREVIEW_SPRINT = {
  name: "Sprint 2",
  goal: "Ship the retest fixes and close the accounting incidents",
  range: "Nov 9 – Nov 20",
  daysLeft: 6,
  days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Mon", "Tue", "Wed", "Thu", "Fri"],
};

export const PREVIEW_TASKS: PreviewTask[] = [
  { code: "41959", title: "Retest invoice export", status: "completed", priority: "high", estimate: 0.5, actual: 0.5, start: 0, days: 1, due: "Nov 9" },
  { code: "41971", title: "Retest payment reminders", status: "completed", priority: "high", estimate: 0.5, actual: 0.75, start: 0, days: 1, due: "Nov 10" },
  { code: "41947", title: "Ledger import validation", status: "completed", priority: "medium", estimate: 1, actual: 1, start: 1, days: 2, due: "Nov 11" },
  { code: "41965", title: "Budget variance report", status: "for_testing", priority: "medium", estimate: 1, actual: 0.75, start: 2, days: 2, due: "Nov 13" },
  { code: "42021", title: "Vendor list filters", status: "for_retest", priority: "medium", estimate: 1, actual: 1, start: 3, days: 2, due: "Nov 14" },
  { code: "42025", title: "Accounting and budget sync", status: "in_progress", priority: "high", estimate: 1, actual: 0.5, start: 4, days: 2, due: "Nov 16" },
  { code: "42030", title: "Approval history panel", status: "todo", priority: "low", estimate: 1, actual: 0, start: 6, days: 2, due: "Nov 18" },
  { code: "42027", title: "Incident 13242: awaiting clarification", status: "blocked", priority: "critical", estimate: 1, actual: 0.25, start: 5, days: 2, due: "Nov 17" },
];

const count = (s: Status) => PREVIEW_TASKS.filter((t) => t.status === s).length;
const estimateTotal = PREVIEW_TASKS.reduce((n, t) => n + t.estimate, 0);
const estimateDone = PREVIEW_TASKS.filter((t) => t.status === "completed").reduce((n, t) => n + t.estimate, 0);

export const PREVIEW_METRICS = {
  total: PREVIEW_TASKS.length,
  completed: count("completed"),
  inProgress: count("in_progress"),
  inReview: count("for_retest") + count("for_testing"),
  blocked: count("blocked"),
  todo: count("todo"),
  estimateTotal,
  estimateDone,
  remaining: estimateTotal - estimateDone,
  completionRate: estimateDone / estimateTotal,
};

/** Cumulative completed tasks per working day so far. */
export const PREVIEW_COMPLETIONS = [
  { date: "Mon", completed: 0 },
  { date: "Tue", completed: 2 },
  { date: "Wed", completed: 2 },
  { date: "Thu", completed: 3 },
];

/** Remaining effort (days) against the ideal line. */
export const PREVIEW_BURNDOWN = PREVIEW_SPRINT.days.map((d, i) => ({
  date: `${d} ${i < 5 ? "1" : "2"}`,
  ideal: Math.round((estimateTotal - (estimateTotal / 9) * i) * 100) / 100,
  remaining: i < 4 ? [7, 6, 6, 5][i] : null,
}));

export const PREVIEW_ESTIMATES = PREVIEW_TASKS.filter((t) => t.actual > 0).map((t) => ({
  label: `#${t.code}`,
  estimate: t.estimate,
  actual: t.actual,
}));

export const PREVIEW_ACTIVITY = [
  { text: "Completed #41947 Ledger import validation", when: "12m ago", color: "var(--st-done)" },
  { text: "Moved #41965 to For Testing", when: "48m ago", color: "var(--st-testing)" },
  { text: "Blocked #42027: waiting on finance team", when: "2h ago", color: "var(--st-blocked)" },
  { text: "Logged 0.5d on #42025", when: "3h ago", color: "var(--st-progress)" },
  { text: "Moved #42021 to For Retest", when: "Yesterday", color: "var(--st-retest)" },
];
