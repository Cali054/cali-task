export const STATUSES = [
  "todo",
  "in_progress",
  "for_retest",
  "for_testing",
  "blocked",
  "completed",
] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Dates are stored as local calendar days: "YYYY-MM-DD". Timestamps are ISO strings. */
export type DateStr = string;

export interface BlockerUpdate {
  id: string;
  at: string;
  text: string;
}

export interface Blocker {
  reason: string;
  blockedOn: DateStr;
  waitingOn: string;
  requiredAction: string;
  updates: BlockerUpdate[];
  resolvedOn?: DateStr;
}

export interface TimeLog {
  id: string;
  date: DateStr;
  days: number;
  note: string;
}

export interface StatusChange {
  at: string;
  from: Status | null;
  to: Status;
}

export interface Task {
  id: string;
  /** Human task ID, e.g. "41959". Unique across the workspace. */
  code: string;
  title: string;
  description: string;
  sprintId: string;
  estimateDays: number;
  timeLogs: TimeLog[];
  status: Status;
  priority: Priority;
  startDate: DateStr | null;
  targetDate: DateStr | null;
  completedDate: DateStr | null;
  notes: string;
  /** ids of tasks this one depends on */
  dependencies: string[];
  blocker: Blocker | null;
  history: StatusChange[];
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  startDate: DateStr;
  endDate: DateStr;
  /** Free-text committed target, e.g. "2–3 days + testing" */
  targetLabel: string;
  targetDaysMin: number | null;
  targetDaysMax: number | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  at: string;
  taskId: string | null;
  kind: "created" | "status" | "updated" | "deleted" | "time" | "blocker" | "sprint";
  message: string;
}

export interface TourSettings {
  /** Start a page's tour automatically the first time it's opened. */
  auto: boolean;
  /** Tour ids already completed or skipped. */
  seen: string[];
}

export interface Settings {
  userName: string;
  showIntro: boolean;
  /** Absent on workspaces created before tours existed (tours stay off for them). */
  tours?: TourSettings;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  sprints: Sprint[];
  activity: Activity[];
  activeSprintId: string;
  settings: Settings;
}

export type TaskInput = Omit<
  Task,
  "id" | "createdAt" | "updatedAt" | "history" | "timeLogs" | "blocker"
> & { blocker?: Blocker | null };
